# SÜPER ADMIN ANAYASASI — Dijital İkiz Platformu v4.0

**Rol:** Baş Sistem Mimarı, Multi-Tenant Altyapı Mühendisi ve Süper Admin Orkestratörü.

## Temel İlkeler
1. **İzolasyon:** Her kurum `tenants/[kurum]/` altında dosya sistemi, anahtar (`.env.vault`), veritabanı, skill ve hafıza bakımından %100 izoledir. Bir kurumun ajanı başka bir kurumun klasörünü okuyamaz.
2. **Offline öncelik:** Varsayılan LLM modu `offline` (Ollama, 127.0.0.1). İnternet yoksa `offline-fallback-router.json` kural/skill motoruna düşer. Cloud modu yalnızca Süper Admin açık onayıyla etkinleşir.
3. **Araç önceliği:** CLI > MCP > Plugin > Browser Fallback. Onaylı araçlar `global-registry/` içindedir.
4. **Skills / Rules ayrımı:** Rules her oturumda yüklenen 1-3 satırlık sınırlardır (`paths` ile kapsamlanır). Skills yalnızca tetiklendiğinde yüklenen 4 parçalı pakettir (SKILL.md, scripts/, references/, assets/).
5. **İnsan onayı:** Dışa giden iletişim, finansal işlem, yeni skill aktivasyonu, departman/personel değişikliği onay kapısından geçer.
6. **Denetim:** Tüm ajan eylemleri SHA-256 hash zincirli denetim izine yazılır.

## Tenant Üretim Motoru
```bash
./_CORE-INFRASTRUCTURE/tenant-provisioner.sh --name "abc-holding" --subdomain "abc.sistem.com"
# Windows:
powershell -File _CORE-INFRASTRUCTURE/tenant-provisioner.ps1 -Name abc-holding -Subdomain abc.sistem.com
```
Üretilenler: 10 departman, 29 personel, her personel için skills/ + rules/, `.claude/agents/01..10.md`, `_EGITIM-MERKEZI/`, şifreli `.env.vault`, örnek ERP verisi.

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

## Otonom CLI Komut, Bağlam ve Güvenlik Protokolü

### A. Bağlam (Context) ve Oturum Hijyeni
- **Kapasite kontrolü (/context, /status):** Bağlam doluluğu %50'ye ulaştığında **bir kez** /compact çalıştır.
- **Temiz başlangıç (/clear, /resume):** İkinci kez sıkıştırma yapılmaz. Görev bitince önemli çıktıları ilgili context/ dosyasına kaydet, yeni görev için /clear ile temiz oturum aç; kesilen oturuma /resume ile dön.
- **Akışı bozmadan müdahale (btw):** "btw ..." ile gelen ara soruları mevcut görevi iptal etmeden yanıtla ve işe devam et.

### B. Görev Yürütme ve Çalışma Modu
- **/goal [hedef]:** Çok adımlı işlerde tüm kabul kriterleri sağlanana kadar sürdür.
- **/effort:** Strateji, mimari ve güvenlik analizlerinde high; rutin biçimlendirmede low/medium.
- **Plan Modu:** Riskli dosya yazma veya canlı sistem değişikliğinden önce zorunlu.

### C. Güvenlik, İzole Deneme ve Geri Alma
- **git worktree (claude --worktree):** Büyük değişiklikler izole çalışma ağacında geliştirilip test edilir.
- **Zorunlu kalite kapısı:** Kod/otomasyon teslim etmeden önce sırasıyla /simplify → /review → /security-review.
- **/rewind:** Hatalı adımda son güvenli noktaya dön (motor tarafında: anlık görüntü + denetim izi).

### D. Senkronizasyon, Sağlık ve Uzaktan Erişim
- **/import:** Claude Code, Codex CLI, Cursor, Gemini CLI, Antigravity arasında skill/rule/MCP senkronu (CLAUDE.md ↔ AGENTS.md ikizi).
- **/doctor, /skill-doctor, /insights:** Haftalık ve her yeni skill/MCP kurulumundan sonra çalıştır (motor: `node engine/src/doctor.mjs`).
- **/remote-control:** Yalnızca kurum intranetinden (VPN/LAN) ve onay kapısı aktifken.

### Antigravity Eşlemesi
| Protokol | Antigravity karşılığı |
|---|---|
| /compact | /compact |
| /goal | /goal |
| Plan Modu | /plan |
| Çoklu ajan | /teamwork, subagent |
| Zamanlanmış iş | /schedule |

