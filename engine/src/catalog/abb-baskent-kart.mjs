// Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı — 5 Şube Müdürlüğü,
// Akıllı Şehirler Şube Müdürlüğü > Proje Yönetimi Ekibi > Başkent Kart 3 Yıllık (36 Ay)
// Teknik Şartname, İhale Kapanış, Fatura, Dekont ve Evrak Eksiklik Denetim Kataloğu.

export function generateBaskentKart3YearDataset() {
  const years = [
    { yil: 1, calendarYear: 2023, baseAid: 485000000, baseInvoice: 1350000, baseBeneficiaries: 385000 },
    { yil: 2, calendarYear: 2024, baseAid: 720000000, baseInvoice: 1650000, baseBeneficiaries: 432000 },
    { yil: 3, calendarYear: 2025, baseAid: 960000000, baseInvoice: 1950000, baseBeneficiaries: 478500 },
  ];

  const months = [];
  let globalMonth = 0;

  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      globalMonth++;
      const mm = String(m).padStart(2, '0');
      const donem = `${y.calendarYear}-${mm}`;
      const invAmt = y.baseInvoice + ((m % 4) * 25000);
      const socialAidAmt = y.baseAid + (m === 3 || m === 4 || m === 9 || m === 11 ? 85000000 : (m * 4500000));
      const beneficiaries = y.baseBeneficiaries + (m * 1850);

      // Varsayılan tam uyumlu değerler
      let fatura_var = true;
      let dekont_var = true;
      let dekont_tutari = invAmt;
      let pos_mutabakat_var = true;
      let sla_raporu_var = true;
      let sla_uptime = 99.96;
      let sgk_vergi_var = true;
      let not = '36 Aylık Hizmet Alımı Hak Ediş, Sosyal Yardım Aktarım ve Market/POS Takas Mutabakatı Tamam.';

      // Gerçekçi denetim bulguları (3 yıllık ihale kapanışında tespit edilen 5 kritik eksiklik/uyuşmazlık)
      if (donem === '2023-08') {
        dekont_var = false;
        dekont_tutari = 0;
        not = 'KRİTİK EKSİK: 2023 Ağustos (8. Hak Ediş) Banka Ödeme & Sosyal Yardım Komisyon Dekontu (DEKONT-2023-08.pdf) klasörde bulunamadı.';
      } else if (donem === '2024-03') {
        dekont_tutari = invAmt - 45000;
        not = 'TUTAR UYUŞMAZLIĞI: Fatura tutarı (' + invAmt.toLocaleString('tr-TR') + ' TL) ile Banka Dekontu (' + dekont_tutari.toLocaleString('tr-TR') + ' TL) arasında 45.000 TL fark var (Kesinti/Mahsup belgesi eksik).';
      } else if (donem === '2024-11') {
        pos_mutabakat_var = false;
        sgk_vergi_var = false;
        not = 'EVRAK EKSİĞİ: Anlaşmalı Market/Üye İşyeri POS BKM Takas Mutabakat Cetveli ve SGK Borcu Yoktur yazısı dosyada eksik.';
      } else if (donem === '2025-06') {
        sla_uptime = 99.42;
        not = 'SLA İHLALİ: Teknik Şartname Madde 14.2 gereği aylık sistem sürekliliği en az %99.90 olmalıdır. %99.42 gerçekleştiği için ceza kesintisi dekontu talep edilmeli.';
      } else if (donem === '2025-10') {
        fatura_var = false;
        not = 'KRİTİK EKSİK: 2025 Ekim (34. Hak Ediş) E-Fatura UBL/PDF nüshası ve E-İmza doğrulama raporu teslim edilmemiş.';
      }

      months.push({
        ay_no: globalMonth,
        yil: y.yil,
        takvim_yili: y.calendarYear,
        donem,
        hakedis_no: `HKD-${String(globalMonth).padStart(2, '0')}`,
        fatura_var,
        fatura_no: `ABB-BK-${y.calendarYear}${mm}-00${globalMonth}`,
        fatura_dosya: `Yil-${y.yil}-${y.calendarYear}/${donem}/FATURA-${donem}.pdf`,
        fatura_tutari: invAmt,
        dekont_var,
        dekont_no: `BNK-DK-${y.calendarYear}${mm}-${1000 + globalMonth}`,
        dekont_dosya: `Yil-${y.yil}-${y.calendarYear}/${donem}/DEKONT-${donem}.pdf`,
        dekont_tutari,
        sosyal_yardim_aktarim_tutari: socialAidAmt,
        aktif_kart_vatandas_sayisi: beneficiaries,
        anlasmali_market_pos_sayisi: 14200 + (globalMonth * 110),
        pos_mutabakat_var,
        pos_dosya: `Yil-${y.yil}-${y.calendarYear}/${donem}/POS-MUTABAKAT-${donem}.csv`,
        sla_raporu_var,
        sla_uptime,
        sla_dosya: `Yil-${y.yil}-${y.calendarYear}/${donem}/SLA-RAPORU-${donem}.pdf`,
        sgk_vergi_var,
        sgk_dosya: `Yil-${y.yil}-${y.calendarYear}/${donem}/SGK-VERGI-BORCU-YOKTUR-${donem}.pdf`,
        not,
      });
    }
  }

  const specChecks = [
    {
      kod: 'TS-01',
      madde: 'Teknik Şartname Md. 6.1 & Sözleşme Md. 12',
      baslik: '36 Aylık Tam Hak Ediş E-Fatura Seti ve Üst Yazıları',
      aciklama: '3 yıl (36 ay) boyunca düzenlenen tüm aylık hak ediş faturalarının e-Fatura UBL-TR ve imzalı PDF nüshalarının kontrolü.',
      sorumlu: 'Başkent Kart Proje Sorumlusu & Mali Evrak Denetçisi',
      durum: 'EKSİK (35/36 Tamam — 2025-10 Faturası Eksik)',
    },
    {
      kod: 'TS-02',
      madde: 'Teknik Şartname Md. 6.4 & Mali Kontrol',
      baslik: '36 Aylık Banka Ödeme ve Sosyal Yardım Aktarım Dekontları Mutabakatı',
      aciklama: 'İhtiyaç sahibi vatandaşların Başkent Kartlarına aktarılan sosyal yardım tutarları ile yüklenici firma hizmet bedeli banka dekontlarının kuruşu kuruşuna faturalarla eşleşmesi.',
      sorumlu: 'Başkent Kart Proje Sorumlusu',
      durum: 'EKSİK (2023-08 Dekontu Eksik, 2024-03 45.000 TL Fark)',
    },
    {
      kod: 'TS-03',
      madde: 'Teknik Şartname Md. 9.3 (Üye İşyeri & Market POS)',
      baslik: 'Anlaşmalı Market, Esnaf ve POS BKM Takas Mutabakat Cetvelleri (36 Ay)',
      aciklama: 'Vatandaşların kredi kartı gibi marketlerden yaptığı harcamaların BKM/Banka takas mutabakat cetvelleri ve komisyon oran uygunluğu.',
      sorumlu: 'Başkent Kart Proje Sorumlusu',
      durum: 'EKSİK (35/36 Tamam — 2024-11 POS Mutabakat Cetveli Eksik)',
    },
    {
      kod: 'TS-04',
      madde: 'Teknik Şartname Md. 14.2 (Hizmet Seviyesi - SLA)',
      baslik: '36 Aylık %99.90 Sistem Sürekliliği (Uptime) ve Çağrı Merkezi SLA Raporları',
      aciklama: 'Kart provizyon, mobil uygulama ve POS altyapısının 3 yıl boyunca %99.90 SLA hedefine uygunluğu ve varsa SLA ceza kesintisi dekontu.',
      sorumlu: 'Sistem, Ağ ve Veri Merkezi Şube Müdürlüğü & Proje Yönetimi Ekibi',
      durum: 'EKSİK (2025-06 ayında %99.42 SLA ihlali ceza mahsup dekontu bekleniyor)',
    },
    {
      kod: 'TS-05',
      madde: 'Teknik Şartname Md. 18.1 (Siber Güvenlik & PCI-DSS)',
      baslik: '3 Yıllık Bağımsız Sızma (Penetrasyon) Testi ve PCI-DSS / BDDK Uyumluluk Sertifikaları',
      aciklama: 'Her sözleşme yılı için TSE onaylı bağımsız sızma testi raporu ve kartlı ödeme sistemleri PCI-DSS güvenlik sertifikası.',
      sorumlu: 'Siber Güvenlik ve Bilgi Güvenliği Şube Müdürlüğü',
      durum: 'TAMAM',
    },
    {
      kod: 'TS-06',
      madde: 'Teknik Şartname Md. 21.4 (Veri & Kaynak Kod Devri)',
      baslik: '3 Yıllık Vatandaş Yardım Veritabanı, İşlem Kütükleri (Log) ve Kaynak Kod Teslim Tutanağı',
      aciklama: 'İhale kapanışında 3 yıllık tüm kart hareketlerinin, kampanya/yardım modüllerinin ve şifresiz veritabanı yedeklerinin ABB Veri Merkezine eksiksiz devri.',
      sorumlu: 'Yazılım Şube Müdürlüğü & Akıllı Şehirler Proje Yönetimi Ekibi',
      durum: 'EKSİK (Yüklenici firmadan son 3. Yıl soğuk arşiv log devir tutanağı bekleniyor)',
    },
    {
      kod: 'TS-07',
      madde: 'Teknik Şartname Md. 11.2 (Fiziksel Kart & Kişiselleştirme)',
      baslik: 'Basılı Başkent Kart Teslim İrsaliyeleri ve Kurye/Dağıtım Mazbataları Mutabakatı',
      aciklama: '478.500+ ihtiyaç sahibi vatandaşa teslim edilen fiziksel temassız Başkent Kartların basım, zarflama ve teslim tutanaklarının kontrolü.',
      sorumlu: 'Proje Yönetimi Ekibi',
      durum: 'TAMAM',
    },
    {
      kod: 'TS-08',
      madde: '4735 Sayılı Kanun & Hizmet Alımları Kabul Yönetmeliği',
      baslik: 'SGK İlişiksizlik Belgesi ve Vergi Dairesi Borcu Yoktur Kapanış Yazıları',
      aciklama: 'Kesin kabul ve kesin teminat iadesi öncesinde yüklenici firmanın 36 aylık SGK prim ve vergi borcu bulunmadığına dair resmi belgeler.',
      sorumlu: 'İdari, Mali İşler ve İhale Takip Şube Müdürlüğü',
      durum: 'EKSİK (2024-11 dönemi SGK belgesi ve İhale Kapanış İlişiksizlik Yazısı bekleniyor)',
    },
    {
      kod: 'TS-09',
      madde: 'Teknik Şartname Md. 16.5 (KVKK & Gizlilik)',
      baslik: 'KVKK Veri İmha ve Sosyal Yardım Mahremiyet Taahhütnamesi Kapanış Denetimi',
      aciklama: 'Sosyal yardım alan vatandaşların kimlik ve harcama verilerinin yüklenici ortamlarından güvenli silindiğine (wipe) dair tutanak.',
      sorumlu: 'Siber Güvenlik Şube Müdürlüğü & Akıllı Şehirler Şube Müdürlüğü',
      durum: 'TAMAM',
    },
    {
      kod: 'TS-10',
      madde: 'Muayene ve Kabul Yönetmeliği Md. 24',
      baslik: 'Muayene ve Kabul Komisyonu Nihai İhale Kapanış ve Kabul Tutanağı',
      aciklama: 'Tüm eksik fatura, dekont ve teknik şartname maddeleri tamamlandıktan sonra komisyon üyelerince imzalanacak kesin kabul tutanağı.',
      sorumlu: 'Akıllı Şehirler Şube Müdürlüğü — Muayene ve Kabul Komisyonu',
      durum: 'BEKLEMEDE (Eksik 5 Evrak Tamamlandığında İmzaya Açılacak)',
    },
  ];

  return {
    meta: {
      kurum: 'Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığı',
      mudurluk: 'Akıllı Şehirler Şube Müdürlüğü',
      ekip: 'Proje Yönetimi Ekibi',
      proje_adi: 'Başkent Kart Sosyal Yardım ve Dijital Ödeme Sistemi',
      ihale_kayit_no: '2022/984120',
      sozlesme_suresi: '36 Ay (3 Yıl: 01.01.2023 - 31.12.2025)',
      kapsam: 'İhtiyaç sahibi vatandaşlara dijital sosyal yardım kartı (Başkent Kart) ile doğalgaz, gıda, et, kırtasiye, süt, ulaşım ve nakdi desteklerin yatırılması; vatandaşların kredi kartı gibi market ve anlaşmalı üye işyerlerinden alışveriş yapabilmesi.',
      denetim_amaci: '3 Yıllık İhale Kapanışı ve Kesin Kabul Öncesi 36 Aylık Tüm Fatura, Banka Dekontu, POS Takas Mutabakatı, SLA ve Teknik Şartname Evraklarının %100 Offline Eksiklik Denetimi',
    },
    months,
    specChecks,
  };
}

