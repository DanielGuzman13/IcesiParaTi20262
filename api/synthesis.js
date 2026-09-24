import { kvLRange } from '../lib/kv.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const ideas = await kvLRange('ideas:list', 0, 39);
    if (!ideas.length) {
      res.status(200).json({ synthesis: 'Todavía no hay propuestas para sintetizar.' });
      return;
    }
    const listado = ideas.map((it, i) => `${i + 1}. ${it.name}: ${it.text}`).join('\n');
    const prompt = `Eres un ingeniero de sistemas senior hablando con estudiantes de colegio. Lee estas propuestas para resolver un problema de ingeniería (el caos a la salida de un colegio) y escribe en español, en máximo 120 palabras: 1) qué ideas o patrones se repiten más, 2) una propuesta particularmente creativa que destacarías por nombre, y 3) cómo un ingeniero de sistemas conectaría estas ideas en una solución real. Tono cercano, motivador, sin tecnicismos innecesarios.\n\nPropuestas:\n${listado}`;

    let synthesis;
    try {
      const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(prompt));
      synthesis = (await r.text()).trim();
      if (!synthesis) throw new Error('respuesta vacía');
    } catch (e) {
      synthesis = 'No se pudo generar la síntesis en este momento — inténtalo de nuevo en unos segundos.';
    }

    res.status(200).json({ synthesis, count: ideas.length });
  } catch (e) {
    res.status(500).json({ error: 'Error interno', detail: String(e && e.message || e) });
  }
}
