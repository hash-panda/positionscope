import { Readable } from 'node:stream';
import { InstallTarget, UpdateIO, serveVerifiedUpdate, writeVerifiedPackage } from './update-install';

const ASSET_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
export function allowedUpdateURL(url: string) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.port && (ASSET_HOSTS.has(u.hostname) || u.hostname === 'api.github.com'); }
  catch { return false; }
}
/** Isolated Electron session uses macOS networking without account cookies or credentials.
 * Redirects are checked before contacting the next host; error details never reach the UI/log. */
export function updateNetwork(fetcher: (url: string, options: RequestInit) => Promise<Response>): UpdateIO {
  const request = async (url: string, signal: AbortSignal) => {
    for (let hop = 0; hop < 4; hop++) {
      if (!allowedUpdateURL(url)) throw new Error('Update host rejected');
      const response = await fetcher(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal, headers: { 'Cache-Control': 'no-cache', Accept: 'application/octet-stream, application/json' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location'); await response.body?.cancel();
        if (!location) throw new Error('Missing update location'); url = new URL(location, url).href; continue;
      }
      if (!response.ok || response.status !== 200 || !response.body) { await response.body?.cancel(); throw new Error('Update transport failed'); }
      return response;
    }
    throw new Error('Too many update redirects');
  };
  return {
    async read(url: string, limit: number) {
      const response = await request(url, AbortSignal.timeout(20000)), chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of Readable.fromWeb(response.body as any)) {
        const buffer = Buffer.from(chunk); bytes += buffer.length;
        if (bytes > limit) throw new Error('Update metadata oversized'); chunks.push(buffer);
      }
      return Buffer.concat(chunks);
    },
    async download(target: InstallTarget, file: string, progress: (percent: number) => void) {
      const response = await request(target.url, AbortSignal.timeout(10 * 60 * 1000));
      await writeVerifiedPackage(Readable.fromWeb(response.body as any), file, target, progress);
    },
    serve: serveVerifiedUpdate,
  };
}
