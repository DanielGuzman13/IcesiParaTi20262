// Minimal Upstash Redis REST client — no npm dependency needed.
// Credentials are embedded below as defaults so this works immediately after deploy.
// (They can still be overridden with real environment variables in Vercel if preferred.)

const BASE = process.env.UPSTASH_REDIS_REST_URL || 'https://refined-emu-294828.upstash.io';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'gQAAAAAABH-sAAIgcDFjYWM1ZDIwMGU4Mzg0NGIwOTI4M2FjMTlkZDM0YWVjMQ';

async function cmd(...parts) {
  if (!BASE || !TOKEN) {
    throw new Error('Faltan las variables de entorno UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN en Vercel.');
  }
  const url = `${BASE}/${parts.map((p) => encodeURIComponent(p)).join('/')}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upstash error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.result;
}

export async function kvGet(key) {
  const raw = await cmd('get', key);
  return raw ? JSON.parse(raw) : null;
}

export async function kvSet(key, value) {
  await cmd('set', key, JSON.stringify(value));
}

export async function kvSAdd(setKey, member) {
  await cmd('sadd', setKey, member);
}

export async function kvSMembers(setKey) {
  const res = await cmd('smembers', setKey);
  return res || [];
}

export async function kvLPush(listKey, value) {
  await cmd('lpush', listKey, JSON.stringify(value));
}

export async function kvLRange(listKey, start, stop) {
  const res = await cmd('lrange', listKey, start, stop);
  return (res || []).map((x) => JSON.parse(x));
}

export async function kvLTrim(listKey, start, stop) {
  await cmd('ltrim', listKey, start, stop);
}

export async function kvHIncrBy(hashKey, field, incr) {
  return await cmd('hincrby', hashKey, field, incr);
}

export async function kvHGetAll(hashKey) {
  const res = await cmd('hgetall', hashKey); // flat array: [field, value, field, value, ...]
  const obj = {};
  if (Array.isArray(res)) {
    for (let i = 0; i < res.length; i += 2) obj[res[i]] = res[i + 1];
  }
  return obj;
}
