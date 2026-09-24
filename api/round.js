import { kvGet, kvSet, kvSAdd } from '../lib/kv.js';

// Cada ronda: la respuesta correcta gana el puntaje completo.
// Cualquier otra opción válida (A/B/C) todavía da puntaje parcial — nadie se queda en cero.
const ROUNDS = {
  r1:    { correct: 'B', full: 100, partial: 40,  valid: ['A', 'B'] },
  r2:    { correct: 'A', full: 100, partial: 40,  valid: ['A', 'B', 'C'] },
  r3:    { correct: 'A', full: 100, partial: 40,  valid: ['A', 'B', 'C'] },
  bonus: { correct: 'B', full: 200, partial: 80,  valid: ['A', 'B', 'C'] },
};

function slug(s) {
  return (s || '').toString().trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { name, round, answer, points: clientPoints } = body;

    if (!name || !round) { res.status(400).json({ error: 'Falta tu nombre o la ronda' }); return; }

    const personName = name.toString().trim().slice(0, 40);
    if (!personName) { res.status(400).json({ error: 'Nombre vacío' }); return; }
    const key = 'person:' + slug(personName);

    let earned = 0;
    if (round === 'pipeline') {
      earned = (answer === 'PIPELINE-OK') ? 100 : 40; // intento de armar el pipeline también vale algo
    } else if (round === 'ecoruta') {
      const p = parseInt(clientPoints, 10);
      earned = Number.isFinite(p) ? Math.max(0, Math.min(p, 225)) : 0;
    } else if (ROUNDS[round]) {
      const cfg = ROUNDS[round];
      const norm = (answer || '').toString().trim().toUpperCase();
      if (norm === cfg.correct) earned = cfg.full;
      else if (cfg.valid.includes(norm)) earned = cfg.partial;
      else earned = 0; // respuesta no reconocible, no se puede calificar
    } else {
      res.status(400).json({ error: 'Ronda desconocida: ' + round }); return;
    }

    const existing = (await kvGet(key)) || { rounds: {} };
    existing.name = personName;
    if (!existing.team) existing.team = existing.team || '';
    if (!existing.rounds) existing.rounds = {};
    existing.rounds[round] = earned;
    await kvSet(key, existing);
    await kvSAdd('people:index', key);

    res.status(200).json({ ok: true, name: personName, round, points: earned });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
