#!/usr/bin/env node
// Tenant Provisioner — çekirdek altyapıyı ve izole kurum dijital ikizlerini üretir.
// Kullanım: node engine/src/provisioner.mjs --name abc-holding --subdomain abc.sistem.com [--display "ABC Holding"] [--mode offline]
import { existsSync, readdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEPARTMENTS } from './catalog/departments.mjs';
import { ABB_DEPARTMENTS, generateBaskentKart3YearDataset } from './catalog/abb-baskent-kart.mjs';
import { SCRIPTS } from './catalog/scripts.mjs';
import * as T from './templates.mjs';
import { CORE, ROOT, TENANTS, SLUG_RE, DEPT_RE, ensureDir, writeIfMissing, writeFile, writeJSON, readJSON, tenantDir, safeJoin, toPosix } from './lib/util.mjs';
import { writeVault, readVault, hashSecret, newAccessKey, masterKey } from './lib/vault.mjs';
import { seed, db, now } from './lib/db.mjs';

// ---------- ÇEKİRDEK ----------
export const ROUTER_DEFAULT = {
  version: '4.0',
  description: 'İnternet kesintisinde ve offline modda LLM yönlendirme sırası. Cloud varsayılan olarak devre dışıdır.',
  order: ['ollama', 'vllm', 'fallback-engine'],
  providers: {
    ollama: { type: 'ollama', enabled: true, baseUrl: 'http://127.0.0.1:11434', timeoutMs: 180000, models: { default: 'qwen2.5:7b', light: 'qwen2.5:3b', high: 'qwen2.5:14b', vision: 'llava:7b', embed: 'nomic-embed-text' } },
    vllm: { type: 'openai-compatible', enabled: false, baseUrl: 'http://127.0.0.1:8000/v1', model: 'Qwen/Qwen2.5-7B-Instruct', timeoutMs: 180000 },
    'fallback-engine': { type: 'rule-skill-engine', enabled: true, description: 'LLM yokken skill betiklerini çalıştırır, verileri tablolar ve şablonlarla raporlar.' },
    cloud: { type: 'disabled', enabled: false, note: 'Cloud modu yalnızca Süper Admin açık onayı + tenant-config.llm.allowCloud=true ile açılabilir. Bu kurulumda kapalıdır.' },
  },
  effort: { high: ['02-Strateji-ve-Arastirma', '04-Yazilim-ve-Mimari', '05-Test-QA-ve-Guvenlik'], low: ['07-Icerik-ve-Medya'] },
  healthCheckSeconds: 30,
};

