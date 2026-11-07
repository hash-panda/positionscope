import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer, Server } from 'node:http';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { inspectLatestRelease, LATEST_RELEASE_URL, AppUpdateResult } from './app-updates';

export type UpdateState = Omit<AppUpdateResult, 'state'> & {
  state: AppUpdateResult['state'] | 'checking' | 'downloading' | 'verifying' | 'ready';
  progress?: number;
};
export interface InstallTarget { version: string; arch: string; url: string; size: number; sha256: string; verificationUrl: string; verificationHash: string; }
const MAX_ZIP = 512 * 1024 * 1024;
const HASH = /^sha256:([a-f0-9]{64})$/;
export function installTarget(current: string, release: any, arch: string): InstallTarget {
  const result = inspectLatestRelease(current, release);
  if (result.state !== 'available' || !['arm64', 'x64'].includes(arch)) throw new Error('Update not available');
  const stem = `PositionScope-${result.latestVersion}-${arch}`;
  const zip = release.assets.find((a: any) => a.name === `${stem}.zip`);
  const verification = release.assets.find((a: any) => a.name === `${stem}-verification.json`);
  const digest = HASH.exec(zip.digest), recordDigest = HASH.exec(verification.digest);
  if (!digest || !recordDigest || zip.size > MAX_ZIP || verification.size > 256 * 1024) throw new Error('Invalid update digest or size');
  return { version: result.latestVersion!, arch, url: zip.browser_download_url, size: zip.size, sha256: digest[1], verificationUrl: verification.browser_download_url, verificationHash: recordDigest[1] };
}
export function verifyReleaseRecord(bytes: Buffer, target: InstallTarget, systemVersion = '13.0') {
  if (createHash('sha256').update(bytes).digest('hex') !== target.verificationHash) throw new Error('Invalid release record digest');
  const data = JSON.parse(bytes.toString('utf8'));
  const parseOS = (value: unknown) => typeof value === 'string' && /^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?$/.test(value) ? value.split('.').map(Number) : null;
  const minimum = parseOS(data.minimum_macos_version), actual = parseOS(systemVersion);
  if (!minimum || !actual || minimum.some((part, index) => part > (actual[index] || 0) && minimum.slice(0, index).every((before, i) => before === (actual[i] || 0)))) throw new Error('Unsupported macOS version');
  if (data.version !== target.version || data.architecture !== target.arch || data.app_id !== 'app.funagent.positionscope' ||
    data.signature_verified !== true || data.staple_validated !== true || data.gatekeeper_assessment !== 'accepted' ||
    typeof data.app_notarization !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.app_notarization) ||
    data.artifacts?.[`PositionScope-${target.version}-${target.arch}.zip`] !== target.sha256) throw new Error('Release not verified');
}
/** Shared by the real streaming download and synthetic tests; never buffers the ZIP. */
export async function writeVerifiedPackage(source: NodeJS.ReadableStream, file: string, target: Pick<InstallTarget, 'sha256' | 'size'>, progress: (percent: number) => void) {
  let count = 0; const hash = createHash('sha256');
  const check = new Transform({ transform(chunk, _encoding, callback) {
    count += chunk.length;
    if (count > target.size || count > MAX_ZIP) { callback(new Error('Oversized update')); return; }
    hash.update(chunk); progress(Math.min(99, Math.floor(count / target.size * 100))); callback(null, chunk);
  } });
  try {
    await pipeline(source, check, createWriteStream(file, { flags: 'wx', mode: 0o600 }));
    if (count !== target.size || hash.digest('hex') !== target.sha256) throw new Error('Update checksum mismatch');
  } catch (error) { await rm(file, { force: true }); throw error; }
}
/** Private loopback bridge to Squirrel.Mac. Only a previously verified public ZIP is served.
 * No filesystem path, account data, custom URL or request body is accepted from the renderer. */
