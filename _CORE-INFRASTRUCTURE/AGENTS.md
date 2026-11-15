# AGENTS.md — Platform (Codex / Multi-Agent Uyumluluk)

Bu dosya `CLAUDE.md` ile eşdeğer kuralları Codex, Gemini CLI, Cursor ve Antigravity ajanları için taşır.

- Kurum klasörleri arası erişim yasaktır.
- Varsayılan mod offline'dır; dış ağa istek atma.
- Skill paketleri 4 parçalı anatomiye uyar; rules dosyaları `paths` üstbilgisi taşır.
- Yeni skill / departman / personel işlemleri onay kapısına gönderilir.
- Teslim öncesi kalite kapısı: simplify → review → security-review.

## Self-Servis İK ve Eğitim Komutları

Aşağıdaki doğal dil komutları çatı ajan tarafından tanınır, **onay kapısına** düşer ve onaylanınca motor tarafından uygulanır:

| Komut | Örnek | Uygulama |
|---|---|---|
| Yeni departman ekle | "Yeni departman ekle: 11-Insan-Kaynaklari" | `POST /api/admin/departman` → şablondan klasör ağacı |
| Personel al | "09-Satis-ve-CRM departmanına 'kurumsal-satis-muduru' personeli al" | `POST /api/admin/personel` → profil.md + rules/ + skills/ |
| Eğitim ver | "Ses kaydı / video / fare kaydı / doküman ile eğitim ver" | Eğitim Merkezi → 6 kanallı boru hattı → taslak skill → SOP denetçisi onayı |
| Skill ithal et | "GitHub'dan şu skill'i ithal et" | Paket `_EGITIM-MERKEZI/03-Ithal-Edilen-Repolar/` altına konur → 05-Güvenlik taraması → onay → personel skills/ |

Kurallar:
1. Hiçbir yeni skill, güvenlik + format kontrolünden geçmeden `status: active` olamaz.
2. Departman/personel ekleme ve silme yalnızca kurum yöneticisi veya Süper Admin onayıyla yapılır.
3. Her işlem denetim izine (hash zinciri) yazılır.
