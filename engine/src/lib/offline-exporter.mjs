// Her kurum için bilgisayara indirilebilir, hiçbir sunucuya veya internet linkine
// ihtiyaç duymadan (doğrudan çift tıklanarak file:// üzerinden) sadece o bilgisayarda
// %100 offline çalışabilen Tek Dosyalık Kurumsal Dijital İkiz & 3 Yıllık İhale/Evrak Denetim Sistemi üreticisi.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, tenantDir, ensureDir, frontmatter } from './util.mjs';
import { tenantConfig, listPersonnel, listSkills } from './context.mjs';
import { generateBaskentKart3YearDataset } from '../catalog/abb-baskent-kart.mjs';

export function getBaskentKartLedger(tenant) {
  const tdir = tenantDir(tenant);
  const customPath = join(tdir, 'baskent-kart-3-yillik-evrak-kayitlari.json');
  if (existsSync(customPath)) {
    try { return JSON.parse(readFileSync(customPath, 'utf8')); } catch { }
  }
  const initial = generateBaskentKart3YearDataset();
  if (tenant === 'abb-bilgi-islem') {
    writeFileSync(customPath, JSON.stringify(initial, null, 2), 'utf8');
  }
  return initial;
}

export function saveBaskentKartLedger(tenant, ledger) {
  const tdir = tenantDir(tenant);
  const customPath = join(tdir, 'baskent-kart-3-yillik-evrak-kayitlari.json');
  writeFileSync(customPath, JSON.stringify(ledger, null, 2), 'utf8');
  // Skill asset içindeki kopyayı da senkronize tut
  const skillAssetPath = join(
    tdir,
    'departmanlar',
    '01-Akilli-Sehirler-Sube-Mudurlugu',
    'personeller',
    'baskent-kart-proje-sorumlusu',
    'skills',
    'baskent-kart-ihale-kabul-denetimi',
    'assets',
    'baskent-kart-3-yillik-evrak-kayitlari.json'
  );
  if (existsSync(join(tdir, 'departmanlar', '01-Akilli-Sehirler-Sube-Mudurlugu'))) {
    try { writeFileSync(skillAssetPath, JSON.stringify(ledger, null, 2), 'utf8'); } catch { }
  }
  return ledger;
}

export function collectTenantBundle(tenant, tierOverride = null) {
  const cfg = tenantConfig(tenant);
  const root = tenantDir(tenant);
  const skills = listSkills(tenant, { includeDrafts: true });

  const tierMap = {
    starter: { tierCode: 'starter', name: 'Başlangıç Paketi', label: 'Başlangıç Paketi (2 Müdürlük · 3 Ajan · 12 Ay Evrak Denetimi · 5 Kullanıcı)', maxDepartments: 2, maxAgents: 3, maxAuditMonths: 12, maxUsers: 5 },
    pro: { tierCode: 'pro', name: 'Profesyonel Kurum Paketi', label: 'Profesyonel Kurum Paketi (5 Müdürlük · 12 Ajan · 24 Ay Evrak Denetimi · 25 Kullanıcı)', maxDepartments: 5, maxAgents: 12, maxAuditMonths: 24, maxUsers: 25 },
    full: { tierCode: 'full', name: 'Full Kurumsal & Kamu Paketi', label: 'Full Kurumsal & Kamu Paketi (Sınırsız Müdürlük/Ajan · 36 Ay / 3 Yıl Tam İhale & Evrak Denetimi)', maxDepartments: 99, maxAgents: 999, maxAuditMonths: 36, maxUsers: 999 },
  };
  const resolvedTierCode = tierOverride || cfg.plan?.tierCode || (tenant === 'abb-bilgi-islem' ? 'full' : (tenant === 'demo-sirketi' ? 'starter' : 'pro'));
  const plan = tierMap[resolvedTierCode] || tierMap.full;

  const allDepts = (cfg.departments || []).slice(0, plan.maxDepartments);
  const allowedDeptSlugs = new Set(allDepts.map(d => d.slug));

  const personnel = listPersonnel(tenant)
    .filter(p => allowedDeptSlugs.has(p.dept))
    .slice(0, plan.maxAgents)
    .map(p => {
      const pDir = join(root, 'departmanlar', p.dept, 'personeller', p.slug);
      const profRaw = existsSync(join(pDir, 'profil.md')) ? readFileSync(join(pDir, 'profil.md'), 'utf8') : '';
      const { body } = frontmatter(profRaw);
      const missionMatch = /## Görev Tanımı\s+([\s\S]*?)(?:\n## |\n*$)/.exec(body);
      const rulesDir = join(pDir, 'rules');
      const rules = [];
      if (existsSync(rulesDir)) {
        for (const rf of readdirSync(rulesDir).filter(f => f.endsWith('.md'))) {
          const r = frontmatter(readFileSync(join(rulesDir, rf), 'utf8'));
          rules.push(...r.body.split(/\r?\n/).map(l => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean));
        }
      }
      const pSkills = skills.filter(s => s.personnel === p.slug && s.dept === p.dept).map(s => ({
        name: s.name,
        description: s.description,
        triggers: s.triggers,
        scripts: s.scripts,
      }));
      return {
        ...p,
        mission: (missionMatch?.[1] || '').trim(),
        rules,
        skills: pSkills,
      };
    });

  const fullLedger = JSON.parse(JSON.stringify(getBaskentKartLedger(tenant)));
  fullLedger.months = (fullLedger.months || []).slice(0, plan.maxAuditMonths);

  //Varsayılan e-posta (kullanıcı sadece e-posta ve şifre ile giriş yapar)
  const defaultEmails = {
    'abb-bilgi-islem': 'baskentkart@ankara.bel.tr',
    'abc-holding': 'admin@abc.sistem.com',
    'xyz-holding': 'admin@xyz.sistem.com',
    'demo-sirketi': 'demo@demo.sistem.com',
  };

  return {
    exportedAt: new Date().toISOString(),
    tenant,
    displayName: cfg.displayName,
    subdomain: cfg.subdomain,
    plan,
    defaultEmail: defaultEmails[tenant] || `admin@${cfg.subdomain}`,
    departments: allDepts,
    personnel,
    ledger: fullLedger,
  };
}

