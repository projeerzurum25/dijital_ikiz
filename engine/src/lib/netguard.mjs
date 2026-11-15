// Giden ağ koruyucusu: motor sürecinde fetch yalnızca loopback ve kurumun izinli intranet IP'lerine gidebilir.
const LOOPBACK = /^(127\.\d+\.\d+\.\d+|localhost|::1|\[::1\]|[a-z0-9-]+\.localhost)$/i;
const PRIVATE = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

export const blocked = [];
let extraAllow = new Set();

export function allowHosts(hosts = []) { for (const h of hosts) if (PRIVATE.test(h) || LOOPBACK.test(h)) extraAllow.add(h.toLowerCase()); }
export function isAllowed(host) { host = String(host).toLowerCase(); return LOOPBACK.test(host) || extraAllow.has(host); }
export function isPrivateOrLoopback(host) { return LOOPBACK.test(host) || PRIVATE.test(host); }

export function installNetGuard({ allowCloud = false } = {}) {
  const orig = globalThis.fetch;
  if (orig.__guarded) return;
  const guarded = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (!isAllowed(url.hostname) && !allowCloud) {
      blocked.push({ ts: new Date().toISOString(), host: url.hostname });
      if (blocked.length > 200) blocked.shift();
      throw new Error(`Offline politika: ${url.hostname} adresine giden istek engellendi`);
    }
    return orig(input, init);
  };
  guarded.__guarded = true;
  globalThis.fetch = guarded;
}
