// ============================================================================
// Proje Yönetimi Stilleri ve Kurumsal Proje Katalogları (Offline Hazır)
// Başkent Kart · MucitHub (100 IoT Cihazı Yönetimi) · Başkent Ailem · MucitLab
// ============================================================================

export const STANDARD_PROJE_ALT_AJANLARI = [
  { key: 'teknik_sartname', ad: 'Teknik Şartname Ajanı', slug: 'proje-sartname-ve-ihale-ajani', gorev: 'Teknik şartname maddelerinin, SLA kriterlerinin ve cihaz/hizmet standartlarının hazırlanması' },
  { key: 'idari_sartname', ad: 'İdari Şartname Ajanı', slug: 'proje-sartname-ve-ihale-ajani', gorev: 'İdari şartname, sözleşme taslağı, ceza/teminat hükümleri ve yasal uyumluluk metinlerinin hazırlanması' },
  { key: 'ihale_sureci', ad: 'İhale Evrakları & Süreç Ajanı', slug: 'proje-sartname-ve-ihale-ajani', gorev: 'EKAP/ihale dosya seti, yaklaşık maliyet, zeyilname, ihale komisyonu ve süreç takibi' },
  { key: 'hakedis_odeme', ad: 'Hak Ediş Ödeme Ajanı', slug: 'proje-hakedis-odeme-ajani', gorev: 'Dönemsel hakediş hesaplama, fatura/dekont eşleştirme ve ödeme emri süreçlerinin hazırlanması' }
];

