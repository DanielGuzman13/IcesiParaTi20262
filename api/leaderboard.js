import { kvSMembers, kvHGetAll } from '../lib/kv.js';

function normSalon(s) {
  const v = (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return v || 'general';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const salon = normSalon(req.query && req.query.salon);
    const keys = await kvSMembers('people:index:' + salon);
    const people = [];
    for (const key of keys) {
      const p = await kvHGetAll(key);
      if (!p || !p.name) continue;
      const num = (v) => parseInt(v, 10) || 0;
      const r1 = num(p.r1), r2 = num(p.r2), r3 = num(p.r3), bonus = num(p.bonus), pipeline = num(p.pipeline), ecoruta = num(p.ecoruta);
      const total = r1 + r2 + r3 + bonus + pipeline + ecoruta;
      people.push({
        name: p.name,
        avatarUrl: p.avatarUrl || null,
        r1, r2, r3, bonus, pipeline, ecoruta,
        total,
      });
    }
    people.sort((a, b) => b.total - a.total);
    res.status(200).json({ salon, people });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
