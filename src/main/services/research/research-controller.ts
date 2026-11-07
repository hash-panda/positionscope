import type { ResearchEvent, ResearchSnapshot } from '../../types/research';
import type { ResearchAIRequest, ResearchAIResult } from '../../types/research-ai';
import type { ResearchJudgmentInput } from '../../types/research-ledger';

interface Dependencies {
  snapshot(): Promise<ResearchSnapshot>;
  analyze(request: ResearchAIRequest): Promise<ResearchAIResult>;
  record(input: ResearchJudgmentInput): Promise<unknown>;
  now?: () => number;
}

/** Owns request identity and freezing. Renderer input never supplies facts or account context. */
export class ResearchController {
  private busy = false;
  private generation = 0;
  constructor(private deps: Dependencies) {}
  invalidate() { this.generation++; }

  async analyze(input: unknown): Promise<ResearchAIResult> {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        Object.keys(input).some(k => !['eventId', 'snapshotId'].includes(k))) throw new Error('研究请求格式无效');
    const request = input as ResearchAIRequest;
    if (typeof request.eventId !== 'string' || typeof request.snapshotId !== 'string' ||
        request.eventId.length > 180 || request.snapshotId.length > 180) throw new Error('研究请求格式无效');
    if (this.busy) throw new Error('已有研究正在进行，请等待完成');
    this.busy = true;
    const generation = this.generation;
    let selected: ResearchEvent | undefined;
    const now = this.deps.now || Date.now;
    try {
      const snapshot = await this.deps.snapshot();
      selected = snapshot.events.find(event => event.id === request.eventId);
      if (snapshot.snapshotId !== request.snapshotId || !selected || !selected.deepResearchEligible ||
          snapshot.timestamps.expiresAt <= now() || selected.expiresAt <= now()) {
        selected = undefined;
        throw new Error('候选已更新或不在本轮深研范围，请刷新研究列表');
      }
      if (generation !== this.generation) throw new Error('研究配置已变更，请重新开始');
      const result = await this.deps.analyze({ eventId: selected.id, snapshotId: snapshot.snapshotId });
      if (generation !== this.generation) throw new Error('研究配置已变更，本次结果未保存');
      if (result.eventId !== selected.id || result.snapshotId !== snapshot.snapshotId || result.symbol !== selected.symbol ||
          result.expiresAt <= now()) throw new Error('研究结果身份或时效校验失败');
      const labels = (ids: string[]) => ids.map(id => result.conditions.find(c => c.id === id)?.label).filter((s): s is string => !!s);
      await this.deps.record({
        eventId: selected.id, snapshotId: selected.snapshotId, symbol: selected.symbol, ruleVersion: selected.ruleVersion,
        provider: result.provider, model: result.model, decidedAt: result.analyzedAt,
        decision: result.status === 'observation' ? 'abstain' : 'hypothesis',
        direction: result.status === 'conditional-long' ? 'long' : result.status === 'conditional-short' ? 'short' : 'neutral',
        summary: result.summary, facts: result.facts, conditions: labels(result.triggerConditionIds),
        invalidation: labels(result.invalidationConditionIds), gaps: result.gaps,
      });
      if (generation !== this.generation) throw new Error('研究配置已变更，本次结果不再显示');
      return result;
    } catch (error) {
      if (selected && generation === this.generation) {
        // Record failed attempts too. Never persist raw provider errors, credentials or response payloads.
        await this.deps.record({ eventId: selected.id, snapshotId: selected.snapshotId, symbol: selected.symbol,
          ruleVersion: selected.ruleVersion, provider: null, model: null, decidedAt: now(), decision: 'failed',
          direction: 'neutral', summary: '本次研究未通过读取或输出校验，没有生成方向判断。',
          facts: selected.facts, conditions: [], invalidation: [], gaps: ['模型或证据不可用；失败记录不代表市场结论。'] });
      }
      throw error;
    } finally { this.busy = false; }
  }
}
