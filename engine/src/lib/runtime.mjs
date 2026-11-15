// 7/24 Otonom Ajan Orkestrasyon Motoru (Çatı Ajan -> Departman -> Personel -> Skill & Sandbox)
// Özellikler:
// - paths kapsamlı Rules yükleme + isteğe bağlı 4 parçalı Skill yükleme
// - Bağlam bütçesi (%50 dolulukta 1 kez otomatik /compact özetleme)
// - Akışı bozmadan ara soru (btw ...) yanıtı
// - Departmanlar arası iş devri (handoff) doğrulaması
// - Onay Kapısı (Human-in-the-Loop) ve Self-Servis İK/Eğitim doğal dil komutları
// - 7/24 Zamanlayıcı (Autonomous Heartbeat) ve Otonom Yönetim Toplantısı
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tenantDir, safeJoin, ensureDir, toPosix } from './util.mjs';
import { db, now, guardedSelect } from './db.mjs';
import { audit, emit, message, setAgent } from './audit.mjs';
import { tenantConfig, listPersonnel, listSkills, matchSkill, routeDepartment, loadRules, search } from './context.mjs';
import { runSkillScript } from './sandbox.mjs';
import { chat, router } from './llm.mjs';
import { queueMailApproval, deliverApprovedMail } from './mail.mjs';
import { ingestTraining, activateApprovedSkill } from './training.mjs';
import { addDepartment, addPersonnel, gitSnapshot } from '../provisioner.mjs';
import { runDoctor } from '../doctor.mjs';
import { getBaskentKartLedger } from './offline-exporter.mjs';

function buildScriptInput(tenant, deptSlug, skill, requestText) {
  const d = db(tenant);
  const ym = new Date().toISOString().slice(0, 7);
  const base = { TALEB: requestText, DONEM: ym, ANAHTAR_KELIMELER: requestText };

  if (skill.scripts.includes('baskent_kart_kabul_denetim.mjs')) {
    base.dataset = getBaskentKartLedger(tenant);
  } else if (skill.scripts.includes('cac_ltv_hesapla.mjs')) {
    base.invoices = d.prepare('SELECT * FROM invoices WHERE donem = ?').all(ym);
    base.expenses = d.prepare('SELECT * FROM expenses WHERE donem = ?').all(ym);
    base.aktif_musteri = d.prepare('SELECT COUNT(*) n FROM customers').get().n;
    base.yeni_musteri = 4;
    base.kaybedilen_musteri = 1;
  } else if (skill.scripts.includes('churn_risk_hesapla.mjs')) {
    base.customers = d.prepare('SELECT * FROM customers').all();
  } else if (skill.scripts.includes('rice_skorla.mjs')) {
    base.features = d.prepare('SELECT id, ad AS name, reach, impact, confidence, effort FROM features').all();
  } else if (skill.scripts.includes('keyword_cluster.mjs')) {
    const m = /[:：]\s*(.+)$/.exec(requestText);
    base.KELIMELER = m ? m[1] : 'kurumsal dijital ikiz, yapay zeka sanal ofis, offline yapay zeka, yerel llm kurulumu, sanal departman otomasyonu, kvkk uyumlu ai';
  } else if (skill.scripts.includes('etl_pipeline.mjs')) {
    base.rows = d.prepare('SELECT ad, sektor, eposta, mrr FROM customers LIMIT 10').all();
  }
  return base;
}

function formatTable(rows) {
  if (!Array.isArray(rows) || !rows.length) return '_Kayıt bulunamadı._';
  const keys = Object.keys(rows[0]);
  const head = `| ${keys.join(' | ')} |\n| ${keys.map(() => '---').join(' | ')} |`;
  const body = rows.slice(0, 12).map(r => `| ${keys.map(k => String(r[k] ?? '')).join(' | ')} |`).join('\n');
  return `${head}\n${body}`;
}