export function ensureCore() {
  ensureDir(CORE);
  masterKey();
  writeFile(join(CORE, 'CLAUDE.md'), T.coreClaudeMd());
  writeFile(join(CORE, 'AGENTS.md'), T.coreAgentsMd());
  writeIfMissing(join(CORE, 'offline-fallback-router.json'), JSON.stringify(ROUTER_DEFAULT, null, 2) + '\n');
  writeIfMissing(join(CORE, '.gitignore'), '.master.key\n.superadmin.json\n.runtime/\n');

  writeFile(join(CORE, 'tenant-provisioner.sh'), `#!/usr/bin/env bash
# Yeni kurum dijital ikizi üretir.
# Örnek: ./tenant-provisioner.sh --name "abc-holding" --subdomain "abc.sistem.com" --display "ABC Holding"
set -euo pipefail
DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
exec node --no-warnings "$DIR/../engine/src/provisioner.mjs" "$@"
`);
  writeFile(join(CORE, 'tenant-provisioner.ps1'), `# Yeni kurum dijital ikizi üretir (Windows).
# Örnek: powershell -File tenant-provisioner.ps1 -Name abc-holding -Subdomain abc.sistem.com -Display "ABC Holding"
param([Parameter(Mandatory=$true)][string]$Name, [Parameter(Mandatory=$true)][string]$Subdomain, [string]$Display = "", [string]$Mode = "offline")
$engine = Join-Path $PSScriptRoot "..\\engine\\src\\provisioner.mjs"
$a = @("--no-warnings", $engine, "--name", $Name, "--subdomain", $Subdomain, "--mode", $Mode)
if ($Display) { $a += @("--display", $Display) }
& node @a
exit $LASTEXITCODE
`);

  const reg = join(CORE, 'global-registry');
  writeIfMissing(join(reg, 'cli-tools.json'), JSON.stringify({
    policy: 'Araç önceliği: CLI > MCP > Plugin > Browser Fallback. offline=true olmayan araçlar yalnızca online modda kullanılır.',
    tools: [
      { name: 'node', purpose: 'Skill betikleri, motor', offline: true, check: 'node --version' },
      { name: 'git', purpose: 'Sürüm kontrolü, worktree, geri alma', offline: true, check: 'git --version' },
      { name: 'docker', purpose: 'İzole servisler', offline: true, check: 'docker --version' },
      { name: 'ollama', purpose: 'Yerel LLM', offline: true, check: 'ollama --version' },
      { name: 'ffmpeg', purpose: 'Video/ses işleme (eğitim kanalı 3-5)', offline: true, check: 'ffmpeg -version' },
      { name: 'whisper-cli', purpose: 'Offline konuşma→metin (whisper.cpp)', offline: true, check: 'whisper-cli --help' },
      { name: 'pdftotext', purpose: 'PDF metin çıkarımı (Poppler)', offline: true, check: 'pdftotext -v' },
      { name: 'mmdc', purpose: 'Mermaid CLI', offline: true, check: 'mmdc --version' },
      { name: 'npx playwright', purpose: 'E2E test ve UI playbook', offline: true, check: 'npx playwright --version' },
      { name: 'semgrep', purpose: 'SAST', offline: true, check: 'semgrep --version' },
      { name: 'gh', purpose: 'GitHub CLI', offline: false, check: 'gh --version' },
      { name: 'firecrawl', purpose: 'Web tarama', offline: false, check: 'firecrawl --version' },
      { name: 'yt-dlp', purpose: 'Video indirme', offline: false, check: 'yt-dlp --version' },
      { name: 'linear / jira', purpose: 'Proje yönetimi', offline: false },
      { name: 'supabase', purpose: 'Veritabanı CLI', offline: false },
      { name: 'stripe', purpose: 'Ödeme/fatura', offline: false },
      { name: 'lighthouse', purpose: 'Web performans/SEO', offline: true },
    ],
  }, null, 2) + '\n');
  writeIfMissing(join(reg, 'mcp-servers.json'), JSON.stringify({
    policy: 'Resmi CLI varsa MCP kurulmaz. Offline modda yalnızca yerel (stdio) MCP sunucuları etkinleşir.',
    servers: [
      { name: 'local-sqlite', transport: 'stdio', offline: true, enabled: true, note: 'Kurum ERP/CRM veritabanı (motor içi SQL Guard)' },
      { name: 'local-files', transport: 'stdio', offline: true, enabled: true, note: 'Kurum klasörü, izole' },
      { name: 'miro', offline: false, enabled: false }, { name: 'canva', offline: false, enabled: false }, { name: 'notion', offline: false, enabled: false },
      { name: 'n8n', offline: true, enabled: false, note: 'Yerel n8n kurulursa' }, { name: 'google-analytics', offline: false, enabled: false },
      { name: 'meta-google-ads', offline: false, enabled: false }, { name: 'gmail-workspace', offline: false, enabled: false }, { name: 'context7', offline: false, enabled: false },
    ],
  }, null, 2) + '\n');
  writeIfMissing(join(reg, 'approved-github-skills.json'), JSON.stringify({ policy: 'Yalnızca 05-Test-QA-ve-Guvenlik taramasından geçmiş ve onaylanmış paketler.', skills: [] }, null, 2) + '\n');
  writeIfMissing(join(reg, 'browser-playbooks', 'README.md'), '# Browser Playbooks\n\nAPI\'si olmayan yerel yazılımlar için fare/klavye kayıtlarından üretilen onaylı Playwright playbook\'ları.\nEğitim kanalı 4 (Fare İmleç & Ekran Kaydı) çıktıları onaylandıktan sonra buraya kopyalanır.\n');

  const S = join(CORE, '_SABLONLAR');
  const demoCfg = { displayName: '{{KURUM_ADI}}', subdomain: '{{SUBDOMAIN}}', llm: { mode: 'offline' } };
  writeFile(join(S, 'SABLON-TENANT-CLAUDE.md'), T.tenantClaudeMd(demoCfg));
  writeFile(join(S, 'SABLON-DEPARTMAN-CLAUDE.md'), T.deptClaudeMd({ no: '{{NO}}', name: '{{DEPARTMAN_ADI}}', keywords: ['{{anahtar-kavramlar}}'], tools: ['{{CLI aracı}}'], tables: ['{{tablo}}'], deptRules: ['{{departman kuralı}}'], personnel: [] }, [{ title: '{{Personel Unvanı}}', slug: '{{personel-adi}}', head: true, skills: [] }]));
  writeFile(join(S, 'SABLON-PERSONEL-PROFILI.md'), T.personnelProfile({ no: '{{NO}}', slug: '{{NO-Departman}}', name: '{{Departman}}' }, { slug: '{{personel-adi}}', title: '{{Unvan}}', mission: '{{Görev tanımı}}', skills: [] }));
  writeFile(join(S, 'SABLON-RULE.md'), T.ruleFile({ name: '{{kural-adi}}', scope: 'departman | personel | tenant', paths: ['departmanlar/{{NO-Departman}}/**'], rules: ['{{1-3 satırlık sınır / yasak / format kuralı}}'] }));
  const sk = join(S, 'SABLON-SKILL-PAKETI');
  writeFile(join(sk, 'SKILL.md'), T.skillMd({ name: '{{yetenek-adi}}', description: '{{Ne yapar ve ne zaman tetiklenir}}', triggers: ['{{tetikleyici}}'], args: [['$ARGUMAN_1', '{{açıklama}}'], ['$ARGUMAN_2', '{{açıklama}}']], steps: ['{{Adım 1}}', 'scripts/ornek.mjs betiğini çalıştır', 'references/ içindeki şablonla çıktıyı biçimlendir'], scripts: ['ornek.mjs'], references: { 'README.md': '' }, assets: { 'README.md': '' } }, '{{departmanlar/.../personeller/...}}', 'draft'));
  writeFile(join(sk, 'scripts', 'ornek.mjs'), `// Skill betiği: stdin'den JSON alır, stdout'a JSON yazar.\nimport { readFileSync } from 'node:fs';\nconst input = process.stdin.isTTY ? {} : JSON.parse(readFileSync(0, 'utf8') || '{}');\nprocess.stdout.write(JSON.stringify({ ok: true, girdi: input }, null, 2));\n`);
  writeFile(join(sk, 'references', 'README.md'), '# references/\n\nUzun şablonlar, sözleşme/metin taslakları ve stil rehberleri. SKILL.md şişirilmez; gerektiğinde okunur.\n');
  writeFile(join(sk, 'assets', 'README.md'), '# assets/\n\nSabit dokümanlar, tablolar (.csv/.xlsx), örnek dosyalar ve görsel şablonlar.\n');

  if (!existsSync(join(CORE, '.superadmin.json'))) {
    const key = newAccessKey('SA');
    writeJSON(join(CORE, '.superadmin.json'), { hash: hashSecret(key), created: new Date().toISOString() });
  }
  ensureDir(TENANTS);
}

