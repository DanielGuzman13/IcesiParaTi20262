import { kvLRange } from '../lib/kv.js';

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
const CF_API_TOKEN = process.env.CF_API_TOKEN;
const CF_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const SYNTH_PASSWORD = process.env.SYNTH_PASSWORD || 'rescate2026';

function normSalon(s) {
  const v = (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return v || 'general';
}

async function generateWithCloudflare(prompt) {
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    throw new Error('Faltan CF_ACCOUNT_ID / CF_API_TOKEN en las variables de entorno de Vercel.');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_TEXT_MODEL}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // no dejar el botón esperando indefinidamente
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      signal: controller.signal,
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      throw new Error(`Cloudflare AI error ${r.status}: ${t.slice(0, 200)}`);
    }
    const data = await r.json();
    const text = data && data.result && data.result.response;
    if (!text) throw new Error('Respuesta de Cloudflare sin texto');
    return text.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

// Respaldo sin IA: si Cloudflare falla o no está configurado, igual mostramos algo útil
// en vez de un error — nunca deja al presentador sin nada que proyectar.
function fallbackSynthesis(ideas) {
  const count = ideas.length;
  // Sin IA no podemos "juzgar" calidad de verdad, así que usamos la propuesta más
  // desarrollada (la más larga) como aproximación razonable a "la mejor idea".
  const best = ideas.reduce((a, b) => (b.text.length > a.text.length ? b : a), ideas[0]);
  return `Recibimos ${count} propuesta${count === 1 ? '' : 's'} para resolver el caos de salida del colegio. Entre todas se repiten ideas como turnos de salida, señalización y avisos por app.\n\n🏆 Mejor idea: ${best.name} — "${best.text}"\n\nUn ingeniero de sistemas real tomaría las mejores ideas de aquí, las combinaría y las probaría con datos reales antes de implementarlas a gran escala — eso es justamente lo que ustedes acaban de hacer entre todos.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const salon = normSalon(req.query && req.query.salon);
    const password = ((req.query && req.query.password) || '').toString();
    if (password !== SYNTH_PASSWORD) {
      res.status(401).json({ error: 'Contraseña incorrecta' });
      return;
    }
    const ideas = await kvLRange('ideas:list:' + salon, 0, 39);
    if (!ideas.length) {
      res.status(200).json({ synthesis: 'Todavía no hay propuestas para sintetizar.' });
      return;
    }
    const listado = ideas.map((it, i) => `${i + 1}. ${it.name}: ${it.text}`).join('\n');
    const prompt = `Eres un ingeniero de sistemas senior hablando con estudiantes de colegio. Lee estas propuestas para resolver un problema de ingeniería (el caos a la salida de un colegio) y responde en español, en máximo 150 palabras, con esta estructura exacta:

1. Un párrafo corto con la síntesis general: qué ideas o patrones se repiten más entre todas las propuestas, y cómo un ingeniero de sistemas conectaría esas ideas en una solución real.
2. Una línea aparte que empiece exactamente con "🏆 Mejor idea:" seguida del nombre exacto del estudiante (tal como aparece en la lista) que propuso la idea más creativa o mejor pensada, y una frase breve explicando por qué la elegiste.

Tono cercano, motivador, sin tecnicismos innecesarios. No inventes nombres que no estén en la lista.

Propuestas:
${listado}`;

    let synthesis;
    let generatedByAI = true;
    try {
      synthesis = await generateWithCloudflare(prompt);
    } catch (e) {
      generatedByAI = false;
      synthesis = fallbackSynthesis(ideas);
    }

    res.status(200).json({ synthesis, count: ideas.length, generatedByAI });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
