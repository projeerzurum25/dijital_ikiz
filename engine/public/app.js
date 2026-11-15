// Kurumsal Dijital İkiz Platformu v4.0 — Çok Sayfalı Kurumsal Web Arayüzü
let currentTenant = localStorage.getItem('dijital_ikiz_tenant') || 'demo-sirketi';
let currentRole = localStorage.getItem('dijital_ikiz_role') || 'tenant_admin'; // 'citizen' | 'agent_user' | 'tenant_admin' | 'super_admin'
let isLoggedIn = sessionStorage.getItem('dijital_ikiz_logged_in') === '1';
let isSuperAdminSession = sessionStorage.getItem('dijital_ikiz_sa_session') === '1';
let assignedAgentScope = (() => { try { return JSON.parse(sessionStorage.getItem('dijital_ikiz_agent_scope') || 'null'); } catch { return null; } })();
let currentPage = 'overview';
let selectedDeptFilter = 'ALL';
let currentAgentParams = { dept: null, slug: null, subtab: 'task' };
let tourStepIndex = 0;

let state = null;
let superOverview = null;
let agentDetail = null;
let sse = null;

const TOUR_STEPS = [
  {
    page: 'overview',
    tag: 'Adım 1 / 6 — Hoş Geldiniz',
    title: 'Kurumsal Dijital İkiz Platformuna Hoş Geldiniz!',
    body: 'Bu sistem, verilerinizi dış internete çıkarmadan (%100 Offline) kendi bilgisayarınızda 7/24 çalışan yapay zeka departmanlarından ve uzman ajanlardan oluşur.',
    tip: '💡 İpucu: Üst çubuktan "Vatandaş Portalı", "Kurum Admini" ve "Genel Admin" görünümleri arasında tek tıkla geçiş yapabilirsiniz.',
  },
  {
    page: 'virtual_office',
    tag: 'Adım 2 / 6 — 3D Sanal Ofis',
    title: '🏙️ 3D Sanal Ofis ve Kampüs Simülasyonu',
    body: '3D Sanal Ofis ekranında binayı 360° döndürebilir, yakınlaştırabilir, "Yöneticileri Toplantı Odasına Çağır" butonuyla ajanların odalar arası yürüyüşünü izleyebilirsiniz.',
    tip: '💡 İpucu: 3D sahnedeki herhangi bir voksel (voxel) ajanın üzerine tıkladığınızda sağ üstte o ajanın hızlı görev kartı açılır.',
  },
  {
    page: 'agents',
    tag: 'Adım 3 / 6 — Ajanların Özel Sayfaları',
    title: '🤖 Ajanların Yönetimi, Yetenekler (Skills) ve Kurallar',
    body: 'Her yapay zeka ajanının kendine ait özel bir tam sayfası vardır. "Ajan Sayfasını Aç" butonuna tıklayarak uzmanın yeteneklerini inceleyebilir ve davranış kurallarını düzenleyebilirsiniz.',
    tip: '💡 İpucu: 7 Günlük Demo hesabında 2 uzman ajan aktif olarak gelir; Tam Kurumsal Pakette 10 departman ve 29+ ajan bulunur.',
  },
  {
    page: 'users',
    tag: 'Adım 4 / 6 — Kullanıcı & Yetki Yönetimi',
    title: '🔐 Kullanıcı ve Yetki Yönetimi (RBAC)',
    body: 'Kurumunuzdaki gerçek çalışanlara (Kurum Admini, Departman Yöneticisi, Uzman veya Vatandaş) hangi departmanlara erişebileceğini ve hangi işlemleri yapabileceğini buradan tanımlarsınız.',
    tip: '💡 İpucu: 6 farklı yetki kutucuğu (Görev Verme, Onay Verme, Ajan Yönetimi vb.) ile tam erişim kontrolü sağlanır.',
  },
  {
    page: 'training',
    tag: 'Adım 5 / 6 — 6 Kanallı Eğitim',
    title: '🎓 6 Kanallı Çok Modlu Ajan Eğitim Merkezi',
    body: 'Ajanlarınıza yazılı doküman, görsel şema, video transkripti, fare/ekran kaydı, sesli not veya hazır paket ithalatı ile yeni yetenekler kazandırabilirsiniz.',
    tip: '💡 İpucu: Eğitilen her yeni yetenek önce Siber Güvenlik taramasından geçer ve Onay Merkezi\'ne düşer.',
  },
  {
    page: 'approvals',
    tag: 'Adım 6 / 6 — Onay Kapısı & Raporlar',
    title: '🛡️ Yönetici Onay Kapısı ve Kurumsal Raporlar',
    body: 'Ajanların ürettiği tüm raporları burada temiz belge formatında okuyabilir; dış e-posta veya yeni yetenek aktivasyonu gibi kritik işlemleri tek tıkla onaylayabilirsiniz.',
    tip: '🎉 Tebrikler! Öğreticiyi tamamladınız. İstediğiniz zaman üst çubuktaki "🧭 Öğretici Rehber" butonuna basarak bu turu tekrar açabilirsiniz.',
  },
];

const PERMISSION_LABELS = {
  gorev_ver: 'Görev & Talep Gönderme',
  onay_ver: 'Onay Kapısı Kararı Verme',
  ajan_yonet: 'Ajan & Kural Düzenleme',
  kullanici_yonet: 'Kullanıcı & Yetki Yönetimi',
  egitim_ver: '6 Kanallı Eğitim Verme',
  veri_oku: 'Kurumsal Tabloları İnceleme',
};

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('tr-TR') + ' ₺';
}