export const PROJE_STILLERI = [
  {
    id: 'baskent-kart',
    ad: 'Başkent Kart — Sosyal Yardım & 36 Aylık Kabul Denetimi',
    ikon: '💳',
    renk: '#1e3a8a',
    ozet: 'Sosyal yardım dijital kartı kapsamındaki 36 aylık tüm fatura, dekont, linklerdeki son kullanıcı ödemeleri, şüpheli işlemler ve kesin kabul süreçlerinin Kontrol & Kabul ajanlarıyla yönetimi.',
    akis: [
      '1. Teknik/İdari Şartname, İhale Dosyası ve Hak Ediş Süreçlerinin Hazırlanması',
      '2. Kontrol Ajanı: Evrak, Linklerdeki Son Kullanıcı Ödemeleri & Şüpheli İşlem Kontrolü',
      '3. Kabul Ajanı: Kontrol Raporları + Drive / Link / Fiziksel Klasör Doğrulaması ve Kesin Kabul',
      '4. Yüklenici Firma Mutabakatı, Hak Ediş Onayı ve Offline Arşivleme'
    ],
    altAjanlar: [
      { key: 'kontrol_ajani', ad: 'Kontrol Ajanı', slug: 'baskent-kart-kontrol-ajani', gorev: 'İlgili evrakların, işlemlerin, linklerdeki son kullanıcılara yapılan ödemelerin, Başkent Kart hareketlerinin ve şüpheli işlemlerin kontrolü' },
      { key: 'kabul_ajani', ad: 'Kabul Ajanı', slug: 'baskent-kart-kabul-ajani', gorev: 'Kontrol ajanının ürettiği raporların ve Drive, link veya fiziksel klasörlerdeki dosyaların son kontrolünü yapıp kesin kabulü gerçekleştirmesi' },
      ...STANDARD_PROJE_ALT_AJANLARI
    ]
  },
  {
    id: 'iot-yonetimi',
    ad: 'MucitHub — 100 Cihazlı IoT Yönetimi Projesi',
    ikon: '📡',
    renk: '#0ea5e9',
    ozet: 'Gelen dosya ve içeriklerin uygun formatlara dönüştürülüp 100 IoT cihazına gönderilmesi, çalışma sırasında sensör ve kamera görüntü işleme (CV) ile izlenmesi, çıkan çıktının paketlenip dosyalanarak son kullanıcıya ulaştırılması.',
    akis: [
      '1. Dosya & İçeriklerin Uygun Formata Hazırlanması',
      '2. Uygun 100 IoT Cihazına İş Emri & Parametre Gönderimi',
      '3. Sensör Verisi + Kamera Görüntü İşleme (CV) ile Canlı Süreç Kontrolü',
      '4. Çıktının Paketlenmesi, Dosyalanması & Son Kullanıcıya Sevkiyatı'
    ],
    altAjanlar: [
      { key: 'kontrol_ajani', ad: 'IoT Kontrol & CV İzleme Ajanı', slug: 'mucithub-iot-farm-yoneticisi', gorev: '100 IoT cihazının sensör telemetrisi, kamera görüntü işleme çıktıları ve işlem kalitesi kontrolü' },
      { key: 'kabul_ajani', ad: 'Paketleme, Dosyalama & Kabul Ajanı', slug: 'mucithub-iot-farm-yoneticisi', gorev: 'Tamamlanan IoT çıktılarının kalite kabulü, paketlenmesi, dosyalanması ve son kullanıcı sevkiyatı' },
      ...STANDARD_PROJE_ALT_AJANLARI
    ]
  },
  {
    id: 'baskent-ailem',
    ad: 'Başkent Ailem — Ebeveyn & Çocuk Mobil Ekosistem Yönetimi',
    ikon: '📱',
    renk: '#7c3aed',
    ozet: 'Anne/baba ve çocuk mobil uygulamalarının uçtan uca son kullanıcı takibi, sorun tespiti, muhatap firma iletişim süreçleri, şartname/ihale ve hakediş yönetimi.',
    akis: [
      '1. Ebeveyn & Çocuk Mobil Uygulama Telemetri ve Güvenlik Takibi',
      '2. Son Kullanıcı Sorun Bildirimleri & SLA Kontrolü',
      '3. Yüklenici & Muhatap Birimlerle İletişim Süreci Yönetimi',
      '4. Şartname, İhale Dosyası, Kabul Raporu & Aylık Hak Ediş Ödemesi'
    ],
    altAjanlar: [
      { key: 'kontrol_ajani', ad: 'Mobil Süreç & Muhatap Kontrol Ajanı', slug: 'baskent-ailem-proje-sorumlusu', gorev: 'Anne-baba ve çocuk mobil uygulama kullanıcı sorunlarının, bildirim linklerinin ve SLA metriklerinin kontrolü' },
      { key: 'kabul_ajani', ad: 'Hizmet Kabul & SLA Onay Ajanı', slug: 'baskent-ailem-proje-sorumlusu', gorev: 'Aylık mobil sistem raporlarının, Drive/klasör kayıtlarının incelenip kabul onayının verilmesi' },
      ...STANDARD_PROJE_ALT_AJANLARI
    ]
  },
  {
    id: 'mucitlab',
    ad: 'MucitLab — Çocuklara IoT, Sanat ve İletişim Akademisi',
    ikon: '🧪',
    renk: '#10b981',
    ozet: 'Çocuklara yönelik IoT, sanat ve iletişim odaklı uygulamalı eğitim projesi: görsel/video/dosya denetimi, atölye kontrolü, kabul ve hakediş yönetimi.',
    akis: [
      '1. Müfredat, Şartname, İhale Evrakları ve Atölye Materyallerinin Hazırlanması',
      '2. Uygulamalı IoT, Sanat ve İletişim Derslerinin Yürütülmesi',
      '3. Eğitmen Görsel, Video ve Öğrenci Çıktı Dosyalarının Kontrolü',
      '4. Eğitim Çıktılarının Kabulü, Dosyalanması ve Hak Ediş Ödemesi'
    ],
    altAjanlar: [
      { key: 'kontrol_ajani', ad: 'Eğitim & Medya Kontrol Ajanı', slug: 'mucitlab-egitim-koordinatoru', gorev: 'Atölye yoklama, görsel/video kayıtları ve öğrenci çıktı dosyalarının eksiksiz kontrolü' },
      { key: 'kabul_ajani', ad: 'Atölye Kabul & Dosyalama Ajanı', slug: 'mucitlab-egitim-koordinatoru', gorev: 'Kontrol edilen eğitim raporlarının, Drive/fiziksel klasör arşivlerinin kabulü ve dosyalanması' },
      ...STANDARD_PROJE_ALT_AJANLARI
    ]
  }
];

