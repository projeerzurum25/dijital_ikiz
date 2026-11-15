// Skill betik kütüphanesi — her betik sıfır bağımlılıklı Node.js (.mjs).
// Sözleşme: girdi JSON'u stdin'den veya `--input dosya.json` ile alınır, sonuç stdout'a JSON yazılır.
// Motor bu betikleri Node permission model sandbox'ında, yalnızca kurum klasörüne erişimle çalıştırır.

const HEADER = `import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
function readInput() {
  const i = process.argv.indexOf('--input');
  try {
    if (i > -1) return JSON.parse(readFileSync(process.argv[i + 1], 'utf8'));
    if (!process.stdin.isTTY) { const s = readFileSync(0, 'utf8').trim(); if (s) return JSON.parse(s); }
  } catch (e) { out({ ok: false, hata: 'Girdi okunamadı: ' + e.message }); process.exit(1); }
  return {};
}
function out(o) { process.stdout.write(JSON.stringify(o, null, 2)); }
function asset(name) { const p = join(ASSETS, name); return existsSync(p) ? readFileSync(p, 'utf8') : null; }
function parseCSV(text) {
  const lines = text.replace(/\\r/g, '').split('\\n').filter(l => l.trim());
  if (!lines.length) return [];
  const split = l => { const r = []; let c = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(c); c = ''; } else c += ch; } r.push(c); return r.map(s => s.trim()); };
  const h = split(lines[0]);
  return lines.slice(1).map(l => { const v = split(l); return Object.fromEntries(h.map((k, i) => [k, v[i] ?? ''])); });
}
`;

