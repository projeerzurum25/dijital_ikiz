// Dijital İkiz v4.0 — 10 Departman / Personel / Skills / Rules / Araçlar Matrisi
// Araç önceliği her zaman: CLI > MCP > Plugin > Browser Fallback

const ref = (title, body) => `# ${title}\n\n${body.trim()}\n`;

export const DEPARTMENTS = [
  {
    no: '01', slug: '01-Proje-Yonetimi', name: 'Proje Yönetimi', emoji: '🗂️', color: '#5b8def',
    keywords: ['proje', 'görev', 'gorev', 'sprint', 'gantt', 'wbs', 'teslim', 'takvim', 'kaynak', 'kapasite', 'handoff', 'bağımlılık', 'kritik yol'],
    tools: ['Linear/Jira CLI', 'GitHub Projects CLI', 'Markdown Gantt Üretici'],
    tables: ['projects', 'project_tasks'],
    deptRules: ['Departman çıktıları her zaman tablo + kısa özet formatında sunulur.'],
    personnel: [
      {
        slug: 'bas-proje-yoneticisi', title: 'Baş Proje Yöneticisi (PMO)', head: true,
        mission: 'Kurumun proje portföyünü planlar, iş kırılımlarını ve kritik yolu yönetir.',
        rules: ['Teslim tarihi ve bağımlılık belirtilmemiş hiçbir görevi onaylama; özetleri tablo formatında sun.'],
        skills: [
          {
            name: 'wbs-is-kirilimi', description: 'Bir projeyi iş kırılım yapısına (WBS) böler ve kritik yolu hesaplar. Proje planı, iş kırılımı, kritik yol istendiğinde tetiklenir.',
            triggers: ['wbs', 'iş kırılım', 'is kirilim', 'kritik yol', 'proje planı', 'proje plani'],
            args: [['$PROJE_ADI', 'Planlanacak projenin adı'], ['$BITIS_TARIHI', 'Hedef bitiş tarihi (YYYY-AA-GG)']],
            steps: ['Projenin hedefini ve kapsamını 1 cümleyle yaz.', 'İşi 3 seviyeli WBS ağacına böl (Faz > İş Paketi > Görev).', 'Her görev için süre (gün) ve bağımlılıkları belirle.', 'scripts/kritik_yol_hesapla.mjs betiğini görev listesiyle çalıştır.', 'references/proje-plan-sablonu.md formatında tablo halinde sun.'],
            scripts: ['kritik_yol_hesapla.mjs'],
            references: { 'proje-plan-sablonu.md': ref('Proje Plan Şablonu', `
| Alan | Değer |
|---|---|
| Proje | $PROJE_ADI |
| Sponsor | |
| Hedef bitiş | $BITIS_TARIHI |

## WBS
| Kod | Görev | Süre (gün) | Bağımlılık | Sorumlu | Kritik mi? |
|---|---|---|---|---|---|

## Riskler
| Risk | Olasılık | Etki | Önlem |
|---|---|---|---|`) },
            assets: { 'ornek-gorevler.json': JSON.stringify({ tasks: [{ id: 'A', name: 'Analiz', duration: 3, deps: [] }, { id: 'B', name: 'Tasarım', duration: 4, deps: ['A'] }, { id: 'C', name: 'Geliştirme', duration: 8, deps: ['B'] }, { id: 'D', name: 'Dokümantasyon', duration: 2, deps: ['B'] }, { id: 'E', name: 'Test', duration: 3, deps: ['C', 'D'] }] }, null, 2) },
          },
          {
            name: 'kaynak-kapasite-planlama', description: 'Ekip kapasitesini görev yüküyle karşılaştırır, aşırı yüklenmeleri bulur.',
            triggers: ['kapasite', 'kaynak planlama', 'iş yükü', 'is yuku'],
            args: [['$DONEM', 'Planlama dönemi (örn. 2026-Q4)']],
            steps: ['Ekip üyelerinin haftalık kapasitesini (saat) listele.', 'Atanmış görev saatlerini topla.', 'Kullanım oranı %85 üzerindekileri işaretle.', 'Yeniden dağıtım önerisini tablo olarak ver.'],
            references: { 'kapasite-tablosu.md': ref('Kapasite Tablosu', '| Kişi | Kapasite (s) | Atanan (s) | Kullanım % | Durum |\n|---|---|---|---|---|') },
          },
        ],
      },
      {
        slug: 'scrum-master', title: 'Scrum Master & Akış Koordinatörü',
        mission: 'Sprint akışını ve departmanlar arası iş devirlerini (handoff) denetler.',
        rules: ['Departmanlar arası iş devrinde bir önceki departmanın çıktı doğrulaması tamamlanmadan sonraki departmanı tetikleme.'],
        skills: [
          {
            name: 'sprint-durum-raporu', description: 'Belirtilen sprintin tamamlanan/kalan işlerini ve risklerini raporlar.',
            triggers: ['sprint', 'sprint raporu', 'durum raporu'],
            args: [['$SPRINT_NO', 'Sprint numarası']],
            steps: ['project_tasks tablosundan sprint $SPRINT_NO görevlerini oku.', 'Durumlara göre (yapılacak/devam/tamam) say.', 'Geciken görevleri listele.', 'Sonraki sprint için 3 aksiyon öner.'],
            references: { 'sprint-rapor-sablonu.md': ref('Sprint Rapor Şablonu', '## Sprint $SPRINT_NO\n| Durum | Adet |\n|---|---|\n\n## Gecikenler\n\n## Aksiyonlar') },
          },
          {
            name: 'departman-handoff-denetimi', description: 'Bir departmandan diğerine devredilen çıktının kabul kriterlerini doğrular.',
            triggers: ['handoff', 'devir', 'iş devri', 'is devri'],
            args: [['$KAYNAK_DEPARTMAN', 'Devreden departman'], ['$HEDEF_DEPARTMAN', 'Devralan departman']],
            steps: ['Kaynak çıktının tamamlanma durumunu kontrol et.', 'Kabul kriterleri listesine karşı doğrula.', 'Eksik varsa devri BLOKE et ve sebebini yaz.', 'Tamamsa hedef departmanı tetikle.'],
          },
        ],
      },
    ],
  },
  {
    no: '02', slug: '02-Strateji-ve-Arastirma', name: 'Strateji ve Pazar Araştırması', emoji: '🔭', color: '#8e6cef',
    keywords: ['strateji', 'pazar', 'rakip', 'trend', 'swot', 'iş modeli', 'is modeli', 'kanvas', 'sektör', 'sektor', 'büyüme', 'buyume', 'araştırma', 'arastirma'],
    tools: ['Firecrawl CLI (online modda)', 'Search MCP (online modda)', 'Yerel Vektör Arama (Offline)'],
    tables: ['competitors', 'campaigns'],
    deptRules: ['Offline modda yalnızca yerel arşiv (context/ ve _EGITIM-MERKEZI) kaynak olarak kullanılır.'],
    personnel: [
      {
        slug: 'pazar-istihbarat-analisti', title: 'Pazar İstihbarat Analisti', head: true,
        mission: 'Sektör trendlerini ve pazar sinyallerini doğrulanmış kaynaklardan derler.',
        rules: ['Tarihi ve kaynağı doğrulanmamış hiçbir istatistiği rapora ekleme; offline modda yalnızca yerel arşivi kullan.'],
        skills: [
          {
            name: 'sektor-trend-tarama', description: 'Yerel arşivde sektör trendlerini tarar ve kaynaklı trend raporu çıkarır.',
            triggers: ['trend', 'sektör tarama', 'sektor tarama', 'pazar araştırması', 'pazar arastirmasi'],
            args: [['$SEKTOR', 'İncelenecek sektör'], ['$ANAHTAR_KELIMELER', 'Virgülle ayrılmış anahtar kelimeler']],
            steps: ['scripts/veri_topla.mjs ile yerel arşivde $ANAHTAR_KELIMELER ara.', 'Her bulguyu kaynak dosya ve tarihiyle eşleştir.', 'references/kaynak-guvenilirlik-kriterleri.md ile puanla.', 'Puanı 3 altındaki bulguları rapordan çıkar.'],
            scripts: ['veri_topla.mjs'],
            references: { 'kaynak-guvenilirlik-kriterleri.md': ref('Kaynak Güvenilirlik Kriterleri', '| Puan | Kriter |\n|---|---|\n| 5 | Resmi istatistik kurumu / denetlenmiş rapor |\n| 4 | Sektör derneği, akademik yayın |\n| 3 | Tanınmış basın, tarihli |\n| 2 | Blog, tarihsiz |\n| 1 | Kaynaksız |') },
          },
        ],
      },
      {
        slug: 'rakip-analizi-uzmani', title: 'Rakip Analizi Uzmanı',
        mission: 'Rakiplerin özellik ve fiyat konumlandırmasını nesnel olarak karşılaştırır.',
        rules: ['Rakipleri küçümseyen öznel yorumlar yapma; yalnızca somut özellik ve fiyat farklarını listele.'],
        skills: [
          {
            name: 'rakip-swot-ve-fiyat-matrisi', description: 'Rakip için SWOT ve fiyat karşılaştırma matrisi üretir.',
            triggers: ['rakip', 'swot', 'fiyat matrisi', 'rekabet'],
            args: [['$RAKIP_URL', 'Rakip web adresi veya yerel arşiv kaydı']],
            steps: ['competitors tablosundan ve yerel arşivden rakip verisini topla.', 'Güçlü/Zayıf/Fırsat/Tehdit maddelerini somut verilerle yaz.', 'assets/karsilastirma-tablosu.csv formatında fiyat matrisini doldur.'],
            assets: { 'karsilastirma-tablosu.csv': 'ozellik,bizim_urun,rakip,fark\nAylik fiyat (TL),,,\nKullanici limiti,,,\nDestek SLA,,,\nEntegrasyon sayisi,,,\n' },
          },
        ],
      },
      {
        slug: 'is-gelistirme-stratejisti', title: 'İş Geliştirme Stratejisti',
        mission: 'Yeni gelir modelleri ve büyüme fırsatları tasarlar.',
        rules: ['Bütçe ve ROI hesabı içermeyen hiçbir büyüme önerisini yönetime sunma.'],
        skills: [
          {
            name: 'is-modeli-kanvas-olusturucu', description: 'İş Modeli Kanvası (9 blok) üretir ve gelir modeli önerir.',
            triggers: ['iş modeli', 'is modeli', 'kanvas', 'gelir modeli', 'büyüme önerisi'],
            args: [['$GIRISIM', 'Girişim / ürün adı']],
            steps: ['9 blok kanvası doldur.', 'references/gelir-modelleri-kutuphanesi.md içinden en uygun 2 modeli seç.', 'Basit bütçe ve ROI tahmini ekle.'],
            references: { 'gelir-modelleri-kutuphanesi.md': ref('Gelir Modelleri Kütüphanesi', '- Abonelik (SaaS)\n- Kullanım bazlı ücretlendirme\n- Freemium + premium\n- Lisans\n- Komisyon / pazar yeri\n- Danışmanlık + ürün hibrit') },
          },
        ],
      },
    ],
  },
  {
    no: '03', slug: '03-Urun-ve-Tasarim', name: 'Ürün ve Tasarım', emoji: '🎨', color: '#ef6ca8',
    keywords: ['ürün', 'urun', 'prd', 'özellik', 'ozellik', 'tasarım', 'tasarim', 'ui', 'ux', 'akış', 'prototip', 'şartname', 'sartname', 'rice', 'wcag'],
    tools: ['Miro MCP', 'Canva MCP', 'Mermaid CLI', 'CAD/3D Dosya Analizörü'],
    tables: ['features', 'projects'],
    deptRules: [],
    personnel: [
      {
        slug: 'urun-yoneticisi', title: 'Ürün Yöneticisi (Product Manager)', head: true,
        mission: 'Ürün yol haritasını, gereksinimleri ve önceliklendirmeyi yönetir.',
        rules: ['Kabul kriterleri (Acceptance Criteria) ve uç durumları (edge-cases) yazılmamış hiçbir özelliği yazılıma devretme.'],
        skills: [
          {
            name: 'prd-belgesi-uretici', description: 'Bir özellik için kurumsal PRD (Ürün Gereksinim Dokümanı) üretir.',
            triggers: ['prd', 'gereksinim', 'ürün gereksinim', 'özellik dokümanı'],
            args: [['$OZELLIK', 'Özellik adı']],
            steps: ['Problemi ve hedef kullanıcıyı tanımla.', 'Kullanıcı hikayelerini yaz.', 'Kabul kriterleri ve uç durumları ekle.', 'references/kurumsal-prd-sablonu.md formatına dök.'],
            references: { 'kurumsal-prd-sablonu.md': ref('Kurumsal PRD Şablonu', '## Problem\n## Hedef Kullanıcı\n## Kullanıcı Hikayeleri\n## Kabul Kriterleri\n- [ ] \n## Uç Durumlar\n## Başarı Metrikleri\n## Kapsam Dışı') },
          },
          {
            name: 'rice-onceliklendirme', description: 'Özellik listesini RICE (Reach, Impact, Confidence, Effort) ile skorlar.',
            triggers: ['rice', 'önceliklendirme', 'onceliklendirme', 'backlog sırala'],
            args: [['$OZELLIK_LISTESI', 'JSON özellik listesi']],
            steps: ['features tablosundan veya girdiden listeyi al.', 'scripts/rice_skorla.mjs ile skorla.', 'Skora göre sıralı tablo sun.'],
            scripts: ['rice_skorla.mjs'],
          },
        ],
      },
      {
        slug: 'ui-ux-akis-mimari', title: 'UI/UX Akış Mimarı',
        mission: 'Kullanıcı akışlarını ve tasarım sistemini tasarlar.',
        rules: ['Mobil uyumluluk ve erişilebilirlik (WCAG) standartlarını ihlal eden arayüz kurgusu önerme.'],
        skills: [
          {
            name: 'kullanici-akis-diyagrami', description: 'Kullanıcı akışını Mermaid diyagramı olarak üretir.',
            triggers: ['akış diyagramı', 'akis diyagrami', 'user flow', 'kullanıcı akışı', 'mermaid'],
            args: [['$AKIS_ADI', 'Akışın adı']],
            steps: ['Giriş noktası ve hedef aksiyonu belirle.', 'Adımları ve karar noktalarını listele.', 'scripts/mermaid_render.mjs ile .mmd dosyası üret.'],
            scripts: ['mermaid_render.mjs'],
          },
          {
            name: 'tasarim-sistemi-denetimi', description: 'Arayüzü tasarım tokenlarına ve WCAG kurallarına göre denetler.',
            triggers: ['tasarım sistemi', 'design system', 'token', 'erişilebilirlik'],
            args: [['$EKRAN', 'Denetlenecek ekran']],
            steps: ['references/ui-tokens.md ile renk/tipografi uyumunu kontrol et.', 'Kontrast oranı 4.5:1 altını işaretle.', 'Dokunma alanı 44px altını işaretle.'],
            references: { 'ui-tokens.md': ref('UI Tokenları', '| Token | Değer |\n|---|---|\n| --renk-birincil | #1f6feb |\n| --renk-metin | #0d1117 |\n| --yazi-govde | 16px |\n| --bosluk-1 | 4px |\n| --dokunma-min | 44px |') },
          },
        ],
      },
      {
        slug: 'prototip-teknik-sartname-uzmani', title: 'Prototip & Teknik Şartname Uzmanı',
        mission: 'Prototip ve üretim teknik şartnamelerini hazırlar.',
        rules: ['Üretim kısıtları ve malzeme/bileşen maliyetleri belirtilmeden prototip onayı verme.'],
        skills: [
          {
            name: 'teknik-sartname-ve-3d-analiz', description: 'Prototip için teknik şartname ve tolerans analizi üretir.',
            triggers: ['teknik şartname', 'teknik sartname', 'prototip', 'tolerans', '3d', 'cad'],
            args: [['$PARCA', 'Parça / ürün adı']],
            steps: ['Malzeme ve bileşenleri listele.', 'assets/uretim-tolerans-tablosu.csv ile toleransları eşleştir.', 'Maliyet kalemlerini ekle.'],
            assets: { 'uretim-tolerans-tablosu.csv': 'yontem,tolerans_mm,min_duvar_mm\nCNC,0.05,0.8\nEnjeksiyon,0.1,1.0\nFDM 3D Baski,0.3,1.2\nSLA 3D Baski,0.1,0.6\n' },
          },
        ],
      },
    ],
  },
  {
    no: '04', slug: '04-Yazilim-ve-Mimari', name: 'Yazılım ve Sistem Mimarisi', emoji: '🧩', color: '#2fb5a0',
    keywords: ['yazılım', 'yazilim', 'kod', 'api', 'endpoint', 'mimari', 'veritabanı', 'veritabani', 'şema', 'backend', 'frontend', 'migrasyon', 'adr', 'bileşen'],
    tools: ['Git/GitHub CLI', 'Supabase CLI', 'Docker CLI', 'Context7 MCP'],
    tables: ['features', 'projects'],
    deptRules: ['Kod üreten her görev teslimden önce /simplify → /review → /security-review kapısından geçer.'],
    personnel: [
      {
        slug: 'bas-sistem-mimari', title: 'Baş Sistem Mimarı', head: true,
        mission: 'Sistem mimarisini, veri modelini ve teknik kararları yönetir.',
        rules: ['Her büyük mimari değişiklik öncesinde git worktree (claude --worktree) ile izole çalışma dalı aç; ana dalda doğrudan deneme yapma.'],
        skills: [
          {
            name: 'mimari-karar-kaydi-adr', description: 'Mimari Karar Kaydı (ADR) üretir.',
            triggers: ['adr', 'mimari karar', 'mimari'],
            args: [['$KARAR', 'Karar başlığı']],
            steps: ['Bağlamı yaz.', 'En az 2 alternatifi artı/eksi ile karşılaştır.', 'Kararı ve sonuçlarını references/adr-sablonu.md formatında kaydet.'],
            references: { 'adr-sablonu.md': ref('ADR Şablonu', '# ADR-XXX: $KARAR\n## Durum\nÖnerildi\n## Bağlam\n## Alternatifler\n## Karar\n## Sonuçlar') },
          },
          {
            name: 'veritabani-sema-tasarimi', description: 'İhtiyaca göre normalize veritabanı şeması tasarlar.',
            triggers: ['şema', 'sema', 'veritabanı tasarımı', 'tablo tasarımı', 'er diyagram'],
            args: [['$ALAN', 'İş alanı']],
            steps: ['Varlıkları ve ilişkileri çıkar.', '3NF normalize et.', 'İndeks önerilerini ekle.', 'SQL DDL üret.'],
          },
        ],
      },
      {
        slug: 'backend-gelistirici', title: 'Backend Geliştirici',
        mission: 'API ve sunucu tarafı servisleri geliştirir.',
        rules: ['Girdi doğrulaması (validation) ve hata yakalama (try/catch) mekanizması olmayan hiçbir endpoint yazma.'],
        skills: [
          {
            name: 'api-endpoint-uretici', description: 'OpenAPI standartlarında doğrulamalı API endpoint iskeleti üretir.',
            triggers: ['endpoint', 'api üret', 'rest api', 'openapi'],
            args: [['$KAYNAK', 'Kaynak adı (örn. musteri)']],
            steps: ['references/openapi-standartlari.md kurallarını oku.', 'CRUD endpointlerini tanımla.', 'Doğrulama şemasını ve hata yanıtlarını ekle.'],
            references: { 'openapi-standartlari.md': ref('OpenAPI Standartları', '- Kaynak adları çoğul ve kebab-case\n- Hatalar RFC 7807 problem+json\n- Her girdi şema ile doğrulanır\n- Sayfalama: ?limit&cursor') },
          },
          { name: 'veritabani-migrasyon', description: 'Geri alınabilir (up/down) veritabanı migrasyonu üretir.', triggers: ['migrasyon', 'migration'], args: [['$DEGISIKLIK', 'Şema değişikliği']], steps: ['up ve down betiklerini yaz.', 'Veri kaybı riskini belirt.', 'Önce kopya veritabanında dene.'] },
        ],
      },
      {
        slug: 'frontend-gelistirici', title: 'Frontend Geliştirici',
        mission: 'Arayüz bileşenlerini ve istemci performansını geliştirir.',
        rules: ['Tekrar eden UI kodları yazma; mevcut tasarım bileşenlerini kullan ve gereksiz bağımlılık (package) ekleme.'],
        skills: [
          { name: 'bilesen-kutuphanesi-uretici', description: 'Tasarım sistemine uygun yeniden kullanılabilir UI bileşeni üretir.', triggers: ['bileşen', 'bilesen', 'component'], args: [['$BILESEN', 'Bileşen adı']], steps: ['references/component-rules.md kurallarını uygula.', 'Erişilebilir HTML yapısı kur.', 'Varyantları tanımla.'], references: { 'component-rules.md': ref('Bileşen Kuralları', '- Tek sorumluluk\n- Props ile yapılandırma, iç durum minimum\n- aria-* öznitelikleri zorunlu\n- Harici paket yok') } },
          { name: 'performans-optimizasyonu', description: 'Ön yüz performans darboğazlarını tespit eder.', triggers: ['performans optimizasyonu', 'sayfa hızı', 'lighthouse'], args: [['$SAYFA', 'Sayfa adı']], steps: ['Paket boyutunu ölç.', 'Render engelleyen kaynakları bul.', 'Öneri listesini etki sırasıyla ver.'] },
        ],
      },
    ],
  },
  {
    no: '05', slug: '05-Test-QA-ve-Guvenlik', name: 'Test, QA ve Siber Güvenlik', emoji: '🛡️', color: '#e5534b',
    keywords: ['test', 'qa', 'güvenlik', 'guvenlik', 'açık', 'acik', 'sast', 'owasp', 'penetrasyon', 'yük testi', 'yuk testi', 'performans testi', 'sla', 'playwright', 'tarama'],
    tools: ['Playwright CLI', 'Semgrep/SAST CLI', 'API Güvenlik Tarayıcı'],
    tables: ['features'],
    deptRules: ['İthal edilen her skill/repo bu departmanın zararlı kod + prompt injection taramasından geçer.'],
    personnel: [
      {
        slug: 'qa-test-otomasyon-muhendisi', title: 'QA Test Otomasyon Mühendisi',
        mission: 'Uçtan uca test senaryolarını yazar ve otomatikleştirir.',
        rules: ['Mutlu yol (happy path) testleriyle yetinme; her form ve API için en az 3 negatif/hatalı girdi testi yaz.'],
        skills: [
          { name: 'e2e-playwright-test-yazici', description: 'Playwright ile uçtan uca test senaryosu yazar ve çalıştırır.', triggers: ['e2e', 'playwright', 'uçtan uca test', 'test yaz'], args: [['$HEDEF_URL', 'Test edilecek yerel URL']], steps: ['references/test-senaryo-sablonu.md ile senaryoları yaz.', 'En az 3 negatif test ekle.', 'scripts/run_e2e.mjs ile çalıştır.'], scripts: ['run_e2e.mjs'], references: { 'test-senaryo-sablonu.md': ref('Test Senaryo Şablonu', '| ID | Senaryo | Tür (pozitif/negatif) | Adımlar | Beklenen |\n|---|---|---|---|---|') } },
        ],
      },
      {
        slug: 'siber-guvenlik-uzmani', title: 'Siber Güvenlik & Penetrasyon Uzmanı', head: true,
        mission: 'Kod, skill ve sistemlerde güvenlik açıklarını tespit eder; ithal paketleri denetler.',
        rules: ['Kod içerisine gömülü API anahtarı (hardcoded secret) veya yetkilendirme açığı tespit edersen yayını derhal durdur ve /security-review raporunu zorunlu kıl.'],
        skills: [
          { name: 'guvenlik-acigi-denetimi', description: 'Bir dizini gömülü sır, tehlikeli komut ve OWASP Top 10 kalıpları için tarar.', triggers: ['güvenlik denetimi', 'guvenlik denetimi', 'sast', 'güvenlik açığı', 'security review', 'owasp'], args: [['$HEDEF_DIZIN', 'Taranacak dizin (kurum içi)']], steps: ['scripts/sast_tara.mjs ile tara.', 'Bulguları references/owasp-top10-checklist.md ile eşleştir.', 'Kritik bulgu varsa YAYINI DURDUR kararı ver.'], scripts: ['sast_tara.mjs'], references: { 'owasp-top10-checklist.md': ref('OWASP Top 10 Kontrol Listesi', '- [ ] A01 Erişim kontrolü\n- [ ] A02 Kriptografik hatalar\n- [ ] A03 Enjeksiyon\n- [ ] A04 Güvensiz tasarım\n- [ ] A05 Yanlış yapılandırma\n- [ ] A06 Güncel olmayan bileşenler\n- [ ] A07 Kimlik doğrulama\n- [ ] A08 Bütünlük hataları\n- [ ] A09 Loglama eksikliği\n- [ ] A10 SSRF') } },
        ],
      },
      {
        slug: 'performans-yuk-testi-uzmani', title: 'Performans & Yük Testi Uzmanı',
        mission: 'Servislerin gecikme ve yük altında SLA uyumunu ölçer.',
        rules: ['Yanıt süresi SLA sınırını aşan hiçbir servisi canlı ortama (production) onaylama.'],
        skills: [
          { name: 'yuk-ve-gecikme-testi', description: 'Yerel bir servise yük testi uygular ve SLA eşikleriyle karşılaştırır.', triggers: ['yük testi', 'yuk testi', 'gecikme', 'load test', 'sla'], args: [['$HEDEF_URL', 'Yerel servis URL (yalnızca 127.0.0.1)'], ['$ISTEK_SAYISI', 'İstek sayısı']], steps: ['scripts/load_test.mjs çalıştır.', 'p50/p95 değerlerini assets/sla-esikleri.json ile karşılaştır.', 'Onay / red kararı ver.'], scripts: ['load_test.mjs'], assets: { 'sla-esikleri.json': JSON.stringify({ p50_ms: 200, p95_ms: 800, hata_orani_max: 0.01 }, null, 2) } },
        ],
      },
    ],
  },
  {
    no: '06', slug: '06-Otomasyon-ve-Veri', name: 'Otomasyon ve Veri Mühendisliği', emoji: '⚙️', color: '#d29922',
    keywords: ['otomasyon', 'n8n', 'workflow', 'webhook', 'etl', 'veri temizleme', 'pandas', 'mcp', 'cli', 'entegrasyon', 'token maliyet', 'anonim', 'kvkk', 'pii'],
    tools: ['n8n MCP', 'Python/Pandas CLI', 'cURL/jq', 'Özel MCP Üreticisi'],
    tables: ['crm_leads', 'campaigns'],
    deptRules: ['Kişisel veriler (PII) analitik çıktılara yalnızca maskelenmiş olarak girer.'],
    personnel: [
      { slug: 'is-akisi-otomasyon-uzmani', title: 'İş Akışı Otomasyon Uzmanı', head: true, mission: 'İş akışlarını otomasyona dönüştürür.', rules: ['Hata yakalama (Error Trigger) ve yeniden deneme (Retry) adımı olmayan hiçbir otomasyon akışını aktif etme.'], skills: [
        { name: 'n8n-workflow-uretici', description: 'Hata yakalamalı ve retry içeren n8n iş akışı JSON\'u üretir.', triggers: ['n8n', 'iş akışı otomasyonu', 'workflow'], args: [['$TETIKLEYICI', 'Tetikleyici olay']], steps: ['Tetikleyiciyi tanımla.', 'Düğümleri sırala.', 'Error Trigger + Retry ekle.', 'references/n8n-json-sablonlari.md ile JSON üret.'], references: { 'n8n-json-sablonlari.md': ref('n8n JSON Şablonları', '```json\n{ "nodes": [], "connections": {}, "settings": { "errorWorkflow": "hata-akisi" } }\n```') } },
        { name: 'webhook-hata-kurtarma', description: 'Başarısız webhook çağrılarını analiz eder ve kurtarma planı çıkarır.', triggers: ['webhook', 'hata kurtarma'], args: [['$WEBHOOK', 'Webhook adı']], steps: ['Hata loglarını grupla.', 'Geçici / kalıcı ayrımı yap.', 'Üstel geri çekilmeli yeniden deneme öner.'] },
      ] },
      { slug: 'veri-muhendisi-etl-uzmani', title: 'Veri Mühendisi & ETL Uzmanı', mission: 'Veri boru hatlarını kurar, temizler ve anonimleştirir.', rules: ['Kişisel verileri (PII) maskelemeden veya anonimleştirmeden analitik tablolara aktarma.'], skills: [
        { name: 'veri-temizleme-ve-etl', description: 'CSV/JSON veriyi temizler, PII alanlarını KVKK uyumlu maskeler.', triggers: ['etl', 'veri temizleme', 'anonimleştir', 'maskele', 'csv temizle'], args: [['$KAYNAK_DOSYA', 'Kaynak CSV/JSON']], steps: ['scripts/etl_pipeline.mjs ile oku ve maskele.', 'references/kvkk-anonimlestirme.md kurallarını doğrula.', 'Temiz çıktıyı kaydet.'], scripts: ['etl_pipeline.mjs'], references: { 'kvkk-anonimlestirme.md': ref('KVKK Anonimleştirme', '| Alan | Yöntem |\n|---|---|\n| TC Kimlik | ilk 3 + *** |\n| E-posta | k***@alan |\n| Telefon | son 2 hane açık |\n| IBAN | ilk 4 + son 4 |\n| Ad Soyad | baş harfler |') } },
      ] },
      { slug: 'ai-mcp-entegrasyon-uzmani', title: 'AI & MCP Entegrasyon Uzmanı', mission: 'Araç entegrasyonlarını (CLI/MCP) ve token maliyetini yönetir.', rules: ['Bir aracın resmi CLI\'ı mevcutsa kesinlikle MCP sunucusu kurma; token tasarrufu için CLI entegrasyonu yaz.'], skills: [
        { name: 'yeni-mcp-ve-cli-sarmalayici', description: 'Yeni bir araç için CLI sarmalayıcı veya MCP sunucusu iskeleti üretir.', triggers: ['mcp', 'cli sarmalayıcı', 'entegrasyon yaz'], args: [['$ARAC', 'Araç adı']], steps: ['global-registry/cli-tools.json içinde resmi CLI var mı kontrol et.', 'Varsa CLI sarmalayıcı yaz, yoksa references/mcp-server-boilerplate.md kullan.', 'Registry\'ye ekleme önerisini onaya gönder.'], references: { 'mcp-server-boilerplate.md': ref('MCP Sunucu İskeleti', '- stdio taşıma\n- tools/list ve tools/call\n- Girdi şeması JSON Schema\n- Yalnızca yerel kaynaklara erişim') } },
        { name: 'token-maliyet-analizi', description: 'Ajanların bağlam/token kullanımını analiz eder.', triggers: ['token', 'maliyet analizi', 'bağlam kullanımı'], args: [['$DONEM', 'Dönem']], steps: ['Görev kayıtlarındaki bağlam boyutlarını topla.', 'En pahalı 5 görev tipini çıkar.', 'Skill/rule bölme önerisi ver.'] },
      ] },
    ],
  },
  {
    no: '07', slug: '07-Icerik-ve-Medya', name: 'İçerik ve Medya Üretimi', emoji: '🎬', color: '#c96198',
    keywords: ['içerik', 'icerik', 'makale', 'blog', 'bülten', 'bulten', 'video', 'senaryo', 'reels', 'sosyal medya', 'editoryal', 'yayın takvimi', 'metin yaz'],
    tools: ['FFmpeg CLI', 'yt-dlp/Transkript CLI (online modda)', 'Notion MCP'],
    tables: ['campaigns'],
    deptRules: ['Tüm içerikler marka sesi ve yasaklı kelime listesine uyar.'],
    personnel: [
      { slug: 'icerik-bas-editoru', title: 'İçerik Baş Editörü', head: true, mission: 'Yayın takvimini ve editoryal kaliteyi yönetir.', rules: ['Marka anayasasındaki yasaklı kelimeleri içeren veya kaynak belirtmeyen hiçbir içeriği onaylama.'], skills: [
        { name: 'yayin-takvimi-ve-editoryal-denetim', description: 'Yayın takvimi oluşturur ve içerikleri marka sesine göre denetler.', triggers: ['yayın takvimi', 'yayin takvimi', 'editoryal', 'içerik denetimi'], args: [['$AY', 'Takvim ayı']], steps: ['Kampanyalarla uyumlu konu listesi çıkar.', 'references/marka-sesi-ve-yasakli-kelimeler.md ile denetle.', 'Haftalık takvim tablosu üret.'], references: { 'marka-sesi-ve-yasakli-kelimeler.md': ref('Marka Sesi ve Yasaklı Kelimeler', '## Ses\nGüvenilir, sade, çözüm odaklı.\n\n## Yasaklı kelimeler\n- garanti kazanç\n- bedava\n- en iyisi (kanıtsız)\n- mucize') } },
      ] },
      { slug: 'uzun-format-teknik-yazar', title: 'Uzun Format & Teknik Yazar', mission: 'Rehber, makale ve bülten içerikleri yazar.', rules: ['Gereksiz dolgu cümleleri kullanma; her alt başlıkta somut örnek ve uygulanabilir adım ver.'], skills: [
        { name: 'seo-makale-ve-rehber-yazici', description: 'SEO uyumlu uzun format makale/rehber yazar.', triggers: ['makale', 'rehber', 'blog yazısı', 'seo makale'], args: [['$KONU', 'Konu'], ['$ANAHTAR_KELIME', 'Odak anahtar kelime']], steps: ['references/makale-iskeleti.md iskeletini kullan.', 'Her alt başlığa örnek + adım ekle.', 'Meta açıklama yaz.'], references: { 'makale-iskeleti.md': ref('Makale İskeleti', '# Başlık\n## Giriş (problem)\n## Adım 1\n## Adım 2\n## Sık yapılan hatalar\n## Sonuç ve eylem çağrısı') } },
        { name: 'bulten-olusturucu', description: 'Kurum içi/dışı bülten hazırlar.', triggers: ['bülten', 'bulten', 'newsletter'], args: [['$DONEM', 'Bülten dönemi']], steps: ['Dönemin öne çıkan 3 haberini seç.', 'Her biri için 2 cümle özet yaz.', 'Tek CTA ekle.'] },
      ] },
      { slug: 'sosyal-medya-video-senaristi', title: 'Sosyal Medya & Video Senaristi', mission: 'Kısa video ve sosyal medya senaryoları üretir.', rules: ['İlk 3 saniyede dikkat çekici kanca (hook) içermeyen hiçbir kısa video senaryosunu teslim etme.'], skills: [
        { name: 'viral-kanca-ve-reels-senaryosu', description: 'Kancalı kısa video (Reels/Shorts) senaryosu yazar.', triggers: ['reels', 'shorts', 'video senaryosu', 'kanca', 'hook', 'sosyal medya'], args: [['$KONU', 'Video konusu']], steps: ['references/kanca-arsivi.md içinden 3 kanca öner.', 'assets/video-akis-tablosu.csv formatında sahne akışı yaz.', 'Altyazı metnini ekle.'], references: { 'kanca-arsivi.md': ref('Kanca Arşivi', '- "Bunu bilmeden ... yapma"\n- "3 saniyede ..."\n- "Herkes yanlış yapıyor: ..."\n- Soru ile açılış') }, assets: { 'video-akis-tablosu.csv': 'saniye,goruntu,metin,ses\n0-3,,KANCA,\n3-10,,,\n10-25,,,\n25-30,,CTA,\n' } },
      ] },
    ],
  },
  {
    no: '08', slug: '08-Dijital-Pazarlama', name: 'Dijital Pazarlama ve Büyüme', emoji: '📣', color: '#3fb950',
    keywords: ['pazarlama', 'seo', 'reklam', 'kampanya', 'anahtar kelime', 'cro', 'dönüşüm', 'donusum', 'landing', 'açılış sayfası', 'a/b', 'roas', 'ads'],
    tools: ['Google Analytics MCP (online modda)', 'Meta/Google Ads MCP (online modda)', 'Lighthouse CLI'],
    tables: ['campaigns', 'crm_leads'],
    deptRules: [],
    personnel: [
      { slug: 'seo-organik-buyume-uzmani', title: 'SEO & Organik Büyüme Uzmanı', mission: 'Organik trafik ve anahtar kelime stratejisini yönetir.', rules: ['Arama niyeti (Search Intent) eşleşmeyen anahtar kelimeler için içerik üretimi talep etme.'], skills: [
        { name: 'anahtar-kelime-kumeleme', description: 'Anahtar kelimeleri anlamsal kümelere ayırır ve arama niyeti atar.', triggers: ['anahtar kelime', 'keyword', 'kümeleme', 'kumeleme'], args: [['$KELIMELER', 'Anahtar kelime listesi']], steps: ['scripts/keyword_cluster.mjs ile kümele.', 'Her kümeye niyet (bilgi/ticari/işlem) ata.', 'Küme başına 1 içerik öner.'], scripts: ['keyword_cluster.mjs'] },
        { name: 'teknik-seo-denetimi', description: 'Site için teknik SEO denetim listesi uygular.', triggers: ['teknik seo', 'site denetimi'], args: [['$SITE', 'Site adresi']], steps: ['Meta, başlık hiyerarşisi, canonical kontrol et.', 'Lighthouse CLI çıktısını yorumla.', 'Öncelikli düzeltme listesi ver.'] },
      ] },
      { slug: 'performans-pazarlama-uzmani', title: 'Performans Pazarlama Uzmanı', head: true, mission: 'Ücretli kampanyaları ve reklam verimliliğini yönetir.', rules: ['Her kampanya için en az 3 farklı başlık ve 2 farklı görsel açısı (A/B testi) sunmadan reklam planı kapatma.'], skills: [
        { name: 'reklam-metni-ve-ab-varyasyon', description: 'Kampanya için A/B varyasyonlu reklam metinleri üretir.', triggers: ['reklam metni', 'a/b', 'ab test', 'kampanya planı', 'reklam'], args: [['$URUN', 'Ürün'], ['$HEDEF_KITLE', 'Hedef kitle']], steps: ['references/yuksek-donusumlu-reklam-sablonlari.md şablonlarını kullan.', 'En az 3 başlık ve 2 görsel açısı yaz.', 'campaigns tablosundaki geçmiş ROAS ile kıyasla.'], references: { 'yuksek-donusumlu-reklam-sablonlari.md': ref('Yüksek Dönüşümlü Reklam Şablonları', '- Problem → Çözüm → Kanıt → CTA\n- Önce/Sonra\n- Sosyal kanıt + aciliyet') } },
      ] },
      { slug: 'donusum-optimizasyonu-uzmani', title: 'Dönüşüm Optimizasyonu (CRO) Uzmanı', mission: 'Açılış sayfalarının dönüşüm oranını artırır.', rules: ['Tek bir net harekete geçirici mesaj (CTA) ve sosyal kanıt içermeyen açılış sayfası kurgusu önerme.'], skills: [
        { name: 'landing-page-cro-denetimi', description: 'Açılış sayfasını ikna psikolojisi kontrol listesiyle denetler.', triggers: ['cro', 'landing page', 'açılış sayfası', 'dönüşüm oranı'], args: [['$SAYFA', 'Sayfa adı/URL']], steps: ['references/ikna-psikolojisi-kontrol-listesi.md uygula.', 'Tek CTA ve sosyal kanıtı doğrula.', 'A/B test hipotezleri öner.'], references: { 'ikna-psikolojisi-kontrol-listesi.md': ref('İkna Psikolojisi Kontrol Listesi', '- [ ] Tek net CTA\n- [ ] Sosyal kanıt (yorum, logo)\n- [ ] Değer önerisi ilk ekranda\n- [ ] Risk azaltıcı (iade, deneme)\n- [ ] Form alanı minimum') } },
      ] },
    ],
  },
  {
    no: '09', slug: '09-Satis-ve-CRM', name: 'Satış ve Müşteri İlişkileri', emoji: '💼', color: '#f0883e',
    keywords: ['satış', 'satis', 'müşteri', 'musteri', 'teklif', 'crm', 'lead', 'fırsat', 'firsat', 'itiraz', 'indirim', 'pazarlık', 'churn', 'onboarding', 'şikayet', 'sikayet', 'takip e-posta'],
    tools: ['Gmail/Workspace MCP (online modda)', 'Yerel Intranet SMTP', 'CRM CLI/API (yerel SQLite)'],
    tables: ['crm_leads', 'customers', 'tickets', 'discount_limits'],
    deptRules: ['Müşteriye giden her e-posta yönetici onay kapısından geçer.'],
    personnel: [
      { slug: 'satis-temsilcisi', title: 'B2B/B2C Satış Temsilcisi', head: true, mission: 'Fırsatları yönetir, kişiye özel teklif ve takip e-postaları hazırlar.', rules: ['Müşterinin sektörüne ve ihtiyacına göre özelleştirilmemiş genel şablon e-postalar gönderme.'], skills: [
        { name: 'kisiye-ozel-teklif-hazirlama', description: 'Firma için sektörüne özel teklif hazırlar.', triggers: ['teklif', 'fiyat teklifi', 'proposal'], args: [['$FIRMA_ADI', 'Teklif verilecek firma']], steps: ['crm_leads ve customers tablosundan $FIRMA_ADI verisini oku.', 'Sektöre özel değer önerisi yaz.', 'references/teklif-sablonu.md formatında teklif üret.', 'İndirim varsa discount_limits sınırını kontrol et.'], references: { 'teklif-sablonu.md': ref('Teklif Şablonu', '**Sayın $FIRMA_ADI Yetkilisi,**\n\n## İhtiyacınız\n## Önerimiz\n## Kapsam\n| Kalem | Adet | Birim | Tutar |\n|---|---|---|---|\n## Geçerlilik\n30 gün') } },
        { name: 'takip-eposta-dizisi', description: 'Fırsat aşamasına göre 3 adımlı takip e-posta dizisi yazar.', triggers: ['takip e-posta', 'takip eposta', 'follow up', 'e-posta dizisi'], args: [['$FIRMA_ADI', 'Firma']], steps: ['Fırsat aşamasını oku.', 'Gün 1 / Gün 4 / Gün 10 e-postalarını yaz.', 'Gönderim için onay kapısına koy.'] },
      ] },
      { slug: 'itiraz-yonetimi-kapanis-uzmani', title: 'İtiraz Yönetimi & Kapanış Uzmanı', mission: 'Müşteri itirazlarını karşılar ve müzakereyi kapatır.', rules: ['Finans departmanının belirlediği maksimum indirim sınırını (assets/ içindeki tablo) kesinlikle aşma.'], skills: [
        { name: 'itiraz-karsilama-ve-muzakere', description: 'İtiraza cevap ve indirim sınırları içinde müzakere önerisi üretir.', triggers: ['itiraz', 'müzakere', 'muzakere', 'pahalı', 'indirim'], args: [['$ITIRAZ', 'Müşteri itirazı'], ['$TALEP_INDIRIM', 'Talep edilen indirim %']], steps: ['references/itiraz-cevap-matrisi.md ile itiraz tipini bul.', 'assets/fiyat-indirim-yetki-tablosu.csv ile sınırı kontrol et.', 'Sınır aşılıyorsa indirim yerine değer ekleme öner.'], references: { 'itiraz-cevap-matrisi.md': ref('İtiraz Cevap Matrisi', '| İtiraz | Yaklaşım |\n|---|---|\n| Pahalı | Toplam sahip olma maliyeti + ROI |\n| Zamanı değil | Pilot / aşamalı başlangıç |\n| Rakip daha ucuz | Somut özellik farkı |') }, assets: { 'fiyat-indirim-yetki-tablosu.csv': 'rol,max_indirim_yuzde\nsatis-temsilcisi,5\nitiraz-yonetimi-kapanis-uzmani,10\nsatis-muduru,15\ngenel-mudur,25\n' } },
      ] },
      { slug: 'musteri-basari-uzmani', title: 'Müşteri Başarı (CS) Uzmanı', mission: 'Müşteri onboarding, memnuniyet ve kayıp (churn) riskini yönetir.', rules: ['Müşteri şikayetlerinde savunmaya geçme; önce sorunu doğrula, ardından çözüm adımını ve süresini net bildir.'], skills: [
        { name: 'musteri-onboarding-ve-churn-analizi', description: 'Müşterilerin kayıp riskini hesaplar ve aksiyon planı üretir.', triggers: ['churn', 'kayıp riski', 'onboarding', 'müşteri sağlığı', 'şikayet'], args: [['$SEGMENT', 'Müşteri segmenti (opsiyonel)']], steps: ['customers + tickets verisini al.', 'scripts/churn_risk_hesapla.mjs ile skorla.', 'Yüksek riskli müşteriler için aksiyon yaz.'], scripts: ['churn_risk_hesapla.mjs'] },
      ] },
    ],
  },
  {
    no: '10', slug: '10-Finans-ve-Operasyon', name: 'Finans, Hukuk ve Operasyon', emoji: '📊', color: '#a371f7',
    keywords: ['finans', 'bütçe', 'butce', 'fatura', 'gider', 'gelir', 'nakit', 'cac', 'ltv', 'unit economics', 'hukuk', 'sözleşme', 'sozlesme', 'kvkk', 'sop', 'operasyon', 'eğitim materyali', 'tahsilat'],
    tools: ['Stripe/Fatura CLI (online modda)', 'CSV/Excel Finans Motoru', 'Sözleşme Denetleyici'],
    tables: ['invoices', 'expenses', 'customers', 'discount_limits', 'contracts'],
    deptRules: ['Tutar içeren tüm çıktılar betik ile hesaplanır ve kaynak tablo belirtilir.'],
    personnel: [
      { slug: 'finansal-analist', title: 'Finansal Analist & Bütçe Uzmanı', head: true, mission: 'Bütçe, nakit akışı ve birim ekonomisi analizlerini yapar.', rules: ['Tüm finansal hesaplamaları zihinden değil, scripts/ altındaki betikleri çalıştırarak doğrula.'], skills: [
        { name: 'aylik-finansal-analiz-ve-unit-economics', description: 'Dönem için gelir/gider, CAC, LTV ve LTV/CAC analizini betikle hesaplar.', triggers: ['finansal analiz', 'cac', 'ltv', 'unit economics', 'bütçe', 'butce', 'nakit akışı', 'gelir gider'], args: [['$DONEM', 'Analiz dönemi (YYYY-AA)']], steps: ['invoices ve expenses tablosundan $DONEM verisini oku.', 'scripts/cac_ltv_hesapla.mjs ile hesapla.', 'LTV/CAC < 3 ise risk olarak işaretle.', 'Özet tabloyu sun.'], scripts: ['cac_ltv_hesapla.mjs'] },
      ] },
      { slug: 'hukuk-uyum-danismani', title: 'Hukuk & Uyum Danışmanı', mission: 'Sözleşme riskleri ve KVKK uyumunu denetler.', rules: ['Her hukuki inceleme çıktısının başına \'Bu analiz ön hukuki değerlendirmedir, nihai imza öncesi yetkili hukuk müşaviri onayı gerektirir\' şerhini düş.'], skills: [
        { name: 'sozlesme-risk-ve-kvkk-denetimi', description: 'Sözleşmeyi risk maddeleri ve KVKK uyumu açısından inceler.', triggers: ['sözleşme', 'sozlesme', 'kvkk', 'hukuki', 'risk maddesi'], args: [['$SOZLESME', 'Sözleşme dosyası veya adı']], steps: ['Şerhi en başa yaz.', 'references/standart-sozlesme-maddeleri.md ile karşılaştır.', 'Eksik/riskli maddeleri risk seviyesiyle listele.'], references: { 'standart-sozlesme-maddeleri.md': ref('Standart Sözleşme Maddeleri', '- Taraflar ve konu\n- Süre ve fesih\n- Ücret ve ödeme\n- Gizlilik\n- KVKK / veri işleme\n- Sorumluluğun sınırlandırılması\n- Uyuşmazlık çözümü (yetkili mahkeme)') } },
      ] },
      { slug: 'ic-operasyon-sop-denetcisi', title: 'İç Operasyon & SOP Denetçisi', mission: 'SOP dokümantasyonunu ve eğitimden gelen yeni yetenekleri denetler.', rules: ['Yeni oluşturulan veya ithal edilen hiçbir yeteneği güvenlik ve format kontrolünden geçirmeden aktif kullanıma alma.'], skills: [
        { name: 'sop-dokumantasyon-ureticisi', description: 'Bir süreç için kurumsal formatta SOP üretir.', triggers: ['sop', 'prosedür', 'prosedur', 'standart operasyon'], args: [['$SUREC', 'Süreç adı']], steps: ['references/kurumsal-sop-formati.md formatını kullan.', 'Adımları numaralandır.', 'Sorumlu ve kontrol noktalarını ekle.'], references: { 'kurumsal-sop-formati.md': ref('Kurumsal SOP Formatı', '## Amaç\n## Kapsam\n## Sorumlular\n## Adımlar\n1.\n## Kontrol Noktaları\n## Revizyon Geçmişi') } },
        { name: 'egitim-materyali-isleyici', description: 'Eğitim Merkezine gelen materyali SOP / skill / rule taslağına dönüştürür.', triggers: ['eğitim materyali', 'egitim materyali', 'eğitim işle'], args: [['$MATERYAL', 'Materyal dosyası']], steps: ['Materyali kanal tipine göre ayrıştır.', 'Kuralları, adımları ve bilgiyi ayır.', 'Taslağı format + güvenlik kontrolüne gönder.'] },
      ] },
    ],
  },
];

export const ALL_PERSONNEL = DEPARTMENTS.flatMap(d => d.personnel.map(p => ({ ...p, dept: d.slug })));
