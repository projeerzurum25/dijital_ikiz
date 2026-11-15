// Skill betiklerini Node.js Permission Model ile izole çalıştırır.
// Her betik yalnızca kendi kurum klasörünü (tenants/<kurum>) okuyabilir ve yalnızca kendi .runtime/scratch alanına yazabilir.
// Başka bir kurumun klasörüne erişim veya alt süreç (child_process) başlatma çekirdek seviyesinde engellenir.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ensureDir, tenantDir, safeJoin } from './util.mjs';

export function runSkillScript(tenant, scriptPath, input = {}, timeoutMs = 20000) {
  const root = tenantDir(tenant);
  const fullScript = safeJoin(root, scriptPath);
  const scratch = ensureDir(join(root, '.runtime', 'scratch'));

  const args = [
    '--no-warnings',
    '--permission',
    `--allow-fs-read=${root}`,
    `--allow-fs-write=${scratch}`,
    fullScript,
  ];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: scratch,
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, TZ: 'Europe/Istanbul' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { }
      resolve({ ok: false, hata: `Betik zaman aşımı (${timeoutMs}ms)` });
    }, timeoutMs);

    child.stdout.on('data', (d) => { if (stdout.length < 250000) stdout += d.toString('utf8'); });
    child.stderr.on('data', (d) => { if (stderr.length < 60000) stderr += d.toString('utf8'); });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, hata: err.message });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const trimmed = stdout.trim();
      if (trimmed) {
        try {
          return resolve(JSON.parse(trimmed));
        } catch {
          return resolve({ ok: code === 0, raw: trimmed, stderr: stderr.trim() });
        }
      }
      resolve({ ok: code === 0, code, stderr: stderr.trim() || 'Çıktı yok' });
    });

    try {
      child.stdin.write(JSON.stringify(input));
      child.stdin.end();
    } catch { }
  });
}
