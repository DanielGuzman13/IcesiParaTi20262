import { kvHIncrBy, kvHGetAll } from '../lib/kv.js';

function normalizeEtapa(raw) {
  const s = (raw || '').toString().trim();
  const digits = s.match(/\d+/);
  return digits ? digits[0] : s.toLowerCase();
}
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
      const etapa = normalizeEtapa(body.etapa);
      const opcion = (body.opcion || '').toString().trim().toUpperCase();
      const salon = normSalon(body.salon);
      if (!etapa || !opcion) { res.status(400).json({ error: 'Falta etapa u opción' }); return; }
      await kvHIncrBy('terminal:votes:' + salon + ':' + etapa, opcion, 1);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'GET') {
      const etapa = normalizeEtapa(req.query && req.query.etapa);
      const salon = normSalon(req.query && req.query.salon);
      if (!etapa) { res.status(400).json({ error: 'Falta ?etapa=' }); return; }
      const raw = await kvHGetAll('terminal:votes:' + salon + ':' + etapa);
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
