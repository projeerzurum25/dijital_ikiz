// Hash zincirli (SHA-256) değiştirilemez denetim izi + canlı olay yayını (SSE).
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { db, now } from './db.mjs';

export const bus = new EventEmitter();
bus.setMaxListeners(200);

export function emit(tenant, type, data) { bus.emit('event', { tenant, type, data, ts: now() }); }

export function audit(tenant, actor, action, detail = '') {
  const d = db(tenant);
  const prev = d.prepare('SELECT hash FROM audit ORDER BY id DESC LIMIT 1').get()?.hash || 'GENESIS';
  const ts = now();
  const det = typeof detail === 'string' ? detail : JSON.stringify(detail);
  const hash = createHash('sha256').update([prev, ts, actor, action, det].join('|')).digest('hex');
  d.prepare('INSERT INTO audit (ts,actor,action,detail,prev_hash,hash) VALUES (?,?,?,?,?,?)').run(ts, actor, action, det, prev, hash);
  emit(tenant, 'audit', { ts, actor, action, detail: det.slice(0, 300) });
  return hash;
}

export function verifyChain(tenant) {
  const rows = db(tenant).prepare('SELECT * FROM audit ORDER BY id').all();
  let prev = 'GENESIS';
  for (const r of rows) {
    const h = createHash('sha256').update([prev, r.ts, r.actor, r.action, r.detail].join('|')).digest('hex');
    if (r.prev_hash !== prev || r.hash !== h) return { ok: false, kayit: rows.length, bozulan_id: r.id };
    prev = r.hash;
  }
  return { ok: true, kayit: rows.length, son_hash: prev };
}

export function setAgent(tenant, agent, dept, status, activity) {
  db(tenant).prepare('INSERT INTO agent_state (agent,dept,status,activity,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(agent) DO UPDATE SET dept=excluded.dept,status=excluded.status,activity=excluded.activity,updated_at=excluded.updated_at')
    .run(agent, dept, status, activity, now());
  emit(tenant, 'agent', { agent, dept, status, activity });
}

export function message(tenant, taskId, from, to, kind, content) {
  db(tenant).prepare('INSERT INTO messages (ts,task_id,from_agent,to_agent,kind,content) VALUES (?,?,?,?,?,?)').run(now(), taskId, from, to, kind, content);
  emit(tenant, 'message', { taskId, from, to, kind, content: content.slice(0, 600) });
}