// ---------- SKILL / RULE YAZICILAR ----------
export function writeSkill(baseDir, s, ownerRel, status = 'active') {
  const dir = join(baseDir, s.name);
  writeIfMissing(join(dir, 'SKILL.md'), T.skillMd(s, ownerRel, status));
  ensureDir(join(dir, 'scripts')); ensureDir(join(dir, 'references')); ensureDir(join(dir, 'assets'));
  for (const sc of s.scripts || []) { if (!SCRIPTS[sc]) throw new Error('Betik kütüphanede yok: ' + sc); writeIfMissing(join(dir, 'scripts', sc), SCRIPTS[sc]); }
  if (!(s.scripts || []).length) writeIfMissing(join(dir, 'scripts', 'README.md'), '# scripts/\n\nBu yetenek için henüz betik yok. Tekrarlayan hesaplamalar buraya .mjs betiği olarak eklenir.\n');
  for (const [f, c] of Object.entries(s.references || {})) writeIfMissing(join(dir, 'references', f), c);
  if (!Object.keys(s.references || {}).length) writeIfMissing(join(dir, 'references', 'README.md'), '# references/\n');
  for (const [f, c] of Object.entries(s.assets || {})) writeIfMissing(join(dir, 'assets', f), c);
  if (!Object.keys(s.assets || {}).length) writeIfMissing(join(dir, 'assets', 'README.md'), '# assets/\n');
  return dir;
}

function deptStatusSkill(d) {
  return { name: 'departman-durum-raporu', description: `${d.name} departmanının güncel durumunu, açık işlerini ve risklerini özetler (otonom toplantılarda kullanılır).`, triggers: ['departman durumu', 'toplantı özeti', 'haftalık departman raporu'], args: [['$DONEM', 'Rapor dönemi']], steps: ['Departman tablolarından son verileri oku (salt-okunur).', 'Son görev çıktılarını context/ciktilar/ altından özetle.', 'En fazla 3 risk ve 3 aksiyon yaz.', 'Tablo formatında sun.'] };
}

export function buildDepartment(tenant, d, cfgDisplay) {
  const tdir = tenantDir(tenant);
  const ddir = join(tdir, 'departmanlar', d.slug);
  const drel = `departmanlar/${d.slug}`;
  writeIfMissing(join(ddir, 'CLAUDE.md'), T.deptClaudeMd(d));
  writeIfMissing(join(ddir, 'AGENTS.md'), T.deptAgentsMd(d));
  writeIfMissing(join(ddir, 'context', 'bilgi-bankasi.md'), `# ${d.name} — Bilgi Bankası\n\n${cfgDisplay} kurumunun ${d.name} departmanına özel izole bilgi bankası. Eğitim Merkezi'nden işlenen bilgiler buraya eklenir.\n`);
  ensureDir(join(ddir, 'context', 'ciktilar'));
  writeIfMissing(join(ddir, 'rules', 'departman-kurallari.md'), T.ruleFile({ name: `${d.slug}-kurallari`, scope: 'departman', paths: [`${drel}/**`], rules: [`Yalnızca ${d.tables.join(', ')} tablolarına salt-okunur erişim kullan.`, ...(d.deptRules || [])] }));
  writeSkill(join(ddir, 'skills'), deptStatusSkill(d), drel);
  for (const p of d.personnel) buildPersonnel(tenant, d, p);
}

export function buildPersonnel(tenant, d, p) {
  const pdir = join(tenantDir(tenant), 'departmanlar', d.slug, 'personeller', p.slug);
  const prel = `departmanlar/${d.slug}/personeller/${p.slug}`;
  writeIfMissing(join(pdir, 'profil.md'), T.personnelProfile(d, p));
  writeIfMissing(join(pdir, 'rules', 'sinirlar.md'), T.ruleFile({ name: `${p.slug}-sinirlar`, scope: 'personel', paths: [`${prel}/**`], rules: p.rules?.length ? p.rules : ['Görev tanımı dışındaki işleri departman yöneticisine yönlendir.'] }));
  ensureDir(join(pdir, 'skills'));
  for (const s of p.skills || []) writeSkill(join(pdir, 'skills'), s, prel);
}

// ---------- 3 ÜYELİK PAKETİ KAPASİTE TANIMLARI ----------
// Her üyelik paketi TÜM İŞLEMLERİ (3B Sanal Ofis, Sesli/Yazılı Ajan İletişimi,
// İhale/Fatura/Dekont Denetimi, 6 Kanallı Eğitim, Onay Kapısı, RBAC, Bilgisayara Offline İndirme)
// yapabilir; yalnızca kapasiteleri farklıdır.
export const PLAN_TIERS = {
  starter: {
    type: 'starter',
    tierCode: 'starter',
    name: 'Başlangıç Paketi',
    label: 'Başlangıç Paketi (2 Müdürlük · 3 Ajan · 12 Ay Evrak Denetimi · 5 Kullanıcı)',
    maxDepartments: 2,
    maxAgents: 3,
    maxAuditMonths: 12,
    maxUsers: 5,
    allFeaturesEnabled: true,
  },
  pro: {
    type: 'pro',
    tierCode: 'pro',
    name: 'Profesyonel Kurum Paketi',
    label: 'Profesyonel Kurum Paketi (5 Müdürlük · 12 Ajan · 24 Ay Evrak Denetimi · 25 Kullanıcı)',
    maxDepartments: 5,
    maxAgents: 12,
    maxAuditMonths: 24,
    maxUsers: 25,
    allFeaturesEnabled: true,
  },
  full: {
    type: 'full',
    tierCode: 'full',
    name: 'Full Kurumsal & Kamu Paketi',
    label: 'Full Kurumsal & Kamu Paketi (Sınırsız Müdürlük & Ajan · 36 Ay / 3 Yıl Tam İhale & Evrak Denetimi)',
    maxDepartments: 99,
    maxAgents: 999,
    maxAuditMonths: 36,
    maxUsers: 999,
    allFeaturesEnabled: true,
  },
};

