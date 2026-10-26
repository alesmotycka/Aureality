// Aureality server: serves the web app (and the landing page on the .eu domain)
// and gives the app AI answers through the Claude API with the owner's key.
// No dependencies; needs Node 20+.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 8080;
const API_KEY = process.env.ANTHROPIC_API_KEY || '';
const API_URL = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages';
const MODEL = process.env.AUREALITY_MODEL || 'claude-sonnet-5-5';
const ACCESS_CODE = process.env.AUREALITY_ACCESS_CODE || '';
const LANDING_HOSTS = (process.env.LANDING_HOSTS || 'aureality.eu,www.aureality.eu').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const PER_MINUTE = Number(process.env.AI_REQUESTS_PER_MINUTE) || 20;
const ROOT = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'web');
const LANDING_DIR = path.join(ROOT, 'landing');
const MAX_BODY = 15 * 1024 * 1024;

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function send(res, status, body, type = 'application/json') {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  res.end(data);
}

function serveStatic(res, dir, urlPath) {
  let file = path.normalize(path.join(dir, urlPath));
  if (file !== dir && !file.startsWith(dir + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
  });
}

// Simple per-IP limit so a public URL cannot burn through the API key.
const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 60000);
  if (list.length >= PER_MINUTE) { hits.set(ip, list); return false; }
  list.push(now); hits.set(ip, list); return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('too_large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function codeOk(req) {
  if (!ACCESS_CODE) return true;
  const given = String(req.headers['x-aureality-code'] || '');
  const a = Buffer.from(given), b = Buffer.from(ACCESS_CODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Body: { input: string | [{role, content}], images?: [dataURL], json?: boolean, tier?: "quick"|"default"|"complex" }
async function handleSample(req, res) {
  if (!API_KEY) return send(res, 503, { code: 'sampling_disabled', message: 'No ANTHROPIC_API_KEY is set on the server.' });
  if (!codeOk(req)) return send(res, 401, { code: 'not_granted', message: 'Wrong or missing access code.' });
  const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
  if (!allowed(ip)) return send(res, 429, { code: 'rate_limited', message: 'Too many AI requests. Try again in a minute.' });
  let body;
  try { body = JSON.parse(await readBody(req)); } catch (e) { return send(res, e.status || 400, { code: e.status === 413 ? 'prompt_too_large' : 'invalid_request', message: 'Request body must be JSON under 15 MB.' }); }

  const turns = typeof body.input === 'string' ? [{ role: 'user', content: body.input }] : Array.isArray(body.input) ? body.input : null;
  if (!turns || !turns.length || turns.some(t => !['user', 'assistant'].includes(t.role) || typeof t.content !== 'string' || !t.content)) {
    return send(res, 400, { code: 'invalid_request', message: 'input must be a string or a list of {role, content} turns.' });
  }
  const images = (Array.isArray(body.images) ? body.images : []).slice(0, 5).map(u => {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(u));
    return m && { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  }).filter(Boolean);
  const messages = turns.map((t, i) => {
    const last = i === turns.length - 1;
    let text = t.content;
    if (last && body.json) text += '\n\nReply with only the JSON value, no other text.';
    return { role: t.role, content: last && images.length ? [...images, { type: 'text', text }] : text };
  });

  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 2048, messages }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const code = r.status === 429 ? 'rate_limited' : r.status === 401 || r.status === 403 ? 'sampling_disabled' : 'upstream_error';
      console.error('Claude API error', r.status, data && data.error && data.error.message);
      return send(res, r.status === 429 ? 429 : 502, { code, message: 'The AI service returned an error.' });
    }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!text) return send(res, 502, { code: 'empty_completion', message: 'The AI returned no text.' });
    send(res, 200, { text, truncated: data.stop_reason === 'max_tokens' });
  } catch (e) {
    console.error('Claude API request failed', e.message);
    send(res, 502, { code: 'upstream_error', message: 'Could not reach the AI service.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/health') return send(res, 200, { ok: true, ai: Boolean(API_KEY), needsCode: Boolean(ACCESS_CODE) });
  if (url.pathname === '/api/sample') {
    if (req.method !== 'POST') return send(res, 405, { code: 'invalid_request', message: 'Use POST.' });
    return handleSample(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  let p; try { p = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad request', 'text/plain'); }
  if (LANDING_HOSTS.includes(host)) return serveStatic(res, LANDING_DIR, p);
  // /landing/ shows the landing page on any host, handy for checking it at home.
  if (p === '/landing' || p.startsWith('/landing/')) return serveStatic(res, LANDING_DIR, p.slice('/landing'.length) || '/');
  serveStatic(res, APP_DIR, p);
});

server.listen(PORT, () => console.log(`Aureality on :${PORT} · AI ${API_KEY ? `on (${MODEL})` : 'off (no ANTHROPIC_API_KEY)'}${ACCESS_CODE ? ' · access code required' : ''}`));
