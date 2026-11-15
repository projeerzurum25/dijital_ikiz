// Anayasa (CLAUDE.md / AGENTS.md), kural ve skill dosyası metin üreticileri.
import { DEPARTMENTS } from './catalog/departments.mjs';

export const CLI_PROTOCOL = `## Otonom CLI Komut, Bağlam ve Güvenlik Protokolü

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
- **/doctor, /skill-doctor, /insights:** Haftalık ve her yeni skill/MCP kurulumundan sonra çalıştır (motor: \`node engine/src/doctor.mjs\`).
- **/remote-control:** Yalnızca kurum intranetinden (VPN/LAN) ve onay kapısı aktifken.

### Antigravity Eşlemesi
| Protokol | Antigravity karşılığı |
|---|---|
| /compact | /compact |
| /goal | /goal |
| Plan Modu | /plan |
| Çoklu ajan | /teamwork, subagent |
| Zamanlanmış iş | /schedule |
`;

export const SELF_SERVICE_RULES = `## Self-Servis İK ve Eğitim Komutları

Aşağıdaki doğal dil komutları çatı ajan tarafından tanınır, **onay kapısına** düşer ve onaylanınca motor tarafından uygulanır:

| Komut | Örnek | Uygulama |
|---|---|---|
| Yeni departman ekle | "Yeni departman ekle: 11-Insan-Kaynaklari" | \`POST /api/admin/departman\` → şablondan klasör ağacı |
| Personel al | "09-Satis-ve-CRM departmanına 'kurumsal-satis-muduru' personeli al" | \`POST /api/admin/personel\` → profil.md + rules/ + skills/ |
| Eğitim ver | "Ses kaydı / video / fare kaydı / doküman ile eğitim ver" | Eğitim Merkezi → 6 kanallı boru hattı → taslak skill → SOP denetçisi onayı |
| Skill ithal et | "GitHub'dan şu skill'i ithal et" | Paket \`_EGITIM-MERKEZI/03-Ithal-Edilen-Repolar/\` altına konur → 05-Güvenlik taraması → onay → personel skills/ |

Kurallar:
1. Hiçbir yeni skill, güvenlik + format kontrolünden geçmeden \`status: active\` olamaz.
2. Departman/personel ekleme ve silme yalnızca kurum yöneticisi veya Süper Admin onayıyla yapılır.
3. Her işlem denetim izine (hash zinciri) yazılır.
`;

export function coreClaudeMd() {
  return `# SÜPER ADMIN ANAYASASI — Dijital İkiz Platformu v4.0

**Rol:** Baş Sistem Mimarı, Multi-Tenant Altyapı Mühendisi ve Süper Admin Orkestratörü.

## Temel İlkeler
1. **İzolasyon:** Her kurum \`tenants/[kurum]/\` altında dosya sistemi, anahtar (\`.env.vault\`), veritabanı, skill ve hafıza bakımından %100 izoledir. Bir kurumun ajanı başka bir kurumun klasörünü okuyamaz.
2. **Offline öncelik:** Varsayılan LLM modu \`offline\` (Ollama, 127.0.0.1). İnternet yoksa \`offline-fallback-router.json\` kural/skill motoruna düşer. Cloud modu yalnızca Süper Admin açık onayıyla etkinleşir.
3. **Araç önceliği:** CLI > MCP > Plugin > Browser Fallback. Onaylı araçlar \`global-registry/\` içindedir.
4. **Skills / Rules ayrımı:** Rules her oturumda yüklenen 1-3 satırlık sınırlardır (\`paths\` ile kapsamlanır). Skills yalnızca tetiklendiğinde yüklenen 4 parçalı pakettir (SKILL.md, scripts/, references/, assets/).
5. **İnsan onayı:** Dışa giden iletişim, finansal işlem, yeni skill aktivasyonu, departman/personel değişikliği onay kapısından geçer.
6. **Denetim:** Tüm ajan eylemleri SHA-256 hash zincirli denetim izine yazılır.

## Tenant Üretim Motoru
\`\`\`bash
./_CORE-INFRASTRUCTURE/tenant-provisioner.sh --name "abc-holding" --subdomain "abc.sistem.com"
# Windows:
powershell -File _CORE-INFRASTRUCTURE/tenant-provisioner.ps1 -Name abc-holding -Subdomain abc.sistem.com
\`\`\`
Üretilenler: 10 departman, ${DEPARTMENTS.reduce((s, d) => s + d.personnel.length, 0)} personel, her personel için skills/ + rules/, \`.claude/agents/01..10.md\`, \`_EGITIM-MERKEZI/\`, şifreli \`.env.vault\`, örnek ERP verisi.

${SELF_SERVICE_RULES}
${CLI_PROTOCOL}
`;
}