// ---------- KURUM ----------
export function provisionTenant({ name, subdomain, display, mode = 'offline', planTier = 'pro' }) {
  if (!SLUG_RE.test(name || '')) throw new Error('--name küçük harf, rakam ve tire içermeli (örn. abc-holding)');
  if (!/^[a-z0-9.-]{3,120}$/i.test(subdomain || '')) throw new Error('--subdomain geçersiz (örn. abc.sistem.com)');
  if (!['offline', 'hybrid', 'cloud'].includes(mode)) throw new Error('--mode offline | hybrid | cloud');
  ensureCore();
  const tdir = tenantDir(name);
  const existed = existsSync(join(tdir, 'tenant-config.json'));
  const displayName = display || name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  const tierObj = PLAN_TIERS[planTier] || PLAN_TIERS.pro;

  const cfgPath = join(tdir, 'tenant-config.json');
  const cfg = readJSON(cfgPath) || {
    name, displayName, subdomain, localHost: `${name}.localhost`, createdAt: new Date().toISOString(), version: '4.0',
    plan: { ...tierObj },
    llm: { mode, allowCloud: false, routerFile: '../../_CORE-INFRASTRUCTURE/offline-fallback-router.json', modelOverride: null },
    network: { bind: '127.0.0.1', intranetAllow: [], smtp: null, outboundPolicy: 'deny-all-except-loopback-and-intranetAllow' },
    contextBudgetChars: 24000,
    approvals: { requireFor: ['dis-eposta', 'odeme', 'skill-aktivasyonu', 'skill-ithalati', 'departman-ekle', 'personel-ekle', 'egitim-taslagi'] },
    rbac: {
      roles: { 'kurum-yoneticisi': ['*'], 'departman-yoneticisi': ['kendi-departmani', 'onay-oner'], izleyici: ['okuma'] },
      tableAccess: Object.fromEntries(DEPARTMENTS.map(d => [d.slug, d.tables])),
      ceoTables: ['projects', 'campaigns', 'crm_leads', 'invoices', 'expenses'],
    },
    departments: DEPARTMENTS.map(d => ({ no: d.no, slug: d.slug, name: d.name, emoji: d.emoji, color: d.color, keywords: d.keywords, tables: d.tables, tools: d.tools })),
    scheduler: {
      enabled: true, tickSeconds: 30,
      jobs: [
        { name: 'gunluk-finans-analizi', everyMinutes: 1440, dept: '10-Finans-ve-Operasyon', request: 'Bu ayın finansal analizini ve unit economics değerlerini çıkar' },
        { name: 'churn-risk-taramasi', everyMinutes: 720, dept: '09-Satis-ve-CRM', request: 'Müşteri churn risk analizi yap ve yüksek riskli müşteriler için aksiyon öner' },
        { name: 'sprint-durum-raporu', everyMinutes: 1440, dept: '01-Proje-Yonetimi', request: 'Sprint 2 durum raporu hazırla' },
        { name: 'otonom-yonetim-toplantisi', everyMinutes: 240, dept: '*', request: 'TOPLANTI' },
        { name: 'haftalik-guvenlik-denetimi', everyMinutes: 10080, dept: '05-Test-QA-ve-Guvenlik', request: 'Kurum klasöründe güvenlik açığı denetimi yap' },
        { name: 'haftalik-doctor', everyMinutes: 10080, dept: '*', request: 'DOCTOR' },
      ],
    },
  };
  writeJSON(cfgPath, cfg);

  writeIfMissing(join(tdir, 'CLAUDE.md'), T.tenantClaudeMd(cfg));
  writeIfMissing(join(tdir, 'AGENTS.md'), T.tenantAgentsMd(cfg));
  writeIfMissing(join(tdir, '.gitignore'), '.runtime/\n');
  const cl = join(tdir, '.claude');
  DEPARTMENTS.forEach(d => writeIfMissing(join(cl, 'agents', `${d.no}.md`), T.agentCard(d)));
  for (const r of T.GLOBAL_RULES(cfg)) writeIfMissing(join(cl, 'rules', r.file), T.ruleFile(r));
  writeSkill(join(cl, 'skills'), { name: 'kurumsal-rapor-formati', description: 'Tüm departmanların ortak rapor biçimi: özet, tablo, risk, aksiyon.', triggers: ['rapor formatı', 'yönetici özeti'], args: [['$KONU', 'Rapor konusu']], steps: ['1 paragraf yönetici özeti yaz.', 'Verileri tabloyla ver.', 'Riskleri ve aksiyonları ayrı başlıkta listele.', 'Kaynak tablo/dosyaları belirt.'] }, '.claude');
  writeIfMissing(join(cl, 'mcp-config.json'), JSON.stringify({ mode: 'offline', servers: { 'local-sqlite': { enabled: true }, 'local-files': { enabled: true, root: '.' } } }, null, 2) + '\n');
  writeIfMissing(join(cl, 'plugins', 'README.md'), '# plugins/\n\nPaketlenmiş Skill + MCP eklentileri. Yalnızca onaylı paketler.\n');

  const eg = join(tdir, '_EGITIM-MERKEZI');
  for (const ch of ['1-yazili', '2-gorsel', '3-video', '4-fare-kaydi', '5-ses', '6-ithalat']) ensureDir(join(eg, '01-Ham-Materyaller', ch));
  ensureDir(join(eg, '02-Islenmis-SOP-Arsivi')); ensureDir(join(eg, '03-Ithal-Edilen-Repolar'));
  writeIfMissing(join(eg, 'README.md'), `# Eğitim Merkezi — 6 Kanallı Boru Hattı\n\n| # | Kanal | Ham klasör | Çıktı |\n|---|---|---|---|\n| 1 | Yazılı | 01-Ham-Materyaller/1-yazili | context/bilgi-bankasi.md + skills/ |\n| 2 | Görsel | 2-gorsel | context/gorsel-standartlar.md + assets/ |\n| 3 | Video | 3-video | 02-Islenmis-SOP-Arsivi + SKILL.md |\n| 4 | Fare/Ekran kaydı | 4-fare-kaydi | scripts/ui_playbook.mjs + SKILL.md |\n| 5 | Ses | 5-ses | personel skills/ + rules/ |\n| 6 | GitHub/Marketplace | 03-Ithal-Edilen-Repolar | personel skills/ + global-registry |\n\nTüm çıktılar önce **taslak** olarak üretilir, güvenlik + format kontrolü ve onay sonrası aktifleşir.\n`);

  for (const d of DEPARTMENTS) buildDepartment(name, d, displayName);

  if (!existsSync(join(tdir, '.env.vault'))) {
    const accessKey = newAccessKey(name.slice(0, 3).toUpperCase());
    writeVault(name, { ADMIN_KEY_HASH: hashSecret(accessKey), SMTP_PASSWORD: '', CLOUD_API_KEYS: {}, createdAt: new Date().toISOString() });
  }
  seed(name);
  gitSnapshot(name, existed ? 'provisioner: güncelleme' : 'provisioner: ilk kurulum');
  return { name, displayName, subdomain, localUrl: `http://${name}.localhost:4400`, existed };
}