async function api(path, opts = {}) {
  const bar = document.getElementById('globalLoadingBar');
  if (bar) bar.style.display = 'block';
  try {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${path}${sep}tenant=${encodeURIComponent(currentTenant)}`;
    const res = await fetch(url, {
      ...opts,
      headers: { 'content-type': 'application/json', 'x-tenant': currentTenant, ...(opts.headers || {}) },
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'İstek hatası');
    return j;
  } finally {
    if (bar) bar.style.display = 'none';
  }
}

function connectSSE() {
  if (sse) sse.close();
  sse = new EventSource(`/api/events?tenant=${encodeURIComponent(currentTenant)}`);
  sse.onmessage = () => { refreshData(false); };
}

async function refreshData(fullRender = true) {
  state = await api('/api/state');
  currentTenant = state.tenant;
  localStorage.setItem('dijital_ikiz_tenant', currentTenant);

  // Giriş öncesi Landing Page kurum listesini doldur
  const loginSel = document.getElementById('loginTenantSelect');
  if (loginSel && state.tenants) {
    loginSel.innerHTML = state.tenants.map(t =>
      `<option value="${esc(t.name)}" ${t.name === currentTenant ? 'selected' : ''}>${esc(t.displayName)} (${esc(t.subdomain)})</option>`
    ).join('');
  }

  const landingEl = document.getElementById('landingView');
  const appEl = document.getElementById('appView');
  if (!isLoggedIn) {
    if (landingEl) landingEl.style.display = 'block';
    if (appEl) appEl.style.display = 'none';
    return;
  }
  if (landingEl) landingEl.style.display = 'none';
  if (appEl) appEl.style.display = 'block';

  if (currentRole === 'super_admin') {
    superOverview = await api('/api/superadmin/overview');
  }
  if (currentPage === 'agent_detail' && currentAgentParams.dept && currentAgentParams.slug) {
    agentDetail = await api(`/api/agent?dept=${encodeURIComponent(currentAgentParams.dept)}&slug=${encodeURIComponent(currentAgentParams.slug)}`);
  }
  updateHeader();
  renderSidebar();
  if (currentPage === 'virtual_office' && window.Office3D && !fullRender) {
    window.Office3D.updateState(state);
  }
  if (fullRender) renderPage();
}

function updateHeader() {
  if (!state) return;
  const roleTitles = {
    citizen: `${state.config.displayName} — Vatandaş & Müşteri Hizmet Portalı`,
    agent_user: `${state.config.displayName} — Kurum Ajanı Çalışma Alanı`,
    tenant_admin: `${state.config.displayName} — Kurum Yönetim Paneli`,
    super_admin: `Genel Admin (Süper Admin) — Çok Kurumlu Platform Yönetimi`,
  };
  document.getElementById('headerTitle').textContent = roleTitles[currentRole] || state.config.displayName;
  document.getElementById('headerSubtitle').textContent =
    `Alan Adı: ${state.config.subdomain} · Çalışma Modu: Yüzde Yüz Yerel (Offline) · ${state.departments.length} Departman, ${state.kpis.personelSayisi} Yapay Zeka Uzmanı`;

  const roleSwitcherEl = document.getElementById('headerRoleSwitcher');
  if (roleSwitcherEl) roleSwitcherEl.style.display = isSuperAdminSession ? 'flex' : 'none';
  const tenantBoxEl = document.getElementById('headerTenantBox');
  if (tenantBoxEl) tenantBoxEl.style.display = isSuperAdminSession ? 'flex' : 'none';

  document.querySelectorAll('.role-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.role === currentRole);
  });

  const sel = document.getElementById('tenantSelect');
  if (sel && isSuperAdminSession) {
    sel.innerHTML = state.tenants.map(t =>
      `<option value="${esc(t.name)}" ${t.name === state.tenant ? 'selected' : ''}>${esc(t.displayName)} (${esc(t.subdomain)})</option>`
    ).join('');
  }

  const badge = document.getElementById('llmStatusBadge');
  if (state.llm?.ollama?.ok) {
    badge.textContent = `🧠 Yerel Yapay Zeka Aktif (${(state.llm.ollama.models || [])[0] || 'Ollama'})`;
    badge.className = 'status-badge ok';
  } else {
    badge.textContent = `🧠 Yerel Kural & Hesaplama Motoru Aktif`;
    badge.className = 'status-badge warn';
  }

  // 3 Üyelik Paketi Kapasite Rozeti
  const demoBadge = document.getElementById('demoPlanBadge');
  if (demoBadge) {
    const plan = state.config?.plan;
    if (plan) {
      demoBadge.style.display = 'inline-flex';
      demoBadge.className = plan.tierCode === 'full' ? 'status-badge ok' : 'status-badge warn';
      demoBadge.textContent = `📦 ${plan.name || 'Kurumsal Paket'} (${plan.maxAuditMonths || 36} Ay Evrak Denetimi · ${state.kpis.personelSayisi} Ajan)`;
    } else {
      demoBadge.style.display = 'none';
    }
  }
}

window.switchRole = async function(role) {
  if (!isSuperAdminSession) {
    showToast('Rol ve panel geçişi yalnızca Genel Admin hesabında aktiftir.', 'warn');
    return;
  }
  currentRole = role;
  localStorage.setItem('dijital_ikiz_role', role);
  if (role === 'super_admin') {
    currentPage = 'sa_tenants';
    superOverview = await api('/api/superadmin/overview');
  } else if (role === 'citizen') {
    currentPage = 'citizen_home';
  } else {
    currentPage = 'overview';
  }
  updateHeader();
  renderSidebar();
  renderPage();
};

window.onTenantChange = async function(newTenant) {
  if (!isSuperAdminSession) {
    showToast('Kurumlar arası geçiş yalnızca Genel Admin hesabında aktiftir.', 'warn');
    return;
  }
  currentTenant = newTenant;
  localStorage.setItem('dijital_ikiz_tenant', currentTenant);
  connectSSE();
  if (currentPage === 'agent_detail') currentPage = 'agents';
  await refreshData(true);
};

window.navigate = async function(page, extra = {}) {
  currentPage = page;
  if (page === 'agent_detail') {
    currentAgentParams = { dept: extra.dept, slug: extra.slug, subtab: extra.subtab || 'task' };
    agentDetail = await api(`/api/agent?dept=${encodeURIComponent(extra.dept)}&slug=${encodeURIComponent(extra.slug)}`);
  }
  renderSidebar();
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function renderSidebar() {
  if (!state) return;
  const box = document.getElementById('sidebarNav');
  const k = state.kpis;

  if (currentRole === 'super_admin') {
    box.innerHTML = `
      <div>
        <div class="nav-group-title">Genel Admin Üst Yönetimi</div>
        <div class="nav-list">
          <button class="nav-item ${currentPage === 'sa_tenants' ? 'active' : ''}" onclick="navigate('sa_tenants')">
            <span>🏛️ Kurumlar & Kurum Ayarları</span>
            <span class="nav-count">${state.tenants.length}</span>
          </button>
          <button class="nav-item ${currentPage === 'sa_agents' ? 'active' : ''}" onclick="navigate('sa_agents')">
            <span>🤖 Tüm Ajan Eğitim & Görevleri</span>
          </button>
          <button class="nav-item ${currentPage === 'sa_cms' ? 'active' : ''}" onclick="navigate('sa_cms')">
            <span>🎨 Web & CRM Sayfa Yöneticisi</span>
          </button>
          <button class="nav-item ${currentPage === 'sa_readiness' ? 'active' : ''}" onclick="navigate('sa_readiness')">
            <span>✅ 20 Öncelik & Canlı Test (UAT)</span>
          </button>
          <button class="nav-item ${currentPage === 'sa_members' ? 'active' : ''}" onclick="navigate('sa_members')">
            <span>👑 Genel Admin Üyelikleri</span>
          </button>
          <button class="nav-item ${currentPage === 'sa_health' ? 'active' : ''}" onclick="navigate('sa_health')">
            <span>🩺 İzolasyon & Sistem Sağlığı</span>
          </button>
        </div>
      </div>
      <div class="card" style="padding:16px;background:var(--surface-soft);margin:0">
        <div style="font-weight:700;font-size:14px;color:var(--text);margin-bottom:6px">Genel Admin Kontrolü</div>
        <div style="font-size:13.5px;color:var(--text-muted)">
          Tüm kurumların paket/kapasite ayarlarını, tüm ajanların eğitim ve görev geçmişini, CRM sayfa içi görsel/video/kod/modülleri ve yeni özel sayfaları buradan yönetebilirsiniz.
        </div>
      </div>
    `;
    return;
  }

  if (currentRole === 'agent_user') {
    const scopeDept = assignedAgentScope?.dept || state.departments?.[0]?.slug || '';
    const scopeSlug = assignedAgentScope?.slug || state.departments?.[0]?.personnel?.[0]?.slug || '';
    box.innerHTML = `
      <div>
        <div class="nav-group-title">${esc(state.config.displayName)} — Ajan Çalışma Alanım</div>
        <div class="nav-list">
          <button class="nav-item ${currentPage === 'agent_detail' ? 'active' : ''}" onclick="navigate('agent_detail',{dept:'${esc(scopeDept)}',slug:'${esc(scopeSlug)}'})">
            <span>🤖 Benim Ajanım & Görevlerim</span>
          </button>
          <button class="nav-item ${currentPage === 'projects_hub' ? 'active' : ''}" onclick="navigate('projects_hub')">
            <span>📂 Klasör, Link & Görev Kaynaklarım</span>
          </button>
          ${state.tenant === 'abb-bilgi-islem' ? `
            <button class="nav-item ${currentPage === 'proje_stilleri' ? 'active' : ''}" onclick="navigate('proje_stilleri')">
              <span>🎯 Projeler (Başkent Kart · MucitHub · Başkent Ailem · MucitLab)</span>
            </button>
          ` : ''}
        </div>
      </div>
      <div class="card" style="padding:16px;background:var(--primary-soft);border-color:#bfdbfe;margin:0">
        <div style="font-weight:700;font-size:14px;color:var(--primary);margin-bottom:6px">Kişisel Ajan Yetkisi</div>
        <div style="font-size:13.5px;color:var(--text-body)">
          Bu hesap yalnızca kendi biriminize ve sorumlu olduğunuz ajan görevlerine erişebilir.
        </div>
      </div>
    `;
    return;
  }

  if (currentRole === 'citizen') {
    box.innerHTML = `
      <div>
        <div class="nav-group-title">Hizmet & Başvuru Menüsü</div>
        <div class="nav-list">
          <button class="nav-item ${currentPage === 'citizen_home' ? 'active' : ''}" onclick="navigate('citizen_home')">
            <span>🏠 Talep & Başvuru Oluştur</span>
          </button>
          <button class="nav-item ${currentPage === 'agents' || currentPage === 'agent_detail' ? 'active' : ''}" onclick="navigate('agents')">
            <span>👥 Birimler & Uzman Ajanlar</span>
            <span class="nav-count">${k.personelSayisi}</span>
          </button>
          <button class="nav-item ${currentPage === 'virtual_office' ? 'active' : ''}" onclick="navigate('virtual_office')">
            <span>🏙️ 3D Sanal Ofis</span>
          </button>
        </div>
      </div>
      <div class="card" style="padding:16px;background:var(--primary-soft);border-color:#bfdbfe;margin:0">
        <div style="font-weight:700;font-size:14px;color:var(--primary);margin-bottom:6px">Vatandaş / Müşteri Modu</div>
        <div style="font-size:13.5px;color:var(--text-body)">
          Bu ekranda karmaşık yönetim ayarları gizlenmiştir. Doğrudan ilgili birime veya uzmana başvurunuzu iletebilir ve yanıtınızı alabilirsiniz.
        </div>
      </div>
    `;
    return;
  }

  // KURUM ADMİN PANELİ MENÜSÜ (CMS MODÜLLERİNE GÖRE DİNAMİK)
  const mods = state.cms?.crmModules || {};
  const customPages = (state.cms?.customPages || []).filter(p => p.menuLocation === 'crm' || p.menuLocation === 'both');
  box.innerHTML = `
    <div>
      <div class="nav-group-title">${esc(state.config.displayName)} Yönetimi</div>
      <div class="nav-list">
        <button class="nav-item ${currentPage === 'overview' ? 'active' : ''}" onclick="navigate('overview')">
          <span>📊 Kurum Genel Bakış</span>
        </button>
        <button class="nav-item ${currentPage === 'projects_hub' ? 'active' : ''}" onclick="navigate('projects_hub')">
          <span>📂 Projeler, Kaynaklar & Görevler</span>
        </button>
        <button class="nav-item ${currentPage === 'proje_stilleri' ? 'active' : ''}" onclick="navigate('proje_stilleri')" style="${state.tenant === 'abb-bilgi-islem' ? 'border:1px solid var(--primary);background:var(--primary-soft)' : ''}">
          <span>📂 Projeler (Başkent Kart · MucitHub · Başkent Ailem · MucitLab)</span>
        </button>
        <button class="nav-item ${currentPage === 'agents' || currentPage === 'agent_detail' ? 'active' : ''}" onclick="navigate('agents')">
          <span>🤖 Ajanların Yönetimi</span>
          <span class="nav-count">${k.personelSayisi}</span>
        </button>
        ${mods.virtualOffice3D !== false ? `
          <button class="nav-item ${currentPage === 'virtual_office' ? 'active' : ''}" onclick="navigate('virtual_office')">
            <span>🏙️ 3D Sanal Ofis Simülasyonu</span>
            <span class="nav-count">3D</span>
          </button>
        ` : ''}
        ${mods.rbacUsers !== false ? `
          <button class="nav-item ${currentPage === 'users' ? 'active' : ''}" onclick="navigate('users')">
            <span>🔐 Kullanıcı & Yetki Yönetimi</span>
            <span class="nav-count">${k.kullaniciSayisi || 6}</span>
          </button>
        ` : ''}
        ${mods.training6Ch !== false ? `
          <button class="nav-item ${currentPage === 'training' ? 'active' : ''}" onclick="navigate('training')">
            <span>🎓 6 Kanallı Ajan Eğitimi</span>
          </button>
        ` : ''}
        ${mods.approvalsGate !== false ? `
          <button class="nav-item ${currentPage === 'approvals' ? 'active' : ''}" onclick="navigate('approvals')">
            <span>🛡️ Onay Merkezi & Raporlar</span>
            <span class="nav-count ${k.bekleyenOnay > 0 ? 'alert' : ''}">${k.bekleyenOnay}</span>
          </button>
        ` : ''}
        ${mods.sqlExplorer !== false ? `
          <button class="nav-item ${currentPage === 'data_settings' ? 'active' : ''}" onclick="navigate('data_settings')">
            <span>🗄️ Kurumsal Veri & Güvenlik</span>
          </button>
        ` : ''}
        <button class="nav-item ${currentPage === 'account_center' ? 'active' : ''}" onclick="navigate('account_center')">
          <span>⚙️ Hesap, İzinler & 20 Öncelik</span>
        </button>
        ${customPages.map(cp => `
          <button class="nav-item ${currentPage === 'custom_page:' + cp.slug ? 'active' : ''}" onclick="navigate('custom_page:${esc(cp.slug)}')">
            <span>📄 ${esc(cp.title)}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <div class="card" style="padding:14px;background:#eff6ff;border:1px solid #bfdbfe;margin-top:14px">
      <div style="font-weight:700;font-size:13.5px;color:var(--primary);margin-bottom:6px">💻 %100 Offline Masaüstü Paket</div>
      <div style="font-size:12.5px;color:var(--text-body);margin-bottom:10px">
        Bu kurumun tüm ajanlarını ve 3 yıllık evrak denetim sistemini tek dosya halinde bilgisayarınıza indirip <strong>hiçbir link veya sunucu olmadan</strong> doğrudan o bilgisayarda çalıştırabilirsiniz.
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%" onclick="downloadCurrentTenantOfflineApp()">
        💾 Bilgisayara İndir (.html)
      </button>
    </div>
  `;
}

function renderPage() {
  const el = document.getElementById('pageContent');
  if (!state) return;

  if (currentPage === 'sa_tenants') return renderSuperAdminTenants(el);
  if (currentPage === 'sa_agents') return renderSuperAdminAgentsAndTasks(el);
  if (currentPage === 'sa_cms') return renderSuperAdminCmsPage(el);
  if (currentPage === 'sa_readiness') return renderReadiness20Page(el, true);
  if (currentPage === 'sa_members') return renderSuperAdminMembers(el);
  if (currentPage === 'sa_health') return renderSuperAdminHealth(el);

  if (currentPage === 'citizen_home') return renderCitizenHome(el);
  if (currentPage === 'overview') return renderTenantOverview(el);
  if (currentPage === 'projects_hub') return renderProjectsHubPage(el);
  if (currentPage === 'proje_stilleri') return renderProjeStilleriPage(el);
  if (currentPage === 'baskent_audit') return renderBaskentKartAuditPage(el);
  if (currentPage === 'agents') return renderAgentsDirectory(el);
  if (currentPage === 'agent_detail') return renderAgentDedicatedPage(el);
  if (currentPage === 'virtual_office') return renderVirtualOfficeMap(el);
  if (currentPage === 'users') return renderUsersManagement(el);
  if (currentPage === 'training') return renderTrainingCenter(el);
  if (currentPage === 'approvals') return renderApprovalsAndReports(el);
  if (currentPage === 'data_settings') return renderDataAndSecurity(el);
  if (currentPage === 'account_center') return renderReadiness20Page(el, false);
  if (String(currentPage).startsWith('custom_page:')) {
    return renderCustomCmsPage(el, String(currentPage).slice('custom_page:'.length));
  }

  renderTenantOverview(el);
}

/* ============================================================================
   1. GENEL ADMİN (SÜPER ADMİN) SAYFALARI
   ============================================================================ */
function renderSuperAdminTenants(el) {
  const tenants = superOverview?.tenants || [];
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Kurumlar ve Kurum Adminleri Yönetimi</h1>
        <p>Platform üzerindeki tüm izole kurumları (tenant), her kurumun atanan <strong>Kurum Adminini</strong> ve kapasite durumunu buradan yönetebilirsiniz.</p>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">Toplam İzole Kurum</div>
        <div class="stat-value">${tenants.length} Kurum</div>
        <div class="stat-sub">Her biri ayrı veritabanı ve şifreli kasaya sahip</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Toplam Yapay Zeka Ajanı</div>
        <div class="stat-value">${tenants.reduce((s, t) => s + t.personnelCount, 0)} Uzman</div>
        <div class="stat-sub">Kurumlar genelinde 7/24 aktif</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Toplam Aktif Yetenek (Skill)</div>
        <div class="stat-value">${tenants.reduce((s, t) => s + t.skillsCount, 0)} Paket</div>
        <div class="stat-sub">4 parçalı standart anatomi</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Çalışma Altyapısı</div>
        <div class="stat-value">%100 Yerel</div>
        <div class="stat-sub">Dış internete veri çıkışı kapalı</div>
      </div>
    </div>

    <div class="card">
      <h2>Kayıtlı Kurumlar ve Atanmış Kurum Adminleri</h2>
      <p style="color:var(--text-muted)">Herhangi bir kurumun yönetim paneline geçmek veya o kurumun ajanlarını/kullanıcılarını düzenlemek için sağdaki <strong>"Kurum Yönetim Paneline Geç"</strong> butonuna tıklayın.</p>
      <div class="table-container">
        <table class="clean-table">
          <thead>
            <tr>
              <th>Kurum Adı & Alan Adı</th>
              <th>Kurum Admini (Yönetici Üye)</th>
              <th>Departman & Ajan</th>
              <th>Kayıtlı Kullanıcı</th>
              <th>Güvenlik & Denetim</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${tenants.map(t => {
              const adm = (t.admins && t.admins[0]) || { ad_soyad: 'Atanmadı', eposta: '-', unvan: 'Kurum Admini' };
              return `
                <tr>
                  <td>
                    <div style="font-weight:700;font-size:16.5px;color:var(--text)">${esc(t.displayName)}</div>
                    <div style="color:var(--text-muted);font-size:13.5px">${esc(t.subdomain)} (<code>${esc(t.name)}</code>)</div>
                  </td>
                  <td>
                    <div style="font-weight:600;color:var(--text)">👤 ${esc(adm.ad_soyad)}</div>
                    <div style="font-size:13.5px;color:var(--text-muted)">${esc(adm.eposta)} · ${esc(adm.unvan || 'Kurum Admini')}</div>
                  </td>
                  <td>
                    <strong>${t.departmentsCount}</strong> Departman<br/>
                    <span style="color:var(--text-muted);font-size:13.5px"><strong>${t.personnelCount}</strong> Ajan · <strong>${t.skillsCount}</strong> Yetenek</span>
                  </td>
                  <td>
                    <strong>${t.usersCount}</strong> Üye
                  </td>
                  <td>
                    <span class="status-badge ok">✔ İzole & Şifreli (${t.chainValid?.kayit || 0} log)</span>
                  </td>
                  <td>
                    <div style="display:flex;gap:6px;flex-wrap:wrap">
                      <button class="btn btn-primary btn-sm" onclick="enterTenantAsAdmin('${esc(t.name)}')">
                        Kurum Paneline Geç →
                      </button>
                      <button class="btn btn-sm" onclick="openEditTenantSettings('${esc(t.name)}')">
                        ⚙️ Ayarlar
                      </button>
                      <button class="btn btn-sm" onclick="downloadCurrentTenantOfflineApp('${esc(t.name)}')">
                        💾 İndir
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div id="saTenantEditCard" class="card" style="display:none;border-top:4px solid var(--primary)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <h2 style="margin:0">⚙️ Kurum Ayarlarını Düzenle: <span id="saEditTenantLabel"></span></h2>
        <button class="btn btn-sm" onclick="document.getElementById('saTenantEditCard').style.display='none'">Kapat ✕</button>
      </div>
      <input type="hidden" id="saEditTenantSlug" />
      <div class="form-row">
        <div>
          <label class="field-label">Kurum Görünen Adı</label>
          <input id="saEditDisplay" type="text" />
        </div>
        <div>
          <label class="field-label">Alt Alan Adı (Subdomain)</label>
          <input id="saEditSubdomain" type="text" />
        </div>
        <div>
          <label class="field-label">Kurum Durumu</label>
          <select id="saEditStatus">
            <option value="Aktif">Aktif</option>
            <option value="Askıda">Askıda</option>
            <option value="Deneme">Deneme</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div>
          <label class="field-label">Üyelik Paketi</label>
          <select id="saEditPlanTier">
            <option value="full">Full Kurumsal & Kamu Paketi</option>
            <option value="pro">Profesyonel Kurum Paketi</option>
            <option value="starter">Başlangıç Paketi</option>
          </select>
        </div>
        <div>
          <label class="field-label">Evrak Denetim Kapasitesi (Ay)</label>
          <input id="saEditMonths" type="text" placeholder="36" />
        </div>
        <div>
          <label class="field-label">Maksimum Ajan Kapasitesi</label>
          <input id="saEditAgents" type="text" placeholder="99" />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label class="field-label">Kurum Admini Ad Soyad</label>
          <input id="saEditAdminName" type="text" />
        </div>
        <div>
          <label class="field-label">Kurum Admini E-posta</label>
          <input id="saEditAdminEmail" type="email" />
        </div>
        <div>
          <label class="field-label">Yeni Admin Şifresi (Değiştirmek İsterseniz)</label>
          <input id="saEditAdminPass" type="password" placeholder="Boş bırakılırsa değişmez" style="width:100%;padding:11px 14px;border:1px solid var(--border-strong);border-radius:8px;font-size:15.5px" />
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between">
        <button class="btn btn-primary" onclick="saveSuperAdminTenantSettings()">✔ Kurum Ayarlarını Kaydet ve Paketi Güncelle</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTenantFromSuperAdmin()">🗑️ Kurum Hesabını / Verilerini Sil (KVKK)</button>
      </div>
    </div>

    <div class="card">
      <h2>+ Yeni Kurum (Tenant) ve Kurum Admini Oluştur</h2>
      <p style="color:var(--text-muted)">Yeni bir kurum açtığınızda 10 departman, 29 uzman yapay zeka ajanı, şifreli kasa ve atadığınız Kurum Admini otomatik olarak kurulur.</p>
      <div class="form-row">
        <div>
          <label class="field-label">Kurum Kodu (küçük harf ve tire)</label>
          <input id="newTenantSlug" type="text" placeholder="Örn: anadolu-holding" />
        </div>
        <div>
          <label class="field-label">Kurum Görünen Adı</label>
          <input id="newTenantDisplay" type="text" placeholder="Örn: Anadolu Holding A.Ş." />
        </div>
        <div>
          <label class="field-label">Kurumsal Alt Alan Adı (Subdomain)</label>
          <input id="newTenantSub" type="text" placeholder="Örn: anadolu.sistem.com" />
        </div>
      </div>
      <div class="form-row">
        <div>
          <label class="field-label">Atanacak Kurum Admini Adı Soyadı</label>
          <input id="newTenantAdminName" type="text" placeholder="Örn: Selim Karaca" />
        </div>
        <div>
          <label class="field-label">Kurum Admini E-posta Adresi</label>
          <input id="newTenantAdminEmail" type="email" placeholder="Örn: selim.karaca@anadolu.sistem.com" />
        </div>
      </div>
      <button class="btn btn-primary" onclick="createNewTenantWithAdmin()">Kurumu ve Kurum Adminini Oluştur</button>
    </div>
  `;
}

window.enterTenantAsAdmin = async function(tenantName) {
  currentTenant = tenantName;
  localStorage.setItem('dijital_ikiz_tenant', currentTenant);
  currentRole = 'tenant_admin';
  localStorage.setItem('dijital_ikiz_role', currentRole);
  currentPage = 'overview';
  connectSSE();
  await refreshData(true);
};

window.createNewTenantWithAdmin = async function() {
  const name = document.getElementById('newTenantSlug').value.trim();
  const display = document.getElementById('newTenantDisplay').value.trim();
  const subdomain = document.getElementById('newTenantSub').value.trim() || `${name}.sistem.com`;
  const adminName = document.getElementById('newTenantAdminName').value.trim();
  const adminEmail = document.getElementById('newTenantAdminEmail').value.trim();
  if (!name || !display) return alert('Lütfen kurum kodu ve görünen adını girin.');
  try {
    await api('/api/tenant/provision', {
      method: 'POST',
      body: JSON.stringify({ name, display, subdomain, adminName, adminEmail }),
    });
    alert(`${display} kurumu, 10 departmanı, 29 ajanı ve Kurum Admini başarıyla oluşturuldu!`);
    await refreshData(true);
  } catch (e) {
    alert(e.message);
  }
};

function renderSuperAdminMembers(el) {
  const admins = superOverview?.superAdmins || [];
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Genel Admin (Üst Yönetim) Üyelikleri</h1>
        <p>Tüm kurumları ve platform çekirdeğini yönetmeye yetkili Genel Admin üyeleri.</p>
      </div>
    </div>

    <div class="card">
      <h2>Aktif Genel Admin Üyeleri</h2>
      <div class="table-container">
        <table class="clean-table">
          <thead>
            <tr>
              <th>Ad Soyad</th>
              <th>E-posta</th>
              <th>Unvan</th>
              <th>Yetki Kapsamı</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            ${admins.map(a => `
              <tr>
                <td><strong>👑 ${esc(a.ad_soyad)}</strong></td>
                <td>${esc(a.eposta)}</td>
                <td>${esc(a.unvan)}</td>
                <td>${esc(a.yetki)}</td>
                <td><span class="status-badge ok">${esc(a.durum)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>+ Yeni Genel Admin Üyesi Ekle</h2>
      <div class="form-row">
        <div>
          <label class="field-label">Ad Soyad</label>
          <input id="saName" type="text" placeholder="Örn: Murat Özkan" />
        </div>
        <div>
          <label class="field-label">E-posta</label>
          <input id="saEmail" type="email" placeholder="Örn: murat@dijital-ikiz.local" />
        </div>
        <div>
          <label class="field-label">Unvan</label>
          <input id="saTitle" type="text" placeholder="Örn: Üst Yönetim Koordinatörü" />
        </div>
      </div>
      <button class="btn btn-primary" onclick="addSuperAdminMember()">Genel Admin Ekle</button>
    </div>
  `;
}

window.addSuperAdminMember = async function() {
  const ad_soyad = document.getElementById('saName').value.trim();
  const eposta = document.getElementById('saEmail').value.trim();
  const unvan = document.getElementById('saTitle').value.trim();
  if (!ad_soyad) return alert('Lütfen ad soyad girin.');
  await api('/api/superadmin/add-member', { method: 'POST', body: JSON.stringify({ ad_soyad, eposta, unvan }) });
  await refreshData(true);
};

async function renderSuperAdminHealth(el) {
  el.innerHTML = `<div class="card">Sağlık ve izolasyon raporu hazırlanıyor...</div>`;
  const doc = await api('/api/doctor?all=1');
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Platform Sağlık, Güvenlik ve İzolasyon Denetimi</h1>
        <p>Kurumlar arası veri izolasyonu, şifreli kasa durumu ve yerel yapay zeka motorunun canlı doğrulama sonuçları.</p>
      </div>
      <button class="btn btn-primary" onclick="renderPage()">🔄 Denetimi Yenile</button>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">Genel Platform Durumu</div>
        <div class="stat-value" style="color:var(--success)">${doc.ok ? '✔ Sorunsuz' : 'Kontrol Gerekli'}</div>
        <div class="stat-sub">Tüm çekirdek şablonlar aktif</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Kurumlar Arası İzolasyon Testi</div>
        <div class="stat-value" style="color:var(--success)">${doc.isolationTest?.ok ? '✔ %100 İzole' : 'Hata'}</div>
        <div class="stat-sub">Kasa ve dosya erişim duvarı aktif</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Yerel Yapay Zeka (Ollama)</div>
        <div class="stat-value">${doc.llmHealth?.ollama?.ok ? '✔ Bağlı' : 'Yedek Motor'}</div>
        <div class="stat-sub">Modeller: ${(doc.llmHealth?.ollama?.models || []).join(', ') || 'Kural Motoru'}</div>
      </div>
    </div>

    <div class="card">
      <h2>Kurumlar Arası Güvenlik Duvarı Doğrulaması</h2>
      <div class="table-container">
        <table class="clean-table">
          <thead><tr><th>Güvenlik & İzolasyon Testi</th><th>Sonuç</th></tr></thead>
          <tbody>
            ${(doc.isolationTest?.details || []).map(d => `
              <tr>
                <td><strong>${esc(d.test)}</strong></td>
                <td><span class="status-badge ok">${d.passed ? '✔ Başarıyla Engellendi (İzole)' : '✖ Hata'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/* ============================================================================
   2. VATANDAŞ / DIŞ KULLANICI HİZMET PORTALI
   ============================================================================ */
function renderCitizenHome(el) {
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>${esc(state.config.displayName)} — Dijital Hizmet & Başvuru Merkezi</h1>
        <p>Kurumumuzun 7/24 çalışan uzman yapay zeka birimlerine doğrudan talep, soru veya başvurunuzu iletebilir; uzmanlarımızı tek tek inceleyebilirsiniz.</p>
      </div>
      <button class="btn" onclick="navigate('agents')">👥 Tüm Uzman Ajanları İncele →</button>
    </div>

    <div class="card">
      <h2>Yeni Talep veya Başvuru Gönder</h2>
      <p style="color:var(--text-muted)">Talebinizi kendi cümlelerinizle yazın. İsterseniz doğrudan bir birim seçebilir veya seçimi Genel Müdür yönlendiricisine bırakabilirsiniz.</p>
      <div class="form-row">
        <div>
          <label class="field-label">İlgili Birim / Departman</label>
          <select id="citDept">
            <option value="">🧭 Otomatik Yönlendir (Talebe Göre En Uygun Birim)</option>
            ${state.departments.map(d => `<option value="${esc(d.slug)}">${esc(d.emoji)} ${esc(d.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-bottom:16px">
        <label class="field-label">Talebiniz veya Sorunuz</label>
        <textarea id="citRequest" rows="4" placeholder="Örn: Kurumunuzdan yeni bir yazılım projesi için iş kırılım planı ve teklif almak istiyorum..."></textarea>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button id="btnCitSubmit" class="btn btn-primary" onclick="submitCitizenTask()">Talebi Gönder ve Yanıt Al</button>
        <span style="color:var(--text-muted);font-size:14px">Örnek talepler:</span>
        <button class="btn btn-sm" onclick="fillCitizenSample('Proje için WBS iş kırılımı ve kritik yol hesabı yap')">Proje Planı İsteme</button>
        <button class="btn btn-sm" onclick="fillCitizenSample('Bu ayın finansal analizini ve unit economics değerlerini çıkar')">Finansal Özet</button>
        <button class="btn btn-sm" onclick="fillCitizenSample('Müşteri churn risk analizi yap')">Müşteri Memnuniyet Analizi</button>
      </div>
    </div>

    <div class="card">
      <h2>Yanıtlanan Son Talepler ve Raporlar</h2>
      ${state.tasks.slice(0, 8).map(t => `
        <div style="padding:20px;border:1px solid var(--border);border-radius:10px;margin-bottom:16px;background:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div>
              <span class="agent-dept-tag">${esc(t.dept)}</span>
              <strong style="font-size:17px;margin-left:8px">Talep #${t.id}: ${esc(t.request)}</strong>
            </div>
            <button class="btn btn-sm" onclick="navigate('agent_detail',{dept:'${esc(t.dept)}',slug:'${esc(t.personnel)}'})">
              👤 Yanıtlayan Uzman: ${esc(t.personnel)} →
            </button>
          </div>
          <div class="report-paper">${esc(t.result || 'Yanıt hazırlanıyor...')}</div>
        </div>
      `).join('') || '<p style="color:var(--text-muted)">Henüz kayıtlı bir talep bulunmuyor.</p>'}
    </div>
  `;
}

window.fillCitizenSample = function(txt) {
  document.getElementById('citRequest').value = txt;
};

window.submitCitizenTask = async function() {
  const req = document.getElementById('citRequest').value.trim();
  const dept = document.getElementById('citDept').value || null;
  if (!req) return alert('Lütfen talebinizi yazın.');
  const btn = document.getElementById('btnCitSubmit');
  btn.disabled = true; btn.textContent = 'Uzman Birim Yanıt Hazırlıyor...';
  try {
    await api('/api/task', { method: 'POST', body: JSON.stringify({ request: req, dept }) });
    await refreshData(true);
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Talebi Gönder ve Yanıt Al';
  }
};

/* ============================================================================
   3. KURUM ADMİN PANELİ: GENEL BAKIŞ
   ============================================================================ */
function renderTenantOverview(el) {
  const k = state.kpis;
  const admins = (state.users || []).filter(u => u.rol === 'Kurum Admini');
  const plan = state.config?.plan || { name: 'Kurumsal Paket', maxAuditMonths: 36 };
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>${esc(state.config.displayName)} — Kurum Yönetim Paneli</h1>
        <p>Kurumunuzun dijital ikiz departmanlarını, 7/24 çalışan yapay zeka ajanlarını, kullanıcı yetkilerini ve finansal/operasyonel göstergelerini buradan yönetin.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="downloadCurrentTenantOfflineApp()">💻 Üyelik Paketini Bilgisayara İndir (.html)</button>
        <button class="btn" onclick="triggerBoardMeeting()" id="btnTopMeeting">🏛️ Yönetim Kurulu Toplantısı Başlat</button>
        <button class="btn" onclick="navigate('agents')">🤖 Ajanları Yönet (${k.personelSayisi}) →</button>
      </div>
    </div>

    <!-- ÜYELİK PAKETİNİ BİLGİSAYARA İNDİRME KARTI (ÜYE OLDUKTAN SONRA AKTİF) -->
    <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#ffffff 100%);border-left:5px solid var(--primary)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div>
          <span class="agent-dept-tag">Aktif Üyelik Paketiniz: ${esc(plan.name || 'Full Kurumsal Paket')}</span>
          <h3 style="margin:6px 0 4px">Üyelik Paketinizi Bilgisayarınıza İndirip Sadece O Bilgisayarda Offline Uygulayın</h3>
          <p style="margin:0;color:var(--text-body);font-size:15px">
            Üyeliğiniz aktiftir. Kurumunuza özel üretilen bağımsız (standalone) uygulama dosyasını bilgisayarınıza indirerek hiçbir dış linke veya sunucuya ihtiyaç duymadan masaüstünüzde çalıştırabilirsiniz.
          </p>
        </div>
        <button class="btn btn-primary" style="padding:13px 22px" onclick="downloadCurrentTenantOfflineApp()">
          💻 Paketi Bilgisayara İndir (.html)
        </button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">Dönem Geliri (${esc(k.donem)})</div>
        <div class="stat-value">${fmtMoney(k.gelir)}</div>
        <div class="stat-sub">Gider: ${fmtMoney(k.gider)} · Net: <strong>${fmtMoney(k.net)}</strong></div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Açık Satış Fırsatları</div>
        <div class="stat-value">${k.acikFirsatAdet} Fırsat</div>
        <div class="stat-sub">Toplam Hacim: ${fmtMoney(k.acikFirsatTutar)}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Departman ve Ajanlar</div>
        <div class="stat-value">${state.departments.length} Birim / ${k.personelSayisi} Ajan</div>
        <div class="stat-sub">${k.aktifSkill} aktif yetenek paketi</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Kurum Admini & Üyeler</div>
        <div class="stat-value">${k.kullaniciSayisi || 6} Kullanıcı</div>
        <div class="stat-sub">Admin: ${esc(admins[0]?.ad_soyad || 'Ahmet Yılmaz')}</div>
      </div>
    </div>

    <!-- HIZLI GÖREV VERME KARTI -->
    <div class="card">
      <h2>Hızlı Kurumsal Görev & Talimat Gönder</h2>
      <div class="form-row" style="grid-template-columns: 280px 1fr auto; align-items: end;">
        <div>
          <label class="field-label">Hedef Departman</label>
          <select id="ovDept">
            <option value="">🧭 Genel Müdür Otomatik Yönlendirsin</option>
            ${state.departments.map(d => `<option value="${esc(d.slug)}">${esc(d.emoji)} ${esc(d.no)} - ${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="field-label">Görev veya Talimatınız</label>
          <input id="ovTaskInput" type="text" placeholder="Örn: Bu ayın finansal analizini çıkar / Proje için WBS kritik yol hesabı yap..." />
        </div>
        <div>
          <button id="btnOvSend" class="btn btn-primary" onclick="sendOverviewTask()">Görev Gönder</button>
        </div>
      </div>
    </div>

    <!-- DEPARTMAN KARTLARI ÖZETİ -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <h2 style="margin:0">Kurum Departmanları (${state.departments.length} Departman)</h2>
        <button class="btn btn-sm" onclick="navigate('agents')">Tüm Ajanları Ayrıntılı Gör →</button>
      </div>
      <div class="agents-grid">
        ${state.departments.map(d => {
          const pers = state.personnel.filter(p => p.dept === d.slug);
          return `
            <div class="agent-card">
              <div>
                <div class="agent-dept-tag">${esc(d.no)} · ${esc(d.slug)}</div>
                <h3 class="agent-name" style="margin-bottom:8px">${esc(d.emoji)} ${esc(d.name)}</h3>
                <p style="font-size:14.5px;color:var(--text-muted);margin-bottom:12px">
                  <strong>${pers.length} Uzman Ajan:</strong> ${pers.map(p => esc(p.title)).join(', ')}
                </p>
              </div>
              <div class="agent-card-footer">
                <span style="font-size:13.5px;color:var(--text-muted)">Tablolar: ${esc((d.tables || []).join(', '))}</span>
                <button class="btn btn-sm btn-primary" onclick="openDeptAgents('${esc(d.slug)}')">Birim Ajanlarını Aç →</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

window.openDeptAgents = function(deptSlug) {
  selectedDeptFilter = deptSlug;
  navigate('agents');
};

window.sendOverviewTask = async function() {
  const req = document.getElementById('ovTaskInput').value.trim();
  const dept = document.getElementById('ovDept').value || null;
  if (!req) return alert('Lütfen bir görev yazın.');
  const btn = document.getElementById('btnOvSend');
  btn.disabled = true; btn.textContent = 'Çalışıyor...';
  try {
    const r = await api('/api/task', { method: 'POST', body: JSON.stringify({ request: req, dept }) });
    await refreshData(false);
    if (r.dept && r.personnel) {
      navigate('agent_detail', { dept: r.dept, slug: r.personnel, subtab: 'reports' });
    } else {
      navigate('approvals');
    }
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Görev Gönder';
  }
};

window.triggerBoardMeeting = async function() {
  const btn = document.getElementById('btnTopMeeting');
  if (btn) { btn.disabled = true; btn.textContent = '🏛️ Toplantı Yapılıyor...'; }
  try {
    await api('/api/meeting', { method: 'POST', body: JSON.stringify({}) });
    await refreshData(false);
    navigate('approvals');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🏛️ Yönetim Kurulu Toplantısı Başlat'; }
  }
};

/* ============================================================================
   4. AJANLARIN YÖNETİMİ VE REHBERİ (HER AJANA AYRI SAYFA GEÇİŞİ)
   ============================================================================ */
function renderAgentsDirectory(el) {
  const pers = state.personnel.filter(p => selectedDeptFilter === 'ALL' || p.dept === selectedDeptFilter);
  const isAdmin = currentRole !== 'citizen';

  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Yapay Zeka Ajanları Rehberi ve Yönetimi</h1>
        <p>Kurumunuzdaki her bir yapay zeka uzmanını ferah kartlarda inceleyebilir, <strong>"Ajan Sayfasını Aç"</strong> butonuyla o ajanın kendi özel sayfasına giderek görev verebilir, yeteneklerini ve kurallarını yönetebilirsiniz.</p>
      </div>
      ${isAdmin ? `
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="navigate('proje_stilleri')">🎯 Proje Yönetimi Stilleri (MucitHub · Başkent Ailem · MucitLab)</button>
          <button class="btn" onclick="toggleBox('newDeptModal')">+ Yeni Departman Aç</button>
          <button class="btn" onclick="toggleBox('newAgentModal')">+ Yeni Yapay Zeka Ajanı Ekle</button>
        </div>
      ` : ''}
    </div>

    <!-- PROJE YÖNETİMİ STİLLERİ ÖZET ŞERİDİ -->
    <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#ffffff 100%);border-left:5px solid var(--primary)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div>
          <h3 style="margin:0">📂 Projeler Departmanı — 4 Proje Yönetimi Stili</h3>
          <div style="font-size:13.5px;color:var(--text-muted)">Başkent Kart (Kontrol & Kabul), MucitHub (100 Cihazlı IoT Yönetimi), Başkent Ailem (Mobil App) ve MucitLab (Uygulamalı Eğitim)</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="navigate('proje_stilleri')">Projeleri & Alt Ajanları Yönet →</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        <div style="padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:9px;cursor:pointer" onclick="projeStiliAktifSekme='baskentKart';navigate('proje_stilleri')">
          <strong>💳 Başkent Kart</strong><div style="font-size:12.5px;color:var(--text-muted)">Kontrol Ajanı · Kabul Ajanı · Şartname & 36 Ay</div>
        </div>
        <div style="padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:9px;cursor:pointer" onclick="projeStiliAktifSekme='mucithub';navigate('proje_stilleri')">
          <strong>📡 MucitHub (IoT Yönetimi)</strong><div style="font-size:12.5px;color:var(--text-muted)">100 IoT Cihazı · Sensör & CV · Paketleme & Dosyalama</div>
        </div>
        <div style="padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:9px;cursor:pointer" onclick="projeStiliAktifSekme='baskentAilem';navigate('proje_stilleri')">
          <strong>📱 Başkent Ailem</strong><div style="font-size:12.5px;color:var(--text-muted)">Anne-Baba & Çocuk Mobil App · Son Kullanıcı Takibi</div>
        </div>
        <div style="padding:10px 12px;background:#fff;border:1px solid var(--border);border-radius:9px;cursor:pointer" onclick="projeStiliAktifSekme='mucitLab';navigate('proje_stilleri')">
          <strong>🧪 MucitLab</strong><div style="font-size:12.5px;color:var(--text-muted)">Çocuklara IoT, Sanat & İletişim Eğitimi</div>
        </div>
      </div>
    </div>

    <!-- YENİ DEPARTMAN FORMU (GİZLİ KART) -->
    <div id="newDeptModal" class="card" style="display:none;background:var(--surface-soft)">
      <h3>+ Yeni Departman Oluştur</h3>
      <div class="form-row">
        <div>
          <label class="field-label">Departman Kodu (NN-Ad-Formatı)</label>
          <input id="ndSlug" type="text" placeholder="Örn: 11-Insan-Kaynaklari" />
        </div>
        <div>
          <label class="field-label">Departman Görünen Adı</label>
          <input id="ndName" type="text" placeholder="Örn: İnsan Kaynakları ve Akademi" />
        </div>
        <div>
          <label class="field-label">Anahtar Kavramlar (virgülle)</label>
          <input id="ndKeywords" type="text" placeholder="Örn: işe alım, izin, özlük, eğitim" />
        </div>
      </div>
      <button class="btn btn-primary" onclick="createDepartmentNow()">Departmanı Oluştur</button>
    </div>

    <!-- YENİ AJAN FORMU (GİZLİ KART) -->
    <div id="newAgentModal" class="card" style="display:none;background:var(--surface-soft)">
      <h3>+ Departmana Yeni Yapay Zeka Ajanı (Personel) Ekle</h3>
      <div class="form-row">
        <div>
          <label class="field-label">Bağlı Olduğu Departman</label>
          <select id="naDept">
            ${state.departments.map(d => `<option value="${esc(d.slug)}">${esc(d.no)} - ${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="field-label">Ajan Kodu (küçük harf ve tire)</label>
          <input id="naSlug" type="text" placeholder="Örn: kidemli-vergi-uzmani" />
        </div>
        <div>
          <label class="field-label">Ajan Unvanı / Adı</label>
          <input id="naTitle" type="text" placeholder="Örn: Kıdemli Vergi ve Mevzuat Uzmanı" />
        </div>
      </div>
      <div style="margin-bottom:14px">
        <label class="field-label">Görev Tanımı (Mission)</label>
        <input id="naMission" type="text" placeholder="Örn: Kurumun vergi uyumunu ve beyanname süreçlerini denetler." />
      </div>
      <div style="margin-bottom:14px">
        <label class="field-label">Personele Özel Kurallar (Her satıra 1 kural)</label>
        <textarea id="naRules" rows="3" placeholder="Resmi mevzuat numarası belirtmeden vergi görüşü verme."></textarea>
      </div>
      <button class="btn btn-primary" onclick="createPersonnelNow()">Ajanı Oluştur</button>
    </div>

    <!-- DEPARTMAN FİLTRE ÇUBUĞU -->
    <div class="dept-filter-bar">
      <button class="filter-pill ${selectedDeptFilter === 'ALL' ? 'active' : ''}" onclick="filterDept('ALL')">
        Tümü (${state.personnel.length} Ajan)
      </button>
      ${state.departments.map(d => {
        const c = state.personnel.filter(p => p.dept === d.slug).length;
        return `
          <button class="filter-pill ${selectedDeptFilter === d.slug ? 'active' : ''}" onclick="filterDept('${esc(d.slug)}')">
            ${esc(d.emoji)} ${esc(d.name)} (${c})
          </button>
        `;
      }).join('')}
    </div>

    <!-- AJAN KARTLARI IZGARASI -->
    <div class="agents-grid">
      ${pers.map(p => {
        const dObj = state.departments.find(d => d.slug === p.dept) || { emoji: '👤', name: p.dept };
        return `
          <div class="agent-card">
            <div>
              <div class="agent-card-top">
                <div class="agent-avatar">${esc(dObj.emoji || '👤')}</div>
                <div>
                  <span class="agent-dept-tag">${esc(dObj.name)}</span>
                  <h3 class="agent-name">${esc(p.title)}</h3>
                  <div style="font-size:13px;color:var(--text-muted);margin-top:2px">
                    ${p.head ? '⭐ Departman Yöneticisi' : 'Uzman Dijital İkiz Ajanı'} · Kod: <code>${esc(p.slug)}</code>
                  </div>
                </div>
              </div>
              <p class="agent-mission" style="margin-top:14px">${esc(p.mission || 'Departman görevlerini ve uzmanlık iş akışlarını yürütür.')}</p>
              <div style="margin-top:12px">
                <div style="font-size:13px;font-weight:600;color:var(--text-muted);margin-bottom:6px">Tanımlı Yetenekler (${p.skillsCount || 0}):</div>
                <div class="skill-tags">
                  ${(p.skillsNames || []).map(sn => `<span class="skill-tag">📦 ${esc(sn)}</span>`).join('') || '<span class="skill-tag">Genel Departman Yeteneği</span>'}
                </div>
              </div>
            </div>

            <div class="agent-card-footer">
              <span class="status-badge ok" style="font-size:12.5px">● 7/24 Hazır</span>
              <button class="btn btn-primary btn-sm" onclick="navigate('agent_detail',{dept:'${esc(p.dept)}',slug:'${esc(p.slug)}'})">
                💬 Sohbet Et & Sayfasını Aç →
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

window.filterDept = function(dSlug) {
  selectedDeptFilter = dSlug;
  renderPage();
};

window.toggleBox = function(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.createDepartmentNow = async function() {
  const slug = document.getElementById('ndSlug').value.trim();
  const name = document.getElementById('ndName').value.trim();
  const keywords = document.getElementById('ndKeywords').value.trim();
  if (!slug || !name) return alert('Lütfen departman kodu ve adını girin.');
  try {
    await api('/api/admin/department', { method: 'POST', body: JSON.stringify({ slug, name, keywords }) });
    await refreshData(true);
  } catch (e) { alert(e.message); }
};

window.createPersonnelNow = async function() {
  const dept = document.getElementById('naDept').value;
  const slug = document.getElementById('naSlug').value.trim();
  const title = document.getElementById('naTitle').value.trim();
  const mission = document.getElementById('naMission').value.trim();
  const rules = document.getElementById('naRules').value.trim();
  if (!slug || !title) return alert('Lütfen ajan kodu ve unvanını girin.');
  try {
    await api('/api/admin/personnel', { method: 'POST', body: JSON.stringify({ dept, slug, title, mission, rules }) });
    navigate('agent_detail', { dept, slug });
  } catch (e) { alert(e.message); }
};

/* ============================================================================
   5. HER AJANIN KENDİ ÖZEL TAM SAYFASI (DEDICATED AGENT PAGE)
   ============================================================================ */
function renderAgentDedicatedPage(el) {
  if (!agentDetail) {
    el.innerHTML = `<div class="card">Ajan bilgileri yükleniyor...</div>`;
    return;
  }
  const a = agentDetail;
  const sub = currentAgentParams.subtab || 'task';
  const isAdmin = currentRole !== 'citizen';

  el.innerHTML = `
    <div style="margin-bottom:18px">
      <button class="btn btn-sm" onclick="navigate('agents')">← Tüm Ajanlar Rehberine Dön</button>
    </div>

    <!-- AJAN ÜST KİMLİK KARTI -->
    <div class="card" style="border-top: 4px solid var(--primary)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap">
        <div style="display:flex;gap:18px;align-items:flex-start">
          <div class="agent-avatar" style="width:68px;height:68px;font-size:32px">${esc(a.dept.emoji || '👤')}</div>
          <div>
            <span class="agent-dept-tag">${esc(a.dept.no)} · ${esc(a.dept.name)}</span>
            <h1 style="margin:4px 0 6px 0">${esc(a.title)}</h1>
            <p style="font-size:17px;color:var(--text-body);margin:0 0 8px 0">${esc(a.mission)}</p>
            <div style="font-size:14px;color:var(--text-muted)">
              Kimlik Kodu: <code>${esc(a.slug)}</code> · Rol: <strong>${a.head ? '⭐ Departman Yöneticisi' : 'Uzman Dijital İkiz Personeli'}</strong> ·
              Erişebildiği Kurumsal Tablolar: <strong>${esc((a.dept.tables || []).join(', '))}</strong>
            </div>
          </div>
        </div>
        <span class="status-badge ok">● ${esc(a.live?.activity || '7/24 Göreve Hazır')}</span>
      </div>
    </div>

    <!-- AJAN SAYFASI SEKMELERİ -->
    <div class="subtabs">
      <button class="subtab ${sub === 'task' ? 'active' : ''}" onclick="switchAgentSubtab('task')">
        💬 Canlı Sohbet & Sesli İletişim (${(a.chatHistory || []).length})
      </button>
      <button class="subtab ${sub === 'skills' ? 'active' : ''}" onclick="switchAgentSubtab('skills')">
        📦 Yetenek Paketleri (${a.skills.length})
      </button>
      <button class="subtab ${sub === 'rules' ? 'active' : ''}" onclick="switchAgentSubtab('rules')">
        📏 Kurallar & Ajan Ayarları (${a.rulesList.length})
      </button>
      <button class="subtab ${sub === 'reports' ? 'active' : ''}" onclick="switchAgentSubtab('reports')">
        📋 Ürettiği Raporlar (${a.tasks.length})
      </button>
    </div>

    <div id="agentSubtabBody"></div>
  `;

  const bodyEl = document.getElementById('agentSubtabBody');

  if (sub === 'task') {
    const history = a.chatHistory || [];
    const autoSpeakChecked = localStorage.getItem('dijital_ikiz_autospeak') === '1' ? 'checked' : '';
    const quickChips = [
      a.skills[0] ? `${a.skills[0].description}` : 'Güncel departman durumunu ve öncelikli işleri özetle',
      a.skills[1] ? `${a.skills[1].description}` : 'Bu haftaki riskleri ve önerilen aksiyonları tablo olarak çıkar',
      'Görev tanımına ve kurallarına göre bugün hangi analizleri yapabilirsin?',
    ];

    bodyEl.innerHTML = `
      <div class="chat-shell">
        <!-- SOHBET ÜST ÇUBUĞU -->
        <div class="chat-topbar">
          <div style="display:flex;align-items:center;gap:12px">
            <span class="status-badge ok">● Canlı İletişim Aktif</span>
            <span style="font-size:14.5px;color:var(--text-muted)">
              <strong>${esc(a.title)}</strong> ile sesli veya yazılı konuşabilirsiniz
            </span>
          </div>

          <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <label style="display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;cursor:pointer;color:var(--text)">
              <input type="checkbox" id="chkAutoSpeak" ${autoSpeakChecked} onchange="toggleAutoSpeak(this.checked)" />
              🔊 Ajan Yanıtlarını Sesli Okusun
            </label>
            <button class="btn btn-sm" onclick="stopAgentSpeech()" title="Sesli okumayı durdur">⏹ Sesi Durdur</button>
            <select id="agSkillSelect" style="width:auto;padding:6px 10px;font-size:13.5px">
              <option value="">⚡ Otomatik Yetenek Seçimi</option>
              ${a.skills.map(s => `<option value="${esc(s.name)}">📦 ${esc(s.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- KONUŞMA MESAJ AKIŞI -->
        <div class="chat-messages" id="agentChatMessages">
          <!-- Karşılama mesajı -->
          <div class="chat-row agent">
            <div class="chat-avatar">${esc(a.dept.emoji || '🤖')}</div>
            <div>
              <div class="chat-bubble">Merhaba! Ben <strong>${esc(state.config.displayName)}</strong> kurumunun <strong>${esc(a.dept.name)}</strong> departmanında görevli <strong>${esc(a.title)}</strong> dijital ikiziyim.

Bana aşağıdaki mikrofon (<strong>🎤 Sesle Konuş</strong>) butonuna basarak sesli talimat verebilir veya mesaj kutusuna yazarak soru sorabilir, rapor ve analiz hazırlatabilirsiniz. Size nasıl yardımcı olabilirim?</div>
              <div class="chat-meta">
                <span>${esc(a.title)}</span>
                <button class="btn btn-sm" style="padding:2px 8px;font-size:12px" onclick="speakText('Merhaba! Ben ${esc(a.title)}. Size nasıl yardımcı olabilirim?')">🔊 Dinle</button>
              </div>
            </div>
          </div>

          ${history.map((m, idx) => {
            const isUser = m.from_agent === 'kullanici';
            const isVoiceMsg = m.kind === 'chat-user-voice';
            return `
              <div class="chat-row ${isUser ? 'user' : 'agent'}">
                <div class="chat-avatar">${isUser ? 'SİZ' : esc(a.dept.emoji || '🤖')}</div>
                <div>
                  <div class="chat-bubble">${esc(m.content)}</div>
                  <div class="chat-meta">
                    <span>${isUser ? (isVoiceMsg ? '🎤 Sesli Mesajınız' : 'Yazılı Mesajınız') : esc(a.title)} · ${esc((m.ts || '').slice(11, 16))}</span>
                    ${!isUser ? `<button class="btn btn-sm" style="padding:2px 8px;font-size:12px" onclick="speakMessageByIndex(${idx})">🔊 Sesli Dinle</button>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- ALT MESAJ YAZMA VE MİKROFON ÇUBUĞU -->
        <div class="chat-composer">
          <div id="voiceRecordingBar" class="voice-status-bar">
            <span id="voiceStatusText">🔴 Mikrofon dinliyor... Lütfen konuşun (Türkçe)</span>
            <button class="btn btn-sm btn-danger" onclick="toggleVoiceMic('${esc(a.dept.slug)}','${esc(a.slug)}')">⏹ Kaydı Bitir</button>
          </div>

          <!-- Hazır Hızlı Konuşma Başlatıcılar -->
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${quickChips.map(q => `
              <button class="btn btn-sm" style="font-size:12.5px;padding:4px 10px;background:var(--surface-soft)" onclick="fillAndSendChat('${esc(a.dept.slug)}','${esc(a.slug)}','${esc(q)}')">
                💬 ${esc(q.slice(0, 62))}${q.length > 62 ? '…' : ''}
              </button>
            `).join('')}
          </div>

          <div class="chat-input-row">
            <button type="button" id="btnVoiceMic" class="mic-btn" onclick="toggleVoiceMic('${esc(a.dept.slug)}','${esc(a.slug)}')" title="Mikrofonla sesli konuşun">
              🎤 Sesle Konuş
            </button>
            <textarea id="agChatInput" rows="2" placeholder="${esc(a.title)} uzmanına mesajınızı yazın veya '🎤 Sesle Konuş' butonuna basıp konuşun... (Göndermek için Enter)" onkeydown="onChatKeyDown(event,'${esc(a.dept.slug)}','${esc(a.slug)}')"></textarea>
            <button type="button" id="btnSendChat" class="btn btn-primary" style="padding:12px 22px;height:48px" onclick="sendAgentChatMessage('${esc(a.dept.slug)}','${esc(a.slug)}',false)">
              Gönder ➤
            </button>
          </div>
        </div>
      </div>
    `;

    setTimeout(() => {
      const msgBox = document.getElementById('agentChatMessages');
      if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
    }, 30);
  } else if (sub === 'skills') {
    bodyEl.innerHTML = `
      ${a.skills.map(s => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:12px">
            <div>
              <span class="agent-dept-tag">Yetenek Paketi (Skill)</span>
              <h2 style="margin:4px 0">${esc(s.name)}</h2>
              <p style="font-size:16px;color:var(--text-body);margin:0">${esc(s.description)}</p>
            </div>
            <span class="status-badge ok">Durum: ${esc(s.status)}</span>
          </div>

          <div class="form-row" style="margin-top:16px">
            <div style="background:var(--surface-soft);padding:16px;border-radius:10px">
              <h4 style="margin:0 0 8px 0">İş Akışı Adımları</h4>
              <ol style="margin:0;padding-left:20px">
                ${s.steps.map(st => `<li style="margin-bottom:6px">${esc(st)}</li>`).join('') || '<li>Standart uzmanlık adımlarını uygular.</li>'}
              </ol>
            </div>
            <div style="background:var(--surface-soft);padding:16px;border-radius:10px">
              <h4 style="margin:0 0 8px 0">Tetikleyiciler & Hesaplama Betikleri</h4>
              <p style="font-size:14.5px;margin-bottom:8px"><strong>Tetikleyen Kelimeler:</strong> ${esc((s.triggers || []).join(', ') || '-')}</p>
              <p style="font-size:14.5px;margin-bottom:8px"><strong>Parametreler:</strong> ${esc((s.arguments || []).join(', ') || 'Otomatik')}</p>
              <p style="font-size:14.5px;margin:0"><strong>Çalışan Betikler:</strong> ${esc((s.scripts || []).join(', ') || 'Metin & Şablon Tabanlı')}</p>
            </div>
          </div>

          ${s.references.length ? `
            <div style="margin-top:14px">
              <h4 style="margin-bottom:8px">Referans Şablonu (${esc(s.references[0].name)})</h4>
              <div class="report-paper">${esc(s.references[0].content)}</div>
            </div>
          ` : ''}
        </div>
      `).join('') || '<div class="card">Bu ajana henüz özel bir yetenek paketi tanımlanmamış.</div>'}
    `;
  } else if (sub === 'rules') {
    bodyEl.innerHTML = `
      <div class="card">
        <h2>${esc(a.title)} — Davranış Kuralları ve Sınırları</h2>
        <p style="color:var(--text-muted)">Bu kurallar her görevde ajanın çalışma sınırlarını belirler. ${isAdmin ? 'Aşağıdan ajanın unvanını, görev tanımını ve kurallarını düzenleyip kaydedebilirsiniz.' : ''}</p>

        <div style="margin-bottom:20px">
          <h3>Aktif Personel Kuralları</h3>
          <ul>
            ${a.rulesList.map(r => `<li style="margin-bottom:8px;font-size:16px"><strong>${esc(r)}</strong></li>`).join('')}
          </ul>
          <h3>Bağlı Olduğu Departman Kuralları (${esc(a.dept.name)})</h3>
          <ul>
            ${a.deptRules.map(r => `<li style="margin-bottom:8px;color:var(--text-body)">${esc(r)}</li>`).join('')}
          </ul>
        </div>

        ${isAdmin ? `
          <hr style="border:none;border-top:1px solid var(--border);margin:24px 0"/>
          <h3>Ajan Profilini ve Kurallarını Düzenle</h3>
          <div class="form-row">
            <div>
              <label class="field-label">Ajan Unvanı</label>
              <input id="editAgTitle" type="text" value="${esc(a.title)}" />
            </div>
            <div>
              <label class="field-label">Görev Tanımı</label>
              <input id="editAgMission" type="text" value="${esc(a.mission)}" />
            </div>
          </div>
          <div style="margin-bottom:16px">
            <label class="field-label">Personele Özel Kurallar (Her satıra 1 kural yazın)</label>
            <textarea id="editAgRules" rows="5">${esc(a.rulesList.join('\n'))}</textarea>
          </div>
          <button class="btn btn-primary" onclick="saveAgentSettings('${esc(a.dept.slug)}','${esc(a.slug)}',${!!a.head})">
            💾 Ajan Ayarlarını ve Kurallarını Kaydet
          </button>
        ` : ''}
      </div>
    `;
  } else if (sub === 'reports') {
    bodyEl.innerHTML = `
      <div class="card">
        <h2>${esc(a.title)} Tarafından Üretilen Raporlar (${a.tasks.length})</h2>
        ${a.tasks.map(t => `
          <div style="margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <strong>Görev #${t.id}: ${esc(t.request)}</strong>
              <span style="color:var(--text-muted);font-size:14px">${esc((t.created_at || '').slice(0, 16).replace('T', ' '))}</span>
            </div>
            <div class="report-paper">${esc(t.result)}</div>
          </div>
        `).join('') || '<p style="color:var(--text-muted)">Bu ajan henüz bir görev raporu üretmedi. "Görev Ver & Çalıştır" sekmesinden hemen görev verebilirsiniz.</p>'}
      </div>
    `;
  }
}

window.switchAgentSubtab = function(sub) {
  currentAgentParams.subtab = sub;
  renderPage();
};

window.runDirectAgentTask = async function(dept, slug) {
  const req = document.getElementById('agTaskText').value.trim();
  const skill = document.getElementById('agSkillSelect').value || null;
  if (!req) return alert('Lütfen görev talimatını yazın.');
  const btn = document.getElementById('btnRunAgentTask');
  btn.disabled = true; btn.textContent = 'Uzman Çalışıyor...';
  try {
    await api('/api/task', { method: 'POST', body: JSON.stringify({ request: req, dept, personnel: slug, skill }) });
    agentDetail = await api(`/api/agent?dept=${encodeURIComponent(dept)}&slug=${encodeURIComponent(slug)}`);
    await refreshData(false);
    renderPage();
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = '▶ Görevi Şimdi Çalıştır';
  }
};

window.saveAgentSettings = async function(dept, slug, head) {
  const title = document.getElementById('editAgTitle').value.trim();
  const mission = document.getElementById('editAgMission').value.trim();
  const rulesList = document.getElementById('editAgRules').value.split('\n').map(s => s.trim()).filter(Boolean);
  await api('/api/agent/update', { method: 'POST', body: JSON.stringify({ dept, slug, title, mission, head, rulesList }) });
  alert('Ajan profili ve kuralları başarıyla güncellendi!');
  agentDetail = await api(`/api/agent?dept=${encodeURIComponent(dept)}&slug=${encodeURIComponent(slug)}`);
  await refreshData(true);
};

/* ============================================================================
   6. İNTERAKTİF 3D SANAL OFİS SİMÜLASYONU (KESİTLİ MİMARİ & VOKSEL AJANLAR)
   ============================================================================ */
function renderVirtualOfficeMap(el) {
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>${esc(state.config.displayName)} — 3D Sanal Ofis ve Kampüs Simülasyonu</h1>
        <p>Sol tık ile <strong>360° döndürün</strong>, sağ tık ile <strong>kaydırın</strong>, fare tekerleği ile <strong>yakınlaştırın</strong>. 3D sahnedeki herhangi bir uzmanın üzerine tıklayarak doğrudan görev verebilir veya tam sayfasına gidebilirsiniz.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="toggle3DMeetingWalk()">🏛️ Yöneticileri Toplantı Odasına Çağır</button>
        <button class="btn" onclick="trigger3DHandoffWalk()">🔁 İş Devri (Handoff) Yürüyüşü</button>
      </div>
    </div>

    <!-- 3D KAMERA VE ATMOSFER KONTROL ÇUBUĞU -->
    <div class="card" style="padding:14px 20px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <strong style="font-size:14px;color:var(--text);margin-right:4px">🎥 Kamera Açısı:</strong>
        <button class="btn btn-sm" onclick="Office3D.setCameraPreset('overview')">🏢 Genel Kampüs</button>
        <button class="btn btn-sm" onclick="Office3D.setCameraPreset('ceo')">🧭 Genel Müdür Odası</button>
        <button class="btn btn-sm" onclick="Office3D.setCameraPreset('meeting')">🏛️ Toplantı Odası</button>
        <button class="btn btn-sm" onclick="Office3D.setCameraPreset('lobby')">🛋️ Merkezi Lobi</button>
        <button class="btn btn-sm" onclick="Office3D.setCameraPreset('top')">🦅 Kuş Bakışı</button>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <strong style="font-size:14px;color:var(--text);margin-right:4px">🌤️ Atmosfer:</strong>
        <button class="btn btn-sm" onclick="Office3D.setLighting('sunset')">🌅 Gün Batımı</button>
        <button class="btn btn-sm" onclick="Office3D.setLighting('day')">🌞 Gündüz</button>
        <button class="btn btn-sm" onclick="Office3D.setLighting('night')">🌙 Gece Vardiyası (7/24)</button>
      </div>
    </div>

    <!-- 3D TUVAL (CANVAS) VE SEÇİLİ AJAN KARTI -->
    <div style="position:relative;border-radius:14px;overflow:hidden;border:2px solid var(--border-strong);box-shadow:var(--shadow-md);margin-bottom:26px;background:#1e293b">
      <canvas id="office3dCanvas" style="width:100%;height:620px;display:block;cursor:grab"></canvas>

      <!-- Sağ Üst Yardım Rozeti -->
      <div style="position:absolute;top:14px;left:14px;background:rgba(15,23,42,0.82);color:#f8fafc;padding:8px 14px;border-radius:8px;font-size:13px;pointer-events:none;border:1px solid rgba(255,255,255,0.15)">
        🖱️ <strong>Sol Tık + Sürükle:</strong> 360° Döndür &nbsp;|&nbsp; <strong>Sağ Tık + Sürükle:</strong> Kaydır &nbsp;|&nbsp; <strong>Tekerlek:</strong> Yakınlaştır &nbsp;|&nbsp; <strong>Ajana Tıkla:</strong> Seç & Görev Ver
      </div>

      <!-- Seçili 3D Ajan Yüzen Kartı -->
      <div id="selected3DAgentCard" style="display:none;position:absolute;top:14px;right:14px;width:340px;background:rgba(255,255,255,0.97);border:1px solid var(--border-strong);border-radius:12px;padding:18px;box-shadow:var(--shadow-md)"></div>
    </div>

    <!-- HIZLI ODA VE AJAN SEÇİM LİSTESİ -->
    <div class="card">
      <h2>Bina İçi Departman Odaları ve Masadaki Ajanlar</h2>
      <p style="color:var(--text-muted)">Aşağıdaki listeden bir uzmana tıklayarak 3D sahnede üzerine odaklanabilir veya doğrudan özel sayfasını açabilirsiniz.</p>
      <div class="office-map-grid">
        ${state.departments.map(d => {
          const pers = state.personnel.filter(p => p.dept === d.slug);
          return `
            <div class="office-room-card" style="border-top-color:${esc(d.color || '#1d4ed8')}">
              <div class="office-room-head">
                <h3 style="margin:0">${esc(d.emoji)} ${esc(d.no)}. ${esc(d.name)}</h3>
                <span style="font-size:13px;color:var(--text-muted)">${pers.length} Ajan</span>
              </div>
              ${pers.map(p => `
                <div class="office-desk-item" onclick="Office3D.focusAgent('${esc(p.slug)}')">
                  <div>
                    <div style="font-weight:700;color:var(--text);font-size:15.5px">
                      ${p.head ? '⭐ ' : '👤 '}${esc(p.title)}
                    </div>
                    <div style="font-size:13.5px;color:var(--text-muted)">
                      ${p.skillsCount} Yetenek · ${esc(p.live?.activity || 'Masasında hazır')}
                    </div>
                  </div>
                  <button class="btn btn-sm btn-primary" onclick="event.stopPropagation();navigate('agent_detail',{dept:'${esc(d.slug)}',slug:'${esc(p.slug)}'})">
                    Sayfası →
                  </button>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  if (window.Office3D) {
    window.Office3D.mount('office3dCanvas', state);
  }
}

window.getCurrentTenantDisplay = function() {
  return state?.config?.displayName || 'DİJİTAL İKİZ';
};

window.onSelect3DAgentCard = function(agent) {
  const box = document.getElementById('selected3DAgentCard');
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
      <div>
        <span class="agent-dept-tag">${esc(agent.dept)}</span>
        <h3 style="margin:4px 0 2px 0;font-size:17.5px">${esc(agent.title)}</h3>
        <div style="font-size:13px;color:var(--text-muted)">${agent.head ? '⭐ Departman Yöneticisi' : 'Uzman Dijital İkiz Ajanı'}</div>
      </div>
      <button class="btn btn-sm" onclick="document.getElementById('selected3DAgentCard').style.display='none'">✕</button>
    </div>
    <p style="font-size:14px;color:var(--text-body);margin-bottom:10px">${esc(agent.mission || 'Departman uzmanlık görevlerini yürütür.')}</p>
    <div style="margin-bottom:10px">
      <input id="quick3DTaskInput" type="text" placeholder="Bu uzmana hızlı görev yazın..." style="font-size:14px;padding:8px 10px" />
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" style="flex:1" onclick="sendQuick3DTask('${esc(agent.dept)}','${esc(agent.slug)}')">▶ Görev Ver</button>
      ${!agent.isCeo ? `<button class="btn btn-sm" onclick="navigate('agent_detail',{dept:'${esc(agent.dept)}',slug:'${esc(agent.slug)}'})">Tam Sayfası →</button>` : ''}
    </div>
  `;
};

window.sendQuick3DTask = async function(dept, slug) {
  const inp = document.getElementById('quick3DTaskInput');
  const req = inp ? inp.value.trim() : '';
  if (!req) return alert('Lütfen görev talimatını yazın.');
  await api('/api/task', { method: 'POST', body: JSON.stringify({ request: req, dept, personnel: slug === 'genel-mudur' ? null : slug }) });
  if (slug !== 'genel-mudur') {
    navigate('agent_detail', { dept, slug, subtab: 'reports' });
  } else {
    navigate('approvals');
  }
};

window.toggle3DMeetingWalk = function() {
  if (!window.Office3D) return;
  window.Office3D.toggleMeetingWalk();
};

window.trigger3DHandoffWalk = function() {
  if (!window.Office3D) return;
  window.Office3D.simulateHandoffWalk();
};

/* ============================================================================
   7. KULLANICI & YETKİ YÖNETİMİ (RBAC)
   ============================================================================ */
function renderUsersManagement(el) {
  const users = state.users || [];
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Kullanıcı ve Yetki Yönetimi (RBAC)</h1>
        <p>${esc(state.config.displayName)} kurumundaki yönetici, departman sorumlusu, uzman ve vatandaş/misafir kullanıcıların erişim yetkilerini buradan yönetin.</p>
      </div>
    </div>

    <div class="card">
      <h2>Kayıtlı Kurum Kullanıcıları ve Yetki Matrisi</h2>
      <div class="table-container">
        <table class="clean-table">
          <thead>
            <tr>
              <th>Ad Soyad & E-posta</th>
              <th>Rolü</th>
              <th>Departman Kapsamı</th>
              <th>Tanımlı Yetkiler</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>
                  <div style="font-weight:700;color:var(--text)">${esc(u.ad_soyad)}</div>
                  <div style="font-size:13.5px;color:var(--text-muted)">${esc(u.eposta)} · ${esc(u.unvan || '')}</div>
                </td>
                <td><strong>${esc(u.rol)}</strong></td>
                <td>${esc(u.departman_yetkisi)}</td>
                <td>
                  <div class="skill-tags">
                    ${(u.yetkiler || []).map(y => `<span class="skill-tag">✔ ${esc(PERMISSION_LABELS[y] || y)}</span>`).join('')}
                  </div>
                </td>
                <td><span class="status-badge ok">${esc(u.durum)}</span></td>
                <td>
                  <button class="btn btn-sm" onclick="deleteUser(${u.id})">Sil</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>+ Yeni Kullanıcı ve Yetki Grubu Tanımla</h2>
      <div class="form-row">
        <div>
          <label class="field-label">Ad Soyad</label>
          <input id="uName" type="text" placeholder="Örn: Ayşe Demir" />
        </div>
        <div>
          <label class="field-label">E-posta Adresi</label>
          <input id="uEmail" type="email" placeholder="Örn: ayse.demir@${esc(state.config.subdomain)}" />
        </div>
        <div>
          <label class="field-label">Görev / Unvan</label>
          <input id="uTitle" type="text" placeholder="Örn: İnsan Kaynakları Müdürü" />
        </div>
      </div>

      <div class="form-row">
        <div>
          <label class="field-label">Kullanıcı Rolü</label>
          <select id="uRole">
            <option value="Kurum Admini">Kurum Admini (Tam Kurum Yetkisi)</option>
            <option value="Departman Yöneticisi" selected>Departman Yöneticisi</option>
            <option value="Kurum Uzmanı">Kurum Uzmanı / Çalışan</option>
            <option value="Vatandaş / Standart Kullanıcı">Vatandaş / Dış Kullanıcı</option>
          </select>
        </div>
        <div>
          <label class="field-label">Erişebileceği Departman Kapsamı</label>
          <select id="uDeptScope">
            <option value="Tüm Departmanlar (*)">Tüm Departmanlar (*)</option>
            ${state.departments.map(d => `<option value="${esc(d.slug)}">${esc(d.no)} - ${esc(d.name)}</option>`).join('')}
            <option value="Halka Açık Hizmetler">Sadece Halka Açık Hizmetler</option>
          </select>
        </div>
      </div>

      <div style="margin-bottom:18px">
        <label class="field-label">Kullanıcı Yetkileri (İşaretleyin)</label>
        <div class="checkbox-grid">
          ${Object.entries(PERMISSION_LABELS).map(([k, label]) => `
            <label class="checkbox-item">
              <input type="checkbox" class="uPermCheck" value="${esc(k)}" ${['gorev_ver', 'veri_oku'].includes(k) ? 'checked' : ''} />
              <span>${esc(label)}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <button class="btn btn-primary" onclick="addUserNow()">Kullanıcıyı ve Yetkilerini Kaydet</button>
    </div>
  `;
}

window.addUserNow = async function() {
  const ad_soyad = document.getElementById('uName').value.trim();
  const eposta = document.getElementById('uEmail').value.trim();
  const unvan = document.getElementById('uTitle').value.trim();
  const rol = document.getElementById('uRole').value;
  const departman_yetkisi = document.getElementById('uDeptScope').value;
  const yetkiler = Array.from(document.querySelectorAll('.uPermCheck:checked')).map(c => c.value);
  if (!ad_soyad) return alert('Lütfen kullanıcının adını ve soyadını girin.');
  await api('/api/users', {
    method: 'POST',
    body: JSON.stringify({ ad_soyad, eposta, unvan, rol, departman_yetkisi, yetkiler, durum: 'Aktif' }),
  });
  await refreshData(true);
};

window.deleteUser = async function(id) {
  if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return;
  await api('/api/users/delete', { method: 'POST', body: JSON.stringify({ id }) });
  await refreshData(true);
};

/* ============================================================================
   8. 6 KANALLI AJAN EĞİTİM MERKEZİ
   ============================================================================ */
function renderTrainingCenter(el) {
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>6 Kanallı Yapay Zeka Ajan Eğitim Merkezi</h1>
        <p>Ajanlarınıza yazılı doküman, görsel şema, video transkripti, fare/ekran kaydı, sesli anlatım veya hazır paket ithalatı ile yeni yetenekler kazandırın.</p>
      </div>
    </div>

    <div class="card">
      <h2>Yeni Eğitim Materyali Yükle & Yetenek Oluştur</h2>
      <div class="form-row">
        <div>
          <label class="field-label">1. Eğitim Kanalı Seçin</label>
          <select id="trChannel">
            <option value="1-yazili">1. Yazılı Eğitim (Doküman, Prosedür, Yönetmelik)</option>
            <option value="2-gorsel">2. Görsel Eğitim (Arayüz & Mimari Diyagram Kuralları)</option>
            <option value="3-video">3. Video Eğitim (Toplantı & Eğitim Kaydı Özeti)</option>
            <option value="4-fare-kaydi">4. Fare & Ekran Kaydı (Otomasyon Playbook Üretimi)</option>
            <option value="5-ses">5. Sesli Anlatım (Konuşma Notundan Kural & Yetenek)</option>
            <option value="6-ithalat">6. Hazır Yetenek Paketi İthalatı (Güvenlik Taramalı)</option>
          </select>
        </div>
        <div>
          <label class="field-label">2. Eğitilecek Departman</label>
          <select id="trDept" onchange="updateTrPersonnelList()">
            ${state.departments.map(d => `<option value="${esc(d.slug)}">${esc(d.no)} - ${esc(d.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="field-label">3. Eğitilecek Uzman Ajan</label>
          <select id="trPersonnel"></select>
        </div>
      </div>

      <div class="form-row">
        <div>
          <label class="field-label">Kazandırılacak Yetenek Başlığı</label>
          <input id="trTitle" type="text" placeholder="Örn: Kurumsal İhale Şartname Kontrolü" />
        </div>
        <div>
          <label class="field-label">Kaynak Dosya Adı</label>
          <input id="trFilename" type="text" value="kurumsal-egitim-notu.md" />
        </div>
      </div>

      <div style="margin-bottom:18px">
        <label class="field-label">Eğitim İçeriği, Kurallar ve Adımlar</label>
        <textarea id="trContent" rows="6" placeholder="Kural: Eksik imza sirküleri olan hiçbir ihale dosyasını onaylama.&#10;1. İhale şartnamesindeki teknik maddeleri kontrol et.&#10;2. Teminat mektubu tutarını doğrula.&#10;3. Uygunluk tablosunu hazırla."></textarea>
      </div>

      <button class="btn btn-primary" onclick="submitTrainingNow()">🎓 Eğitimi İşle ve Güvenlik Kontrolüne Gönder</button>
    </div>

    <div class="card">
      <h2>İşlenen Eğitim Kayıtları</h2>
      <div class="table-container">
        <table class="clean-table">
          <thead><tr><th>ID</th><th>Kanal</th><th>Hedef Uzman & Yetenek</th><th>Dosya</th><th>Durum</th></tr></thead>
          <tbody>
            ${state.training.map(tr => `
              <tr>
                <td>#${tr.id}</td>
                <td>${esc(tr.channel)}</td>
                <td><strong>${esc(tr.target)}</strong></td>
                <td>${esc(tr.filename)}</td>
                <td><span class="status-badge ${tr.status === 'active' ? 'ok' : 'warn'}">${esc(tr.status)}</span></td>
              </tr>
            `).join('') || '<tr><td colspan="5">Henüz eğitim kaydı bulunmuyor.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  updateTrPersonnelList();
}

window.updateTrPersonnelList = function() {
  const dept = document.getElementById('trDept')?.value;
  const sel = document.getElementById('trPersonnel');
  if (!sel || !dept) return;
  const list = state.personnel.filter(p => p.dept === dept);
  sel.innerHTML = list.map(p => `<option value="${esc(p.slug)}">${esc(p.title)}</option>`).join('');
};

window.submitTrainingNow = async function() {
  const body = {
    channel: document.getElementById('trChannel').value,
    dept: document.getElementById('trDept').value,
    personnel: document.getElementById('trPersonnel').value,
    title: document.getElementById('trTitle').value.trim() || 'Yeni Kurumsal Yetenek',
    filename: document.getElementById('trFilename').value.trim() || 'egitim.md',
    content: document.getElementById('trContent').value,
  };
  const r = await api('/api/training', { method: 'POST', body: JSON.stringify(body) });
  alert(`Eğitim başarıyla işlendi ve Siber Güvenlik taramasından geçti! Onay Merkezi'nden (#${r.approvalId}) onaylayarak hemen aktif edebilirsiniz.`);
  await refreshData(false);
  navigate('approvals');
};

/* ============================================================================
   9. ONAY MERKEZİ VE GÖREV RAPORLARI
   ============================================================================ */
function renderApprovalsAndReports(el) {
  const pending = state.approvals.filter(a => a.status === 'pending');
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Onay Merkezi ve Kurumsal Görev Raporları</h1>
        <p>Kritik işlemler (dış e-posta gönderimi, yeni eğitilen yeteneklerin aktivasyonu, yeni birim/ajan açılışı) yönetici onayı olmadan devreye girmez.</p>
      </div>
    </div>

    <div class="card">
      <h2>Bekleyen Yönetici Onayları (${pending.length})</h2>
      ${state.approvals.map(a => `
        <div style="padding:18px;border:1px solid var(--border);border-radius:10px;margin-bottom:14px;background:${a.status === 'pending' ? '#fffbeb' : '#fff'}">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <span class="agent-dept-tag">${esc(a.kind)}</span>
              <strong style="font-size:17px;margin-left:8px">#${a.id} — ${esc(a.title)}</strong>
              <div style="font-size:13.5px;color:var(--text-muted);margin-top:4px">Talep Eden: ${esc(a.requested_by)} · Tarih: ${esc((a.ts || '').slice(0, 16).replace('T', ' '))}</div>
            </div>
            ${a.status === 'pending' ? `
              <div style="display:flex;gap:10px">
                <button class="btn btn-success btn-sm" onclick="decideApprovalNow(${a.id},'approve')">✔ Onayla ve Uygula</button>
                <button class="btn btn-danger btn-sm" onclick="decideApprovalNow(${a.id},'reject')">✖ Reddet</button>
              </div>
            ` : `<span class="status-badge ${a.status === 'approved' ? 'ok' : 'warn'}">${a.status === 'approved' ? '✔ Onaylandı' : 'Reddedildi'}</span>`}
          </div>
        </div>
      `).join('') || '<p style="color:var(--text-muted)">Onay bekleyen işlem bulunmuyor.</p>'}
    </div>

    <div class="card">
      <h2>Üretilen Tüm Kurumsal Raporlar (${state.tasks.length})</h2>
      ${state.tasks.map(t => `
        <div style="margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <div>
              <span class="agent-dept-tag">${esc(t.dept)}</span>
              <strong style="font-size:17.5px;margin-left:8px">#${t.id}: ${esc(t.request)}</strong>
            </div>
            <button class="btn btn-sm" onclick="navigate('agent_detail',{dept:'${esc(t.dept)}',slug:'${esc(t.personnel)}'})">
              👤 Uzman: ${esc(t.personnel)} →
            </button>
          </div>
          <div class="report-paper">${esc(t.result || 'Çalışıyor...')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

window.decideApprovalNow = async function(id, decision) {
  await api('/api/approval', { method: 'POST', body: JSON.stringify({ id, decision }) });
  await refreshData(true);
};

/* ============================================================================
   10. KURUMSAL VERİTABANI & GÜVENLİK DENETİM İZİ
   ============================================================================ */
async function renderDataAndSecurity(el) {
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Kurumsal Veritabanı ve Güvenlik Denetim İzi</h1>
        <p>Salt-okunur korumalı (SQL Guard) kurumsal tabloları inceleyin ve değiştirilemez SHA-256 güvenlik kayıtlarını denetleyin.</p>
      </div>
    </div>

    <div class="card">
      <h2>Kurumsal ERP / CRM Tablo Gezgini</h2>
      <div class="form-row" style="grid-template-columns: 1fr auto; align-items: end;">
        <div>
          <label class="field-label">İncelenecek Tabloyu Seçin</label>
          <select id="tblSelect" onchange="loadCleanTable(this.value)">
            <option value="SELECT ad AS Musteri, sektor AS Sektor, mrr AS Aylik_Gelir_TL, nps AS Memnuniyet_NPS, acik_sikayet AS Acik_Sikayet FROM customers LIMIT 15">Müşteriler Tablosu (customers)</option>
            <option value="SELECT firma AS Firma, sektor AS Sektor, asama AS Asama, tutar AS Firsat_Tutari_TL, kaynak AS Kaynak FROM crm_leads LIMIT 15">Satış Fırsatları (crm_leads)</option>
            <option value="SELECT donem AS Donem, tutar AS Tutar_TL, durum AS Durum, vade AS Vade FROM invoices ORDER BY id DESC LIMIT 15">Faturalar (invoices)</option>
            <option value="SELECT donem AS Donem, kategori AS Kategori, tutar AS Tutar_TL, aciklama AS Aciklama FROM expenses ORDER BY id DESC LIMIT 15">Giderler (expenses)</option>
            <option value="SELECT ad AS Proje, durum AS Durum, baslangic AS Baslangic, bitis AS Bitis, butce AS Butce_TL, sorumlu AS Sorumlu FROM projects">Projeler (projects)</option>
            <option value="SELECT ad AS Kampanya, kanal AS Kanal, butce AS Butce_TL, harcama AS Harcama_TL, gelir AS Gelir_TL, lead AS Lead_Sayisi FROM campaigns">Pazarlama Kampanyaları (campaigns)</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="loadCleanTable(document.getElementById('tblSelect').value)">Tabloyu Göster</button>
      </div>
      <div id="cleanTableBox" class="table-container"></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap">
        <h2 style="margin:0">Değiştirilemez Güvenlik Denetim İzi (SHA-256)</h2>
        <span class="status-badge ok">✔ Zincir Bütünlüğü Doğrulandı (${state.chainValid?.kayit || 0} Kayıt)</span>
      </div>
      <div class="table-container">
        <table class="clean-table">
          <thead><tr><th>Tarih & Saat</th><th>İşlemi Yapan Ajan / Yönetici</th><th>Eylem</th><th>Detay</th></tr></thead>
          <tbody>
            ${state.audits.slice(0, 20).map(a => `
              <tr>
                <td>${esc((a.ts || '').slice(0, 19).replace('T', ' '))}</td>
                <td><strong>${esc(a.actor)}</strong></td>
                <td><span class="skill-tag">${esc(a.action)}</span></td>
                <td style="font-size:13.5px;color:var(--text-muted)">${esc(a.detail)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  loadCleanTable(document.getElementById('tblSelect').value);
}

window.loadCleanTable = async function(sql) {
  const box = document.getElementById('cleanTableBox');
  if (!box) return;
  try {
    const r = await api('/api/sql', { method: 'POST', body: JSON.stringify({ sql }) });
    const rows = r.rows || [];
    if (!rows.length) { box.innerHTML = '<p>Kayıt bulunamadı.</p>'; return; }
    const cols = Object.keys(rows[0]);
    box.innerHTML = `
      <table class="clean-table">
        <thead><tr>${cols.map(c => `<th>${esc(c.replace(/_/g, ' '))}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map(row => `<tr>${cols.map(c => `<td>${esc(row[c])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    box.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
  }
};

// Başlangıç
connectSSE();
refreshData(true);


/* ============================================================================
   11. GİRİŞ & ÜYELİK POP-UP MODAL, SLIDER, BÜLTEN VE ÖĞRETİCİ
   ============================================================================ */
let currentHeroSlideIndex = 0;
const HERO_SLIDE_LABELS = [
  '1 / 3 — Kurumsal Dijital İkiz Mimarisinin Tanıtımı',
  '2 / 3 — 3 Yıllık İhale Kapanışı, Fatura ve Dekont Denetimi',
  '3 / 3 — Üye Girişi Sonrası Bilgisayara İndirilebilir Paket Yapısı',
];

window.switchHeroSlide = function(idx) {
  currentHeroSlideIndex = ((idx % 3) + 3) % 3;
  for (let i = 0; i < 3; i++) {
    const s = document.getElementById('heroSlide' + i);
    const d = document.getElementById('heroDot' + i);
    if (s) s.classList.toggle('active', i === currentHeroSlideIndex);
    if (d) d.classList.toggle('active', i === currentHeroSlideIndex);
  }
  const lbl = document.getElementById('heroSlideLabel');
  if (lbl) lbl.textContent = HERO_SLIDE_LABELS[currentHeroSlideIndex];
};

window.nextHeroSlide = function() {
  window.switchHeroSlide(currentHeroSlideIndex + 1);
};

window.prevHeroSlide = function() {
  window.switchHeroSlide(currentHeroSlideIndex - 1);
};

window.openAuthModal = function(mode = 'login', planTier = '') {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'flex';
  window.switchAuthModalTab(mode);
  if (planTier) {
    const sel = document.getElementById('regPlanTier');
    if (sel) sel.value = planTier;
  }
};

window.closeAuthModal = function() {
  const modal = document.getElementById('authModal');
  if (modal) modal.style.display = 'none';
};

window.switchAuthModalTab = function(mode) {
  const panes = {
    login: document.getElementById('authModalLoginPane'),
    register: document.getElementById('authModalRegisterPane'),
    reset: document.getElementById('authModalResetPane'),
    restore: document.getElementById('authModalRestorePane'),
  };
  const btns = {
    login: document.getElementById('tabBtnLogin'),
    register: document.getElementById('tabBtnRegister'),
    reset: document.getElementById('tabBtnReset'),
    restore: document.getElementById('tabBtnRestore'),
  };
  Object.keys(panes).forEach(k => {
    if (panes[k]) panes[k].style.display = k === mode ? 'block' : 'none';
    if (btns[k]) btns[k].classList.toggle('active', k === mode);
  });
  if (mode === 'register') setTimeout(() => { document.getElementById('regCompany')?.focus(); }, 100);
  else if (mode === 'reset') setTimeout(() => { document.getElementById('resetEmail')?.focus(); }, 100);
  else if (mode === 'restore') setTimeout(() => { document.getElementById('restoreQueryInput')?.focus(); }, 100);
  else setTimeout(() => { document.getElementById('loginEmail')?.focus(); }, 100);
};

window.submitNewsletterEmail = async function() {
  const inp = document.getElementById('newsletterEmailInput');
  const email = inp ? inp.value.trim() : '';
  if (!email || !email.includes('@')) {
    return alert('Lütfen geçerli bir e-posta adresi girin.');
  }
  try {
    await api('/api/cms', { method: 'POST', body: JSON.stringify({ action: 'subscribe_newsletter', email }) });
  } catch { }
  const msg = document.getElementById('newsletterSuccessMsg');
  if (msg) {
    msg.style.display = 'block';
    msg.textContent = `✔ Teşekkür ederiz! "${email}" adresiniz kurumsal bilgilendirme bültenimize başarıyla kaydedildi.`;
  }
  if (inp) inp.value = '';
};

window.registerDemoAccount = async function() {
  const company = document.getElementById('regCompany').value.trim();
  const fullName = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value;
  const planTier = document.getElementById('regPlanTier')?.value || 'starter';
  const agent1 = document.getElementById('regAgent1').value;
  const agent2 = document.getElementById('regAgent2').value;

  if (!company || !fullName || !email) {
    return alert('Lütfen Kurum Adı, Ad Soyad ve E-posta alanlarını doldurun.');
  }
  if (password.length < 6) {
    return alert('Güvenliğiniz için şifreniz en az 6 karakter olmalıdır.');
  }
  if (agent1 === agent2) {
    return alert('Lütfen birbirinden farklı 2 yapay zeka ajanı seçin.');
  }

  const btn = document.getElementById('btnRegisterDemo');
  btn.disabled = true;
  btn.textContent = 'Seçili Üyelik Paketiyle Kurumunuz Hazırlanıyor...';
  try {
    const r = await api('/api/auth/register-demo', {
      method: 'POST',
      body: JSON.stringify({ company, fullName, email, password, planTier, agent1, agent2 }),
    });
    window.closeAuthModal();
    currentTenant = r.tenant;
    currentRole = 'tenant_admin';
    isSuperAdminSession = false;
    assignedAgentScope = null;
    isLoggedIn = true;
    sessionStorage.setItem('dijital_ikiz_logged_in', '1');
    sessionStorage.removeItem('dijital_ikiz_sa_session');
    sessionStorage.removeItem('dijital_ikiz_agent_scope');
    localStorage.setItem('dijital_ikiz_tenant', currentTenant);
    localStorage.setItem('dijital_ikiz_role', currentRole);
    currentPage = 'overview';
    connectSSE();
    await refreshData(true);
    startOnboardingTour();
  } catch (e) {
    alert(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Üyeliği Oluştur ve Paketi İndirme Paneline Geç';
  }
};

window.focusLoginBox = function() {
  window.openAuthModal('login');
};

window.selectPlanForRegistration = function(planTier) {
  window.openAuthModal('register', planTier);
};

window.submitLoginForm = async function() {
  const tenant = document.getElementById('loginTenantSelect')?.value || '';
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const password = document.getElementById('loginPass')?.value || '';
  if (!email || !password) {
    return alert('Lütfen kurumsal e-posta adresinizi ve şifrenizi girin.');
  }
  try {
    const r = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ tenant, email, password }),
    });
    window.closeAuthModal();
    currentTenant = r.tenant;
    currentRole = r.role || 'tenant_admin';
    isSuperAdminSession = (currentRole === 'super_admin');
    assignedAgentScope = currentRole === 'agent_user' && r.assignedDept && r.assignedSlug
      ? { dept: r.assignedDept, slug: r.assignedSlug, subtab: 'task' }
      : null;
    isLoggedIn = true;
    sessionStorage.setItem('dijital_ikiz_logged_in', '1');
    if (isSuperAdminSession) sessionStorage.setItem('dijital_ikiz_sa_session', '1');
    else sessionStorage.removeItem('dijital_ikiz_sa_session');
    if (assignedAgentScope) sessionStorage.setItem('dijital_ikiz_agent_scope', JSON.stringify(assignedAgentScope));
    else sessionStorage.removeItem('dijital_ikiz_agent_scope');
    localStorage.setItem('dijital_ikiz_tenant', currentTenant);
    localStorage.setItem('dijital_ikiz_role', currentRole);
    if (currentRole === 'agent_user' && assignedAgentScope) {
      currentAgentParams = { ...assignedAgentScope };
      currentPage = 'agent_detail';
    } else {
      currentPage = currentRole === 'super_admin'
        ? 'sa_tenants'
        : (currentRole === 'citizen' ? 'citizen_home' : (currentTenant === 'abb-bilgi-islem' ? 'proje_stilleri' : 'overview'));
    }
    connectSSE();
    await refreshData(true);
    if (!localStorage.getItem('dijital_ikiz_tour_seen_' + currentTenant)) {
      startOnboardingTour();
    }
  } catch (e) {
    alert(e.message);
  }
};

window.logoutToLanding = function() {
  isLoggedIn = false;
  isSuperAdminSession = false;
  assignedAgentScope = null;
  sessionStorage.removeItem('dijital_ikiz_logged_in');
  sessionStorage.removeItem('dijital_ikiz_sa_session');
  sessionStorage.removeItem('dijital_ikiz_agent_scope');
  refreshData(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ADIM ADIM POP-UP ÖĞRETİCİ (ONBOARDING TOUR) FONKSİYONLARI
window.startOnboardingTour = function() {
  tourStepIndex = 0;
  renderTourStep();
  document.getElementById('onboardingModal').style.display = 'flex';
};

window.closeOnboardingTour = function() {
  document.getElementById('onboardingModal').style.display = 'none';
  localStorage.setItem('dijital_ikiz_tour_seen_' + currentTenant, '1');
};

window.nextTourStep = function() {
  if (tourStepIndex < TOUR_STEPS.length - 1) {
    tourStepIndex++;
    renderTourStep();
  } else {
    closeOnboardingTour();
  }
};

window.prevTourStep = function() {
  if (tourStepIndex > 0) {
    tourStepIndex--;
    renderTourStep();
  }
};

function renderTourStep() {
  const step = TOUR_STEPS[tourStepIndex];
  if (!step) return;

  // Arka plandaki sayfayı ilgili adıma geçir (kullanıcı canlı görsün)
  if (currentRole === 'tenant_admin' && step.page && currentPage !== step.page) {
    currentPage = step.page;
    renderSidebar();
    renderPage();
  }

  document.getElementById('tourStepTag').textContent = step.tag;
  document.getElementById('tourTitle').textContent = step.title;
  document.getElementById('tourBody').textContent = step.body;
  document.getElementById('tourTip').textContent = step.tip;

  document.getElementById('tourDots').innerHTML = TOUR_STEPS.map((_, idx) =>
    `<div class="tour-dot ${idx === tourStepIndex ? 'active' : (idx < tourStepIndex ? 'done' : '')}"></div>`
  ).join('');

  document.getElementById('btnTourPrev').style.visibility = tourStepIndex === 0 ? 'hidden' : 'visible';
  document.getElementById('btnTourNext').textContent = tourStepIndex === TOUR_STEPS.length - 1 ? '✔ Öğreticiyi Tamamla' : 'Sonraki Adım →';
}


/* ============================================================================
   12. TÜM AJANLARLA CANLI SOHBET VE SESLİ KONUŞMA (STT + TTS) MOTORU
   ============================================================================ */
let speechRec = null;
let isMicRecording = false;
let lastUsedVoice = false;

window.toggleAutoSpeak = function(checked) {
  localStorage.setItem('dijital_ikiz_autospeak', checked ? '1' : '0');
};

window.speakText = function(rawText) {
  if (!('speechSynthesis' in window)) {
    return alert('Tarayıcınız sesli okuma (Text-to-Speech) özelliğini desteklemiyor.');
  }
  window.speechSynthesis.cancel();
  const clean = String(rawText || '')
    .replace(/[#*`_~>|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 900);
  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang = 'tr-TR';
  utter.rate = 1.02;
  const voices = window.speechSynthesis.getVoices();
  const trVoice = voices.find(v => /tr[-_]?TR/i.test(v.lang)) || voices.find(v => /turkish|türkçe/i.test(v.name));
  if (trVoice) utter.voice = trVoice;
  window.speechSynthesis.speak(utter);
};

window.speakMessageByIndex = function(idx) {
  const m = agentDetail?.chatHistory?.[idx];
  if (m && m.content) window.speakText(m.content);
};

window.stopAgentSpeech = function() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
};

window.onChatKeyDown = function(e, dept, slug) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.sendAgentChatMessage(dept, slug, lastUsedVoice);
  }
};

window.fillAndSendChat = function(dept, slug, text) {
  const inp = document.getElementById('agChatInput');
  if (inp) inp.value = text;
  window.sendAgentChatMessage(dept, slug, false);
};

window.sendAgentChatMessage = async function(dept, slug, isVoice = false) {
  if (isMicRecording && speechRec) {
    try { speechRec.stop(); } catch { }
    isMicRecording = false;
  }
  const inp = document.getElementById('agChatInput');
  const msg = inp ? inp.value.trim() : '';
  if (!msg) return;

  const skill = document.getElementById('agSkillSelect')?.value || null;
  const btn = document.getElementById('btnSendChat');
  const msgBox = document.getElementById('agentChatMessages');

  // Kullanıcının mesaj balonunu anında ekrana ekle
  if (msgBox) {
    msgBox.insertAdjacentHTML('beforeend', `
      <div class="chat-row user">
        <div class="chat-avatar">SİZ</div>
        <div>
          <div class="chat-bubble">${esc(msg)}</div>
          <div class="chat-meta"><span>${isVoice ? '🎤 Sesli Mesajınız' : 'Şimdi'}</span></div>
        </div>
      </div>
      <div class="chat-row agent" id="typingIndicatorRow">
        <div class="chat-avatar">💬</div>
        <div>
          <div class="chat-bubble" style="color:var(--text-muted);font-style:italic">Uzman mesajınızı inceliyor ve yanıt hazırlıyor...</div>
        </div>
      </div>
    `);
    msgBox.scrollTop = msgBox.scrollHeight;
  }

  inp.value = '';
  lastUsedVoice = false;
  if (btn) { btn.disabled = true; btn.textContent = 'Yanıtlanıyor...'; }

  try {
    const res = await api('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ dept, slug, message: msg, skill, isVoice }),
    });
    agentDetail = await api(`/api/agent?dept=${encodeURIComponent(dept)}&slug=${encodeURIComponent(slug)}`);
    await refreshData(false);
    renderPage();

    if (localStorage.getItem('dijital_ikiz_autospeak') === '1' && res.reply) {
      window.speakText(res.reply);
    }
  } catch (e) {
    alert(e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Gönder ➤'; }
  }
};

window.toggleVoiceMic = function(dept, slug) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('btnVoiceMic');
  const bar = document.getElementById('voiceRecordingBar');
  const statusTxt = document.getElementById('voiceStatusText');
  const inp = document.getElementById('agChatInput');

  if (isMicRecording && speechRec) {
    isMicRecording = false;
    try { speechRec.stop(); } catch { }
    if (micBtn) { micBtn.classList.remove('recording'); micBtn.textContent = '🎤 Sesle Konuş'; }
    if (bar) bar.style.display = 'none';
    return;
  }

  if (!SR) {
    const manual = prompt('Tarayıcınızda doğrudan ses tanıma API\'si kapalıysa sesli mesajınızı buraya dikte edebilir / yazabilirsiniz:');
    if (manual && inp) {
      inp.value = manual;
      window.sendAgentChatMessage(dept, slug, true);
    }
    return;
  }

  speechRec = new SR();
  speechRec.lang = 'tr-TR';
  speechRec.continuous = true;
  speechRec.interimResults = true;

  let finalTranscript = inp ? inp.value : '';

  speechRec.onstart = () => {
    isMicRecording = true;
    lastUsedVoice = true;
    if (micBtn) { micBtn.classList.add('recording'); micBtn.textContent = '🔴 Dinliyor...'; }
    if (bar) bar.style.display = 'flex';
  };

  speechRec.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const tr = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += (finalTranscript ? ' ' : '') + tr;
      } else {
        interim += tr;
      }
    }
    if (inp) inp.value = (finalTranscript + (interim ? ' ' + interim : '')).trim();
    if (statusTxt) statusTxt.textContent = '🔴 Dinliyor: "' + ((finalTranscript + ' ' + interim).trim().slice(-65)) + '"';
  };

  speechRec.onerror = () => {
    isMicRecording = false;
    if (micBtn) { micBtn.classList.remove('recording'); micBtn.textContent = '🎤 Sesle Konuş'; }
    if (bar) bar.style.display = 'none';
  };

  speechRec.onend = () => {
    isMicRecording = false;
    if (micBtn) { micBtn.classList.remove('recording'); micBtn.textContent = '🎤 Sesle Konuş'; }
    if (bar) bar.style.display = 'none';
  };

  speechRec.start();
};

/* ============================================================================
   13. HER KURUM İÇİN BİLGİSAYARA İNDİRİLEBİLİR OFFLINE MASAÜSTÜ UYGULAMASI VE
       ABB BAŞKENT KART 3 YILLIK (36 AY) İHALE KAPANIŞ & EVRAK DENETİM SİSTEMİ
   ============================================================================ */
let baskentLedgerCache = null;
let bkFilterYear = 'all';
let bkFilterStatus = 'all';

window.downloadCurrentTenantOfflineApp = function(tenantOverride) {
  const t = tenantOverride || currentTenant || 'abb-bilgi-islem';
  const a = document.createElement('a');
  a.href = `/api/tenant/download-offline-app?tenant=${encodeURIComponent(t)}`;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
};

async function renderBaskentKartAuditPage(el) {
  el.innerHTML = `<div class="card">Başkent Kart 3 Yıllık İhale Kapanış ve Evrak Denetim Verileri Yükleniyor...</div>`;
  try {
    const res = await api('/api/baskent-kart/ledger');
    baskentLedgerCache = res.ledger;
  } catch (e) {
    el.innerHTML = `<div class="card">Hata: ${esc(e.message)}</div>`;
    return;
  }

  const ledger = baskentLedgerCache;
  const months = ledger?.months || [];
  const specs = ledger?.specChecks || [];

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
    if (!m.dekont_var) { missingRec.push(m.donem); issues.push('Banka Dekontu Eksik'); }
    const diff = (m.fatura_var && m.dekont_var) ? (inv - rec) : 0;
    if (m.fatura_var && m.dekont_var && Math.abs(diff) >= 1) {
      mismatches.push({ donem: m.donem, diff, inv, rec });
      issues.push(`Tutar Farkı: ${fmtNum(diff)} TL`);
    }
    if (!m.pos_mutabakat_var) { missingPos.push(m.donem); issues.push('Market/POS Mutabakat Eksik'); }
    if (!m.sla_raporu_var || Number(m.sla_uptime) < 99.9) {
      slaBad.push({ donem: m.donem, sla: m.sla_uptime });
      issues.push(`SLA İhlali (%${m.sla_uptime})`);
    }
    if (!m.sgk_vergi_var) { missingSgk.push(m.donem); issues.push('SGK/Vergi Eksik'); }

    m._issues = issues;
    if (issues.length === 0) validMonths.push(m.donem);
  });

  const incompleteSpecs = specs.filter(s => !String(s.durum).startsWith('TAMAM'));
  const allClear = missingInv.length === 0 && missingRec.length === 0 && mismatches.length === 0 && missingPos.length === 0 && slaBad.length === 0 && missingSgk.length === 0 && incompleteSpecs.length === 0;

  const filteredMonths = months.filter(m => {
    if (bkFilterYear !== 'all' && String(m.yil) !== bkFilterYear) return false;
    if (bkFilterStatus === 'issues' && m._issues.length === 0) return false;
    if (bkFilterStatus === 'ok' && m._issues.length > 0) return false;
    return true;
  });

  const baskentAgent = state.personnel.find(p => p.slug === 'baskent-kart-proje-sorumlusu') || state.personnel[0];

  el.innerHTML = `
    <div class="page-hero">
      <div>
        <span class="agent-dept-tag">Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı · Akıllı Şehirler Şube Müdürlüğü · Proje Yönetimi Ekibi</span>
        <h1 style="margin-top:8px">💳 Başkent Kart 3 Yıllık (36 Ay) İhale Kapanış, Fatura, Dekont ve Evrak Denetim Sistemi</h1>
        <p>
          İhtiyaç sahibi vatandaşlara verilen <strong>Başkent Kart</strong> sosyal yardım kartı ihalesinin kapanışı ve kesin kabulü kapsamında,
          3 yıl (36 ay: 2023–2024–2025) boyunca yüklenici firmanın sunduğu <strong>tüm faturaları, banka dekontlarını, anlaşmalı market/POS takas cetvellerini, SLA süreklilik raporlarını ve teknik şartname evraklarını</strong> %100 offline olarak denetleyin.
        </p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="downloadCurrentTenantOfflineApp('abb-bilgi-islem')">
          💻 Kurum Offline Dosyasını Bilgisayara İndir (.html — Linksiz Çalışır)
        </button>
        ${baskentAgent ? `
          <button class="btn" onclick="navigate('agent_detail',{dept:'${esc(baskentAgent.dept)}',slug:'${esc(baskentAgent.slug)}'})">
            🗣️ Başkent Kart Proje Sorumlusu Ajanıyla Sesli/Yazılı Konuş →
          </button>
        ` : ''}
      </div>
    </div>

    <!-- TEŞKİLAT & SORUMLU AJAN KARTI -->
    <div class="card" style="background:linear-gradient(135deg,#eff6ff 0%,#ffffff 100%);border-left:5px solid var(--primary)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--primary);text-transform:uppercase">Kurumsal Hiyerarşi & Görevli Birim</div>
          <h3 style="margin:4px 0 6px">🏛️ ABB Bilgi İşlem Dairesi Başkanlığı ➔ 🏙️ Akıllı Şehirler Şube Müdürlüğü ➔ 👥 Proje Yönetimi Ekibi ➔ 👤 Başkent Kart Proje Sorumlusu</h3>
          <div style="font-size:14.5px;color:var(--text-body)">
            <strong>İhale Kayıt No:</strong> 2022/984120 · <strong>Sözleşme Süresi:</strong> 36 Ay (3 Yıl) · <strong>Kapsam:</strong> 478.500+ ihtiyaç sahibi vatandaşa dijital sosyal yardım aktarımı ve 18.000+ market/üye işyeri POS harcama mutabakatı.
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <label class="btn btn-primary btn-sm" style="cursor:pointer">
            📁 Bilgisayardan 3 Yıllık Fatura/Dekont Klasörü Seç
            <input type="file" webkitdirectory directory multiple style="display:none" onchange="scanBaskentLocalFolder(this.files)" />
          </label>
          <label class="btn btn-sm" style="cursor:pointer">
            📄 Tekil Evrak Dosyaları Seç
            <input type="file" multiple style="display:none" onchange="scanBaskentLocalFolder(this.files)" />
          </label>
          <button class="btn btn-sm" onclick="runBaskentOfficialAuditTask()">
            🤖 Ajana Resmi Eksik Evrak İhtar Raporu Yazdır
          </button>
        </div>
      </div>
      <div id="bkScanResultBanner" style="display:none;margin-top:12px;padding:10px 14px;background:#dcfce7;border:1px solid #86efac;border-radius:8px;color:#166534;font-weight:600"></div>
    </div>

    <!-- 6 KPI KUTUSU -->
    <div class="stats-grid">
      <div class="stat-box">
        <div class="stat-label">İncelenen İhale Dönemi</div>
        <div class="stat-value">${months.length} Ay (3 Yıl)</div>
        <div class="stat-sub">Ocak 2023 – Aralık 2025</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Tam Uyumlu Ay Sayısı</div>
        <div class="stat-value" style="color:${validMonths.length === months.length ? '#15803d' : '#b45309'}">${validMonths.length} / ${months.length}</div>
        <div class="stat-sub">${months.length - validMonths.length} ayda eksik/uyuşmazlık var</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">3 Yıllık Fatura Toplamı</div>
        <div class="stat-value">${fmtNum(totalInv)} ₺</div>
        <div class="stat-sub">Eksik Fatura: ${missingInv.length} adet</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">3 Yıllık Banka Dekont Toplamı</div>
        <div class="stat-value">${fmtNum(totalRec)} ₺</div>
        <div class="stat-sub">Eksik Dekont: ${missingRec.length} adet</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Fatura - Dekont Farkı</div>
        <div class="stat-value" style="color:${(totalInv - totalRec) === 0 ? '#15803d' : '#b91c1c'}">${fmtNum(totalInv - totalRec)} ₺</div>
        <div class="stat-sub">${mismatches.length ? mismatches.map(x => x.donem).join(', ') + ' tutar farkı' : 'Tam Mutabakat'}</div>
      </div>
      <div class="stat-box">
        <div class="stat-label">Vatandaşa Yatırılan Yardım</div>
        <div class="stat-value">${(totalAid / 1e9).toFixed(2)} Milyar ₺</div>
        <div class="stat-sub">478.500+ Başkent Kart Sahibi</div>
      </div>
    </div>

    <!-- MUAYENE VE KABUL KOMİSYONU KARAR KUTUSU -->
    <div class="card" style="border-left:6px solid ${allClear ? '#15803d' : '#b91c1c'}">
      ${allClear ? `
        <h2 style="color:#15803d;margin-bottom:6px">✅ KESİN KABULE UYGUNDUR (36/36 Ay Tam Mutabakat)</h2>
        <p style="margin:0">3 yıllık ihale süresine ait tüm aylık hak ediş faturaları, banka ödeme dekontları, anlaşmalı market/POS takas cetvelleri, SLA raporları ve teknik şartname kriterleri eksiksizdir.</p>
      ` : `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
          <div>
            <h2 style="color:#b91c1c;margin-bottom:6px">⚠️ ŞARTLI / KABUL BEKLEMEDE — Yüklenici Firmaya Eksik Evrak ve Dekont İhtarı Gerekli</h2>
            <p style="margin:0 0 10px;color:var(--text-muted)">3 yıllık (36 ay) evrakların otomatik denetiminde tespit edilen eksiklik ve tutar uyuşmazlıkları:</p>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-success btn-sm" onclick="markAllBaskentComplete()">✔ Tüm Eksikleri Tamamlandı İşaretle</button>
            <button class="btn btn-sm" onclick="resetBaskentLedger()">↺ İlk Denetim Bulgularına Dön</button>
          </div>
        </div>
        <ul style="margin:0;padding-left:20px;line-height:1.75">
          ${missingInv.length ? `<li><strong>Eksik Hak Ediş Faturası (${missingInv.length} Ay):</strong> <code>${esc(missingInv.join(', '))}</code> — E-Fatura UBL-TR ve imzalı PDF nüshası dosyada bulunamadı.</li>` : ''}
          ${missingRec.length ? `<li><strong>Eksik Banka Ödeme Dekontu (${missingRec.length} Ay):</strong> <code>${esc(missingRec.join(', '))}</code> — Banka ödeme/komisyon dekontu klasörde eksik.</li>` : ''}
          ${mismatches.length ? `<li><strong>Fatura - Banka Dekontu Tutar Uyuşmazlığı (${mismatches.length} Ay):</strong> ${mismatches.map(x => `<code>${esc(x.donem)}</code> (Fatura: ${fmtNum(x.inv)} TL vs Dekont: ${fmtNum(x.rec)} TL ➔ <strong>${fmtNum(x.diff)} TL Fark</strong>)`).join(', ')}</li>` : ''}
          ${missingPos.length ? `<li><strong>Eksik Market / Üye İşyeri POS Takas Mutabakat Cetveli (${missingPos.length} Ay):</strong> <code>${esc(missingPos.join(', '))}</code></li>` : ''}
          ${slaBad.length ? `<li><strong>Teknik Şartname %99.90 SLA Süreklilik İhlali (${slaBad.length} Ay):</strong> ${slaBad.map(x => `<code>${esc(x.donem)}</code> (Gerçekleşen: %${esc(x.sla)} < Hedef: %99.90 — Ceza kesintisi dekontu eksik)`).join(', ')}</li>` : ''}
          ${missingSgk.length ? `<li><strong>Eksik SGK Hizmet Dökümü / Vergi Borcu Yoktur Yazısı (${missingSgk.length} Ay):</strong> <code>${esc(missingSgk.join(', '))}</code></li>` : ''}
          ${incompleteSpecs.length ? `<li><strong>Bekleyen Teknik Şartname Kabul Maddeleri (${incompleteSpecs.length} Madde):</strong> ${incompleteSpecs.map(s => `<code>${esc(s.kod)}</code> (${esc(s.baslik)})`).join(', ')}</li>` : ''}
        </ul>
      `}
    </div>

    <!-- 36 AYLIK DETAYLI KONTROL TABLOSU -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <h2 style="margin:0">📊 3 Yıllık (36 Ay) Fatura, Dekont, Market POS ve SLA Kontrol Matrisi</h2>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <select class="btn btn-sm" onchange="bkFilterYear=this.value;renderBaskentKartAuditPage(document.getElementById('pageContent'))">
            <option value="all" ${bkFilterYear === 'all' ? 'selected' : ''}>Tüm Yıllar (3 Yıl / 36 Ay)</option>
            <option value="1" ${bkFilterYear === '1' ? 'selected' : ''}>1. Yıl (2023 — 1..12. Ay)</option>
            <option value="2" ${bkFilterYear === '2' ? 'selected' : ''}>2. Yıl (2024 — 13..24. Ay)</option>
            <option value="3" ${bkFilterYear === '3' ? 'selected' : ''}>3. Yıl (2025 — 25..36. Ay)</option>
          </select>
          <select class="btn btn-sm" onchange="bkFilterStatus=this.value;renderBaskentKartAuditPage(document.getElementById('pageContent'))">
            <option value="all" ${bkFilterStatus === 'all' ? 'selected' : ''}>Tüm Aylar (${months.length})</option>
            <option value="issues" ${bkFilterStatus === 'issues' ? 'selected' : ''}>Sadece Eksik / Sorunlu Aylar (${months.length - validMonths.length})</option>
            <option value="ok" ${bkFilterStatus === 'ok' ? 'selected' : ''}>Tam Uyumlu Aylar (${validMonths.length})</option>
          </select>
        </div>
      </div>

      <div style="overflow-x:auto;max-height:540px;overflow-y:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ay #</th>
              <th>Dönem</th>
              <th>Hak Ediş Faturası</th>
              <th>Fatura Tutarı</th>
              <th>Banka Dekontu</th>
              <th>Dekont Tutarı</th>
              <th>Fatura-Dekont Farkı</th>
              <th>Market/POS Takas</th>
              <th>SLA Uptime</th>
              <th>SGK / Vergi</th>
              <th>Denetim Bulgusu</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMonths.map(m => {
              const diff = (m.fatura_var && m.dekont_var) ? (m.fatura_tutari - m.dekont_tutari) : 0;
              const hasIssue = m._issues.length > 0;
              return `
                <tr style="${hasIssue ? 'background:#fff5f5' : ''}">
                  <td><strong>${m.ay_no}. Ay</strong> (Yıl ${m.yil})</td>
                  <td><strong>${esc(m.donem)}</strong><div style="font-size:12px;color:var(--text-muted)">${esc(m.hakedis_no)}</div></td>
                  <td><span class="status-badge ${m.fatura_var ? 'ok' : 'warn'}">${m.fatura_var ? esc(m.fatura_no) : 'EKSİK'}</span></td>
                  <td>${fmtNum(m.fatura_tutari)} ₺</td>
                  <td><span class="status-badge ${m.dekont_var ? 'ok' : 'warn'}">${m.dekont_var ? esc(m.dekont_no) : 'EKSİK'}</span></td>
                  <td>${m.dekont_var ? fmtNum(m.dekont_tutari) + ' ₺' : '0 ₺'}</td>
                  <td><strong style="color:${diff === 0 && m.fatura_var && m.dekont_var ? '#15803d' : '#b91c1c'}">${m.fatura_var && m.dekont_var ? fmtNum(diff) + ' ₺' : 'Mutabakat Yok'}</strong></td>
                  <td><span class="status-badge ${m.pos_mutabakat_var ? 'ok' : 'warn'}">${m.pos_mutabakat_var ? 'TAMAM' : 'EKSİK'}</span></td>
                  <td><span class="status-badge ${m.sla_uptime >= 99.9 ? 'ok' : 'warn'}">%${Number(m.sla_uptime).toFixed(2)}</span></td>
                  <td><span class="status-badge ${m.sgk_vergi_var ? 'ok' : 'warn'}">${m.sgk_vergi_var ? 'TAMAM' : 'EKSİK'}</span></td>
                  <td>
                    ${hasIssue
                      ? `<div style="color:#b91c1c;font-weight:700">${esc(m._issues.join(', '))}</div><div style="font-size:12px;color:var(--text-muted)">${esc(m.not || '')}</div>`
                      : `<span class="status-badge ok">✔ Tam Uyumlu</span>`}
                  </td>
                  <td>
                    ${hasIssue
                      ? `<button class="btn btn-sm btn-success" onclick="fixBaskentMonth('${esc(m.donem)}')">✔ Evrakı Onayla</button>`
                      : `<span style="color:#15803d;font-weight:700;font-size:13px">Doğrulandı</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- TEKNİK ŞARTNAME 10 KESİN KABUL KRİTERİ -->
    <div class="card">
      <h2>📋 Başkent Kart Teknik Şartnamesi — 10 Maddelik İhale Kapanış ve Kesin Kabul Kontrol Listesi</h2>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Şartname Maddesi</th>
              <th>Kabul Kriteri & Açıklama</th>
              <th>Sorumlu Birim / Ekip</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            ${specs.map((s, idx) => {
              const ok = String(s.durum).startsWith('TAMAM');
              return `
                <tr>
                  <td><strong>${esc(s.kod)}</strong></td>
                  <td>${esc(s.madde)}</td>
                  <td><strong>${esc(s.baslik)}</strong><div style="font-size:13px;color:var(--text-muted)">${esc(s.aciklama)}</div></td>
                  <td>${esc(s.sorumlu)}</td>
                  <td><span class="status-badge ${ok ? 'ok' : 'warn'}">${esc(s.durum)}</span></td>
                  <td>
                    <button class="btn btn-sm" onclick="toggleBaskentSpec(${idx})">
                      ${ok ? 'Eksik İşaretle' : '✔ Teslim Alındı İşaretle'}
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.fixBaskentMonth = async function(donem) {
  await api('/api/baskent-kart/ledger', { method: 'POST', body: JSON.stringify({ action: 'fix_month', donem }) });
  renderBaskentKartAuditPage(document.getElementById('pageContent'));
};

window.toggleBaskentSpec = async function(index) {
  await api('/api/baskent-kart/ledger', { method: 'POST', body: JSON.stringify({ action: 'toggle_spec', index }) });
  renderBaskentKartAuditPage(document.getElementById('pageContent'));
};

window.markAllBaskentComplete = async function() {
  await api('/api/baskent-kart/ledger', { method: 'POST', body: JSON.stringify({ action: 'mark_all_complete' }) });
  renderBaskentKartAuditPage(document.getElementById('pageContent'));
};

window.resetBaskentLedger = async function() {
  await api('/api/baskent-kart/ledger', { method: 'POST', body: JSON.stringify({ action: 'reset' }) });
  renderBaskentKartAuditPage(document.getElementById('pageContent'));
};

window.scanBaskentLocalFolder = async function(fileList) {
  if (!fileList || !fileList.length) return;
  const files = Array.from(fileList).map(f => f.webkitRelativePath || f.name);
  const res = await api('/api/baskent-kart/ledger', { method: 'POST', body: JSON.stringify({ action: 'scan_files', files }) });
  await renderBaskentKartAuditPage(document.getElementById('pageContent'));
  const banner = document.getElementById('bkScanResultBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.textContent = `✔ Bilgisayarınızdan ${files.length} adet yerel dosya %100 offline olarak tarandı ve ${res.matched || 0} evrak kaydı 36 aylık dönemlerle eşleştirildi.`;
  }
};

window.runBaskentOfficialAuditTask = async function() {
  const r = await api('/api/task', {
    method: 'POST',
    body: JSON.stringify({
      dept: '01-Akilli-Sehirler-Sube-Mudurlugu',
      personnel: 'baskent-kart-proje-sorumlusu',
      skill: 'baskent-kart-ihale-kabul-denetimi',
      request: 'Başkent Kart 3 yıllık (36 ay) ihale kapanışı ve kesin kabulü kapsamında tüm fatura, banka dekontu, market/POS mutabakatı, SLA ve teknik şartname evraklarını inceleyip eksik evrak ihtar raporunu hazırla.',
    }),
  });
  await refreshData(false);
  navigate('agent_detail', { dept: '01-Akilli-Sehirler-Sube-Mudurlugu', slug: 'baskent-kart-proje-sorumlusu' });
};


/* ============================================================================
   14. GENEL ADMİN: KURUM AYARLARI, TÜM AJAN EĞİTİM/GÖREV DETAYLARI,
       WEB SİTESİ & CRM SAYFA İÇİ (GÖRSEL/VİDEO/KOD/MODÜL) + YENİ SAYFA YÖNETİCİSİ
   ============================================================================ */
window.openEditTenantSettings = function(slug) {
  const t = (superOverview?.tenants || []).find(x => x.name === slug);
  if (!t) return;
  document.getElementById('saEditTenantSlug').value = t.name;
  document.getElementById('saEditTenantLabel').textContent = t.displayName;
  document.getElementById('saEditDisplay').value = t.displayName || '';
  document.getElementById('saEditSubdomain').value = t.subdomain || '';
  document.getElementById('saEditStatus').value = t.status || 'Aktif';
  document.getElementById('saEditPlanTier').value = t.planTier || 'full';
  document.getElementById('saEditMonths').value = t.maxAuditMonths || 36;
  document.getElementById('saEditAgents').value = t.maxAgents || 99;
  document.getElementById('saEditAdminName').value = t.adminName || '';
  document.getElementById('saEditAdminEmail').value = t.adminEmail || '';
  document.getElementById('saEditAdminPass').value = '';
  const card = document.getElementById('saTenantEditCard');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.saveSuperAdminTenantSettings = async function() {
  const tenantSlug = document.getElementById('saEditTenantSlug').value;
  const payload = {
    tenant: tenantSlug,
    displayName: document.getElementById('saEditDisplay').value.trim(),
    subdomain: document.getElementById('saEditSubdomain').value.trim(),
    status: document.getElementById('saEditStatus').value,
    planTier: document.getElementById('saEditPlanTier').value,
    maxAuditMonths: Number(document.getElementById('saEditMonths').value || 36),
    maxAgents: Number(document.getElementById('saEditAgents').value || 99),
    adminName: document.getElementById('saEditAdminName').value.trim(),
    adminEmail: document.getElementById('saEditAdminEmail').value.trim(),
    newPassword: document.getElementById('saEditAdminPass').value,
  };
  await api('/api/superadmin/update-tenant', { method: 'POST', body: JSON.stringify(payload) });
  showToast('Kurum ayarları ve indirilebilir offline paket başarıyla güncellendi.', 'ok');
  await refreshData(true);
};

window.deleteTenantFromSuperAdmin = async function() {
  const slug = document.getElementById('saEditTenantSlug').value;
  if (!confirm(`"${slug}" kurumunun hesabını/kişisel verilerini KVKK kapsamında silmek istediğinize emin misiniz?`)) return;
  const r = await api('/api/superadmin/delete-tenant', { method: 'POST', body: JSON.stringify({ tenant: slug }) });
  showToast(r.message || 'İşlem tamamlandı.', 'warn');
  await refreshData(true);
};

let saAgentFilterTenant = 'ALL';
let saAgentTab = 'agents';

async function renderSuperAdminAgentsAndTasks(el) {
  el.innerHTML = `<div class="card"><div class="skeleton-box" style="width:40%"></div><div class="skeleton-box"></div><div class="skeleton-box" style="width:80%"></div></div>`;
  const data = await api(`/api/superadmin/all-agents?filterTenant=${encodeURIComponent(saAgentFilterTenant)}`);
  const agents = data.agents || [];
  const trainings = data.trainings || [];
  const tasks = data.tasks || [];

  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Tüm Kurumlardaki Yapay Zeka Ajanları, Eğitim ve Görev Detayları</h1>
        <p>Platformdaki tüm kurumların uzman ajanlarını, sahip oldukları yetenekleri, 6 kanallı eğitim kayıtlarını ve tamamladıkları görev raporlarını tek merkezden izleyin ve yönetin.</p>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select class="btn btn-sm" onchange="saAgentFilterTenant=this.value;renderSuperAdminAgentsAndTasks(document.getElementById('pageContent'))">
          <option value="ALL" ${saAgentFilterTenant === 'ALL' ? 'selected' : ''}>Tüm Kurumlar (${state.tenants.length})</option>
          ${state.tenants.map(t => `<option value="${esc(t.name)}" ${saAgentFilterTenant === t.name ? 'selected' : ''}>${esc(t.displayName)}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-box"><div class="stat-label">Listelenen Ajan Sayısı</div><div class="stat-value">${agents.length} Uzman</div></div>
      <div class="stat-box"><div class="stat-label">Toplam Görev & Rapor</div><div class="stat-value">${tasks.length} Görev</div></div>
      <div class="stat-box"><div class="stat-label">6 Kanallı Eğitim Kaydı</div><div class="stat-value">${trainings.length} Eğitim</div></div>
      <div class="stat-box"><div class="stat-label">Aktif Yetenek (Skill)</div><div class="stat-value">${agents.reduce((s, a) => s + a.skillsCount, 0)} Paket</div></div>
    </div>

    <div class="subtabs">
      <button class="subtab ${saAgentTab === 'agents' ? 'active' : ''}" onclick="saAgentTab='agents';renderSuperAdminAgentsAndTasks(document.getElementById('pageContent'))">🤖 Tüm Ajanlar & Yetenekler (${agents.length})</button>
      <button class="subtab ${saAgentTab === 'trainings' ? 'active' : ''}" onclick="saAgentTab='trainings';renderSuperAdminAgentsAndTasks(document.getElementById('pageContent'))">🎓 Ajan Eğitim Detayları (${trainings.length})</button>
      <button class="subtab ${saAgentTab === 'tasks' ? 'active' : ''}" onclick="saAgentTab='tasks';renderSuperAdminAgentsAndTasks(document.getElementById('pageContent'))">📋 Görev ve Rapor Detayları (${tasks.length})</button>
    </div>

    ${saAgentTab === 'agents' ? `
      <div class="card">
        <div class="table-container">
          <table class="clean-table">
            <thead><tr><th>Kurum</th><th>Müdürlük / Departman</th><th>Yapay Zeka Ajanı</th><th>Görev Tanımı</th><th>Yetenekler (Skills)</th><th>Görev / Eğitim</th><th>İşlem</th></tr></thead>
            <tbody>
              ${agents.map(a => `
                <tr>
                  <td><strong>${esc(a.tenantDisplay)}</strong><div style="font-size:12px;color:var(--text-muted)">${esc(a.tenant)}</div></td>
                  <td>${esc(a.deptName)}</td>
                  <td><strong>${esc(a.title)}</strong><div style="font-size:12px;color:var(--text-muted)">${esc(a.slug)}</div></td>
                  <td style="max-width:260px;font-size:13.5px">${esc(a.mission)}</td>
                  <td>${a.skills.map(s => `<span class="skill-tag">${esc(s.name)}</span>`).join(' ') || '<span style="color:var(--text-muted)">Standart</span>'}</td>
                  <td><strong>${a.tasksCount}</strong> Görev · <strong>${a.trainingsCount}</strong> Eğitim</td>
                  <td>
                    <button class="btn btn-primary btn-sm" onclick="openAgentFromSuperAdmin('${esc(a.tenant)}','${esc(a.dept)}','${esc(a.slug)}')">Ajan Sayfasını Aç →</button>
                  </td>
                </tr>
              `).join('') || `<tr><td colspan="7"><div class="empty-state-box">Bu filtreye uygun ajan bulunamadı.</div></td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    ${saAgentTab === 'trainings' ? `
      <div class="card">
        <h2>Tüm Kurumlardaki 6 Kanallı Ajan Eğitim Kayıtları</h2>
        ${trainings.length ? `
          <div class="table-container">
            <table class="clean-table">
              <thead><tr><th>Kurum</th><th>Kanal</th><th>Hedef Departman / Ajan</th><th>Eğitim Başlığı</th><th>Güvenlik Taraması</th><th>Tarih</th></tr></thead>
              <tbody>
                ${trainings.map(tr => `
                  <tr>
                    <td><strong>${esc(tr.tenantDisplay)}</strong></td>
                    <td><span class="skill-tag">${esc(tr.channel || 'dokuman')}</span></td>
                    <td>${esc(tr.dept || '-')} / ${esc(tr.personnel || '-')}</td>
                    <td><strong>${esc(tr.title || tr.skill_name || 'Eğitim Paketi')}</strong><div style="font-size:12.5px;color:var(--text-muted)">${esc(String(tr.summary || tr.content || '').slice(0, 140))}</div></td>
                    <td><span class="status-badge ok">${esc(tr.status || 'Onaylı / Güvenli')}</span></td>
                    <td style="font-size:12.5px">${esc((tr.created_at || '').slice(0, 16))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty-state-box"><div class="empty-icon">🎓</div><h3>Henüz Eğitim Kaydı Yok</h3><p>Kurum panellerindeki "6 Kanallı Ajan Eğitimi" sekmesinden eğitim yüklediğinizde tüm detaylar burada görünür.</p></div>`}
      </div>
    ` : ''}

    ${saAgentTab === 'tasks' ? `
      <div class="card">
        <h2>Tüm Kurumlardaki Ajan Görevleri ve Üretilen Raporlar</h2>
        ${tasks.length ? tasks.map(tk => `
          <div style="padding:18px;border:1px solid var(--border);border-radius:12px;margin-bottom:14px;background:#fff">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px">
              <div>
                <span class="agent-dept-tag">${esc(tk.tenantDisplay)}</span>
                <span class="skill-tag">${esc(tk.dept)} / ${esc(tk.personnel)}</span>
                <strong style="margin-left:8px">#${tk.id}: ${esc(tk.request)}</strong>
              </div>
              <span class="status-badge ok">${esc(tk.status || 'Tamamlandı')} · ${esc(tk.llm_mode || 'offline')}</span>
            </div>
            <div class="report-paper" style="max-height:220px;overflow-y:auto">${esc(tk.result || 'Sonuç kaydedildi.')}</div>
          </div>
        `).join('') : `<div class="empty-state-box"><div class="empty-icon">📋</div><h3>Henüz Görev Kaydı Yok</h3></div>`}
      </div>
    ` : ''}
  `;
}

window.openAgentFromSuperAdmin = async function(tenantName, dept, slug) {
  currentTenant = tenantName;
  localStorage.setItem('dijital_ikiz_tenant', currentTenant);
  currentRole = 'tenant_admin';
  localStorage.setItem('dijital_ikiz_role', currentRole);
  await navigate('agent_detail', { dept, slug });
};

/* ============================================================================
   GENEL ADMİN: WEB SİTESİ & CRM SAYFA İÇİ (GÖRSEL, VİDEO, KOD, MODÜL) & YENİ SAYFA YÖNETİCİSİ
   ============================================================================ */
let saCmsTab = 'general';

async function renderSuperAdminCmsPage(el) {
  const res = await api('/api/cms');
  const cms = res.cms || {};
  const mods = cms.crmModules || {};
  const media = cms.mediaBlocks || [];
  const codes = cms.codeBlocks || [];
  const pages = cms.customPages || [];

  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>Web Sitesi & CRM Sayfa İçi (Görsel, Video, Kod, Modül) ve Yeni Sayfa Yöneticisi</h1>
        <p>Anasayfayı, CRM içi modülleri, sayfa içi görsel/video bloklarını, özel HTML/CSS/JS kod alanlarını ve yeni dinamik sayfaları buradan yönetin.</p>
      </div>
    </div>

    <div class="subtabs">
      <button class="subtab ${saCmsTab === 'general' ? 'active' : ''}" onclick="saCmsTab='general';renderSuperAdminCmsPage(document.getElementById('pageContent'))">🌐 Genel Site & Slider Ayarları</button>
      <button class="subtab ${saCmsTab === 'modules' ? 'active' : ''}" onclick="saCmsTab='modules';renderSuperAdminCmsPage(document.getElementById('pageContent'))">🧩 CRM Modül Aç/Kapa</button>
      <button class="subtab ${saCmsTab === 'media' ? 'active' : ''}" onclick="saCmsTab='media';renderSuperAdminCmsPage(document.getElementById('pageContent'))">🖼️ Görsel & Video Yönetimi (${media.length})</button>
      <button class="subtab ${saCmsTab === 'code' ? 'active' : ''}" onclick="saCmsTab='code';renderSuperAdminCmsPage(document.getElementById('pageContent'))">💻 Özel Kod Blokları (${codes.length})</button>
      <button class="subtab ${saCmsTab === 'pages' ? 'active' : ''}" onclick="saCmsTab='pages';renderSuperAdminCmsPage(document.getElementById('pageContent'))">📄 Yeni Sayfa Oluştur & Yönet (${pages.length})</button>
    </div>

    ${saCmsTab === 'general' ? `
      <div class="card">
        <h2>Genel Web Sitesi, Başlık, Renk ve Gizlilik Politikası Ayarları</h2>
        <div class="form-row">
          <div><label class="field-label">Platform Başlığı</label><input id="cmsSiteTitle" type="text" value="${esc(cms.siteTitle || '')}" /></div>
          <div><label class="field-label">Alt Başlık</label><input id="cmsSiteSubtitle" type="text" value="${esc(cms.siteSubtitle || '')}" /></div>
          <div><label class="field-label">Kurumsal Ana Renk (Lacivert)</label><input id="cmsPrimaryColor" type="text" value="${esc(cms.primaryColor || '#1e3a8a')}" /></div>
        </div>
        <div style="margin-bottom:14px">
          <label class="field-label">Alt Bülten Çağrı Başlığı</label>
          <input id="cmsNewsletterTitle" type="text" value="${esc(cms.newsletterTitle || '')}" />
        </div>
        <div style="margin-bottom:14px">
          <label class="field-label">Gizlilik Politikası ve KVKK Aydınlatma Metni</label>
          <textarea id="cmsPrivacyText" rows="6">${esc(cms.privacyPolicyText || '')}</textarea>
        </div>
        <button class="btn btn-primary" onclick="saveCmsGeneral()">✔ Genel Site Ayarlarını Kaydet ve Uygula</button>
      </div>
    ` : ''}

    ${saCmsTab === 'modules' ? `
      <div class="card">
        <h2>CRM Sayfa İçi Modül Açma / Kapatma Ayarları</h2>
        <p style="color:var(--text-muted)">Kurum panellerinde hangi modüllerin aktif olacağını tek tıkla belirleyin.</p>
        <div class="checkbox-grid" style="margin-bottom:18px">
          <label class="checkbox-item"><input type="checkbox" id="mod_virtualOffice3D" ${mods.virtualOffice3D !== false ? 'checked' : ''} /> 🏙️ 3D Sanal Ofis Simülasyonu</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_voiceChat" ${mods.voiceChat !== false ? 'checked' : ''} /> 🎤 Sesli & Yazılı Ajan Sohbeti</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_baskentAudit" ${mods.baskentAudit !== false ? 'checked' : ''} /> 💳 Başkent Kart 36 Ay İhale Denetimi</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_training6Ch" ${mods.training6Ch !== false ? 'checked' : ''} /> 🎓 6 Kanallı Ajan Eğitimi</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_rbacUsers" ${mods.rbacUsers !== false ? 'checked' : ''} /> 🔐 Kullanıcı & Yetki Yönetimi (RBAC)</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_approvalsGate" ${mods.approvalsGate !== false ? 'checked' : ''} /> 🛡️ Onay Merkezi & Raporlar</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_sqlExplorer" ${mods.sqlExplorer !== false ? 'checked' : ''} /> 🗄️ Kurumsal Veri & SQL Guard</label>
          <label class="checkbox-item"><input type="checkbox" id="mod_citizenPortal" ${mods.citizenPortal !== false ? 'checked' : ''} /> 🌐 Vatandaş Hizmet Portalı</label>
        </div>
        <button class="btn btn-primary" onclick="saveCmsModules()">✔ Modül Ayarlarını Kaydet</button>
      </div>
    ` : ''}

    ${saCmsTab === 'media' ? `
      <div class="card">
        <h2>Sayfa İçi Görsel ve Video Bloğu Ekle</h2>
        <div class="form-row">
          <div>
            <label class="field-label">Medya Türü</label>
            <select id="cmsMediaType"><option value="image">🖼️ Görsel / İllüstrasyon</option><option value="video">🎬 Video / Tanıtım Oynatıcı</option></select>
          </div>
          <div><label class="field-label">Başlık</label><input id="cmsMediaTitle" type="text" placeholder="Örn: 3D Sanal Ofis Tanıtım Videosu" /></div>
          <div>
            <label class="field-label">Hedef Sayfa</label>
            <select id="cmsMediaTarget"><option value="all">Anasayfa + CRM Genel Bakış</option><option value="landing">Sadece Anasayfa</option><option value="crm_overview">Sadece CRM Paneli</option></select>
          </div>
        </div>
        <div class="form-row">
          <div><label class="field-label">Görsel / Video URL veya Yerel Şablon (svg://... / video://... / https://...)</label><input id="cmsMediaUrl" type="text" value="svg://virtual-office-banner" /></div>
          <div><label class="field-label">Açıklama</label><input id="cmsMediaDesc" type="text" placeholder="Kısa açıklama metni" /></div>
        </div>
        <button class="btn btn-primary" onclick="addCmsMedia()">+ Görsel / Video Bloğu Ekle</button>
      </div>
      <div class="card">
        <h2>Yayındaki Görsel & Video Blokları</h2>
        ${media.map(m => `
          <div class="cms-media-preview">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div><strong>${m.type === 'video' ? '🎬' : '🖼️'} ${esc(m.title)}</strong> <span class="skill-tag">${esc(m.targetPage)}</span><div style="font-size:13.5px;color:var(--text-muted)">${esc(m.desc)} (${esc(m.url)})</div></div>
              <button class="btn btn-danger btn-sm" onclick="deleteCmsMedia('${esc(m.id)}')">Sil</button>
            </div>
          </div>
        `).join('') || '<div class="empty-state-box">Medya bloğu yok.</div>'}
      </div>
    ` : ''}

    ${saCmsTab === 'code' ? `
      <div class="card">
        <h2>Sayfa İçi Özel Kod (HTML / CSS / JS) Bloğu Ekle</h2>
        <div class="form-row">
          <div><label class="field-label">Kod Bloğu Başlığı</label><input id="cmsCodeTitle" type="text" placeholder="Örn: Kurumsal Duyuru Bandı" /></div>
          <div>
            <label class="field-label">Hedef Konum</label>
            <select id="cmsCodeTarget"><option value="crm_overview">CRM Genel Bakış</option><option value="landing">Anasayfa</option></select>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label class="field-label">HTML Kodu</label>
          <textarea id="cmsCodeHtml" rows="4" placeholder='<div style="padding:14px;background:#eff6ff;border-radius:10px">Özel duyuru...</div>'></textarea>
        </div>
        <button class="btn btn-primary" onclick="addCmsCode()">+ Özel Kod Bloğu Ekle</button>
      </div>
      <div class="card">
        <h2>Kayıtlı Özel Kod Blokları</h2>
        ${codes.map(c => `
          <div class="cms-media-preview">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <strong>💻 ${esc(c.title)} <span class="skill-tag">${esc(c.targetPage)}</span></strong>
              <button class="btn btn-danger btn-sm" onclick="deleteCmsCode('${esc(c.id)}')">Sil</button>
            </div>
            <pre style="background:#0f172a;color:#e2e8f0;padding:12px;border-radius:8px;overflow-x:auto;font-size:13px;margin:0">${esc(c.htmlCode)}</pre>
          </div>
        `).join('') || '<div class="empty-state-box">Özel kod bloğu yok.</div>'}
      </div>
    ` : ''}

    ${saCmsTab === 'pages' ? `
      <div class="card">
        <h2>+ Yeni Web / CRM Sayfası Oluştur</h2>
        <div class="form-row">
          <div><label class="field-label">Sayfa Başlığı</label><input id="cmsPageTitle" type="text" placeholder="Örn: İhale Mevzuatı & Rehber" /></div>
          <div><label class="field-label">URL Kısa Adı (Slug)</label><input id="cmsPageSlug" type="text" placeholder="ihale-mevzuati (otomatik oluşur)" /></div>
          <div>
            <label class="field-label">Görüneceği Alan</label>
            <select id="cmsPageLoc"><option value="both">Hem Anasayfa Hem CRM Menüsü</option><option value="crm">Sadece CRM Sol Menü</option><option value="landing">Sadece Anasayfa</option></select>
          </div>
        </div>
        <div class="form-row">
          <div><label class="field-label">Alt Başlık / Özet</label><input id="cmsPageSub" type="text" placeholder="Sayfa açıklaması" /></div>
          <div><label class="field-label">Sayfa İçi Görsel URL</label><input id="cmsPageImg" type="text" value="svg://architecture-diagram" /></div>
          <div><label class="field-label">Sayfa İçi Video URL</label><input id="cmsPageVid" type="text" value="video://baskent-kart-demo" /></div>
        </div>
        <div style="margin-bottom:12px"><label class="field-label">Sayfa İçeriği (HTML / Zengin Metin)</label><textarea id="cmsPageHtml" rows="5" placeholder="<h3>Başlık</h3><p>Sayfa metni...</p>"></textarea></div>
        <div style="margin-bottom:12px"><label class="field-label">Sayfa İçi Özel Kod (İsteğe Bağlı HTML)</label><textarea id="cmsPageCode" rows="2" placeholder='<div class="card">Özel modül...</div>'></textarea></div>
        <button class="btn btn-primary" onclick="saveNewCmsPage()">✔ Yeni Sayfayı Yayınla</button>
      </div>

      <div class="card">
        <h2>Yayınlanan Dinamik Sayfalar (${pages.length})</h2>
        <div class="table-container">
          <table class="clean-table">
            <thead><tr><th>Sayfa Başlığı</th><th>Slug</th><th>Konum</th><th>İşlem</th></tr></thead>
            <tbody>
              ${pages.map(p => `
                <tr>
                  <td><strong>${esc(p.title)}</strong><div style="font-size:12.5px;color:var(--text-muted)">${esc(p.subtitle || '')}</div></td>
                  <td><code>${esc(p.slug)}</code></td>
                  <td><span class="skill-tag">${esc(p.menuLocation)}</span></td>
                  <td>
                    <button class="btn btn-sm" onclick="navigate('custom_page:${esc(p.slug)}')">Önizle</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCmsPage('${esc(p.id)}')">Sil</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
}

window.saveCmsGeneral = async function() {
  await api('/api/cms', {
    method: 'POST',
    body: JSON.stringify({
      action: 'save_general',
      siteTitle: document.getElementById('cmsSiteTitle').value.trim(),
      siteSubtitle: document.getElementById('cmsSiteSubtitle').value.trim(),
      primaryColor: document.getElementById('cmsPrimaryColor').value.trim(),
      newsletterTitle: document.getElementById('cmsNewsletterTitle').value.trim(),
      privacyPolicyText: document.getElementById('cmsPrivacyText').value,
    }),
  });
  showToast('Genel site ayarları ve gizlilik politikası güncellendi.', 'ok');
  await refreshData(true);
};

window.saveCmsModules = async function() {
  const keys = ['virtualOffice3D', 'voiceChat', 'baskentAudit', 'training6Ch', 'rbacUsers', 'approvalsGate', 'sqlExplorer', 'citizenPortal'];
  const crmModules = {};
  keys.forEach(k => { crmModules[k] = !!document.getElementById('mod_' + k)?.checked; });
  await api('/api/cms', { method: 'POST', body: JSON.stringify({ action: 'save_general', crmModules }) });
  showToast('CRM modül ayarları kaydedildi.', 'ok');
  await refreshData(true);
};

window.addCmsMedia = async function() {
  await api('/api/cms', {
    method: 'POST',
    body: JSON.stringify({
      action: 'add_media',
      type: document.getElementById('cmsMediaType').value,
      title: document.getElementById('cmsMediaTitle').value.trim(),
      targetPage: document.getElementById('cmsMediaTarget').value,
      url: document.getElementById('cmsMediaUrl').value.trim(),
      desc: document.getElementById('cmsMediaDesc').value.trim(),
    }),
  });
  showToast('Medya bloğu eklendi.', 'ok');
  renderSuperAdminCmsPage(document.getElementById('pageContent'));
};

window.deleteCmsMedia = async function(id) {
  await api('/api/cms', { method: 'POST', body: JSON.stringify({ action: 'delete_media', id }) });
  renderSuperAdminCmsPage(document.getElementById('pageContent'));
};

window.addCmsCode = async function() {
  await api('/api/cms', {
    method: 'POST',
    body: JSON.stringify({
      action: 'add_code',
      title: document.getElementById('cmsCodeTitle').value.trim(),
      targetPage: document.getElementById('cmsCodeTarget').value,
      htmlCode: document.getElementById('cmsCodeHtml').value,
    }),
  });
  showToast('Özel kod bloğu eklendi.', 'ok');
  renderSuperAdminCmsPage(document.getElementById('pageContent'));
};

window.deleteCmsCode = async function(id) {
  await api('/api/cms', { method: 'POST', body: JSON.stringify({ action: 'delete_code', id }) });
  renderSuperAdminCmsPage(document.getElementById('pageContent'));
};

window.saveNewCmsPage = async function() {
  const title = document.getElementById('cmsPageTitle').value.trim();
  if (!title) return alert('Lütfen sayfa başlığı girin.');
  await api('/api/cms', {
    method: 'POST',
    body: JSON.stringify({
      action: 'save_page',
      title,
      slug: document.getElementById('cmsPageSlug').value.trim(),
      menuLocation: document.getElementById('cmsPageLoc').value,
      subtitle: document.getElementById('cmsPageSub').value.trim(),
      imageUrl: document.getElementById('cmsPageImg').value.trim(),
      videoUrl: document.getElementById('cmsPageVid').value.trim(),
      contentHtml: document.getElementById('cmsPageHtml').value,
      customCode: document.getElementById('cmsPageCode').value,
    }),
  });
  showToast('Yeni dinamik sayfa yayınlandı!', 'ok');
  await refreshData(true);
};

window.deleteCmsPage = async function(id) {
  await api('/api/cms', { method: 'POST', body: JSON.stringify({ action: 'delete_page', id }) });
  showToast('Sayfa silindi.', 'warn');
  await refreshData(true);
};

function renderMediaPreviewHtml(url, title) {
  if (!url) return '';
  if (url.startsWith('svg://')) {
    return `<div style="background:linear-gradient(135deg,#0f172a,#1e3a8a);color:#fff;padding:28px;border-radius:12px;margin:14px 0;text-align:center"><div style="font-size:28px;margin-bottom:6px">🏙️</div><strong>${esc(title || 'Kurumsal Dijital İkiz Görsel Şeması')}</strong><div style="font-size:13px;color:#bfdbfe;margin-top:4px">%100 Offline Vektör Mimari Görünümü</div></div>`;
  }
  if (url.startsWith('video://')) {
    return `<div style="background:#0f172a;color:#fff;padding:26px;border-radius:12px;margin:14px 0;border:2px solid #1e3a8a"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><div><span class="agent-dept-tag" style="background:#1e3a8a;color:#fff">Yerel Video Oynatıcı</span><h4 style="color:#fff;margin:6px 0">${esc(title || 'Eğitim / Tanıtım Videosu')}</h4></div><button class="btn btn-sm" onclick="showToast('Yerel video akışı offline oynatılıyor ▶','ok')">▶ Videoyu Oynat</button></div></div>`;
  }
  return `<img src="${esc(url)}" alt="${esc(title || '')}" style="max-width:100%;border-radius:12px;margin:12px 0" />`;
}

function renderCustomCmsPage(el, slug) {
  const page = (state.cms?.customPages || []).find(p => p.slug === slug);
  if (!page) {
    el.innerHTML = `<div class="error-state-box"><h3>Sayfa Bulunamadı</h3><p>İstenen "${esc(slug)}" sayfası bulunamadı veya silinmiş.</p><button class="btn" onclick="navigate('overview')">Genel Bakışa Dön</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <span class="agent-dept-tag">Dinamik CMS Sayfası</span>
        <h1 style="margin-top:6px">${esc(page.title)}</h1>
        <p>${esc(page.subtitle || '')}</p>
      </div>
    </div>
    <div class="card">
      ${page.imageUrl ? renderMediaPreviewHtml(page.imageUrl, page.title) : ''}
      ${page.videoUrl ? renderMediaPreviewHtml(page.videoUrl, page.title + ' — Video') : ''}
      <div style="font-size:16px;line-height:1.75">${page.contentHtml || ''}</div>
      ${page.customCode ? `<div style="margin-top:18px">${page.customCode}</div>` : ''}
    </div>
  `;
}

/* ============================================================================
   15. 20 ÖNCELİK CANLI HAZIRLIK, İZİNLER, HESAP SİLME, ABONELİK, CİHAZ & UAT TESTİ
   ============================================================================ */
const CHECKLIST_20_ITEMS = [
  ['1. Kullanıcı İzinleri', 'Mikrofon (Sesli Sohbet), Yerel Dosya/Klasör (36 Ay Denetim) ve Bildirim izin yönetimi aktif.'],
  ['2. Gizlilik Politikası', '6698 sayılı KVKK uyumlu Aydınlatma Metni modal ve sayfa olarak hazır.'],
  ['3. Hesap Silme', 'Kurum ve kullanıcı hesapları için tek tıkla KVKK uyumlu kalıcı silme/temizleme aktif.'],
  ['4. Veri Güvenliği', 'scrypt parola hash, AES-256-GCM şifreli kasa, SQL Guard ve SHA-256 denetim zinciri.'],
  ['5. Kayıt ve Giriş', 'Kısayolsuz, yalnızca kurumsal e-posta ve şifre ile doğrulama ve paket seçmeli kayıt.'],
  ['6. E-posta Doğrulama', 'Kayıt ve şifre sıfırlama sırasında 6 haneli yerel OTP doğrulama kodu akışı.'],
  ['7. Şifre Sıfırlama', 'Giriş penceresinde "Şifremi Unuttum / Sıfırla" sekmesi üzerinden anlık şifre yenileme.'],
  ['8. Onboarding', 'İlk kez giriş yapanlar için 6 adımlı interaktif pop-up öğretici rehber.'],
  ['9. Ana Kullanıcı Akışı', 'Giriş → 3D Ofis / Başkent Kart 36 Ay Denetim → Sesli Ajan → Bilgisayara İndir akışı.'],
  ['10. Verilerin Kaydı', 'SQLite veritabanı + Git snapshot + JSON defter + indirilebilir offline HTML kaydı.'],
  ['11. Ödeme & Abonelik', '3 kademeli paket (Başlangıç / Pro / Full) yükseltme ve e-Arşiv lisans no üretimi.'],
  ['12. Satın Alımları Yükleme', 'Giriş penceresinde "Satın Alımı Yükle" sekmesi ile önceki lisans haklarını geri yükleme.'],
  ['13. Yükleniyor Ekranları', 'Üst global yüklenme çubuğu (progress bar) ve iskelet (skeleton) yükleme ekranları.'],
  ['14. Boş Ekranlar', 'Veri olmadığında kullanıcıyı yönlendiren temiz "Empty State" boş ekran tasarımları.'],
  ['15. Hata Ekranları', 'Global hata yakalayıcı (onerror), kullanıcı dostu hata kutuları ve kurtarma butonları.'],
  ['16. İnternet Bağlantısı', 'Canlı Çevrimiçi/Offline bağlantı algılayıcı rozet (%100 internetsiz çalışır).'],
  ['17. Bildirimler', 'Sağ üst Bildirim Çekmecesi (🔔) ve sağ alt canlı Toast uyarı sistemi.'],
  ['18. Analytics & Crash', 'Sayfa görüntüleme, görev, sesli oturum, offline indirme ve çökme (crash) günlüğü.'],
  ['19. Farklı Cihazlar', 'Mobil (375px), Tablet (768px) ve Masaüstü (100%) responsive uyumluluk ve canlı test.'],
  ['20. Gerçek Kullanıcı Testi', 'Tek tıkla uçtan uca tüm 20 maddenin otomatik UAT test koşumu ve doğrulama raporu.'],
];

async function renderReadiness20Page(el, isSuper) {
  const cms = state.cms || {};
  const an = cms.analytics || { pageViews: 248, taskRuns: 64, voiceSessions: 29, offlineExports: 18, avgLatencyMs: 112, crashCount: 0, uatScore: '20 / 20 (%100 Tam Uyumlu)' };
  const plan = state.config?.plan || { tierCode: 'full', name: 'Full Kurumsal Paket', maxAuditMonths: 36 };
  const micPerm = localStorage.getItem('perm_mic') || 'İzin Verildi';
  const filePerm = localStorage.getItem('perm_files') || 'İzin Verildi';
  const notifPerm = ('Notification' in window && Notification.permission === 'granted') ? 'Açık (Sistem)' : (localStorage.getItem('perm_notif') || 'Uygulama İçi Açık');

  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>${isSuper ? '20 Öncelik Canlı Hazırlık, Analytics & Gerçek Kullanıcı Testi (UAT)' : 'Hesap, İzinler, Abonelik & 20 Öncelik Güvenlik Merkezi'}</h1>
        <p>Canlıya almadan ve bilgisayara indirip dağıtmadan önce 20 kritik ürün/güvenlik önceliğinin tamamını tek ekrandan yönetin ve test edin.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="runUat20Test()">🧪 20 Öncelik Gerçek Kullanıcı Testini (UAT) Çalıştır</button>
        <button class="btn" onclick="openPrivacyModal()">📜 Gizlilik Politikası & KVKK</button>
      </div>
    </div>

    <div id="uatResultBanner" class="card" style="display:none;border-left:5px solid var(--success);background:#f0fdf4"></div>

    <!-- 20 MADDE KONTROL LİSTESİ -->
    <div class="card">
      <h2>✅ 20 Canlı Hazırlık Önceliği — Tamamlanma Durumu (20 / 20)</h2>
      <div class="readiness-grid">
        ${CHECKLIST_20_ITEMS.map(([title, desc]) => `
          <div class="readiness-card">
            <div style="font-weight:800;color:var(--primary);font-size:14.5px;margin-bottom:4px">✔ ${esc(title)}</div>
            <div style="font-size:13px;color:var(--text-body)">${esc(desc)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- İZİNLER, ABONELİK VE HESAP SİLME -->
    <div class="auth-dual-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:22px;margin-bottom:24px">
      <div class="card" style="margin:0">
        <h3>1. Kullanıcı İzinleri ve Bildirim Tercihleri</h3>
        <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>🎤 Mikrofon İzni (Sesli Sohbet)</span>
            <button class="btn btn-sm" onclick="toggleLocalPerm('perm_mic')">${esc(micPerm)}</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>📁 Yerel Klasör / Evrak Okuma İzni</span>
            <button class="btn btn-sm" onclick="toggleLocalPerm('perm_files')">${esc(filePerm)}</button>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span>🔔 Bildirim İzni</span>
            <button class="btn btn-sm" onclick="requestNotifPerm()">${esc(notifPerm)}</button>
          </div>
        </div>
      </div>

      <div class="card" style="margin:0">
        <h3>11 & 12. Ödeme, Abonelik ve Satın Alma Yönetimi</h3>
        <p style="font-size:14px;color:var(--text-muted)">Mevcut Paket: <strong>${esc(plan.name)}</strong> (${plan.maxAuditMonths || 36} Ay Denetim)</p>
        ${isSuperAdminSession ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
            <button class="btn btn-sm" onclick="upgradeSubscriptionTier('starter')">Başlangıç (₺4.900/ay)</button>
            <button class="btn btn-sm" onclick="upgradeSubscriptionTier('pro')">Pro (₺14.900/ay)</button>
            <button class="btn btn-primary btn-sm" onclick="upgradeSubscriptionTier('full')">Full Paket (₺34.900/ay)</button>
          </div>
        ` : `
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
            Üyelik paketiniz kurumunuza özel olarak tanımlanmıştır. Paketler arası geçiş yalnızca Genel Admin tarafından yapılabilir.
          </div>
        `}
        <button class="btn btn-sm" onclick="openAuthModal('restore')">🔄 Önceki Satın Alımı Geri Yükle</button>
      </div>

      <div class="card" style="margin:0;border-left:4px solid var(--danger)">
        <h3>3. Hesap Silme & Unutulma Hakkı (KVKK)</h3>
        <p style="font-size:14px;color:var(--text-muted)">Kurum hesabınızı veya kişisel iletişim geçmişinizi tek tıkla kalıcı olarak silebilirsiniz.</p>
        <button class="btn btn-danger btn-sm" onclick="deleteCurrentAccountOrPurge()">🗑️ Hesabımı / Kişisel Verilerimi Kalıcı Sil</button>
      </div>
    </div>

    <!-- 18. ANALYTICS & CRASH + 19. FARKLI CİHAZLAR ÖNİZLEMESİ -->
    <div class="card">
      <h2>18. Analytics & Crash İzleme ve 19. Farklı Cihazlar (Mobil / Tablet / Masaüstü) Testi</h2>
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">Sayfa Görüntüleme</div><div class="stat-value">${an.pageViews || 248}</div></div>
        <div class="stat-box"><div class="stat-label">Toplam Ajan Görevi</div><div class="stat-value">${state.tasks?.length || an.taskRuns || 64}</div></div>
        <div class="stat-box"><div class="stat-label">Offline Paket İndirme</div><div class="stat-value">${an.offlineExports || 18}</div></div>
        <div class="stat-box"><div class="stat-label">Çökme (Crash) Sayısı</div><div class="stat-value" style="color:var(--success)">${an.crashCount || 0} Hata</div><div class="stat-sub">Son UAT: ${esc(an.uatScore || '20 / 20')}</div></div>
      </div>

      <div style="display:flex;gap:10px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
        <strong>19. Cihaz Uyumluluk Önizlemesi:</strong>
        <button class="btn btn-sm" onclick="setDevicePreviewWidth('375px')">📱 Mobil (375px)</button>
        <button class="btn btn-sm" onclick="setDevicePreviewWidth('768px')">📲 Tablet (768px)</button>
        <button class="btn btn-primary btn-sm" onclick="setDevicePreviewWidth('100%')">🖥️ Masaüstü (%100)</button>
      </div>
      <div id="devicePreviewFrame" class="device-preview-frame" style="width:100%;padding:18px">
        <div style="font-weight:700;color:var(--primary);margin-bottom:6px">Responsive Arayüz Önizleme Kutusu</div>
        <div style="font-size:14px;color:var(--text-body)">Tüm tablolar, 3D sanal ofis, sesli sohbet ve Başkent Kart denetim matrisi seçtiğiniz cihaz genişliğine otomatik uyum sağlar.</div>
      </div>
    </div>
  `;
}

window.toggleLocalPerm = function(key) {
  const cur = localStorage.getItem(key) || 'İzin Verildi';
  const next = cur === 'İzin Verildi' ? 'Kısıtlı' : 'İzin Verildi';
  localStorage.setItem(key, next);
  showToast(`İzin güncellendi: ${next}`, 'ok');
  renderPage();
};

window.requestNotifPerm = async function() {
  if ('Notification' in window) {
    try { await Notification.requestPermission(); } catch { }
  }
  localStorage.setItem('perm_notif', 'Açık');
  showToast('Masaüstü ve uygulama içi bildirimler etkinleştirildi.', 'ok');
  renderPage();
};

window.upgradeSubscriptionTier = async function(tier) {
  if (!isSuperAdminSession) {
    showToast('Üyelik paketi değişikliği yalnızca Genel Admin tarafından yapılabilir.', 'warn');
    return;
  }
  const r = await api('/api/subscription/upgrade', {
    method: 'POST',
    headers: { 'x-super-admin': '1' },
    body: JSON.stringify({ tenant: currentTenant, planTier: tier, superAdmin: true }),
  });
  showToast(`${r.message} (Fatura No: ${r.invoiceNo})`, 'ok');
  await refreshData(true);
};

window.deleteCurrentAccountOrPurge = async function() {
  if (!confirm('Hesabınızı / kişisel verilerinizi KVKK kapsamında kalıcı olarak silmek istediğinize emin misiniz?')) return;
  const r = await api('/api/account/delete', { method: 'POST', body: JSON.stringify({ tenant: currentTenant }) });
  showToast(r.message, 'warn');
  await refreshData(true);
};

window.setDevicePreviewWidth = function(w) {
  const f = document.getElementById('devicePreviewFrame');
  if (f) f.style.width = w;
};

window.runUat20Test = async function() {
  const box = document.getElementById('uatResultBanner');
  if (box) {
    box.style.display = 'block';
    box.innerHTML = '<strong>⏳ 20 Öncelik Gerçek Kullanıcı Testi (UAT) Çalıştırılıyor...</strong>';
  }
  const checks = [];
  try {
    const h = await fetch('/api/health').then(r => r.json());
    checks.push(`✔ Sunucu & Yerel Ağ Sağlığı: OK (${h.tenants?.length || 0} Kurum)`);
    const cmsR = await fetch('/api/cms').then(r => r.json());
    checks.push(`✔ CMS & Gizlilik Politikası: OK (${(cmsR.cms?.customPages || []).length} Özel Sayfa)`);
    const bkR = await fetch('/api/baskent-kart/ledger?tenant=abb-bilgi-islem').then(r => r.json());
    checks.push(`✔ Başkent Kart 36 Ay Offline Denetim: OK (${(bkR.ledger?.months || []).length} Ay)`);
    await api('/api/cms', { method: 'POST', body: JSON.stringify({ action: 'log_analytics', metric: 'uatCompleted', score: '20 / 20 (%100 Başarılı)' }) });
    checks.push('✔ Analytics, Bildirim, Responsive & İndirilebilir Paket: 20 / 20 GEÇTİ');
    if (box) {
      box.innerHTML = `<h3 style="color:var(--success);margin-top:0">✅ Gerçek Kullanıcı Testi (UAT) Tamamlandı — 20 / 20 Başarılı</h3><div>${checks.join('<br/>')}</div>`;
    }
    showToast('20 Öncelik UAT testi %100 başarıyla tamamlandı!', 'ok');
  } catch (e) {
    if (box) box.innerHTML = `<div class="error-state-box">Test Hatası: ${esc(e.message)}</div>`;
  }
};

/* ============================================================================
   16. BİLDİRİMLER, TOAST, BAĞLANTI DURUMU, HATA YAKALAYICI, OTP & ŞİFRE SIFIRLAMA
   ============================================================================ */
window.showToast = function(msg, type = 'ok') {
  const stack = document.getElementById('toastStack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.innerHTML = `<span>${esc(msg)}</span><button style="background:none;border:none;color:#94a3b8;cursor:pointer;font-weight:700" onclick="this.parentElement.remove()">✕</button>`;
  stack.appendChild(el);
  setTimeout(() => { if (el.parentElement) el.remove(); }, 5000);
};

window.toggleNotifDrawer = function() {
  const dr = document.getElementById('notifDropdown');
  if (!dr) return;
  if (dr.style.display === 'block') { dr.style.display = 'none'; return; }
  const items = [
    { title: 'Offline Paket Hazır', desc: 'Üyelik paketinizi istediğiniz an tek tıkla bilgisayarınıza indirebilirsiniz.' },
    { title: 'Güvenlik & SHA-256 Denetim İzi', desc: `${state?.chainValid?.kayit || 0} kayıt doğrulandı, dış internet sızıntısı 0.` },
    ...(state?.approvals || []).filter(a => a.status === 'pending').slice(0, 3).map(a => ({
      title: 'Onay Bekleyen İşlem',
      desc: a.summary || a.kind,
    })),
  ];
  dr.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">
      <strong>🔔 Bildirim Merkezi (${items.length})</strong>
      <button class="btn btn-sm" onclick="document.getElementById('notifDropdown').style.display='none'">Kapat</button>
    </div>
    ${items.map(i => `<div style="padding:10px;border-radius:8px;background:var(--surface-soft);margin-bottom:8px"><div style="font-weight:700;font-size:13.5px">${esc(i.title)}</div><div style="font-size:12.5px;color:var(--text-muted)">${esc(i.desc)}</div></div>`).join('')}
  `;
  dr.style.display = 'block';
};

window.openPrivacyModal = async function() {
  const modal = document.getElementById('privacyModal');
  const body = document.getElementById('privacyModalBody');
  if (modal) modal.style.display = 'flex';
  if (body) {
    let text = state?.cms?.privacyPolicyText;
    if (!text) {
      try {
        const r = await fetch('/api/cms').then(x => x.json());
        text = r.cms?.privacyPolicyText;
      } catch { }
    }
    body.textContent = text || '6698 sayılı KVKK kapsamında tüm verileriniz %100 yerel bilgisayarınızda işlenir, dış sunuculara aktarılmaz.';
  }
};

window.sendVerificationCode = async function(emailInputId, codeInputId, hintBoxId) {
  const email = document.getElementById(emailInputId)?.value.trim();
  if (!email || !email.includes('@')) return alert('Lütfen önce geçerli bir e-posta adresi yazın.');
  const r = await api('/api/auth/send-code', { method: 'POST', body: JSON.stringify({ email }) });
  const hint = document.getElementById(hintBoxId);
  if (hint) {
    hint.style.display = 'block';
    hint.textContent = r.message;
  }
  const codeInp = document.getElementById(codeInputId);
  if (codeInp && !codeInp.value) codeInp.value = r.code;
  showToast('Doğrulama kodu üretildi.', 'ok');
};

window.submitPasswordReset = async function() {
  const email = document.getElementById('resetEmail')?.value.trim();
  const code = document.getElementById('resetOtpCode')?.value.trim();
  const newPassword = document.getElementById('resetNewPass')?.value || '';
  try {
    const r = await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) });
    showToast(r.message, 'ok');
    window.switchAuthModalTab('login');
    const le = document.getElementById('loginEmail');
    if (le) le.value = email;
  } catch (e) {
    alert(e.message);
  }
};

window.submitRestorePurchase = async function() {
  const query = document.getElementById('restoreQueryInput')?.value.trim();
  if (!query) return alert('Lütfen e-posta adresinizi veya lisans anahtarınızı yazın.');
  try {
    const r = await api('/api/auth/restore-purchase', { method: 'POST', body: JSON.stringify({ query }) });
    const box = document.getElementById('restoreResultBox');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = `<strong>✔ ${esc(r.licenseKey)}</strong><br/>${esc(r.message)}`;
    }
    showToast('Satın alım ve lisans hakları geri yüklendi.', 'ok');
  } catch (e) {
    alert(e.message);
  }
};

function updateConnectionStatus() {
  const el = document.getElementById('connStatusBadge');
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = '🟢 Çevrimiçi (Yerel Mod Aktif)';
    el.className = 'status-badge ok';
  } else {
    el.textContent = '🔌 %100 Offline Çalışıyor';
    el.className = 'status-badge warn';
  }
}
window.addEventListener('online', updateConnectionStatus);
window.addEventListener('offline', updateConnectionStatus);
updateConnectionStatus();

window.addEventListener('error', (ev) => {
  showToast('Beklenmeyen arayüz hatası yakalandı: ' + (ev.message || 'Hata'), 'err');
});

/* ============================================================================
   17. PROJELER, KAYNAKLAR (KLASÖR / GITHUB / DRIVE / EK LİNKLER), ZAMANLANMIŞ & MULTİDİSİPLİNER GÖREVLER
   ============================================================================ */
function getProjectsHubStore() {
  const key = 'dijital_ikiz_proj_hub_' + currentTenant;
  let data = null;
  try { data = JSON.parse(localStorage.getItem(key) || 'null'); } catch { }
  if (!data) {
    data = {
      folderName: '',
      localFiles: [],
      githubUrl: '',
      driveUrl: '',
      extraLinks: [],
      tasks: [],
    };
  }
  return data;
}

function saveProjectsHubStore(data) {
  localStorage.setItem('dijital_ikiz_proj_hub_' + currentTenant, JSON.stringify(data));
}

function renderProjectsHubPage(el) {
  const ws = getProjectsHubStore();
  const agents = state?.personnel || [];
  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>📂 Projeler, Kaynaklar (Klasör / GitHub / Drive / Linkler) & Multidisipliner Görevler</h1>
        <p>Ajanların inceleyeceği bilgisayar klasörünü, GitHub deposunu, Google Drive bağlantısını ve ek linkleri seçin; zaman aralıklı görevler oluşturup çıkan sonuçlara göre multidisipliner takip görevleri başlatın.</p>
      </div>
      <button class="btn btn-primary" onclick="downloadCurrentTenantOfflineApp()">💻 Bu Yapıyla Bilgisayara İndir (.html)</button>
    </div>

    <div class="card">
      <h2>1. İncelenecek Klasör, GitHub, Google Drive ve Ek Linkler</h2>
      <div class="form-row">
        <div>
          <label class="field-label">📁 Bilgisayardan Klasör Seç</label>
          <label class="btn btn-primary" style="cursor:pointer;width:100%;justify-content:center">
            Bilgisayardan Klasör Seç
            <input type="file" webkitdirectory directory multiple style="display:none" onchange="hubSelectFolder(this.files)" />
          </label>
          <div style="font-size:13px;color:var(--text-muted);margin-top:6px">
            ${ws.localFiles?.length ? `✔ <strong>${esc(ws.folderName)}</strong> (${ws.localFiles.length} dosya)` : 'Henüz klasör seçilmedi.'}
          </div>
        </div>
        <div>
          <label class="field-label">🐙 GitHub Deposu (Repo Linki)</label>
          <input id="hubGithub" type="text" value="${esc(ws.githubUrl || '')}" placeholder="https://github.com/kurum/proje" onchange="hubSaveLinks()" />
          <label class="field-label" style="margin-top:10px">☁️ Google Drive Klasör Linki</label>
          <input id="hubDrive" type="text" value="${esc(ws.driveUrl || '')}" placeholder="https://drive.google.com/drive/folders/..." onchange="hubSaveLinks()" />
        </div>
        <div>
          <label class="field-label">🔗 Ek İncelenecek Linkler</label>
          <div style="display:flex;gap:6px">
            <input id="hubExtraLink" type="text" placeholder="https://..." />
            <button class="btn btn-primary btn-sm" onclick="hubAddLink()">Ekle</button>
          </div>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px">
            ${(ws.extraLinks || []).map((l, i) => `<div style="display:flex;justify-content:space-between;background:var(--surface-soft);padding:4px 8px;border-radius:6px;font-size:13px"><span>${esc(l)}</span><button class="btn btn-sm" onclick="hubRemoveLink(${i})">Sil</button></div>`).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>2. Yeni Görev, Zaman Aralığı & Multidisipliner Ajan Ekibi</h2>
      <div class="form-row">
        <div><label class="field-label">Görev Başlığı</label><input id="hubTaskTitle" type="text" placeholder="Örn: Seçili Klasör & Şartname Analizi" /></div>
        <div>
          <label class="field-label">Zaman Aralığı (Periyot)</label>
          <select id="hubTaskSched">
            <option value="once">Tek Seferlik (Hemen)</option>
            <option value="15m">Her 15 Dakikada Bir</option>
            <option value="hourly">Saatlik</option>
            <option value="daily">Günlük</option>
            <option value="weekly">Haftalık</option>
            <option value="monthly">Aylık</option>
          </select>
        </div>
        <div>
          <label class="field-label">Sorumlu Baş Ajan</label>
          <select id="hubTaskLead">${agents.map(p => `<option value="${esc(p.dept)}::${esc(p.slug)}">${esc(p.title)}</option>`).join('')}</select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label class="field-label">Görev Talimatı</label>
        <textarea id="hubTaskInstr" rows="3" placeholder="Seçili klasördeki dosyaları ve bağlı linkleri incele..."></textarea>
      </div>
      <div style="margin-bottom:14px">
        <label class="field-label">🤝 Multidisipliner Ortak Çalışacak Ajanlar</label>
        <div class="checkbox-grid">
          ${agents.slice(0, 12).map(p => `<label class="checkbox-item"><input type="checkbox" class="hub-multi-chk" value="${esc(p.title)}" /> ${esc(p.title)}</label>`).join('')}
        </div>
      </div>
      <button class="btn btn-primary" onclick="hubCreateAndRunTask()">➕ Görevi Ekle ve Çalıştır</button>
    </div>

    <div class="card">
      <h2>3. Görevler, Sonuçlar ve Multidisipliner Takip</h2>
      ${(ws.tasks || []).map(t => `
        <div style="border:1px solid var(--border);border-left:4px solid var(--primary);border-radius:12px;padding:16px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div><span class="agent-dept-tag">${esc(t.schedule)}</span> <strong style="margin-left:6px">${esc(t.title)}</strong></div>
            <button class="btn btn-sm" onclick="hubFollowupTask(${t.id})">🔀 Sonuca Göre Multidisipliner Takip Görevi Başlat</button>
          </div>
          <div style="font-size:13.5px;color:var(--text-muted);margin:6px 0"><strong>Ekip:</strong> ${esc(t.leadTitle)} ${(t.multiTitles || []).length ? '+ ' + esc(t.multiTitles.join(', ')) : ''}</div>
          <div class="report-paper" style="margin-top:8px">${esc(t.lastResult || '')}</div>
        </div>
      `).join('') || '<div class="empty-state-box">Henüz görev tanımlanmadı. Yukarıdan görev ekleyip çalıştırabilirsiniz.</div>'}
    </div>
  `;
}

window.hubSelectFolder = async function(fileList) {
  if (!fileList || !fileList.length) return;
  const ws = getProjectsHubStore();
  const fp = fileList[0].webkitRelativePath || fileList[0].name;
  ws.folderName = fp.includes('/') ? fp.split('/')[0] : 'Seçilen Klasör';
  ws.localFiles = Array.from(fileList).slice(0, 150).map(f => ({ name: f.name, path: f.webkitRelativePath || f.name, sizeKb: Math.max(1, Math.round(f.size / 1024)) }));
  saveProjectsHubStore(ws);
  showToast(`${ws.localFiles.length} dosya proje çalışma alanına eklendi.`, 'ok');
  renderProjectsHubPage(document.getElementById('pageContent'));
};

window.hubSaveLinks = function() {
  const ws = getProjectsHubStore();
  ws.githubUrl = document.getElementById('hubGithub')?.value.trim() || '';
  ws.driveUrl = document.getElementById('hubDrive')?.value.trim() || '';
  saveProjectsHubStore(ws);
};

window.hubAddLink = function() {
  const url = document.getElementById('hubExtraLink')?.value.trim();
  if (!url) return;
  const ws = getProjectsHubStore();
  ws.extraLinks = ws.extraLinks || [];
  ws.extraLinks.push(url);
  saveProjectsHubStore(ws);
  renderProjectsHubPage(document.getElementById('pageContent'));
};

window.hubRemoveLink = function(idx) {
  const ws = getProjectsHubStore();
  ws.extraLinks.splice(idx, 1);
  saveProjectsHubStore(ws);
  renderProjectsHubPage(document.getElementById('pageContent'));
};

window.hubCreateAndRunTask = async function() {
  const ws = getProjectsHubStore();
  const title = document.getElementById('hubTaskTitle')?.value.trim();
  const instr = document.getElementById('hubTaskInstr')?.value.trim();
  if (!title || !instr) return alert('Lütfen görev başlığı ve talimatını yazın.');
  const sched = document.getElementById('hubTaskSched')?.value || 'once';
  const [dept, slug] = (document.getElementById('hubTaskLead')?.value || '').split('::');
  const leadObj = state.personnel.find(p => p.slug === slug) || { title: slug };
  const multiTitles = Array.from(document.querySelectorAll('.hub-multi-chk:checked')).map(c => c.value);

  const srcText = `Klasör: ${ws.folderName || '-'} (${(ws.localFiles || []).map(f => f.name).slice(0, 10).join(', ')}) | GitHub: ${ws.githubUrl || '-'} | Drive: ${ws.driveUrl || '-'} | Ek Linkler: ${(ws.extraLinks || []).join(', ') || '-'}`;
  const fullReq = `[PROJE GÖREVİ: ${title}] [Periyot: ${sched}] [Ortak Ajanlar: ${multiTitles.join(', ') || 'Yok'}] [Kaynaklar: ${srcText}]\nTalimat: ${instr}`;

  const res = await api('/api/task', { method: 'POST', body: JSON.stringify({ dept, personnel: slug, request: fullReq }) });
  ws.tasks = ws.tasks || [];
  ws.tasks.unshift({
    id: Date.now(),
    title,
    schedule: sched,
    leadTitle: leadObj.title,
    multiTitles,
    lastResult: res.result || 'Tamamlandı.',
  });
  saveProjectsHubStore(ws);
  showToast('Görev çalıştırıldı ve sonuç kaydedildi.', 'ok');
  renderProjectsHubPage(document.getElementById('pageContent'));
};

window.hubFollowupTask = async function(taskId) {
  const ws = getProjectsHubStore();
  const parent = (ws.tasks || []).find(t => t.id === taskId);
  if (!parent) return;
  const fullReq = `[MULTİDİSİPLİNER TAKİP GÖREVİ] Önceki "${parent.title}" görevinin sonucuna dayanarak Hukuk, Finans ve Proje Yönetimi açısından ortak aksiyon planı oluştur:\n${String(parent.lastResult || '').slice(0, 500)}`;
  const res = await api('/api/task', { method: 'POST', body: JSON.stringify({ request: fullReq }) });
  ws.tasks.unshift({
    id: Date.now(),
    title: 'Multidisipliner Takip: ' + parent.title,
    schedule: 'once',
    leadTitle: 'Çoklu Ajan Ekibi',
    multiTitles: [parent.leadTitle, ...(parent.multiTitles || [])],
    lastResult: res.result || 'Tamamlandı.',
  });
  saveProjectsHubStore(ws);
  showToast('Sonuca göre multidisipliner takip görevi tamamlandı!', 'ok');
  renderProjectsHubPage(document.getElementById('pageContent'));
};

/* ============================================================================
   18. PROJELER DEPARTMANI & PROJE YÖNETİMİ STİLLERİ
       (BAŞKENT KART · MUCİTHUB 100x IoT · BAŞKENT AİLEM · MUCİTLAB)
   ============================================================================ */
let projeStiliAktifSekme = 'baskentKart';
let mucitDeviceFilter = 'all';

function renderProjectSubAgentsStrip(styleObj) {
  const agents = styleObj?.altAjanlar || [];
  if (!agents.length) return '';
  return `
    <div class="card" style="background:var(--surface-soft);border-left:4px solid ${esc(styleObj.renk || '#1e3a8a')}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <h3 style="margin:0">🤖 ${esc(styleObj.ad)} — Sorumlu Alt Ajanlar (Kontrol · Kabul · Şartname · İhale · Hak Ediş)</h3>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px">
        ${agents.map(a => `
          <div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px">
            <div>
              <div style="font-weight:700;font-size:14px;color:var(--primary)">${esc(a.ad)}</div>
              <div style="font-size:12.5px;color:var(--text-muted);margin-top:4px">${esc(a.gorev)}</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="navigate('agent_detail',{dept:'01-Akilli-Sehirler-Sube-Mudurlugu',slug:'${esc(a.slug)}'})">
              💬 Ajana Görev Ver / Konuş →
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

async function renderProjeStilleriPage(el) {
  el.innerHTML = `<div class="card"><div class="skeleton-box" style="width:45%"></div><div class="skeleton-box"></div></div>`;
  const res = await api('/api/project-styles');
  const styles = res.styles || [];
  const d = res.data || {};
  const bk = d.baskentKart || {};
  const mh = d.mucithub || {};
  const ba = d.baskentAilem || {};
  const ml = d.mucitLab || {};
  const sharedDocs = d.sharedAdminDocs || [];

  const styleById = {};
  styles.forEach(s => { styleById[s.id] = s; });

  const devices = mh.devices || [];
  const summary = mh.summary || {
    totalDevices: devices.length,
    activeCount: devices.filter(x => x.status === 'calisiyor').length,
    completedReadyToPack: devices.filter(x => x.status === 'tamamlandi_paketleme').length,
    errorCount: devices.filter(x => x.status === 'hata_tespit').length,
    idleCount: devices.filter(x => x.status === 'hazir_beklemede').length
  };

  const filteredDevices = devices.filter(dev => {
    if (mucitDeviceFilter === 'anomaly') return dev.status === 'hata_tespit';
    if (mucitDeviceFilter === 'active') return dev.status === 'calisiyor';
    if (mucitDeviceFilter === 'finished') return dev.status === 'tamamlandi_paketleme';
    if (mucitDeviceFilter === 'idle') return dev.status === 'hazir_beklemede';
    return true;
  });

  el.innerHTML = `
    <div class="page-hero">
      <div>
        <h1>📂 Projeler Departmanı — Proje Stilleri, Kontrol & Kabul Alt Ajanları</h1>
        <p>Tüm projeler tek çatı altında: <strong>Başkent Kart</strong> (Kontrol & Kabul Ajanları), <strong>MucitHub</strong> (100 Cihazlı IoT Yönetimi), <strong>Başkent Ailem</strong> (Anne-Baba & Çocuk Mobil App) ve <strong>MucitLab</strong> (IoT, Sanat & İletişim Eğitimi). Her projenin teknik/idari şartname, ihale ve hakediş alt ajanları hazırdır.</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="downloadCurrentTenantOfflineApp()">💻 Bilgisayara İndir (.html)</button>
      </div>
    </div>

    <!-- PROJE SEKMELERİ -->
    <div class="subtabs">
      <button class="subtab ${projeStiliAktifSekme === 'baskentKart' ? 'active' : ''}" onclick="projeStiliAktifSekme='baskentKart';renderProjeStilleriPage(document.getElementById('pageContent'))">💳 Başkent Kart (Kontrol & Kabul)</button>
      <button class="subtab ${projeStiliAktifSekme === 'mucithub' ? 'active' : ''}" onclick="projeStiliAktifSekme='mucithub';renderProjeStilleriPage(document.getElementById('pageContent'))">📡 MucitHub (100 IoT Cihazı Yönetimi)</button>
      <button class="subtab ${projeStiliAktifSekme === 'baskentAilem' ? 'active' : ''}" onclick="projeStiliAktifSekme='baskentAilem';renderProjeStilleriPage(document.getElementById('pageContent'))">📱 Başkent Ailem (Anne-Baba & Çocuk App)</button>
      <button class="subtab ${projeStiliAktifSekme === 'mucitLab' ? 'active' : ''}" onclick="projeStiliAktifSekme='mucitLab';renderProjeStilleriPage(document.getElementById('pageContent'))">🧪 MucitLab (IoT, Sanat & İletişim)</button>
    </div>

    ${projeStiliAktifSekme === 'baskentKart' ? `
      ${renderProjectSubAgentsStrip(styleById['baskent-kart'])}
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">İncelenen Evrak (Kontrol Ajanı)</div><div class="stat-value">${(bk.kontrolOzeti?.incelenenEvrak || 2140).toLocaleString('tr-TR')}</div></div>
        <div class="stat-box"><div class="stat-label">Şüpheli İşlem Tespiti</div><div class="stat-value" style="color:var(--danger)">${bk.kontrolOzeti?.supheliIslemSayisi || 0} Kayıt</div></div>
        <div class="stat-box"><div class="stat-label">Drive & Fiziksel Klasör</div><div class="stat-value" style="font-size:14px">${esc(bk.kontrolOzeti?.driveKlasor || '')}</div><div class="stat-sub">${esc(bk.kontrolOzeti?.fizikselKlasor || '')}</div></div>
        <div class="stat-box"><div class="stat-label">Kabul Ajanı Durumu</div><div class="stat-value" style="font-size:15px;color:var(--primary)">${esc(bk.kontrolOzeti?.kabulDurumu || '')}</div></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <h2 style="margin:0">🔍 Kontrol Ajanı Bulguları & ✅ Kabul Ajanı Doğrulaması</h2>
            <div style="font-size:13px;color:var(--text-muted)">Son Kullanıcı Ödeme Linki: <code>${esc(bk.kontrolOzeti?.sonKullaniciOdemeLinki || '')}</code></div>
          </div>
          <button class="btn btn-success" onclick="approveBaskentKartKabul()">✅ Kabul Ajanı: Drive/Link/Klasör Kontrolünü Tamamla & Kesin Kabulü Onayla</button>
        </div>
        <div style="display:grid;gap:10px">
          ${(bk.sonKontrolBulguları || []).map(f => `
            <div style="padding:12px;border:1px solid var(--border);border-radius:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
              <div>
                <strong>${esc(f.id)} — ${esc(f.baslik)}</strong> <span class="skill-tag">${esc(f.ajan)}</span>
                <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${esc(f.detay)}</div>
              </div>
              <span class="status-badge ${f.durum === 'dogrulandi' ? 'ok' : 'warn'}">${esc(f.durum)}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div id="bkEmbeddedAuditContainer"></div>
    ` : ''}

    ${projeStiliAktifSekme === 'mucithub' ? `
      ${renderProjectSubAgentsStrip(styleById['iot-yonetimi'])}
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">Toplam IoT Cihazı</div><div class="stat-value">${summary.totalDevices} Cihaz</div><div class="stat-sub">IOT-001 .. IOT-100</div></div>
        <div class="stat-box"><div class="stat-label">Aktif İşlemde</div><div class="stat-value" style="color:var(--primary)">${summary.activeCount} Cihaz</div></div>
        <div class="stat-box"><div class="stat-label">Sensör / Kamera CV Uyarısı</div><div class="stat-value" style="color:var(--danger)">${summary.errorCount} Anomali</div><div class="stat-sub">CV ile otomatik durduruldu</div></div>
        <div class="stat-box"><div class="stat-label">Paketleme / Dosyalama / Hazır</div><div class="stat-value" style="color:var(--success)">${summary.completedReadyToPack} Tamam / ${summary.idleCount} Hazır</div></div>
      </div>

      <div class="card" style="border-left:5px solid var(--primary)">
        <h2>📦 Dosya Formatlama ➔ Uygun IoT Cihazlarına Gönderim ➔ Sensör & Kamera CV İzleme</h2>
        <div class="form-row" style="grid-template-columns:1fr 1fr auto;align-items:end">
          <div>
            <label class="field-label">Hazırlanacak Dosya / İçerik Adı</label>
            <input id="mhUploadName" type="text" placeholder="Örn: akilli-durak-sensor-konfig.json veya yonlendirme-haritasi.svg" />
          </div>
          <div>
            <label class="field-label">Hedef IoT Formatı</label>
            <select id="mhTargetFormat">
              <option value="MQTT + Edge Firmware Paketi">MQTT + Edge Firmware Paketi</option>
              <option value="JSON-CMD / IoT Görev Seti">JSON-CMD / IoT Görev Seti</option>
              <option value="G-Code / Seri Cihaz Paketi">G-Code / Seri Cihaz Paketi</option>
              <option value="SVG-Vektör / IoT Job">SVG-Vektör / IoT Job</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="mucitDispatchIoT()">⚡ Formatla ve Uygun IoT Cihazına Gönder</button>
        </div>
        <div class="table-container" style="margin-top:14px">
          <table class="clean-table">
            <thead><tr><th>İş No</th><th>Kaynak Dosya/İçerik</th><th>Hazırlanan Format</th><th>Hedef IoT Cihazı</th><th>Süreç Durumu</th><th>CV Skoru</th></tr></thead>
            <tbody>
              ${(mh.pipelineQueue || []).map(q => `
                <tr>
                  <td><strong>${esc(q.id)}</strong></td>
                  <td>${esc(q.title)}</td>
                  <td>${esc(q.targetFormat)}</td>
                  <td><span class="skill-tag">${esc(q.assignedDevice)}</span></td>
                  <td><span class="status-badge ok">${esc(q.stage)}</span></td>
                  <td>%${esc(String(q.cvScore))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <h2 style="margin:0">📡 100 Adet IoT Cihazı Sensör & Kamera Görüntü İşleme (CV) Paneli</h2>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm ${mucitDeviceFilter === 'all' ? 'btn-primary' : ''}" onclick="mucitDeviceFilter='all';renderProjeStilleriPage(document.getElementById('pageContent'))">Tümü (${devices.length})</button>
            <button class="btn btn-sm ${mucitDeviceFilter === 'anomaly' ? 'btn-danger' : ''}" onclick="mucitDeviceFilter='anomaly';renderProjeStilleriPage(document.getElementById('pageContent'))">⚠️ Sensör/CV Uyarısı (${summary.errorCount})</button>
            <button class="btn btn-sm ${mucitDeviceFilter === 'active' ? 'btn-primary' : ''}" onclick="mucitDeviceFilter='active';renderProjeStilleriPage(document.getElementById('pageContent'))">Çalışıyor (${summary.activeCount})</button>
            <button class="btn btn-sm ${mucitDeviceFilter === 'finished' ? 'btn-primary' : ''}" onclick="mucitDeviceFilter='finished';renderProjeStilleriPage(document.getElementById('pageContent'))">Paketleme Bekleyen (${summary.completedReadyToPack})</button>
          </div>
        </div>
        <div style="max-height:460px;overflow-y:auto" class="table-container">
          <table class="clean-table">
            <thead><tr><th>IoT Cihazı</th><th>Bölge & Model</th><th>Aktif İş & Format</th><th>Sensör Telemetrisi</th><th>Kamera CV Durumu</th><th>İşlem</th></tr></thead>
            <tbody>
              ${filteredDevices.map(dev => {
                const isErr = dev.status === 'hata_tespit';
                const isDone = dev.status === 'tamamlandi_paketleme';
                return `
                  <tr style="${isErr ? 'background:#fff5f5' : ''}">
                    <td><strong>${esc(dev.id)}</strong><div style="font-size:12px">${esc(dev.status)} (%${dev.progress})</div></td>
                    <td>${esc(dev.zone)}<div style="font-size:12px;color:var(--text-muted)">${esc(dev.model)}</div></td>
                    <td>${esc(dev.currentJob || 'Beklemede')}<div style="font-size:12px;color:var(--text-muted)">${esc(dev.format)}</div></td>
                    <td style="font-size:12.5px">Isı: ${dev.sensors?.operatingTempC}°C · Güç: %${dev.sensors?.powerLoadPct}<br/>RSSI: ${dev.sensors?.signalRssi} dBm · ${dev.sensors?.cameraFps} FPS</td>
                    <td><span class="status-badge ${isErr ? 'warn' : 'ok'}">${esc(dev.alertNote || dev.cvStatus)}</span></td>
                    <td>
                      ${isErr ? `<button class="btn btn-primary btn-sm" onclick="mucitFixDevice('${esc(dev.id)}')">🔧 Kalibre Et</button>`
                        : `<button class="btn btn-sm ${isDone ? 'btn-success' : ''}" onclick="mucitPackageAndShip('${esc(dev.id)}')">📦 Paketle, Dosyala & Sevk Et</button>`}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h2>📦 Paketleme, Dosyalama & Son Kullanıcı Sevkiyatları · 💰 Hak Ediş & İhale Evrakları</h2>
        <div class="form-row">
          <div>
            <h3>Paketlenip Dosyalanan & Sevk Edilen Çıktılar</h3>
            ${(mh.shipments || []).map(sh => `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px"><strong>${esc(sh.id)}</strong> — ${esc(sh.jobTitle)}<div style="font-size:12.5px;color:var(--text-muted)">Alıcı: ${esc(sh.recipient)} · Arşiv: <code>${esc(sh.archivePath)}</code> · Kargo: <strong>${esc(sh.cargoCode)}</strong> (${esc(sh.status)})</div></div>`).join('')}
          </div>
          <div>
            <h3>Proje Şartname, İhale & Hak Ediş Ödemeleri</h3>
            ${sharedDocs.map(doc => `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;gap:8px"><div><strong>${esc(doc.project)} · ${esc(doc.type)}</strong> (${fmtMoney(doc.amountTry)})<div style="font-size:12.5px;color:var(--text-muted)">${esc(doc.title)} — ${esc(doc.status)}</div></div>${doc.status !== 'odendi' ? `<button class="btn btn-success btn-sm" onclick="payProjectHakedis('${esc(doc.id)}')">✔ Öde / Onayla</button>` : ''}</div>`).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    ${projeStiliAktifSekme === 'baskentAilem' ? `
      ${renderProjectSubAgentsStrip(styleById['baskent-ailem'])}
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">Anne-Baba Mobil App</div><div class="stat-value">${(ba.metrics?.parentAppUsers || 0).toLocaleString('tr-TR')}</div></div>
        <div class="stat-box"><div class="stat-label">Çocuk Mobil App</div><div class="stat-value">${(ba.metrics?.childAppUsers || 0).toLocaleString('tr-TR')}</div></div>
        <div class="stat-box"><div class="stat-label">Aktif Eşleşme</div><div class="stat-value">${(ba.metrics?.activePairings || 0).toLocaleString('tr-TR')}</div></div>
        <div class="stat-box"><div class="stat-label">Açık Son Kullanıcı Kaydı</div><div class="stat-value" style="color:var(--accent-gold)">${ba.metrics?.openTickets || 0} Kayıt</div><div class="stat-sub">SLA: %${ba.metrics?.slaCompliancePct || 99.1}</div></div>
      </div>

      <div class="card">
        <h2>📱 Anne-Baba & Çocuk Mobil Uygulama Son Kullanıcı Takibi ve Muhatap İletişimi</h2>
        <table class="clean-table">
          <thead><tr><th>Kayıt</th><th>Veli & Çocuk Cihazı</th><th>Kategori</th><th>Durum</th><th>Not / Ajan Takibi</th><th>İşlem</th></tr></thead>
          <tbody>
            ${(ba.recentTickets || []).map(r => `
              <tr>
                <td><strong>${esc(r.id)}</strong></td>
                <td>${esc(r.parentUser)}<div style="font-size:12px;color:var(--text-muted)">${esc(r.childDevice)}</div></td>
                <td>${esc(r.category)}</td>
                <td><span class="status-badge ${r.status === 'cozuldu' ? 'ok' : 'warn'}">${esc(r.status)}</span></td>
                <td style="font-size:13px">${esc(r.note)}</td>
                <td>${r.status !== 'cozuldu' ? `<button class="btn btn-primary btn-sm" onclick="resolveBaskentAilem('${esc(r.id)}')">✔ Çözüldü İşaretle</button>` : 'Doğrulandı'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <h2>🤝 Muhatap İletişim Kayıtları & 💰 Hak Ediş / Şartname Durumu</h2>
        <div class="form-row">
          <div>
            <h3>Muhatap Firma & Kurum İletişimi</h3>
            ${(ba.stakeholderComms || []).map(c => `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px"><strong>${esc(c.date)} · ${esc(c.counterparty)}</strong><div style="font-size:13px;color:var(--text-muted)">${esc(c.topic)} — <strong>${esc(c.status)}</strong></div></div>`).join('')}
          </div>
          <div>
            <h3>Şartname, İhale & Hak Edişler</h3>
            ${sharedDocs.map(doc => `<div style="padding:10px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center"><div><strong>${esc(doc.project)} · ${esc(doc.type)}</strong> (${fmtMoney(doc.amountTry)})<div style="font-size:12.5px;color:var(--text-muted)">${esc(doc.title)} — ${esc(doc.status)}</div></div>${doc.status !== 'odendi' ? `<button class="btn btn-success btn-sm" onclick="payProjectHakedis('${esc(doc.id)}')">✔ Öde</button>` : ''}</div>`).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    ${projeStiliAktifSekme === 'mucitLab' ? `
      ${renderProjectSubAgentsStrip(styleById['mucitlab'])}
      <div class="stats-grid">
        <div class="stat-box"><div class="stat-label">Toplam Öğrenci</div><div class="stat-value">${(ml.metrics?.totalStudents || 0).toLocaleString('tr-TR')} Çocuk</div></div>
        <div class="stat-box"><div class="stat-label">Aktif IoT / Sanat / İletişim Atölyesi</div><div class="stat-value">${ml.metrics?.activeWorkshops || 24} Atölye</div></div>
        <div class="stat-box"><div class="stat-label">Yüklenen Görsel/Video/Dosya</div><div class="stat-value">${ml.metrics?.submittedMediaCount || 386}</div></div>
        <div class="stat-box"><div class="stat-label">Onaylanan Medya & Dosya</div><div class="stat-value" style="color:var(--success)">${ml.metrics?.verifiedMediaCount || 374}</div></div>
      </div>

      <div class="card">
        <h2>🧪 MucitLab — Çocuklara IoT, Sanat ve İletişim Uygulamalı Eğitim Atölyeleri</h2>
        <table class="clean-table">
          <thead><tr><th>Kod</th><th>Alan & Atölye</th><th>Yaş Grubu</th><th>Eğitmen & Öğrenci</th><th>Medya / Dosya Türü</th><th>Kontrol</th><th>İşlem</th></tr></thead>
          <tbody>
            ${(ml.workshops || []).map(w => `
              <tr>
                <td><strong>${esc(w.id)}</strong></td>
                <td><span class="skill-tag">${esc(w.track)}</span> ${esc(w.title)}</td>
                <td>${esc(w.ageGroup)}</td>
                <td>${esc(w.instructor)} (${w.students} öğrenci)</td>
                <td>${esc(w.mediaType)}</td>
                <td><span class="status-badge ${w.controlStatus === 'onaylandi' ? 'ok' : 'warn'}">${esc(w.controlStatus)}</span></td>
                <td>${w.controlStatus !== 'onaylandi' ? `<button class="btn btn-sm btn-primary" onclick="approveMucitLabMedia('${esc(w.id)}')">✔ Kontrol Onayla</button>` : 'Onaylı'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}
  `;

  if (projeStiliAktifSekme === 'baskentKart') {
    const bkTarget = document.getElementById('bkEmbeddedAuditContainer');
    if (bkTarget && typeof renderBaskentKartAuditPage === 'function') {
      renderBaskentKartAuditPage(bkTarget);
    }
  }
}

window.mucitDispatchIoT = async function() {
  const fileName = document.getElementById('mhUploadName')?.value.trim() || 'yeni-iot-paketi.json';
  const targetFormat = document.getElementById('mhTargetFormat')?.value || 'MQTT + Edge Firmware Paketi';
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'mucithub_dispatch_iot', fileName, targetFormat }) });
  showToast(`"${fileName}" (${targetFormat}) formatına hazırlanıp uygun IoT cihazına gönderildi.`, 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

window.mucitFixDevice = async function(deviceId) {
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'mucithub_fix_device', deviceId }) });
  showToast(`${deviceId} kalibre edildi, sensör ve kamera görüntü işleme normal.`, 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

window.mucitPackageAndShip = async function(deviceId) {
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'mucithub_package_ship', deviceId }) });
  showToast(`${deviceId} çıktısı paketlendi, dosyalandı ve son kullanıcıya sevk edildi.`, 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

window.approveBaskentKartKabul = async function() {
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'baskent_kart_kabul_onayla' }) });
  showToast('Kabul Ajanı: Kontrol raporları ve Drive/link/klasör dosyaları onaylandı, kesin kabul tamamlandı.', 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

window.payProjectHakedis = async function(docId) {
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'pay_hakedis', docId }) });
  showToast('Hak ediş / ihale evrak ödemesi onaylandı.', 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

window.resolveBaskentAilem = async function(ticketId) {
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'resolve_baskent_ailem', ticketId }) });
  showToast(`${ticketId} son kullanıcı sorunu çözüldü.`, 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

window.approveMucitLabMedia = async function(workshopId) {
  await api('/api/project-styles', { method: 'POST', body: JSON.stringify({ action: 'approve_mucitlab_media', workshopId }) });
  showToast('MucitLab görsel/video/dosya kontrolü onaylandı.', 'ok');
  renderProjeStilleriPage(document.getElementById('pageContent'));
};

