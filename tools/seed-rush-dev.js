'use strict';

/**
 * DEV ONLY — a local preview of the site with a fake Seed Rush backend and a
 * fake Supabase sign-in, so the game can be played end to end without the real
 * backend and without creating accounts in the production Supabase project.
 *
 *   node tools/seed-rush-dev.js            # http://127.0.0.1:8080
 *   then open  http://127.0.0.1:8080/seed-rush?api=mock&auth=mock
 *
 * `?api=` and `?auth=` are honoured only on localhost / 127.0.0.1 (see
 * assets/js/seed-rush.js) and remembered for the tab. "mock" is shorthand for
 * this server's /__mock/api and /__mock/supabase. To test against a real local
 * backend instead: ?api=http://127.0.0.1:8000 (this server widens the CSP's
 * connect-src to localhost for that; production's CSP is untouched).
 *
 * Nothing here ships: tools/ is not referenced by any page, and netlify.toml
 * answers /tools/* with a 404.
 *
 * The mock follows the real API (C:\DollarSeeds backend/main.py, /seed-rush):
 * the same paths, response shapes and detail.code errors, the 60 s clock with
 * 3 s grace, per-mode scoring, one daily run per player per game day (7:00 AM
 * New York), username rules, verification and guest claims. Blanks are chosen
 * from the public snapshot automatically, since the real blank and option data
 * is not public. Its verification links are printed here, and the newest one
 * is at /__mock/last-link.
 *
 * Test hooks: /__mock/expire-runs ends every run's clock; /__mock/seed-streak?days=N
 * (with the player's bearer token) gives that account N past daily runs.
 *
 * Env: SR_MOCK_START_DELAY=4000 delays POST /runs (to see "Waking up the game…").
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ROOT } = require('../scripts/site.config.js');
const { handler: siteHandler } = require('./serve.js');

const PORT = Number(process.argv[2] || 8080);
const START_DELAY = Number(process.env.SR_MOCK_START_DELAY || 0);
const RUN_MS = 60000, GRACE_MS = 3000;
const POINTS = { easy: 1, medium: 2, hard: 5 };
const MIN_MS = { easy: 400, medium: 1200, hard: 1500 };
const RESERVED = ['admin', 'administrator', 'dollarseeds', 'dollar_seeds', 'benny', 'support', 'moderator', 'mod', 'staff', 'official', 'help'];
const PROFANE = ['fuck', 'shit', 'cunt', 'bitch', 'whore', 'slut', 'porn', 'pussy', 'dick', 'ass'];
const WRONG_POOL = ['river', 'candle', 'silver', 'harvest', 'mountain', 'window', 'garden', 'shadow', 'thunder',
  'basket', 'lantern', 'meadow', 'harbor', 'pebble', 'feather', 'kingdom', 'wisdom', 'bread', 'stone', 'cloud'];

// ── verses with mock blanks ─────────────────────────────────────────────────
const SNAPSHOT = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'data', 'seed-rush-verses.json'), 'utf8'));
const wordRe = w => new RegExp('(?<![\\w])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w])', 'gi');

const VERSES = SNAPSHOT.map((v, i) => {
  const seen = {};
  const words = (v.text.match(/[A-Za-z']+/g) || []).map(w => w.replace(/'s$/, ''));
  words.forEach(w => { seen[w.toLowerCase()] = (seen[w.toLowerCase()] || 0) + 1; });
  const unique = words.filter(w => w.length >= 4 && seen[w.toLowerCase()] === 1 && (v.text.match(wordRe(w)) || []).length === 1);
  const pick = [0.15, 0.5, 0.85].map(f => unique[Math.min(unique.length - 1, Math.floor(f * unique.length))]);
  const blanks = [...new Set(pick)];
  while (blanks.length < 3) blanks.push(unique.find(w => !blanks.includes(w)));
  blanks.sort((a, b) => v.text.search(wordRe(a)) - v.text.search(wordRe(b)));
  const pool = WRONG_POOL.filter(w => !wordRe(w).test(v.text));
  const rot = k => pool[(i * 3 + k) % pool.length];
  return Object.assign({ id: i + 1, active: true }, v, {
    blanks, easy_blank: blanks[1], easy_wrong: [rot(0), rot(1)], medium_wrong: [rot(2), rot(3), rot(4)]
  });
});
const byId = Object.fromEntries(VERSES.map(v => [v.id, v]));

// ── game day (7:00 AM America/New_York, wall clock) ─────────────────────────
function nyParts(ms) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { day: p.year + '-' + p.month + '-' + p.day, hour: Number(p.hour) };
}
function gameDay(ms) {
  const { day, hour } = nyParts(ms);
  if (hour >= 7) return day;
  const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function dayStart(day) {
  // The UTC instant where New York reads 07:00 on `day` (EST or EDT).
  for (const off of [11, 12]) {
    const t = Date.parse(day + 'T' + String(off).padStart(2, '0') + ':00:00Z');
    const p = nyParts(t);
    if (p.day === day && p.hour === 7) return t;
  }
  return Date.parse(day + 'T12:00:00Z');
}
const addDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ── state ───────────────────────────────────────────────────────────────────
const users = {};          // id -> {id, email, password, provider}
const tokens = {};         // refresh token -> user id
const profiles = {};       // user id -> {username, email_verified_at, token}
const runs = {};           // id -> run
const claims = {};         // guest id -> user id
const audit = { metadataWrites: 0 };
let lastLink = null;

// A few made-up players, so the board has rows and "Show all" has work to do.
(function seedBoard() {
  const today = gameDay(Date.now());
  const modes = ['easy', 'medium', 'hard'];
  for (let i = 0; i < 14; i++) {
    const uid = 'mock-player-' + i;
    profiles[uid] = { username: ['Faithful_Fig', 'MustardSeed', 'Steward7', 'Ruth_reads', 'Gleaner', 'Tither_Tom', 'OliveBranch', 'Sower22', 'Talent_Ten', 'Barnabas', 'Lydia_P', 'Zacchaeus', 'Manna', 'Cornerstone'][i], email_verified_at: '2026-01-01T00:00:00Z' };
    for (const day of [today, addDays(today, -1)]) {
      const id = crypto.randomUUID();
      runs[id] = { id, user_id: uid, guest_id: null, kind: 'daily', mode: modes[i % 3], game_day: day, verse_order: [1],
        current_index: 1, started_at: new Date(dayStart(day) + i * 60000).toISOString(),
        deadline_at: new Date(dayStart(day) + i * 60000 + RUN_MS).toISOString(),
        finished_at: new Date(dayStart(day) + i * 60000 + 50000).toISOString(),
        score: 60 - i * 4 - (day === today ? 0 : 3), words_right: 10, words_wrong: i % 4, flagged: false, answers: [] };
    }
  }
})();

// ── helpers ─────────────────────────────────────────────────────────────────
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
function mintSession(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({
    sub: user.id, email: user.email, aud: 'authenticated', role: 'authenticated', exp,
    app_metadata: { provider: user.provider, providers: [user.provider] }
  }) + '.mock-signature';
  const refresh = crypto.randomBytes(16).toString('hex');
  tokens[refresh] = user.id;
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user: publicUser(user) };
}
function publicUser(u) {
  const now = new Date().toISOString();
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: now,
    app_metadata: { provider: u.provider, providers: [u.provider] }, user_metadata: {}, identities: [],
    created_at: now, updated_at: now };
}
function userFromAuth(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return null;
  try {
    const claimsJ = JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString());
    if (claimsJ.exp * 1000 < Date.now() || !users[claimsJ.sub]) return 'bad';
    return users[claimsJ.sub];
  } catch { return 'bad'; }
}
function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers || {}));
  res.end(body === undefined ? '' : JSON.stringify(body));
}
const fail = (res, status, code, message) => send(res, status, { detail: { code, message: message || code } });
function readBody(req) {
  return new Promise(resolve => {
    let s = ''; req.on('data', c => { s += c; }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } });
  });
}

function segments(v, mode) {
  const words = mode === 'easy' ? [v.easy_blank] : v.blanks;
  const spans = words.map(w => { const m = wordRe(w).exec(v.text); return [m.index, m.index + m[0].length]; });
  const out = []; let cur = 0;
  spans.forEach(([s, e], id) => { if (s > cur) out.push({ t: 'text', v: v.text.slice(cur, s) }); out.push({ t: 'blank', id }); cur = e; });
  if (cur < v.text.length) out.push({ t: 'text', v: v.text.slice(cur) });
  return out;
}
function seededShuffle(list, seed) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = parseInt(crypto.createHash('sha256').update(seed + '|' + i).digest('hex').slice(0, 8), 16) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
function question(run, pos) {
  const id = run.verse_order[pos];
  if (id == null) return null;
  const v = byId[id];
  const q = { position: pos, verse_id: v.id, reference: v.reference, segments: segments(v, run.mode) };
  if (run.mode === 'easy') q.options = seededShuffle([v.easy_blank, ...v.easy_wrong], run.id + v.id);
  if (run.mode === 'medium') q.options = seededShuffle([...v.blanks, ...v.medium_wrong], run.id + v.id);
  return q;
}
const plain = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
  return d[a.length][b.length];
}
function grade(v, mode, answers) {
  const want = mode === 'easy' ? [v.easy_blank] : v.blanks;
  const right = want.map((w, i) => {
    const got = answers[i] == null ? '' : answers[i];
    if (mode !== 'hard') return String(got).trim().toLowerCase() === w.toLowerCase();
    const a = plain(got), b = plain(w);
    return !!a && (a === b || (b.length >= 5 && lev(a, b) <= 1));
  });
  return { right, points: mode === 'easy' ? (right[0] ? 1 : 0) : POINTS[mode] * right.filter(Boolean).length };
}
const isOver = (r, now) => !!r.finished_at || now > Date.parse(r.deadline_at) + GRACE_MS;
function close(r, now) { if (!r.finished_at) r.finished_at = new Date(Math.min(now, Date.parse(r.deadline_at))).toISOString(); }
function correctWords(v, mode) { return (mode === 'easy' ? [v.easy_blank] : v.blanks).map(w => wordRe(w).exec(v.text)[0]); }

function board(day, now) {
  const list = Object.values(runs).filter(r => r.kind === 'daily' && r.game_day === day && !r.flagged && r.user_id && isOver(r, now))
    .filter(r => profiles[r.user_id] && profiles[r.user_id].username && profiles[r.user_id].email_verified_at)
    .sort((a, b) => b.score - a.score || a.words_wrong - b.words_wrong ||
      Date.parse(a.finished_at || a.deadline_at) - Date.parse(b.finished_at || b.deadline_at));
  return list.map((r, i) => ({ r, row: { rank: i + 1, username: profiles[r.user_id].username, mode: r.mode, score: r.score, words_wrong: r.words_wrong } }));
}
function streakFor(key, val, now) {
  const days = new Set(Object.values(runs).filter(r => r.kind === 'daily' && r[key] === val && isOver(r, now)).map(r => r.game_day));
  let d = gameDay(now); if (!days.has(d)) d = addDays(d, -1);
  let n = 0; while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function usernameProblem(u) {
  if (typeof u !== 'string' || u.length < 3) return 'too_short';
  if (u.length > 20) return 'too_long';
  if (!/^[A-Za-z0-9_]+$/.test(u)) return 'invalid_characters';
  const l = u.toLowerCase();
  if (RESERVED.includes(l) || RESERVED.includes(l.replace(/[_0-9]/g, ''))) return 'reserved';
  const n = l.replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't').replace(/[_0-9]/g, '');
  if (PROFANE.some(p => n.includes(p))) return 'profane';
  return null;
}
function profile(user) {
  if (!profiles[user.id]) profiles[user.id] = { username: null, email_verified_at: null };
  const p = profiles[user.id];
  if (!p.email_verified_at && ['google', 'apple'].includes(user.provider)) p.email_verified_at = new Date().toISOString();
  return p;
}

// ── /__mock/api/seed-rush/* ─────────────────────────────────────────────────
async function mockApi(req, res, route, query) {
  const now = Date.now();
  const user = userFromAuth(req);
  if (user === 'bad') return send(res, 401, { detail: 'Invalid or expired token.' });
  const guestHeader = req.headers['x-seed-rush-guest'];
  const caller = () => {
    if (user) return { user_id: user.id, guest_id: null };
    if (guestHeader) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guestHeader)) return 'badguest';
      return { user_id: null, guest_id: guestHeader.toLowerCase() };
    }
    return null;
  };
  const body = req.method === 'GET' ? {} : await readBody(req);
  let m;

  if (route === '/seed-rush/day' && req.method === 'GET') {
    const day = gameDay(now);
    return send(res, 200, { game_day: day, starts_at: new Date(dayStart(day)).toISOString(),
      next_day_starts_at: new Date(dayStart(addDays(day, 1))).toISOString(), server_time: new Date(now).toISOString(),
      timezone: 'America/New_York', start_hour: 7 });
  }
  if (route === '/seed-rush/verses' && req.method === 'GET') {
    return send(res, 200, { verses: SNAPSHOT }, { 'Cache-Control': 'public, max-age=3600' });
  }
  if (route === '/seed-rush/runs' && req.method === 'POST') {
    const c = caller();
    if (c === 'badguest') return fail(res, 400, 'invalid_guest_id');
    if (!c) return send(res, 401, { detail: 'Sign in, or send a Seed Rush guest id.' });
    if (!['daily', 'practice'].includes(body.kind) || !POINTS[body.mode]) return send(res, 422, { detail: [{ msg: 'invalid' }] });
    if (START_DELAY) await new Promise(r => setTimeout(r, START_DELAY));
    const day = gameDay(Date.now());
    if (body.kind === 'daily' && Object.values(runs).some(r => r.kind === 'daily' && r.game_day === day &&
      ((c.user_id && r.user_id === c.user_id) || (c.guest_id && r.guest_id === c.guest_id)))) {
      return fail(res, 409, 'already_played', "You've already played today's Seed Rush.");
    }
    const ids = VERSES.map(v => v.id);
    const order = body.kind === 'daily' ? seededShuffle(ids, 'daily|' + day + '|' + body.mode) : seededShuffle(ids, crypto.randomUUID());
    const t = Date.now();
    const run = { id: crypto.randomUUID(), user_id: c.user_id, guest_id: c.guest_id, kind: body.kind, mode: body.mode,
      game_day: body.kind === 'daily' ? day : null, verse_order: order, current_index: 0,
      started_at: new Date(t).toISOString(), deadline_at: new Date(t + RUN_MS).toISOString(), served: t,
      finished_at: null, score: 0, words_right: 0, words_wrong: 0, flagged: false, answers: [] };
    runs[run.id] = run;
    return send(res, 200, { run_id: run.id, kind: run.kind, mode: run.mode, game_day: run.game_day, started_at: run.started_at,
      deadline_at: run.deadline_at, server_time: new Date(t).toISOString(), duration_seconds: 60,
      total_verses: order.length, question: question(run, 0) });
  }
  if ((m = /^\/seed-rush\/runs\/([^/]+)\/(answer|finish)$/.exec(route)) && req.method === 'POST') {
    const c = caller();
    if (c === 'badguest') return fail(res, 400, 'invalid_guest_id');
    if (!c) return send(res, 401, { detail: 'Sign in, or send a Seed Rush guest id.' });
    const run = runs[m[1]];
    if (!run || (c.user_id ? run.user_id !== c.user_id : run.guest_id !== c.guest_id)) return fail(res, 404, 'run_not_found', 'Run not found.');
    if (m[2] === 'answer') {
      if (run.finished_at) return fail(res, 409, 'run_finished');
      if (now > Date.parse(run.deadline_at) + GRACE_MS) { close(run, now); return fail(res, 409, 'time_up'); }
      if (body.position < run.current_index) return fail(res, 409, 'already_answered');
      if (body.position !== run.current_index || run.current_index >= run.verse_order.length) return fail(res, 409, 'wrong_position');
      const v = byId[run.verse_order[run.current_index]];
      const want = run.mode === 'easy' ? 1 : 3;
      if (!Array.isArray(body.answers) || body.answers.length !== want) return fail(res, 422, 'wrong_answer_count');
      const g = grade(v, run.mode, body.answers);
      const elapsed = now - run.served;
      if (elapsed < MIN_MS[run.mode]) run.flagged = true;
      run.answers.push({ position: run.current_index, verse_id: v.id, submitted: body.answers, correct: g.right, points: g.points });
      const right = g.right.filter(Boolean).length;
      run.score += g.points; run.words_right += right; run.words_wrong += g.right.length - right;
      run.current_index++; run.served = now;
      const finished = run.current_index >= run.verse_order.length || now >= Date.parse(run.deadline_at);
      if (finished) close(run, now);
      const words = correctWords(v, run.mode);
      return send(res, 200, { position: body.position, results: g.right.map((r, i) => ({ id: i, right: r, correct: words[i] })),
        points: g.points, score: run.score, words_right: run.words_right, words_wrong: run.words_wrong, finished,
        question: finished ? null : question(run, run.current_index), deadline_at: run.deadline_at, server_time: new Date(now).toISOString() });
    }
    close(run, now);
    const seen = run.answers.map(a => {
      const v = byId[a.verse_id]; const words = correctWords(v, run.mode);
      return { position: a.position, verse_id: v.id, slug: v.slug, reference: v.reference, answered: true,
        right: a.correct.every(Boolean), points: a.points,
        blanks: words.map((w, i) => ({ id: i, right: !!a.correct[i], correct: w, submitted: a.submitted[i] })) };
    });
    if (run.current_index < run.verse_order.length) {
      const v = byId[run.verse_order[run.current_index]];
      seen.push({ position: run.current_index, verse_id: v.id, slug: v.slug, reference: v.reference, answered: false, right: false, points: 0 });
    }
    let rank = null;
    if (run.kind === 'daily' && run.user_id && !run.flagged) {
      const mine = board(run.game_day, now).find(x => x.r.id === run.id); rank = mine ? mine.row.rank : null;
    }
    return send(res, 200, { run_id: run.id, kind: run.kind, mode: run.mode, game_day: run.game_day, score: run.score,
      words_right: run.words_right, words_wrong: run.words_wrong, finished_at: run.finished_at, verses: seen,
      streak: run.user_id ? streakFor('user_id', run.user_id, now) : streakFor('guest_id', run.guest_id, now), rank });
  }
  if (route === '/seed-rush/leaderboard' && req.method === 'GET') {
    const day = query.get('day') || gameDay(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail(res, 422, 'invalid_day');
    const b = board(day, now);
    const mine = user ? b.find(x => x.r.user_id === user.id) : null;
    if (user) profile(user);
    return send(res, 200, { game_day: day, entries: b.slice(0, 100).map(x => x.row), me: mine ? mine.row : null });
  }
  if (route === '/seed-rush/username/check' && req.method === 'GET') {
    const u = query.get('u') || '';
    const p = usernameProblem(u);
    if (p) return send(res, 200, { username: u, valid: false, available: false, reason: p });
    const taken = Object.values(profiles).some(x => x.username && x.username.toLowerCase() === u.toLowerCase());
    return send(res, 200, { username: u, valid: true, available: !taken, reason: taken ? 'taken' : null });
  }

  // Signed-in only from here.
  if (!user) return send(res, 401, { detail: 'Missing bearer token.' });
  const p = profile(user);

  if (route === '/seed-rush/me' && req.method === 'GET') {
    const day = gameDay(now);
    const today = Object.values(runs).find(r => r.user_id === user.id && r.kind === 'daily' && r.game_day === day);
    return send(res, 200, { username: p.username, email_verified: !!p.email_verified_at, email_verified_at: p.email_verified_at,
      streak: streakFor('user_id', user.id, now), game_day: day, played_today: !!today,
      today_run: today ? { run_id: today.id, mode: today.mode, score: today.score, finished: isOver(today, now) } : null });
  }
  if (route === '/seed-rush/username' && req.method === 'PUT') {
    const prob = usernameProblem(body.username);
    if (prob) return fail(res, 400, prob, "That username isn't allowed.");
    const owner = Object.entries(profiles).find(([, x]) => x.username && x.username.toLowerCase() === body.username.toLowerCase());
    if (owner && owner[0] !== user.id) return fail(res, 409, 'taken', 'That username is taken.');
    p.username = body.username;
    return send(res, 200, { username: body.username });
  }
  if (route === '/seed-rush/verification/send' && req.method === 'POST') {
    if (p.email_verified_at) return send(res, 200, { status: 'already_verified' });
    p.sends = (p.sends || []).filter(t => now - t < 3600000);
    if (p.sends.length >= 3) return fail(res, 429, 'rate_limited', 'Too many emails. Try again later.');
    p.sends.push(now);
    if (process.env.SR_MOCK_RESEND_DOWN) return send(res, 200, { status: 'delayed' });
    const token = crypto.randomBytes(24).toString('base64url');
    p.token = token; p.tokenExp = now + 24 * 3600000;
    lastLink = 'http://127.0.0.1:' + PORT + '/seed-rush/verify?token=' + token;
    console.log('  [mock] verification link for ' + user.email + ': ' + lastLink);
    return send(res, 200, { status: 'sent' });
  }
  if (route === '/seed-rush/guest/claim' && req.method === 'POST') {
    const g = String(body.guest_id || '').toLowerCase();
    if (!/^[0-9a-f-]{36}$/.test(g)) return fail(res, 400, 'invalid_guest_id');
    if (claims[g]) {
      if (claims[g] === user.id) return send(res, 200, { claimed_runs: 0, skipped_runs: 0, already_claimed: true, streak: streakFor('user_id', user.id, now) });
      return fail(res, 409, 'already_claimed');
    }
    claims[g] = user.id;
    const taken = new Set(Object.values(runs).filter(r => r.user_id === user.id && r.kind === 'daily').map(r => r.game_day));
    let moved = 0, skipped = 0;
    for (const r of Object.values(runs).filter(x => x.guest_id === g)) {
      if (r.kind === 'daily' && taken.has(r.game_day)) { skipped++; continue; }
      r.user_id = user.id; r.guest_id = null; moved++;
      if (r.kind === 'daily') taken.add(r.game_day);
    }
    return send(res, 200, { claimed_runs: moved, skipped_runs: skipped, already_claimed: false, streak: streakFor('user_id', user.id, now) });
  }
  return fail(res, 404, 'not_found', 'No such mock route: ' + req.method + ' ' + route);
}

// The confirm route is public, so it sits outside the signed-in block above.
async function mockConfirm(req, res) {
  const body = await readBody(req);
  const entry = Object.values(profiles).find(p => p.token && p.token === body.token);
  if (!entry) return fail(res, 400, 'invalid_token');
  if (Date.now() > entry.tokenExp) return fail(res, 400, 'expired_token');
  entry.email_verified_at = new Date().toISOString(); entry.token = null;
  return send(res, 200, { status: 'verified' });
}

// ── /__mock/supabase/auth/v1/* (just enough of Supabase Auth for supabase-js) ─
async function mockAuth(req, res, route, query) {
  const authErr = (code, msg) => send(res, 400, { code: 400, error_code: code, msg });
  if (route === '/auth/v1/signup' && req.method === 'POST') {
    const b = await readBody(req);
    if (b.data && Object.keys(b.data).length) { audit.metadataWrites++; console.warn('  [mock] WARNING: sign-up carried user metadata', b.data); }
    if (!b.email || !/@/.test(b.email)) return authErr('email_address_invalid', 'Unable to validate email address: invalid format');
    if (!b.password || b.password.length < 6) return authErr('weak_password', 'Password should be at least 6 characters.');
    if (Object.values(users).some(u => u.email === b.email.toLowerCase())) return authErr('user_already_exists', 'User already registered');
    const u = { id: crypto.randomUUID(), email: b.email.toLowerCase(), password: b.password, provider: 'email' };
    users[u.id] = u;
    return send(res, 200, mintSession(u));
  }
  if (route === '/auth/v1/token' && req.method === 'POST') {
    const b = await readBody(req);
    if (query.get('grant_type') === 'password') {
      const u = Object.values(users).find(x => x.email === String(b.email || '').toLowerCase() && x.password === b.password);
      if (!u) return authErr('invalid_credentials', 'Invalid login credentials');
      return send(res, 200, mintSession(u));
    }
    if (query.get('grant_type') === 'refresh_token') {
      const uid = tokens[b.refresh_token];
      if (!uid) return authErr('refresh_token_not_found', 'Invalid Refresh Token');
      return send(res, 200, mintSession(users[uid]));
    }
  }
  if (route === '/auth/v1/user' && req.method === 'GET') {
    const u = userFromAuth(req);
    if (!u || u === 'bad') return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
    return send(res, 200, publicUser(u));
  }
  if (route === '/auth/v1/user' && req.method === 'PUT') {
    audit.metadataWrites++; console.warn('  [mock] WARNING: something tried to update the auth user');
    return send(res, 403, { msg: 'not allowed in the mock' });
  }
  if (route === '/auth/v1/logout' && req.method === 'POST') return send(res, 204);
  if (route === '/auth/v1/authorize' && req.method === 'GET') {
    // "Continue with Google": a Google account, signed straight in.
    let u = Object.values(users).find(x => x.provider === 'google');
    if (!u) { u = { id: crypto.randomUUID(), email: 'google.player@example.test', password: null, provider: 'google' }; users[u.id] = u; }
    const s = mintSession(u);
    const to = query.get('redirect_to') || '/seed-rush';
    const hash = new URLSearchParams({ access_token: s.access_token, refresh_token: s.refresh_token, expires_in: '3600',
      expires_at: String(s.expires_at), token_type: 'bearer', provider_token: 'mock' }).toString();
    res.writeHead(302, { Location: to + '#' + hash });
    return res.end();
  }
  return send(res, 404, { msg: 'mock auth: unsupported ' + req.method + ' ' + route });
}

// ── server ──────────────────────────────────────────────────────────────────
const site = siteHandler(ROOT);
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  try {
    if (u.pathname === '/__mock/last-link') return send(res, 200, { link: lastLink });
    if (u.pathname === '/__mock/audit') return send(res, 200, audit);
    if (u.pathname === '/__mock/seed-streak') {   // test hook: give the caller N past daily runs
      const user = userFromAuth(req);
      if (!user || user === 'bad') return send(res, 401, { detail: 'sign in first' });
      const days = Math.min(60, Number(u.searchParams.get('days') || 0));
      const today = gameDay(Date.now());
      for (let d = 1; d <= days; d++) {
        const day = addDays(today, -d), t = dayStart(day) + 3600000;
        const id = crypto.randomUUID();
        runs[id] = { id, user_id: user.id, guest_id: null, kind: 'daily', mode: 'easy', game_day: day, verse_order: [1],
          current_index: 1, started_at: new Date(t).toISOString(), deadline_at: new Date(t + RUN_MS).toISOString(),
          finished_at: new Date(t + 40000).toISOString(), score: 5, words_right: 5, words_wrong: 1, flagged: false, answers: [] };
      }
      return send(res, 200, { ok: true, streak: streakFor('user_id', user.id, Date.now()) });
    }
    if (u.pathname === '/__mock/expire-runs') {   // test hook: end every run's clock now
      for (const r of Object.values(runs)) if (!r.finished_at) r.deadline_at = new Date(Date.now() - GRACE_MS - 1).toISOString();
      return send(res, 200, { ok: true });
    }
    if (u.pathname.startsWith('/__mock/api/')) {
      const route = u.pathname.slice('/__mock/api'.length);
      if (route === '/seed-rush/verification/confirm' && req.method === 'POST') return mockConfirm(req, res);
      return mockApi(req, res, route, u.searchParams);
    }
    if (u.pathname.startsWith('/__mock/supabase/')) return mockAuth(req, res, u.pathname.slice('/__mock/supabase'.length), u.searchParams);
  } catch (err) {
    console.error(err);
    return send(res, 500, { detail: 'mock crashed: ' + err.message });
  }

  // The real site, with the real netlify.toml headers — except that connect-src
  // also allows localhost, so ?api=http://127.0.0.1:8000 reaches a local backend.
  const writeHead = res.writeHead;
  res.writeHead = function (status, headers) {
    if (headers && headers['Content-Security-Policy']) {
      headers['Content-Security-Policy'] = headers['Content-Security-Policy']
        .replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:* http://localhost:*");
    }
    return writeHead.apply(this, arguments);
  };
  site(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Seed Rush dev server (mock backend + mock sign-in): http://127.0.0.1:' + PORT);
  console.log('Open http://127.0.0.1:' + PORT + '/seed-rush?api=mock&auth=mock');
});
