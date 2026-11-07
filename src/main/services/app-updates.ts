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

/** Metadata readiness only; the installer separately checks record/digest and native signature. */
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
    message: `发现 ${latestVersion}，可在应用内下载并准备更新。` };
}
