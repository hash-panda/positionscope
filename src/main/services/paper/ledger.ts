import { promises as fs } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import type { PaperCommand, PaperEvent, PaperState } from '../../types/paper';
import { applyPaperEvent, emptyPaperState } from './engine';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const MAX_BYTES = 128 * 1024 * 1024;
/** Per-installation local paper ledger. No credentials, exchange account balances or order endpoints. */
export class PaperLedger {
  private state = emptyPaperState();
  private events: PaperEvent[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(private filePath?: string, private now: () => number = Date.now) {}
  static async open(options: { filePath?: string; now?: () => number } = {}): Promise<PaperLedger> {
    const ledger = new PaperLedger(options.filePath, options.now);
    if (!options.filePath) return ledger;
    let data: string;
    try {
      const stat = await fs.stat(options.filePath);
      if (stat.size > MAX_BYTES) throw new Error('Paper ledger size limit');
      data = await fs.readFile(options.filePath, 'utf8');
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ledger; throw new Error('模拟历史无法读取，原文件保留'); }
    try {
      const stored = JSON.parse(data);
      if (stored.version !== 'paper-journal-v1' || !Array.isArray(stored.events)) throw new Error();
      const ids = new Set<string>(); let lastTime = 0;
      for (const event of stored.events as PaperEvent[]) {
        if (ids.has(event.id) || event.at < lastTime || event.at > ledger.now() + 5000) throw new Error();
        ledger.state = applyPaperEvent(ledger.state, event); ids.add(event.id); lastTime = event.at;
      }
      ledger.events = stored.events;
      await fs.chmod(options.filePath, 0o600);
    } catch { throw new Error('模拟历史校验失败，原文件保留；未重置本金或交易记录'); }
    return ledger;
  }
  snapshot(): PaperState { return clone(this.state); }
  /** Event identity enables exactly-once retries; same ID with different content is rejected. */
  append(command: PaperCommand, id = randomUUID()): Promise<PaperState> {
    const frozen = clone(command);
    const run = this.queue.then(async () => {
      const previous = this.events.find(e => e.id === id);
      if (previous) {
        if (JSON.stringify(previous.command) !== JSON.stringify(frozen)) throw new Error('模拟事件身份冲突');
        return this.snapshot();
      }
      const at = this.now();
      if (this.events.length && at < this.events[this.events.length - 1].at) throw new Error('系统时钟回退，模拟暂缓');
      const event = { id, at, command: frozen };
      const next = applyPaperEvent(this.state, event), events = [...this.events, event];
      if (this.filePath) {
        const data = JSON.stringify({ version: 'paper-journal-v1', events });
        if (Buffer.byteLength(data) > MAX_BYTES) throw new Error('模拟历史达到本地容量限制；停止运行并保留历史');
        const temporary = `${this.filePath}.${randomUUID()}.tmp`;
        try {
          await fs.mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
          const file = await fs.open(temporary, 'wx', 0o600);
          try { await file.writeFile(data, 'utf8'); await file.sync(); } finally { await file.close(); }
          await fs.rename(temporary, this.filePath);
        } catch { await fs.unlink(temporary).catch(() => undefined); throw new Error('模拟账本保存失败，本次事件未应用'); }
      }
      this.events = events; this.state = next; return this.snapshot();
    });
    this.queue = run.catch(() => undefined); return run;
  }
}