export const SCRIPTS = {
  'kritik_yol_hesapla.mjs': HEADER + `
// Kritik Yol Yöntemi (CPM): en erken/en geç başlangıç, bolluk ve kritik yol.
const input = readInput();
const tasks = input.tasks || JSON.parse(asset('ornek-gorevler.json') || '{"tasks":[]}').tasks;
const byId = Object.fromEntries(tasks.map(t => [t.id, { ...t, deps: t.deps || [] }]));
const order = []; const seen = new Set(); const stack = new Set();
function visit(id) {
  if (seen.has(id)) return; if (stack.has(id)) throw new Error('Döngüsel bağımlılık: ' + id);
  stack.add(id); for (const d of byId[id].deps) { if (!byId[d]) throw new Error('Bilinmeyen bağımlılık: ' + d); visit(d); }
  stack.delete(id); seen.add(id); order.push(id);
}
try { Object.keys(byId).forEach(visit); } catch (e) { out({ ok: false, hata: e.message }); process.exit(1); }
for (const id of order) { const t = byId[id]; t.es = Math.max(0, ...t.deps.map(d => byId[d].ef)); t.ef = t.es + Number(t.duration || 0); }
const total = Math.max(...order.map(id => byId[id].ef));
for (const id of [...order].reverse()) {
  const t = byId[id]; const succ = order.filter(s => byId[s].deps.includes(id));
  t.lf = succ.length ? Math.min(...succ.map(s => byId[s].ls)) : total; t.ls = t.lf - Number(t.duration || 0); t.slack = t.ls - t.es;
}
const missing = tasks.filter(t => t.duration == null).map(t => t.id);
out({ ok: true, toplam_sure_gun: total, kritik_yol: order.filter(id => byId[id].slack === 0), eksik_sure: missing,
  tablo: order.map(id => { const t = byId[id]; return { id, gorev: t.name, sure: t.duration, bagimlilik: t.deps.join(',') || '-', ES: t.es, EF: t.ef, LS: t.ls, LF: t.lf, bolluk: t.slack, kritik: t.slack === 0 }; }) });
`,

  'veri_topla.mjs': HEADER + `
// Offline yerel arşiv taraması: kurum klasöründeki .md/.txt/.csv/.json dosyalarında anahtar kelime arar.
const input = readInput();
const kws = String(input.ANAHTAR_KELIMELER || input.anahtar_kelimeler || input.query || '').toLowerCase().split(/[,\\s]+/).filter(w => w.length > 2);
let root = HERE; for (let i = 0; i < 8; i++) { if (existsSync(join(root, 'tenant-config.json'))) break; root = dirname(root); }
const hits = [];
function walk(d, depth = 0) {
  if (depth > 8) return;
  let ents = []; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name.startsWith('.')) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else if (['.md', '.txt', '.csv', '.json'].includes(extname(e.name)) && statSync(p).size < 2e6) {
      const lines = readFileSync(p, 'utf8').split('\\n');
      lines.forEach((l, n) => { const low = l.toLowerCase(); const m = kws.filter(k => low.includes(k)); if (m.length) hits.push({ dosya: relative(root, p), satir: n + 1, eslesen: m, metin: l.trim().slice(0, 240), degistirilme: statSync(p).mtime.toISOString().slice(0, 10) }); });
    }
  }
}
if (!kws.length) { out({ ok: false, hata: 'ANAHTAR_KELIMELER boş' }); process.exit(1); }
walk(root);
hits.sort((a, b) => b.eslesen.length - a.eslesen.length);
out({ ok: true, mod: 'offline-yerel-arsiv', anahtar_kelimeler: kws, bulgu_sayisi: hits.length, bulgular: hits.slice(0, 50) });
`,

  'rice_skorla.mjs': HEADER + `
// RICE = (Reach * Impact * Confidence) / Effort
const input = readInput();
const list = input.features || input.OZELLIK_LISTESI || [];
if (!Array.isArray(list) || !list.length) { out({ ok: false, hata: 'features dizisi gerekli: [{name, reach, impact, confidence, effort}]' }); process.exit(1); }
const rows = list.map(f => {
  const reach = +f.reach || 0, impact = +f.impact || 0, conf = (+f.confidence || 0) > 1 ? (+f.confidence) / 100 : (+f.confidence || 0), effort = +f.effort || 1;
  return { ozellik: f.name, reach, impact, confidence: conf, effort, rice: Math.round((reach * impact * conf / effort) * 100) / 100 };
}).sort((a, b) => b.rice - a.rice).map((r, i) => ({ sira: i + 1, ...r }));
out({ ok: true, siralama: rows });
`,

  'mermaid_render.mjs': HEADER + `
// Akış adımlarından Mermaid (.mmd) diyagramı üretir. Mermaid CLI (mmdc) kuruluysa SVG'ye çevrilebilir.
const input = readInput();
const steps = input.steps || ['Giriş', 'Form doldur', 'Onay'];
const id = i => 'S' + i;
let mmd = 'flowchart TD\\n';
steps.forEach((s, i) => { const label = String(s).replace(/"/g, "'"); mmd += '  ' + id(i) + '["' + label + '"]\\n'; if (i) mmd += '  ' + id(i - 1) + ' --> ' + id(i) + '\\n'; });
out({ ok: true, akis: input.AKIS_ADI || 'akis', mermaid: mmd, not: 'SVG için: mmdc -i akis.mmd -o akis.svg (Mermaid CLI kuruluysa)' });
`,

  'run_e2e.mjs': HEADER + `
// Playwright test planı / çalıştırıcı. Playwright yerelde kurulu değilse çalıştırma komutunu ve senaryo iskeletini döndürür.
const input = readInput();
const url = String(input.HEDEF_URL || 'http://127.0.0.1:4400');
if (!/^https?:\\/\\/(127\\.0\\.0\\.1|localhost|[a-z0-9-]+\\.localhost)(:\\d+)?/i.test(url)) { out({ ok: false, hata: 'Offline politika: yalnızca yerel URL test edilebilir.' }); process.exit(1); }
const scenarios = [
  { id: 'P1', tur: 'pozitif', ad: 'Sayfa açılır ve başlık görünür' },
  { id: 'N1', tur: 'negatif', ad: 'Boş form gönderimi reddedilir' },
  { id: 'N2', tur: 'negatif', ad: 'Geçersiz formatlı girdi reddedilir' },
  { id: 'N3', tur: 'negatif', ad: 'Aşırı uzun girdi (10.000 karakter) güvenle reddedilir' },
];
const spec = "import { test, expect } from '@playwright/test';\\n" + scenarios.map(s => "test('" + s.id + ' ' + s.ad + "', async ({ page }) => {\\n  await page.goto('" + url + "');\\n  // TODO: adımlar\\n});").join('\\n');
out({ ok: true, hedef: url, senaryolar: scenarios, spec_dosyasi: spec, calistir: 'npx playwright test (Playwright offline kurulu ise)' });
`,

  'sast_tara.mjs': HEADER + `
// Statik güvenlik taraması: gömülü sırlar, tehlikeli komutlar, prompt-injection kalıpları, OWASP riskli kalıplar.
const input = readInput();
let root = HERE; for (let i = 0; i < 8; i++) { if (existsSync(join(root, 'tenant-config.json'))) break; root = dirname(root); }
const target = input.HEDEF_DIZIN ? join(root, String(input.HEDEF_DIZIN).replace(/\\.\\./g, '')) : root;
const RULES = [
  ['KRITIK', 'Gömülü API anahtarı', /(api[_-]?key|secret|token|password|parola)\\s*[:=]\\s*['"][A-Za-z0-9_\\-]{12,}['"]/i],
  ['KRITIK', 'Özel anahtar', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['KRITIK', 'AWS anahtarı', /AKIA[0-9A-Z]{16}/],
  ['YUKSEK', 'Tehlikeli silme komutu', /rm\\s+-rf\\s+\\/|Remove-Item\\s+.*-Recurse.*C:\\\\/i],
  ['YUKSEK', 'Uzaktan betik çalıştırma', /(curl|wget|iwr|Invoke-WebRequest)[^\\n|]*\\|\\s*(sh|bash|iex|powershell)/i],
  ['YUKSEK', 'Prompt injection kalıbı', /(ignore (all )?(previous|prior) instructions|önceki talimatları (yok say|unut)|disregard the system prompt)/i],
  ['YUKSEK', 'Veri sızdırma kalıbı', /(send|upload|post)[^\\n]{0,40}(\\.env|vault|credentials|kimlik bilgi)/i],
  ['ORTA', 'eval / dinamik kod', /\\beval\\s*\\(|new Function\\s*\\(/],
  ['ORTA', 'SQL birleştirme (enjeksiyon riski)', /(SELECT|INSERT|UPDATE|DELETE)[^\\n]*['"]\\s*\\+\\s*\\w+/i],
  ['ORTA', 'Kabuk komutu birleştirme', /exec(Sync)?\\s*\\([^)]*\\+/],
];
const findings = []; let files = 0;
function walk(d, depth = 0) {
  if (depth > 10) return; let ents = []; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    if (e.name === 'node_modules' || e.name === '.runtime') continue;
    const p = join(d, e.name);
    if (e.isDirectory()) { walk(p, depth + 1); continue; }
    const ext = extname(e.name).toLowerCase();
    if (['.exe', '.dll', '.so', '.bin', '.dylib', '.scr', '.bat', '.cmd', '.vbs'].includes(ext)) { findings.push({ seviye: 'YUKSEK', kural: 'Çalıştırılabilir/ikili dosya', dosya: relative(root, p), satir: 0 }); continue; }
    if (statSync(p).size > 1e6) continue;
    files++;
    const lines = readFileSync(p, 'utf8').split('\\n');
    lines.forEach((l, n) => { for (const [lvl, name, re] of RULES) if (re.test(l)) findings.push({ seviye: lvl, kural: name, dosya: relative(root, p), satir: n + 1, ornek: l.trim().slice(0, 160) }); });
  }
}
walk(target);
const kritik = findings.filter(f => f.seviye === 'KRITIK').length, yuksek = findings.filter(f => f.seviye === 'YUKSEK').length;
out({ ok: true, taranan_dosya: files, bulgu_sayisi: findings.length, kritik, yuksek, karar: (kritik || yuksek) ? 'YAYINI DURDUR — /security-review zorunlu' : 'GEÇTİ', bulgular: findings.slice(0, 100) });
`,

  'load_test.mjs': HEADER + `
// Yerel servis yük/gecikme testi (yalnızca loopback).
const input = readInput();
const url = String(input.HEDEF_URL || 'http://127.0.0.1:4400/api/health');
const n = Math.min(+input.ISTEK_SAYISI || 50, 2000), conc = Math.min(+input.ESZAMANLI || 5, 50);
if (!/^http:\\/\\/(127\\.0\\.0\\.1|localhost)(:\\d+)?\\//.test(url)) { out({ ok: false, hata: 'Offline politika: yalnızca http://127.0.0.1 hedeflenebilir.' }); process.exit(1); }
const sla = JSON.parse(asset('sla-esikleri.json') || '{"p50_ms":200,"p95_ms":800,"hata_orani_max":0.01}');
const times = []; let errors = 0, i = 0;
async function worker() { while (i < n) { i++; const t0 = performance.now(); try { const r = await fetch(url); await r.arrayBuffer(); if (!r.ok) errors++; } catch { errors++; } times.push(performance.now() - t0); } }
await Promise.all(Array.from({ length: conc }, worker));
times.sort((a, b) => a - b);
const pct = p => Math.round(times[Math.min(times.length - 1, Math.floor(times.length * p))]);
const res = { p50_ms: pct(0.5), p95_ms: pct(0.95), max_ms: Math.round(times.at(-1)), hata_orani: errors / n };
const pass = res.p50_ms <= sla.p50_ms && res.p95_ms <= sla.p95_ms && res.hata_orani <= sla.hata_orani_max;
out({ ok: true, hedef: url, istek: n, eszamanli: conc, sonuc: res, sla, karar: pass ? 'SLA UYUMLU — onaylanabilir' : 'SLA İHLALİ — canlıya alınamaz' });
`,

  'etl_pipeline.mjs': HEADER + `
// CSV/JSON temizleme + KVKK uyumlu PII maskeleme.
const input = readInput();
let rows = input.rows;
if (!rows && input.csv) rows = parseCSV(input.csv);
if (!rows) { out({ ok: false, hata: 'rows (dizi) veya csv (metin) gerekli' }); process.exit(1); }
const mask = {
  tc: v => v.replace(/\\b(\\d{3})\\d{8}\\b/g, '$1********'),
  email: v => v.replace(/\\b([A-Za-z0-9])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)/g, '$1***@$2'),
  phone: v => v.replace(/(\\+?90\\s?)?0?\\(?5\\d{2}\\)?[\\s-]?\\d{3}[\\s-]?\\d{2}[\\s-]?(\\d{2})\\b/g, '5** *** ** $2'),
  iban: v => v.replace(/\\bTR(\\d{2})[\\d ]{18,26}(\\d{4})\\b/gi, 'TR$1 **** **** $2'),
};
const nameKeys = /^(ad|adi|ad_soyad|isim|name|full_?name|soyad)$/i;
let masked = 0, dropped = 0;
const seen = new Set();
const clean = [];
for (const r of rows) {
  const o = {};
  for (const [k, v0] of Object.entries(r)) {
    let v = String(v0 ?? '').trim();
    const before = v;
    if (nameKeys.test(k)) v = v.split(/\\s+/).map(p => p[0] ? p[0].toUpperCase() + '.' : '').join(' ');
    else for (const f of Object.values(mask)) v = f(v);
    if (v !== before) masked++;
    o[k.trim().toLowerCase().replace(/\\s+/g, '_')] = v;
  }
  const key = JSON.stringify(o);
  if (seen.has(key) || Object.values(o).every(x => !x)) { dropped++; continue; }
  seen.add(key); clean.push(o);
}
out({ ok: true, girdi_satir: rows.length, cikti_satir: clean.length, atilan_tekrar_bos: dropped, maskelenen_alan: masked, veri: clean.slice(0, 500) });
`,

  'keyword_cluster.mjs': HEADER + `
// Anahtar kelime kümeleme (token Jaccard benzerliği) + arama niyeti tahmini.
const input = readInput();
let kws = input.KELIMELER || input.keywords || [];
if (typeof kws === 'string') kws = kws.split(/[,\\n]/);
kws = kws.map(s => String(s).trim().toLowerCase()).filter(Boolean);
if (!kws.length) { out({ ok: false, hata: 'KELIMELER gerekli' }); process.exit(1); }
const stop = new Set(['ve', 'ile', 'için', 'icin', 'en', 'bir', 'nasıl', 'nedir', 'the', 'for', 'de', 'da']);
const tok = s => new Set(s.split(/\\s+/).filter(w => !stop.has(w)).map(w => w.slice(0, 6)));
const jac = (a, b) => { const i = [...a].filter(x => b.has(x)).length; return i / (a.size + b.size - i || 1); };
const clusters = [];
for (const k of kws) { const t = tok(k); let best = null, bs = 0; for (const c of clusters) { const s = jac(t, c.t); if (s > bs) { bs = s; best = c; } } if (best && bs >= 0.34) { best.items.push(k); t.forEach(x => best.t.add(x)); } else clusters.push({ t, items: [k] }); }
const intent = k => /fiyat|satın|satin|al |indirim|ucuz|teklif|kirala/.test(k) ? 'işlem' : /en iyi|karşılaştır|karsilastir|vs|yorum|öneri/.test(k) ? 'ticari' : 'bilgi';
out({ ok: true, kume_sayisi: clusters.length, kumeler: clusters.map((c, i) => ({ kume: i + 1, ana_kelime: c.items[0], niyet: intent(c.items.join(' ')), kelimeler: c.items })) });
`,

  'churn_risk_hesapla.mjs': HEADER + `
// Müşteri kayıp (churn) risk skoru: son giriş, açık şikayet, NPS, ödeme gecikmesi, sözleşme bitişi.
const input = readInput();
const customers = input.customers || [];
if (!customers.length) { out({ ok: false, hata: 'customers dizisi gerekli' }); process.exit(1); }
const rows = customers.map(c => {
  let s = 0; const neden = [];
  const days = +c.son_giris_gun || 0; if (days > 30) { s += 25; neden.push('30+ gündür giriş yok'); } else if (days > 14) { s += 10; neden.push('14+ gün pasif'); }
  const t = +c.acik_sikayet || 0; if (t) { s += Math.min(30, t * 10); neden.push(t + ' açık şikayet'); }
  const nps = c.nps == null ? null : +c.nps; if (nps != null && nps <= 6) { s += 20; neden.push('NPS düşük (' + nps + ')'); }
  const late = +c.odeme_gecikme_gun || 0; if (late > 0) { s += Math.min(15, late); neden.push('Ödeme gecikmesi ' + late + ' gün'); }
  const end = +c.sozlesme_bitis_gun; if (!isNaN(end) && end < 60) { s += 10; neden.push('Sözleşme ' + end + ' gün içinde bitiyor'); }
  s = Math.min(100, s);
  return { musteri: c.ad || c.name || c.id, skor: s, seviye: s >= 60 ? 'YÜKSEK' : s >= 30 ? 'ORTA' : 'DÜŞÜK', nedenler: neden };
}).sort((a, b) => b.skor - a.skor);
out({ ok: true, yuksek_risk: rows.filter(r => r.seviye === 'YÜKSEK').length, liste: rows });
`,

  'cac_ltv_hesapla.mjs': HEADER + `
// Birim ekonomisi: gelir, gider, brüt marj, CAC, ARPU, churn, LTV, LTV/CAC, geri ödeme süresi.
const input = readInput();
const inv = input.invoices || [], exp = input.expenses || [];
const newCustomers = +input.yeni_musteri || 0, active = +input.aktif_musteri || 0, churned = +input.kaybedilen_musteri || 0;
const sum = (a, f) => a.reduce((s, x) => s + (+x[f] || 0), 0);
const revenue = sum(inv.filter(i => i.durum !== 'iptal'), 'tutar');
const collected = sum(inv.filter(i => i.durum === 'odendi'), 'tutar');
const overdue = inv.filter(i => i.durum === 'gecikmis');
const totalExp = sum(exp, 'tutar');
const mkt = sum(exp.filter(e => /pazarlama|reklam|satis|satış/i.test(e.kategori || '')), 'tutar');
const cogs = sum(exp.filter(e => /altyapi|altyapı|hizmet maliyeti|cogs|sunucu/i.test(e.kategori || '')), 'tutar');
const r2 = x => Math.round(x * 100) / 100;
const grossMargin = revenue ? (revenue - cogs) / revenue : 0;
const cac = newCustomers ? mkt / newCustomers : null;
const arpu = active ? revenue / active : null;
const churn = active ? churned / active : null;
const ltv = arpu != null && churn ? (arpu * grossMargin) / churn : null;
const ratio = ltv != null && cac ? ltv / cac : null;
const uyarilar = [];
if (ratio != null && ratio < 3) uyarilar.push('LTV/CAC < 3: edinim maliyeti yüksek');
if (overdue.length) uyarilar.push(overdue.length + ' geciken fatura (' + r2(sum(overdue, 'tutar')) + ' TL)');
if (totalExp > revenue) uyarilar.push('Gider geliri aşıyor');
out({ ok: true, donem: input.DONEM || null, hesaplama: 'scripts/cac_ltv_hesapla.mjs',
  gelir: r2(revenue), tahsil_edilen: r2(collected), toplam_gider: r2(totalExp), net: r2(revenue - totalExp), brut_marj: r2(grossMargin),
  pazarlama_satis_gideri: r2(mkt), CAC: cac == null ? null : r2(cac), ARPU: arpu == null ? null : r2(arpu), churn_orani: churn == null ? null : r2(churn),
  LTV: ltv == null ? null : r2(ltv), LTV_CAC: ratio == null ? null : r2(ratio), geri_odeme_ay: cac && arpu ? r2(cac / (arpu * grossMargin || 1)) : null, uyarilar });
`,

  'baskent_kart_kabul_denetim.mjs': HEADER + `
// Başkent Kart 3 Yıllık (36 Ay) İhale Kapanış, Teknik Şartname Kabul, Fatura, Dekont ve Evrak Eksiklik Denetim Motoru (%100 Offline)
const input = readInput();
const rawAsset = asset('baskent-kart-3-yillik-evrak-kayitlari.json');
const dataset = input.dataset || (rawAsset ? JSON.parse(rawAsset) : { months: [], specChecks: [] });
const months = Array.isArray(input.months) ? input.months : (dataset.months || []);
const specChecks = Array.isArray(input.specChecks) ? input.specChecks : (dataset.specChecks || []);

let totalInvoice = 0;
let totalReceipt = 0;
let totalSocialAid = 0;
let totalBeneficiaries = 0;

const missingInvoices = [];
const missingReceipts = [];
const amountMismatches = [];
const missingPos = [];
const slaViolations = [];
const missingSgk = [];
const fullValidMonths = [];

const table = months.map(m => {
  const invAmt = Number(m.fatura_tutari || 0);
  const recAmt = Number(m.dekont_tutari || 0);
  const aidAmt = Number(m.sosyal_yardim_aktarim_tutari || 0);
  const benCount = Number(m.aktif_kart_vatandas_sayisi || 0);
  const sla = Number(m.sla_uptime || 0);

  if (m.fatura_var) totalInvoice += invAmt;
  if (m.dekont_var) totalReceipt += recAmt;
  totalSocialAid += aidAmt;
  if (benCount > totalBeneficiaries) totalBeneficiaries = benCount;

  const issues = [];
  if (!m.fatura_var) {
    missingInvoices.push(m.donem);
    issues.push('Fatura Eksik');
  }
  if (!m.dekont_var) {
    missingReceipts.push(m.donem);
    issues.push('Banka Dekontu Eksik');
  }
  const diff = (m.fatura_var && m.dekont_var) ? Math.round((invAmt - recAmt) * 100) / 100 : 0;
  if (m.fatura_var && m.dekont_var && Math.abs(diff) >= 1) {
    amountMismatches.push({ donem: m.donem, fatura_tutari: invAmt, dekont_tutari: recAmt, fark_tl: diff, aciklama: m.not || 'Fatura-Dekont tutar uyuşmazlığı' });
    issues.push('Tutar Farkı (' + diff.toLocaleString('tr-TR') + ' TL)');
  }
  if (!m.pos_mutabakat_var) {
    missingPos.push(m.donem);
    issues.push('Market/POS Takas Mutabakatı Eksik');
  }
  if (!m.sla_raporu_var || sla < 99.9) {
    const ceza = sla < 99.9 ? Math.round(invAmt * ((99.9 - sla) * 0.05)) : 0;
    slaViolations.push({ donem: m.donem, sla_uptime: sla, sartname_hedef: 99.9, hesaplanan_ceza_tl: ceza, rapor_var: !!m.sla_raporu_var });
    issues.push(!m.sla_raporu_var ? 'SLA Raporu Eksik' : 'SLA İhlali (%' + sla + ' < %99.90)');
  }
  if (!m.sgk_vergi_var) {
    missingSgk.push(m.donem);
    issues.push('SGK/Vergi Borcu Yoktur Belgesi Eksik');
  }

  const okMonth = issues.length === 0;
  if (okMonth) fullValidMonths.push(m.donem);

  return {
    yil: m.yil,
    ay_no: m.ay_no,
    donem: m.donem,
    fatura_no: m.fatura_var ? m.fatura_no : 'EKSİK',
    fatura_tutari: invAmt,
    dekont_no: m.dekont_var ? m.dekont_no : 'EKSİK',
    dekont_tutari: recAmt,
    fark_tl: diff,
    pos_mutabakat: m.pos_mutabakat_var ? 'TAMAM' : 'EKSİK',
    sla_uptime: '%' + sla.toFixed(2),
    sgk_vergi: m.sgk_vergi_var ? 'TAMAM' : 'EKSİK',
    durum: okMonth ? 'UYGUN' : 'EKSİK / UYUŞMAZLIK',
    bulgular: issues.join(', ') || 'Tam Uyumlu',
  };
});

const incompleteSpecs = specChecks.filter(s => s.durum !== 'TAMAM');
const hasIssues = missingInvoices.length || missingReceipts.length || amountMismatches.length || missingPos.length || slaViolations.length || missingSgk.length || incompleteSpecs.length;

out({
  ok: true,
  hesaplama: 'scripts/baskent_kart_kabul_denetim.mjs',
  kurum: 'Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı',
  mudurluk: 'Akıllı Şehirler Şube Müdürlüğü',
  ekip: 'Proje Yönetimi Ekibi',
  proje: 'Başkent Kart Sosyal Yardım ve Dijital Ödeme Sistemi (3 Yıllık İhale Kapanış & Kesin Kabul Denetimi)',
  toplam_incelenen_ay: months.length,
  tam_uyumlu_ay_sayisi: fullValidMonths.length,
  sorunlu_ay_sayisi: months.length - fullValidMonths.length,
  toplam_fatura_tutari_tl: Math.round(totalInvoice),
  toplam_dekont_tutari_tl: Math.round(totalReceipt),
  toplam_fatura_dekont_farki_tl: Math.round(totalInvoice - totalReceipt),
  toplam_sosyal_yardim_aktarim_tl: Math.round(totalSocialAid),
  aktif_vatandas_kart_sayisi: totalBeneficiaries,
  eksik_fatura_aylari: missingInvoices,
  eksik_dekont_aylari: missingReceipts,
  tutar_uyusmazligi_olan_aylar: amountMismatches,
  eksik_pos_mutabakat_aylari: missingPos,
  sla_ihlali_olan_aylar: slaViolations,
  eksik_sgk_vergi_aylari: missingSgk,
  teknik_sartname_eksikleri: incompleteSpecs,
  kabul_karari: hasIssues
    ? 'ŞARTLI / KABUL BEKLEMEDE — Yüklenici Firmaya Eksik Evrak, Dekont ve SLA Ceza Mutabakatı İçin Resmi İhtar Yazılmalı'
    : 'KESİN KABULE UYGUNDUR — 36 Aylık Tüm Fatura, Dekont ve Teknik Şartname Evrakları Tamdır',
  ozet_bulgular: [
    missingInvoices.length ? (missingInvoices.length + ' aya ait Hak Ediş Faturası veya E-İmza doğrulama eki eksik: ' + missingInvoices.join(', ')) : '36 ayın tamamında fatura mevcut.',
    missingReceipts.length ? (missingReceipts.length + ' aya ait Banka Ödeme / Yardım Aktarım Dekontu eksik: ' + missingReceipts.join(', ')) : '36 ayın tamamında banka dekontu mevcut.',
    amountMismatches.length ? (amountMismatches.length + ' ayda Fatura ile Banka Dekontu arasında tutar farkı tespit edildi: ' + amountMismatches.map(x => x.donem + ' (' + x.fark_tl.toLocaleString('tr-TR') + ' TL)').join(', ')) : 'Fatura ve dekont tutarları birebir örtüşüyor.',
    missingPos.length ? (missingPos.length + ' ayda Market / Üye İşyeri POS Harcama ve Takas Mutabakat Cetveli eksik: ' + missingPos.join(', ')) : 'Tüm POS mutabakat cetvelleri tam.',
    slaViolations.length ? (slaViolations.length + ' ayda Teknik Şartname %99.90 SLA süreklilik ihlali / rapor eksikliği tespit edildi: ' + slaViolations.map(x => x.donem + ' (%' + x.sla_uptime + ', Ceza: ' + x.hesaplanan_ceza_tl.toLocaleString('tr-TR') + ' TL)').join(', ')) : 'SLA hedefleri 36 ay boyunca sağlandı.',
    missingSgk.length ? (missingSgk.length + ' ayda SGK Hizmet Dökümü / Vergi Borcu Yoktur yazısı eksik: ' + missingSgk.join(', ')) : 'SGK ve Vergi borcu yoktur belgeleri tam.',
    incompleteSpecs.length ? ('Teknik Şartname Kesin Kabul Kriterlerinden ' + incompleteSpecs.length + ' madde eksik: ' + incompleteSpecs.map(s => s.kod + ' (' + s.baslik + ')').join(', ')) : 'Teknik Şartname 10/10 kabul kriteri tamamlandı.',
  ],
  aylik_ozet_tablo: table,
});
`,
};