export function coreAgentsMd() {
  return `# AGENTS.md — Platform (Codex / Multi-Agent Uyumluluk)

Bu dosya \`CLAUDE.md\` ile eşdeğer kuralları Codex, Gemini CLI, Cursor ve Antigravity ajanları için taşır.

- Kurum klasörleri arası erişim yasaktır.
- Varsayılan mod offline'dır; dış ağa istek atma.
- Skill paketleri 4 parçalı anatomiye uyar; rules dosyaları \`paths\` üstbilgisi taşır.
- Yeni skill / departman / personel işlemleri onay kapısına gönderilir.
- Teslim öncesi kalite kapısı: simplify → review → security-review.

${SELF_SERVICE_RULES}`;
}

export function tenantClaudeMd(cfg) {
  const rows = DEPARTMENTS.map(d => `| ${d.no} | ${d.emoji} ${d.name} | \`departmanlar/${d.slug}/\` | ${d.keywords.slice(0, 6).join(', ')} |`).join('\n');
  return `# ${cfg.displayName} — GENEL MÜDÜR (ÇATI AJAN) ANAYASASI

**Kurum:** ${cfg.displayName} · **Subdomain:** ${cfg.subdomain} · **LLM modu:** ${cfg.llm.mode}

## Kimlik
Sen ${cfg.displayName} kurumunun dijital ikizinin Genel Müdürüsün. Gelen her talebi analiz eder, ilgili departmana yönlendirir, departmanlar arası iş devrini koordine eder ve sonuçları yöneticiye özetlersin.

## Yönlendirme Tablosu
| No | Departman | Klasör | Tetikleyici kavramlar |
|---|---|---|---|
${rows}

## Çalışma Kuralları
1. Talebi önce departmana, sonra departman CLAUDE.md'deki personel tablosuna göre personele yönlendir.
2. Çok departmanlı işlerde sırayı belirle; bir önceki çıktının doğrulaması bitmeden sonrakini tetikleme.
3. Yalnızca ilgili departmanın \`context/\` verisini bağlama yükle (en az bağlam ilkesi).
4. Kritik eylemleri (dış e-posta, ödeme, skill aktivasyonu, personel değişikliği) onay kapısına gönder.
5. Her görev sonunda çıktıyı ilgili \`context/ciktilar/\` klasörüne kaydet.

${SELF_SERVICE_RULES}
${CLI_PROTOCOL}
`;
}

export function tenantAgentsMd(cfg) {
  return `# AGENTS.md — ${cfg.displayName}

Çatı ajan kuralları için \`CLAUDE.md\` dosyasına bakın; bu dosya diğer ajan araçları için özet ikizidir.

- Departmanlar: ${DEPARTMENTS.map(d => d.slug).join(', ')}
- Kurallar: \`.claude/rules/\` (global), \`departmanlar/*/rules/\`, \`personeller/*/rules/\` (paths ile kapsamlı)
- Skills: \`.claude/skills/\`, \`departmanlar/*/skills/\`, \`personeller/*/skills/\`
- Offline: LLM yalnızca 127.0.0.1 üzerindeki Ollama'dır.
`;
}

export function deptClaudeMd(d, personnel = d.personnel) {
  const rows = personnel.map(p => `| ${p.title}${p.head ? ' ⭐' : ''} | \`personeller/${p.slug}/\` | ${(p.skills || []).map(s => '`' + s.name + '`').join(', ') || '-'} |`).join('\n');
  return `# ${d.no}. ${d.name} — DEPARTMAN ANAYASASI

## Görev Alanı
${d.keywords.join(', ')}

## Araçlar (öncelik: CLI > MCP > Plugin > Browser)
${d.tools.map(t => '- ' + t).join('\n')}

## Veri Erişimi (RBAC)
Bu departman yalnızca şu tablolara **salt-okunur** erişir: ${d.tables.map(t => '`' + t + '`').join(', ')}

## Personel Yönlendirme Tablosu
| Personel | Klasör | Skills |
|---|---|---|
${rows}

## Kurallar
- Talep skill tetikleyicisiyle eşleşiyorsa ilgili personele, eşleşmiyorsa ⭐ departman yöneticisine yönlendir.
- Çıktılar \`context/ciktilar/\` altına tarihli kaydedilir.
${(d.deptRules || []).map(r => '- ' + r).join('\n')}
`;
}

