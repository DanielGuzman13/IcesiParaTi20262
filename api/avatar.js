import { kvLPush, kvLRange, kvLTrim, kvHSet, kvSAdd } from '../lib/kv.js';

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell'; // rápido, pensado para inferencia en pocos segundos

function slug(s) {
  return (s || '').toString().trim().toLowerCase();
}
function normSalon(s) {
  const v = (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return v || 'general';
}

// Avatar de reserva: un SVG con las iniciales de la persona sobre un color determinístico.
// No depende de red — si la IA falla o se demora, esto SIEMPRE está disponible al instante.
function fallbackAvatar(name) {
  const initials = (name || '?').trim().split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase() || '?';
  const palette = ['#5eead4', '#f2b544', '#b79cf2', '#f2917b', '#7dd3fc', '#fca5a5'];
  let hash = 0;
  for (const ch of (name || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = palette[hash % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="${bg}"/><text x="50%" y="50%" font-family="Arial, sans-serif" font-size="200" font-weight="700" fill="#0a1120" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function generateAvatarDataUri(prompt) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('Faltan CF_ACCOUNT_ID / CF_API_TOKEN en las variables de entorno de Vercel.');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // no dejar a nadie esperando más de 20s
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: controller.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Cloudflare AI error ${r.status}: ${t.slice(0, 200)}`);
    }
    const contentType = r.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await r.json();
      const b64 = data && data.result && data.result.image;
      if (!b64) throw new Error('Respuesta de Cloudflare sin imagen');
      return `data:image/jpeg;base64,${b64}`;
    }
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:image/png;base64,${buf.toString('base64')}`;
  } finally {
    clearTimeout(timeoutId);
  }
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
      const salon = normSalon(body.salon);

      if (!name) { res.status(400).json({ error: 'Falta tu nombre' }); return; }

      const fullPrompt = `retrato digital de ${description}, estilo arte conceptual, iluminacion cinematica, alta calidad, muy detallado`;

      let imageUrl;
      let generatedByAI = true;
      try {
        imageUrl = await generateAvatarDataUri(fullPrompt);
      } catch (e) {
        generatedByAI = false;
        imageUrl = fallbackAvatar(name); // nunca se traba el formulario aunque la IA falle o se demore
      }

      // Gallery entry (for the projector wall), scoped per salón
      const entry = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, team, description, imageUrl, salon, generatedByAI, createdAt: new Date().toISOString() };
      await kvLPush('avatar:list:' + salon, entry);
      await kvLTrim('avatar:list:' + salon, 0, 199);

      // Person record — a Redis HASH (atomic per-field writes, no read/modify/write races).
      const personKey = 'person:' + slug(name);
      await kvHSet(personKey, 'name', name);
      await kvHSet(personKey, 'team', team);
      await kvHSet(personKey, 'avatarUrl', imageUrl);
      await kvHSet(personKey, 'salon', salon);
      await kvSAdd('people:index:' + salon, personKey);

      res.status(200).json({ ok: true, entry });
      return;
    }

    if (req.method === 'GET') {
      const salon = normSalon(req.query && req.query.salon);
      const submissions = await kvLRange('avatar:list:' + salon, 0, 199);
      res.status(200).json({ submissions });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