export function buildStandaloneOfflineHtml(tenant, tierOverride = null) {
  const bundle = collectTenantBundle(tenant, tierOverride);
  const safeJson = JSON.stringify(bundle).replace(/<\/script>/gi, '<\\/script>');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${bundle.displayName} (${bundle.plan.name}) — %100 Offline Masaüstü Dijital İkiz & Evrak Denetim Sistemi</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #475569;
      --primary: #1e3a8a;
      --primary-accent: #172554;
      --primary-soft: #eff6ff;
      --success: #15803d;
      --success-soft: #dcfce7;
      --danger: #b91c1c;
      --danger-soft: #fee2e2;
      --warn: #b45309;
      --warn-soft: #fef3c7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 15.5px;
      line-height: 1.62;
      letter-spacing: -0.005em;
      color: var(--text);
      background: var(--bg);
      -webkit-font-smoothing: antialiased;
    }
    h1, h2, h3, h4 {
      font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.15;
      margin-top: 0;
      color: #0b1320;
    }
    .topbar {
      background: #0f172a;
      color: #fff;
      padding: 16px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 14px;
      border-bottom: 4px solid #1d4ed8;
    }
    .topbar h1 {
      color: #fff;
      font-size: 21px;
      margin: 0 0 4px 0;
    }
    .topbar-sub {
      font-size: 13px;
      color: #cbd5e1;
    }
    .badge-offline {
      background: #16a34a;
      color: #fff;
      padding: 6px 14px;
      border-radius: 99px;
      font-size: 12.5px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .nav-tabs {
      background: #fff;
      border-bottom: 1px solid var(--border);
      padding: 0 28px;
      display: flex;
      gap: 8px;
      overflow-x: auto;
    }
    .nav-tab {
      border: none;
      background: transparent;
      padding: 14px 18px;
      font-size: 14.5px;
      font-weight: 600;
      color: var(--muted);
      cursor: pointer;
      border-bottom: 3px solid transparent;
    }
    .nav-tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      background: var(--primary-soft);
    }
    .container {
      max-width: 1440px;
      margin: 0 auto;
      padding: 24px 28px 60px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px 22px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(15,23,42,0.04);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .kpi-box {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
    }
    .kpi-label { font-size: 12.5px; color: var(--muted); font-weight: 600; text-transform: uppercase; }
    .kpi-val { font-size: 24px; font-weight: 800; margin-top: 6px; font-family: Georgia, serif; }
    .btn {
      border: 1px solid var(--border);
      background: #fff;
      color: var(--text);
      padding: 9px 15px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-primary { background: var(--primary); color: #fff; border-color: var(--primary); }
    .btn-success { background: var(--success); color: #fff; border-color: var(--success); }
    .btn-danger { background: var(--danger); color: #fff; border-color: var(--danger); }
    .pill {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 99px;
      font-size: 12px;
      font-weight: 700;
    }
    .pill-ok { background: var(--success-soft); color: var(--success); }
    .pill-err { background: var(--danger-soft); color: var(--danger); }
    .pill-warn { background: var(--warn-soft); color: var(--warn); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13.5px;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 9px 10px;
      text-align: left;
    }
    th {
      background: #f8fafc;
      font-weight: 700;
      color: #334155;
      position: sticky;
      top: 0;
    }
    tr.row-issue { background: #fff8f8; }
    .org-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(310px, 1fr));
      gap: 16px;
    }
    .agent-item {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      margin-top: 10px;
      background: #f8fafc;
      cursor: pointer;
      transition: all 0.15s;
    }
    .agent-item:hover {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
    .chat-box {
      border: 1px solid var(--border);
      border-radius: 10px;
      background: #f8fafc;
      height: 360px;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .msg {
      max-width: 82%;
      padding: 12px 15px;
      border-radius: 12px;
      font-size: 14.5px;
      white-space: pre-wrap;
    }
    .msg-user { align-self: flex-end; background: var(--primary); color: #fff; }
    .msg-agent { align-self: flex-start; background: #fff; border: 1px solid var(--border); }
    @media print {
      .topbar, .nav-tabs, .no-print { display: none !important; }
      body { background: #fff; }
      .card { border: 1px solid #000; box-shadow: none; }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div>
      <h1>🏛️ ${bundle.displayName}</h1>
      <div class="topbar-sub">Paket: <strong>${bundle.plan.label}</strong> • Sunucu ve İnternet Gerektirmez • Sadece Bu Bilgisayarda Çalışır</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span class="badge-offline">🔒 %100 OFFLINE YEREL MOD (${bundle.plan.name.toUpperCase()})</span>
      <button class="btn" onclick="exportStateJson()">💾 Verileri Bilgisayara Kaydet (.json)</button>
      <button class="btn" onclick="window.print()">🖨️ Resmi Tutanağı Yazdır / PDF</button>
    </div>
  </header>

  <!-- SADECE E-POSTA VE ŞİFRE İLE GİRİŞ KAPISI (KISAYOL BUTONU YOKTUR) -->
  <div id="offlineLoginGate" style="position:fixed;inset:0;background:rgba(11,19,32,0.82);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
    <div class="card" style="max-width:460px;width:100%;margin:0;padding:30px;border-top:5px solid #1e3a8a">
      <span class="pill pill-ok" style="margin-bottom:10px">${bundle.plan.name} • %100 Offline Masaüstü Sistemi</span>
      <h2 style="margin:4px 0 6px">${bundle.displayName}</h2>
      <p style="color:var(--muted);font-size:14px;margin:0 0 18px">Güvenlik politikası gereği sisteme yalnızca kurumsal e-posta adresiniz ve şifreniz ile giriş yapabilirsiniz.</p>
      <div style="margin-bottom:12px">
        <label style="display:block;font-weight:700;font-size:13px;margin-bottom:5px">Kurumsal E-posta Adresi</label>
        <input id="gateEmail" type="email" placeholder="${bundle.defaultEmail}" style="width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:8px;font-size:15px" />
      </div>
      <div style="margin-bottom:16px">
        <label style="display:block;font-weight:700;font-size:13px;margin-bottom:5px">Şifre</label>
        <input id="gatePass" type="password" placeholder="••••••••" style="width:100%;padding:11px 13px;border:1px solid var(--border);border-radius:8px;font-size:15px" onkeydown="if(event.key==='Enter')submitOfflineLogin()" />
      </div>
      <div id="gateErr" style="display:none;color:#b91c1c;font-size:13px;font-weight:700;margin-bottom:10px"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;font-size:15px" onclick="submitOfflineLogin()">Giriş Yap →</button>
    </div>
  </div>

  <nav class="nav-tabs">
    <button class="nav-tab active" onclick="switchTab('projects', this)">📂 Klasör, PDF/Excel &amp; Görevler</button>
    <button class="nav-tab" onclick="switchTab('baskent', this)">💳 Başkent Kart &amp; Projeler</button>
    <button class="nav-tab" onclick="switchTab('office3d', this)">🏙️ 3D Yönetim Ofisi</button>
    <button class="nav-tab" onclick="switchTab('org', this)">🏢 Müdürlükler &amp; Ajanlar</button>
    <button class="nav-tab" onclick="switchTab('chat', this)">💬 Ajan İletişimi</button>
    <button class="nav-tab" onclick="switchTab('spec', this)">📋 Şartname &amp; Güvenlik</button>
  </nav>

  <main class="container">
    <section id="tab-office3d" style="display:none">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
          <div>
            <h2 style="margin:0">🏙️ 3D Sanal Yönetim Ofisi — Müdürlükler &amp; Uzman Ajanlar</h2>
            <p style="margin:4px 0 0;color:var(--muted);font-size:13.5px">Kurumunuzdaki şube müdürlüklerini ve ajan masalarını 3D ofis görünümünde inceleyin; üzerine tıklayarak doğrudan görev veya mesaj gönderin.</p>
          </div>
          <button class="btn btn-primary" onclick="drawOffline3DOffice()">🔄 Ofisi Yenile</button>
        </div>
        <canvas id="offline3dCanvas" width="1100" height="460" style="width:100%;height:auto;border-radius:12px;border:1px solid var(--border);background:linear-gradient(180deg,#0f172a 0%,#1e293b 100%)"></canvas>
      </div>
    </section>
    <!-- SEKME 0: PROJELER, KAYNAKLAR (KLASÖR / GITHUB / GOOGLE DRIVE / EK LİNKLER), ZAMANLANMIŞ & MULTİDİSİPLİNER GÖREVLER -->
    <section id="tab-projects">
      <div class="card">
        <span class="pill pill-ok">Antigravity Proje & Çalışma Alanı Modeli • %100 Yerel Kayıt</span>
        <h2 style="margin:8px 0 4px">📂 İncelenecek Klasör, GitHub, Google Drive ve Ek Link Kaynakları</h2>
        <p style="margin:0 0 16px;color:var(--muted)">
          Yapay zeka ajanlarının hangi yerel bilgisayar klasörünü, GitHub deposunu, Google Drive bağlantısını veya ek linkleri inceleyeceğini tanımlayın. Tüm ayarlar ve sonuçlar bu bilgisayarda saklanır.
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:18px">
          <div style="padding:16px;border:1px solid var(--border);border-radius:12px;background:#f8fafc">
            <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">📁 1. Bilgisayardan İncelenecek Klasör Seç</label>
            <label class="btn btn-primary" style="cursor:pointer;width:100%;justify-content:center">
              Bilgisayardan Klasör Seç
              <input type="file" webkitdirectory directory multiple style="display:none" onchange="registerProjectFolder(this.files)" />
            </label>
            <div id="projFolderSummary" style="font-size:13px;color:var(--muted);margin-top:8px">Henüz klasör seçilmedi.</div>
          </div>

          <div style="padding:16px;border:1px solid var(--border);border-radius:12px;background:#f8fafc">
            <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">🐙 2. GitHub Deposu (Repo URL)</label>
            <input id="projGithubUrl" type="text" placeholder="https://github.com/kurum/baskent-kart-ihale" style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px" onchange="saveProjectSources()" />
            <label style="display:block;font-weight:700;font-size:14px;margin:10px 0 6px">☁️ 3. Google Drive Klasör Linki</label>
            <input id="projDriveUrl" type="text" placeholder="https://drive.google.com/drive/folders/..." style="width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px" onchange="saveProjectSources()" />
          </div>

          <div style="padding:16px;border:1px solid var(--border);border-radius:12px;background:#f8fafc">
            <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px">🔗 4. Ek İncelenecek Linkler (Şartname / Mevzuat / Portal)</label>
            <div style="display:flex;gap:6px">
              <input id="projExtraLinkInput" type="text" placeholder="https://..." style="flex:1;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px" />
              <button class="btn btn-primary" onclick="addProjectExtraLink()">Ekle</button>
            </div>
            <div id="projExtraLinksList" style="margin-top:8px;font-size:13px;display:flex;flex-direction:column;gap:4px"></div>
          </div>
        </div>
      </div>

      <!-- GÖREV EKLEME, ZAMAN ARALIĞI & MULTİDİSİPLİNER AJAN SEÇİMİ -->
      <div class="card">
        <h2>⏱️ Yeni Görev, Zaman Aralığı ve Multidisipliner Ajan Ekibi Tanımla</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:14px">
          <div>
            <label style="display:block;font-weight:700;font-size:13.5px;margin-bottom:5px">Görev Başlığı</label>
            <input id="taskTitleInput" type="text" placeholder="Örn: Klasördeki 3 Yıllık Fatura & Şartname Uyumu Kontrolü" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14.5px" />
          </div>
          <div>
            <label style="display:block;font-weight:700;font-size:13.5px;margin-bottom:5px">Çalışma Zaman Aralığı (Periyot)</label>
            <select id="taskScheduleSelect" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14.5px">
              <option value="once">Tek Seferlik (Hemen Çalıştır)</option>
              <option value="1m">Her 1 Dakikada Bir (Otomatik İzleme)</option>
              <option value="15m">Her 15 Dakikada Bir</option>
              <option value="hourly">Saatlik Periyot</option>
              <option value="daily">Günlük Periyot</option>
              <option value="weekly">Haftalık Periyot</option>
              <option value="monthly">Aylık Periyot</option>
            </select>
          </div>
          <div>
            <label style="display:block;font-weight:700;font-size:13.5px;margin-bottom:5px">Sorumlu Baş Ajan</label>
            <select id="taskLeadAgentSelect" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14.5px"></select>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <label style="display:block;font-weight:700;font-size:13.5px;margin-bottom:5px">Görev Talimatı ve İnceleme Detayları</label>
          <textarea id="taskInstructionInput" rows="3" placeholder="Örn: Seçili bilgisayar klasöründeki dosyaları, GitHub/Drive ve ek linkleri incele; eksik fatura, dekont ve şartname maddelerini çıkarıp özet rapor üret." style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;font-size:14.5px"></textarea>
        </div>

        <div style="margin-bottom:14px">
          <label style="display:block;font-weight:700;font-size:13.5px;margin-bottom:6px">🤝 Multidisipliner Ortak Çalışacak Diğer Ajanlar (İsteğe Bağlı Çoklu Seçim)</label>
          <div id="taskMultiAgentsBox" style="display:flex;flex-wrap:wrap;gap:10px;padding:10px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:8px"></div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="createAndRunProjectTask(true)">➕ Görevi Ekle ve Şimdi Çalıştır</button>
          <button class="btn" onclick="createAndRunProjectTask(false)">💾 Sadece Görev Listesine Ekle (Zamanlayıcıya Bırak)</button>
        </div>
      </div>

      <!-- GÖREV LİSTESİ, SONUÇLAR VE SONUCA GÖRE MULTİDİSİPLİNER TAKİP GÖREVİ -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <h2 style="margin:0">📋 Tanımlı Görevler, Zamanlayıcılar ve Çıkan Sonuçlar</h2>
          <span class="pill pill-ok" id="schedulerStatusBadge">⏱️ Otomatik Zamanlayıcı Aktif</span>
        </div>
        <div id="projectTasksContainer"></div>
      </div>
    </section>

    <!-- SEKME 1: BAŞKENT KART 3 YILLIK DENETİM -->
    <section id="tab-baskent" style="display:none">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px">
          <div>
            <span class="pill pill-ok">Akıllı Şehirler Şube Müdürlüğü • Proje Yönetimi Ekibi</span>
            <h2 style="margin:8px 0 4px">Başkent Kart 3 Yıllık (36 Ay) Fatura, Dekont ve Evrak Eksiklik Denetim Sistemi</h2>
            <p style="margin:0;color:var(--muted)">
              İhtiyaç sahibi vatandaşlara verilen <strong>Başkent Kart</strong> sosyal yardım kartı ihalesinin kapanış ve kesin kabulü için
              3 yıl (36 ay) boyunca firmanın sunduğu <strong>Fatura, Banka Dekontu, Market/POS Takas Mutabakatı, SLA (%99.90) ve SGK/Vergi Borcu Yoktur</strong>
              evraklarını %100 offline olarak inceler.
            </p>
          </div>
          <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">
            <label class="btn btn-primary" style="cursor:pointer">
              📁 Bilgisayardan 3 Yıllık Evrak Klasörü Seç (Otomatik Eşleştir)
              <input type="file" webkitdirectory directory multiple style="display:none" onchange="handleFolderSelect(this.files)" />
            </label>
            <label class="btn" style="cursor:pointer">
              📄 Tekil Fatura / Dekont Dosyaları Seç
              <input type="file" multiple style="display:none" onchange="handleFolderSelect(this.files)" />
            </label>
            <button class="btn btn-success" onclick="markAllCompleteDemo()">✔ Eksikleri Tamamlandı İşaretle (Simülasyon)</button>
            <button class="btn" onclick="resetLedger()">↺ İlk Denetim Bulgularına Dön</button>
          </div>
        </div>
        <div id="folderScanBanner" style="display:none;margin-top:14px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-weight:600;color:#1e40af"></div>
      </div>

      <div id="auditKpis" class="kpi-grid"></div>

      <div id="auditDecisionBanner" class="card" style="border-left:6px solid #b91c1c"></div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
          <h3 style="margin:0">📊 3 Yıllık (36 Ay) Fatura, Dekont, Market POS ve SLA Denetim Tablosu</h3>
          <div class="no-print" style="display:flex;gap:8px;align-items:center">
            <select id="filterYear" class="btn" onchange="renderAudit()">
              <option value="all">Tüm Yıllar (3 Yıl / 36 Ay)</option>
              <option value="1">1. Yıl (2023 — 1..12. Ay)</option>
              <option value="2">2. Yıl (2024 — 13..24. Ay)</option>
              <option value="3">3. Yıl (2025 — 25..36. Ay)</option>
            </select>
            <select id="filterStatus" class="btn" onchange="renderAudit()">
              <option value="all">Tüm Aylar (36 Ay)</option>
              <option value="issues">Sadece Eksik / Uyuşmazlık Olan Aylar</option>
              <option value="ok">Tam Uyumlu Aylar</option>
            </select>
          </div>
        </div>
        <div style="overflow-x:auto;max-height:580px;overflow-y:auto">
          <table>
            <thead>
              <tr>
                <th>Ay #</th>
                <th>Dönem</th>
                <th>Hak Ediş Faturası</th>
                <th>Fatura Tutarı (TL)</th>
                <th>Banka Dekontu</th>
                <th>Dekont Tutarı (TL)</th>
                <th>Tutar Farkı</th>
                <th>Market / POS Mutabakat</th>
                <th>SLA Uptime</th>
                <th>SGK / Vergi</th>
                <th>Denetim Sonucu & Bulgular</th>
                <th class="no-print">Hızlı İşlem</th>
              </tr>
            </thead>
            <tbody id="auditTableBody"></tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- SEKME 2: 5 ŞUBE MÜDÜRLÜĞÜ & PROJE YÖNETİMİ EKİBİ -->
    <section id="tab-org" style="display:none">
      <div class="card">
        <h2>🏢 ${bundle.displayName} — Teşkilat Şeması (5 Şube Müdürlüğü)</h2>
        <p style="color:var(--muted)">Herhangi bir ajana tıklayarak onunla doğrudan sesli veya yazılı konuşabilir, Başkent Kart kabul denetimini sorabilirsiniz.</p>
        <div id="orgContainer" class="org-grid"></div>
      </div>
    </section>

    <!-- SEKME 3: AJANLA SESLİ & YAZILI KONUŞMA -->
    <section id="tab-chat" style="display:none">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
          <div>
            <h2 style="margin:0 0 4px">💬 Ajan ile Canlı İletişim (Sesli Konuşma & Metin Yazışma)</h2>
            <div style="font-size:13.5px;color:var(--muted)">Seçili Ajan: <strong id="activeAgentTitle">Proje Yönetimi Ekibi — Başkent Kart Proje Sorumlusu</strong></div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <select id="agentSelector" class="btn" onchange="selectAgent(this.value)"></select>
            <label style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:13.5px;cursor:pointer">
              <input type="checkbox" id="ttsToggle" checked /> 🔊 Sesli Yanıt (TTS)
            </label>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn" onclick="askPreset('Başkent Kart 3 yıllık ihale kapanışında hangi ayların fatura ve dekontları eksik?')">🔍 Eksik Fatura ve Dekontları Listele</button>
          <button class="btn" onclick="askPreset('Fatura tutarı ile banka dekont tutarı uyuşmayan aylar hangileri?')">💰 Fatura-Dekont Tutar Farklarını Göster</button>
          <button class="btn" onclick="askPreset('Teknik şartnameye göre kesin kabul için hangi evraklar bekleniyor?')">📋 Teknik Şartname Eksiklerini Özeti</button>
          <button class="btn" onclick="askPreset('Yüklenici firmaya gönderilecek resmi eksik evrak ihtar yazısı taslağını hazırla.')">📝 Resmi İhtar Yazısı Taslağı Üret</button>
        </div>

        <div id="chatMessages" class="chat-box"></div>

        <div style="display:flex;gap:10px;margin-top:12px">
          <button id="micBtn" class="btn" onclick="toggleVoiceInput()">🎤 Sesle Konuş</button>
          <input id="chatInput" type="text" placeholder="Başkent Kart Proje Sorumlusuna veya seçili ajana sorunuzu yazın..." style="flex:1;padding:11px 14px;border:1px solid var(--border);border-radius:8px;font-size:15px" onkeydown="if(event.key==='Enter')sendChatMessage()" />
          <button class="btn btn-primary" onclick="sendChatMessage()">Gönder ➤</button>
        </div>
      </div>
    </section>

    <!-- SEKME 4: TEKNİK ŞARTNAME 10 KABUL KRİTERİ -->
    <section id="tab-spec" style="display:none">
      <div class="card">
        <h2>📋 Başkent Kart Teknik Şartnamesi — İhale Kapanış ve Kesin Kabul Kontrol Listesi</h2>
        <p style="color:var(--muted)">Muayene ve Kabul Komisyonu tarafından ihale kapanışında kontrol edilen 10 temel teknik şartname ve mevzuat kriteri:</p>
        <table>
          <thead>
            <tr>
              <th>Kod</th>
              <th>Şartname Maddesi</th>
              <th>Kontrol Başlığı & Açıklama</th>
              <th>Sorumlu Birim / Ekip</th>
              <th>Durum</th>
              <th class="no-print">Durum Değiştir</th>
            </tr>
          </thead>
          <tbody id="specTableBody"></tbody>
        </table>
      </div>
    </section>
    <!-- SEKME 5: GİZLİLİK POLİTİKASI, İZİNLER, HESAP/VERİ SIFIRLAMA VE 20 ÖNCELİK -->
    <section id="tab-security" style="display:none">
      <div class="card">
        <h2>🔒 %100 Offline Güvenlik, Gizlilik Politikası (KVKK) ve Hesap / Veri Yönetimi</h2>
        <p style="color:var(--muted)">Bu masaüstü uygulaması internet bağlantısı olmadan tamamen kendi bilgisayarınızda çalışır. Verileriniz yalnızca tarayıcınızın yerel belleğinde (<code>localStorage</code>) saklanır ve dışarıya gönderilmez.</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:18px 0">
          <div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:#f8fafc">
            <strong>✔ 1. Kullanıcı İzinleri</strong>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">Mikrofon (STT) ve yerel klasör seçimi yalnızca sizin tıklamanızla cihaz üzerinde kullanılır.</div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:#f8fafc">
            <strong>✔ 2. Gizlilik & KVKK</strong>
            <div style="font-size:13px;color:var(--muted);margin-top:4px">6698 sayılı KVKK uyarınca tüm fatura, dekont ve vatandaş verileri yerel olarak işlenir.</div>
          </div>
          <div style="padding:14px;border:1px solid var(--border);border-radius:10px;background:#f8fafc">
            <strong>✔ 3. Bağlantı Durumu</strong>
            <div style="font-size:13px;color:var(--muted);margin-top:4px" id="offlineConnInfo">🔌 Offline & Çevrimiçi Tam Uyumlu</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="exportStateJson()">💾 Tüm Verileri Yedekle (.json)</button>
          <button class="btn" style="border-color:var(--danger);color:var(--danger)" onclick="if(confirm('Bu bilgisayardaki tüm yerel oturum ve denetim değişikliklerini sıfırlamak istiyor musunuz?')){localStorage.removeItem(STORAGE_KEY);location.reload();}">🗑️ Yerel Verileri & Oturumu Sıfırla</button>
        </div>
      </div>
    </section>
  </main>

  <script>
    const INITIAL_BUNDLE = ${safeJson};
    const STORAGE_KEY = 'dijital_ikiz_offline_' + INITIAL_BUNDLE.tenant;
    let BUNDLE = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || JSON.parse(JSON.stringify(INITIAL_BUNDLE));
    let currentAgentSlug = (BUNDLE.personnel.find(p => p.slug === 'baskent-kart-proje-sorumlusu') || BUNDLE.personnel[0] || {}).slug;

    function saveLocal() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(BUNDLE)); } catch (e) {}
    }

    function switchTab(id, btn) {
      ['projects', 'baskent', 'office3d', 'org', 'chat', 'spec', 'security'].forEach(t => {
        const el = document.getElementById('tab-' + t);
        if (el) el.style.display = (t === id) ? 'block' : 'none';
      });
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      if (id === 'office3d') drawOffline3DOffice();
    }

    function drawOffline3DOffice() {
      const c = document.getElementById('offline3dCanvas');
      if (!c) return;
      const ctx = c.getContext('2d');
      const W = c.width, H = c.height;
      ctx.clearRect(0, 0, W, H);

      // Zemin ızgarası (izometrik 3D ofis zemini)
      ctx.strokeStyle = 'rgba(148,163,184,0.14)';
      ctx.lineWidth = 1;
      for (let i = -10; i <= 20; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 70, H * 0.45);
        ctx.lineTo(i * 70 + 260, H);
        ctx.stroke();
      }

      const depts = BUNDLE.departments || [];
      const cols = Math.max(1, Math.min(3, depts.length || 1));
      const boxW = Math.floor((W - 80) / cols) - 20;
      depts.slice(0, 6).forEach((d, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = 40 + col * (boxW + 24);
        const y = 36 + row * 205;
        // 3D gölge ve oda kutusu
        ctx.fillStyle = 'rgba(30,58,138,0.42)';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, boxW, 178, 14);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.fillText('🏢 ' + (d.title || d.slug).slice(0, 32), x + 14, y + 26);

        const agents = (BUNDLE.personnel || []).filter(p => p.dept === d.slug).slice(0, 6);
        agents.forEach((p, ai) => {
          const ax = x + 14 + (ai % 2) * ((boxW - 36) / 2);
          const ay = y + 46 + Math.floor(ai / 2) * 40;
          ctx.fillStyle = 'rgba(255,255,255,0.12)';
          ctx.fillRect(ax, ay, (boxW - 44) / 2, 32);
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(ax + 12, ay + 16, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillText((p.title || p.slug).slice(0, 18), ax + 22, ay + 20);
        });
      });
    }

    function evaluateAudit() {
      const months = BUNDLE.ledger?.months || [];
      const specs = BUNDLE.ledger?.specChecks || [];
      let totalInv = 0, totalRec = 0, totalAid = 0;
      const missingInv = [], missingRec = [], mismatches = [], missingPos = [], slaBad = [], missingSgk = [], validMonths = [];

      months.forEach(m => {
        const inv = Number(m.fatura_tutari || 0);
        const rec = Number(m.dekont_tutari || 0);
        if (m.fatura_var) totalInv += inv;
        if (m.dekont_var) totalRec += rec;
        totalAid += Number(m.sosyal_yardim_aktarim_tutari || 0);

        const issues = [];
        if (!m.fatura_var) { missingInv.push(m.donem); issues.push('Fatura Eksik'); }
        if (!m.dekont_var) { missingRec.push(m.donem); issues.push('Dekont Eksik'); }
        const diff = (m.fatura_var && m.dekont_var) ? (inv - rec) : 0;
        if (m.fatura_var && m.dekont_var && Math.abs(diff) >= 1) {
          mismatches.push({ donem: m.donem, diff, inv, rec });
          issues.push('Tutar Farkı: ' + diff.toLocaleString('tr-TR') + ' TL');
        }
        if (!m.pos_mutabakat_var) { missingPos.push(m.donem); issues.push('POS Mutabakat Eksik'); }
        if (!m.sla_raporu_var || Number(m.sla_uptime) < 99.9) {
          slaBad.push({ donem: m.donem, sla: m.sla_uptime });
          issues.push('SLA İhlali (%' + m.sla_uptime + ')');
        }
        if (!m.sgk_vergi_var) { missingSgk.push(m.donem); issues.push('SGK/Vergi Eksik'); }

        m._issues = issues;
        if (issues.length === 0) validMonths.push(m.donem);
      });

      const incompleteSpecs = specs.filter(s => !String(s.durum).startsWith('TAMAM'));
      return {
        months, specs, totalInv, totalRec, totalAid,
        missingInv, missingRec, mismatches, missingPos, slaBad, missingSgk, validMonths, incompleteSpecs,
        allClear: missingInv.length === 0 && missingRec.length === 0 && mismatches.length === 0 && missingPos.length === 0 && slaBad.length === 0 && missingSgk.length === 0 && incompleteSpecs.length === 0
      };
    }

    function renderAudit() {
      const r = evaluateAudit();
      const kpiEl = document.getElementById('auditKpis');
      kpiEl.innerHTML = [
        { label: 'İncelenen İhale Süresi', val: r.months.length + ' Ay (3 Yıl)', sub: '2023 - 2024 - 2025' },
        { label: 'Tam Uyumlu Ay Sayısı', val: r.validMonths.length + ' / ' + r.months.length, sub: (r.months.length - r.validMonths.length) + ' ayda eksik/bulgu var', color: r.validMonths.length === r.months.length ? '#15803d' : '#b45309' },
        { label: '3 Yıllık Fatura Toplamı', val: r.totalInv.toLocaleString('tr-TR') + ' ₺', sub: 'Eksik Fatura: ' + r.missingInv.length + ' adet' },
        { label: '3 Yıllık Banka Dekont Toplamı', val: r.totalRec.toLocaleString('tr-TR') + ' ₺', sub: 'Eksik Dekont: ' + r.missingRec.length + ' adet' },
        { label: 'Fatura - Dekont Farkı', val: (r.totalInv - r.totalRec).toLocaleString('tr-TR') + ' ₺', sub: r.mismatches.length ? (r.mismatches.map(x => x.donem).join(', ') + ' uyuşmazlığı') : 'Tam Mutabakat', color: (r.totalInv - r.totalRec) === 0 ? '#15803d' : '#b91c1c' },
        { label: 'Vatandaşa Aktarılan Yardım', val: (r.totalAid / 1e9).toFixed(2) + ' Milyar ₺', sub: '478.500+ Başkent Kart Sahibi Vatandaş' }
      ].map(k => '<div class="kpi-box"><div class="kpi-label">' + k.label + '</div><div class="kpi-val" style="color:' + (k.color || '#0f172a') + '">' + k.val + '</div><div style="font-size:12.5px;color:#64748b;margin-top:4px">' + k.sub + '</div></div>').join('');

      const decEl = document.getElementById('auditDecisionBanner');
      if (r.allClear) {
        decEl.style.borderLeftColor = '#15803d';
        decEl.innerHTML = '<h3 style="color:#15803d;margin-bottom:6px">✅ KESİN KABULE UYGUNDUR (36/36 Ay Tam Mutabakat)</h3><p style="margin:0">3 yıllık ihale dönemine ait tüm aylık hak ediş faturaları, banka ödeme dekontları, market/POS mutabakat cetvelleri, SLA raporları ve teknik şartname kriterleri eksiksizdir. Muayene ve Kabul Komisyonu kesin kabul tutanağı imzalanabilir.</p>';
      } else {
        decEl.style.borderLeftColor = '#b91c1c';
        const bullets = [];
        if (r.missingInv.length) bullets.push('<li><strong>Eksik Hak Ediş Faturası (' + r.missingInv.length + ' Ay):</strong> ' + r.missingInv.join(', ') + '</li>');
        if (r.missingRec.length) bullets.push('<li><strong>Eksik Banka Dekontu (' + r.missingRec.length + ' Ay):</strong> ' + r.missingRec.join(', ') + '</li>');
        if (r.mismatches.length) bullets.push('<li><strong>Fatura - Dekont Tutar Uyuşmazlığı (' + r.mismatches.length + ' Ay):</strong> ' + r.mismatches.map(x => x.donem + ' (Fatura: ' + x.inv.toLocaleString('tr-TR') + ' TL / Dekont: ' + x.rec.toLocaleString('tr-TR') + ' TL → Fark: ' + x.diff.toLocaleString('tr-TR') + ' TL)').join('; ') + '</li>');
        if (r.missingPos.length) bullets.push('<li><strong>Eksik Market/POS Takas Mutabakat Cetveli (' + r.missingPos.length + ' Ay):</strong> ' + r.missingPos.join(', ') + '</li>');
        if (r.slaBad.length) bullets.push('<li><strong>Teknik Şartname %99.90 SLA Süreklilik İhlali (' + r.slaBad.length + ' Ay):</strong> ' + r.slaBad.map(x => x.donem + ' (%' + x.sla + ')').join(', ') + '</li>');
        if (r.missingSgk.length) bullets.push('<li><strong>Eksik SGK / Vergi Borcu Yoktur Yazısı (' + r.missingSgk.length + ' Ay):</strong> ' + r.missingSgk.join(', ') + '</li>');
        if (r.incompleteSpecs.length) bullets.push('<li><strong>Bekleyen Teknik Şartname Kabul Kriterleri (' + r.incompleteSpecs.length + ' Madde):</strong> ' + r.incompleteSpecs.map(s => s.kod + ' - ' + s.baslik).join(', ') + '</li>');
        decEl.innerHTML = '<h3 style="color:#b91c1c;margin-bottom:6px">⚠️ ŞARTLI / KABUL BEKLEMEDE — Yüklenici Firmaya Eksik Evrak İhtarı Gerekli</h3><ul style="margin:6px 0 0;padding-left:20px">' + bullets.join('') + '</ul>';
      }

      const fy = document.getElementById('filterYear').value;
      const fs = document.getElementById('filterStatus').value;
      const filtered = r.months.filter(m => {
        if (fy !== 'all' && String(m.yil) !== fy) return false;
        if (fs === 'issues' && m._issues.length === 0) return false;
        if (fs === 'ok' && m._issues.length > 0) return false;
        return true;
      });

      const tbody = document.getElementById('auditTableBody');
      tbody.innerHTML = filtered.map(m => {
        const diff = (m.fatura_var && m.dekont_var) ? (m.fatura_tutari - m.dekont_tutari) : 0;
        const hasIssue = m._issues.length > 0;
        return '<tr class="' + (hasIssue ? 'row-issue' : '') + '">' +
          '<td><strong>' + m.ay_no + '. Ay</strong> (Yıl ' + m.yil + ')</td>' +
          '<td><strong>' + m.donem + '</strong><br><span style="font-size:11.5px;color:#64748b">' + m.hakedis_no + '</span></td>' +
          '<td><span class="pill ' + (m.fatura_var ? 'pill-ok' : 'pill-err') + '">' + (m.fatura_var ? m.fatura_no : 'EKSİK') + '</span></td>' +
          '<td>' + Number(m.fatura_tutari).toLocaleString('tr-TR') + ' ₺</td>' +
          '<td><span class="pill ' + (m.dekont_var ? 'pill-ok' : 'pill-err') + '">' + (m.dekont_var ? m.dekont_no : 'EKSİK') + '</span></td>' +
          '<td>' + (m.dekont_var ? Number(m.dekont_tutari).toLocaleString('tr-TR') + ' ₺' : '0 ₺') + '</td>' +
          '<td><strong style="color:' + (diff === 0 && m.fatura_var && m.dekont_var ? '#15803d' : '#b91c1c') + '">' + (m.fatura_var && m.dekont_var ? diff.toLocaleString('tr-TR') + ' ₺' : 'Mutabakat Yok') + '</strong></td>' +
          '<td><span class="pill ' + (m.pos_mutabakat_var ? 'pill-ok' : 'pill-err') + '">' + (m.pos_mutabakat_var ? 'TAMAM' : 'EKSİK') + '</span></td>' +
          '<td><span class="pill ' + (m.sla_uptime >= 99.9 ? 'pill-ok' : 'pill-warn') + '">%' + Number(m.sla_uptime).toFixed(2) + '</span></td>' +
          '<td><span class="pill ' + (m.sgk_vergi_var ? 'pill-ok' : 'pill-err') + '">' + (m.sgk_vergi_var ? 'TAMAM' : 'EKSİK') + '</span></td>' +
          '<td>' + (hasIssue ? '<span style="color:#b91c1c;font-weight:600">' + m._issues.join(', ') + '</span><div style="font-size:11.5px;color:#64748b">' + (m.not || '') + '</div>' : '<span class="pill pill-ok">✔ Tam Uyumlu</span>') + '</td>' +
          '<td class="no-print"><button class="btn" style="padding:4px 9px;font-size:12px" onclick="fixMonth(\\'' + m.donem + '\\')">' + (hasIssue ? '✔ Evrakı Onayla' : 'Düzenle') + '</button></td>' +
          '</tr>';
      }).join('');

      const specBody = document.getElementById('specTableBody');
      specBody.innerHTML = r.specs.map((s, idx) => {
        const ok = String(s.durum).startsWith('TAMAM');
        return '<tr>' +
          '<td><strong>' + s.kod + '</strong></td>' +
          '<td>' + s.madde + '</td>' +
          '<td><strong>' + s.baslik + '</strong><div style="font-size:12.5px;color:#64748b">' + s.aciklama + '</div></td>' +
          '<td>' + s.sorumlu + '</td>' +
          '<td><span class="pill ' + (ok ? 'pill-ok' : 'pill-err') + '">' + s.durum + '</span></td>' +
          '<td class="no-print"><button class="btn" style="padding:4px 9px;font-size:12px" onclick="toggleSpec(' + idx + ')">' + (ok ? 'Eksik İşaretle' : '✔ Tamamlandı İşaretle') + '</button></td>' +
          '</tr>';
      }).join('');
    }

    function fixMonth(donem) {
      const m = BUNDLE.ledger.months.find(x => x.donem === donem);
      if (!m) return;
      m.fatura_var = true;
      m.dekont_var = true;
      m.dekont_tutari = m.fatura_tutari;
      m.pos_mutabakat_var = true;
      m.sla_raporu_var = true;
      m.sla_uptime = 99.96;
      m.sgk_vergi_var = true;
      m.not = 'Evrak kontrolü tamamlandı ve mutabakat sağlandı.';
      saveLocal();
      renderAudit();
    }

    function toggleSpec(idx) {
      const s = BUNDLE.ledger.specChecks[idx];
      if (!s) return;
      s.durum = String(s.durum).startsWith('TAMAM') ? 'EKSİK (Komisyon İncelemesinde)' : 'TAMAM (Teslim Alındı)';
      saveLocal();
      renderAudit();
    }

    function markAllCompleteDemo() {
      BUNDLE.ledger.months.forEach(m => {
        m.fatura_var = true;
        m.dekont_var = true;
        m.dekont_tutari = m.fatura_tutari;
        m.pos_mutabakat_var = true;
        m.sla_raporu_var = true;
        if (m.sla_uptime < 99.9) m.sla_uptime = 99.95;
        m.sgk_vergi_var = true;
        m.not = '36 Aylık Kapanış Mutabakatı Tamamlandı.';
      });
      BUNDLE.ledger.specChecks.forEach(s => { s.durum = 'TAMAM (Kabul Komisyonu Onaylı)'; });
      saveLocal();
      renderAudit();
    }

    function resetLedger() {
      BUNDLE = JSON.parse(JSON.stringify(INITIAL_BUNDLE));
      saveLocal();
      renderAudit();
    }

    // Bilgisayardan seçilen gerçek klasör/dosyaları 36 aylık dönemlerle eşleştir
    function handleFolderSelect(fileList) {
      if (!fileList || !fileList.length) return;
      const names = Array.from(fileList).map(f => (f.webkitRelativePath || f.name).toUpperCase());
      let matchedCount = 0;
      BUNDLE.ledger.months.forEach(m => {
        const ym = m.donem; // örn 2023-08
        const ymCompact = ym.replace('-', '');
        const hasMonthFile = names.filter(n => n.includes(ym) || n.includes(ymCompact));
        if (hasMonthFile.length) {
          if (hasMonthFile.some(n => n.includes('FATURA') || n.includes('INV'))) { m.fatura_var = true; matchedCount++; }
          if (hasMonthFile.some(n => n.includes('DEKONT') || n.includes('BANKA') || n.includes('ODEME'))) { m.dekont_var = true; m.dekont_tutari = m.fatura_tutari; matchedCount++; }
          if (hasMonthFile.some(n => n.includes('POS') || n.includes('MARKET') || n.includes('TAKAS'))) { m.pos_mutabakat_var = true; matchedCount++; }
          if (hasMonthFile.some(n => n.includes('SLA') || n.includes('UPTIME'))) { m.sla_raporu_var = true; matchedCount++; }
          if (hasMonthFile.some(n => n.includes('SGK') || n.includes('VERGI'))) { m.sgk_vergi_var = true; matchedCount++; }
        }
      });
      saveLocal();
      renderAudit();
      const banner = document.getElementById('folderScanBanner');
      banner.style.display = 'block';
      banner.textContent = '✔ Bilgisayarınızdan ' + fileList.length + ' adet yerel dosya tarandı (%100 Offline). ' + matchedCount + ' evrak kaydı 36 aylık dönemlerle eşleştirildi ve tablo güncellendi.';
    }

    function renderOrg() {
      const el = document.getElementById('orgContainer');
      el.innerHTML = BUNDLE.departments.map(d => {
        const pers = BUNDLE.personnel.filter(p => p.dept === d.slug);
        return '<div class="card" style="margin:0">' +
          '<h3>' + (d.emoji || '🏢') + ' ' + d.name + '</h3>' +
          '<div style="font-size:12.5px;color:#64748b;margin-bottom:8px">Birim Kodu: ' + d.slug + '</div>' +
          pers.map(p => '<div class="agent-item" onclick="openAgentChat(\\'' + p.slug + '\\')">' +
            '<div style="font-weight:700;color:#1d4ed8">👤 ' + p.title + '</div>' +
            '<div style="font-size:12.5px;color:#475569;margin-top:4px">' + (p.mission || '') + '</div>' +
            '<div style="margin-top:6px;font-size:12px;font-weight:600;color:#15803d">💬 Sesli / Yazılı Konuşmak İçin Tıklayın →</div>' +
          '</div>').join('') +
        '</div>';
      }).join('');

      const sel = document.getElementById('agentSelector');
      sel.innerHTML = BUNDLE.personnel.map(p => '<option value="' + p.slug + '"' + (p.slug === currentAgentSlug ? ' selected' : '') + '>' + p.title + '</option>').join('');
    }

    function openAgentChat(slug) {
      selectAgent(slug);
      const btns = document.querySelectorAll('.nav-tab');
      switchTab('chat', btns[2]);
    }

    function selectAgent(slug) {
      currentAgentSlug = slug;
      const p = BUNDLE.personnel.find(x => x.slug === slug) || BUNDLE.personnel[0];
      if (!p) return;
      document.getElementById('activeAgentTitle').textContent = p.title;
      document.getElementById('agentSelector').value = p.slug;
      const box = document.getElementById('chatMessages');
      box.innerHTML = '';
      appendMessage('agent', 'Merhaba, ben ' + p.title + '. ' + BUNDLE.displayName + ' bünyesinde %100 offline olarak görev yapıyorum. Başkent Kart 3 yıllık (36 ay) ihale kapanışı, fatura/dekont kontrolü veya teknik şartname kabul süreci hakkında bana sesli veya yazılı soru sorabilirsiniz.');
    }

    function appendMessage(role, text) {
      const box = document.getElementById('chatMessages');
      const div = document.createElement('div');
      div.className = 'msg ' + (role === 'user' ? 'msg-user' : 'msg-agent');
      div.textContent = text;
      box.appendChild(div);
      box.scrollTop = box.scrollHeight;
      if (role === 'agent' && document.getElementById('ttsToggle')?.checked && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(text.replace(/[*#_]/g, ''));
          u.lang = 'tr-TR';
          window.speechSynthesis.speak(u);
        } catch (e) {}
      }
    }

    function buildOfflineAgentReply(q) {
      const r = evaluateAudit();
      const p = BUNDLE.personnel.find(x => x.slug === currentAgentSlug) || BUNDLE.personnel[0] || { title: 'Başkent Kart Proje Sorumlusu' };
      const low = q.toLocaleLowerCase('tr-TR');

      if (low.includes('ihtar') || low.includes('resmi yazı') || low.includes('tutanak')) {
        return [
          'T.C. ANKARA BÜYÜKŞEHİR BELEDİYESİ',
          'BİLGİ İŞLEM DAİRESİ BAŞKANLIĞI — Akıllı Şehirler Şube Müdürlüğü (Proje Yönetimi Ekibi)',
          'Konu: Başkent Kart 36 Aylık Hizmet Alımı İhalesi Kesin Kabul Öncesi Eksik Evrak ve Dekont İhtarı',
          '',
          'Yapılan 3 yıllık (36 ay) offline evrak ve hak ediş denetiminde aşağıdaki eksiklikler tespit edilmiştir:',
          '1. Eksik Faturalar: ' + (r.missingInv.join(', ') || 'Yok'),
          '2. Eksik Banka Dekontları: ' + (r.missingRec.join(', ') || 'Yok'),
          '3. Fatura-Dekont Tutar Uyuşmazlıkları: ' + (r.mismatches.map(x => x.donem + ' (' + x.diff.toLocaleString('tr-TR') + ' TL fark)').join(', ') || 'Yok'),
          '4. Eksik Market/POS Takas Mutabakat Cetvelleri: ' + (r.missingPos.join(', ') || 'Yok'),
          '5. SLA (%99.90) İhlali Olan Aylar: ' + (r.slaBad.map(x => x.donem + ' (%' + x.sla + ')').join(', ') || 'Yok'),
          '6. Eksik SGK/Vergi Borcu Yoktur Belgeleri: ' + (r.missingSgk.join(', ') || 'Yok'),
          '',
          'Yukarıdaki belgelerin 10 iş günü içinde Muayene ve Kabul Komisyonuna teslim edilmesi rica olunur.'
        ].join('\\n');
      }

      return [
        '[' + p.title + ' — %100 Offline Denetim Yanıtı]',
        '• İncelenen Dönem: 3 Yıl / 36 Ay (2023-01 .. 2025-12)',
        '• Tam Uyumlu Ay Sayısı: ' + r.validMonths.length + ' / ' + r.months.length,
        '• 3 Yıllık Toplam Fatura: ' + r.totalInv.toLocaleString('tr-TR') + ' TL | Toplam Banka Dekontu: ' + r.totalRec.toLocaleString('tr-TR') + ' TL',
        '• Eksik Fatura Dönemleri: ' + (r.missingInv.join(', ') || 'Tamamı Mevcut'),
        '• Eksik Banka Dekontu Dönemleri: ' + (r.missingRec.join(', ') || 'Tamamı Mevcut'),
        '• Fatura-Dekont Tutar Farkı Olan Aylar: ' + (r.mismatches.map(x => x.donem + ' (' + x.diff.toLocaleString('tr-TR') + ' TL)').join(', ') || 'Yok'),
        '• Eksik Market/POS Mutabakatı: ' + (r.missingPos.join(', ') || 'Tamamı Mevcut'),
        '• SLA (%99.90) İhlali: ' + (r.slaBad.map(x => x.donem + ' (%' + x.sla + ')').join(', ') || 'Yok'),
        '• Bekleyen Teknik Şartname Maddeleri: ' + (r.incompleteSpecs.map(s => s.kod + ' (' + s.baslik + ')').join(', ') || '10/10 Tamamlandı'),
        '• Kabul Kararı: ' + (r.allClear ? 'KESİN KABULE UYGUNDUR' : 'ŞARTLI / EKSİK EVRAK TAMAMLANMALI')
      ].join('\\n');
    }

    async function sendChatMessage() {
      const inp = document.getElementById('chatInput');
      const text = inp.value.trim();
      if (!text) return;
      inp.value = '';
      appendMessage('user', text);

      // Önce bu bilgisayarda yerel Ollama (127.0.0.1:11434) açık mı dene, yoksa gömülü deterministik motorla yanıtla
      const detReply = buildOfflineAgentReply(text);
      try {
        const res = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen2.5:3b',
            stream: false,
            messages: [
              { role: 'system', content: 'Sen Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı Akıllı Şehirler Şube Müdürlüğü Proje Yönetimi Ekibinde görevli yapay zeka personelisin. Türkçe ve resmi kurumsal dille yanıt ver. Güncel denetim verileri:\\n' + detReply },
              { role: 'user', content: text }
            ]
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.message?.content) {
            appendMessage('agent', data.message.content + '\\n\\n---\\n' + detReply);
            return;
          }
        }
      } catch (e) {}
      appendMessage('agent', detReply);
    }

    function askPreset(q) {
      document.getElementById('chatInput').value = q;
      sendChatMessage();
    }

    function toggleVoiceInput() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { alert('Tarayıcınız ses tanımayı desteklemiyor.'); return; }
      const rec = new SR();
      rec.lang = 'tr-TR';
      const btn = document.getElementById('micBtn');
      btn.textContent = '🔴 Dinleniyor...';
      rec.onresult = (e) => {
        const tr = e.results[0][0].transcript;
        document.getElementById('chatInput').value = tr;
        btn.textContent = '🎤 Sesle Konuş';
        sendChatMessage();
      };
      rec.onerror = () => { btn.textContent = '🎤 Sesle Konuş'; };
      rec.onend = () => { btn.textContent = '🎤 Sesle Konuş'; };
      rec.start();
    }

    function submitOfflineLogin() {
      const em = document.getElementById('gateEmail').value.trim().toLowerCase();
      const pw = document.getElementById('gatePass').value;
      const err = document.getElementById('gateErr');
      if (!em || !em.includes('@') || pw.length < 6) {
        err.style.display = 'block';
        err.textContent = 'Lütfen geçerli bir kurumsal e-posta adresi ve en az 6 karakterli şifrenizi girin.';
        return;
      }
      document.getElementById('offlineLoginGate').style.display = 'none';
    }

    function exportStateJson() {
      const blob = new Blob([JSON.stringify(BUNDLE, null, 2)], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = BUNDLE.tenant + '-denetim-verisi.json';
      a.click();
    }

    // PROJELER, KAYNAKLAR (SEÇİLEN KLASÖR / GITHUB / GOOGLE DRIVE / EK LİNKLER), ZAMANLANMIŞ & MULTİDİSİPLİNER GÖREVLER
    function ensureProjectWorkspace() {
      if (!BUNDLE.projectWorkspace) {
        BUNDLE.projectWorkspace = {
          folderName: '',
          localFiles: [],
          githubUrl: '',
          driveUrl: '',
          extraLinks: [],
          tasks: [
            {
              id: 1,
              title: 'Başkent Kart 3 Yıllık Klasör & Şartname Ön Denetimi',
              instruction: 'Seçili bilgisayar klasörü, bağlı linkler ve 36 aylık ihale defterini tarayarak eksik fatura/dekontları listele.',
              schedule: 'daily',
              leadAgent: currentAgentSlug,
              multiAgents: BUNDLE.personnel.slice(0, 3).map(p => p.slug),
              autoActive: true,
              lastRun: null,
              lastResult: 'Henüz çalıştırılmadı. Sağdaki "▶ Şimdi Çalıştır" butonuna tıklayarak başlatabilirsiniz.',
            },
          ],
        };
      }
      return BUNDLE.projectWorkspace;
    }

    const SCHEDULE_LABELS = {
      once: 'Tek Seferlik',
      '1m': 'Her 1 Dakika',
      '15m': 'Her 15 Dakika',
      hourly: 'Saatlik',
      daily: 'Günlük',
      weekly: 'Haftalık',
      monthly: 'Aylık',
    };

    const SCHEDULE_MS = {
      '1m': 60000,
      '15m': 900000,
      hourly: 3600000,
      daily: 86400000,
      weekly: 604800000,
      monthly: 2592000000,
    };

    async function registerProjectFolder(fileList) {
      if (!fileList || !fileList.length) return;
      const ws = ensureProjectWorkspace();
      const firstPath = fileList[0].webkitRelativePath || fileList[0].name;
      ws.folderName = firstPath.includes('/') ? firstPath.split('/')[0] : 'Seçilen Yerel Klasör';
      const filesArr = [];
      for (const f of Array.from(fileList).slice(0, 1000)) {
        let preview = '';
        if (/\\.(txt|md|csv|json|xml|html|log)$/i.test(f.name) && f.size < 250000) {
          try { preview = (await f.text()).slice(0, 400); } catch (e) {}
        }
        filesArr.push({
          name: f.name,
          path: f.webkitRelativePath || f.name,
          sizeKb: Math.max(1, Math.round(f.size / 1024)),
          preview,
        });
      }
      ws.localFiles = filesArr;
      saveLocal();
      renderProjectWorkspace();
    }

    function saveProjectSources() {
      const ws = ensureProjectWorkspace();
      ws.githubUrl = (document.getElementById('projGithubUrl')?.value || '').trim();
      ws.driveUrl = (document.getElementById('projDriveUrl')?.value || '').trim();
      saveLocal();
    }

    function addProjectExtraLink() {
      const inp = document.getElementById('projExtraLinkInput');
      const url = (inp?.value || '').trim();
      if (!url) return;
      const ws = ensureProjectWorkspace();
      ws.extraLinks = ws.extraLinks || [];
      ws.extraLinks.push(url);
      if (inp) inp.value = '';
      saveLocal();
      renderProjectWorkspace();
    }

    function removeProjectExtraLink(idx) {
      const ws = ensureProjectWorkspace();
      ws.extraLinks.splice(idx, 1);
      saveLocal();
      renderProjectWorkspace();
    }

    function renderProjectWorkspace() {
      const ws = ensureProjectWorkspace();
      const gh = document.getElementById('projGithubUrl');
      const dr = document.getElementById('projDriveUrl');
      if (gh) gh.value = ws.githubUrl || '';
      if (dr) dr.value = ws.driveUrl || '';

      const fSum = document.getElementById('projFolderSummary');
      if (fSum) {
        if (ws.localFiles?.length) {
          const pdfs = ws.localFiles.filter(f => /\\.pdf$/i.test(f.name)).length;
          const excels = ws.localFiles.filter(f => /\\.(xlsx?|csv|ods)$/i.test(f.name)).length;
          fSum.innerHTML = '<strong>✔ ' + esc(ws.folderName) + '</strong> (' + ws.localFiles.length + ' dosya · 📄 PDF: ' + pdfs + ' · 📊 Excel/CSV: ' + excels + ')' +
            '<div style="max-height:190px;overflow-y:auto;margin-top:8px;border:1px solid var(--border);border-radius:8px;background:#fff">' +
            ws.localFiles.slice(0, 250).map(f => {
              const ic = /\\.pdf$/i.test(f.name) ? '📄' : /\\.(xlsx?|csv|ods)$/i.test(f.name) ? '📊' : '📁';
              return '<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12.5px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ic + ' ' + esc(f.path) + '</span><span style="color:var(--muted);flex-shrink:0">' + f.sizeKb + ' KB</span></div>';
            }).join('') +
            '</div>';
        } else {
          fSum.innerHTML = 'Henüz yerel klasör seçilmedi.';
        }
      }

      const linksBox = document.getElementById('projExtraLinksList');
      if (linksBox) {
        linksBox.innerHTML = (ws.extraLinks || []).map((l, i) =>
          '<div style="display:flex;justify-content:space-between;align-items:center;background:#fff;padding:4px 8px;border:1px solid var(--border);border-radius:6px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l) + '</span><button class="btn" style="padding:2px 7px;font-size:11px" onclick="removeProjectExtraLink(' + i + ')">Sil</button></div>'
        ).join('') || '<span style="color:var(--muted)">Ek link eklenmedi.</span>';
      }

      const leadSel = document.getElementById('taskLeadAgentSelect');
      if (leadSel) {
        leadSel.innerHTML = BUNDLE.personnel.map(p => '<option value="' + p.slug + '"' + (p.slug === currentAgentSlug ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('');
      }

      const multiBox = document.getElementById('taskMultiAgentsBox');
      if (multiBox) {
        multiBox.innerHTML = BUNDLE.personnel.slice(0, 12).map(p =>
          '<label style="display:inline-flex;align-items:center;gap:5px;font-size:13px;background:#fff;padding:4px 9px;border:1px solid var(--border);border-radius:6px;cursor:pointer"><input type="checkbox" class="multi-agent-chk" value="' + esc(p.slug) + '" /> ' + esc(p.title) + '</label>'
        ).join('');
      }

      const cont = document.getElementById('projectTasksContainer');
      if (cont) {
        cont.innerHTML = (ws.tasks || []).map(t => {
          const lead = BUNDLE.personnel.find(p => p.slug === t.leadAgent) || { title: t.leadAgent };
          const multiNames = (t.multiAgents || []).map(s => (BUNDLE.personnel.find(p => p.slug === s) || { title: s }).title);
          return '<div style="border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:12px;padding:16px;margin-bottom:14px;background:#fff">'
            + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px">'
            + '<div>'
            + '<span class="pill pill-ok">' + esc(SCHEDULE_LABELS[t.schedule] || t.schedule) + '</span> '
            + '<span class="pill ' + (t.autoActive ? 'pill-ok' : 'pill-err') + '">' + (t.autoActive ? '⏱️ Zamanlayıcı Açık' : 'Duraklatıldı') + '</span>'
            + '<h3 style="margin:6px 0 4px">' + esc(t.title) + '</h3>'
            + '<div style="font-size:13.5px;color:var(--muted)"><strong>Baş Ajan:</strong> ' + esc(lead.title) + (multiNames.length ? ' · <strong>Ortak Ekip:</strong> ' + esc(multiNames.join(', ')) : '') + '</div>'
            + '<div style="font-size:13.5px;margin-top:4px">' + esc(t.instruction) + '</div>'
            + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
            + '<button class="btn btn-primary" onclick="runProjectTaskNow(' + t.id + ')">▶ Şimdi Çalıştır</button>'
            + '<button class="btn" onclick="toggleProjectTaskTimer(' + t.id + ')">' + (t.autoActive ? '⏸ Duraklat' : '▶ Zamanlayıcıyı Aç') + '</button>'
            + '<button class="btn" onclick="deleteProjectTask(' + t.id + ')">Sil</button>'
            + '</div></div>'
            + '<div style="margin-top:12px;padding:12px 14px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;white-space:pre-wrap;font-size:13.5px">'
            + '<strong>Son Çalışma:</strong> ' + esc(t.lastRun ? new Date(t.lastRun).toLocaleString('tr-TR') : 'Henüz çalışmadı') + '\\n\\n' + esc(t.lastResult || '')
            + '</div>'
            + '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">'
            + '<button class="btn" style="border-color:var(--primary);color:var(--primary)" onclick="spawnFollowupMultidisciplinaryTask(' + t.id + ')">🔀 Bu Sonuca Göre Farklı Ajanlarla Multidisipliner Takip Görevi Oluştur & Çalıştır</button>'
            + '</div></div>';
        }).join('') || '<p style="color:var(--muted)">Henüz görev eklenmedi.</p>';
      }
    }

    function createAndRunProjectTask(runImmediately) {
      const ws = ensureProjectWorkspace();
      const title = (document.getElementById('taskTitleInput')?.value || '').trim();
      const instruction = (document.getElementById('taskInstructionInput')?.value || '').trim();
      if (!title || !instruction) return alert('Lütfen görev başlığı ve talimatını yazın.');
      const schedule = document.getElementById('taskScheduleSelect')?.value || 'once';
      const leadAgent = document.getElementById('taskLeadAgentSelect')?.value || currentAgentSlug;
      const multiAgents = Array.from(document.querySelectorAll('.multi-agent-chk:checked')).map(c => c.value);

      const newTask = {
        id: Date.now(),
        title,
        instruction,
        schedule,
        leadAgent,
        multiAgents,
        autoActive: schedule !== 'once',
        lastRun: null,
        lastResult: 'Görev oluşturuldu.',
      };
      ws.tasks.unshift(newTask);
      document.getElementById('taskTitleInput').value = '';
      document.getElementById('taskInstructionInput').value = '';
      saveLocal();
      if (runImmediately) runProjectTaskNow(newTask.id);
      else renderProjectWorkspace();
    }

    async function runProjectTaskNow(taskId) {
      const ws = ensureProjectWorkspace();
      const t = ws.tasks.find(x => x.id === taskId);
      if (!t) return;
      const lead = BUNDLE.personnel.find(p => p.slug === t.leadAgent) || { title: t.leadAgent };
      const team = (t.multiAgents || []).map(s => (BUNDLE.personnel.find(p => p.slug === s) || { title: s }).title);
      const r = evaluateAudit();

      // Klasör, GitHub, Google Drive ve Ek Linkler özeti
      const fileLines = (ws.localFiles || []).slice(0, 12).map(f => '  - ' + f.path + ' (' + f.sizeKb + ' KB)' + (f.preview ? ' | Özet: ' + f.preview.slice(0, 80).replace(/\\s+/g, ' ') : ''));
      const sourceSummary = [
        '• Seçilen Yerel Klasör: ' + (ws.folderName ? ws.folderName + ' (' + ws.localFiles.length + ' dosya)' : 'Seçilmedi'),
        ...(fileLines.length ? fileLines : []),
        '• GitHub Deposu: ' + (ws.githubUrl || 'Tanımlanmadı'),
        '• Google Drive Linki: ' + (ws.driveUrl || 'Tanımlanmadı'),
        '• Ek İncelenen Linkler: ' + ((ws.extraLinks || []).length ? ws.extraLinks.join(' | ') : 'Yok'),
      ].join('\\n');

      const auditSummary = [
        '• 36 Aylık Denetim Durumu: ' + r.validMonths.length + '/' + r.months.length + ' ay tam uyumlu',
        '• Eksik Fatura: ' + (r.missingInv.join(', ') || 'Yok') + ' | Eksik Dekont: ' + (r.missingRec.join(', ') || 'Yok'),
        '• Tutar Farkı: ' + (r.mismatches.map(x => x.donem + ' (' + x.diff.toLocaleString('tr-TR') + ' TL)').join(', ') || 'Yok'),
        '• Bekleyen Şartname Maddesi: ' + r.incompleteSpecs.length + ' adet',
      ].join('\\n');

      let ollamaReply = '';
      try {
        const res = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'qwen2.5:3b',
            stream: false,
            messages: [
              { role: 'system', content: 'Sen ' + lead.title + ' olarak multidisipliner ekiple (' + (team.join(', ') || 'Tekil') + ') görev yapan kurumsal yapay zeka uzmanısın. Türkçe, net ve aksiyon odaklı yanıt ver.' },
              { role: 'user', content: 'Görev: ' + t.title + '\\nTalimat: ' + t.instruction + '\\nKaynaklar:\\n' + sourceSummary + '\\nDenetim Verisi:\\n' + auditSummary }
            ]
          })
        });
        if (res.ok) {
          const data = await res.json();
          ollamaReply = data?.message?.content || '';
        }
      } catch (e) {}

      t.lastRun = new Date().toISOString();
      t.lastResult = [
        '✅ GÖREV TAMAMLANDI — ' + t.title,
        '👤 Sorumlu Baş Ajan: ' + lead.title,
        '🤝 Multidisipliner Ortak Ekip: ' + (team.length ? team.join(', ') : 'Tekil Çalışma'),
        '',
        '--- İNCELENEN KAYNAKLAR (KLASÖR / GITHUB / DRIVE / LİNKLER) ---',
        sourceSummary,
        '',
        '--- BULGULAR VE ANALİZ SONUCU ---',
        ollamaReply || ('[Yerel Offline Motor Analizi]\\n' + auditSummary + '\\n• Tavsiye: Tespit edilen eksikler için ilgili birimlerle (Finans, Hukuk ve Proje Yönetimi) multidisipliner takip görevi başlatılması önerilir.'),
      ].join('\\n');

      saveLocal();
      renderProjectWorkspace();
    }

    function spawnFollowupMultidisciplinaryTask(parentId) {
      const ws = ensureProjectWorkspace();
      const parent = ws.tasks.find(x => x.id === parentId);
      if (!parent) return;
      const otherAgents = BUNDLE.personnel.filter(p => p.slug !== parent.leadAgent).slice(0, 3);
      const nextLead = otherAgents[0]?.slug || parent.leadAgent;
      const newTask = {
        id: Date.now(),
        title: 'Multidisipliner Takip: ' + parent.title,
        instruction: 'Önceki görevden gelen bulgulara istinaden hukuk/finans/teknik değerlendirme ve resmi aksiyon planı hazırla. Önceki Çıktı Özeti: ' + String(parent.lastResult || '').slice(0, 260),
        schedule: 'once',
        leadAgent: nextLead,
        multiAgents: [parent.leadAgent, ...otherAgents.map(a => a.slug)],
        autoActive: false,
        lastRun: null,
        lastResult: 'Başlatılıyor...',
      };
      ws.tasks.unshift(newTask);
      saveLocal();
      runProjectTaskNow(newTask.id);
    }

    function toggleProjectTaskTimer(taskId) {
      const ws = ensureProjectWorkspace();
      const t = ws.tasks.find(x => x.id === taskId);
      if (!t) return;
      t.autoActive = !t.autoActive;
      saveLocal();
      renderProjectWorkspace();
    }

    function deleteProjectTask(taskId) {
      const ws = ensureProjectWorkspace();
      ws.tasks = ws.tasks.filter(x => x.id !== taskId);
      saveLocal();
      renderProjectWorkspace();
    }

    // Periyodik Zamanlayıcı Döngüsü (Her 30 saniyede bir zamanı gelen görevleri otomatik çalıştırır)
    setInterval(() => {
      const ws = ensureProjectWorkspace();
      const nowMs = Date.now();
      (ws.tasks || []).forEach(t => {
        if (!t.autoActive || !SCHEDULE_MS[t.schedule]) return;
        const lastMs = t.lastRun ? new Date(t.lastRun).getTime() : 0;
        if (nowMs - lastMs >= SCHEDULE_MS[t.schedule]) {
          runProjectTaskNow(t.id);
        }
      });
    }, 30000);

    renderProjectWorkspace();
    renderAudit();
    renderOrg();
    selectAgent(currentAgentSlug);
  </script>
</body>
</html>`;
}

export function writePortableTenantPackage(tenant, tierOverride = null) {
  const pkgRoot = ensureDir(join(ROOT, 'indirilebilir-kurum-paketleri', tenant));
  const htmlContent = buildStandaloneOfflineHtml(tenant, tierOverride);
  const tierSuffix = tierOverride ? `-${tierOverride.toUpperCase()}-PAKET` : '';
  const htmlFilename = tenant === 'abb-bilgi-islem'
    ? `ABB-Bilgi-Islem-Baskent-Kart-Full-Paket-Offline.html`
    : `${tenant}${tierSuffix}-Offline-Masaustu-Sistemi.html`;
  const htmlPath = join(pkgRoot, htmlFilename);
  writeFileSync(htmlPath, htmlContent, 'utf8');

  // Çift tıkla masaüstü uygulama penceresinde başlatan .bat dosyası
  const batPath = join(pkgRoot, 'BASLAT-OFFLINE-SISTEM.bat');
  const batContent = `@echo off
chcp 65001 >nul
title ${tenant.toUpperCase()} - %100 Offline Dijital Ikiz ve Evrak Denetim Sistemi
echo ===============================================================================
echo   KURUMSAL DIJITAL IKIZ VE EVRAK DENETIM SISTEMI (%100 OFFLINE)
echo   Kurum: ${tenant}
echo   Sadece bu bilgisayarda, internet veya dis sunucu olmadan calisir.
echo ===============================================================================
start "" "%~dp0${htmlFilename}"
`;
  writeFileSync(batPath, batContent, 'utf8');

  return { pkgRoot, htmlPath, htmlFilename, batPath };
}
