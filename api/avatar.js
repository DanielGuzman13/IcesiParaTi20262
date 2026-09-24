import { kvLPush, kvLRange, kvLTrim, kvGet, kvSet, kvSAdd } from './_lib/kv.js';

function slug(s) {
  return (s || '').toString().trim().toLowerCase();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const name = (body.name || '').toString().trim().slice(0, 40);
      const team = (body.team || 'Equipo sin nombre').toString().trim().slice(0, 40);
      const description = (body.description || 'un ingeniero de sistemas futurista').toString().trim().slice(0, 200);

      if (!name) { res.status(400).json({ error: 'Falta tu nombre' }); return; }

      const fullPrompt = `retrato digital de ${description}, estilo arte conceptual, iluminacion cinematica, alta calidad, muy detallado`;
      const seed = Math.floor(Math.random() * 1000000);
      const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=768&height=768&nologo=true&seed=${seed}`;

      // Gallery entry (for the projector wall)
      const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, team, description, imageUrl, createdAt: new Date().toISOString() };
      await kvLPush('avatar:list', entry);
      await kvLTrim('avatar:list', 0, 199);

      // Person record (identity used across every other activity)
      const personKey = 'person:' + slug(name);
      const existing = (await kvGet(personKey)) || { rounds: {} };
      existing.name = name;
      existing.team = team;
      existing.avatarUrl = imageUrl;
      if (!existing.rounds) existing.rounds = {};
      await kvSet(personKey, existing);
      await kvSAdd('people:index', personKey);

      res.status(200).json({ ok: true, entry });
      return;
    }

    if (req.method === 'GET') {
      const submissions = await kvLRange('avatar:list', 0, 199);
      res.status(200).json({ submissions });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
