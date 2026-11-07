import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { UnwrapNestedRefs } from 'vue';
import type { Result } from '../types';
import type { ResearchEvent, ResearchEvidence, ResearchSnapshot } from '../../../main/types/research';
import type { ResearchAIRequest, ResearchAIResult } from '../../../main/types/research-ai';
import type { ResearchAlertInput, ResearchLedgerSnapshot, ShadowRegistration } from '../../../main/types/research-ledger';

export interface ResearchAPI {
  getResearchSnapshot(): Promise<Result & { data?: ResearchSnapshot }>;
  getResearchEvidence(symbol: string): Promise<Result & { data?: ResearchEvidence }>;
  openWorkspace(page?: 'research' | 'positions' | 'review' | 'settings'): Promise<Result>;
  getWindowMode(): Promise<'popup' | 'workspace'>;
  getResearchLedger(): Promise<Result & { data?: ResearchLedgerSnapshot }>;
  setResearchWatch(symbol: string, watched: boolean): Promise<Result>;
  createResearchAlert(input: ResearchAlertInput): Promise<Result>;
  removeResearchAlert(id: string): Promise<Result>;
  registerResearchShadow(input: ShadowRegistration): Promise<Result>;
  analyzeResearch(input: ResearchAIRequest): Promise<Result & { data?: ResearchAIResult }>;
  onResearchLedgerChanged(callback: () => void): (() => void) | void;
}
export function useResearch() {
  const api = window.electronAPI as typeof window.electronAPI & Partial<ResearchAPI>;
  const snapshot = ref<ResearchSnapshot | null>(null);
  const evidence = ref<ResearchEvidence | null>(null);
  const selectedId = ref('');
  const loading = ref(false);
  const evidenceLoading = ref(false);
  const error = ref('');
  const evidenceError = ref('');
  const now = ref(Date.now());
  const ledger = ref<ResearchLedgerSnapshot | null>(null);
  const aiResults = ref<Record<string, ResearchAIResult>>({});
  const aiBusy = ref('');
  const actionError = ref('');
  const actionBusy = ref(false);
  const analysis = computed(() => {
    const event = selected.value;
    const result = event ? aiResults.value[event.id] : null;
    return event && result && result.snapshotId === event.snapshotId && result.symbol === event.symbol && result.expiresAt > now.value ? result : null;
  });
  const outdatedAnalysis = computed(() => !!selected.value && !!aiResults.value[selected.value.id] && !analysis.value);
  const selected = computed(() => snapshot.value?.events.find(e => e.id === selectedId.value) || null);
  const stale = computed(() => !!snapshot.value && now.value >= snapshot.value.timestamps.expiresAt);
  let request = 0;
  let ledgerRequest = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let ledgerCleanup: (() => void) | undefined;
  let lastScanAt = 0;
  async function loadLedger() {
    if (!api?.getResearchLedger) return;
    const generation = ++ledgerRequest;
    try { const result = await api.getResearchLedger(); if (!disposed && generation === ledgerRequest && result.success && result.data) ledger.value = result.data; }
    catch { if (!disposed && generation === ledgerRequest) actionError.value = '本地研究记录读取失败，请重试。'; }
  }
  async function mutate(action: (() => Promise<Result>) | undefined) {
    if (actionBusy.value || !action) return;
    actionError.value = ''; actionBusy.value = true;
    try { const result = await action(); if (disposed) return; if (!result.success) throw new Error(result.error || '操作未完成'); await loadLedger(); }
    catch { if (!disposed) actionError.value = '操作未完成，原设置已保留。请重试。'; }
    finally { if (!disposed) actionBusy.value = false; }
  }
  async function analyze() {
    const event = selected.value;
    if (!event || aiBusy.value || !api.analyzeResearch) return;
    aiBusy.value = event.id; actionError.value = '';
    try {
      const result = await api.analyzeResearch({ eventId: event.id, snapshotId: event.snapshotId });
      if (disposed) return;
      if (!result.success || !result.data) { actionError.value = result.error || 'AI 查证未完成，请检查模型设置或稍后重试。'; return; }
      if (result.data.snapshotId !== event.snapshotId || result.data.eventId !== event.id || result.data.symbol !== event.symbol || snapshot.value?.snapshotId !== event.snapshotId) {
        actionError.value = '研究快照已变化，本次结果未显示，请重新查证。'; return;
      }
      aiResults.value = { ...aiResults.value, [event.id]: result.data };
    } catch { if (!disposed) actionError.value = 'AI 查证未完成。未生成投资判断，请重试。'; }
    finally { if (!disposed) { aiBusy.value = ''; await loadLedger(); } }
  }
  async function select(event: ResearchEvent) {
    selectedId.value = event.id;
    evidence.value = null;
    evidenceError.value = '';
    if (!api?.getResearchEvidence) { evidenceError.value = '研究接口不可用，请使用新版桌面应用。'; return; }
    const generation = ++request;
    evidenceLoading.value = true;
    try {
      const result = await api.getResearchEvidence(event.symbol);
      if (disposed || generation !== request) return;
      if (!result.success || !result.data) throw new Error(result.error || '证据暂不可用，请重试。');
      if (result.data.symbol !== event.symbol || result.data.snapshotId !== event.snapshotId || snapshot.value?.snapshotId !== event.snapshotId) {
        evidenceError.value = '证据与当前研究快照不匹配，请刷新扫描后重试。'; return;
      }
      evidence.value = result.data;
    } catch { if (!disposed && generation === request) evidenceError.value = '暂未取得完整证据。可稍后刷新，或选择待查证事件。'; }
    finally { if (!disposed && generation === request) evidenceLoading.value = false; }
  }
  async function refresh() {
    if (loading.value || disposed) return;
    lastScanAt = Date.now();
    error.value = '';
    if (!api?.getResearchSnapshot) { error.value = '请通过桌面应用打开研究工作台。'; return; }
    loading.value = true;
    try {
      const result = await api.getResearchSnapshot();
      if (disposed) return;
      if (!result.success || !result.data) throw new Error(result.error || '扫描暂不可用');
      const previous = selected.value;
      // Preserve the existing order and selection across refreshes; append new candidates.
      const order = new Map((snapshot.value?.events || []).map((e, i) => [`${e.symbol}:${e.kind}`, i]));
      const events = [...result.data.events].sort((a, b) => (order.get(`${a.symbol}:${a.kind}`) ?? Infinity) - (order.get(`${b.symbol}:${b.kind}`) ?? Infinity));
      snapshot.value = { ...result.data, events };
      const next = events.find(e => e.symbol === previous?.symbol && e.kind === previous?.kind) || events[0];
      if (next) await select(next); else { selectedId.value = ''; evidence.value = null; }
      now.value = Date.now();
    } catch { if (!disposed) error.value = '公共市场扫描未完成。保留上次快照，可稍后重试。'; }
    finally { if (!disposed) loading.value = false; }
  }
  onMounted(() => {
    timer = setInterval(() => { now.value = Date.now(); if (now.value - lastScanAt >= 60000 && !aiBusy.value) void refresh(); }, 15000);
    const cleanup = api?.onResearchLedgerChanged?.(() => { void loadLedger(); });
    if (typeof cleanup === 'function') ledgerCleanup = cleanup;
    void refresh(); void loadLedger();
  });
  onUnmounted(() => { disposed = true; request++; ledgerRequest++; ledgerCleanup?.(); if (timer) clearInterval(timer); });
  return { api, snapshot, evidence, selected, selectedId, loading, evidenceLoading, error, evidenceError, stale, now, select, refresh, ledger, loadLedger, analysis, outdatedAnalysis, aiBusy, analyze, actionError, actionBusy, mutate };
}
export type ResearchModel = UnwrapNestedRefs<ReturnType<typeof useResearch>>;
