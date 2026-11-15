// Kurum başına ayrı SQLite veritabanı (tenants/<kurum>/.runtime/twin.sqlite).
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { ensureDir, tenantDir } from './util.mjs';

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, created_at TEXT, updated_at TEXT, title TEXT, request TEXT, status TEXT,
  dept TEXT, personnel TEXT, skill TEXT, source TEXT, parent_id INTEGER, result TEXT, llm_mode TEXT, context_chars INTEGER, output_file TEXT);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, ts TEXT, task_id INTEGER, from_agent TEXT, to_agent TEXT, kind TEXT, content TEXT);
CREATE TABLE IF NOT EXISTS approvals (id INTEGER PRIMARY KEY, ts TEXT, kind TEXT, title TEXT, payload TEXT, status TEXT, requested_by TEXT, decided_at TEXT, decided_by TEXT, note TEXT);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, ts TEXT, actor TEXT, action TEXT, detail TEXT, prev_hash TEXT, hash TEXT);
CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY, ts TEXT, to_addr TEXT, subject TEXT, body TEXT, status TEXT, error TEXT, task_id INTEGER);
CREATE TABLE IF NOT EXISTS training (id INTEGER PRIMARY KEY, ts TEXT, channel TEXT, filename TEXT, path TEXT, status TEXT, target TEXT, result TEXT);
CREATE TABLE IF NOT EXISTS schedules (id INTEGER PRIMARY KEY, name TEXT UNIQUE, every_minutes INTEGER, dept TEXT, request TEXT, last_run TEXT, enabled INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS agent_state (agent TEXT PRIMARY KEY, dept TEXT, status TEXT, activity TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS docs (id INTEGER PRIMARY KEY, path TEXT, chunk INTEGER, text TEXT, terms TEXT, mtime REAL);
CREATE INDEX IF NOT EXISTS docs_path ON docs(path);

CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY, ad TEXT, durum TEXT, baslangic TEXT, bitis TEXT, butce REAL, sorumlu TEXT);
CREATE TABLE IF NOT EXISTS project_tasks (id INTEGER PRIMARY KEY, proje_id INTEGER, sprint INTEGER, gorev TEXT, durum TEXT, sure_gun REAL, bagimlilik TEXT, teslim TEXT, sorumlu TEXT);
CREATE TABLE IF NOT EXISTS features (id INTEGER PRIMARY KEY, ad TEXT, reach REAL, impact REAL, confidence REAL, effort REAL, durum TEXT);
CREATE TABLE IF NOT EXISTS competitors (id INTEGER PRIMARY KEY, ad TEXT, aylik_fiyat REAL, kullanici_limiti INTEGER, destek_sla_saat INTEGER, guclu TEXT, zayif TEXT);
CREATE TABLE IF NOT EXISTS campaigns (id INTEGER PRIMARY KEY, ad TEXT, kanal TEXT, butce REAL, harcama REAL, gelir REAL, lead INTEGER, donem TEXT);
CREATE TABLE IF NOT EXISTS crm_leads (id INTEGER PRIMARY KEY, firma TEXT, sektor TEXT, asama TEXT, tutar REAL, olasilik REAL, son_temas TEXT, kaynak TEXT);
CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY, ad TEXT, sektor TEXT, mrr REAL, son_giris_gun INTEGER, acik_sikayet INTEGER, nps INTEGER, odeme_gecikme_gun INTEGER, sozlesme_bitis_gun INTEGER, eposta TEXT);
CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY, musteri_id INTEGER, konu TEXT, durum TEXT, oncelik TEXT, acilis TEXT);
CREATE TABLE IF NOT EXISTS discount_limits (rol TEXT PRIMARY KEY, max_indirim_yuzde REAL);
CREATE TABLE IF NOT EXISTS invoices (id INTEGER PRIMARY KEY, musteri_id INTEGER, donem TEXT, tutar REAL, durum TEXT, vade TEXT);
CREATE TABLE IF NOT EXISTS expenses (id INTEGER PRIMARY KEY, donem TEXT, kategori TEXT, tutar REAL, aciklama TEXT);
CREATE TABLE IF NOT EXISTS contracts (id INTEGER PRIMARY KEY, musteri_id INTEGER, baslik TEXT, bitis TEXT, kvkk_maddesi INTEGER);
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, ad_soyad TEXT, eposta TEXT, rol TEXT, departman_yetkisi TEXT, yetkiler TEXT, durum TEXT, unvan TEXT, created_at TEXT);
`;

const cache = new Map();
export function db(tenant) {
  if (cache.has(tenant)) return cache.get(tenant);
  const dir = ensureDir(join(tenantDir(tenant), '.runtime'));
  const d = new DatabaseSync(join(dir, 'twin.sqlite'));
  d.exec(SCHEMA);
  cache.set(tenant, d);
  return d;
}
export function closeAll() { for (const d of cache.values()) try { d.close(); } catch { } cache.clear(); }

export const now = () => new Date().toISOString();

// Kurum adına göre deterministik örnek veri (her kurum farklı ama tekrarlanabilir).
function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }

export function seed(tenant) {
  const d = db(tenant);
  if (d.prepare('SELECT COUNT(*) n FROM customers').get().n > 0) return false;
  const r = rng(tenant); const pick = a => a[Math.floor(r() * a.length)]; const int = (a, b) => Math.floor(a + r() * (b - a + 1));
  const ym = new Date().toISOString().slice(0, 7);
  const prevYm = (k) => { const dt = new Date(); dt.setMonth(dt.getMonth() - k); return dt.toISOString().slice(0, 7); };
  const sectors = ['Perakende', 'Üretim', 'Lojistik', 'Sağlık', 'Enerji', 'Finans', 'Eğitim', 'Turizm'];
  const firms = ['Anadolu', 'Ege', 'Marmara', 'Toros', 'Kuzey', 'Yıldız', 'Atlas', 'Delta', 'Nova', 'Zirve', 'Pera', 'Kardelen', 'Mavi', 'Akdeniz', 'Başak', 'Tuna'];
  const sfx = ['Lojistik A.Ş.', 'Gıda Ltd.', 'Enerji A.Ş.', 'Tekstil', 'Sağlık Grubu', 'Yapı A.Ş.', 'Teknoloji', 'Otomotiv'];
  d.exec('BEGIN');
  try {
    const c = d.prepare('INSERT INTO customers (ad,sektor,mrr,son_giris_gun,acik_sikayet,nps,odeme_gecikme_gun,sozlesme_bitis_gun,eposta) VALUES (?,?,?,?,?,?,?,?,?)');
    for (let i = 0; i < 24; i++) { const ad = firms[i % firms.length] + ' ' + pick(sfx); c.run(ad, pick(sectors), int(8, 90) * 1000, int(0, 45), r() < 0.3 ? int(1, 3) : 0, int(3, 10), r() < 0.2 ? int(5, 40) : 0, int(10, 400), 'iletisim' + (i + 1) + '@musteri.local'); }
    const l = d.prepare('INSERT INTO crm_leads (firma,sektor,asama,tutar,olasilik,son_temas,kaynak) VALUES (?,?,?,?,?,?,?)');
    const stages = ['Yeni', 'Görüşme', 'Teklif', 'Müzakere', 'Kazanıldı', 'Kaybedildi'];
    for (let i = 0; i < 30; i++) { const st = pick(stages); l.run(pick(firms) + ' ' + pick(sfx), pick(sectors), st, int(50, 900) * 1000, { Yeni: 0.1, Görüşme: 0.25, Teklif: 0.5, Müzakere: 0.7, Kazanıldı: 1, Kaybedildi: 0 }[st], new Date(Date.now() - int(0, 30) * 864e5).toISOString().slice(0, 10), pick(['Web', 'Fuar', 'Referans', 'Reklam', 'LinkedIn'])); }
    const t = d.prepare('INSERT INTO tickets (musteri_id,konu,durum,oncelik,acilis) VALUES (?,?,?,?,?)');
    for (let i = 0; i < 18; i++) t.run(int(1, 24), pick(['Fatura sorusu', 'Entegrasyon hatası', 'Yavaşlık', 'Eğitim talebi', 'Özellik talebi']), pick(['Açık', 'Açık', 'Çözüldü']), pick(['Düşük', 'Orta', 'Yüksek']), new Date(Date.now() - int(0, 20) * 864e5).toISOString().slice(0, 10));
    const inv = d.prepare('INSERT INTO invoices (musteri_id,donem,tutar,durum,vade) VALUES (?,?,?,?,?)');
    for (const per of [prevYm(2), prevYm(1), ym]) for (let i = 1; i <= 24; i++) inv.run(i, per, int(8, 90) * 1000, per === ym ? pick(['odendi', 'bekliyor', 'gecikmis', 'bekliyor']) : pick(['odendi', 'odendi', 'odendi', 'gecikmis']), per + '-28');
    const ex = d.prepare('INSERT INTO expenses (donem,kategori,tutar,aciklama) VALUES (?,?,?,?)');
    for (const per of [prevYm(2), prevYm(1), ym]) for (const [k, a, b] of [['Personel', 400, 700], ['Pazarlama', 60, 180], ['Satış', 40, 90], ['Altyapı', 30, 80], ['Ofis', 20, 40], ['Hizmet maliyeti', 50, 120]]) ex.run(per, k, int(a, b) * 1000, k + ' gideri');
    const cp = d.prepare('INSERT INTO campaigns (ad,kanal,butce,harcama,gelir,lead,donem) VALUES (?,?,?,?,?,?,?)');
    for (const [ad, k] of [['Bahar Lansmanı', 'Arama Ağı'], ['Sektör Webinarı', 'LinkedIn'], ['Yeniden Hedefleme', 'Display'], ['Bülten Kampanyası', 'E-posta'], ['Fuar Takibi', 'Etkinlik']]) { const b = int(30, 150) * 1000; const h = Math.round(b * (0.6 + r() * 0.4)); cp.run(ad, k, b, h, Math.round(h * (0.5 + r() * 4)), int(20, 300), ym); }
    const pr = d.prepare('INSERT INTO projects (ad,durum,baslangic,bitis,butce,sorumlu) VALUES (?,?,?,?,?,?)');
    pr.run('Dijital İkiz Pilot', 'Devam', prevYm(1) + '-01', ym + '-28', 450000, 'bas-proje-yoneticisi');
    pr.run('CRM Yenileme', 'Planlama', ym + '-01', '', 300000, 'bas-sistem-mimari');
    const pt = d.prepare('INSERT INTO project_tasks (proje_id,sprint,gorev,durum,sure_gun,bagimlilik,teslim,sorumlu) VALUES (?,?,?,?,?,?,?,?)');
    [['Gereksinim analizi', 'Tamam', 3, '', 'urun-yoneticisi'], ['Mimari tasarım', 'Tamam', 4, '1', 'bas-sistem-mimari'], ['Veri göçü', 'Devam', 6, '2', 'veri-muhendisi-etl-uzmani'], ['Arayüz', 'Devam', 5, '2', 'frontend-gelistirici'], ['Güvenlik testi', 'Yapılacak', 3, '3,4', 'siber-guvenlik-uzmani'], ['Eğitim', 'Yapılacak', 2, '', ''], ['Canlıya geçiş', 'Yapılacak', 1, '5', 'bas-proje-yoneticisi']]
      .forEach(([g, s, dur, dep, who], i) => pt.run(1, i < 2 ? 1 : 2, g, s, dur, dep, i === 5 ? '' : ym + '-' + String(10 + i * 2).padStart(2, '0'), who));
    const f = d.prepare('INSERT INTO features (ad,reach,impact,confidence,effort,durum) VALUES (?,?,?,?,?,?)');
    [['Mobil onay ekranı', 800, 2, 80, 3], ['Otomatik fatura hatırlatma', 1200, 1.5, 90, 1], ['Gelişmiş raporlama', 400, 3, 60, 5], ['Tek tıkla teklif', 600, 2, 70, 2]].forEach(x => f.run(...x, 'Backlog'));
    const co = d.prepare('INSERT INTO competitors (ad,aylik_fiyat,kullanici_limiti,destek_sla_saat,guclu,zayif) VALUES (?,?,?,?,?,?)');
    co.run('Rakip A', 4900, 50, 24, 'Geniş entegrasyon', 'Yerel destek yok'); co.run('Rakip B', 3200, 20, 48, 'Düşük fiyat', 'Offline çalışmıyor');
    const dl = d.prepare('INSERT INTO discount_limits (rol,max_indirim_yuzde) VALUES (?,?)');
    [['satis-temsilcisi', 5], ['itiraz-yonetimi-kapanis-uzmani', 10], ['satis-muduru', 15], ['genel-mudur', 25]].forEach(x => dl.run(...x));
    const ct = d.prepare('INSERT INTO contracts (musteri_id,baslik,bitis,kvkk_maddesi) VALUES (?,?,?,?)');
    for (let i = 1; i <= 8; i++) ct.run(i, 'Hizmet Sözleşmesi #' + i, new Date(Date.now() + int(10, 400) * 864e5).toISOString().slice(0, 10), r() < 0.75 ? 1 : 0);
    d.exec('COMMIT');
  } catch (e) { d.exec('ROLLBACK'); throw e; }
  seedUsers(tenant);
  return true;
}

export function seedUsers(tenant) {
  const d = db(tenant);
  if (d.prepare('SELECT COUNT(*) n FROM users').get().n > 0) return;
  const domain = tenant + '.yerel';
  const u = d.prepare('INSERT INTO users (ad_soyad,eposta,rol,departman_yetkisi,yetkiler,durum,unvan,created_at) VALUES (?,?,?,?,?,?,?,?)');
  const ts = now();
  const rows = [
    ['Ahmet Yılmaz', 'ahmet.yilmaz@' + domain, 'Kurum Admini', 'Tüm Departmanlar (*)', JSON.stringify(['gorev_ver', 'onay_ver', 'ajan_yonet', 'kullanici_yonet', 'egitim_ver', 'veri_oku']), 'Aktif', 'Kurum Dijital İkiz Yöneticisi'],
    ['Zeynep Kaya', 'zeynep.kaya@' + domain, 'Departman Yöneticisi', '10-Finans-ve-Operasyon', JSON.stringify(['gorev_ver', 'onay_ver', 'egitim_ver', 'veri_oku']), 'Aktif', 'Finans & Operasyon Direktörü'],
    ['Mehmet Demir', 'mehmet.demir@' + domain, 'Departman Yöneticisi', '09-Satis-ve-CRM', JSON.stringify(['gorev_ver', 'egitim_ver', 'veri_oku']), 'Aktif', 'Satış & Müşteri İlişkileri Müdürü'],
    ['Elif Şahin', 'elif.sahin@' + domain, 'Departman Yöneticisi', '04-Yazilim-ve-Mimari', JSON.stringify(['gorev_ver', 'ajan_yonet', 'egitim_ver', 'veri_oku']), 'Aktif', 'Teknoloji ve Mimari Lideri'],
    ['Caner Aydın', 'caner.aydin@' + domain, 'Kurum Uzmanı', '01-Proje-Yonetimi', JSON.stringify(['gorev_ver', 'veri_oku']), 'Aktif', 'Proje Koordinatörü'],
    ['Vatandaş / Misafir Kullanıcı', 'iletisim@' + domain, 'Vatandaş / Standart Kullanıcı', 'Halka Açık Hizmetler', JSON.stringify(['gorev_ver']), 'Aktif', 'Dış Kullanıcı / Başvuru Sahibi'],
  ];
  for (const r of rows) u.run(...r, ts);
}

// SQL Guard: ajanlar yalnızca kendi departmanlarının tablolarına tek bir SELECT atabilir.
const FORBIDDEN = /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum|reindex|truncate|grant|load_extension)\b/i;
export function guardedSelect(tenant, allowedTables, sql, params = []) {
  const s = String(sql).trim().replace(/;\s*$/, '');
  if (!/^select\b/i.test(s)) throw new Error('SQL Guard: yalnızca SELECT izinli');
  if (s.includes(';')) throw new Error('SQL Guard: tek ifade izinli');
  if (FORBIDDEN.test(s)) throw new Error('SQL Guard: yasak anahtar kelime');
  const used = [...s.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)].map(m => m[1].toLowerCase());
  const bad = used.filter(t => !allowedTables.includes(t));
  if (bad.length) throw new Error('SQL Guard (RBAC): erişim yok → ' + bad.join(', '));
  return db(tenant).prepare(s + (/\blimit\b/i.test(s) ? '' : ' LIMIT 500')).all(...params);
}
