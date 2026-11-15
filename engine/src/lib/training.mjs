// 6 Kanallı Çok Modlu Ajan Eğitim Boru Hattı (_EGITIM-MERKEZI/)
// Girdileri işler, SOP / kural / taslak skill üretir, 05-Test-QA-ve-Guvenlik SAST taramasından geçirir ve Onay Kapısı'na sunar.
import { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tenantDir, safeJoin, ensureDir, writeFile, toPosix, SLUG_RE, frontmatter, writeJSON, readJSON, CORE } from './util.mjs';
import { db, now } from './db.mjs';
import { audit, emit, message } from './audit.mjs';
import { runSkillScript } from './sandbox.mjs';
import * as T from '../templates.mjs';
import { reindex } from './context.mjs';

const CHANNELS = {
  '1-yazili': { no: 1, name: 'Yazılı Eğitim (.pdf, .md, .docx, .txt)' },
  '2-gorsel': { no: 2, name: 'Görsel Eğitim (.png, .jpg, UI/Mimari Diyagram)' },
  '3-video': { no: 3, name: 'Video Eğitim (.mp4, .mov, Toplantı/Eğitim Kaydı)' },
  '4-fare-kaydi': { no: 4, name: 'Fare İmleç & Ekran Kaydı (.json tıklama logu → Playwright)' },
  '5-ses': { no: 5, name: 'Canlı Ses & Ses Kaydı (Voice Onboarding / .wav / .mp3)' },
  '6-ithalat': { no: 6, name: 'Hazır Kaynak İthalatı (GitHub / Marketplace Skill Paketi)' },
};

function slugify(s) {
  return String(s || 'yeni-yetenek')
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 42) || 'yeni-yetenek';
}

function extractDocxText(filePath) {
  try {
    const cmd = `Add-Type -AssemblyName System.IO.Compression.FileSystem; $z=[System.IO.Compression.ZipFile]::OpenRead('${filePath.replace(/'/g, "''")}'); $e=$z.GetEntry('word/document.xml'); $r=New-Object System.IO.StreamReader($e.Open()); $x=$r.ReadToEnd(); $z.Dispose(); $t=$x -replace '</w:p>',"\\n" -replace '<[^>]+>',''; [System.Net.WebUtility]::HtmlDecode($t)`;
    return execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { encoding: 'utf8', timeout: 10000 });
  } catch {
    return '';
  }
}

function parseRulesAndSteps(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rules = [];
  const steps = [];
  for (const l of lines) {
    const clean = l.replace(/^[-*•\d.)]+\s*/, '').trim();
    if (!clean) continue;
    if (/(yasak|asla|kesinlikle|yapma|etme|zorunlu|şart|onaylama|gönderme)/i.test(clean) && clean.length < 220) {
      rules.push(clean);
    } else if (/^(\d+[.)]|adım|step|[-*•])/i.test(l) && clean.length > 8 && clean.length < 260) {
      steps.push(clean);
    }
  }
  if (!steps.length) {
    steps.push(
      'Eğitim materyalindeki bağlamı ve referans dokümanı oku.',
      'İlgili departman kurallarını (rules/) doğrula.',
      'Standart Operasyon Prosedürü (SOP) adımlarını sırasıyla uygula ve sonucu raporla.',
    );
  }
  return { rules: rules.slice(0, 5), steps: steps.slice(0, 12) };
}