export function generateMucitHub100Devices() {
  const models = [
    'Akıllı IoT İstasyonu X1',
    'Endüstriyel IoT Modül-Pro',
    'Yüksek Hassasiyetli IoT Ünitesi S4',
    'Çoklu Sensörlü IoT Terminali V2'
  ];
  const formats = ['JSON-CMD / MQTT', 'G-Code / Seri Paket', 'BIN-FW / Edge Payload', 'SVG-Vektör / IoT Job'];
  const jobs = [
    'Akıllı Şehir Durak Sensör Kartı Üretimi',
    'MucitLab Öğrenci IoT Deney Modülü İşleme',
    'Engelsiz Başkent Yönlendirme Ünitesi Çıktısı',
    'Tarımsal Nem & Isı Ölçüm Cihazı Kalibrasyonu',
    'Akıllı Sayaç Telekomünikasyon Kutusu İşleme'
  ];

  const devices = [];
  for (let i = 1; i <= 100; i++) {
    const id = `IOT-${String(i).padStart(3, '0')}`;
    const zone = i <= 25 ? 'A-Blok' : i <= 50 ? 'B-Blok' : i <= 75 ? 'C-Blok' : 'D-Blok';
    let status = 'calisiyor';
    let cvStatus = 'normal';
    let alertNote = null;

    if (i === 14 || i === 47 || i === 82) {
      status = 'hata_tespit';
      cvStatus = 'sapma_tespit';
      alertNote = i === 14
        ? 'Kamera CV: Çıktı yüzeyinde hizalama sapması — cihaz durduruldu, yeniden formatlama önerildi'
        : i === 47
        ? 'Sensör Uyarısı: Besleme akımı/sıcaklık eşik dışı — yedek IoT cihazına aktarıldı'
        : 'Kamera CV: İşlem akışında kesinti — son kullanıcı paketi beklemeye alındı';
    } else if (i % 9 === 0) {
      status = 'tamamlandi_paketleme';
      cvStatus = 'basarili';
    } else if (i % 13 === 0) {
      status = 'hazir_beklemede';
      cvStatus = 'beklemede';
    }

    const tempMain = status === 'calisiyor' ? 42 + (i % 16) : (status === 'hata_tespit' ? 79 : 26);
    const loadPct = status === 'calisiyor' ? 58 + (i % 35) : (status === 'tamamlandi_paketleme' ? 100 : 12);
    const progress = status === 'tamamlandi_paketleme' ? 100 : (status === 'hazir_beklemede' ? 0 : 18 + ((i * 7) % 78));

    devices.push({
      id,
      zone,
      model: models[i % models.length],
      format: formats[i % formats.length],
      status,
      cvStatus,
      alertNote,
      currentJob: status === 'hazir_beklemede' ? null : jobs[i % jobs.length],
      progress,
      sensors: {
        operatingTempC: tempMain,
        powerLoadPct: loadPct,
        vibrationMmS: Number((0.12 + (i % 7) * 0.04).toFixed(2)),
        signalRssi: -48 - (i % 20),
        cameraFps: status === 'hata_tespit' ? 15 : 30
      },
      lastUpdated: '2026-11-15T12:15:00Z'
    });
  }
  return devices;
}

// Geriye dönük uyumluluk alias'ı
export const generateMucitHub100Printers = generateMucitHub100Devices;

