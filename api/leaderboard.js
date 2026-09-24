import { kvSMembers, kvGet } from '../lib/kv.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const keys = await kvSMembers('people:index');
    const people = [];
    for (const key of keys) {
      const p = await kvGet(key);
      if (!p) continue;
      const r = p.rounds || {};
      const total = (r.r1 || 0) + (r.r2 || 0) + (r.r3 || 0) + (r.bonus || 0) + (r.pipeline || 0) + (r.ecoruta || 0);
      people.push({
        name: p.name,
        team: p.team || '',
        avatarUrl: p.avatarUrl || null,
        r1: r.r1 || 0, r2: r.r2 || 0, r3: r.r3 || 0, bonus: r.bonus || 0, pipeline: r.pipeline || 0, ecoruta: r.ecoruta || 0,
        total,
      });
    }
    people.sort((a, b) => b.total - a.total);
    res.status(200).json({ people });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