// ---------- 3 PAKET DESTEKLİ YENİ KURUM / ÜYELİK ÜRETİCİ ----------
export function provisionDemoTenant({ name, display, subdomain, adminName, adminEmail, planTier = 'starter', agentPair = ['09-Satis-ve-CRM/satis-temsilcisi', '10-Finans-ve-Operasyon/finansal-analist'] }) {
  if (!SLUG_RE.test(name || '')) throw new Error('Geçersiz kurum kodu: ' + name);
  ensureCore();
  const tdir = tenantDir(name);
  const tierObj = PLAN_TIERS[planTier] || PLAN_TIERS.starter;
  const displayName = display || name.toUpperCase();
  const sub = subdomain || `${name}.kurum.local`;
  const createdAt = new Date().toISOString();

  let selectedDepts = [];
  if (tierObj.tierCode === 'full') {
    selectedDepts = DEPARTMENTS.map(d => ({ ...d, personnel: [...d.personnel] }));
  } else if (tierObj.tierCode === 'pro') {
    selectedDepts = DEPARTMENTS.slice(0, 5).map(d => ({ ...d, personnel: d.personnel.slice(0, 3) }));
  } else {
    for (const pair of agentPair.slice(0, 2)) {
      const [dSlug, pSlug] = String(pair).split('/');
      const catDept = DEPARTMENTS.find(d => d.slug === dSlug) || DEPARTMENTS[8];
      const catPers = catDept.personnel.find(p => p.slug === pSlug) || catDept.personnel[0];
      let existing = selectedDepts.find(d => d.slug === catDept.slug);
      if (!existing) {
        existing = { ...catDept, personnel: [] };
        selectedDepts.push(existing);
      }
      if (!existing.personnel.some(p => p.slug === catPers.slug)) {
        existing.personnel.push({ ...catPers, head: true });
      }
    }
  }

  const cfgPath = join(tdir, 'tenant-config.json');
  const cfg = {
    name,
    displayName,
    subdomain: sub,
    localHost: `${name}.localhost`,
    createdAt,
    version: '4.0',
    plan: {
      ...tierObj,
      createdAt,
    },
    llm: { mode: 'offline', allowCloud: false, routerFile: '../../_CORE-INFRASTRUCTURE/offline-fallback-router.json', modelOverride: null },
    network: { bind: '127.0.0.1', intranetAllow: [], smtp: null, outboundPolicy: 'deny-all-except-loopback-and-intranetAllow' },
    contextBudgetChars: 24000,
    approvals: { requireFor: ['dis-eposta', 'odeme', 'skill-aktivasyonu'] },
    rbac: {
      roles: { 'kurum-yoneticisi': ['*'], izleyici: ['okuma'] },
      tableAccess: Object.fromEntries(selectedDepts.map(d => [d.slug, d.tables])),
      ceoTables: ['projects', 'campaigns', 'crm_leads', 'invoices', 'expenses'],
    },
    departments: selectedDepts.map(d => ({ no: d.no, slug: d.slug, name: d.name, emoji: d.emoji, color: d.color, keywords: d.keywords, tables: d.tables, tools: d.tools })),
    scheduler: {
      enabled: true,
      tickSeconds: 60,
      jobs: [
        { name: 'gunluk-durum-analizi', everyMinutes: 1440, dept: selectedDepts[0].slug, request: 'Günlük kurum durum analizini hazırla' },
      ],
    },
  };
  writeJSON(cfgPath, cfg);
  writeIfMissing(join(tdir, 'CLAUDE.md'), T.tenantClaudeMd(cfg));
  writeIfMissing(join(tdir, 'AGENTS.md'), T.tenantAgentsMd(cfg));
  writeIfMissing(join(tdir, '.gitignore'), '.runtime/\n');

  const cl = join(tdir, '.claude');
  selectedDepts.forEach(d => writeIfMissing(join(cl, 'agents', `${d.no}.md`), T.agentCard(d)));
  for (const r of T.GLOBAL_RULES(cfg)) writeIfMissing(join(cl, 'rules', r.file), T.ruleFile(r));
  writeIfMissing(join(cl, 'mcp-config.json'), JSON.stringify({ mode: 'offline', servers: { 'local-sqlite': { enabled: true } } }, null, 2) + '\n');

  const eg = join(tdir, '_EGITIM-MERKEZI');
  for (const ch of ['1-yazili', '2-gorsel', '3-video', '4-fare-kaydi', '5-ses', '6-ithalat']) ensureDir(join(eg, '01-Ham-Materyaller', ch));
  ensureDir(join(eg, '02-Islenmis-SOP-Arsivi')); ensureDir(join(eg, '03-Ithal-Edilen-Repolar'));

  for (const d of selectedDepts) buildDepartment(name, d, displayName);

  if (!existsSync(join(tdir, '.env.vault'))) {
    const accessKey = newAccessKey('KURUM');
    writeVault(name, { ADMIN_KEY_HASH: hashSecret(accessKey), SMTP_PASSWORD: '', CLOUD_API_KEYS: {}, createdAt });
  }
  seed(name);
  gitSnapshot(name, `provisioner: ${tierObj.name} kurulumu`);
  return { name, displayName, subdomain: sub, plan: cfg.plan };
}

