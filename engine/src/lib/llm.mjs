// LLM yönlendirici: offline-fallback-router.json sırasına göre Ollama → vLLM → kural/skill motoru.
import { join } from 'node:path';
import { CORE, readJSON } from './util.mjs';

let health = { ollama: { ok: false, models: [], checked: 0 }, vllm: { ok: false, checked: 0 } };

export function router() { return readJSON(join(CORE, 'offline-fallback-router.json'), {}); }

async function withTimeout(p, ms) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { return await p(c.signal); } finally { clearTimeout(t); } }

export async function checkHealth(force = false) {
  const r = router();
  const o = r.providers?.ollama;
  if (o?.enabled && (force || Date.now() - health.ollama.checked > (r.healthCheckSeconds || 30) * 1000)) {
    try {
      const res = await withTimeout(s => fetch(o.baseUrl + '/api/tags', { signal: s }), 2500);
      const j = await res.json();
      health.ollama = { ok: res.ok, models: (j.models || []).map(m => m.name), checked: Date.now() };
    } catch { health.ollama = { ok: false, models: [], checked: Date.now() }; }
  }
  const v = r.providers?.vllm;
  if (v?.enabled && (force || Date.now() - health.vllm.checked > 30000)) {
    try { const res = await withTimeout(s => fetch(v.baseUrl + '/models', { signal: s }), 2500); health.vllm = { ok: res.ok, checked: Date.now() }; }
    catch { health.vllm = { ok: false, checked: Date.now() }; }
  }
  return health;
}
export function getHealth() { return health; }

function pickOllamaModel(r, effort, override) {
  const m = r.providers.ollama.models; const avail = health.ollama.models;
  const want = override || (effort === 'high' ? m.high : effort === 'low' ? m.light : m.default);
  const has = n => avail.some(a => a === n || a.startsWith(n + ':') || a.split(':')[0] === n.split(':')[0] && a === n);
  for (const c of [want, m.default, m.light, m.high]) if (c && avail.includes(c)) return c;
  if (has(want)) return want;
  return avail.find(a => !/embed/i.test(a)) || null;
}

// messages: [{role:'system'|'user'|'assistant', content}], images: base64[] (vision)
export async function chat({ messages, effort = 'medium', modelOverride = null, images = null }) {
  const r = router();
  await checkHealth();
  for (const p of r.order || []) {
    const conf = r.providers?.[p];
    if (!conf?.enabled) continue;
    if (p === 'ollama' && health.ollama.ok) {
      const model = images ? (health.ollama.models.find(a => a.startsWith((conf.models.vision || 'llava').split(':')[0])) || null) : pickOllamaModel(r, effort, modelOverride);
      if (!model) continue;
      try {
        const msgs = images ? messages.map((m, i) => i === messages.length - 1 ? { ...m, images } : m) : messages;
        const res = await withTimeout(s => fetch(conf.baseUrl + '/api/chat', { method: 'POST', signal: s, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, messages: msgs, stream: false, options: { temperature: effort === 'high' ? 0.2 : 0.4, num_ctx: 8192 } }) }), conf.timeoutMs || 180000);
        if (!res.ok) throw new Error('Ollama HTTP ' + res.status);
        const j = await res.json();
        return { provider: 'ollama', model, text: j.message?.content || '' };
      } catch (e) { health.ollama.ok = false; }
    }
    if (p === 'vllm' && health.vllm.ok) {
      try {
        const res = await withTimeout(s => fetch(conf.baseUrl + '/chat/completions', { method: 'POST', signal: s, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: conf.model, messages, temperature: 0.3 }) }), conf.timeoutMs || 180000);
        const j = await res.json();
        return { provider: 'vllm', model: conf.model, text: j.choices?.[0]?.message?.content || '' };
      } catch { health.vllm.ok = false; }
    }
    if (p === 'fallback-engine') return { provider: 'fallback-engine', model: null, text: null };
  }
  return { provider: 'fallback-engine', model: null, text: null };
}

export async function embed(text) {
  const r = router(); const o = r.providers?.ollama;
  if (!health.ollama.ok || !o?.models?.embed || !health.ollama.models.some(m => m.startsWith(o.models.embed))) return null;
  try {
    const res = await fetch(o.baseUrl + '/api/embeddings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: o.models.embed, prompt: text.slice(0, 4000) }) });
    return (await res.json()).embedding || null;
  } catch { return null; }
}
