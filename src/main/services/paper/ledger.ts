import { promises as fs } from 'fs';
import { dirname } from 'path';
import { randomUUID } from 'crypto';
import type { PaperCommand, PaperEvent, PaperState } from '../../types/paper';
import { applyPaperEvent, emptyPaperState } from './engine';
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const MAX_BYTES = 128 * 1024 * 1024;
export type PaperLedgerFileSystem = Pick<typeof fs, 'stat' | 'readFile' | 'open' | 'mkdir' | 'rename' | 'unlink' | 'chmod'>;
export interface PaperLedgerOptions { filePath?: string; fileSystem?: PaperLedgerFileSystem; now?: () => number; }
/** Per-installation local paper ledger. No credentials, exchange account balances or order endpoints. */
export class PaperLedger {
  private state = emptyPaperState();
  private events: PaperEvent[] = [];
  private closed = false;
  private commitUncertain = false;
  private readonly io: PaperLedgerFileSystem;
  private readonly filePath?: string;
  private readonly now: () => number;
  async close() { this.closed = true; await this.queue; }
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(options: PaperLedgerOptions) {
    this.filePath = options.filePath;
    this.io = options.fileSystem ?? fs;
    this.now = options.now ?? Date.now;
  }
  static async open(options: PaperLedgerOptions = {}): Promise<PaperLedger> {
    const ledger = new PaperLedger(options);
    if (!options.filePath) return ledger;
    let data: string;
    try {
      const stat = await ledger.io.stat(options.filePath);
      if (stat.size > MAX_BYTES) throw new Error('Paper ledger size limit');
      data = await ledger.io.readFile(options.filePath, 'utf8');
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
      await ledger.io.chmod(options.filePath, 0o600);
    } catch { throw new Error('模拟历史校验失败，原文件保留；未重置本金或交易记录'); }
    return ledger;
  }
  snapshot(): PaperState { return clone(this.state); }
  /** Event identity enables exactly-once retries; same ID with different content is rejected. */
  append(command: PaperCommand, id: string = randomUUID()): Promise<PaperState> {
    if (this.closed) return Promise.reject(new Error("模拟账本已关闭"));
    const frozen = clone(command);
    const run = this.queue.then(async () => {
      if (this.commitUncertain) throw new Error('模拟账本提交状态待核对，请重新打开应用校验历史');
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
        let renameAttempted = false;
        try {
          await this.io.mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
          const file = await this.io.open(temporary, 'wx', 0o600);
          try { await file.writeFile(data, 'utf8'); await file.sync(); } finally { await file.close(); }
          renameAttempted = true;
          await this.io.rename(temporary, this.filePath);
          // The file sync commits its bytes; syncing the parent directory also
          // commits the rename before the new in-memory event is published.
          const directory = await this.io.open(dirname(this.filePath), 'r');
          try { await directory.sync(); } finally { await directory.close(); }
        } catch {
          await this.io.unlink(temporary).catch(() => undefined);
          if (renameAttempted) {
            // The target may already contain this event. An old memory snapshot
            // must not overwrite it, including through writes already queued.
            this.commitUncertain = true;
            throw new Error('模拟账本提交状态待核对，请重新打开应用校验历史');
          }
          throw new Error('模拟账本保存失败，本次事件未应用');
        }
      }
      this.events = events; this.state = next; return this.snapshot();
    });
    this.queue = run.catch(() => undefined); return run;
  }
}
