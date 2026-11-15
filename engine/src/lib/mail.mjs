// Yerel Intranet E-posta & İç Mesajlaşma Köprüsü.
// 1. Tüm giden e-postalar önce Onay Kapısı'na (approvals) düşer.
// 2. Onaylandığında yerel outbox tablosuna kaydedilir; kurumun yerel SMTP sunucusu (yalnızca loopback/intranet IP) tanımlıysa gönderilir.
import { createConnection } from 'node:net';
import { db, now } from './db.mjs';
import { audit, emit } from './audit.mjs';
import { isPrivateOrLoopback } from './netguard.mjs';
import { tenantConfig } from './context.mjs';

export function queueMailApproval(tenant, { to, subject, body, requestedBy, taskId = null }) {
  const d = db(tenant);
  const ts = now();
  const payload = JSON.stringify({ to, subject, body, taskId });
  const r = d.prepare('INSERT INTO approvals (ts,kind,title,payload,status,requested_by) VALUES (?,?,?,?,?,?)')
    .run(ts, 'dis-eposta', `E-posta Gönderimi: ${to} — ${subject}`, payload, 'pending', requestedBy);
  audit(tenant, requestedBy, 'ONAY_TALEBI_EPOSTA', { approvalId: r.lastInsertRowid, to, subject });
  emit(tenant, 'approval', { id: r.lastInsertRowid, kind: 'dis-eposta', title: `E-posta: ${to} — ${subject}`, status: 'pending' });
  return r.lastInsertRowid;
}

export async function deliverApprovedMail(tenant, { to, subject, body, taskId = null }) {
  const d = db(tenant);
  const cfg = tenantConfig(tenant);
  const smtp = cfg?.network?.smtp;
  const ts = now();

  if (smtp && smtp.host) {
    if (!isPrivateOrLoopback(smtp.host)) {
      const err = `Offline politika ihlali: SMTP sunucusu (${smtp.host}) yerel intranet/loopback değil`;
      d.prepare('INSERT INTO outbox (ts,to_addr,subject,body,status,error,task_id) VALUES (?,?,?,?,?,?,?)')
        .run(ts, to, subject, body, 'blocked', err, taskId);
      return { ok: false, status: 'blocked', error: err };
    }
    try {
      await sendSimpleSmtp(smtp, { from: smtp.from || `dijital-ikiz@${cfg.subdomain}`, to, subject, body });
      d.prepare('INSERT INTO outbox (ts,to_addr,subject,body,status,error,task_id) VALUES (?,?,?,?,?,?,?)')
        .run(ts, to, subject, body, 'sent-intranet-smtp', null, taskId);
      return { ok: true, status: 'sent-intranet-smtp' };
    } catch (e) {
      d.prepare('INSERT INTO outbox (ts,to_addr,subject,body,status,error,task_id) VALUES (?,?,?,?,?,?,?)')
        .run(ts, to, subject, body, 'queued-local-outbox', `SMTP bağlantı notu: ${e.message}`, taskId);
      return { ok: true, status: 'queued-local-outbox', note: e.message };
    }
  }

  d.prepare('INSERT INTO outbox (ts,to_addr,subject,body,status,error,task_id) VALUES (?,?,?,?,?,?,?)')
    .run(ts, to, subject, body, 'stored-intranet-mailbox', null, taskId);
  return { ok: true, status: 'stored-intranet-mailbox' };
}

function sendSimpleSmtp({ host, port = 25 }, { from, to, subject, body }) {
  return new Promise((resolve, reject) => {
    const sock = createConnection({ host, port, timeout: 4000 });
    const lines = [
      `HELO dijital-ikiz.local`,
      `MAIL FROM:<${from}>`,
      `RCPT TO:<${to}>`,
      `DATA`,
      `Subject: ${subject}\r\nFrom: ${from}\r\nTo: ${to}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}\r\n.`,
      `QUIT`,
    ];
    let idx = 0;
    sock.on('data', () => {
      if (idx < lines.length) sock.write(lines[idx++] + '\r\n');
      else { sock.end(); resolve(true); }
    });
    sock.on('timeout', () => { sock.destroy(); reject(new Error('SMTP zaman aşımı')); });
    sock.on('error', reject);
  });
}