function buildPlaywrightFromRecording(recJson) {
  let events = [];
  try {
    const parsed = typeof recJson === 'string' ? JSON.parse(recJson) : recJson;
    events = Array.isArray(parsed) ? parsed : (parsed.events || parsed.actions || []);
  } catch { }
  if (!events.length) {
    events = [
      { type: 'goto', url: 'http://127.0.0.1:4400' },
      { type: 'click', selector: '[data-action="open"]', x: 240, y: 120 },
      { type: 'fill', selector: 'input[name="q"]', value: '$1' },
      { type: 'click', selector: 'button[type="submit"]', x: 420, y: 300 },
    ];
  }
  const stepLines = events.map((ev, i) => {
    if (ev.type === 'goto') return `  // Adım ${i + 1}: Yerel sayfaya git\n  await page.goto(${JSON.stringify(ev.url || 'http://127.0.0.1:4400')});`;
    if (ev.type === 'fill' || ev.type === 'type') return `  // Adım ${i + 1}: Alan doldur\n  await page.fill(${JSON.stringify(ev.selector || 'input')}, String(input.DEGER || ${JSON.stringify(ev.value || '')}));`;
    if (ev.selector) return `  // Adım ${i + 1}: Seçiciye tıkla\n  await page.click(${JSON.stringify(ev.selector)});`;
    return `  // Adım ${i + 1}: Koordinata tıkla (${ev.x || 0}, ${ev.y || 0})\n  await page.mouse.click(${Number(ev.x || 0)}, ${Number(ev.y || 0)});`;
  });

  const script = `// Eğitim Kanalı 4 (Fare & Ekran Kaydı) tarafından otomatik üretilen UI Playbook betiği
import { readFileSync } from 'node:fs';
const input = process.stdin.isTTY ? {} : JSON.parse(readFileSync(0, 'utf8') || '{}');

export async function runPlaybook(page) {
${stepLines.join('\n')}
}

process.stdout.write(JSON.stringify({
  ok: true,
  tur: 'ui-playbook',
  adim_sayisi: ${events.length},
  adimlar: ${JSON.stringify(events.slice(0, 25))},
  not: 'Playwright oturumunda runPlaybook(page) ile çalıştırılır.',
}, null, 2));
`;
  return { events, script };
}

