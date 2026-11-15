// Bağlam motoru: kural (paths) yükleme, skill keşfi/eşleştirme, personel keşfi, yerel RAG.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { tenantDir, frontmatter, pathMatches, toPosix, readJSON, walk } from './util.mjs';
import { db } from './db.mjs';

export const trLower = s => String(s || '').toLocaleLowerCase('tr-TR');
const fold = s => trLower(s).replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c');
const STOP = new Set(['ve', 'ile', 'icin', 'bir', 'bu', 'su', 'da', 'de', 'mi', 'ne', 'gibi', 'olan', 'olarak', 'cok', 'daha', 'en', 'ya', 'veya', 'the', 'and', 'for', 'yap', 'hazirla', 'lutfen']);
export const terms = s => fold(s).split(/[^a-z0-9$]+/).filter(w => w.length > 2 && !STOP.has(w)).map(w => w.slice(0, 6));

export function tenantConfig(tenant) { return readJSON(join(tenantDir(tenant), 'tenant-config.json')); }

// ---- Personel ----
export function listPersonnel(tenant) {
  const cfg = tenantConfig(tenant); const out = [];
  for (const d of cfg.departments) {
    const pd = join(tenantDir(tenant), 'departmanlar', d.slug, 'personeller');
    if (!existsSync(pd)) continue;
    for (const slug of readdirSync(pd)) {
      const prof = join(pd, slug, 'profil.md');
      if (!existsSync(prof)) continue;
      const { meta, body } = frontmatter(readFileSync(prof, 'utf8'));
      out.push({ slug, dept: d.slug, title: meta.title || slug, head: meta.head === true, mission: (/## Görev Tanımı\s+([^\n]+)/.exec(body) || [])[1] || '' });
    }
  }
  return out;
}

// ---- Skills ----
export function listSkills(tenant, { includeDrafts = false } = {}) {
  const root = tenantDir(tenant); const out = [];
  const scan = (base, scope, dept = null, personnel = null) => {
    if (!existsSync(base)) return;
    for (const n of readdirSync(base)) {
      const f = join(base, n, 'SKILL.md');
      if (!existsSync(f)) continue;
      const { meta, body } = frontmatter(readFileSync(f, 'utf8'));
      const status = meta.status || 'active';
      if (status !== 'active' && !includeDrafts) continue;
      const dir = join(base, n);
      const scripts = existsSync(join(dir, 'scripts')) ? readdirSync(join(dir, 'scripts')).filter(x => /\.(mjs|js)$/.test(x)) : [];
      out.push({ name: meta.name || n, description: meta.description || '', triggers: Array.isArray(meta.triggers) ? meta.triggers : [], arguments: Array.isArray(meta.arguments) ? meta.arguments : [], status, scope, dept, personnel, dir, rel: toPosix(relative(root, dir)), scripts, body });
    }
  };
  scan(join(root, '.claude', 'skills'), 'tenant');
  const cfg = tenantConfig(tenant);
  for (const d of cfg.departments) {
    const dd = join(root, 'departmanlar', d.slug);
    scan(join(dd, 'skills'), 'departman', d.slug);
    const pd = join(dd, 'personeller');
    if (existsSync(pd)) for (const p of readdirSync(pd)) scan(join(pd, p, 'skills'), 'personel', d.slug, p);
  }
  return out;
}

export function scoreSkill(skill, text) {
  const low = fold(text); let s = 0;
  for (const t of skill.triggers) if (low.includes(fold(t))) s += 10 + fold(t).length / 4;
  if (low.includes(fold(skill.name.replace(/-/g, ' ')))) s += 8;
  const tt = new Set(terms(text));
  for (const w of terms(skill.description)) if (tt.has(w)) s += 1;
  return s;
}

export function matchSkill(tenant, text, { dept = null } = {}) {
  const skills = listSkills(tenant).filter(s => s.scope === 'personel' && (!dept || s.dept === dept));
  let best = null, bs = 0;
  for (const s of skills) { const sc = scoreSkill(s, text); if (sc > bs) { bs = sc; best = s; } }
  return bs >= 6 ? { skill: best, score: bs } : null;
}

export function routeDepartment(tenant, text) {
  const cfg = tenantConfig(tenant);
  const low = fold(text);
  const scores = cfg.departments.map(d => {
    let s = 0; for (const k of d.keywords || []) if (low.includes(fold(k))) s += 3 + fold(k).length / 5;
    return { dept: d.slug, score: s };
  });
  // skill tetikleyicileri de departman sinyali verir
  for (const sk of listSkills(tenant).filter(x => x.scope === 'personel')) { const sc = scoreSkill(sk, text); if (sc >= 6) { const e = scores.find(x => x.dept === sk.dept); if (e) e.score += sc; } }
  scores.sort((a, b) => b.score - a.score);
  return scores[0].score > 0 ? scores : null;
}

// ---- Rules (paths kapsamlı) ----
export function loadRules(tenant, workRel) {
  const root = tenantDir(tenant); const rules = [];
  const files = [];
  const addDir = d => { if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith('.md')) files.push(join(d, f)); };
  addDir(join(root, '.claude', 'rules'));
  const cfg = tenantConfig(tenant);
  for (const d of cfg.departments) {
    addDir(join(root, 'departmanlar', d.slug, 'rules'));
    const pd = join(root, 'departmanlar', d.slug, 'personeller');
    if (existsSync(pd)) for (const p of readdirSync(pd)) addDir(join(pd, p, 'rules'));
  }
  for (const f of files) {
    const { meta, body } = frontmatter(readFileSync(f, 'utf8'));
    const paths = meta.paths || ['**'];
    if (pathMatches(paths, workRel)) rules.push({ file: toPosix(relative(root, f)), scope: meta.scope || 'tenant', text: body.trim() });
  }
  return rules;
}

// ---- Yerel RAG (BM25-lite, kurum ve departman izoleli) ----
const lastIndex = new Map();
export function reindex(tenant, force = false) {
  if (!force && Date.now() - (lastIndex.get(tenant) || 0) < 60000) return;
  lastIndex.set(tenant, Date.now());
  const root = tenantDir(tenant); const d = db(tenant);
  const known = new Map(d.prepare('SELECT path, MAX(mtime) m FROM docs GROUP BY path').all().map(r => [r.path, r.m]));
  const seen = new Set();
  const ins = d.prepare('INSERT INTO docs (path,chunk,text,terms,mtime) VALUES (?,?,?,?,?)');
  const del = d.prepare('DELETE FROM docs WHERE path = ?');
  const consider = p => {
    if (!['.md', '.txt', '.csv', '.json'].includes(extname(p))) return;
    const st = statSync(p); if (st.size > 1.5e6) return;
    const rel = toPosix(relative(root, p)); seen.add(rel);
    if (known.get(rel) === st.mtimeMs) return;
    del.run(rel);
    const text = readFileSync(p, 'utf8');
    for (let i = 0, c = 0; i < text.length; i += 900, c++) { const chunk = text.slice(i, i + 1000); ins.run(rel, c, chunk, terms(chunk).join(' '), st.mtimeMs); }
  };
  const cfg = tenantConfig(tenant);
  for (const dep of cfg.departments) walk(join(root, 'departmanlar', dep.slug, 'context'), consider);
  walk(join(root, '_EGITIM-MERKEZI', '02-Islenmis-SOP-Arsivi'), consider);
  for (const [p] of known) if (!seen.has(p)) del.run(p);
}

export function search(tenant, query, { dept = null, limit = 5 } = {}) {
  reindex(tenant);
  const q = [...new Set(terms(query))]; if (!q.length) return [];
  const d = db(tenant);
  const scopeSql = dept ? `WHERE (path LIKE 'departmanlar/${dept.replace(/[^A-Za-z0-9-]/g, '')}/%' OR path LIKE '_EGITIM-MERKEZI/%')` : '';
  const rows = d.prepare(`SELECT path, chunk, text, terms FROM docs ${scopeSql}`).all();
  const N = rows.length || 1;
  const df = Object.fromEntries(q.map(t => [t, rows.filter(r => (' ' + r.terms + ' ').includes(' ' + t + ' ')).length]));
  return rows.map(r => {
    const ts = r.terms.split(' '); let s = 0;
    for (const t of q) { const tf = ts.filter(x => x === t).length; if (tf) s += Math.log(1 + N / (df[t] || 1)) * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * ts.length / 150)); }
    return { path: r.path, chunk: r.chunk, score: s, text: r.text };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