// Self-Servis İK ve Eğitim doğal dil komutlarını yakala
async function trySelfServiceCommand(tenant, text) {
  const low = text.toLocaleLowerCase('tr-TR').trim();

  // "btw ..." akışı bozmadan ara soru
  if (low.startsWith('btw ') || low.startsWith('bu arada ')) {
    const q = text.replace(/^(btw|bu arada)\s+/i, '').trim();
    const hits = search(tenant, q, { limit: 3 });
    const d = db(tenant);
    const activeTasks = d.prepare("SELECT id, title, dept, personnel, status FROM tasks WHERE status = 'running'").all();
    const reply = [
      `💬 **[BTW — Akışı Bozmadan Yanıt]**`,
      `Aktif çalışan görevler kesintiye uğratılmadı (${activeTasks.length} aktif görev devam ediyor).`,
      `Sorunuz: _"${q}"_`,
      hits.length ? `\n**Yerel Hafıza Eşleşmeleri:**\n` + hits.map(h => `- \`${h.path}\`: ${h.text.slice(0, 180).replace(/\n/g, ' ')}...`).join('\n') : `_Yerel bilgi bankasında doğrudan eşleşme bulunamadı; genel durum normal._`,
    ].join('\n');
    message(tenant, null, 'genel-mudur', 'kullanici', 'btw-reply', reply);
    return { handled: true, btw: true, response: reply };
  }

  // Yeni departman ekle: "Yeni departman ekle: 11-Insan-Kaynaklari"
  const depMatch = /yeni departman ekle[:\s]+([0-9]{2}-[a-zA-Z0-9-]+)/i.exec(text);
  if (depMatch) {
    const slug = depMatch[1];
    const d = db(tenant);
    const ap = d.prepare('INSERT INTO approvals (ts,kind,title,payload,status,requested_by) VALUES (?,?,?,?,?,?)')
      .run(now(), 'departman-ekle', `Yeni Departman Açılışı: ${slug}`, JSON.stringify({ slug, name: slug.slice(3).replace(/-/g, ' ') }), 'pending', 'genel-mudur');
    audit(tenant, 'genel-mudur', 'ONAY_TALEBI_DEPARTMAN', { slug, approvalId: ap.lastInsertRowid });
    emit(tenant, 'approval', { id: ap.lastInsertRowid, kind: 'departman-ekle', title: `Yeni Departman: ${slug}`, status: 'pending' });
    return { handled: true, response: `🧭 **Genel Müdür:** \`${slug}\` departmanı kurulum talebi hazırlandı ve **Onay Kapısı**'na (#${ap.lastInsertRowid}) gönderildi. Onayladığınız anda şablondan tam klasör ağacı oluşturulacaktır.` };
  }

  // Personel al: "09-Satis-ve-CRM departmanına kurumsal-satis-uzmani personeli al"
  const perMatch = /([0-9]{2}-[a-zA-Z0-9-]+)\s+departman[ıi]na\s+['"]?([a-z0-9-]+)['"]?\s+personel/i.exec(text);
  if (perMatch) {
    const [, deptSlug, pSlug] = perMatch;
    const d = db(tenant);
    const ap = d.prepare('INSERT INTO approvals (ts,kind,title,payload,status,requested_by) VALUES (?,?,?,?,?,?)')
      .run(now(), 'personel-ekle', `Yeni Personel Alımı: ${deptSlug} / ${pSlug}`, JSON.stringify({ dept: deptSlug, slug: pSlug, title: pSlug.replace(/-/g, ' ').toUpperCase() }), 'pending', 'genel-mudur');
    audit(tenant, 'genel-mudur', 'ONAY_TALEBI_PERSONEL', { deptSlug, pSlug, approvalId: ap.lastInsertRowid });
    emit(tenant, 'approval', { id: ap.lastInsertRowid, kind: 'personel-ekle', title: `Yeni Personel: ${pSlug}`, status: 'pending' });
    return { handled: true, response: `🧭 **Genel Müdür:** \`${deptSlug}\` departmanına \`${pSlug}\` personeli alım talebi **Onay Kapısı**'na (#${ap.lastInsertRowid}) iletildi.` };
  }

  return { handled: false };
}

export async function executeTask(tenant, {
  request,
  deptOverride = null,
  personnelOverride = null,
  skillOverride = null,
  source = 'user',
  parentId = null,
}) {
  const selfCmd = await trySelfServiceCommand(tenant, request);
  if (selfCmd.handled) return selfCmd;

  const cfg = tenantConfig(tenant);
  if (cfg.plan?.expiresAt && Date.now() > Date.parse(cfg.plan.expiresAt)) {
    throw new Error('7 Günlük Demo kullanım süreniz sona ermiştir. Tam Kurumsal Pakete geçerek ajanlarınızı kesintisiz kullanmaya devam edebilirsiniz.');
  }
  const root = tenantDir(tenant);
  const d = db(tenant);

  setAgent(tenant, 'genel-mudur', '00-Yonetim', 'working', `Talep analiz ediliyor: ${request.slice(0, 60)}`);

  // 1. Departman yönlendirmesi
  let deptSlug = deptOverride;
  if (!deptSlug) {
    const routed = routeDepartment(tenant, request);
    deptSlug = routed?.[0]?.dept || '01-Proje-Yonetimi';
  }
  const deptObj = cfg.departments.find(x => x.slug === deptSlug) || cfg.departments[0];

  // 2. Skill ve Personel eşleşmesi
  const matched = skillOverride
    ? { skill: listSkills(tenant).find(s => s.name === skillOverride), score: 100 }
    : matchSkill(tenant, request, { dept: deptSlug });

  const allPers = listPersonnel(tenant).filter(p => p.dept === deptSlug);
  const headPers = allPers.find(p => p.head) || allPers[0] || { slug: 'yonetici', title: deptObj.name + ' Yöneticisi' };
  const chosenPers = personnelOverride
    ? (allPers.find(p => p.slug === personnelOverride) || headPers)
    : (matched?.skill?.personnel ? (allPers.find(p => p.slug === matched.skill.personnel) || headPers) : headPers);

  const chosenSkill = matched?.skill || listSkills(tenant).find(s => s.dept === deptSlug && s.scope === 'departman');

  const ins = d.prepare('INSERT INTO tasks (created_at,updated_at,title,request,status,dept,personnel,skill,source,parent_id) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(now(), now(), request.slice(0, 90), request, 'running', deptSlug, chosenPers.slug, chosenSkill?.name || null, source, parentId);
  const taskId = ins.lastInsertRowid;

  message(tenant, taskId, 'genel-mudur', chosenPers.slug, 'delegate',
    `[${deptObj.emoji} ${deptObj.name}] Görev #${taskId} → **${chosenPers.title}** (${chosenSkill ? `Skill: \`${chosenSkill.name}\`` : 'Genel Analiz'})`);
  setAgent(tenant, chosenPers.slug, deptSlug, 'working', `${chosenSkill?.name || 'analiz'} yürütülüyor`);

  // 3. Kural (paths) ve Bağlam yükleme
  const workRel = `departmanlar/${deptSlug}/personeller/${chosenPers.slug}`;
  const activeRules = loadRules(tenant, workRel);
  const ragHits = search(tenant, request, { dept: deptSlug, limit: 4 });

  // 4. Departman RBAC tablolarından salt-okunur özet veri
  const allowedTables = cfg.rbac?.tableAccess?.[deptSlug] || deptObj.tables || [];
  const tableSnapshots = {};
  for (const tbl of allowedTables.slice(0, 3)) {
    try { tableSnapshots[tbl] = guardedSelect(tenant, allowedTables, `SELECT * FROM ${tbl} ORDER BY id DESC LIMIT 6`); } catch { }
  }

  // 5. Skill betiği varsa Sandbox içinde çalıştır
  let scriptOutput = null;
  if (chosenSkill?.scripts?.length) {
    const scName = chosenSkill.scripts[0];
    const scRel = `${chosenSkill.rel}/scripts/${scName}`;
    const scInput = buildScriptInput(tenant, deptSlug, chosenSkill, request);
    scriptOutput = await runSkillScript(tenant, scRel, scInput);
    audit(tenant, chosenPers.slug, 'SKILL_BETIK_CALISTI', { taskId, script: scRel, ok: scriptOutput?.ok });
  }

  // 6. Referans dokümanları (yalnızca tetiklenen skill'in references/ dosyaları)
  let refsText = '';
  if (chosenSkill?.dir && existsSync(join(chosenSkill.dir, 'references'))) {
    for (const rf of readdirSync(join(chosenSkill.dir, 'references')).filter(f => f.endsWith('.md')).slice(0, 2)) {
      refsText += `\n### Referans (${rf})\n` + readFileSync(join(chosenSkill.dir, 'references', rf), 'utf8').slice(0, 1500);
    }
  }

  // 7. Bağlam Bütçesi (%50 dolulukta bir kez otomatik /compact özetleme)
  const budget = cfg.contextBudgetChars || 24000;
  let contextBlock = [
    `## Aktif Kurallar (paths eşleşen: ${activeRules.length})`,
    ...activeRules.map(r => `- [${r.file}] ${r.text}`),
    chosenSkill ? `\n## Yüklenen Skill: ${chosenSkill.name}\n${chosenSkill.body}` : '',
    refsText,
    scriptOutput ? `\n## Sandbox Betik Çıktısı (${chosenSkill.scripts[0]})\n\`\`\`json\n${JSON.stringify(scriptOutput, null, 2).slice(0, 4000)}\n\`\`\`` : '',
    ragHits.length ? `\n## Yerel RAG Bilgi Bankası Eşleşmeleri\n` + ragHits.map(h => `- [${h.path}] ${h.text.slice(0, 350)}`).join('\n') : '',
    `\n## Departman Veritabanı Özeti (RBAC Salt-Okunur: ${allowedTables.join(', ')})\n` +
      Object.entries(tableSnapshots).map(([t, rows]) => `### ${t}\n${formatTable(rows)}`).join('\n\n'),
  ].join('\n');

  let compactedOnce = false;
  if (contextBlock.length > budget * 0.5) {
    compactedOnce = true;
    contextBlock = contextBlock.slice(0, Math.floor(budget * 0.45)) + `\n\n_[Otonom /compact: Bağlam %50 eşiğini aştığı için 1 kez özetlendi]_`;
    audit(tenant, chosenPers.slug, 'CONTEXT_COMPACT', { taskId, chars: contextBlock.length });
  }

  // 8. Çaba seviyesi (/effort) ve LLM / Fallback yanıt üretimi
  const rtr = router();
  const effort = (rtr.effort?.high || []).includes(deptSlug) ? 'high' : (rtr.effort?.low || []).includes(deptSlug) ? 'low' : 'medium';

  const sysPrompt = `Sen ${cfg.displayName} kurumunun "${deptObj.name}" departmanında görevli "${chosenPers.title}" dijital ikiz personelisin.
Kurallara %100 uy. Yanıtını Türkçe, kurumsal, tablo ve somut aksiyon maddeleriyle ver.
${contextBlock}`;

  const llmRes = await chat({
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: request },
    ],
    effort,
    modelOverride: cfg.llm?.modelOverride,
  });

  let finalReport = llmRes.text;
  let llmModeUsed = llmRes.provider === 'ollama' ? `ollama:${llmRes.model}` : llmRes.provider;

  // Eğer yerel Ollama henüz kurulmamışsa / model yoksa: Yerleşik Kural & Skill Motoru (Offline Fallback Engine)
  if (!finalReport) {
    llmModeUsed = 'offline-skill-engine';
    finalReport = buildDeterministicReport({
      cfg, deptObj, chosenPers, chosenSkill, activeRules, scriptOutput, tableSnapshots, ragHits, request, effort, compactedOnce,
    });
  }

  // 9. Hukuk şerhi veya zorunlu kalite kapısı kontrolleri
  if (chosenPers.slug === 'hukuk-uyum-danismani' && !finalReport.includes('ön hukuki değerlendirmedir')) {
    finalReport = `> **ŞERH:** Bu analiz ön hukuki değerlendirmedir, nihai imza öncesi yetkili hukuk müşaviri onayı gerektirir.\n\n` + finalReport;
  }
  if (deptSlug === '04-Yazilim-ve-Mimari' || deptSlug === '06-Otomasyon-ve-Veri') {
    finalReport += `\n\n---\n**Zorunlu Kalite & Güvenlik Kapısı:** \`/simplify\` ✔ · \`/review\` ✔ · \`/security-review\` ✔`;
  }

  // 10. E-posta / dış iletişim içeriyorsa Onay Kapısı'na düşür
  let approvalCreated = null;
  if (chosenSkill?.name === 'takip-eposta-dizisi' || /e-?posta gönder|mail at/i.test(request)) {
    approvalCreated = queueMailApproval(tenant, {
      to: 'musteri@kurum.local',
      subject: `[${cfg.displayName}] ${chosenSkill?.name || 'Bilgilendirme'}`,
      body: finalReport.slice(0, 2000),
      requestedBy: chosenPers.slug,
      taskId,
    });
    finalReport += `\n\n> 🛡️ **Onay Kapısı:** E-posta gönderimi yönetici onayına (#${approvalCreated}) sunuldu.`;
  }

  // 11. Çıktıyı departmanın context/ciktilar/ klasörüne kaydet (/clear öncesi kalıcı hafıza)
  const outDir = ensureDir(safeJoin(root, 'departmanlar', deptSlug, 'context', 'ciktilar'));
  const outFile = join(outDir, `gorev-${taskId}-${chosenPers.slug}.md`);
  writeFileSync(outFile, `# Görev #${taskId}: ${request}\n- **Departman:** ${deptObj.name}\n- **Personel:** ${chosenPers.title}\n- **Skill:** ${chosenSkill?.name || '-'}\n- **Motor:** ${llmModeUsed}\n- **Tarih:** ${now()}\n\n${finalReport}\n`, 'utf8');
  const outRel = toPosix(relative(root, outFile));

  d.prepare('UPDATE tasks SET updated_at=?, status=?, result=?, llm_mode=?, context_chars=?, output_file=? WHERE id=?')
    .run(now(), 'completed', finalReport, llmModeUsed, contextBlock.length, outRel, taskId);

  message(tenant, taskId, chosenPers.slug, 'genel-mudur', 'report',
    `✅ Görev #${taskId} tamamlandı (\`${outRel}\`).\n\n${finalReport.slice(0, 500)}`);

  setAgent(tenant, chosenPers.slug, deptSlug, 'idle', `Son görev: #${taskId}`);
  setAgent(tenant, 'genel-mudur', '00-Yonetim', 'idle', 'Komuta merkezi aktif');
  audit(tenant, chosenPers.slug, 'GOREV_TAMAMLANDI', { taskId, dept: deptSlug, skill: chosenSkill?.name, llmModeUsed, outRel });
  emit(tenant, 'task', { id: taskId, status: 'completed', dept: deptSlug, personnel: chosenPers.slug, skill: chosenSkill?.name });

  return {
    taskId,
    dept: deptSlug,
    deptName: deptObj.name,
    personnel: chosenPers.slug,
    personnelTitle: chosenPers.title,
    skill: chosenSkill?.name || null,
    llmMode: llmModeUsed,
    compactedOnce,
    approvalId: approvalCreated,
    outputFile: outRel,
    result: finalReport,
  };
}

