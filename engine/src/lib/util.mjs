import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

export const ENGINE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ROOT = resolve(ENGINE, '..');
export const CORE = join(ROOT, '_CORE-INFRASTRUCTURE');
export const TENANTS = join(ROOT, 'tenants');

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;
export const DEPT_RE = /^\d{2}-[A-Za-z0-9-]{2,48}$/;

export function tenantDir(name) {
  if (!SLUG_RE.test(name)) throw new Error('Geçersiz kurum adı: ' + name);
  return join(TENANTS, name);
}

// Yol kaçışını engelle: hedef mutlaka base içinde kalmalı.
export function safeJoin(base, ...parts) {
  const p = resolve(base, ...parts);
  const b = resolve(base);
  if (p !== b && !p.startsWith(b + sep)) throw new Error('Yol izolasyon ihlali');
  return p;
}

export function ensureDir(p) { mkdirSync(p, { recursive: true }); return p; }
export function writeIfMissing(p, content) { if (!existsSync(p)) { ensureDir(dirname(p)); writeFileSync(p, content); return true; } return false; }
export function writeFile(p, content) { ensureDir(dirname(p)); writeFileSync(p, content); }
export function readJSON(p, def = null) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return def; } }
export function writeJSON(p, o) { writeFile(p, JSON.stringify(o, null, 2) + '\n'); }

export function listTenants() {
  if (!existsSync(TENANTS)) return [];
  return readdirSync(TENANTS).filter(n => SLUG_RE.test(n) && existsSync(join(TENANTS, n, 'tenant-config.json')));
}

export function walk(dir, fn, depth = 0) {
  if (depth > 12 || !existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, fn, depth + 1); }
    else fn(p, e.name);
  }
}

export function toPosix(p) { return p.split(sep).join('/'); }

export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':'); if (i < 1) continue;
    const k = line.slice(0, i).trim(); let v = line.slice(i + 1).trim();
    if (/^[\[{]/.test(v)) { try { v = JSON.parse(v); } catch { } }
    else if (v === 'true' || v === 'false') v = v === 'true';
    meta[k] = v;
  }
  return { meta, body: m[2] };
}

// paths glob desteği: ** (her şey), * (segment içi), ? (tek karakter)
export function globToRegex(g) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') { if (g[i + 1] === '*') { r += '.*'; i++; if (g[i + 1] === '/') i++; } else r += '[^/]*'; }
    else if (c === '?') r += '[^/]';
    else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + r + '$');
}
export function pathMatches(globs, relPath) {
  return (Array.isArray(globs) ? globs : [globs]).some(g => globToRegex(g).test(relPath) || globToRegex(g).test(relPath + '/'));
}

export function dirSize(p) { let n = 0; walk(p, f => { n += statSync(f).size; }); return n; }