export const ABB_DEPARTMENTS = [
  {
    no: '01',
    slug: '01-Akilli-Sehirler-Sube-Mudurlugu',
    name: 'Akıllı Şehirler Şube Müdürlüğü',
    emoji: '🏙️',
    color: '#1d4ed8',
    keywords: ['akıllı şehirler', 'proje yönetimi', 'başkent kart', 'sosyal yardım kartı', 'ihale kapanış', 'kabul', 'teknik şartname', 'fatura', 'dekont', 'evrak kontrol'],
    tools: ['Yerel Evrak & Dekont Denetim Motoru (Offline)', 'SQLite Hak Ediş Veritabanı'],
    tables: ['projects', 'project_tasks', 'invoices', 'expenses', 'contracts'],
    deptRules: [
      'Akıllı Şehirler Şube Müdürlüğü bünyesindeki Proje Yönetimi Ekibi, Başkent Kart dahil tüm akıllı şehir projelerinin teknik şartname ve kabul denetimini %100 offline ortamda yürütür.',
      'Başkent Kart ihale kapanış ve kabul işlemlerinde 3 yıllık (36 ay) tüm fatura, banka dekontu, market/POS mutabakat cetveli ve SLA raporları kontrol edilmeden kesin kabul tutanağı onaylanamaz.',
      'Sosyal yardım alan vatandaşların kimlik ve kart verileri KVKK gereği hiçbir dış bulut servisine çıkarılamaz.',
    ],
    personnel: [
      {
        slug: 'baskent-kart-proje-sorumlusu',
        title: 'Proje Yönetimi Ekibi — Başkent Kart Proje Sorumlusu ve Kabul Denetim Uzmanı',
        head: true,
        mission: 'Akıllı Şehirler Şube Müdürlüğü altındaki Proje Yönetimi Ekibinde Başkent Kart (Sosyal Yardım Kartı) projesini yönetir. İhtiyaç sahibi vatandaşlara yatırılan yardımların, anlaşmalı market/POS harcamalarının ve 3 yıllık (36 ay) ihale kapanış/kabul sürecindeki tüm fatura, dekont, SLA ve teknik şartname evraklarının eksiksizliğini %100 offline olarak denetler.',
        rules: [
          'Her zaman `scripts/baskent_kart_kabul_denetim.mjs` deterministik betiğini çalıştırarak 3 yıllık (36 ay) fatura, dekont, POS mutabakat ve teknik şartname kontrolünü sayısal kanıtlarla raporla.',
          'Fatura tutarı ile banka dekont tutarı arasında 1 TL dahi fark varsa veya herhangi bir aya ait dekont/fatura/POS mutabakatı eksikse KESİN KABUL onayı verme; eksik evrak ihtar listesi oluştur.',
          'Vatandaşların Başkent Kart kişisel verilerini KVKK kapsamında koru ve yalnızca yerel (offline) ortamda işle.',
        ],
        skills: [
          {
            name: 'baskent-kart-ihale-kabul-denetimi',
            description: 'Başkent Kart 3 yıllık (36 ay) ihale kapanışı ve kesin kabulü kapsamında firmanın sunduğu tüm faturaları, banka dekontlarını, market/POS mutabakatlarını ve teknik şartname evraklarını inceleyip eksikleri raporlar.',
            triggers: ['başkent kart', 'baskent kart', 'ihale kapanış', 'kabul', 'teknik şartname', 'fatura', 'dekont', 'evrak', 'eksik', '3 yıl', '36 ay', 'sosyal yardım kartı'],
            args: [
              ['$DONEM', 'Denetlenecek yıl veya ay aralığı (varsayılan: 3 Yıl / 36 Ay Tamamı)'],
              ['$KLASOR', 'İncelenecek yerel evrak klasörü'],
            ],
            steps: [
              '`scripts/baskent_kart_kabul_denetim.mjs` betiğini çalıştırarak 3 yıllık (36 ay) fatura, dekont, POS mutabakat, SLA ve SGK evraklarını tara.',
              'Eksik faturaları, eksik banka dekontlarını ve fatura-dekont tutar uyuşmazlıklarını ay bazında tablo halinde listele.',
              'Teknik Şartname 10 Kesin Kabul kriterinden eksik olan maddeleri belirt.',
              'Yüklenici firmaya gönderilecek "Eksik Evrak Tamamlama İhtarı ve Muayene Kabul Ön Raporu"nu oluştur.',
            ],
            scripts: ['baskent_kart_kabul_denetim.mjs'],
            references: {
              'baskent-kart-teknik-sartname-kabul-rehberi.md': `# Ankara Büyükşehir Belediyesi — Başkent Kart Teknik Şartname ve 3 Yıllık İhale Kapanış/Kabul Rehberi

## 1. Projenin Tanımı ve Kapsamı
**Başkent Kart**, Ankara Büyükşehir Belediyesi tarafından ihtiyaç sahibi vatandaşlara verilen, içerisine gıda, doğalgaz, et, süt, kırtasiye, eğitim ve nakdi sosyal yardımların yatırıldığı, vatandaşların da kredi kartı/banka kartı gibi anlaşmalı marketlerden ve üye işyerlerinden alışveriş yapabildiği akıllı şehir sosyal yardım kartı projesidir.

## 2. 3 Yıllık (36 Ay) İhale Kapanış ve Kabul Denetim Zorunlulukları
İhale süresi (3 Yıl / 36 Ay) sonunda Geçici ve Kesin Kabul Komisyonu tarafından aşağıdaki evrakların **36 ayın tamamı için** eksiksiz olduğu doğrulanmalıdır:
1. **Aylık Hak Ediş Faturaları (36 Adet):** E-Fatura UBL-TR ve imzalı PDF nüshaları.
2. **Banka Ödeme & Yardım Aktarım Dekontları (36 Adet):** Fatura tutarlarıyla kuruşu kuruşuna mutabakatı.
3. **Anlaşmalı Market / POS Takas Mutabakat Cetvelleri (36 Adet):** BKM ve banka POS harcama/komisyon mutabakatları.
4. **Aylık SLA (%99.90 Uptime) Sistem Süreklilik Raporları (36 Adet):** İhlal olan aylarda şartname gereği ceza kesintisi dekontu.
5. **SGK Hizmet Dökümü ve Vergi Borcu Yoktur Yazıları (36 Adet + Kapanış İlişiksizlik Belgesi).**
6. **Teknik Şartname Kapanış Tutanakları:** 3 Yıllık Penetrasyon Testleri, KVKK Veri İmha Tutanağı ve Veritabanı/Log Devir Tutanağı.
`,
            },
            assets: {
              'baskent-kart-3-yillik-evrak-kayitlari.json': JSON.stringify(generateBaskentKart3YearDataset(), null, 2),
            },
          },
          {
            name: 'proje-kritik-yol-analizi',
            description: 'Akıllı Şehirler Proje Yönetimi Ekibi iş paketlerinin kritik yolunu (CPM) ve teslim tarihlerini hesaplar.',
            triggers: ['proje planı', 'kritik yol', 'iş paketi', 'cpm'],
            args: [['$PROJE', 'Proje adı']],
            steps: ['`scripts/kritik_yol_hesapla.mjs` betiğini çalıştır.', 'Gecikme riski olan iş paketlerini raporla.'],
            scripts: ['kritik_yol_hesapla.mjs'],
          },
        ],
      },
      {
        slug: 'akilli-sehirler-sube-muduru',
        title: 'Akıllı Şehirler Şube Müdürü',
        head: false,
        mission: 'Ankara Büyükşehir Belediyesi Bilgi İşlem Dairesi Başkanlığına bağlı Akıllı Şehirler Şube Müdürlüğünü yönetir. Proje Yönetimi Ekibinin yürüttüğü Başkent Kart ve diğer akıllı şehir projelerinin idari/teknik koordinasyonunu ve Muayene Kabul Komisyonu başkanlığını yürütür.',
        rules: [
          'Proje Yönetimi Ekibinden gelen 3 yıllık Başkent Kart denetim bulgularını incelemeden kesin kabul yazısını imzalama.',
          'Eksik dekont veya fatura uyuşmazlığı varsa İdari ve Mali İşler Şube Müdürlüğü ile koordineli ihtar süreci başlat.',
        ],
        skills: [
          {
            name: 'akilli-sehirler-mudurluk-ozeti',
            description: 'Akıllı Şehirler Şube Müdürlüğü ve Proje Yönetimi Ekibinin güncel proje ve ihale kabul durumunu özetler.',
            triggers: ['şube müdürlüğü durumu', 'akıllı şehirler raporu', 'komisyon kararı'],
            args: [['$DONEM', 'Dönem']],
            steps: ['Başkent Kart kabul denetim sonuçlarını kontrol et.', 'Daire Başkanlığına sunulacak yönetici özetini hazırla.'],
            scripts: ['baskent_kart_kabul_denetim.mjs'],
            assets: {
              'baskent-kart-3-yillik-evrak-kayitlari.json': JSON.stringify(generateBaskentKart3YearDataset(), null, 2),
            },
          },
        ],
      },
      {
        slug: 'proje-yonetimi-ekip-lideri',
        title: 'Proje Yönetimi Ekibi — Kıdemli Proje Yöneticisi (Ekip Lideri)',
        head: false,
        mission: 'Akıllı Şehirler Şube Müdürlüğü altındaki Proje Yönetimi Ekibinin koordinasyonunu sağlar. Başkent Kart başta olmak üzere belediyenin dijital dönüşüm projelerinin zaman, bütçe, şartname ve kabul süreçlerini denetler.',
        rules: [
          'Proje Yönetimi Ekibindeki iş dağılımını ve ihale kapanış takvimini takip et.',
        ],
        skills: [
          {
            name: 'ekip-gorev-ve-kabul-takibi',
            description: 'Proje Yönetimi Ekibinin açık görevlerini ve Başkent Kart kabul takvimini raporlar.',
            triggers: ['proje yönetimi ekibi', 'ekip durumu', 'kabul takvimi'],
            args: [['$EKIP', 'Proje Yönetimi Ekibi']],
            steps: ['`scripts/kritik_yol_hesapla.mjs` ile kapanış adımlarını hesapla.', 'Eksik teslimatları listele.'],
            scripts: ['kritik_yol_hesapla.mjs'],
          },
        ],
      },
      {
        slug: 'baskent-kart-mali-evrak-denetcisi',
        title: 'Proje Yönetimi Ekibi — Başkent Kart Fatura, Dekont ve Hak Ediş Kontrol Uzmanı',
        head: false,
        mission: 'Proje Yönetimi Ekibi içerisinde Başkent Kart projesinin 36 aylık fatura, banka dekontu, sosyal yardım bakiye yükleme dekontları ve market/üye işyeri POS takas cetvellerinin çapraz mali kontrolünü yapar.',
        rules: [
          'Her ayın faturası ile banka ödeme dekontunu TL/kuruş bazında karşılaştır.',
          'Eksik dekont veya tutar farkı bulunan ayları (`2023-08`, `2024-03`, `2025-10` vb.) derhal raporla.',
        ],
        skills: [
          {
            name: 'fatura-dekont-capraz-mutabakat',
            description: '36 aylık Başkent Kart fatura ve banka dekontlarını çapraz kontrol ederek kuruş farklarını ve eksik dosyaları bulur.',
            triggers: ['fatura dekont', 'mutabakat', 'tutar farkı', 'hak ediş kontrolü'],
            args: [['$YIL', 'Denetim yılı (1, 2, 3 veya Tümü)']],
            steps: ['`scripts/baskent_kart_kabul_denetim.mjs` betiğini çalıştır.', 'Fatura-Dekont fark tablosunu üret.'],
            scripts: ['baskent_kart_kabul_denetim.mjs'],
            assets: {
              'baskent-kart-3-yillik-evrak-kayitlari.json': JSON.stringify(generateBaskentKart3YearDataset(), null, 2),
            },
          },
        ],
      },
      {
        slug: 'baskent-kart-kontrol-ajani',
        title: 'Proje Yönetimi Ekibi — Başkent Kart Kontrol Ajanı',
        head: false,
        mission: 'Başkent Kart projesinde ilgili evrakların, yüklenici işlemlerinin, linklerdeki son kullanıcılara yapılan ödemelerin, Başkent Kart hareketlerinin ve şüpheli işlemlerin uçtan uca kontrolünü yapar ve denetim raporu üretir.',
        rules: [
          'Linklerdeki son kullanıcı ödeme logları ile banka dekontları arasında kuruş farkı veya mükerrer/şüpheli işlem tespit edersen Kabul Ajanına blokaj raporu gönder.',
          'Tüm fatura, dekont, POS mutabakat ve SGK/vergi evraklarını eksiksiz doğrulamadan kontrol onayını verme.',
        ],
        skills: [
          {
            name: 'baskent-kart-kontrol-ve-supheli-islem-taramasi',
            description: 'Evrakları, linklerdeki son kullanıcı ödemelerini, Başkent Kart işlemlerini ve şüpheli hareketleri tarayıp kontrol raporu üretir.',
            triggers: ['kontrol ajanı', 'şüpheli işlem', 'son kullanıcı ödeme', 'evrak kontrol', 'başkent kart kontrol'],
            args: [['$DONEM', 'Kontrol dönemi veya link']],
            steps: ['İlgili evrak, dekont ve son kullanıcı ödeme linklerini tara.', 'Şüpheli işlemleri işaretleyip Kabul Ajanı için kontrol raporu oluştur.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'baskent-kart-kabul-ajani',
        title: 'Proje Yönetimi Ekibi — Başkent Kart Kabul Ajanı',
        head: false,
        mission: 'Kontrol Ajanının çıkardığı tüm raporları ve Google Drive, harici linkler veya bilgisayardaki fiziksel klasörlerdeki dosyaları çapraz kontrol ederek Başkent Kart ihale kapanışı ve kesin kabulünü gerçekleştirir.',
        rules: [
          'Kontrol Ajanının raporu tamamlanmadan ve Drive / link / fiziksel klasör dosyaları doğrulanmadan kesin kabul tutanağı düzenleme.',
          'Açık şüpheli işlem veya eksik belge varken sadece şartlı/eksik listesi raporu üret.',
        ],
        skills: [
          {
            name: 'baskent-kart-kesin-kabul-dogrulama',
            description: 'Kontrol Ajanı raporlarını ve Drive / link / fiziksel klasörlerdeki dosyaları kontrol edip kesin kabulü tamamlar.',
            triggers: ['kabul ajanı', 'kesin kabul', 'drive kontrol', 'klasör kontrol', 'kabul tutanağı'],
            args: [['$KAYNAK', 'Drive / Link / Fiziksel Klasör']],
            steps: ['Kontrol Ajanı raporunu ve Drive/link/fiziksel klasör dosyalarını eşleştir.', 'Kesin kabul kararını ve ihale kapanış tutanağını oluştur.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'proje-sartname-ve-ihale-ajani',
        title: 'Proje Yönetimi Ekibi — Teknik & İdari Şartname ve İhale Süreci Alt Ajanı',
        head: false,
        mission: 'Proje Yönetimi departmanındaki tüm projeler (Başkent Kart, MucitHub, Başkent Ailem, MucitLab) için teknik şartname, idari şartname, ihale evrakları ve ihale süreçlerini hazırlar ve takip eder.',
        rules: [
          '4734 ve 4735 sayılı Kamu İhale Kanunlarına uygun teknik ve idari şartname maddeleri oluştur.',
          'Her projenin teknik isterlerini, SLA hedeflerini ve kabul kriterlerini şartname taslağına eksiksiz işle.',
        ],
        skills: [
          {
            name: 'teknik-idari-sartname-ve-ihale-hazirligi',
            description: 'Projeler için teknik şartname, idari şartname ve EKAP/ihale evrak setini hazırlar.',
            triggers: ['teknik şartname', 'idari şartname', 'ihale evrakı', 'ihale süreci', 'zeyilname'],
            args: [['$PROJE', 'Proje adı']],
            steps: ['Proje isterlerini ve bütçe kalemlerini analiz et.', 'Teknik Şartname, İdari Şartname ve İhale Evrak setini oluştur.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'proje-hakedis-odeme-ajani',
        title: 'Proje Yönetimi Ekibi — Hak Ediş & Ödeme Süreçleri Alt Ajanı',
        head: false,
        mission: 'Tüm projelerin dönemsel hak ediş dosyalarını, fatura/dekont eşleştirmelerini, SLA kesintilerini ve ödeme emri süreçlerini hazırlar.',
        rules: [
          'İlgili projenin Kontrol ve Kabul onayları tamamlanmadan hak ediş ödeme emri üretme.',
        ],
        skills: [
          {
            name: 'hakedis-ve-odeme-sureci-hazirlama',
            description: 'Projelerin aylık hak ediş hesaplarını, kesintilerini ve ödeme onay dosyalarını hazırlar.',
            triggers: ['hak ediş', 'hakediş', 'ödeme süreci', 'ödeme emri'],
            args: [['$PROJE', 'Proje adı']],
            steps: ['Kabul raporunu ve dönemsel faturaları kontrol et.', 'Hak ediş ödeme icmalini hazırla.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'mucithub-iot-farm-yoneticisi',
        title: 'Proje Yönetimi Ekibi — MucitHub (100 Cihazlı IoT Yönetimi) Proje Yöneticisi',
        head: false,
        mission: 'IoT Yönetimi Stili kapsamında MucitHub projesini yönetir. İlgili dosyaları ve içerikleri uygun formatlarda hazırlar, 100 adet IoT cihazına gönderir, cihazlar çalışırken sensör verileri ve kamera görüntü işleme (CV) ile süreci takip eder, işlem bitince çıktıları paketler, dosyalar ve ilgili son kullanıcılara gönderir.',
        rules: [
          'Kamera görüntü işlemede (CV) veya sensör telemetrisinde anomali tespit edilen IoT cihazını derhal duraklat ve yedek cihaza aktar.',
          'İşlemi biten çıktıları paketleme, dosyalama (arşivleme) ve son kullanıcı sevkiyat kontrolünden geçirmeden hak ediş onayı verme.',
        ],
        skills: [
          {
            name: 'mucithub-100-iot-cihaz-yonetimi',
            description: '100 adet IoT cihazındaki dosya formatlama, gönderim, sensör ve kamera görüntü işleme takibi ile paketleme, dosyalama ve son kullanıcı sevkiyatını denetler.',
            triggers: ['mucithub', 'iot', 'görüntü işleme', 'sensör', 'paketleme', 'dosyalama', 'sevkiyat'],
            args: [['$BLOK', 'IoT cihaz bloğu (A, B, C, D veya Tümü)']],
            steps: ['100 IoT cihazının sensör ve kamera görüntü işleme durumunu tara.', 'Anomali tespit edilen cihazları ve paketleme/dosyalama/sevkiyat bekleyen çıktıları raporla.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'baskent-ailem-proje-sorumlusu',
        title: 'Proje Yönetimi Ekibi — Başkent Ailem Mobil Uygulama Proje Sorumlusu',
        head: false,
        mission: 'Proje Stili 3 (Çift Taraflı Mobil Uygulama & Son Kullanıcı Takip Yönetimi) kapsamında Başkent Ailem projesini yönetir. Anne-Baba ve Çocuk mobil uygulamalarının eşleşme/takip sağlığını, son kullanıcı sorunlarını, eklenen görsel/video/evrakları, hak ediş ödemelerini ve muhatap firma/aile iletişimini yürütür.',
        rules: [
          'Anne-Baba ve Çocuk uygulamaları arasındaki bildirim veya konum senkronizasyon hatalarını önceliklendir.',
          'Tüm son kullanıcı destek kayıtları ve muhatap firma düzeltmeleri kapanmadan aylık hak edişi onaylama.',
        ],
        skills: [
          {
            name: 'baskent-ailem-son-kullanici-denetimi',
            description: 'Başkent Ailem Anne-Baba ve Çocuk mobil uygulamalarındaki son kullanıcı sorunlarını, medya/evrak kontrollerini ve muhatap iletişim süreçlerini raporlar.',
            triggers: ['başkent ailem', 'anne baba', 'çocuk uygulaması', 'mobil uygulama', 'son kullanıcı'],
            args: [['$DURUM', 'Kontrol kapsamı']],
            steps: ['Anne-Baba & Çocuk uygulama eşleşme loglarını incele.', 'Açık son kullanıcı sorunlarını ve muhatap firma çözüm durumunu raporla.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'mucitlab-egitim-koordinatoru',
        title: 'Proje Yönetimi Ekibi — MucitLab (IoT, Sanat & İletişim) Eğitim Koordinatörü',
        head: false,
        mission: 'Proje Stili 4 (Uygulamalı Eğitim & Atölye Yönetimi) kapsamında MucitLab projesini yönetir. Çocuklara yönelik IoT, Sanat ve İletişim atölyelerini, öğrenci görsel/video/ödev dosyalarının kontrolünü, MucitHub IoT cihazı çıktı entegrasyonunu, hak ediş ödemelerini ve veli/muhatap iletişimini yönetir.',
        rules: [
          'Çocukların yüklediği görsel, video ve proje dosyalarını pedagojik ve güvenlik açısından kontrol et.',
          'Sanat ve IoT atölyesi çıktılarını MucitHub IoT Cihazları Yönetimi ekibiyle koordine et.',
        ],
        skills: [
          {
            name: 'mucitlab-atolye-ve-medya-kontrol',
            description: 'MucitLab IoT, Sanat ve İletişim atölyelerindeki eğitim oturumlarını, görsel/video ödev kontrollerini ve hak ediş/veli iletişimini yönetir.',
            triggers: ['mucitlab', 'çocuk eğitim', 'sanat atölyesi', 'iot eğitimi', 'iletişim atölyesi'],
            args: [['$ATOLYE', 'Atölye kodu']],
            steps: ['Aktif atölye gruplarını ve bekleyen görsel/video ödevlerini kontrol et.', 'Hak ediş ve veli bilgilendirme özetini üret.'],
            scripts: [],
          },
        ],
      },
    ],
  },
  {
    no: '02',
    slug: '02-Yazilim-ve-Uygulama-Gelistirme-Sube-Mudurlugu',
    name: 'Yazılım ve Uygulama Geliştirme Şube Müdürlüğü',
    emoji: '💻',
    color: '#0f766e',
    keywords: ['yazılım', 'uygulama', 'api', 'pos entegrasyon', 'kaynak kod', 'veritabanı devir', 'mobil uygulama'],
    tools: ['Yerel Git & Kod Analiz Motoru (Offline)', 'SQLite'],
    tables: ['projects', 'project_tasks', 'features'],
    deptRules: [
      'İhale kapanışlarında yüklenici firmaların geliştirdiği modüllerin kaynak kod, API dokümantasyonu ve veritabanı şeması teslim tutanaklarını doğrula.',
    ],
    personnel: [
      {
        slug: 'yazilim-sube-muduru',
        title: 'Yazılım ve Uygulama Geliştirme Şube Müdürü',
        head: true,
        mission: 'Belediye yazılımlarının, sosyal yardım entegrasyonlarının ve Başkent Kart kaynak kod/veritabanı devir süreçlerinin teknik uygunluğunu yönetir.',
        rules: ['Kaynak kod ve veritabanı devir tutanağı (TS-06) teslim alınmadan teknik uygunluk verme.'],
        skills: [
          {
            name: 'kaynak-kod-ve-log-devir-denetimi',
            description: 'Başkent Kart 3 yıllık işlem kütüklerinin (log) ve veritabanı şemalarının ABB sistemlerine devrini denetler.',
            triggers: ['kaynak kod', 'veritabanı devir', 'log teslim', 'api entegrasyon'],
            args: [['$MODUL', 'Denetlenecek yazılım modülü']],
            steps: ['`scripts/veri_topla.mjs` ile teslim edilen teknik dokümanları tara.', 'Eksik devir tutanaklarını raporla.'],
            scripts: ['veri_topla.mjs'],
          },
        ],
      },
      {
        slug: 'baskent-kart-entegrasyon-mimari',
        title: 'Başkent Kart & Sosyal Yardım API / POS Entegrasyon Mimarı',
        head: false,
        mission: 'Başkent Kart sisteminin Sosyal Hizmetler Dairesi, banka provizyon sistemi ve anlaşmalı market POS cihazları arasındaki entegrasyon mimarisini denetler.',
        rules: ['POS ve kart provizyon API sürekliliğini kontrol et.'],
        skills: [
          {
            name: 'pos-ve-provizyon-mimari-kontrol',
            description: 'Market POS ve sosyal yardım bakiye yükleme akışlarının teknik şartnameye uygunluğunu inceler.',
            triggers: ['pos', 'provizyon', 'market alışveriş', 'bakiye yükleme'],
            args: [['$AKIS', 'Entegrasyon akışı']],
            steps: ['`scripts/mermaid_render.mjs` ile kart provizyon mimarisini doğrula.'],
            scripts: ['mermaid_render.mjs'],
          },
        ],
      },
    ],
  },
  {
    no: '03',
    slug: '03-Sistem-Ag-ve-Veri-Merkezi-Sube-Mudurlugu',
    name: 'Sistem, Ağ ve Veri Merkezi Şube Müdürlüğü',
    emoji: '🖥️',
    color: '#0369a1',
    keywords: ['sistem', 'ağ', 'veri merkezi', 'sunucu', 'sla', 'uptime', 'yedekleme', 'log'],
    tools: ['Yerel SLA & Yük Test Motoru (Offline)'],
    tables: ['projects', 'expenses'],
    deptRules: [
      'Teknik şartnamede belirtilen %99.90 aylık çalışma süresi (SLA Uptime) altındaki her ay için ceza tutanağı düzenle.',
    ],
    personnel: [
      {
        slug: 'sistem-ag-sube-muduru',
        title: 'Sistem, Ağ ve Veri Merkezi Şube Müdürü',
        head: true,
        mission: 'ABB Veri Merkezi altyapısını, sunucu sürekliliğini ve Başkent Kart 36 aylık SLA (%99.90 uptime) performans raporlarını denetler.',
        rules: ['SLA oranı %99.90 altında kalan ayları (örn. 2025-06 %99.42) Akıllı Şehirler Şube Müdürlüğüne bildir.'],
        skills: [
          {
            name: 'sla-ve-sistem-sureklilik-denetimi',
            description: '36 aylık sunucu ve kart provizyon SLA raporlarını teknik şartname eşikleriyle karşılaştırır.',
            triggers: ['sla', 'uptime', 'sistem sürekliliği', 'kesinti', 'veri merkezi'],
            args: [['$HEDEF_URL', 'Yerel servis adresi']],
            steps: ['`scripts/load_test.mjs` ve SLA kayıtlarını kontrol et.', 'SLA ihlali olan ayları ve ceza tutarlarını listele.'],
            scripts: ['load_test.mjs'],
          },
        ],
      },
    ],
  },
  {
    no: '04',
    slug: '04-Siber-Guvenlik-ve-Bilgi-Guvenligi-Sube-Mudurlugu',
    name: 'Siber Güvenlik ve Bilgi Güvenliği Şube Müdürlüğü',
    emoji: '🛡️',
    color: '#b91c1c',
    keywords: ['siber güvenlik', 'kvkk', 'pci-dss', 'sızma testi', 'penetrasyon', 'bilgi güvenliği', 'iso 27001'],
    tools: ['Yerel SAST & KVKK Denetim Motoru (Offline)'],
    tables: ['contracts', 'projects'],
    deptRules: [
      'Sosyal yardım alan vatandaşların T.C. Kimlik, telefon, adres ve Başkent Kart harcama verileri KVKK kapsamında maskelenmeden işlenemez.',
      'Her sözleşme yılı için bağımsız sızma (penetrasyon) testi ve PCI-DSS sertifikası zorunludur.',
    ],
    personnel: [
      {
        slug: 'siber-guvenlik-sube-muduru',
        title: 'Siber Güvenlik ve Bilgi Güvenliği Şube Müdürü',
        head: true,
        mission: 'Bilgi İşlem Dairesi Başkanlığının siber güvenlik, SOME, ISO 27001, KVKK ve Başkent Kart PCI-DSS güvenlik denetimlerini yürütür.',
        rules: ['Kritik güvenlik bulgusu veya açıkta kimlik verisi varsa kabul işlemini durdur.'],
        skills: [
          {
            name: 'baskent-kart-guvenlik-ve-kvkk-taramasi',
            description: 'İhale kapanış dosyalarında gömülü şifre, siber güvenlik zafiyeti ve KVKK kişisel veri uyumluluğunu offline tarar.',
            triggers: ['güvenlik taraması', 'kvkk', 'pci-dss', 'sızma testi', 'penetrasyon'],
            args: [['$HEDEF_DIZIN', 'Taranacak dizin']],
            steps: ['`scripts/sast_tara.mjs` betiğini çalıştır.', 'Güvenlik ve KVKK bulgularını raporla.'],
            scripts: ['sast_tara.mjs'],
          },
        ],
      },
    ],
  },
  {
    no: '05',
    slug: '05-Idari-Mali-Isler-ve-Ihale-Sube-Mudurlugu',
    name: 'İdari, Mali İşler ve İhale Takip Şube Müdürlüğü',
    emoji: '🏛️',
    color: '#7c3aed',
    keywords: ['idari mali işler', 'ihale', '4734', '4735', 'kesin kabul', 'hak ediş', 'teminat', 'sgk borcu yoktur'],
    tools: ['Yerel Mali & Hak Ediş Hesaplama Motoru (Offline)'],
    tables: ['invoices', 'expenses', 'contracts', 'customers'],
    deptRules: [
      '4734 ve 4735 sayılı Kamu İhale Kanunları ile Hizmet Alımları Muayene ve Kabul Yönetmeliği hükümlerine tam uyum zorunludur.',
      'SGK İlişiksizlik Belgesi, Vergi Borcu Yoktur yazısı ve 36 aylık tam fatura/dekont mutabakatı olmadan kesin teminat iade edilemez.',
    ],
    personnel: [
      {
        slug: 'idari-mali-isler-sube-muduru',
        title: 'İdari, Mali İşler ve İhale Takip Şube Müdürü',
        head: true,
        mission: 'Bilgi İşlem Dairesi Başkanlığının ihale, hak ediş, bütçe, kesin teminat ve kesin kabul resmi yazışmalarını yönetir.',
        rules: ['Akıllı Şehirler Şube Müdürlüğü Proje Yönetimi Ekibinin teknik kabul onayı olmadan mali kapanış yapma.'],
        skills: [
          {
            name: 'ihale-kesin-kabul-mali-raporu',
            description: '36 aylık Başkent Kart ihale hak ediş toplamlarını, SGK/vergi belgelerini ve kesin kabul mali şartlarını denetler.',
            triggers: ['hak ediş', 'kesin kabul', 'ihale mali rapor', 'teminat iadesi', 'sgk'],
            args: [['$DONEM', 'İhale dönemi']],
            steps: ['`scripts/baskent_kart_kabul_denetim.mjs` ile 36 aylık mali tabloyu doğrula.', 'Kesin kabul mali uygunluk veya ihtar kararını yaz.'],
            scripts: ['baskent_kart_kabul_denetim.mjs'],
            assets: {
              'baskent-kart-3-yillik-evrak-kayitlari.json': JSON.stringify(generateBaskentKart3YearDataset(), null, 2),
            },
          },
        ],
      },
      {
        slug: 'baskent-kart-kontrol-ajani',
        title: 'Proje Yönetimi Ekibi — Başkent Kart Kontrol Ajanı',
        head: false,
        mission: 'Başkent Kart projesinde ilgili evrakların, yüklenici işlemlerinin, linklerdeki son kullanıcılara yapılan ödemelerin, Başkent Kart hareketlerinin ve şüpheli işlemlerin uçtan uca kontrolünü yapar ve denetim raporu üretir.',
        rules: [
          'Linklerdeki son kullanıcı ödeme logları ile banka dekontları arasında kuruş farkı veya mükerrer/şüpheli işlem tespit edersen Kabul Ajanına blokaj raporu gönder.',
          'Tüm fatura, dekont, POS mutabakat ve SGK/vergi evraklarını eksiksiz doğrulamadan kontrol onayını verme.',
        ],
        skills: [
          {
            name: 'baskent-kart-kontrol-ve-supheli-islem-taramasi',
            description: 'Evrakları, linklerdeki son kullanıcı ödemelerini, Başkent Kart işlemlerini ve şüpheli hareketleri tarayıp kontrol raporu üretir.',
            triggers: ['kontrol ajanı', 'şüpheli işlem', 'son kullanıcı ödeme', 'evrak kontrol', 'başkent kart kontrol'],
            args: [['$DONEM', 'Kontrol dönemi veya link']],
            steps: ['İlgili evrak, dekont ve son kullanıcı ödeme linklerini tara.', 'Şüpheli işlemleri işaretleyip Kabul Ajanı için kontrol raporu oluştur.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'baskent-kart-kabul-ajani',
        title: 'Proje Yönetimi Ekibi — Başkent Kart Kabul Ajanı',
        head: false,
        mission: 'Kontrol Ajanının çıkardığı tüm raporları ve Google Drive, harici linkler veya bilgisayardaki fiziksel klasörlerdeki dosyaları çapraz kontrol ederek Başkent Kart ihale kapanışı ve kesin kabulünü gerçekleştirir.',
        rules: [
          'Kontrol Ajanının raporu tamamlanmadan ve Drive / link / fiziksel klasör dosyaları doğrulanmadan kesin kabul tutanağı düzenleme.',
          'Açık şüpheli işlem veya eksik belge varken sadece şartlı/eksik listesi raporu üret.',
        ],
        skills: [
          {
            name: 'baskent-kart-kesin-kabul-dogrulama',
            description: 'Kontrol Ajanı raporlarını ve Drive / link / fiziksel klasörlerdeki dosyaları kontrol edip kesin kabulü tamamlar.',
            triggers: ['kabul ajanı', 'kesin kabul', 'drive kontrol', 'klasör kontrol', 'kabul tutanağı'],
            args: [['$KAYNAK', 'Drive / Link / Fiziksel Klasör']],
            steps: ['Kontrol Ajanı raporunu ve Drive/link/fiziksel klasör dosyalarını eşleştir.', 'Kesin kabul kararını ve ihale kapanış tutanağını oluştur.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'proje-sartname-ve-ihale-ajani',
        title: 'Proje Yönetimi Ekibi — Teknik & İdari Şartname ve İhale Süreci Alt Ajanı',
        head: false,
        mission: 'Proje Yönetimi departmanındaki tüm projeler (Başkent Kart, MucitHub, Başkent Ailem, MucitLab) için teknik şartname, idari şartname, ihale evrakları ve ihale süreçlerini hazırlar ve takip eder.',
        rules: [
          '4734 ve 4735 sayılı Kamu İhale Kanunlarına uygun teknik ve idari şartname maddeleri oluştur.',
          'Her projenin teknik isterlerini, SLA hedeflerini ve kabul kriterlerini şartname taslağına eksiksiz işle.',
        ],
        skills: [
          {
            name: 'teknik-idari-sartname-ve-ihale-hazirligi',
            description: 'Projeler için teknik şartname, idari şartname ve EKAP/ihale evrak setini hazırlar.',
            triggers: ['teknik şartname', 'idari şartname', 'ihale evrakı', 'ihale süreci', 'zeyilname'],
            args: [['$PROJE', 'Proje adı']],
            steps: ['Proje isterlerini ve bütçe kalemlerini analiz et.', 'Teknik Şartname, İdari Şartname ve İhale Evrak setini oluştur.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'proje-hakedis-odeme-ajani',
        title: 'Proje Yönetimi Ekibi — Hak Ediş & Ödeme Süreçleri Alt Ajanı',
        head: false,
        mission: 'Tüm projelerin dönemsel hak ediş dosyalarını, fatura/dekont eşleştirmelerini, SLA kesintilerini ve ödeme emri süreçlerini hazırlar.',
        rules: [
          'İlgili projenin Kontrol ve Kabul onayları tamamlanmadan hak ediş ödeme emri üretme.',
        ],
        skills: [
          {
            name: 'hakedis-ve-odeme-sureci-hazirlama',
            description: 'Projelerin aylık hak ediş hesaplarını, kesintilerini ve ödeme onay dosyalarını hazırlar.',
            triggers: ['hak ediş', 'hakediş', 'ödeme süreci', 'ödeme emri'],
            args: [['$PROJE', 'Proje adı']],
            steps: ['Kabul raporunu ve dönemsel faturaları kontrol et.', 'Hak ediş ödeme icmalini hazırla.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'mucithub-iot-farm-yoneticisi',
        title: 'Proje Yönetimi Ekibi — MucitHub (100 Cihazlı IoT Yönetimi) Proje Yöneticisi',
        head: false,
        mission: 'IoT Yönetimi Stili kapsamında MucitHub projesini yönetir. İlgili dosyaları ve içerikleri uygun formatlarda hazırlar, 100 adet IoT cihazına gönderir, cihazlar çalışırken sensör verileri ve kamera görüntü işleme (CV) ile süreci takip eder, işlem bitince çıktıları paketler, dosyalar ve ilgili son kullanıcılara gönderir.',
        rules: [
          'Kamera görüntü işlemede (CV) veya sensör telemetrisinde anomali tespit edilen IoT cihazını derhal duraklat ve yedek cihaza aktar.',
          'İşlemi biten çıktıları paketleme, dosyalama (arşivleme) ve son kullanıcı sevkiyat kontrolünden geçirmeden hak ediş onayı verme.',
        ],
        skills: [
          {
            name: 'mucithub-100-iot-cihaz-yonetimi',
            description: '100 adet IoT cihazındaki dosya formatlama, gönderim, sensör ve kamera görüntü işleme takibi ile paketleme, dosyalama ve son kullanıcı sevkiyatını denetler.',
            triggers: ['mucithub', 'iot', 'görüntü işleme', 'sensör', 'paketleme', 'dosyalama', 'sevkiyat'],
            args: [['$BLOK', 'IoT cihaz bloğu (A, B, C, D veya Tümü)']],
            steps: ['100 IoT cihazının sensör ve kamera görüntü işleme durumunu tara.', 'Anomali tespit edilen cihazları ve paketleme/dosyalama/sevkiyat bekleyen çıktıları raporla.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'baskent-ailem-proje-sorumlusu',
        title: 'Proje Yönetimi Ekibi — Başkent Ailem Mobil Uygulama Proje Sorumlusu',
        head: false,
        mission: 'Proje Stili 3 (Çift Taraflı Mobil Uygulama & Son Kullanıcı Takip Yönetimi) kapsamında Başkent Ailem projesini yönetir. Anne-Baba ve Çocuk mobil uygulamalarının eşleşme/takip sağlığını, son kullanıcı sorunlarını, eklenen görsel/video/evrakları, hak ediş ödemelerini ve muhatap firma/aile iletişimini yürütür.',
        rules: [
          'Anne-Baba ve Çocuk uygulamaları arasındaki bildirim veya konum senkronizasyon hatalarını önceliklendir.',
          'Tüm son kullanıcı destek kayıtları ve muhatap firma düzeltmeleri kapanmadan aylık hak edişi onaylama.',
        ],
        skills: [
          {
            name: 'baskent-ailem-son-kullanici-denetimi',
            description: 'Başkent Ailem Anne-Baba ve Çocuk mobil uygulamalarındaki son kullanıcı sorunlarını, medya/evrak kontrollerini ve muhatap iletişim süreçlerini raporlar.',
            triggers: ['başkent ailem', 'anne baba', 'çocuk uygulaması', 'mobil uygulama', 'son kullanıcı'],
            args: [['$DURUM', 'Kontrol kapsamı']],
            steps: ['Anne-Baba & Çocuk uygulama eşleşme loglarını incele.', 'Açık son kullanıcı sorunlarını ve muhatap firma çözüm durumunu raporla.'],
            scripts: [],
          },
        ],
      },
      {
        slug: 'mucitlab-egitim-koordinatoru',
        title: 'Proje Yönetimi Ekibi — MucitLab (IoT, Sanat & İletişim) Eğitim Koordinatörü',
        head: false,
        mission: 'Proje Stili 4 (Uygulamalı Eğitim & Atölye Yönetimi) kapsamında MucitLab projesini yönetir. Çocuklara yönelik IoT, Sanat ve İletişim atölyelerini, öğrenci görsel/video/ödev dosyalarının kontrolünü, MucitHub IoT cihazı çıktı entegrasyonunu, hak ediş ödemelerini ve veli/muhatap iletişimini yönetir.',
        rules: [
          'Çocukların yüklediği görsel, video ve proje dosyalarını pedagojik ve güvenlik açısından kontrol et.',
          'Sanat ve IoT atölyesi çıktılarını MucitHub IoT Cihazları Yönetimi ekibiyle koordine et.',
        ],
        skills: [
          {
            name: 'mucitlab-atolye-ve-medya-kontrol',
            description: 'MucitLab IoT, Sanat ve İletişim atölyelerindeki eğitim oturumlarını, görsel/video ödev kontrollerini ve hak ediş/veli iletişimini yönetir.',
            triggers: ['mucitlab', 'çocuk eğitim', 'sanat atölyesi', 'iot eğitimi', 'iletişim atölyesi'],
            args: [['$ATOLYE', 'Atölye kodu']],
            steps: ['Aktif atölye gruplarını ve bekleyen görsel/video ödevlerini kontrol et.', 'Hak ediş ve veli bilgilendirme özetini üret.'],
            scripts: [],
          },
        ],
      },
    ],
  },
];