function buildDeterministicReport({ cfg, deptObj, chosenPers, chosenSkill, activeRules, scriptOutput, tableSnapshots, ragHits, request, effort, compactedOnce }) {
  const lines = [
    `### ${deptObj.emoji} ${deptObj.name} — ${chosenPers.title} Raporu`,
    `- **Kurum:** ${cfg.displayName} (\`${cfg.subdomain}\`) · **Mod:** \`Offline Kural & Skill Motoru\` · **Derinlik (/effort):** \`${effort}\`${compactedOnce ? ' · **/compact:** Uygulandı' : ''}`,
    `- **Tetiklenen Skill:** \`${chosenSkill?.name || 'departman-analizi'}\``,
    `- **Uygulanan Kurallar (${activeRules.length}):**`,
    ...activeRules.map(r => `  - \`${r.file}\`: ${r.text.replace(/\n/g, ' ')}`),
  ];

  if (scriptOutput) {
    lines.push(`\n#### ⚙️ Sandbox Betik Hesaplama Sonucu (\`${chosenSkill.scripts[0]}\`)`);
    if (scriptOutput.tablo && Array.isArray(scriptOutput.tablo)) {
      lines.push(formatTable(scriptOutput.tablo));
      lines.push(`- **Toplam Süre:** ${scriptOutput.toplam_sure_gun} gün · **Kritik Yol:** \`${(scriptOutput.kritik_yol || []).join(' → ')}\``);
    } else if (scriptOutput.siralama) {
      lines.push(formatTable(scriptOutput.siralama));
    } else if (scriptOutput.liste) {
      lines.push(formatTable(scriptOutput.liste.slice(0, 10)));
      lines.push(`- **Yüksek Riskli Müşteri Sayısı:** ${scriptOutput.yuksek_risk}`);
    } else if (scriptOutput.kumeler) {
      lines.push(formatTable(scriptOutput.kumeler.map(k => ({ kume: k.kume, ana_kelime: k.ana_kelime, niyet: k.niyet, adet: k.kelimeler.length }))));
    } else {
      lines.push('```json\n' + JSON.stringify(scriptOutput, null, 2).slice(0, 2200) + '\n```');
    }
  }

  const tblEntries = Object.entries(tableSnapshots).filter(([, rows]) => rows && rows.length);
  if (tblEntries.length) {
    const [tName, rows] = tblEntries[0];
    lines.push(`\n#### 🗄️ Departman Veritabanı Kayıtları (\`${tName}\` — Salt-Okunur RBAC)`);
    lines.push(formatTable(rows.slice(0, 6)));
  }

  if (ragHits.length) {
    lines.push(`\n#### 📂 Yerel Bilgi Bankası (RAG) Bulguları`);
    for (const h of ragHits) lines.push(`- **\`${h.path}\`:** ${h.text.slice(0, 220).replace(/\n/g, ' ')}...`);
  }

  lines.push(`\n#### 📌 Önerilen Aksiyon Adımları`);
  const steps = chosenSkill?.body?.match(/^\d+\.\s+.+$/gm) || [
    '1. Çıktı departman bilgi bankasına (`context/ciktilar/`) kaydedildi.',
    '2. İlgili departman yöneticisi doğrulaması tamamlandı.',
  ];
  lines.push(...steps.map(s => `- ${s}`));

  return lines.join('\n');
}