export async function ingestTraining(tenant, {
  channel = '1-yazili',
  title = 'Yeni Eğitim Materyali',
  dept = '10-Finans-ve-Operasyon',
  personnel = 'ic-operasyon-sop-denetcisi',
  filename = 'egitim-notu.md',
  content = '',
  skillName = '',
}) {
  if (!CHANNELS[channel]) throw new Error('Geçersiz eğitim kanalı: ' + channel);
  const root = tenantDir(tenant);
  const safeFile = basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  const rawDir = safeJoin(root, '_EGITIM-MERKEZI', '01-Ham-Materyaller', channel);
  ensureDir(rawDir);
  const rawPath = join(rawDir, `${Date.now()}-${safeFile}`);
  writeFileSync(rawPath, content || `# ${title}\n`, 'utf8');

  const skSlug = slugify(skillName || title);
  const sopDir = join(root, '_EGITIM-MERKEZI', '02-Islenmis-SOP-Arsivi');
  ensureDir(sopDir);

  let extractedText = String(content || '');
  if (!extractedText && extname(safeFile).toLowerCase() === '.docx') {
    extractedText = extractDocxText(rawPath);
  }

  const { rules, steps } = parseRulesAndSteps(extractedText || title);
  const pRel = `departmanlar/${dept}/personeller/${personnel}`;
  const draftSkillDir = safeJoin(root, pRel, 'skills', skSlug);
  ensureDir(join(draftSkillDir, 'scripts'));
  ensureDir(join(draftSkillDir, 'references'));
  ensureDir(join(draftSkillDir, 'assets'));

  const outputs = [];

  if (channel === '1-yazili') {
    const kbPath = safeJoin(root, 'departmanlar', dept, 'context', 'bilgi-bankasi.md');
    const prev = existsSync(kbPath) ? readFileSync(kbPath, 'utf8') : `# Bilgi Bankası\n`;
    writeFileSync(kbPath, `${prev.trim()}\n\n## [Yazılı Eğitim — ${now().slice(0, 10)}] ${title}\n${extractedText.slice(0, 4000)}\n`);
    writeFile(join(draftSkillDir, 'references', 'egitim-kaynagi.md'), `# ${title}\n\n${extractedText}\n`);
    outputs.push(`departmanlar/${dept}/context/bilgi-bankasi.md`);
  } else if (channel === '2-gorsel') {
    const gsPath = safeJoin(root, 'departmanlar', dept, 'context', 'gorsel-standartlar.md');
    const prev = existsSync(gsPath) ? readFileSync(gsPath, 'utf8') : `# Görsel Standartlar ve Mimari Şemalar\n`;
    const spec = `## [Görsel Eğitim — ${now().slice(0, 10)}] ${title}\n- Kaynak Dosya: \`${toPosix(relative(root, rawPath))}\`\n- Çıkarılan Bileşen & Yerleşim Kuralları:\n${steps.map(s => '  - ' + s).join('\n')}\n`;
    writeFileSync(gsPath, `${prev.trim()}\n\n${spec}\n`);
    copyFileSync(rawPath, join(draftSkillDir, 'assets', safeFile));
    outputs.push(`departmanlar/${dept}/context/gorsel-standartlar.md`);
  } else if (channel === '3-video') {
    const sopPath = join(sopDir, `SOP-video-${skSlug}.md`);
    writeFile(sopPath, `# Video Eğitim SOP: ${title}\n\n- Kaynak: \`${toPosix(relative(root, rawPath))}\`\n- Tarih: ${now()}\n\n## Kronolojik Adımlar\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`);
    writeFile(join(draftSkillDir, 'references', 'video-transkript-ozeti.md'), readFileSync(sopPath, 'utf8'));
    outputs.push(`_EGITIM-MERKEZI/02-Islenmis-SOP-Arsivi/SOP-video-${skSlug}.md`);
  } else if (channel === '4-fare-kaydi') {
    const { events, script } = buildPlaywrightFromRecording(extractedText);
    writeFile(join(draftSkillDir, 'scripts', 'ui_playbook.mjs'), script);
    writeFile(join(draftSkillDir, 'assets', 'recording.json'), typeof extractedText === 'string' && extractedText.trim().startsWith('{') ? extractedText : JSON.stringify({ events }, null, 2));
    outputs.push(`${pRel}/skills/${skSlug}/scripts/ui_playbook.mjs`);
  } else if (channel === '5-ses') {
    const sopPath = join(sopDir, `SOP-ses-${skSlug}.md`);
    writeFile(sopPath, `# Sesli Eğitim (Voice Onboarding) SOP: ${title}\n\n## Temizlenmiş Transkript\n${extractedText}\n\n## Çıkarılan Kararlar (Rules)\n${rules.map(r => '- ' + r).join('\n') || '- Standart departman kuralları geçerlidir.'}\n\n## İş Adımları\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n`);
    writeFile(join(draftSkillDir, 'references', 'sesli-egitim-notu.md'), readFileSync(sopPath, 'utf8'));
    outputs.push(`_EGITIM-MERKEZI/02-Islenmis-SOP-Arsivi/SOP-ses-${skSlug}.md`);
  } else if (channel === '6-ithalat') {
    const repoDir = safeJoin(root, '_EGITIM-MERKEZI', '03-Ithal-Edilen-Repolar', skSlug);
    ensureDir(repoDir);
    writeFile(join(repoDir, 'IMPORTED-SKILL.md'), `# İthal Edilen Kaynak: ${title}\n\n${extractedText}\n`);
    writeFile(join(draftSkillDir, 'references', 'ithal-kaynak.md'), `# ${title}\n\n${extractedText}\n`);
    outputs.push(`_EGITIM-MERKEZI/03-Ithal-Edilen-Repolar/${skSlug}`);
  }

  // SKILL.md (status: pending_approval — 10-Finans-ve-Operasyon İç Operasyon & SOP Denetçisi kuralı gereği güvenlik ve format kontrolünden geçmeden aktif olmaz!)
  const scriptsList = existsSync(join(draftSkillDir, 'scripts')) ? readdirSync(join(draftSkillDir, 'scripts')).filter(f => f.endsWith('.mjs')) : [];
  const refsObj = Object.fromEntries((existsSync(join(draftSkillDir, 'references')) ? readdirSync(join(draftSkillDir, 'references')) : []).map(f => [f, '']));
  const assetsObj = Object.fromEntries((existsSync(join(draftSkillDir, 'assets')) ? readdirSync(join(draftSkillDir, 'assets')) : []).map(f => [f, '']));

  writeFile(join(draftSkillDir, 'SKILL.md'), T.skillMd({
    name: skSlug,
    description: `${title} (${CHANNELS[channel].name} ile eğitildi)`,
    triggers: [skSlug.replace(/-/g, ' '), title.toLocaleLowerCase('tr-TR').slice(0, 28)],
    args: [['$HEDEF', 'İşlem yapılacak hedef / kayıt']],
    steps,
    scripts: scriptsList,
    references: refsObj,
    assets: assetsObj,
  }, pRel, 'pending_approval'));

  // 05-Test-QA-ve-Guvenlik SAST + Prompt Injection taraması
  const sastPath = 'departmanlar/05-Test-QA-ve-Guvenlik/personeller/siber-guvenlik-uzmani/skills/guvenlik-acigi-denetimi/scripts/sast_tara.mjs';
  const relSkill = toPosix(relative(root, draftSkillDir));
  const scanRes = await runSkillScript(tenant, sastPath, { HEDEF_DIZIN: relSkill });

  const d = db(tenant);
  const trStatus = (scanRes.kritik || scanRes.yuksek) ? 'blocked_security' : 'pending_approval';
  const trRow = d.prepare('INSERT INTO training (ts,channel,filename,path,status,target,result) VALUES (?,?,?,?,?,?,?)')
    .run(now(), channel, safeFile, relSkill, trStatus, `${dept}/${personnel}/${skSlug}`, JSON.stringify({ outputs, rules, stepsCount: steps.length, securityScan: scanRes }));

  message(tenant, null, 'siber-guvenlik-uzmani', 'ic-operasyon-sop-denetcisi', 'security-scan',
    `Eğitim paketi (${skSlug}) güvenlik taraması: ${scanRes.karar || 'TAMAM'} (${scanRes.bulgu_sayisi || 0} bulgu).`);

  let approvalId = null;
  if (trStatus === 'pending_approval') {
    const ap = d.prepare('INSERT INTO approvals (ts,kind,title,payload,status,requested_by) VALUES (?,?,?,?,?,?)')
      .run(now(), 'skill-aktivasyonu', `Yeni Yetenek Aktivasyonu: ${skSlug} (${dept}/${personnel})`,
        JSON.stringify({ trainingId: trRow.lastInsertRowid, skillRel: relSkill, dept, personnel, rules, channel, title }),
        'pending', 'ic-operasyon-sop-denetcisi');
    approvalId = ap.lastInsertRowid;
    emit(tenant, 'approval', { id: approvalId, kind: 'skill-aktivasyonu', title: `Yeni Yetenek: ${skSlug}`, status: 'pending' });
  }

  audit(tenant, 'egitim-merkezi', 'EGITIM_ISLENDI', { channel, skill: skSlug, status: trStatus, approvalId });
  reindex(tenant, true);
  return { ok: trStatus !== 'blocked_security', trainingId: trRow.lastInsertRowid, approvalId, status: trStatus, skillRel: relSkill, securityScan: scanRes, outputs };
}

