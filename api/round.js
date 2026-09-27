import { kvHSet, kvHIncrBy, kvSAdd } from '../lib/kv.js';

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
function normSalon(s) {
  const v = (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return v || 'general';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { name, round, answer, points: clientPoints, salon: rawSalon } = body;

    if (!name || !round) { res.status(400).json({ error: 'Falta tu nombre o la ronda' }); return; }

    const personName = name.toString().trim().slice(0, 40);
    if (!personName) { res.status(400).json({ error: 'Nombre vacío' }); return; }
    const key = 'person:' + slug(personName);
    const salon = normSalon(rawSalon);

    // Registra a la persona en el índice de su salón (idempotente) y refresca su nombre.
    // Estos son escrituras atómicas por campo — no hay lectura-modificación-escritura,
    // así que aunque lleguen varias actividades al tiempo para la misma persona, no se pisan entre sí.
    await kvHSet(key, 'name', personName);
    await kvHSet(key, 'salon', salon);
    await kvSAdd('people:index:' + salon, key);

    let earned = 0;
    let mode = 'set'; // 'set' = sobreescribe (intento único), 'add' = se acumula (varias veces)

    if (round === 'pipeline') {
      earned = (answer === 'PIPELINE-OK') ? 100 : 40; // intento de armar el pipeline también vale algo
    } else if (round === 'ecoruta') {
      const p = parseInt(clientPoints, 10);
      earned = Number.isFinite(p) ? Math.max(0, Math.min(p, 25)) : 0; // puntos de ESTA decisión únicamente
      mode = 'add'; // EcoRuta se acumula decisión por decisión (suma atómica, segura ante concurrencia)
    } else if (ROUNDS[round]) {
      const cfg = ROUNDS[round];
      const norm = (answer || '').toString().trim().toUpperCase();
      if (norm === cfg.correct) earned = cfg.full;
      else if (cfg.valid.includes(norm)) earned = cfg.partial;
      else earned = 0; // respuesta no reconocible, no se puede calificar
    } else {
      res.status(400).json({ error: 'Ronda desconocida: ' + round }); return;
    }

    let total;
    if (mode === 'add') {
      total = await kvHIncrBy(key, round, earned);
    } else {
      await kvHSet(key, round, earned);
      total = earned;
    }

    res.status(200).json({ ok: true, name: personName, round, points: earned, total });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