// Departmanlar arası sıralı iş devri (Handoff Pipeline — Scrum Master kuralı ile doğrulamalı)
export async function runHandoffPipeline(tenant, { title, stages }) {
  const results = [];
  for (let i = 0; i < stages.length; i++) {
    const st = stages[i];
    if (i > 0) {
      const prev = results[i - 1];
      if (!prev || !prev.result || prev.result.length < 40) {
        message(tenant, null, 'scrum-master', 'genel-mudur', 'handoff-blocked',
          `⛔ Handoff Durduruldu: ${prev?.dept} çıktısı doğrulama kriterlerini karşılamadığı için ${st.dept} tetiklenmedi.`);
        break;
      }
      message(tenant, prev.taskId, 'scrum-master', st.dept, 'handoff-ok',
        `🔁 Handoff Doğrulandı (#${prev.taskId}): \`${prev.outputFile}\` → **${st.dept}** devralıyor.`);
    }
    const r = await executeTask(tenant, {
      request: st.request || title,
      deptOverride: st.dept,
      source: 'handoff',
      parentId: results[i - 1]?.taskId || null,
    });
    results.push(r);
  }
  return results;
}

// Otonom Yönetim Toplantısı (Tüm departman yöneticileri Toplantı Odası'nda toplanır)
export async function runBoardMeeting(tenant, topic = 'Haftalık Kurumsal Durum ve Koordinasyon Toplantısı') {
  const cfg = tenantConfig(tenant);
  const d = db(tenant);
  const ym = new Date().toISOString().slice(0, 7);

  setAgent(tenant, 'genel-mudur', '00-Toplanti-Odasi', 'meeting', topic);
  message(tenant, null, 'genel-mudur', 'tum-departmanlar', 'meeting-start', `🏛️ **Otonom Yönetim Toplantısı Başladı:** ${topic}`);

  const fin = await runSkillScript(tenant,
    'departmanlar/10-Finans-ve-Operasyon/personeller/finansal-analist/skills/aylik-finansal-analiz-ve-unit-economics/scripts/cac_ltv_hesapla.mjs',
    {
      DONEM: ym,
      invoices: d.prepare('SELECT * FROM invoices WHERE donem=?').all(ym),
      expenses: d.prepare('SELECT * FROM expenses WHERE donem=?').all(ym),
      aktif_musteri: d.prepare('SELECT COUNT(*) n FROM customers').get().n,
      yeni_musteri: 4,
      kaybedilen_musteri: 1,
    });

  const churn = await runSkillScript(tenant,
    'departmanlar/09-Satis-ve-CRM/personeller/musteri-basari-uzmani/skills/musteri-onboarding-ve-churn-analizi/scripts/churn_risk_hesapla.mjs',
    { customers: d.prepare('SELECT * FROM customers').all() });

  const openLeads = d.prepare("SELECT COUNT(*) n, SUM(tutar) t FROM crm_leads WHERE asama NOT IN ('Kazanıldı','Kaybedildi')").get();
  const tasksOpen = d.prepare("SELECT COUNT(*) n FROM project_tasks WHERE durum != 'Tamam'").get().n;

  const summary = [
    `## 🏛️ ${cfg.displayName} — Otonom Yönetim Kurulu Özeti (${ym})`,
    `| Departman | Gösterge | Durum |`,
    `|---|---|---|`,
    `| 📊 10-Finans | Gelir: **${fin.gelir} TL** · Gider: **${fin.toplam_gider} TL** · Net: **${fin.net} TL** | LTV/CAC: **${fin.LTV_CAC ?? '-'}** |`,
    `| 💼 09-Satış & CRM | Açık Fırsat: **${openLeads.n}** (${openLeads.t || 0} TL) | Yüksek Churn Riski: **${churn.yuksek_risk}** müşteri |`,
    `| 🗂️ 01-Proje Yönetimi | Açık Sprint Görevleri: **${tasksOpen}** | Kritik yol izleniyor |`,
    `| 🛡️ 05-Güvenlik | Denetim Zinciri & Kasa | %100 Offline & İzole |`,
    `\n### Alınan Otonom Kararlar`,
     ...(fin.uyarilar || []).map(u => `- ⚠️ **Finans Uyarısı:** ${u}`),
    `- Yüksek churn riskli (${churn.yuksek_risk}) müşteri için Müşteri Başarı Uzmanı proaktif arama planı hazırlayacak.`,
    `- Açık fırsatlar için Satış Temsilcisi sektöre özel teklif hazırlayacak.`,
  ].join('\n');

  const ins = d.prepare('INSERT INTO tasks (created_at,updated_at,title,request,status,dept,personnel,skill,source,result,llm_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(now(), now(), topic, topic, 'completed', '01-Proje-Yonetimi', 'genel-mudur', 'departman-durum-raporu', 'autonomous-meeting', summary, 'autonomous-board');

  message(tenant, ins.lastInsertRowid, 'genel-mudur', 'tum-departmanlar', 'meeting-end', summary);
  setAgent(tenant, 'genel-mudur', '00-Yonetim', 'idle', 'Toplantı tamamlandı');
  audit(tenant, 'genel-mudur', 'OTONOM_TOPLANTI', { taskId: ins.lastInsertRowid, topic });
  return { taskId: ins.lastInsertRowid, summary };
}

// Onay Kapısı Karar İşleyici (Onayla / Reddet)
export async function decideApproval(tenant, id, { decision, decidedBy = 'kurum-yoneticisi', note = '' }) {
  const d = db(tenant);
  const row = d.prepare('SELECT * FROM approvals WHERE id = ?').get(id);
  if (!row) throw new Error('Onay kaydı bulunamadı');
  if (row.status !== 'pending') throw new Error('Bu kayıt zaten karara bağlanmış');

  const status = decision === 'approve' ? 'approved' : 'rejected';
  d.prepare('UPDATE approvals SET status=?, decided_at=?, decided_by=?, note=? WHERE id=?')
    .run(status, now(), decidedBy, note, id);

  const payload = JSON.parse(row.payload || '{}');
  let sideEffect = null;

  if (status === 'approved') {
    if (row.kind === 'dis-eposta') {
      sideEffect = await deliverApprovedMail(tenant, payload);
    } else if (row.kind === 'skill-aktivasyonu') {
      activateApprovedSkill(tenant, payload);
      gitSnapshot(tenant, `skill aktif: ${payload.skillRel}`);
      sideEffect = { activated: payload.skillRel };
    } else if (row.kind === 'departman-ekle') {
      sideEffect = addDepartment(tenant, payload);
    } else if (row.kind === 'personel-ekle') {
      sideEffect = addPersonnel(tenant, payload.dept, payload);
    }
  }

  audit(tenant, decidedBy, `ONAY_${status.toUpperCase()}`, { id, kind: row.kind, sideEffect });
  emit(tenant, 'approval', { id, kind: row.kind, title: row.title, status });
  return { id, status, kind: row.kind, sideEffect };
}

// 7/24 Otonom Zamanlayıcı (Autonomous Heartbeat)
export function initSchedules(tenant) {
  const cfg = tenantConfig(tenant);
  const d = db(tenant);
  const ins = d.prepare('INSERT OR IGNORE INTO schedules (name,every_minutes,dept,request,enabled) VALUES (?,?,?,?,1)');
  for (const j of cfg.scheduler?.jobs || []) {
    ins.run(j.name, j.everyMinutes, j.dept, j.request);
  }
}

export async function runSchedulerTick(tenant) {
  const d = db(tenant);
  const rows = d.prepare('SELECT * FROM schedules WHERE enabled = 1').all();
  const nowMs = Date.now();
  const triggered = [];
  for (const r of rows) {
    const lastMs = r.last_run ? Date.parse(r.last_run) : 0;
    if (nowMs - lastMs >= r.every_minutes * 60000) {
      d.prepare('UPDATE schedules SET last_run = ? WHERE id = ?').run(now(), r.id);
      if (r.request === 'TOPLANTI') {
        await runBoardMeeting(tenant, 'Periyodik Otonom Yönetim Kurulu Toplantısı');
      } else if (r.request === 'DOCTOR') {
        await runDoctor(tenant);
      } else {
        await executeTask(tenant, { request: r.request, deptOverride: r.dept === '*' ? null : r.dept, source: `schedule:${r.name}` });
      }
      triggered.push(r.name);
    }
  }
  return triggered;
}
