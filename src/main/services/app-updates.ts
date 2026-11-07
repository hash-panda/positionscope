import axios from 'axios';

const REPOSITORY = 'https://github.com/hash-panda/positionscope';
export const LATEST_RELEASE_URL = 'https://api.github.com/repos/hash-panda/positionscope/releases/latest';
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const CURRENT = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*))?$/;
export interface AppUpdateResult {
  state: 'current' | 'available' | 'unavailable';
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  message: string;
}
function version(value: unknown, stable: boolean) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const parsed = (stable ? STABLE : CURRENT).exec(value);
  if (!parsed || parsed[0] !== value) return null;
  const numbers = parsed.slice(1, 4).map(Number);
  return numbers.every(Number.isSafeInteger) ? { numbers, prerelease: !!parsed[4] } : null;
}
export function isNewerStableVersion(current: string, latest: string): boolean {
  const before = version(current, false), after = version(latest, true);
  if (!before || !after) throw new Error('Unsupported release version');
  for (let i = 0; i < 3; i++) if (after.numbers[i] !== before.numbers[i]) return after.numbers[i] > before.numbers[i];
  return before.prerelease;
}

/** The update action offers a repository page, never downloads or executes packages.
 * Asset presence is a release-readiness gate, not a local signature verification. */
export function inspectLatestRelease(currentVersion: string, release: unknown): AppUpdateResult {
  const unavailable: AppUpdateResult = { state: 'unavailable', currentVersion, message: '暂时无法确认可用更新，请稍后重试。' };
  if (!release || typeof release !== 'object' || Array.isArray(release) || !version(currentVersion, false)) return unavailable;
  const data = release as Record<string, unknown>;
  if (data.draft !== false || data.prerelease !== false || typeof data.tag_name !== 'string') return unavailable;
  const latestVersion = data.tag_name.replace(/^v/, '');
  if (!version(latestVersion, true) || data.html_url !== `${REPOSITORY}/releases/tag/${data.tag_name}` || !Array.isArray(data.assets)) return unavailable;
  const names = ['arm64', 'x64'].flatMap(arch => ['dmg', 'zip'].map(ext => `PositionScope-${latestVersion}-${arch}.${ext}`).concat(`PositionScope-${latestVersion}-${arch}-verification.json`)).concat('SHA256SUMS.txt');
  for (const name of names) {
    const matches = data.assets.filter(asset => asset && typeof asset === 'object' && asset.name === name);
    if (matches.length !== 1) return unavailable;
    const asset = matches[0];
    if (asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.browser_download_url !== `${REPOSITORY}/releases/download/${data.tag_name}/${name}`) return unavailable;
  }
  if (!isNewerStableVersion(currentVersion, latestVersion)) return { state: 'current', currentVersion, latestVersion, message: '当前已是最新可用版本。' };
  return { state: 'available', currentVersion, latestVersion, releaseUrl: data.html_url as string,
    message: `发现 ${latestVersion}，可前往官方发布页查看更新、签名验证记录并下载安装。` };
}

export type ReadLatestRelease = (url: string) => Promise<unknown>;
const readLatestRelease: ReadLatestRelease = async url => (await axios.get(url, {
  timeout: 8000, maxRedirects: 0, maxContentLength: 512 * 1024, proxy: false,
  headers: { Accept: 'application/vnd.github+json' },
})).data;

/** Explicit user action only; unauthenticated public GET, no account/model/settings payload. */
export async function checkForUpdates(currentVersion: string, read: ReadLatestRelease = readLatestRelease): Promise<AppUpdateResult> {
  try { return inspectLatestRelease(currentVersion, await read(LATEST_RELEASE_URL)); }
  catch { return { state: 'unavailable', currentVersion, message: '无法连接官方更新服务，请检查网络后重试。' }; }
}