export function createInitialProjectsHubDataset() {
  const devices = generateMucitHub100Devices();
  return {
    updatedAt: '2026-11-15T12:15:00Z',
    activeStyle: 'baskent-kart',
    baskentKart: {
      kontrolOzeti: {
        incelenenEvrak: 2140,
        sonKullaniciOdemeLinki: 'https://sosyal.ankara.bel.tr/baskentkart/odeme-log',
        driveKlasor: 'Google Drive / ABB-BaskentKart-2023-2026',
        fizikselKlasor: 'C:\\ABB-Arsiv\\Baskent-Kart-Evraklar',
        supheliIslemSayisi: 14,
        kabulDurumu: 'Kontrol Ajanı Raporu Hazır — Kabul Ajanı Son Onayında'
      },
      sonKontrolBulguları: [
        { id: 'BK-KNT-01', baslik: 'Anlaşmalı Üye İşyeri POS & Link Ödeme Mutabakatı', ajan: 'Kontrol Ajanı', durum: 'dogrulandi', detay: '1.428.000+ son kullanıcı kart işlemi ve banka dekontları %99.8 eşleşti.' },
        { id: 'BK-KNT-02', baslik: 'Şüpheli / Mükerrer Harcama & Gece İşlem Taraması', ajan: 'Kontrol Ajanı', durum: 'incelemede', detay: '14 adet yüksek tutarlı mükerrer POS talebi bloke edildi, yükleniciden ek dekont istendi.' },
        { id: 'BK-KNT-03', baslik: 'Drive, Link ve Fiziksel Klasör Kesin Kabul Dosya Kontrolü', ajan: 'Kabul Ajanı', durum: 'kabul_hazir', detay: '36 aylık tüm fatura, dekont ve tutanaklar kontrol raporu ile çapraz doğrulandı.' }
      ]
    },
    mucithub: {
      summary: {
        totalDevices: 100,
        activeCount: devices.filter((d) => d.status === 'calisiyor').length,
        completedReadyToPack: devices.filter((d) => d.status === 'tamamlandi_paketleme').length,
        errorCount: devices.filter((d) => d.status === 'hata_tespit').length,
        idleCount: devices.filter((d) => d.status === 'hazir_beklemede').length
      },
      devices,
      pipelineQueue: [
        { id: 'JOB-MH-101', title: 'Akıllı Durak Çevre Sensörü Paketi', sourceFormat: 'CAD / JSON Spec', targetFormat: 'MQTT + Edge Firmware Paketi', assignedDevice: 'IOT-001', stage: 'IoT Cihazında İşleniyor (%74)', cvScore: 98.4, packaged: false, shipped: false },
        { id: 'JOB-MH-102', title: 'MucitLab Öğrenci IoT Deney Seti', sourceFormat: 'Şema + Konfigürasyon Dosyası', targetFormat: 'IoT Cihaz Profil Paketi', assignedDevice: 'IOT-009', stage: 'Tamamlandı — Paketleme & Dosyalama Bekliyor', cvScore: 99.6, packaged: false, shipped: false },
        { id: 'JOB-MH-103', title: 'Engelsiz Yönlendirme Beacon Ünitesi', sourceFormat: 'Görsel & Veri Haritası', targetFormat: 'Seri IoT Komut Seti', assignedDevice: 'IOT-018', stage: 'Paketlendi, Dosyalandı & Son Kullanıcıya Sevk Edildi', cvScore: 99.9, packaged: true, shipped: true }
      ],
      shipments: [
        { id: 'SHP-4401', jobTitle: 'Engelsiz Yönlendirme Beacon Ünitesi', recipient: 'ABB EGO Genel Müdürlüğü — Son Kullanıcı Saha Ekibi', archivePath: 'C:\\ABB-Arsiv\\MucitHub\\SHP-4401.zip', cargoCode: 'ABB-LOJ-88241', status: 'teslim_edildi', date: '2026-11-14' },
        { id: 'SHP-4402', jobTitle: 'Akıllı Park Nem Sensörü Paketi', recipient: 'ABB Çevre Koruma ve Kontrol Dairesi', archivePath: 'C:\\ABB-Arsiv\\MucitHub\\SHP-4402.zip', cargoCode: 'ABB-LOJ-88259', status: 'paketlendi_dosyalandi', date: '2026-11-15' }
      ]
    },
    baskentAilem: {
      metrics: {
        parentAppUsers: 142800,
        childAppUsers: 168450,
        activePairings: 139200,
        openTickets: 18,
        avgResolutionMin: 14,
        slaCompliancePct: 99.1
      },
      recentTickets: [
        { id: 'BA-901', parentUser: 'Ayşe Y. (Anne)', childDevice: 'Android 14 — Çocuk Modu', category: 'Konum & Güvenli Bölge Bildirimi', status: 'acik', priority: 'yuksek', assignedAgent: 'Başkent Ailem Muhatap & Mobil Süreç Ajanı', note: 'Ebeveyn uygulamasında anlık bildirim gecikmesi — yüklenici mobil ekibine iletildi.' },
        { id: 'BA-902', parentUser: 'Mehmet K. (Baba)', childDevice: 'iOS 18 — Çocuk Profili', category: 'Ekran Süresi & Eğitim Limiti', status: 'cozuldu', priority: 'normal', assignedAgent: 'Başkent Ailem Muhatap & Mobil Süreç Ajanı', note: 'Profil senkronizasyonu yenilendi, ebeveynden onay alındı.' },
        { id: 'BA-903', parentUser: 'Zeynep T. (Anne)', childDevice: 'Android 13 — Çocuk Modu', category: 'Sosyal Destek & Etkinlik Takvimi', status: 'muhatap_bekliyor', priority: 'normal', assignedAgent: 'Başkent Ailem Muhatap & Mobil Süreç Ajanı', note: 'ABB Sosyal Hizmetler birimiyle içerik güncellemesi teyit ediliyor.' }
      ],
      stakeholderComms: [
        { id: 'COM-11', counterparty: 'Yüklenici Mobil Yazılım Firması', topic: 'v4.2 Push Bildirim Gecikmesi Hotfix', status: 'gonderildi', date: '2026-11-15' },
        { id: 'COM-12', counterparty: 'ABB Kadın ve Aile Hizmetleri Dairesi', topic: 'Aylık Son Kullanıcı Memnuniyet & Kabul Raporu', status: 'onaylandi', date: '2026-11-12' }
      ]
    },
    mucitLab: {
      metrics: {
        totalStudents: 4820,
        activeWorkshops: 24,
        tracks: ['IoT & Akıllı Sistemler', 'Dijital Sanat & Tasarım', 'İletişim & Sunum'],
        submittedMediaCount: 386,
        verifiedMediaCount: 374
      },
      workshops: [
        { id: 'ML-01', track: 'IoT & Akıllı Sistemler', title: 'Sensörlerle Akıllı Sera Otomasyonu', ageGroup: '10-13 Yaş', instructor: 'Eğitmen Selin A.', students: 28, mediaType: 'Video + Kod Dosyası', controlStatus: 'onaylandi', date: '2026-11-14' },
        { id: 'ML-02', track: 'Dijital Sanat & Tasarım', title: 'Vektörel Çizim ve Etkileşimli Hikaye', ageGroup: '8-11 Yaş', instructor: 'Eğitmen Mert D.', students: 32, mediaType: 'Görsel + Proje Dosyası', controlStatus: 'inceleniyor', date: '2026-11-15' },
        { id: 'ML-03', track: 'İletişim & Sunum', title: 'Genç Mucitler Takım İletişimi ve Pitching', ageGroup: '12-15 Yaş', instructor: 'Eğitmen Deniz Y.', students: 24, mediaType: 'Video Kaydı + PDF Sunum', controlStatus: 'onaylandi', date: '2026-11-13' }
      ]
    },
    sharedAdminDocs: [
      { id: 'DOC-101', project: 'Başkent Kart', type: 'Kesin Kabul & 36 Aylık Denetim Dosyası', title: 'Kontrol Ajanı Raporu + Drive/Link Kabul Tutanağı', status: 'kontrol_tamamlandi', amountTry: 42500000, date: '2026-11-15' },
      { id: 'DOC-102', project: 'MucitHub', type: 'Teknik Şartname & İhale', title: '100 IoT Cihazı Operasyon, Sensör & CV İzleme Şartnamesi', status: 'imzalandi', amountTry: 2850000, date: '2026-11-10' },
      { id: 'DOC-103', project: 'Başkent Ailem', type: 'Hak Ediş #11', title: 'Ebeveyn-Çocuk Mobil Ekosistem Kasım Ayı SLA Hak Edişi', status: 'odeme_bekliyor', amountTry: 490000, date: '2026-11-14' },
      { id: 'DOC-104', project: 'MucitLab', type: 'İdari Şartname & Hak Ediş #06', title: 'Uygulamalı IoT/Sanat/İletişim Atölyeleri Eğitim Hak Edişi', status: 'odendi', amountTry: 315000, date: '2026-11-08' }
    ]
  };
}
