import { kvHIncrBy, kvHGetAll } from '../lib/kv.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const etapa = (body.etapa || '').toString().trim();
      const opcion = (body.opcion || '').toString().trim().toUpperCase();
      if (!etapa || !opcion) { res.status(400).json({ error: 'Falta etapa u opción' }); return; }
      await kvHIncrBy('terminal:votes:' + etapa, opcion, 1);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'GET') {
      const etapa = (req.query && req.query.etapa || '').toString().trim();
      if (!etapa) { res.status(400).json({ error: 'Falta ?etapa=' }); return; }
      const raw = await kvHGetAll('terminal:votes:' + etapa);
      const votes = {};
      for (const k in raw) votes[k] = parseInt(raw[k], 10) || 0;
      res.status(200).json({ votes });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