export function activateApprovedSkill(tenant, payload) {
  const root = tenantDir(tenant);
  const skFile = safeJoin(root, payload.skillRel, 'SKILL.md');
  if (existsSync(skFile)) {
    const txt = readFileSync(skFile, 'utf8').replace(/status:\s*pending_approval/, 'status: active');
    writeFileSync(skFile, txt, 'utf8');
  }
  if (Array.isArray(payload.rules) && payload.rules.length && payload.dept && payload.personnel) {
    const rFile = safeJoin(root, 'departmanlar', payload.dept, 'personeller', payload.personnel, 'rules', 'egitim-kurallari.md');
    const pRel = `departmanlar/${payload.dept}/personeller/${payload.personnel}`;
    writeFile(rFile, T.ruleFile({ name: `${payload.personnel}-egitim-kurallari`, scope: 'personel', paths: [`${pRel}/**`], rules: payload.rules }));
  }
  if (payload.channel === '6-ithalat') {
    const regFile = join(CORE, 'global-registry', 'approved-github-skills.json');
    const reg = readJSON(regFile, { policy: '', skills: [] });
    reg.skills.push({ tenant, skillRel: payload.skillRel, title: payload.title, approvedAt: now() });
    writeJSON(regFile, reg);
  }
  if (payload.trainingId) {
    db(tenant).prepare('UPDATE training SET status = ? WHERE id = ?').run('active', payload.trainingId);
  }
}
