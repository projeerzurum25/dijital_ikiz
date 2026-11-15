#!/usr/bin/env node
// /doctor, /skill-doctor, /insights ve Multi-Tenant İzolasyon Test Motoru
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE, listTenants, tenantDir, frontmatter, dirSize } from './lib/util.mjs';
import { readVault } from './lib/vault.mjs';
import { db } from './lib/db.mjs';
import { verifyChain } from './lib/audit.mjs';
import { listSkills, listPersonnel, tenantConfig } from './lib/context.mjs';
import { runSkillScript } from './lib/sandbox.mjs';
import { checkHealth } from './lib/llm.mjs';

export async function runDoctor(targetTenant = null) {
  const tenants = targetTenant ? [targetTenant] : listTenants();
  const llmHealth = await checkHealth(true);
  const coreChecks = {
    claudeMd: existsSync(join(CORE, 'CLAUDE.md')),
    agentsMd: existsSync(join(CORE, 'AGENTS.md')),
    routerJson: existsSync(join(CORE, 'offline-fallback-router.json')),
    provisionerSh: existsSync(join(CORE, 'tenant-provisioner.sh')),
    templates: existsSync(join(CORE, '_SABLONLAR', 'SABLON-SKILL-PAKETI', 'SKILL.md')),
  };

  const tenantReports = [];
  for (const t of tenants) {
    const root = tenantDir(t);
    const cfg = tenantConfig(t);
    const skills = listSkills(t, { includeDrafts: true });
    const personnel = listPersonnel(t);

    // /skill-doctor: 4 parçalı anatomi kontrolü ve çakışan tetikleyici kontrolü
    const anatomyIssues = [];
    const triggerMap = new Map();
    const duplicateTriggers = [];
    for (const s of skills) {
      for (const sub of ['SKILL.md', 'scripts', 'references', 'assets']) {
        if (!existsSync(join(s.dir, sub))) anatomyIssues.push(`${s.rel}/${sub} eksik`);
      }
      for (const tr of s.triggers || []) {
        const key = `${s.dept || 'global'}:${tr}`;
        if (triggerMap.has(key)) duplicateTriggers.push({ trigger: tr, skills: [triggerMap.get(key), s.name] });
        else triggerMap.set(key, s.name);
      }
    }

    // Vault doğrulaması
    let vaultOk = false;
    try { const v = readVault(t); vaultOk = !!v.ADMIN_KEY_HASH; } catch { vaultOk = false; }

    // Audit zinciri doğrulaması
    const auditChain = verifyChain(t);

    // /insights: Departman görev ve verimlilik istatistikleri
    const d = db(t);
    const taskStats = d.prepare('SELECT dept, status, COUNT(*) adet FROM tasks GROUP BY dept, status').all();
    const pendingApprovals = d.prepare("SELECT COUNT(*) n FROM approvals WHERE status = 'pending'").get().n;

    tenantReports.push({
      tenant: t,
      displayName: cfg.displayName,
      subdomain: cfg.subdomain,
      llmMode: cfg.llm?.mode || 'offline',
      departmentsCount: cfg.departments?.length || 0,
      personnelCount: personnel.length,
      skillsCount: skills.length,
      activeSkills: skills.filter(s => s.status === 'active').length,
      draftSkills: skills.filter(s => s.status !== 'active').length,
      skillDoctor: {
        anatomyOk: anatomyIssues.length === 0,
        anatomyIssues,
        duplicateTriggers,
      },
      security: {
        vaultEncryptedOk: vaultOk,
        auditChainOk: auditChain.ok,
        auditEntries: auditChain.kayit,
        outboundPolicy: cfg.network?.outboundPolicy,
      },
      insights: {
        taskStats,
        pendingApprovals,
        diskBytes: dirSize(root),
      },
    });
  }

  // Multi-Tenant İzolasyon Testi (Cross-Tenant Access Test)
  let isolationTest = { tested: false, ok: true, details: [] };
  if (tenants.length >= 2) {
    const [tA, tB] = tenants;
    isolationTest.tested = true;
    // 1. Kasa (Vault) anahtar izolasyonu testi: tA'nın şifreli kasası tB anahtarıyla çözülemez
    let crossVaultBlocked = false;
    try {
      const rawA = readFileSync(join(tenantDir(tA), '.env.vault'), 'utf8');
      const { decrypt } = await import('./lib/vault.mjs');
      decrypt(tB, rawA);
    } catch {
      crossVaultBlocked = true;
    }
    isolationTest.details.push({ test: `${tA} kasası ${tB} anahtarıyla açılamaz (AES-256-GCM + HKDF)`, passed: crossVaultBlocked });

    // 2. Sandbox dosya sistemi izolasyonu: tA içindeki bir betik tB klasörünü okuyamaz
    const sastRel = 'departmanlar/05-Test-QA-ve-Guvenlik/personeller/siber-guvenlik-uzmani/skills/guvenlik-acigi-denetimi/scripts/sast_tara.mjs';
    const res = await runSkillScript(tA, sastRel, { HEDEF_DIZIN: `../${tB}` });
    const crossFsBlocked = (res.taranan_dosya || 0) === 0;
    isolationTest.details.push({ test: `${tA} skill sandbox'ı ${tB} dosyalarını okuyamaz (Node Permission Model)`, passed: crossFsBlocked });

    isolationTest.ok = isolationTest.details.every(x => x.passed);
  }

  const allOk = Object.values(coreChecks).every(Boolean) &&
    tenantReports.every(r => r.skillDoctor.anatomyOk && r.security.vaultEncryptedOk && r.security.auditChainOk) &&
    isolationTest.ok;

  return {
    ok: allOk,
    timestamp: new Date().toISOString(),
    coreChecks,
    llmHealth,
    isolationTest,
    tenants: tenantReports,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t = process.argv[2] || null;
  const rep = await runDoctor(t);
  console.log(JSON.stringify(rep, null, 2));
  process.exit(rep.ok ? 0 : 1);
}
