// AES-256-GCM şifreli kurum kasası (.env.vault).
// Ana anahtar: _CORE-INFRASTRUCTURE/.master.key (veya DIJITAL_IKIZ_MASTER_KEY ortam değişkeni, 64 hex).
// Her kuruma HKDF ile ayrı anahtar türetilir → bir kurumun kasası diğerinin anahtarıyla açılamaz.
import { randomBytes, createCipheriv, createDecipheriv, hkdfSync, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE, tenantDir } from './util.mjs';

const MASTER_FILE = join(CORE, '.master.key');

export function masterKey() {
  if (process.env.DIJITAL_IKIZ_MASTER_KEY && /^[0-9a-f]{64}$/i.test(process.env.DIJITAL_IKIZ_MASTER_KEY)) return Buffer.from(process.env.DIJITAL_IKIZ_MASTER_KEY, 'hex');
  if (!existsSync(MASTER_FILE)) writeFileSync(MASTER_FILE, randomBytes(32).toString('hex'), { mode: 0o600 });
  return Buffer.from(readFileSync(MASTER_FILE, 'utf8').trim(), 'hex');
}

function tenantKey(tenant) { return Buffer.from(hkdfSync('sha256', masterKey(), Buffer.from('dijital-ikiz-vault'), Buffer.from(tenant), 32)); }

export function encrypt(tenant, obj) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', tenantKey(tenant), iv);
  c.setAAD(Buffer.from(tenant));
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return ['DIV1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decrypt(tenant, blob) {
  const [v, iv, tag, data] = blob.trim().split('.');
  if (v !== 'DIV1') throw new Error('Bilinmeyen kasa sürümü');
  const d = createDecipheriv('aes-256-gcm', tenantKey(tenant), Buffer.from(iv, 'base64'));
  d.setAAD(Buffer.from(tenant));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'));
}

export function readVault(tenant) { return decrypt(tenant, readFileSync(join(tenantDir(tenant), '.env.vault'), 'utf8')); }
export function writeVault(tenant, obj) { writeFileSync(join(tenantDir(tenant), '.env.vault'), encrypt(tenant, obj), { mode: 0o600 }); }

export function hashSecret(secret) {
  const salt = randomBytes(16);
  return 'scrypt$' + salt.toString('base64') + '$' + scryptSync(secret, salt, 32).toString('base64');
}
export function verifySecret(secret, stored) {
  if (!stored || !secret) return false;
  const [, salt, hash] = stored.split('$');
  const h = scryptSync(String(secret), Buffer.from(salt, 'base64'), 32);
  const ref = Buffer.from(hash, 'base64');
  return h.length === ref.length && timingSafeEqual(h, ref);
}
export function newAccessKey(prefix) { return prefix + '-' + randomBytes(18).toString('base64url'); }