// ---------- ANKARA BÜYÜKŞEHİR BELEDİYESİ BİLGİ İŞLEM DAİRESİ BAŞKANLIĞI (FULL PAKET • 5 ŞUBE MÜDÜRLÜĞÜ & BAŞKENT KART) ----------
export function provisionAbbTenant() {
  ensureCore();
  const name = 'abb-bilgi-islem';
  const displayName = 'Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı';
  const subdomain = 'bilgiislem.ankara.bel.tr';
  const tdir = tenantDir(name);
  const createdAt = new Date().toISOString();

  const cfgPath = join(tdir, 'tenant-config.json');
  const cfg = {
    name,
    displayName,
    subdomain,
    localHost: 'abb-bilgi-islem.localhost',
    createdAt,
    version: '4.0',
    plan: {
      ...PLAN_TIERS.full,
      label: 'Full Kurumsal & Kamu Paketi (5 Şube Müdürlüğü · Başkent Kart 3 Yıllık / 36 Ay Tam İhale & Evrak Denetimi)',
    },
    llm: { mode: 'offline', allowCloud: false, routerFile: '../../_CORE-INFRASTRUCTURE/offline-fallback-router.json', modelOverride: null },
    network: { bind: '127.0.0.1', intranetAllow: [], smtp: null, outboundPolicy: 'deny-all-except-loopback-and-intranetAllow' },
    contextBudgetChars: 24000,
    approvals: { requireFor: ['dis-eposta', 'odeme', 'skill-aktivasyonu', 'kesin-kabul-onayi'] },
    rbac: {
      roles: { 'kurum-yoneticisi': ['*'], 'sube-muduru': ['kendi-departmani', 'onay-oner'], 'proje-sorumlusu': ['kendi-departmani'], izleyici: ['okuma'] },
      tableAccess: Object.fromEntries(ABB_DEPARTMENTS.map(d => [d.slug, d.tables])),
      ceoTables: ['projects', 'project_tasks', 'invoices', 'expenses', 'contracts'],
    },
    departments: ABB_DEPARTMENTS.map(d => ({ no: d.no, slug: d.slug, name: d.name, emoji: d.emoji, color: d.color, keywords: d.keywords, tables: d.tables, tools: d.tools })),
    scheduler: {
      enabled: true,
      tickSeconds: 60,
      jobs: [
        { name: 'baskent-kart-3-yillik-evrak-taramasi', everyMinutes: 720, dept: '01-Akilli-Sehirler-Sube-Mudurlugu', request: 'Başkent Kart 3 yıllık ihale kapanışı ve kabulü için tüm fatura, dekont ve teknik şartname evraklarını kontrol et' },
        { name: 'haftalik-kvkk-ve-siber-denetim', everyMinutes: 10080, dept: '04-Siber-Guvenlik-ve-Bilgi-Guvenligi-Sube-Mudurlugu', request: 'Başkent Kart ihale kapanış dosyalarında KVKK ve güvenlik taraması yap' },
      ],
    },
  };
  writeJSON(cfgPath, cfg);
  writeFile(join(tdir, 'CLAUDE.md'), T.tenantClaudeMd(cfg));
  writeFile(join(tdir, 'AGENTS.md'), T.tenantAgentsMd(cfg));
  writeIfMissing(join(tdir, '.gitignore'), '.runtime/\n');

  const cl = join(tdir, '.claude');
  ABB_DEPARTMENTS.forEach(d => writeFile(join(cl, 'agents', `${d.no}.md`), T.agentCard(d)));
  for (const r of T.GLOBAL_RULES(cfg)) writeIfMissing(join(cl, 'rules', r.file), T.ruleFile(r));
  writeSkill(join(cl, 'skills'), { name: 'kurumsal-rapor-formati', description: 'Belediye resmi yazışma ve Muayene Kabul Komisyonu rapor formatı.', triggers: ['rapor formatı', 'resmi yazı'], args: [['$KONU', 'Rapor konusu']], steps: ['1 paragraf yönetici özeti yaz.', '3 yıllık verileri tabloyla ver.', 'Eksik evrakları ve ihtar maddelerini ayrı başlıkta listele.'] }, '.claude');
  writeIfMissing(join(cl, 'mcp-config.json'), JSON.stringify({ mode: 'offline', servers: { 'local-sqlite': { enabled: true }, 'local-files': { enabled: true, root: '.' } } }, null, 2) + '\n');

  const eg = join(tdir, '_EGITIM-MERKEZI');
  for (const ch of ['1-yazili', '2-gorsel', '3-video', '4-fare-kaydi', '5-ses', '6-ithalat']) ensureDir(join(eg, '01-Ham-Materyaller', ch));
  ensureDir(join(eg, '02-Islenmis-SOP-Arsivi')); ensureDir(join(eg, '03-Ithal-Edilen-Repolar'));

  for (const d of ABB_DEPARTMENTS) buildDepartment(name, d, displayName);

  // 3 Yıllık (36 Ay) Başkent Kart Evrak Kayıt Defteri ve fiziksel klasör yapısı
  const dataset = generateBaskentKart3YearDataset();
  writeJSON(join(tdir, 'baskent-kart-3-yillik-evrak-kayitlari.json'), dataset);
  const docsRoot = ensureDir(join(tdir, 'baskent-kart-3-yillik-dosyalar'));
  for (const y of [1, 2, 3]) {
    const cy = 2022 + y;
    const yDir = ensureDir(join(docsRoot, `Yil-${y}-${cy}`));
    writeIfMissing(join(yDir, 'README.md'), `# Başkent Kart ${y}. Yıl (${cy}) Hak Ediş, Fatura, Banka Dekontu ve Teknik Şartname Evrak Klasörü\n\nBu klasöre ${cy} yılına ait aylık fatura, banka dekontu, market/POS takas mutabakatı, SLA ve SGK belgeleri konulur.\n`);
  }

  if (!existsSync(join(tdir, '.env.vault'))) {
    const accessKey = newAccessKey('ABB');
    writeVault(name, { ADMIN_KEY_HASH: hashSecret(accessKey), SMTP_PASSWORD: '', CLOUD_API_KEYS: {}, createdAt });
  }
  seed(name);

  // ABB Bilgi İşlem Dairesi Başkanlığına özel kullanıcı, proje ve görev kayıtları
  const d = db(name);
  d.exec('DELETE FROM users');
  const uIns = d.prepare('INSERT INTO users (ad_soyad,eposta,rol,departman_yetkisi,yetkiler,durum,unvan,created_at) VALUES (?,?,?,?,?,?,?,?)');
  const ts = now();
  [
    ['Gökhan Özcan', 'dairebaskani@ankara.bel.tr', 'Kurum Admini', 'Tüm Müdürlükler (*)', JSON.stringify(['gorev_ver', 'onay_ver', 'ajan_yonet', 'kullanici_yonet', 'egitim_ver', 'veri_oku']), 'Aktif', 'Bilgi İşlem Dairesi Başkanı'],
    ['Dr. Burak Kaya', 'akillisehirler@ankara.bel.tr', 'Departman Yöneticisi', '01-Akilli-Sehirler-Sube-Mudurlugu', JSON.stringify(['gorev_ver', 'onay_ver', 'ajan_yonet', 'egitim_ver', 'veri_oku']), 'Aktif', 'Akıllı Şehirler Şube Müdürü'],
    ['Merve Çelik', 'projeyonetimi@ankara.bel.tr', 'Departman Yöneticisi', '01-Akilli-Sehirler-Sube-Mudurlugu', JSON.stringify(['gorev_ver', 'onay_ver', 'egitim_ver', 'veri_oku']), 'Aktif', 'Proje Yönetimi Ekibi Lideri'],
    ['Emre Demir', 'baskentkart@ankara.bel.tr', 'Kurum Uzmanı', '01-Akilli-Sehirler-Sube-Mudurlugu', JSON.stringify(['gorev_ver', 'egitim_ver', 'veri_oku']), 'Aktif', 'Proje Yönetimi Ekibi — Başkent Kart Proje Sorumlusu'],
    ['Hakan Yıldırım', 'idarimali@ankara.bel.tr', 'Departman Yöneticisi', '05-Idari-Mali-Isler-ve-Ihale-Sube-Mudurlugu', JSON.stringify(['gorev_ver', 'onay_ver', 'veri_oku']), 'Aktif', 'İdari, Mali İşler ve İhale Takip Şube Müdürü'],
    ['Vatandaş / Başkent Kart Sahibi', 'baskent153@ankara.bel.tr', 'Vatandaş / Standart Kullanıcı', 'Halka Açık Hizmetler', JSON.stringify(['gorev_ver']), 'Aktif', 'Başkent Kart Hak Sahibi Vatandaş'],
  ].forEach(r => uIns.run(...r, ts));

  d.exec('DELETE FROM projects');
  d.prepare('INSERT INTO projects (ad,durum,baslangic,bitis,butce,sorumlu) VALUES (?,?,?,?,?,?)')
    .run('Başkent Kart Sosyal Yardım Kartı (3 Yıllık İhale Kapanış & Kesin Kabul)', 'Kabul Denetiminde', '2023-01-01', '2025-12-31', 59850000, 'baskent-kart-proje-sorumlusu');
  d.prepare('INSERT INTO projects (ad,durum,baslangic,bitis,butce,sorumlu) VALUES (?,?,?,?,?,?)')
    .run('Akıllı Şehir IoT & Ulaşım Veri Platformu', 'Devam', '2025-01-01', '2026-12-31', 18500000, 'proje-yonetimi-ekip-lideri');

  gitSnapshot(name, 'provisioner: ABB Bilgi Islem Dairesi Baskanligi ve Baskent Kart 3 yillik denetim kurulumu');
  return { name, displayName, subdomain };
}

