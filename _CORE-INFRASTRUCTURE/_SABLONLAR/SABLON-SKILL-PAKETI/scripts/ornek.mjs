// Skill betiği: stdin'den JSON alır, stdout'a JSON yazar.
import { readFileSync } from 'node:fs';
const input = process.stdin.isTTY ? {} : JSON.parse(readFileSync(0, 'utf8') || '{}');
process.stdout.write(JSON.stringify({ ok: true, girdi: input }, null, 2));