export function deptAgentsMd(d) {
  return `# AGENTS.md — ${d.no}. ${d.name}\n\nAlt ajanlar: ${d.personnel.map(p => p.slug).join(', ')}.\nKurallar ve yönlendirme için CLAUDE.md'ye bakın. Veri erişimi: ${d.tables.join(', ')} (salt-okunur).\n`;
}

export function agentCard(d) {
  const head = d.personnel.find(p => p.head) || d.personnel[0];
  return `---
name: ${d.slug}-yoneticisi
description: ${d.name} departmanı yöneticisi. ${d.keywords.slice(0, 8).join(', ')} konularında görev alır.
department: departmanlar/${d.slug}
head: ${head.slug}
---
# ${d.emoji} ${d.name} Yöneticisi — Kimlik Kartı

- **Departman yöneticisi:** ${head.title}
- **Ekip:** ${d.personnel.map(p => p.title).join(', ')}
- **Araçlar:** ${d.tools.join(', ')}
- **Erişebildiği veriler:** ${d.tables.join(', ')}
`;
}

export function personnelProfile(d, p) {
  return `---
name: ${p.slug}
title: ${p.title}
department: ${d.slug}
head: ${!!p.head}
---
# ${p.title}

## Görev Tanımı
${p.mission}

## Departman
${d.no}. ${d.name}

## Yetenekler (skills/)
${(p.skills || []).map(s => `- \`${s.name}\` — ${s.description}`).join('\n') || '- (henüz yok)'}

## Özel Bağlam
Bu personel yalnızca \`departmanlar/${d.slug}/context/\` ve kendi klasöründeki verilerle çalışır.
`;
}

export function ruleFile({ name, scope, paths, rules }) {
  return `---
name: ${name}
scope: ${scope}
paths: ${JSON.stringify(paths)}
---
${rules.map(r => '- ' + r).join('\n')}
`;
}

export function skillMd(s, owner, status = 'active') {
  const args = (s.args || []);
  return `---
name: ${s.name}
description: ${s.description}
arguments: ${JSON.stringify(args.map(a => a[0]))}
triggers: ${JSON.stringify(s.triggers || [])}
owner: ${owner}
status: ${status}
---
# ${s.name}

${s.description}

## Argümanlar
| Argüman | Açıklama |
|---|---|
${args.map(a => `| \`${a[0]}\` | ${a[1]} |`).join('\n') || '| - | - |'}

## Adımlar
${(s.steps || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}

## Paket İçeriği
- scripts/: ${(s.scripts || []).map(x => '`' + x + '`').join(', ') || '(yok)'}
- references/: ${Object.keys(s.references || {}).map(x => '`' + x + '`').join(', ') || '(yok)'}
- assets/: ${Object.keys(s.assets || {}).map(x => '`' + x + '`').join(', ') || '(yok)'}
`;
}

export const GLOBAL_RULES = (cfg) => [
  { file: 'kurumsal-ton-ve-yasaklar.md', name: 'kurumsal-ton-ve-yasaklar', scope: 'tenant', paths: ['**'], rules: [
    `${cfg.displayName} adına profesyonel, net ve saygılı Türkçe kullan; argo ve kesin olmayan vaatlerde bulunma.`,
    'Kişisel verileri (TC, telefon, e-posta, IBAN) çıktılarda maskele; başka kurumun verisine asla atıf yapma.',
    'Kaynağı olmayan rakam verme; hesaplamaları skill betikleriyle yap.',
  ] },
  { file: 'token-ve-cli-komut-protokolu.md', name: 'token-ve-cli-komut-protokolu', scope: 'tenant', paths: ['**'], rules: [
    'Araç önceliği CLI > MCP > Plugin > Browser; yalnızca global-registry\'deki onaylı araçları kullan.',
    'Bağlam %50 dolunca bir kez özetle (/compact); ikinci kez sıkıştırma yerine çıktıyı kaydedip temiz oturum aç.',
    'Kod/otomasyon teslim etmeden önce /simplify → /review → /security-review kapısından geçir.',
  ] },
  { file: 'offline-ve-guvenlik.md', name: 'offline-ve-guvenlik', scope: 'tenant', paths: ['**'], rules: [
    'Offline modda dış ağa istek atma; yalnızca yerel arşiv ve yerel LLM kullan.',
    'Dış e-posta, ödeme, skill aktivasyonu ve personel değişikliği için onay kapısına gönder.',
  ] },
];