export async function serveVerifiedUpdate(file: string, target: InstallTarget): Promise<{ url: string; close(): void }> {
  const token = randomBytes(32).toString('hex'); let server: Server;
  server = createServer((req, res) => {
    const address = server.address();
    const host = address && typeof address === 'object' ? `127.0.0.1:${address.port}` : '';
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' || req.headers.host !== host || req.headers.origin) { res.writeHead(403).end(); return; }
    if (req.url === `/${token}/feed`) {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ url: `http://${host}/${token}/package.zip`, name: target.version, notes: 'PositionScope verified update', sha256: target.sha256, size: target.size }));
    } else if (req.url === `/${token}/package.zip`) {
      res.setHeader('Content-Type', 'application/zip'); res.setHeader('Content-Length', target.size);
      const stream = createReadStream(file); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res);
    } else res.writeHead(404).end();
  });
  server.requestTimeout = 30000; server.headersTimeout = 10000;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Local update bridge unavailable');
  return { url: `http://127.0.0.1:${address.port}/${token}/feed`, close: () => { server.close(); server.closeAllConnections(); } };
}
export interface NativeUpdater {
  on(event: string, listener: (...args: any[]) => void): unknown;
  setFeedURL(options: { url: string }): void;
  checkForUpdates(): void;
  quitAndInstall(): void;
}
export interface UpdateIO {
  read(url: string, limit: number): Promise<Buffer>;
  download(target: InstallTarget, file: string, progress: (percent: number) => void): Promise<void>;
  serve: typeof serveVerifiedUpdate;
}
/** Single main-process state shared by both windows; explicit user actions only. */
export class UpdateInstaller {
  private state: UpdateState;
  private target?: InstallTarget;
  private directory?: string;
  private bridge?: { url: string; close(): void };
  private nativeStarted = false;
  private restarting = false;
  constructor(private current: string, private arch: string, private enabled: boolean, private temporaryRoot: string,
    private updater: NativeUpdater, private io: UpdateIO, private changed: (state: UpdateState) => void, private systemVersion = '13.0') {
    this.state = { state: 'current', currentVersion: current, message: '点击检查更新。' };
    updater.on('error', () => { if (this.nativeStarted) { this.nativeStarted = false; this.fail('更新包未通过系统检查。请稍后重试；当前应用保持不变。'); void this.cleanup(); } });
    updater.on('update-not-available', () => { if (this.nativeStarted) { this.nativeStarted = false; this.fail('系统未能准备更新，请稍后重试。'); void this.cleanup(); } });
    updater.on('update-downloaded', () => { if (this.nativeStarted) { this.nativeStarted = false; this.set({ state: 'ready', progress: 100, message: '更新已准备好。可立即重启更新，或在下次退出后安装。' }); void this.cleanup(); } });
  }
  snapshot() { return { ...this.state }; }
  private set(value: Partial<UpdateState>) { this.state = { ...this.state, ...value }; this.changed(this.snapshot()); }
  private fail(message: string) { this.target = undefined; this.set({ state: 'unavailable', progress: undefined, message }); }
  private busy() { return ['checking', 'downloading', 'verifying', 'ready'].includes(this.state.state); }
  async check() {
    if (this.busy()) return this.snapshot();
    this.target = undefined; this.set({ state: 'checking', progress: undefined, latestVersion: undefined, releaseUrl: undefined, message: '正在检查官方版本…' });
    try {
      const release = JSON.parse((await this.io.read(LATEST_RELEASE_URL, 1024 * 1024)).toString('utf8'));
      const result = inspectLatestRelease(this.current, release);
      if (result.state === 'available') {
        this.target = installTarget(this.current, release, this.arch);
        this.set({ ...result, message: `发现 ${result.latestVersion}。下载后可在应用内重启更新。` });
      } else this.set(result);
    } catch { this.fail('无法确认官方更新，请检查网络后重试。'); }
    return this.snapshot();
  }
  async download() {
    if (this.state.state !== 'available' || !this.target) return this.snapshot();
    if (!this.enabled) { this.fail('应用内安装仅支持已安装的 macOS 签名应用。请先将 PositionScope 移到“应用程序”中。'); return this.snapshot(); }
    const target = this.target;
    this.set({ state: 'downloading', progress: 0, message: '正在下载官方更新…' });
    try {
      verifyReleaseRecord(await this.io.read(target.verificationUrl, 256 * 1024), target, this.systemVersion);
      this.directory = await mkdtemp(join(this.temporaryRoot, 'positionscope-update-'));
      const file = join(this.directory, 'update.zip');
      await this.io.download(target, file, progress => { if (progress !== this.state.progress) this.set({ progress }); });
      this.set({ state: 'verifying', progress: 100, message: '摘要已核对，正在进行 macOS 签名检查并准备安装…' });
      this.bridge = await this.io.serve(file, target);
      this.nativeStarted = true;
      this.updater.setFeedURL({ url: this.bridge.url });
      this.updater.checkForUpdates();
    } catch { this.nativeStarted = false; this.fail('下载或校验失败。请检查网络与磁盘空间后重试，当前应用保持不变。'); await this.cleanup(); }
    return this.snapshot();
  }
  restart() {
    if (this.state.state !== 'ready' || this.restarting) return false;
    this.restarting = true;
    try { this.updater.quitAndInstall(); return true; } catch { this.restarting = false; return false; }
  }
  private async cleanup() {
    this.bridge?.close(); this.bridge = undefined;
    const directory = this.directory; this.directory = undefined;
    if (directory) await rm(directory, { recursive: true, force: true }).catch(() => {});
  }
  dispose() { this.bridge?.close(); void this.cleanup(); }
}