// ---------- SELF-SERVİS ----------
export function addDepartment(tenant, { slug, name, keywords = [], tables = [], emoji = '🏢', color = '#6e7681' }) {
  if (!DEPT_RE.test(slug || '')) throw new Error('Departman klasörü "NN-Ad-Soyad" biçiminde olmalı (örn. 11-Insan-Kaynaklari)');
  const cfgPath = join(tenantDir(tenant), 'tenant-config.json');
  const cfg = readJSON(cfgPath);
  if (cfg.plan?.maxDepartments && cfg.departments.length >= cfg.plan.maxDepartments) {
    throw new Error(`Demo Paket Sınırı: 7 Günlük Demo hesabında en fazla ${cfg.plan.maxDepartments} departman ve ${cfg.plan.maxAgents || 2} yapay zeka ajanı bulunabilir. Tam Kurumsal Pakete geçerek 10 departmanı aktif edebilirsiniz.`);
  }
  if (cfg.departments.some(d => d.slug === slug)) throw new Error('Departman zaten var');
  const d = { no: slug.slice(0, 2), slug, name: name || slug.slice(3).replace(/-/g, ' '), emoji, color, keywords, tables, tools: ['Yerel dosya + SQLite (offline)'], deptRules: [], personnel: [] };
  buildDepartment(tenant, d, cfg.displayName);
  cfg.departments.push({ no: d.no, slug, name: d.name, emoji, color, keywords, tables, tools: d.tools });
  cfg.rbac.tableAccess[slug] = tables;
  writeJSON(cfgPath, cfg);
  writeIfMissing(join(tenantDir(tenant), '.claude', 'agents', `${d.no}.md`), T.agentCard({ ...d, personnel: [{ slug: 'yonetici', title: d.name + ' Yöneticisi', head: true }] }));
  gitSnapshot(tenant, 'departman eklendi: ' + slug);
  return d;
}

