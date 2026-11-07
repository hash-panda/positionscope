import type { ClientRequest, ClientRequestConstructorOptions } from 'electron';
import type { Readable } from 'node:stream';
import { InstallTarget, UpdateIO, serveVerifiedUpdate, writeVerifiedPackage } from './update-install';

const ASSET_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
export function allowedUpdateURL(url: string) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password && !u.port && (ASSET_HOSTS.has(u.hostname) || u.hostname === 'api.github.com'); }
  catch { return false; }
}
/** Electron 45 net.fetch(manual) cancels redirects without exposing a redirect
 * response. Use ClientRequest's synchronous redirect event: validate BEFORE
 * followRedirect, retaining credentials=omit and the isolated session. */
export function updateNetwork(createRequest: (options: ClientRequestConstructorOptions) => ClientRequest): UpdateIO {
  const request = (url: string, timeoutMs: number) => new Promise<Readable>((resolve, reject) => {
    if (!allowedUpdateURL(url)) { reject(new Error('Update host rejected')); return; }
    const outgoing = createRequest({ url, method: 'GET', redirect: 'manual', credentials: 'omit', useSessionCookies: false });
    let redirects = 0;
    const timer = setTimeout(() => { reject(new Error('Update transport timed out')); outgoing.abort(); }, timeoutMs);
    const cleanup = () => clearTimeout(timer);
    const fail = (error: Error) => { cleanup(); reject(error); outgoing.abort(); };
    outgoing.setHeader('Accept', new URL(url).hostname === 'api.github.com' ? 'application/vnd.github+json' : 'application/octet-stream');
    outgoing.setHeader('Cache-Control', 'no-cache');
    outgoing.setHeader('User-Agent', 'PositionScope-updater');
    outgoing.on('redirect', (_status: number, method: string, next: string) => {
      if (++redirects > 3 || method !== 'GET' || !allowedUpdateURL(next)) { fail(new Error('Update redirect rejected')); return; }
      outgoing.followRedirect();
    });
    outgoing.on('login', () => fail(new Error('Update authentication rejected')));
    outgoing.on('error', () => { cleanup(); reject(new Error('Update transport failed')); });
    outgoing.on('response', response => {
      const stream = response as unknown as Readable;
      stream.once('end', cleanup); stream.once('error', cleanup);
      stream.once('close', () => { cleanup(); outgoing.abort(); });
      if (response.statusCode !== 200) { fail(Object.assign(new Error('Update transport failed'), { code: 'UPDATE_HTTP', status: response.statusCode })); stream.destroy(); return; }
      resolve(stream);
    });
    outgoing.end();
  });
  return {
    async read(url: string, limit: number) {
      const response = await request(url, 20000), chunks: Buffer[] = []; let bytes = 0;
      for await (const chunk of response) {
        const buffer = Buffer.from(chunk); bytes += buffer.length;
        if (bytes > limit) throw new Error('Update metadata oversized'); chunks.push(buffer);
      }
      return Buffer.concat(chunks);
    },
    async download(target: InstallTarget, file: string, progress: (percent: number) => void) {
      await writeVerifiedPackage(await request(target.url, 10 * 60 * 1000), file, target, progress);
    },
    serve: serveVerifiedUpdate,
  };
}
