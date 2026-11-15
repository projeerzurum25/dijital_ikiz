// ============================================================================
// KURUMSAL DİJİTAL İKİZ v4.0 — 3D SANAL OFİS MOTORU (office3d.js)
// %100 Offline, Sıfır Harici Bağımlılık, Gerçek 3D Perspektif/İzometrik Projeksiyon
// Özellikler:
// - 360° Döndürülebilir (Yaw/Pitch), Kaydırılabilir (Pan) ve Yakınlaştırılabilir (Zoom) 3D Kamera
// - Gönderilen referans görseldeki mimari: Merkezi Mavi Kareli Lobi, Kırmızı Halılı CEO Odası,
//   Toplantı Odası, 10 Departman Odası, Giriş Yolu, Bahçe Ağaçları ve Sağ Altta Otopark + 3D Araçlar
// - 3D Voksel (Voxel) Ajan Karakterleri: Masa başında çalışma, yürüme animasyonu, baş üstü isimlik
//   ve canlı konuşma balonları
// - Tıklanabilir 3D Ajan Seçimi + Sol Alt İnteraktif Mini-Harita (Radar)
// ============================================================================

(function () {
  let canvas = null;
  let ctx = null;
  let animId = null;
  let lastTime = 0;

  // Kamera durumu
  const cam = {
    yaw: -0.72,          // Yatay dönüş açısı (radyan)
    pitch: 0.62,        // Dikey bakış açısı (radyan)
    zoom: 11.5,         // Ölçek
    targetYaw: -0.72,
    targetPitch: 0.62,
    targetZoom: 11.5,
    panX: 0,
    panY: 25,
    targetPanX: 0,
    targetPanY: 25,
    dragging: false,
    panning: false,
    lastMX: 0,
    lastMY: 0,
    moved: false,
  };

  // Atmosfer modu: 'sunset' (ekran görüntüsündeki pembe/turuncu gün batımı), 'day' (aydınlık), 'night' (7/24 gece vardiyası)
  let lightingMode = 'sunset';
  let selectedAgentSlug = null;
  let hoveredAgentSlug = null;
  let meetingModeActive = false;
  let meetingTimer = 0;

  // 3D bina yerleşim planı (X: -48..+48, Z: -36..+36, Y: yükseklik 0..yukarı)
  // Merkez koridor/lobi: X: -12..+12, Z: -32..+32
  // Sol kanat odaları: X: -46..-12 (CEO odası, Toplantı odası ve 4 departman)
  // Sağ kanat odaları: X: +12..+46 (6 departman)
  const ROOMS = [
    {
      id: 'lobby',
      code: 'LOBI',
      name: 'Merkezi Lobi & Komuta Koridoru',
      x1: -12, z1: -32, x2: 12, z2: 32,
      floorColor: '#252b48',
      checkerColor: '#2f375b',
      wallColor: '#c9a679',
      isLobby: true,
    },
    {
      id: 'ceo',
      code: 'CEO',
      name: 'Genel Müdür (Çatı Ajan) Makamı',
      x1: -46, z1: -32, x2: -12, z2: -16,
      floorColor: '#8c1d2c', // Görseldeki kırmızı halı
      checkerColor: '#7a1826',
      wallColor: '#d4b48c',
      carpetMargin: 2.5,
    },
    {
      id: 'meeting',
      code: 'TOPLANTI',
      name: 'Yönetim Kurulu Toplantı Odası',
      x1: -46, z1: -16, x2: -12, z2: 0,
      floorColor: '#1e293b',
      checkerColor: '#263449',
      wallColor: '#d4b48c',
    },
    // Sol kanat departmanları (01..04)
    { id: '01-Proje-Yonetimi', code: '01-PROJE', name: '01. Proje Yönetimi', x1: -46, z1: 0, x2: -29, z2: 16, floorColor: '#2b3548', wallColor: '#d4b48c' },
    { id: '02-Strateji-ve-Arastirma', code: '02-STRATEJİ', name: '02. Strateji & Araştırma', x1: -29, z1: 0, x2: -12, z2: 16, floorColor: '#312e48', wallColor: '#d4b48c' },
    { id: '03-Urun-ve-Tasarim', code: '03-ÜRÜN/UI', name: '03. Ürün & Tasarım', x1: -46, z1: 16, x2: -29, z2: 32, floorColor: '#3b2d42', wallColor: '#d4b48c' },
    { id: '04-Yazilim-ve-Mimari', code: '04-YAZILIM', name: '04. Yazılım & Mimari', x1: -29, z1: 16, x2: -12, z2: 32, floorColor: '#1f3a3d', wallColor: '#d4b48c' },

    // Sağ kanat departmanları (05..10) — görseldeki sağ kanat çalışma odaları
    { id: '05-Test-QA-ve-Guvenlik', code: '05-GÜVENLİK', name: '05. Test, QA & Siber Güvenlik', x1: 12, z1: -32, x2: 46, z2: -12, floorColor: '#6b7280', wallColor: '#d4b48c' },
    { id: '06-Otomasyon-ve-Veri', code: '06-OTOMASYON', name: '06. Otomasyon & Veri Müh.', x1: 12, z1: -12, x2: 29, z2: 4, floorColor: '#7c6244', wallColor: '#d4b48c' },
    { id: '07-Icerik-ve-Medya', code: '07-MEDYA', name: '07. İçerik & Medya', x1: 29, z1: -12, x2: 46, z2: 4, floorColor: '#6d5444', wallColor: '#d4b48c' },
    { id: '08-Dijital-Pazarlama', code: '08-PAZARLAMA', name: '08. Dijital Pazarlama', x1: 12, z1: 4, x2: 29, z2: 18, floorColor: '#8c6d46', wallColor: '#d4b48c' },
    { id: '09-Satis-ve-CRM', code: '09-SATIŞ/CRM', name: '09. Satış & CRM', x1: 29, z1: 4, x2: 46, z2: 18, floorColor: '#7a5c3c', wallColor: '#d4b48c' },
    { id: '10-Finans-ve-Operasyon', code: '10-FİNANS/HUKUK', name: '10. Finans, Hukuk & Operasyon', x1: 12, z1: 18, x2: 46, z2: 32, floorColor: '#c9b38c', wallColor: '#d4b48c' },
  ];

  // 3D Ajan nesneleri (simülasyon durumu)
  let agents3D = [];
  let screenProjections = []; // Fare tıklaması için ekran koordinatları

  const SHIRT_COLORS = [
    '#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ef4444', '#14b8a6', '#f97316', '#6366f1',
  ];
  const HAIR_COLORS = ['#fde047', '#78350f', '#1e293b', '#b45309', '#9a3412', '#d97706'];

  function hashNum(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return Math.abs(h);
  }

  // Kurum verisinden 3D ajanları ve masa koordinatlarını oluştur
  function syncAgentsFromState(appState) {
    if (!appState) return;
    const existingMap = new Map(agents3D.map(a => [a.slug, a]));
    const nextAgents = [];

    // 1. Genel Müdür (CEO)
    const ceoExisting = existingMap.get('genel-mudur');
    const ceoLive = appState.ceoLive || { status: 'idle', activity: 'Kurum koordinasyonu aktif' };
    nextAgents.push({
      slug: 'genel-mudur',
      title: 'Genel Müdür (Çatı Ajan)',
      dept: '01-Proje-Yonetimi',
      roomId: 'ceo',
      head: true,
      isCeo: true,
      homeX: -32,
      homeZ: -25,
      x: ceoExisting ? ceoExisting.x : -32,
      z: ceoExisting ? ceoExisting.z : -25,
      targetX: -32,
      targetZ: -25,
      facing: 0,
      shirtColor: '#facc15',
      hairColor: '#1e293b',
      status: ceoLive.status || 'idle',
      activity: ceoLive.activity || 'Komuta merkezi aktif',
      speech: ceoLive.status === 'working' ? ceoLive.activity : null,
      skillsCount: 10,
    });

    // 2. 10 Departman Personelleri
    const byDept = {};
    for (const p of appState.personnel || []) {
      if (!byDept[p.dept]) byDept[p.dept] = [];
      byDept[p.dept].push(p);
    }

    for (const [deptSlug, list] of Object.entries(byDept)) {
      const room = ROOMS.find(r => r.id === deptSlug);
      if (!room) continue;
      const w = room.x2 - room.x1;
      const d = room.z2 - room.z1;
      const cols = w > 22 ? 3 : 2;

      list.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const deskX = room.x1 + 5.5 + col * ((w - 9) / Math.max(1, cols - 1 || 1));
        const deskZ = room.z1 + 5.5 + row * Math.min(7, (d - 8) / Math.max(1, Math.ceil(list.length / cols)));
        const h = hashNum(p.slug);
        const prev = existingMap.get(p.slug);
        const liveStatus = p.live?.status || 'idle';

        // Eğer toplantı modundaysa veya aktif çalışıyorsa hedef nokta
        let tx = deskX;
        let tz = deskZ;
        if (meetingModeActive && p.head) {
          // Departman yöneticileri Toplantı Odası masası etrafına dizilir
          const mIdx = Number(deptSlug.slice(0, 2)) - 1;
          const side = mIdx < 5 ? -1 : 1;
          const slot = mIdx % 5;
          tx = -36 + slot * 4.2;
          tz = -8 + side * 3.6;
        }

        nextAgents.push({
          slug: p.slug,
          title: p.title,
          dept: p.dept,
          roomId: room.id,
          head: !!p.head,
          mission: p.mission,
          skillsCount: p.skillsCount || 0,
          skillsNames: p.skillsNames || [],
          homeX: deskX,
          homeZ: deskZ,
          x: prev ? prev.x : deskX,
          z: prev ? prev.z : deskZ,
          targetX: tx,
          targetZ: tz,
          walkPhase: prev ? prev.walkPhase : (h % 100) / 10,
          shirtColor: SHIRT_COLORS[h % SHIRT_COLORS.length],
          hairColor: HAIR_COLORS[(h >> 3) % HAIR_COLORS.length],
          status: liveStatus,
          activity: p.live?.activity || 'Görev bekliyor',
          speech: liveStatus === 'working' ? (p.live?.activity || 'Çalışıyor...') : (prev?.speech || null),
          speechUntil: prev?.speechUntil || 0,
        });
      });
    }

    agents3D = nextAgents;
  }

  // 3D Noktayı (x, y, z) 2D Ekran Koordinatına (sx, sy, depth) dönüştür
  function project(x, y, z, width, height) {
    const cosY = Math.cos(cam.yaw);
    const sinY = Math.sin(cam.yaw);
    const cosP = Math.cos(cam.pitch);
    const sinP = Math.sin(cam.pitch);

    const rx = x * cosY - z * sinY;
    const rz = x * sinY + z * cosY;

    const cy = y * cosP - rz * sinP;
    const cz = y * sinP + rz * cosP;

    // Hafif perspektif + izometrik hibrit projeksiyon
    const fov = 260;
    const persp = fov / (fov + cz * 0.85);
    const scale = cam.zoom * persp;

    const sx = width * 0.5 + cam.panX + rx * scale;
    const sy = height * 0.54 + cam.panY - cy * scale;
    return { x: sx, y: sy, depth: cz, scale };
  }

  // Renk parlaklığını ayarla (3D yüzey ışıklandırması için)
  function shadeColor(hex, factor) {
    const c = hex.replace('#', '');
    const num = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16);
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
    return `rgb(${r},${g},${b})`;
  }

  // 3D Prizma / Kutu (Box) oluşturucu — 6 yüzeyini (veya görünen üst/yan yüzeylerini) poligon listesine ekler
  function pushBox(polys, x1, y1, z1, x2, y2, z2, color, opts = {}) {
    const topColor = opts.topColor || shadeColor(color, 1.12);
    const sideXColor = opts.sideXColor || shadeColor(color, 0.86);
    const sideZColor = opts.sideZColor || shadeColor(color, 0.74);
    const stroke = opts.stroke || null;

    // Üst yüzey (y = y2)
    polys.push({
      pts: [[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]],
      color: topColor,
      stroke,
      bias: opts.bias || 0,
    });
    // Ön/Arka Z yüzeyleri
    polys.push({
      pts: [[x1, y1, z2], [x2, y1, z2], [x2, y2, z2], [x1, y2, z2]],
      color: sideZColor,
      stroke,
      bias: opts.bias || 0,
    });
    polys.push({
      pts: [[x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1]],
      color: sideZColor,
      stroke,
      bias: opts.bias || 0,
    });
    // Sol/Sağ X yüzeyleri
    polys.push({
      pts: [[x2, y1, z1], [x2, y1, z2], [x2, y2, z2], [x2, y2, z1]],
      color: sideXColor,
      stroke,
      bias: opts.bias || 0,
    });
    polys.push({
      pts: [[x1, y1, z1], [x1, y1, z2], [x1, y2, z2], [x1, y2, z1]],
      color: sideXColor,
      stroke,
      bias: opts.bias || 0,
    });
  }

  // Kapı boşluklu 3D duvar çizimi
  function pushWallWithDoor(polys, x1, z1, x2, z2, height, thickness, color, hasDoor = true) {
    const isHoriz = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    if (!hasDoor) {
      if (isHoriz) pushBox(polys, x1, 0, z1 - thickness / 2, x2, height, z1 + thickness / 2, color);
      else pushBox(polys, x1 - thickness / 2, 0, z1, x1 + thickness / 2, height, z2, color);
      return;
    }
    const midX = (x1 + x2) / 2;
    const midZ = (z1 + z2) / 2;
    const doorHalf = 2.0;
    const doorH = 3.6;

    if (isHoriz) {
      const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
      pushBox(polys, minX, 0, z1 - thickness / 2, midX - doorHalf, height, z1 + thickness / 2, color);
      pushBox(polys, midX + doorHalf, 0, z1 - thickness / 2, maxX, height, z1 + thickness / 2, color);
      pushBox(polys, midX - doorHalf, doorH, z1 - thickness / 2, midX + doorHalf, height, z1 + thickness / 2, color);
      // Kapı pervazı (koyu çerçeve)
      pushBox(polys, midX - doorHalf - 0.25, 0, z1 - thickness * 0.6, midX - doorHalf, doorH, z1 + thickness * 0.6, '#1e293b');
      pushBox(polys, midX + doorHalf, 0, z1 - thickness * 0.6, midX + doorHalf + 0.25, doorH, z1 + thickness * 0.6, '#1e293b');
    } else {
      const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
      pushBox(polys, x1 - thickness / 2, 0, minZ, x1 + thickness / 2, height, midZ - doorHalf, color);
      pushBox(polys, x1 - thickness / 2, 0, midZ + doorHalf, x1 + thickness / 2, height, maxZ, color);
      pushBox(polys, x1 - thickness / 2, doorH, midZ - doorHalf, x1 + thickness / 2, height, midZ + doorHalf, color);
      pushBox(polys, x1 - thickness * 0.6, 0, midZ - doorHalf - 0.25, x1 + thickness * 0.6, doorH, midZ - doorHalf, '#1e293b');
      pushBox(polys, x1 - thickness * 0.6, 0, midZ + doorHalf, x1 + thickness * 0.6, doorH, midZ + doorHalf + 0.25, '#1e293b');
    }
  }

  // Masa + Monitör + Sandalye + 3D Voksel Ajan Çizimi
  function pushDeskAndChair(polys, x, z, monitorColor = '#22c55e') {
    // Ahşap çalışma masası tablası
    pushBox(polys, x - 2.1, 1.3, z - 1.1, x + 2.1, 1.55, z + 1.1, '#a16207');
    // Masa ayakları
    pushBox(polys, x - 1.9, 0, z - 0.9, x - 1.65, 1.3, z - 0.65, '#475569');
    pushBox(polys, x + 1.65, 0, z - 0.9, x + 1.9, 1.3, z - 0.65, '#475569');
    pushBox(polys, x - 1.9, 0, z + 0.65, x - 1.65, 1.3, z + 0.9, '#475569');
    pushBox(polys, x + 1.65, 0, z + 0.65, x + 1.9, 1.3, z + 0.9, '#475569');
    // Bilgisayar monitörü (parlayan ekran)
    pushBox(polys, x - 0.9, 1.55, z - 0.65, x + 0.9, 2.55, z - 0.45, '#0f172a', { topColor: '#1e293b', sideZColor: monitorColor });
    // Klavye
    pushBox(polys, x - 0.6, 1.56, z + 0.05, x + 0.6, 1.62, z + 0.45, '#cbd5e1');
    // Ofis koltuğu
    pushBox(polys, x - 0.85, 0.75, z + 1.35, x + 0.85, 0.95, z + 2.25, '#334155');
    pushBox(polys, x - 0.85, 0.95, z + 2.05, x + 0.85, 2.1, z + 2.3, '#1e293b');
  }

  // 3D Voksel Ajan Karakteri
  function pushVoxelAgent(polys, agent, timeSec, isSelected, isHovered) {
    const dx = agent.targetX - agent.x;
    const dz = agent.targetZ - agent.z;
    const dist = Math.hypot(dx, dz);
    const isWalking = dist > 0.35;
    const bob = isWalking ? Math.abs(Math.sin(timeSec * 8 + agent.walkPhase)) * 0.35 : Math.sin(timeSec * 2.2 + (agent.walkPhase || 0)) * 0.06;

    const ax = agent.x;
    const az = isWalking ? agent.z : agent.z + 1.65; // Masadaysa koltukta oturur
    const baseY = (isWalking ? 0 : 0.25) + bob;

    // Seçili ajan halkası (zemin üzerinde parlayan halka)
    if (isSelected || isHovered) {
      const ringCol = isSelected ? '#facc15' : '#38bdf8';
      pushBox(polys, ax - 1.45, 0.05, az - 1.45, ax + 1.45, 0.14, az + 1.45, ringCol, { topColor: ringCol });
    }

    // Bacaklar
    const legSwing = isWalking ? Math.sin(timeSec * 10 + agent.walkPhase) * 0.35 : 0;
    pushBox(polys, ax - 0.55, baseY, az - 0.25 + legSwing, ax - 0.1, baseY + 0.95, az + 0.25 + legSwing, '#1e3a8a');
    pushBox(polys, ax + 0.1, baseY, az - 0.25 - legSwing, ax + 0.55, baseY + 0.95, az + 0.25 - legSwing, '#1e3a8a');

    // Gövde (Gömlek/Ceket)
    pushBox(polys, ax - 0.72, baseY + 0.95, az - 0.42, ax + 0.72, baseY + 2.15, az + 0.42, agent.shirtColor);

    // Kollar
    pushBox(polys, ax - 1.05, baseY + 1.1, az - 0.35 - legSwing * 0.6, ax - 0.72, baseY + 2.05, az + 0.25, agent.shirtColor);
    pushBox(polys, ax + 0.72, baseY + 1.1, az - 0.35 + legSwing * 0.6, ax + 1.05, baseY + 2.05, az + 0.25, agent.shirtColor);

    // Kafa (Ten rengi küp)
    pushBox(polys, ax - 0.62, baseY + 2.15, az - 0.55, ax + 0.62, baseY + 3.25, az + 0.55, '#f5cba7');

    // Saç
    pushBox(polys, ax - 0.66, baseY + 2.98, az - 0.58, ax + 0.66, baseY + 3.38, az + 0.58, agent.hairColor);

    return { headX: ax, headY: baseY + 3.85, headZ: az };
  }

  // Ağaç çizimi (Bahçe peyzajı)
  function pushTree(polys, x, z, scale = 1) {
    pushBox(polys, x - 0.6 * scale, 0, z - 0.6 * scale, x + 0.6 * scale, 2.4 * scale, z + 0.6 * scale, '#78350f');
    pushBox(polys, x - 2.2 * scale, 2.2 * scale, z - 2.2 * scale, x + 2.2 * scale, 5.2 * scale, z + 2.2 * scale, '#15803d');
    pushBox(polys, x - 1.5 * scale, 4.8 * scale, z - 1.5 * scale, x + 1.5 * scale, 6.8 * scale, z + 1.5 * scale, '#22c55e');
  }

  // 3D Otopark Aracı çizimi (Görseldeki sağ alt otopark)
  function pushCar(polys, x, z, color) {
    // Alt gövde
    pushBox(polys, x - 2.1, 0.35, z - 3.8, x + 2.1, 1.45, z + 3.8, color);
    // Üst kabin / cam
    pushBox(polys, x - 1.75, 1.45, z - 1.9, x + 1.75, 2.35, z + 1.6, '#bae6fd', { topColor: color });
    // Tekerlekler
    pushBox(polys, x - 2.25, 0, z - 2.6, x - 1.85, 0.7, z - 1.4, '#0f172a');
    pushBox(polys, x + 1.85, 0, z - 2.6, x + 2.25, 0.7, z - 1.4, '#0f172a');
    pushBox(polys, x - 2.25, 0, z + 1.4, x - 1.85, 0.7, z + 2.6, '#0f172a');
    pushBox(polys, x + 1.85, 0, z + 1.4, x + 2.25, 0.7, z + 2.6, '#0f172a');
  }

  // Ana 3D Sahne Çizim Döngüsü
  function renderScene(timestamp) {
    if (!canvas || !ctx) return;
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000 || 0.016);
    lastTime = timestamp;
    const timeSec = timestamp / 1000;

    // Kamera yumuşak geçiş (smooth interpolation)
    cam.yaw += (cam.targetYaw - cam.yaw) * 0.14;
    cam.pitch += (cam.targetPitch - cam.pitch) * 0.14;
    cam.zoom += (cam.targetZoom - cam.zoom) * 0.14;
    cam.panX += (cam.targetPanX - cam.panX) * 0.14;
    cam.panY += (cam.targetPanY - cam.panY) * 0.14;

    // Ajanların yürüme hareketini güncelle
    for (const a of agents3D) {
      const dx = a.targetX - a.x;
      const dz = a.targetZ - a.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.25) {
        const speed = 11.5 * dt;
        const step = Math.min(dist, speed);
        a.x += (dx / dist) * step;
        a.z += (dz / dist) * step;
      }
    }

    const W = canvas.width;
    const H = canvas.height;

    // 1. Gökyüzü ve Arka Plan Atmosferi (Görseldeki pembe/gün batımı ufuk geçişi)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (lightingMode === 'sunset') {
      skyGrad.addColorStop(0, '#d88c9a');
      skyGrad.addColorStop(0.35, '#8c9278');
      skyGrad.addColorStop(1, '#3f5e36');
    } else if (lightingMode === 'day') {
      skyGrad.addColorStop(0, '#bae6fd');
      skyGrad.addColorStop(0.4, '#e0f2fe');
      skyGrad.addColorStop(1, '#4d7c0f');
    } else {
      skyGrad.addColorStop(0, '#090d16');
      skyGrad.addColorStop(0.45, '#111827');
      skyGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    const polys = [];

    // 2. Dış Çim Zemin, Giriş Yolu ve Sağ Alt Otopark
    pushBox(polys, -82, -0.8, -64, 82, -0.2, 72, lightingMode === 'night' ? '#1f2e1d' : '#588141', { bias: -200 });
    // Ön giriş yürüyüş yolu (görseldeki gri taş yol)
    pushBox(polys, -7.5, -0.18, 32, 7.5, 0.02, 70, '#94a3b8', { bias: -150 });
    // Sağ alt otopark asfaltı
    pushBox(polys, 50, -0.18, 8, 78, 0.04, 46, '#27272a', { bias: -140 });
    // Otopark şerit çizgileri
    pushBox(polys, 61, 0.05, 13, 61.4, 0.08, 28, '#e2e8f0', { bias: -135 });
    pushBox(polys, 69, 0.05, 13, 69.4, 0.08, 28, '#e2e8f0', { bias: -135 });

    // Otoparktaki 3D Araçlar (Mavi, Kırmızı, Sarı — görseldeki gibi!)
    pushCar(polys, 56, 20, '#2563eb');
    pushCar(polys, 65, 22, '#dc2626');
    pushCar(polys, 73.5, 20, '#eab308');

    // Bahçe Ağaçları
    pushTree(polys, -58, -28, 1.1);
    pushTree(polys, -60, 12, 1.0);
    pushTree(polys, -22, 46, 0.95);
    pushTree(polys, 54, -22, 1.1);
    pushTree(polys, 66, -12, 0.95);
    pushTree(polys, 53, 36, 0.9);

    // 3. Oda Zeminleri (Mavi kareli lobi, kırmızı halılı CEO odası ve departman parkeleri)
    for (const r of ROOMS) {
      pushBox(polys, r.x1, -0.15, r.z1, r.x2, 0.05, r.z2, r.floorColor, { stroke: '#1e293b', bias: -90 });

      if (r.isLobby) {
        // Görseldeki mavi/lacivert dama taşlı merkezi lobi zemini
        const step = 4;
        for (let x = r.x1; x < r.x2; x += step) {
          for (let z = r.z1; z < r.z2; z += step) {
            if (((Math.floor(x / step) + Math.floor(z / step)) & 1) === 0) {
              pushBox(polys, x, 0.05, z, Math.min(r.x2, x + step), 0.08, Math.min(r.z2, z + step), r.checkerColor, { bias: -80 });
            }
          }
        }
      }

      if (r.carpetMargin) {
        const m = r.carpetMargin;
        pushBox(polys, r.x1 + m, 0.06, r.z1 + m, r.x2 - m, 0.12, r.z2 - m, '#991b1b', { bias: -75 });
      }
    }

    // 4. Bina Dış ve İç 3D Duvarları (Kesitli / Cutaway Mimari)
    const wallH = 5.4;
    const extColor = '#cbd5e1';
    const intColor = '#d6b588'; // Görseldeki sıcak ahşap/bej iç duvarlar

    // Dış Çevre Duvarları (Ön girişte kapı boşluğu ile)
    pushWallWithDoor(polys, -46, -32, 46, -32, wallH, 0.9, extColor, false); // Arka dış duvar
    pushWallWithDoor(polys, -46, -32, -46, 32, wallH, 0.9, extColor, false); // Sol dış duvar
    pushWallWithDoor(polys, 46, -32, 46, 32, wallH, 0.9, extColor, false);   // Sağ dış duvar
    pushWallWithDoor(polys, -46, 32, -12, 32, wallH, 0.8, extColor, false);  // Ön sol dış duvar
    pushWallWithDoor(polys, 12, 32, 46, 32, wallH, 0.8, extColor, false);    // Ön sağ dış duvar
    pushWallWithDoor(polys, -12, 32, 12, 32, wallH, 0.8, extColor, true);    // Ön lobi ana giriş kapısı

    // Lobi Sol ve Sağ Koridor Duvarları (Kapılı)
    for (const zPair of [[-32, -16], [-16, 0], [0, 16], [16, 32]]) {
      pushWallWithDoor(polys, -12, zPair[0], -12, zPair[1], wallH, 0.65, intColor, true);
    }
    for (const zPair of [[-32, -12], [-12, 4], [4, 18], [18, 32]]) {
      pushWallWithDoor(polys, 12, zPair[0], 12, zPair[1], wallH, 0.65, intColor, true);
    }

    // Oda Arası Bölme Duvarlar
    for (const zVal of [-16, 0, 16]) {
      pushWallWithDoor(polys, -46, zVal, -12, zVal, wallH, 0.55, intColor, true);
    }
    for (const zVal of [-12, 4, 18]) {
      pushWallWithDoor(polys, 12, zVal, 46, zVal, wallH, 0.55, intColor, true);
    }
    // Ara dikey bölmeler
    pushWallWithDoor(polys, -29, 0, -29, 16, wallH, 0.5, intColor, true);
    pushWallWithDoor(polys, -29, 16, -29, 32, wallH, 0.5, intColor, true);
    pushWallWithDoor(polys, 29, -12, 29, 4, wallH, 0.5, intColor, true);
    pushWallWithDoor(polys, 29, 4, 29, 18, wallH, 0.5, intColor, true);

    // 5. Özel Oda Mobilyaları (Görseldeki Lobi Koltukları, Dev Ekran, Toplantı Masası, CEO Kitaplığı)
    // Arka لobi duvarındaki mavi dev sunum ekranı
    pushBox(polys, -6.5, 1.8, -31.4, 6.5, 4.7, -30.9, '#0ea5e9', { sideZColor: '#38bdf8' });
    // Lobi ortası mavi dinlenme koltukları ve orta sehpa
    pushBox(polys, 2.5, 0, -9, 5.2, 1.3, -2, '#2563eb');
    pushBox(polys, -5.2, 0, -9, -2.5, 1.3, -2, '#2563eb');
    pushBox(polys, -1.5, 0, -7.5, 1.5, 0.85, -3.5, '#a16207');
    // Lobi merkez komuta masası + çoklu ekranlar
    pushDeskAndChair(polys, 0, 3, '#38bdf8');
    // Lobi giriş danışma bankosu
    pushBox(polys, -9.5, 0, 26, -3.5, 1.8, 29, '#b45309');

    // Toplantı Odası uzun konferans masası ve sandalyeler
    pushBox(polys, -38, 0, -10.5, -20, 1.55, -5.5, '#451a03', { topColor: '#78350f' });
    for (let cx = -36; cx <= -22; cx += 3.5) {
      pushBox(polys, cx - 0.7, 0, -12.3, cx + 0.7, 1.3, -10.9, '#1e3a8a');
      pushBox(polys, cx - 0.7, 0, -5.1, cx + 0.7, 1.3, -3.7, '#1e3a8a');
    }

    // CEO Odası kitaplık ve makam masası
    pushBox(polys, -44.8, 0, -29, -43.2, 4.4, -21, '#78350f');
    pushDeskAndChair(polys, -32, -25, '#facc15');

    // 6. Tüm Ajanların Masaları ve 3D Voksel Karakterleri
    const agentHeadAnchors = [];
    for (const a of agents3D) {
      if (!a.isCeo) {
        const monCol = a.status === 'working' ? '#f97316' : '#22c55e';
        pushDeskAndChair(polys, a.homeX, a.homeZ, monCol);
      }
      const isSel = a.slug === selectedAgentSlug;
      const isHov = a.slug === hoveredAgentSlug;
      const headPos = pushVoxelAgent(polys, a, timeSec, isSel, isHov);
      agentHeadAnchors.push({ agent: a, ...headPos });
    }

    // 7. Tüm 3D Poligonları Kamera Derinliğine Göre Sırala (Painter's Algorithm + Depth Bias)
    const projectedPolys = [];
    for (const p of polys) {
      const scrPts = p.pts.map(pt => project(pt[0], pt[1], pt[2], W, H));
      const avgDepth = scrPts.reduce((s, v) => s + v.depth, 0) / scrPts.length - (p.bias || 0);
      projectedPolys.push({ scrPts, color: p.color, stroke: p.stroke, depth: avgDepth });
    }
    projectedPolys.sort((a, b) => b.depth - a.depth);

    // 8. Poligonları Çiz
    ctx.lineJoin = 'round';
    for (const poly of projectedPolys) {
      ctx.beginPath();
      ctx.moveTo(poly.scrPts[0].x, poly.scrPts[0].y);
      for (let i = 1; i < poly.scrPts.length; i++) {
        ctx.lineTo(poly.scrPts[i].x, poly.scrPts[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = poly.color;
      ctx.fill();
      ctx.strokeStyle = poly.stroke || 'rgba(15,23,42,0.18)';
      ctx.lineWidth = poly.stroke ? 1.1 : 0.55;
      ctx.stroke();
    }

    // 9. Bina Giriş Tabelası ("ABC HOLDING HQ" — Görseldeki sarı parlayan giriş yazısı)
    const signPos = project(0, 6.2, 32.5, W, H);
    const tenantDisplay = (window.getCurrentTenantDisplay ? window.getCurrentTenantDisplay() : 'DİJİTAL İKİZ') + ' HQ';
    ctx.save();
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    const signW = ctx.measureText(tenantDisplay).width + 20;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(signPos.x - signW / 2, signPos.y - 13, signW, 24, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tenantDisplay, signPos.x, signPos.y - 1);
    ctx.restore();

    // 10. Oda İsim Etiketleri (Yarı saydam zarif rozetler)
    for (const r of ROOMS) {
      const cx = (r.x1 + r.x2) / 2;
      const cz = (r.z1 + r.z2) / 2;
      const pos = project(cx, 5.6, cz, W, H);
      ctx.save();
      ctx.font = 'bold 11.5px "Segoe UI", sans-serif';
      const tw = ctx.measureText(r.code).width + 12;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
      ctx.beginPath();
      ctx.roundRect(pos.x - tw / 2, pos.y - 9, tw, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.code, pos.x, pos.y);
      ctx.restore();
    }

    // 11. Ajan Baş Üstü İsimlikleri, Durum Işıkları ve Konuşma Balonları
    screenProjections = [];
    agentHeadAnchors.sort((a, b) => {
      const pa = project(a.headX, a.headY, a.headZ, W, H);
      const pb = project(b.headX, b.headY, b.headZ, W, H);
      return pb.depth - pa.depth;
    });

    for (const item of agentHeadAnchors) {
      const a = item.agent;
      const pos = project(item.headX, item.headY, item.headZ, W, H);
      const bodyPos = project(a.x, 1.6, a.z, W, H);
      const hitRadius = Math.max(18, 2.2 * pos.scale);

      screenProjections.push({
        slug: a.slug,
        dept: a.dept,
        agent: a,
        x: bodyPos.x,
        y: bodyPos.y,
        labelX: pos.x,
        labelY: pos.y - 10,
        r: hitRadius,
      });

      const isSel = a.slug === selectedAgentSlug;
      const isHov = a.slug === hoveredAgentSlug;
      const shortName = a.title.length > 22 ? a.title.slice(0, 20) + '…' : a.title;

      ctx.save();
      ctx.font = (isSel || isHov) ? 'bold 12.5px "Segoe UI", sans-serif' : '600 11px "Segoe UI", sans-serif';
      const tw = ctx.measureText(shortName).width + 20;
      const bx = pos.x - tw / 2;
      const by = pos.y - 22;

      ctx.fillStyle = isSel ? '#1d4ed8' : (isHov ? '#0f172a' : 'rgba(255, 255, 255, 0.92)');
      ctx.strokeStyle = isSel ? '#facc15' : '#cbd5e1';
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw, 20, 999);
      ctx.fill();
      ctx.stroke();

      // Durum noktası
      ctx.fillStyle = a.status === 'working' ? '#f97316' : '#22c55e';
      ctx.beginPath();
      ctx.arc(bx + 8, by + 10, 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = (isSel || isHov) ? '#ffffff' : '#0f172a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(shortName, bx + 15, by + 10.5);

      // Eğer konuşma balonu varsa üstünde göster
      if (a.speech) {
        const spText = '💬 ' + (a.speech.length > 36 ? a.speech.slice(0, 34) + '…' : a.speech);
        ctx.font = '600 11.5px "Segoe UI", sans-serif';
        const sw = ctx.measureText(spText).width + 16;
        ctx.fillStyle = '#fef3c7';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(pos.x - sw / 2, by - 26, sw, 22, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#92400e';
        ctx.textAlign = 'center';
        ctx.fillText(spText, pos.x, by - 15);
      }
      ctx.restore();
    }

    // 12. Sol Alt İnteraktif Mini-Harita (Görseldeki sol alt kat planı radarı!)
    drawMiniMap(ctx, W, H);

    animId = requestAnimationFrame(renderScene);
  }

  function drawMiniMap(ctx, W, H) {
    const mw = 175;
    const mh = 130;
    const mx = 16;
    const my = H - mh - 16;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 8);
    ctx.fill();
    ctx.stroke();

    const mapScaleX = (mw - 20) / 92; // -46..+46
    const mapScaleZ = (mh - 26) / 64; // -32..+32
    const ox = mx + mw / 2;
    const oz = my + mh / 2 + 4;

    for (const r of ROOMS) {
      const rx = ox + r.x1 * mapScaleX;
      const rz = oz + r.z1 * mapScaleZ;
      const rw = (r.x2 - r.x1) * mapScaleX;
      const rh = (r.z2 - r.z1) * mapScaleZ;
      ctx.fillStyle = r.floorColor;
      ctx.fillRect(rx, rz, rw, rh);
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(rx, rz, rw, rh);
    }

    // Ajan noktaları
    for (const a of agents3D) {
      const ax = ox + a.x * mapScaleX;
      const az = oz + a.z * mapScaleZ;
      ctx.fillStyle = a.slug === selectedAgentSlug ? '#facc15' : (a.head ? '#38bdf8' : '#4ade80');
      ctx.beginPath();
      ctx.arc(ax, az, a.slug === selectedAgentSlug ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('KAT PLANI RADARI (3D)', mx + 8, my + 12);
    ctx.restore();
  }

  // Fare etkileşimlerini bağla
  function bindCanvasEvents() {
    if (!canvas) return;

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('mousedown', e => {
      cam.lastMX = e.clientX;
      cam.lastMY = e.clientY;
      cam.moved = false;
      if (e.button === 2 || e.shiftKey) {
        cam.panning = true;
      } else {
        cam.dragging = true;
      }
    });

    window.addEventListener('mousemove', e => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      if (cam.dragging) {
        const dx = e.clientX - cam.lastMX;
        const dy = e.clientY - cam.lastMY;
        if (Math.hypot(dx, dy) > 3) cam.moved = true;
        cam.targetYaw += dx * 0.0065;
        cam.targetPitch = Math.max(0.28, Math.min(1.18, cam.targetPitch + dy * 0.005));
        cam.lastMX = e.clientX;
        cam.lastMY = e.clientY;
        return;
      }

      if (cam.panning) {
        const dx = e.clientX - cam.lastMX;
        const dy = e.clientY - cam.lastMY;
        if (Math.hypot(dx, dy) > 3) cam.moved = true;
        cam.targetPanX += dx;
        cam.targetPanY += dy;
        cam.lastMX = e.clientX;
        cam.lastMY = e.clientY;
        return;
      }

      // Hover kontrolü
      let found = null;
      for (const sp of screenProjections) {
        if (Math.hypot(mx - sp.x, my - sp.y) <= sp.r || (Math.abs(mx - sp.labelX) < 55 && Math.abs(my - sp.labelY) < 12)) {
          found = sp.slug;
          break;
        }
      }
      hoveredAgentSlug = found;
      canvas.style.cursor = found ? 'pointer' : (cam.dragging ? 'grabbing' : 'grab');
    });

    window.addEventListener('mouseup', e => {
      const wasClick = (cam.dragging || cam.panning) && !cam.moved;
      cam.dragging = false;
      cam.panning = false;
      if (!wasClick || !canvas) return;

      const rect = canvas.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);

      for (const sp of screenProjections) {
        if (Math.hypot(mx - sp.x, my - sp.y) <= sp.r || (Math.abs(mx - sp.labelX) < 55 && Math.abs(my - sp.labelY) < 12)) {
          select3DAgent(sp.slug);
          return;
        }
      }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      cam.targetZoom = Math.max(5.5, Math.min(28, cam.targetZoom * factor));
    }, { passive: false });
  }

  function select3DAgent(slug) {
    selectedAgentSlug = slug;
    const a = agents3D.find(x => x.slug === slug);
    if (!a) return;
    if (window.onSelect3DAgentCard) {
      window.onSelect3DAgentCard(a);
    }
  }

  // Dışarıya açılan API
  window.Office3D = {
    mount(canvasId, appState) {
      if (animId) cancelAnimationFrame(animId);
      canvas = document.getElementById(canvasId);
      if (!canvas) return;
      ctx = canvas.getContext('2d');
      const resize = () => {
        if (!canvas) return;
        const r = canvas.parentElement.getBoundingClientRect();
        canvas.width = Math.max(760, Math.floor(r.width));
        canvas.height = 620;
      };
      resize();
      window.onresize = resize;
      syncAgentsFromState(appState);
      bindCanvasEvents();
      lastTime = performance.now();
      animId = requestAnimationFrame(renderScene);
    },
    updateState(appState) {
      syncAgentsFromState(appState);
    },
    setCameraPreset(preset) {
      if (preset === 'overview') {
        cam.targetYaw = -0.72; cam.targetPitch = 0.62; cam.targetZoom = 11.5; cam.targetPanX = 0; cam.targetPanY = 25;
      } else if (preset === 'top') {
        cam.targetYaw = 0; cam.targetPitch = 1.15; cam.targetZoom = 11.0; cam.targetPanX = 0; cam.targetPanY = 10;
      } else if (preset === 'ceo') {
        cam.targetYaw = -0.55; cam.targetPitch = 0.55; cam.targetZoom = 18.5; cam.targetPanX = 190; cam.targetPanY = 120;
      } else if (preset === 'meeting') {
        cam.targetYaw = -0.6; cam.targetPitch = 0.58; cam.targetZoom = 17.5; cam.targetPanX = 180; cam.targetPanY = 45;
      } else if (preset === 'lobby') {
        cam.targetYaw = -0.25; cam.targetPitch = 0.52; cam.targetZoom = 16.0; cam.targetPanX = 0; cam.targetPanY = 20;
      }
    },
    setLighting(mode) {
      lightingMode = mode;
    },
    toggleMeetingWalk() {
      meetingModeActive = !meetingModeActive;
      for (const a of agents3D) {
        if (meetingModeActive && (a.head || a.isCeo)) {
          const mIdx = a.isCeo ? 0 : Number(a.dept.slice(0, 2));
          const side = mIdx < 5 ? -1 : 1;
          const slot = mIdx % 5;
          a.targetX = -36 + slot * 4.2;
          a.targetZ = -8 + side * 3.6;
          a.speech = 'Toplantı odasına geçiyorum';
        } else {
          a.targetX = a.homeX;
          a.targetZ = a.homeZ;
          a.speech = null;
        }
      }
      if (meetingModeActive) this.setCameraPreset('meeting');
      else this.setCameraPreset('overview');
      return meetingModeActive;
    },
    simulateHandoffWalk() {
      // Rastgele 4 departman ajanını Lobi komuta masasına ve diğer odalara yürüt
      const sample = agents3D.filter(a => !a.isCeo);
      if (sample.length < 4) return;
      for (let i = 0; i < 4; i++) {
        const ag = sample[(i * 7) % sample.length];
        ag.targetX = -4 + i * 2.8;
        ag.targetZ = -4 + (i % 2) * 5;
        ag.speech = '🔁 Departmanlar arası iş devri (Handoff)';
        setTimeout(() => {
          ag.targetX = ag.homeX;
          ag.targetZ = ag.homeZ;
          ag.speech = null;
        }, 7000);
      }
      this.setCameraPreset('lobby');
    },
    focusAgent(slug) {
      select3DAgent(slug);
    },
  };
})();