export function addPersonnel(tenant, deptSlug, { slug, title, mission = '', rules = [], head = false }) {
  if (!SLUG_RE.test(slug || '')) throw new Error('Personel adı küçük harf/tire olmalı');
  const cfg = readJSON(join(tenantDir(tenant), 'tenant-config.json'));
  if (cfg.plan?.maxAgents) {
    let totalAgents = 0;
    for (const dep of cfg.departments) {
      const pd = join(tenantDir(tenant), 'departmanlar', dep.slug, 'personeller');
      if (existsSync(pd)) totalAgents += readdirSync(pd).length;
    }
    if (totalAgents >= cfg.plan.maxAgents) {
      throw new Error(`Demo Paket Sınırı: 7 Günlük Demo hesabında en fazla ${cfg.plan.maxAgents} yapay zeka ajanı çalıştırılabilir. Tam Kurumsal Pakete geçerek sınırsız ajan ekleyebilirsiniz.`);
    }
  }
  const d = cfg.departments.find(x => x.slug === deptSlug);
  if (!d) throw new Error('Departman bulunamadı: ' + deptSlug);
  const pdir = safeJoin(tenantDir(tenant), 'departmanlar', deptSlug, 'personeller', slug);
  if (existsSync(pdir)) throw new Error('Personel zaten var');
  buildPersonnel(tenant, d, { slug, title: title || slug, mission: mission || 'Görev tanımı eğitim ile tamamlanacak.', rules, head, skills: [] });
  gitSnapshot(tenant, 'personel eklendi: ' + deptSlug + '/' + slug);
  return { dept: deptSlug, slug };
}

// ---------- GİT ANLIK GÖRÜNTÜ (/rewind) ----------
export function gitSnapshot(tenant, msg) {
  const cwd = tenantDir(tenant);
  try {
    if (!existsSync(join(cwd, '.git'))) execFileSync('git', ['init', '-q'], { cwd, stdio: 'ignore' });
    execFileSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
    execFileSync('git', ['-c', 'user.name=dijital-ikiz', '-c', 'user.email=dijital-ikiz@local', 'commit', '-q', '-m', msg, '--allow-empty'], { cwd, stdio: 'ignore' });
    return true;
  } catch { return false; }
}

// ---------- CLI ----------
function parseArgs(a) { const o = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) { o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; } return o; }

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const a = parseArgs(process.argv.slice(2));
  try {
    if (a['core-only']) { ensureCore(); console.log('Çekirdek altyapı hazır:', CORE); }
    else {
      const r = provisionTenant({ name: a.name, subdomain: a.subdomain, display: a.display, mode: a.mode || 'offline' });
      const persons = DEPARTMENTS.reduce((s, d) => s + d.personnel.length, 0);
      console.log(`✔ ${r.displayName} (${r.name}) ${r.existed ? 'güncellendi' : 'oluşturuldu'}`);
      console.log(`  Subdomain   : ${r.subdomain}  (yerel: ${r.localUrl})`);
      console.log(`  Departman   : ${DEPARTMENTS.length}, Personel: ${persons}`);
      if (r.accessKeyFile) console.log(`  Giriş anahtarı: ${r.accessKeyFile}`);
    }
  } catch (e) { console.error('✖ Hata:', e.message); process.exit(1); }
}
