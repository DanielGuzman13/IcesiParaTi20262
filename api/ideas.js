import { kvLPush, kvLRange, kvLTrim } from '../lib/kv.js';

function normSalon(s) {
  const v = (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return v || 'general';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = (body.name || 'Alguien').toString().trim().slice(0, 40);
      const text = (body.text || '').toString().trim().slice(0, 500);
      const salon = normSalon(body.salon);
      if (!text) { res.status(400).json({ error: 'Falta la propuesta' }); return; }
      const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, text, salon, createdAt: new Date().toISOString() };
      await kvLPush('ideas:list:' + salon, entry);
      await kvLTrim('ideas:list:' + salon, 0, 299);
      res.status(200).json({ ok: true, entry });
      return;
    }

    if (req.method === 'GET') {
      const salon = normSalon(req.query && req.query.salon);
      const ideas = await kvLRange('ideas:list:' + salon, 0, 299);
      res.status(200).json({ ideas });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
