/* ============================================================
   Seed Rush — the daily verse game on dollarseeds.app.

   Sections:
     1. Utilities          small DOM, storage and time helpers
     2. Config and API     endpoints, the fetch wrapper, error messages
     3. Accounts           Supabase sign-in, the guest id, /me, guest claim
     4. Dialogs            the shared modal, account, username prompt
     5. Leaderboard        (a dialog)
     6. Toolbar            How to play, the toolbar, the streak plant
     7. The game           /seed-rush (daily) and /seed-rush/practice: landing,
                           pre-run, play — all states of one page
     8. End of run         plant, score, share, verses seen
     9. Study              /seed-rush/study
    10. Verify             /seed-rush/verify
    11. Boot

   The server keeps the answers, the clock and the score: this file never
   decides right or wrong, and never sends a score. Nothing here writes to
   Supabase user metadata — the app uses it to decide whether to show its own
   onboarding. Seed Rush data only goes through the backend.
   ============================================================ */
(function () {
  'use strict';

  // ══ 1. Utilities ════════════════════════════════════════════════════════

  var CFG = window.SEED_RUSH_CONFIG || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MODE_NAMES = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  var MODE_INFO = {
    easy: ['1 blank, pick from 3 words', '1 point per verse'],
    medium: ['3 blanks, pick from 6 words', '2 points per correct word'],
    hard: ['3 blanks, type the words', '5 points per correct word']
  };
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** h('p', {class: 'x', onclick: fn}, 'text', child) */
  function h(tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, '');
        else node.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }
  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(child.nodeType ? child : document.createTextNode(String(child)));
  }
  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /** localStorage, JSON, never throwing (private windows, blocked storage). */
  var store = {
    get: function (k) { try { var v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var x = Array.prototype.map.call(b, function (n) { return (n + 256).toString(16).slice(1); }).join('');
    return x.slice(0, 8) + '-' + x.slice(8, 12) + '-' + x.slice(12, 16) + '-' + x.slice(16, 20) + '-' + x.slice(20);
  }

  /** "2026-11-05" → "Nov 5" (no time zone involved). */
  function shortDate(day) {
    var p = String(day || '').split('-');
    return p.length === 3 ? MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) : '';
  }
  function prevDay(day) {
    var d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function toast(text) {
    var old = $('.sr-toast'); if (old) old.remove();
    var t = h('div', { class: 'sr-toast', role: 'status' }, text);
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }

  // ══ 2. Config and API ═══════════════════════════════════════════════════

  // Local testing only: ?api=http://127.0.0.1:8000 (and ?auth= for a local
  // auth stand-in), remembered for the tab. Ignored on any other host.
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  function override(param, key) {
    if (!isLocal) return null;
    var q = new URLSearchParams(location.search).get(param);
    try {
      if (q) sessionStorage.setItem(key, q);
      return q || sessionStorage.getItem(key);
    } catch (e) { return q; }
  }
  // "mock" means tools/seed-rush-dev.js on this same origin (dev only).
  function local(param, key, mockPath) {
    var v = override(param, key);
    return v === 'mock' ? location.origin + mockPath : v;
  }
  var API = String(local('api', 'sr.api', '/__mock/api') || CFG.api || '').replace(/\/+$/, '');
  var SUPABASE_URL = local('auth', 'sr.auth', '/__mock/supabase') || CFG.supabaseUrl;

  /** Every error code the backend sends (detail.code), in plain words. */
  var MESSAGES = {
    already_played: "You've already played today's Seed Rush. A new round starts at 7:00 AM Eastern.",
    run_finished: 'This run has already finished.',
    time_up: "Time's up!",
    already_answered: 'That verse was already answered.',
    wrong_position: 'That answer arrived out of order.',
    wrong_answer_count: 'Fill in every blank before checking.',
    run_not_found: "We couldn't find that run.",
    invalid_guest_id: 'Your guest session was reset. Please try again.',
    invalid_token: "This link isn't valid. It may have been used already.",
    expired_token: 'This link has expired.',
    no_email: "Your account doesn't have an email address we can verify.",
    taken: 'That username is taken.',
    too_short: 'Usernames need at least 3 characters.',
    too_long: 'Usernames can be 20 characters at most.',
    invalid_characters: 'Use letters, numbers and underscores only.',
    reserved: "That username is reserved. Please pick another.",
    profane: "That username isn't allowed. Please pick another.",
    already_claimed: 'This guest progress was already added to an account.',
    rate_limited: 'Too many tries. Wait a moment and try again.',
    invalid_day: "That day isn't valid.",
    no_verses: 'Seed Rush is getting its verses ready. Please check back soon.',
    verse_missing: 'A verse in this run is no longer available. Please start a new run.',
    unauthorized: 'Your sign-in expired. Please sign in again.',
    invalid_request: 'Something was wrong with that request. Please reload and try again.',
    server: 'Something went wrong on our side. Please try again in a minute.',
    network: 'Seed Rush is unavailable right now. Please try again in a minute.',
    unavailable: 'Seed Rush is unavailable right now. Please try again in a minute.'
  };
  function messageFor(code) { return MESSAGES[code] || MESSAGES.server; }

  function ApiError(status, code) {
    this.status = status; this.code = code; this.message = messageFor(code);
  }
  ApiError.prototype = Object.create(Error.prototype);

  var serverOffset = 0;   // server clock − browser clock, in ms

  /**
   * One backend call. opts.auth:
   *   'player'   (default) the signed-in user, else the guest id
   *   'user'     the signed-in user only
   *   'optional' the signed-in user if any, else nothing
   *   'none'     never identify
   * opts.guestId pins the guest id (a run started as a guest stays one).
   */
  function api(method, path, body, opts) {
    opts = opts || {};
    var mode = opts.auth || 'player';
    return (mode === 'none' || opts.guestId ? Promise.resolve(null) : Auth.token()).then(function (token) {
      var headers = {};
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (token) headers.Authorization = 'Bearer ' + token;
      else if (mode === 'player') headers['X-Seed-Rush-Guest'] = opts.guestId || Guest.id();
      else if (mode === 'user') return Promise.reject(new ApiError(401, 'unauthorized'));

      var controller = 'AbortController' in window ? new AbortController() : null;
      var timer = controller && setTimeout(function () { controller.abort(); }, opts.timeout || 70000);
      var sent = Date.now();
      return fetch(API + path, {
        method: method, headers: headers, cache: 'no-store',
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller ? controller.signal : undefined
      }).then(function (res) {
        if (timer) clearTimeout(timer);
        return res.json().catch(function () { return null; }).then(function (data) {
          if (res.ok) {
            if (data && data.server_time) {
              var received = Date.now();
              serverOffset = Date.parse(data.server_time) - (sent + received) / 2;
            }
            return data;
          }
          var d = data && data.detail;
          var code = d && typeof d === 'object' && !Array.isArray(d) && d.code ? d.code
            : res.status === 401 ? 'unauthorized'
              // A bare 404 means the route itself is missing (backend not deployed yet).
              : res.status === 404 ? 'unavailable'
              : res.status === 422 ? 'invalid_request'
                : res.status === 429 ? 'rate_limited' : 'server';
          if (code === 'unauthorized' && token) {
            // A stale session: forget it locally, and for public reads try again anonymously.
            return Auth.forget().then(function () {
              if (mode === 'optional') return api(method, path, body, { auth: 'none' });
              throw new ApiError(401, code);
            });
          }
          if (code === 'invalid_guest_id') Guest.reset();
          throw new ApiError(res.status, code);
        });
      }, function () {
        if (timer) clearTimeout(timer);
        throw new ApiError(0, 'network');
      });
    });
  }

  function isTransient(e) {
    return e && (e.code === 'network' || e.code === 'server' || e.status === 502 || e.status === 504);
  }

  /**
   * A call that may hit a sleeping backend: "Waking up the game…" after 3 s,
   * one retry, then the unavailable message.
   */
  function withWake(fn, onWaiting) {
    var timer = setTimeout(function () { onWaiting && onWaiting(true); }, 3000);
    return fn().catch(function (e) {
      if (!isTransient(e)) throw e;
      onWaiting && onWaiting(true);
      return sleep(1500).then(fn).catch(function (e2) {
        throw isTransient(e2) ? new ApiError(0, 'unavailable') : e2;
      });
    }).then(function (v) {
      clearTimeout(timer); onWaiting && onWaiting(false); return v;
    }, function (e) {
      clearTimeout(timer); onWaiting && onWaiting(false); throw e;
    });
  }

  /** The game day and when the next one starts (and wakes the backend). */
  var Day = {
    data: null,
    load: function () {
      return api('GET', '/seed-rush/day', undefined, { auth: 'none', timeout: 70000 }).then(function (d) {
        Day.data = d; return d;
      });
    },
    today: function () { return Day.data && Day.data.game_day; },
    msToNext: function () {
      return Day.data ? Date.parse(Day.data.next_day_starts_at) - (Date.now() + serverOffset) : null;
    }
  };

  function countdownText(ms) {
    if (ms == null) return '–';
    ms = Math.max(0, ms);
    var s = Math.floor(ms / 1000), hrs = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60), sec = s % 60;
    return (hrs ? hrs + 'h ' : '') + (hrs || min ? String(min).padStart(hrs ? 2 : 1, '0') + 'm ' : '') +
      String(sec).padStart(2, '0') + 's';
  }

  /** "14:22:05" */
  function clockText(ms) {
    if (ms == null) return '–';
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 3600) + ':' + String(Math.floor((s % 3600) / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /** Keep an element showing the time to the next round. */
  function liveCountdown(node, onZero, format) {
    function paint() {
      // A re-drawn screen leaves this node behind: stop its timer.
      if (painted && !node.isConnected) { clearInterval(timer); return; }
      painted = true;
      var ms = Day.msToNext();
      node.textContent = (format || countdownText)(ms);
      if (ms != null && ms <= 0) {
        clearInterval(timer);
        Day.load().then(function () { if (onZero) onZero(); else liveCountdown(node, null, format); }, function () {});
      }
    }
    var painted = false;
    var timer = setInterval(paint, 1000);
    paint();
    return timer;
  }

  // ══ 3. Accounts ═════════════════════════════════════════════════════════

  var Guest = {
    id: function () {
      var id = store.get('sr.guest');
      if (!id) { id = uuid(); store.set('sr.guest', id); }
      return id;
    },
    reset: function () {
      store.set('sr.guest', uuid());
      store.del('sr.guestPlayed'); store.del('sr.guestStreak');
    }
  };

  var Auth = {
    sb: null,
    user: null,
    me: null,           // GET /seed-rush/me, when signed in
    listeners: [],
    ready: null,

    init: function () {
      if (!window.supabase || !window.supabase.createClient || !CFG.supabasePublishableKey) {
        Auth.ready = Promise.resolve(null);
        return;
      }
      Auth.sb = window.supabase.createClient(SUPABASE_URL, CFG.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      // Back from Google: Supabase reads the tokens from the URL while the client
      // starts, before the listener below exists, so its SIGNED_IN is missed.
      var oauthReturn = /[#&?](access_token|code)=/.test(location.hash + location.search);
      Auth.ready = Auth.sb.auth.getSession().then(function (r) {
        Auth.user = r.data && r.data.session ? r.data.session.user : null;
        if (Auth.user && oauthReturn) setTimeout(Auth.afterSignIn, 0);
        return Auth.user;
      }, function () { return null; });
      Auth.sb.auth.onAuthStateChange(function (event, session) {
        var was = Auth.user && Auth.user.id;
        Auth.user = session ? session.user : null;
        // Never call back into Supabase from inside this callback (it can deadlock):
        // defer the follow-up work.
        setTimeout(function () {
          if (event === 'SIGNED_OUT') { Auth.me = null; Auth.emit(); return; }
          if (event === 'SIGNED_IN' && Auth.user && Auth.user.id !== was) Auth.afterSignIn();
        }, 0);
      });
    },

    token: function () {
      if (!Auth.sb) return Promise.resolve(null);
      return Auth.sb.auth.getSession().then(function (r) {
        return r.data && r.data.session ? r.data.session.access_token : null;
      }, function () { return null; });
    },

    on: function (fn) { Auth.listeners.push(fn); },
    emit: function () { Auth.listeners.forEach(function (fn) { try { fn(); } catch (e) { /* keep going */ } }); },

    /** GET /me — also what marks Google sign-ins verified on the backend. */
    refreshMe: function () {
      if (!Auth.user) { Auth.me = null; return Promise.resolve(null); }
      return api('GET', '/seed-rush/me', undefined, { auth: 'user' }).then(function (me) {
        Auth.me = me; return me;
      }, function () { return Auth.me; });
    },

    afterSignIn: function () {
      return Auth.refreshMe().then(function () {
        return Claim.maybe();
      }).then(function () {
        Auth.emit();
        if (Auth.me && !Auth.me.username) AccountDialog.open('username');
      });
    },

    forget: function () {
      if (!Auth.sb) return Promise.resolve();
      Auth.user = null; Auth.me = null;
      return Auth.sb.auth.signOut({ scope: 'local' }).catch(function () {}).then(function () { Auth.emit(); });
    },

    signOut: function () {
      if (!Auth.sb) return Promise.resolve();
      return Auth.sb.auth.signOut().catch(function () {
        return Auth.sb.auth.signOut({ scope: 'local' });
      }).then(function () { Auth.user = null; Auth.me = null; Auth.emit(); });
    },

    signIn: function (email, password) {
      return Auth.sb.auth.signInWithPassword({ email: email, password: password });
    },

    /** No `data` / metadata on purpose: see the header comment. */
    signUp: function (email, password) {
      return Auth.sb.auth.signUp({ email: email, password: password });
    },

    google: function () {
      return Auth.sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: location.origin + location.pathname }
      });
    }
  };

  function authMessage(err) {
    var code = err && (err.code || '');
    var msg = err && err.message ? String(err.message) : '';
    if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return "That email and password don't match.";
    if (code === 'user_already_exists' || /already registered/i.test(msg)) return 'An account with this email already exists. Sign in instead.';
    if (code === 'weak_password' || /password should/i.test(msg)) return msg || 'Please choose a longer password.';
    if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return "That email address doesn't look right.";
    if (code === 'email_not_confirmed') return 'Please confirm your email address first.';
    if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a moment and try again.';
    if (/fetch|network/i.test(msg)) return "We couldn't reach the sign-in service. Check your connection and try again.";
    return msg || 'Something went wrong. Please try again.';
  }

  /** Move a guest's runs (and streak) to the account after sign-in. */
  var Claim = {
    pending: false,
    maybe: function () {
      if (!Auth.user) return Promise.resolve();
      if (Game.active) { Claim.pending = true; return Promise.resolve(); }
      if (!store.get('sr.guestPlayed')) return Promise.resolve();
      Claim.pending = false;
      var gid = Guest.id();
      return api('POST', '/seed-rush/guest/claim', { guest_id: gid }, { auth: 'user' }).then(function (res) {
        Guest.reset();
        if (res && res.claimed_runs > 0) {
          toast(res.streak > 1 ? 'Your ' + res.streak + '-day streak came with you. 🌱'
            : 'Your guest runs are now saved to your account.');
        }
        return Auth.refreshMe();
      }, function (e) {
        if (e.code === 'already_claimed') Guest.reset();
      });
    }
  };

  // ══ 4. Dialogs and the account area ═════════════════════════════════════

  /**
   * One modal <dialog> at a time. showModal() makes the page behind inert; Tab
   * also wraps inside the dialog, Esc closes it, and focus returns to whatever
   * opened it. On phones it is a full-width sheet (seed-rush.css).
   */
  var Modal = {
    node: null,
    titleEl: null,
    open: function (title, build, opts) {
      opts = opts || {};
      Modal.close(true);
      var opener = document.activeElement;
      var titleEl = h('h2', { class: 'sr-modal-title', id: 'sr-modal-title' }, title);
      var body = h('div', { class: 'sr-modal-body' });
      var dlg = h('dialog', { class: 'sr-modal', 'aria-labelledby': 'sr-modal-title' },
        h('div', { class: 'sr-modal-inner' },
          h('div', { class: 'sr-modal-head' }, titleEl,
            h('button', { class: 'sr-close', type: 'button', 'aria-label': 'Close', title: 'Close',
              onclick: function () { dlg.close(); } }, '×')),
          body));
      Modal.node = dlg; Modal.titleEl = titleEl;
      document.body.appendChild(dlg);
      dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
      dlg.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Tab') return;
        var f = $all('a[href], button:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])', dlg)
          .filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
      });
      dlg.addEventListener('close', function () {
        dlg.remove();
        if (Modal.node === dlg) Modal.node = null;
        if (dlg.silent) return;
        if (opener && opener.focus && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
        if (opts.onClose) opts.onClose();
      });
      build(body);
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      return dlg;
    },
    setTitle: function (t) { if (Modal.titleEl) Modal.titleEl.textContent = t; },
    /** silent: replaced by another dialog — no focus return, no onClose. */
    close: function (silent) {
      if (!Modal.node) return;
      Modal.node.silent = !!silent;
      Modal.node.close();
    }
  };

  var USERNAME_REASONS = {
    too_short: 'Too short: at least 3 characters.',
    too_long: 'Too long: 20 characters at most.',
    invalid_characters: 'Letters, numbers and underscores only.',
    reserved: "That name is reserved.",
    profane: "That name isn't allowed.",
    taken: 'That name is taken.'
  };

  function quickUsernameProblem(u) {
    if (u.length < 3) return 'too_short';
    if (u.length > 20) return 'too_long';
    if (!/^[A-Za-z0-9_]+$/.test(u)) return 'invalid_characters';
    return null;
  }

  /** The username field: debounced live check, then save. */
  function usernameForm(onSaved) {
    var input = h('input', {
      class: 'sr-input', id: 'sr-username', name: 'username', autocomplete: 'off', autocapitalize: 'off',
      spellcheck: 'false', maxlength: '20', required: true, 'aria-describedby': 'sr-username-hint'
    });
    var hint = h('p', { class: 'sr-hint', id: 'sr-username-hint', 'aria-live': 'polite' },
      'Letters, numbers and underscores.');
    var save = h('button', { class: 'sr-btn sr-btn-primary', type: 'submit', disabled: true }, 'Save username');
    var timer = null, seq = 0, okFor = null;

    function setHint(text, kind) {
      hint.textContent = text;
      hint.className = 'sr-hint' + (kind ? ' is-' + kind : '');
    }
    input.addEventListener('input', function () {
      var u = input.value.trim();
      okFor = null; save.disabled = true; clearTimeout(timer);
      if (!u) { setHint('Letters, numbers and underscores.'); return; }
      var quick = quickUsernameProblem(u);
      if (quick) { setHint(USERNAME_REASONS[quick], 'bad'); return; }
      setHint('Checking…');
      var mine = ++seq;
      timer = setTimeout(function () {
        api('GET', '/seed-rush/username/check?u=' + encodeURIComponent(u), undefined, { auth: 'none' }).then(function (r) {
          if (mine !== seq) return;
          if (r.available) { okFor = u; save.disabled = false; setHint('Available!', 'ok'); }
          else setHint(USERNAME_REASONS[r.reason] || messageFor(r.reason), 'bad');
        }, function (e) {
          if (mine === seq) setHint(e.message, 'bad');
        });
      }, 450);
    });

    var form = h('form', { class: 'sr-form', novalidate: true },
      h('div', { class: 'sr-field' }, h('label', { for: 'sr-username' }, 'Username'), input, hint),
      save);
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var u = input.value.trim();
      if (!okFor || okFor !== u) return;
      save.disabled = true; setHint('Saving…');
      api('PUT', '/seed-rush/username', { username: u }, { auth: 'user' }).then(function () {
        if (Auth.me) Auth.me.username = u;
        return Auth.refreshMe();
      }).then(function () {
        Auth.emit(); if (onSaved) onSaved(u);
      }, function (e) {
        setHint(USERNAME_REASONS[e.code] || e.message, 'bad');
        save.disabled = false;
      });
    });
    setTimeout(function () { try { input.focus(); } catch (e) { /* ignore */ } }, 50);
    return form;
  }

  /** "Send email" as a text-style button, with every outcome the backend has. */
  function verifySend(label) {
    var status = h('span', { class: 'sr-hint sr-inline-status', 'aria-live': 'polite' });
    var btn = h('button', { class: 'sr-link-btn', type: 'button' }, label || 'Send email');
    btn.addEventListener('click', function () {
      btn.disabled = true; status.textContent = 'Sending…'; status.className = 'sr-hint sr-inline-status';
      api('POST', '/seed-rush/verification/send', undefined, { auth: 'user' }).then(function (r) {
        if (r.status === 'sent') {
          status.textContent = 'Sent. Check your inbox.'; status.className = 'sr-hint sr-inline-status is-ok';
        } else if (r.status === 'already_verified') {
          status.textContent = 'Already verified.'; status.className = 'sr-hint sr-inline-status is-ok';
          Auth.refreshMe().then(Auth.emit);
        } else {
          status.textContent = "We couldn't send it right now. Try again later."; status.className = 'sr-hint sr-inline-status is-bad';
          btn.disabled = false;
        }
      }, function (e) {
        status.className = 'sr-hint sr-inline-status is-bad';
        status.textContent = e.code === 'rate_limited'
          ? "You've asked for 3 emails in the last hour. Try again later." : e.message;
        btn.disabled = e.code === 'rate_limited';
      });
    });
    return [btn, status];
  }

  /** The account dialog. Steps: account | signin | signup | username. */
  var AccountDialog = {
    open: function (step) {
      if (!Auth.sb) return;
      step = step || 'account';
      if (step === 'account' && !Auth.user) step = 'signin';
      if (step === 'account' && Auth.me && !Auth.me.username) step = 'username';
      Modal.open('Account', function (body) { AccountDialog.render(body, step); });
    },
    close: function () { Modal.close(); },

    render: function (panel, step) {
      clear(panel);
      if (step === 'username') {
        Modal.setTitle('Pick a username');
        append(panel, [
          h('p', { class: 'sr-modal-lede' }, 'The name the leaderboard shows.'),
          usernameForm(function () {
            AccountDialog.close(); toast("You're all set.");
            repaintScreen();
          })]);
        return;
      }
      if (step === 'account') {
        var me = Auth.me;
        Modal.setTitle('Account');
        append(panel, [
          h('p', { class: 'sr-who' }, me && me.username ? me.username : (Auth.user.email || 'Signed in')),
          me ? h('p', { class: 'sr-muted' }, me.streak > 0 ? me.streak + '-day streak' : 'No streak yet. Play today to start one.')
            : h('p', { class: 'sr-muted' }, "We couldn't load your Seed Rush profile right now."),
          me && !me.email_verified ? h('p', { class: 'sr-quiet-line' },
            'Verify your email to appear on the leaderboard. ', verifySend()) : null,
          h('p', { class: 'sr-modal-foot' },
            h('button', { class: 'sr-link-btn', type: 'button', onclick: function () { Auth.signOut(); AccountDialog.close(); } }, 'Sign out'))
        ]);
        return;
      }

      var signup = step === 'signup';
      Modal.setTitle(signup ? 'Create your account' : 'Log in');
      var error = h('p', { class: 'sr-error', role: 'alert' });
      var email = h('input', { class: 'sr-input', id: 'sr-email', type: 'email', name: 'email', autocomplete: 'email', required: true });
      var password = h('input', {
        class: 'sr-input', id: 'sr-password', type: 'password', name: 'password', minlength: '6', required: true,
        autocomplete: signup ? 'new-password' : 'current-password'
      });
      var submit = h('button', { class: 'sr-btn sr-btn-primary', type: 'submit' }, signup ? 'Create account' : 'Log in');
      var form = h('form', { class: 'sr-form', novalidate: true },
        h('div', { class: 'sr-field' }, h('label', { for: 'sr-email' }, 'Email'), email),
        h('div', { class: 'sr-field' }, h('label', { for: 'sr-password' }, 'Password'), password,
          signup ? h('p', { class: 'sr-hint' }, 'At least 6 characters.') : null),
        error, submit);

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        error.textContent = '';
        if (!email.value.trim() || !password.value) { error.textContent = 'Enter your email and password.'; return; }
        submit.disabled = true;
        var call = signup ? Auth.signUp(email.value.trim(), password.value) : Auth.signIn(email.value.trim(), password.value);
        call.then(function (r) {
          submit.disabled = false;
          if (r.error) { error.textContent = authMessage(r.error); return; }
          if (!r.data || !r.data.session) {
            error.textContent = 'Check your email to confirm your account, then log in.';
            return;
          }
          AccountDialog.close();
          toast(signup ? 'Welcome to Seed Rush!' : 'Logged in.');
        }, function (e) { submit.disabled = false; error.textContent = authMessage(e); });
      });

      var tabs = h('div', { class: 'sr-tabs', role: 'tablist' },
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(!signup), onclick: function () { AccountDialog.render(panel, 'signin'); } }, 'Log in'),
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(signup), onclick: function () { AccountDialog.render(panel, 'signup'); } }, 'Create account'));

      var google = h('button', { class: 'sr-btn sr-btn-secondary sr-google', type: 'button' },
        googleIcon(), 'Continue with Google');
      google.addEventListener('click', function () {
        google.disabled = true;
        Auth.google().then(function (r) {
          if (r && r.error) { google.disabled = false; error.textContent = authMessage(r.error); }
        }, function (e) { google.disabled = false; error.textContent = authMessage(e); });
      });

      var support = CFG.supportEmail || 'lucasquality555@gmail.com';
      append(panel, [
        h('p', { class: 'sr-modal-lede' }, 'Same account as the DollarSeeds app. Get on the leaderboard and keep your streak on any device.'),
        tabs,
        google,
        h('p', { class: 'sr-divider' }, 'or'),
        form,
        h('p', { class: 'sr-fineprint' }, 'Signed up in the app with Apple? Website sign-in with Apple is coming soon.'),
        signup ? null : h('p', { class: 'sr-fineprint' },
          'Forgot your password? Email ', h('a', { href: 'mailto:' + support + '?subject=Seed%20Rush%20password' }, support), ' and we\'ll help.')
      ]);
      setTimeout(function () { try { email.focus(); } catch (e) { /* ignore */ } }, 50);
    }
  };

  function googleIcon() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 48 48'); svg.setAttribute('aria-hidden', 'true');
    [['#FFC107', 'M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z'],
     ['#FF3D00', 'M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z'],
     ['#4CAF50', 'M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z'],
     ['#1976D2', 'M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z']
    ].forEach(function (p) {
      var path = document.createElementNS(ns, 'path'); path.setAttribute('fill', p[0]); path.setAttribute('d', p[1]); svg.appendChild(path);
    });
    return svg;
  }

  // ══ 5. Leaderboard ══════════════════════════════════════════════════════

  function Leaderboard(node) {
    var state = { day: 'today', expanded: false, data: null };

    function load() {
      clear(node);
      append(node, h('p', { class: 'sr-muted sr-board-msg' }, 'Loading the leaderboard…'));
      var path = '/seed-rush/leaderboard';
      if (state.day === 'yesterday' && Day.today()) path += '?day=' + prevDay(Day.today());
      return api('GET', path, undefined, { auth: 'optional' }).then(function (data) {
        state.data = data; paint();
      }, function (e) {
        clear(node);
        append(node, h('p', { class: 'sr-error sr-board-msg' }, e.code === 'network' || e.code === 'unavailable'
          ? 'The leaderboard is unavailable right now. Please try again in a minute.' : e.message));
      });
    }

    function row(e, isMe) {
      return h('tr', { class: isMe ? 'is-me' : null },
        h('td', { class: 'sr-col-rank' }, '#' + e.rank),
        h('td', { class: 'sr-col-user' }, e.username, isMe ? h('span', { class: 'sr-only' }, ' (you)') : null),
        h('td', { class: 'sr-col-mode' }, MODE_NAMES[e.mode] || e.mode),
        h('td', { class: 'sr-col-score' }, String(e.score)));
    }

    function paint() {
      clear(node);
      var data = state.data, entries = data.entries || [], me = data.me;
      Modal.setTitle(state.day === 'today' ? "Today's leaderboard" : "Yesterday's leaderboard");
      if (!entries.length) {
        append(node, h('p', { class: 'sr-muted sr-board-msg' }, state.day === 'today'
          ? 'No ranked runs yet today. Be the first!' : 'Nobody was ranked yesterday.'));
      } else {
        var shown = state.expanded ? entries : entries.slice(0, 10);
        var body = h('tbody');
        shown.forEach(function (e) { body.appendChild(row(e, me && me.rank === e.rank)); });
        if (me && !shown.some(function (e) { return e.rank === me.rank; })) {
          body.appendChild(h('tr', { class: 'sr-board-gap' }, h('td', { colspan: '4' }, '…')));
          body.appendChild(row(me, true));
        }
        append(node, h('table', { class: 'sr-board-table' },
          h('caption', { class: 'sr-only' }, state.day === 'today' ? "Today's leaderboard" : "Yesterday's leaderboard"),
          h('thead', null, h('tr', null,
            h('th', { class: 'sr-col-rank', scope: 'col' }, 'Rank'),
            h('th', { scope: 'col' }, 'Player'),
            h('th', { scope: 'col' }, 'Mode'),
            h('th', { class: 'sr-col-score', scope: 'col' }, 'Score'))),
          body));
        if (entries.length > 10) {
          append(node, h('div', { class: 'sr-board-foot' },
            h('button', { class: 'sr-link-btn', type: 'button', 'aria-expanded': String(state.expanded),
              onclick: function () { state.expanded = !state.expanded; paint(); } },
              state.expanded ? 'Show top 10' : 'Show all (' + entries.length + ')')));
        }
      }
      if (Auth.user && Auth.me && state.day === 'today' && !me) {
        var why = !Auth.me.username ? 'Pick a username to appear here.'
          : !Auth.me.email_verified ? 'Verify your email to appear here.'
            : Auth.me.played_today ? 'Your run will appear once it finishes.' : 'Play today to get on the board.';
        append(node, h('p', { class: 'sr-muted sr-board-msg' }, why));
      }
    }

    function setDay(day) { state.day = day; state.expanded = false; load(); }
    return { load: load, setDay: setDay };
  }

  function openLeaderboard() {
    Modal.open("Today's leaderboard", function (body) {
      var board = h('div', { class: 'sr-board' });
      var lb = Leaderboard(board);
      var buttons = ['today', 'yesterday'].map(function (day) {
        var b = h('button', { type: 'button', class: 'sr-seg-btn', 'aria-pressed': String(day === 'today') },
          day === 'today' ? 'Today' : 'Yesterday');
        b.addEventListener('click', function () {
          buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
          lb.setDay(day);
        });
        return b;
      });
      append(body, [h('div', { class: 'sr-seg sr-seg-small', role: 'group', 'aria-label': 'Which day' }, buttons), board]);
      lb.load();
    }, { cls: 'sr-modal-wide' });
  }

  // ══ 6. Toolbar, How to play, the streak plant ═══════════════════════════

  function openHelp(onClose) {
    store.set('sr.seenHelp', true);
    Modal.open('How to play', function (body) {
      var rows = [['Easy', 'Pick 1 word from 3', '1 per verse'], ['Medium', 'Place 3 words from 6', '2 per word'],
        ['Hard', 'Type 3 words', '5 per word']];
      append(body, [
        h('p', null, 'Fill in the missing words of each verse before the minute runs out.'),
        h('p', null, 'One try per verse. Partial credit counts in Medium and Hard.'),
        h('p', null, 'Everyone gets the same verses each day. A new round starts at 7:00 AM Eastern.'),
        h('table', { class: 'sr-help-table' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Mode'), h('th', { scope: 'col' }, 'You'), h('th', { scope: 'col' }, 'Points'))),
          h('tbody', null, rows.map(function (r) {
            return h('tr', null, h('th', { scope: 'row' }, r[0]), h('td', null, r[1]), h('td', null, r[2]));
          }))),
        h('p', null, "Practice anytime. It doesn't count on the leaderboard."),
        h('div', { class: 'sr-modal-actions' },
          h('button', { class: 'sr-btn sr-btn-primary', type: 'button', onclick: function () { Modal.close(); } }, 'Got it'))
      ]);
    }, { onClose: onClose });
  }

  var ICONS = {
    help: '<circle cx="12" cy="12" r="9.25"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.85.85c0 1.65-2.45 2.2-2.45 3.6"/><circle cx="12" cy="16.9" r="0.4" fill="currentColor"/>',
    trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5.5v1.2A3.3 3.3 0 0 0 8.4 10.5M16 6h2.5v1.2a3.3 3.3 0 0 1-2.9 3.3"/><path d="M12 13.5V17M8.5 20h7M10 17h4l.5 3h-5z"/>',
    person: '<circle cx="12" cy="8.5" r="3.75"/><path d="M4.75 20a7.25 7.25 0 0 1 14.5 0"/>'
  };

  function icon(name) {
    var span = document.createElement('span');
    span.className = 'sr-icon';
    span.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICONS[name] + '</svg>';
    return span;
  }

  var Toolbar = {
    node: null,
    person: null,
    build: function (node) {
      if (!node) return;
      Toolbar.node = node;
      function btn(name, label, fn) {
        return h('button', { class: 'sr-tool', type: 'button', 'aria-label': label, title: label, 'data-tooltip': label, onclick: fn }, icon(name));
      }
      Toolbar.person = btn('person', 'Account', function () { AccountDialog.open('account'); });
      Toolbar.person.appendChild(h('span', { class: 'sr-dot', 'aria-hidden': 'true', hidden: true }));
      append(node, [
        btn('help', 'How to play', function () { openHelp(); }),
        btn('trophy', 'Leaderboard', openLeaderboard),
        Auth.sb ? Toolbar.person : null
      ]);
      node.hidden = false;
    },
    update: function () {
      if (!Toolbar.person) return;
      var unverified = !!(Auth.user && Auth.me && !Auth.me.email_verified);
      $('.sr-dot', Toolbar.person).hidden = !unverified;
      var label = !Auth.user ? 'Account: log in' : unverified ? 'Account: email not verified' : 'Account';
      Toolbar.person.setAttribute('aria-label', label);
    }
  };

  // Streak thresholds for the six plant stages: 0 | 1–2 | 3–6 | 7–13 | 14–29 | 30+.
  var STAGE_AT = [0, 1, 3, 7, 14, 30];

  function stageFor(streak) {
    var s = 0;
    for (var i = 1; i < STAGE_AT.length; i++) if (streak >= STAGE_AT[i]) s = i;
    return s;
  }

  function plantImg(stage, cls) {
    var base = '/assets/images/streak/streak-stage-' + stage;
    return h('img', {
      class: 'sr-plant ' + (cls || ''), src: base + '-320.webp', srcset: base + '-160.webp 1x, ' + base + '-320.webp 2x',
      width: '160', height: '173', decoding: 'async',
      alt: stage === 0 ? 'An empty pot, waiting for a seed' : 'A DollarSeeds plant at streak stage ' + stage + ' of 5'
    });
  }

  function growthHint(streak) {
    var stage = stageFor(streak);
    if (stage >= 5) return 'Fully grown. Keep it blooming.';
    var left = STAGE_AT[stage + 1] - streak;
    return plural(left, 'more day', 'more days') + ' until it grows';
  }

  /** The streak to show: the account's, or (guests) the last finished daily
      run's, if it was today's or yesterday's game day. */
  function currentStreak() {
    if (Auth.user) return Auth.me ? Auth.me.streak || 0 : 0;
    var s = store.get('sr.guestStreak'), today = Day.today();
    if (s && today && (s.day === today || s.day === prevDay(today))) return s.streak || 0;
    return 0;
  }

  /** "2026-11-09" → "November 9, 2026". */
  function longDate(day) {
    var p = String(day || '').split('-');
    if (p.length !== 3) return '';
    var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return names[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
  }

  // ══ 7. The game ═════════════════════════════════════════════════════════

  var Game = {
    active: false,     // a run is on the clock
    root: null,
    kind: 'daily',
    run: null,         // {id, mode, deadline, guestId}
    q: null,
    busy: false,
    ended: false,
    finishing: false,
    timer: null,
    announced: {},
    score: 0,
    medium: null,      // {filled: [chipIndex|null ×3], order: [blank…]}
    keyHandler: null,
    screen: null       // re-renders the current screen (after sign-in etc.)
  };

  function gameScreen(children, repaint) {
    clear(Game.root);
    append(Game.root, children);
    Game.screen = repaint || null;
  }

  /** Re-draw the current screen with fresh account data (not mid-run). */
  function repaintScreen() {
    if (!Game.active && Game.screen) Game.screen();
  }

  /** The timer sticks just under the fixed site header, whose height changes
      with the width (it wraps to two rows on narrow phones). */
  function measureHeader() {
    var header = $('.site-header');
    if (header) document.documentElement.style.setProperty('--sr-header-h', header.offsetHeight + 'px');
  }
  window.addEventListener('resize', measureHeader);

  function setPlaying(on) {
    document.body.classList.toggle('sr-playing', on);
    measureHeader();
  }

  window.addEventListener('beforeunload', function (ev) {
    if (Game.active) { ev.preventDefault(); ev.returnValue = ''; }
  });

  function bootGame(root) {
    Game.root = root;
    Game.kind = root.getAttribute('data-sr-game') === 'practice' ? 'practice' : 'daily';
    measureHeader();
    Toolbar.build($('[data-sr-toolbar]'));
    Auth.on(function () { Toolbar.update(); repaintScreen(); });

    var dayP = Day.load().catch(function () { return null; });

    Auth.ready.then(function () {
      return Promise.all([dayP, Auth.refreshMe()]);
    }).then(function () {
      Toolbar.update();
      if (Auth.user) Claim.maybe();
      return recoverStoredRun();
    }).then(function (recovered) {
      if (recovered) return;
      if (Game.kind === 'daily') {
        return showDailyIfPlayed().then(function (shown) { if (!shown) renderLanding(); });
      }
      renderPrerun();
      if (!store.get('sr.seenHelp')) openHelp();
    });
  }

  /** A run left mid-way (closed tab, reload): finish it and show its result. */
  function recoverStoredRun() {
    var stale = store.get('sr.active');
    if (!stale || !stale.id) return Promise.resolve(false);
    store.del('sr.active');
    if (stale.user && (!Auth.user || Auth.user.id !== stale.user)) return Promise.resolve(false);
    Game.kind = stale.kind || Game.kind;
    return api('POST', '/seed-rush/runs/' + stale.id + '/finish', undefined,
      stale.guestId ? { guestId: stale.guestId } : { auth: 'user' }).then(function (res) {
      rememberResult(res, stale.guestId);
      renderResult(res, { note: 'You left a run before it ended. The clock kept running.' });
      return true;
    }, function () { return false; });
  }

  /** Daily: today already played → the played-today state. */
  function showDailyIfPlayed() {
    if (Auth.user && Auth.me && Auth.me.played_today && Auth.me.today_run) {
      var tr = Auth.me.today_run;
      if (!tr.finished) {
        gameScreen(h('div', { class: 'sr-center-col' },
          h('h1', { class: 'sr-title sr-title-small' }, "Today's run is in progress"),
          h('p', { class: 'sr-tagline' }, 'It looks like it is still going in another tab or on another device.'),
          h('div', { class: 'sr-cta-row' },
            h('button', { class: 'sr-btn sr-btn-primary', type: 'button', onclick: function () { finishById(tr.run_id, null); } }, 'Show my result'))));
        return Promise.resolve(true);
      }
      return finishById(tr.run_id, null).then(function () { return true; }, function () { return false; });
    }
    if (!Auth.user) {
      var last = store.get('sr.lastDaily');
      if (last && last.game_day === Day.today() && last.guestId === Guest.id() && last.result) {
        renderResult(last.result, { already: true });
        return Promise.resolve(true);
      }
    }
    return Promise.resolve(false);
  }

  function finishById(runId, guestId) {
    return api('POST', '/seed-rush/runs/' + runId + '/finish', undefined,
      guestId ? { guestId: guestId } : { auth: 'user' }).then(function (res) {
      rememberResult(res, guestId);
      renderResult(res, { already: true });
    });
  }

  /** Daily, not played yet: the mark, one line, one Play. */
  function renderLanding() {
    setPlaying(false);
    var streak = currentStreak();
    var play = h('button', { class: 'sr-btn sr-btn-primary sr-btn-play', type: 'button' }, "Play today's Seed Rush");
    play.addEventListener('click', function () {
      if (store.get('sr.seenHelp')) renderPrerun();
      else openHelp(function () { renderPrerun(); });
    });
    var date = longDate(Day.today());
    gameScreen(h('div', { class: 'sr-landing' },
      plantImg(stageFor(streak), 'sr-mark'),
      h('h1', { class: 'sr-title' }, 'Seed Rush'),
      h('p', { class: 'sr-tagline' }, 'Fill in the verse. 60 seconds. Once a day.'),
      h('div', { class: 'sr-cta-row' },
        h('a', { class: 'sr-btn sr-btn-secondary', href: '/seed-rush/practice' }, 'Practice'),
        Auth.sb && !Auth.user ? h('button', { class: 'sr-btn sr-btn-secondary', type: 'button',
          onclick: function () { AccountDialog.open('signin'); } }, 'Log in') : null,
        play),
      date || streak ? h('p', { class: 'sr-landing-meta' },
        date ? h('span', null, date) : null,
        streak >= 1 ? h('span', null, streak + '-day streak') : null) : null), renderLanding);
  }

  var MODE_LINE = {
    easy: 'Pick 1 word from 3 · 1 pt per verse',
    medium: 'Place 3 words from 6 · 2 pts per word',
    hard: 'Type 3 words · 5 pts per word'
  };

  /** Mode switch + Start. */
  function renderPrerun(message) {
    setPlaying(false);
    var chosen = store.get('sr.mode');
    if (!MODE_NAMES[chosen]) chosen = 'easy';
    var line = h('p', { class: 'sr-mode-line', 'aria-live': 'polite' }, MODE_LINE[chosen]);
    var options = Object.keys(MODE_NAMES).map(function (mode) {
      var input = h('input', { type: 'radio', name: 'sr-mode', value: mode, class: 'sr-seg-input', checked: mode === chosen });
      var label = h('label', { class: 'sr-seg-opt' + (mode === chosen ? ' is-checked' : '') }, input, h('span', null, MODE_NAMES[mode]));
      input.addEventListener('change', function () {
        chosen = mode; store.set('sr.mode', mode);
        line.textContent = MODE_LINE[mode];
        $all('.sr-seg-opt', Game.root).forEach(function (l) { l.classList.toggle('is-checked', l === label); });
      });
      return label;
    });
    var start = h('button', { class: 'sr-btn sr-btn-primary sr-btn-play', type: 'button' }, 'Start');
    start.addEventListener('click', function () { countIn(chosen); });

    gameScreen(h('div', { class: 'sr-prerun' },
      h('h1', { class: 'sr-title sr-title-small', id: 'sr-prerun-title' }, Game.kind === 'daily' ? "Today's Seed Rush" : 'Practice'),
      message ? h('p', { class: 'sr-error', role: 'alert' }, message) : null,
      h('div', { class: 'sr-seg', role: 'radiogroup', 'aria-label': 'Mode' }, options),
      line,
      start,
      Game.kind === 'practice' ? h('p', { class: 'sr-quiet-line' }, "Practice runs don't count on the leaderboard.") : null),
      function () { renderPrerun(); });
  }

  function countIn(mode) {
    if (reduceMotion) { startRun(mode); return; }
    var n = 3;
    var num = h('span', { class: 'sr-countin-num', 'aria-hidden': 'true' }, '3');
    gameScreen(h('div', { class: 'sr-countin', role: 'status', 'aria-label': 'Starting' }, num));
    var tick = setInterval(function () {
      n--;
      if (n <= 0) { clearInterval(tick); startRun(mode); return; }
      var next = h('span', { class: 'sr-countin-num', 'aria-hidden': 'true' }, String(n));
      num.replaceWith(next); num = next;
    }, 700);
  }

  function startRun(mode) {
    var status = h('p', { class: 'sr-muted', role: 'status' }, 'Starting…');
    gameScreen(h('div', { class: 'sr-waiting' }, status));
    var asGuest = !Auth.user;
    var guestId = asGuest ? Guest.id() : null;

    withWake(function () {
      return api('POST', '/seed-rush/runs', { kind: Game.kind, mode: mode }, asGuest ? { guestId: guestId } : { auth: 'user' });
    }, function (waiting) { status.textContent = waiting ? 'Waking up the game…' : 'Starting…'; }).then(function (res) {
      beginPlay(res, guestId);
    }, function (e) {
      if (e.code === 'already_played') {
        showDailyIfPlayed().then(function (shown) { if (!shown) renderAlreadyPlayed(); });
        return;
      }
      renderPrerun(e.message);
    });
  }

  /** Played today, but the result itself isn't available here. */
  function renderAlreadyPlayed() {
    var streak = currentStreak();
    var time = h('span', { class: 'sr-clock' }, '–');
    gameScreen(h('div', { class: 'sr-center-col' },
      plantImg(stageFor(streak), 'sr-mark'),
      h('h1', { class: 'sr-title sr-title-small' }, "You've played today"),
      h('p', { class: 'sr-next' }, 'Next Seed Rush in ', time),
      h('div', { class: 'sr-cta-row' },
        h('a', { class: 'sr-btn sr-btn-secondary', href: '/seed-rush/practice' }, 'Practice'))), renderAlreadyPlayed);
    liveCountdown(time, null, clockText);
  }

  // ── Playing ──────────────────────────────────────────────────────────────

  var hud = {};

  function beginPlay(res, guestId) {
    Game.run = { id: res.run_id, mode: res.mode, deadline: Date.parse(res.deadline_at), guestId: guestId, day: res.game_day };
    Game.active = true; Game.busy = false; Game.ended = false; Game.finishing = false;
    Game.score = 0; Game.announced = {};
    store.set('sr.active', { id: res.run_id, kind: Game.kind, mode: res.mode, guestId: guestId,
      user: guestId ? null : (Auth.user && Auth.user.id) });
    if (guestId) store.set('sr.guestPlayed', true);
    setPlaying(true);

    hud.time = h('div', { class: 'sr-time', role: 'timer', 'aria-label': 'Time left' }, '1:00');
    hud.score = h('span', { class: 'sr-score-num' }, '0');
    hud.fill = h('div', { class: 'sr-bar-fill' });
    hud.live = h('p', { class: 'sr-only', 'aria-live': 'assertive' });
    hud.box = h('div', { class: 'sr-hud' },
      h('div', { class: 'sr-hud-row' },
        hud.time,
        h('div', { class: 'sr-hud-side' },
          h('span', { class: 'sr-mode-tag' }, MODE_NAMES[res.mode]),
          h('div', { class: 'sr-score' }, hud.score, h('span', { class: 'sr-score-label' }, 'Score')))),
      h('div', { class: 'sr-bar', 'aria-hidden': 'true' }, hud.fill),
      hud.live);
    hud.ref = h('p', { class: 'sr-verse-ref' });
    hud.text = h('p', { class: 'sr-verse-text' });
    hud.verse = h('div', { class: 'sr-verse' }, hud.ref, hud.text);
    hud.feedback = h('p', { class: 'sr-feedback', 'aria-live': 'polite' });
    hud.inputs = h('div', { class: 'sr-inputs' });
    gameScreen(h('div', { class: 'sr-play' },
      h('h1', { class: 'sr-only' }, Game.kind === 'daily' ? "Today's Seed Rush" : 'Practice'),
      hud.box, hud.verse, hud.feedback, hud.inputs));
    window.scrollTo(0, 0);

    Game.timer = setInterval(tick, 200);
    document.addEventListener('visibilitychange', tick);
    tick();
    showQuestion(res.question);
  }

  function msLeft() { return Game.run.deadline - (Date.now() + serverOffset); }

  /** Timestamps, not tick counting: correct after a background tab wakes. */
  function tick() {
    if (!Game.active || !Game.run) return;
    var left = Math.max(0, msLeft());
    var secs = Math.ceil(left / 1000);
    hud.time.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0');
    hud.fill.style.transform = 'scaleX(' + Math.min(1, left / 60000).toFixed(4) + ')';
    hud.box.classList.toggle('is-warn', left <= 10000 && left > 5000);
    hud.box.classList.toggle('is-danger', left <= 5000);
    [30, 10].forEach(function (mark) {
      if (left <= mark * 1000 && left > (mark - 3) * 1000 && !Game.announced[mark]) {
        Game.announced[mark] = true; hud.live.textContent = mark + ' seconds left';
      }
    });
    if (left <= 0) timeUp();
  }

  function timeUp() {
    if (Game.ended) return;
    Game.ended = true;
    lockInputs(true);
    if (!Game.busy) finishRun();
  }

  function lockInputs(on) {
    $all('button, input', hud.inputs).forEach(function (b) {
      if (on) { b.dataset.wasDisabled = b.disabled ? '1' : ''; b.disabled = true; }
      else if (!b.dataset.keep) b.disabled = b.dataset.wasDisabled === '1';
    });
    $all('.sr-blank button, button.sr-blank, .sr-blank-input', hud.text).forEach(function (b) { b.disabled = on; });
  }

  function showQuestion(q) {
    Game.q = q;
    if (!q) { finishRun(); return; }
    clear(hud.text); clear(hud.inputs);
    hud.feedback.textContent = ''; hud.feedback.className = 'sr-feedback';
    hud.verse.className = 'sr-verse' + (reduceMotion ? '' : ' is-entering');
    hud.ref.textContent = q.reference;
    var blanks = [];
    q.segments.forEach(function (seg) {
      if (seg.t === 'text') { hud.text.appendChild(document.createTextNode(seg.v)); return; }
      var b = makeBlank(seg.id);
      blanks[seg.id] = b; hud.text.appendChild(b);
    });
    Game.blanks = blanks;
    if (Game.keyHandler) document.removeEventListener('keydown', Game.keyHandler);
    Game.keyHandler = null;
    if (Game.run.mode === 'easy') setupEasy(q);
    else if (Game.run.mode === 'medium') setupMedium(q);
    else setupHard();
  }

  function makeBlank(id) {
    var mode = Game.run.mode;
    if (mode === 'medium') {
      return h('button', { class: 'sr-blank', type: 'button', 'data-blank': String(id), 'aria-label': 'Blank ' + (id + 1) + ', empty' });
    }
    if (mode === 'hard') {
      var input = h('input', {
        class: 'sr-blank-input', type: 'text', 'data-blank-input': String(id), autocapitalize: 'off',
        autocomplete: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'next',
        'aria-label': 'Blank ' + (id + 1), maxlength: '60'
      });
      input.addEventListener('input', function () { input.style.width = Math.max(6.5, input.value.length + 1.5) + 'ch'; });
      return h('span', { class: 'sr-blank', 'data-blank': String(id) }, input);
    }
    return h('span', { class: 'sr-blank', 'data-blank': String(id), role: 'img', 'aria-label': 'missing word' });
  }

  function keyHint(text) { append(hud.inputs, h('p', { class: 'sr-keys-hint' }, text)); }

  function onKeys(fn) {
    Game.keyHandler = function (ev) {
      if (!Game.active || Game.busy || Game.ended || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if ($('dialog[open]')) return;
      fn(ev);
    };
    document.addEventListener('keydown', Game.keyHandler);
  }

  // Easy: tap one of three options, which submits.
  function setupEasy(q) {
    var list = h('div', { class: 'sr-options' });
    var buttons = q.options.map(function (word, i) {
      var b = h('button', { class: 'sr-option', type: 'button' }, h('span', { class: 'sr-key', 'aria-hidden': 'true' }, String(i + 1)), word);
      b.addEventListener('click', function () { pickEasy(word); });
      list.appendChild(b); return b;
    });
    append(hud.inputs, list);
    keyHint('Keys 1–3 pick a word');
    onKeys(function (ev) {
      var n = Number(ev.key);
      if (n >= 1 && n <= buttons.length) { ev.preventDefault(); pickEasy(q.options[n - 1]); }
    });
    setTimeout(function () { if (buttons[0] && !matchMedia('(hover: none)').matches) buttons[0].focus({ preventScroll: true }); }, 0);
  }

  function pickEasy(word) {
    if (Game.busy || Game.ended) return;
    Game.blanks[0].textContent = word;
    submit([word]);
  }

  // Medium: six chips into three blanks — tap fills the next empty blank, drag
  // drops on a specific one, tapping a filled blank sends its chip back.
  function setupMedium(q) {
    var M = Game.medium = { filled: [null, null, null], order: [], chips: [], suppress: false };
    var tray = h('div', { class: 'sr-chips' });
    q.options.forEach(function (word, i) {
      var chip = h('button', { class: 'sr-chip', type: 'button', 'aria-label': 'Place "' + word + '"' },
        h('span', { class: 'sr-key', 'aria-hidden': 'true' }, String(i + 1)), word);
      chip.addEventListener('click', function () {
        if (M.suppress) return;
        var empty = M.filled.indexOf(null);
        if (empty !== -1) placeChip(i, empty);
      });
      dragChip(chip, i);
      M.chips.push(chip); tray.appendChild(chip);
    });
    Game.blanks.forEach(function (b, idx) {
      b.addEventListener('click', function () { if (M.filled[idx] != null) clearBlank(idx); });
    });
    var check = h('button', { class: 'sr-btn sr-btn-primary', type: 'button', disabled: true }, 'Check');
    check.addEventListener('click', checkMedium);
    M.check = check;
    append(hud.inputs, [tray, h('div', { class: 'sr-play-actions' }, check)]);
    keyHint('Keys 1–6 place a word · Backspace clears · Enter checks');
    paintMedium();
    onKeys(function (ev) {
      var n = Number(ev.key);
      if (n >= 1 && n <= M.chips.length) {
        ev.preventDefault();
        var empty = M.filled.indexOf(null);
        if (empty !== -1 && M.filled.indexOf(n - 1) === -1) placeChip(n - 1, empty);
      } else if (ev.key === 'Backspace') {
        ev.preventDefault();
        var last = M.order[M.order.length - 1];
        if (last != null) clearBlank(last);
      } else if (ev.key === 'Enter' && M.filled.indexOf(null) === -1) {
        ev.preventDefault(); checkMedium();
      }
    });
  }

  function placeChip(chipIdx, blankIdx) {
    var M = Game.medium;
    if (Game.busy || Game.ended || M.filled.indexOf(chipIdx) !== -1) return;
    if (M.filled[blankIdx] != null) clearBlank(blankIdx);
    M.filled[blankIdx] = chipIdx;
    M.order = M.order.filter(function (b) { return b !== blankIdx; }).concat(blankIdx);
    paintMedium();
  }

  function clearBlank(blankIdx) {
    var M = Game.medium;
    if (Game.busy || Game.ended) return;
    M.filled[blankIdx] = null;
    M.order = M.order.filter(function (b) { return b !== blankIdx; });
    paintMedium();
  }

  function paintMedium() {
    var M = Game.medium, words = Game.q.options;
    var next = M.filled.indexOf(null);
    Game.blanks.forEach(function (b, idx) {
      var c = M.filled[idx];
      b.textContent = c == null ? '' : words[c];
      b.classList.toggle('is-target', idx === next);
      b.setAttribute('aria-label', 'Blank ' + (idx + 1) + (c == null ? ', empty' : ': ' + words[c] + '. Press to clear.'));
    });
    M.chips.forEach(function (chip, i) { chip.disabled = M.filled.indexOf(i) !== -1; });
    M.check.disabled = next !== -1;
  }

  function checkMedium() {
    var M = Game.medium;
    if (M.filled.indexOf(null) !== -1) return;
    submit(M.filled.map(function (c) { return Game.q.options[c]; }));
  }

  /** Pointer events: one code path for mouse, touch and pen. */
  function dragChip(chip, index) {
    chip.addEventListener('pointerdown', function (ev) {
      if (chip.disabled || Game.busy || Game.ended) return;
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      var start = { x: ev.clientX, y: ev.clientY }, ghost = null, over = null;
      try { chip.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }

      function move(e) {
        if (!ghost) {
          if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 8) return;
          ghost = chip.cloneNode(true);
          ghost.classList.add('sr-chip-ghost'); ghost.removeAttribute('aria-label');
          document.body.appendChild(ghost); chip.classList.add('is-dragging');
        }
        ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
        var target = document.elementFromPoint(e.clientX, e.clientY);
        var blank = target && target.closest ? target.closest('.sr-blank[data-blank]') : null;
        if (blank && !hud.text.contains(blank)) blank = null;
        if (over !== blank) {
          if (over) over.classList.remove('is-drop');
          over = blank;
          if (over) over.classList.add('is-drop');
        }
      }
      function up() {
        chip.removeEventListener('pointermove', move);
        chip.removeEventListener('pointerup', up);
        chip.removeEventListener('pointercancel', up);
        if (!ghost) return;
        ghost.remove(); chip.classList.remove('is-dragging');
        Game.medium.suppress = true;
        setTimeout(function () { Game.medium.suppress = false; }, 0);
        if (over) { over.classList.remove('is-drop'); placeChip(index, Number(over.getAttribute('data-blank'))); }
      }
      chip.addEventListener('pointermove', move);
      chip.addEventListener('pointerup', up);
      chip.addEventListener('pointercancel', up);
    });
  }

  // Hard: type each word; Enter moves on, Enter on the last checks.
  function setupHard() {
    var inputs = Game.blanks.map(function (b) { return $('input', b); });
    inputs.forEach(function (input, i) {
      input.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        if (i < inputs.length - 1) inputs[i + 1].focus();
        else checkHard();
      });
    });
    if (inputs.length) inputs[inputs.length - 1].setAttribute('enterkeyhint', 'done');
    var check = h('button', { class: 'sr-btn sr-btn-primary', type: 'button' }, 'Check');
    check.addEventListener('click', checkHard);
    append(hud.inputs, h('div', { class: 'sr-play-actions' }, check));
    keyHint('Enter or Tab moves to the next blank · Enter on the last checks');
    setTimeout(function () { if (inputs[0]) inputs[0].focus({ preventScroll: true }); }, 0);
  }

  function checkHard() {
    var answers = Game.blanks.map(function (b) { return $('input', b).value; });
    submit(answers);
  }

  // ── Answering ────────────────────────────────────────────────────────────

  function submit(answers) {
    if (Game.busy || Game.ended || !Game.q) return;
    Game.busy = true;
    lockInputs(true);
    var position = Game.q.position;
    var opts = Game.run.guestId ? { guestId: Game.run.guestId } : { auth: 'user' };
    api('POST', '/seed-rush/runs/' + Game.run.id + '/answer', { position: position, answers: answers }, opts).then(function (res) {
      Game.score = res.score;
      hud.score.textContent = String(res.score);
      return reveal(res).then(function () {
        Game.busy = false;
        if (res.finished || Game.ended || !res.question) { finishRun(); return; }
        showQuestion(res.question);
      });
    }, function (e) {
      Game.busy = false;
      if (e.code === 'wrong_answer_count') { lockInputs(false); hud.feedback.textContent = e.message; return; }
      var note = e.code === 'time_up' || e.code === 'run_finished' ? null
        : e.code === 'network' || e.code === 'server' ? 'We lost the connection, so the run ended here.' : e.message;
      finishRun(note);
    });
  }

  /** Right: ~400 ms green. Any wrong: "Wrong", each blank marked, the right words for ~1 s. */
  function reveal(res) {
    var allRight = res.results.every(function (r) { return r.right; });
    res.results.forEach(function (r) {
      var b = Game.blanks[r.id];
      if (!b) return;
      b.textContent = r.correct;     // replaces a hard-mode input too
      b.classList.remove('is-target');
      b.classList.add(r.right ? 'is-right' : 'is-wrong');
    });
    if (allRight) {
      hud.verse.classList.add('is-right');
      hud.feedback.className = 'sr-feedback is-right';
      hud.feedback.textContent = res.points ? 'Right! +' + res.points : 'Right!';
      return sleep(400);
    }
    hud.verse.classList.add('is-wrong');
    hud.feedback.className = 'sr-feedback is-wrong';
    hud.feedback.textContent = 'Wrong' + (res.points ? ' · +' + res.points : '');
    return sleep(1000);
  }

  function finishRun(note) {
    if (Game.finishing || !Game.run) return;
    Game.finishing = true; Game.ended = true;
    clearInterval(Game.timer);
    document.removeEventListener('visibilitychange', tick);
    if (Game.keyHandler) document.removeEventListener('keydown', Game.keyHandler);
    lockInputs(true);
    if (hud.feedback && !hud.feedback.textContent) hud.feedback.textContent = "Time's up!";

    var run = Game.run;
    var opts = run.guestId ? { guestId: run.guestId } : { auth: 'user' };
    var call = function () { return api('POST', '/seed-rush/runs/' + run.id + '/finish', undefined, opts); };
    call().catch(function () { return sleep(1500).then(call); }).then(function (res) {
      Game.active = false;
      store.del('sr.active');
      rememberResult(res, run.guestId);
      setPlaying(false);
      renderResult(res, { note: note, fresh: true });
      if (Claim.pending) Claim.maybe().then(function () { Auth.emit(); });
    }, function () {
      Game.active = false;
      setPlaying(false);
      // Keep sr.active: the next visit finishes it (finish is idempotent).
      gameScreen(h('div', { class: 'sr-panel' },
        h('h2', null, 'Your run ended'),
        h('p', null, 'You scored ' + plural(Game.score, 'point', 'points') + ". We couldn't load the full result right now; it will show the next time you open this page."),
        h('div', { class: 'sr-actions' }, h('button', { class: 'sr-btn sr-btn-primary', type: 'button', onclick: function () { location.reload(); } }, 'Try again'))));
    });
  }

  function rememberResult(res, guestId) {
    if (!res) return;
    if (guestId) {
      store.set('sr.guestStreak', { streak: res.streak, day: res.game_day || Day.today() });
      if (res.kind === 'daily') store.set('sr.lastDaily', { game_day: res.game_day, guestId: guestId, result: res });
    }
    if (!guestId && Auth.me && res.kind === 'daily') { Auth.me.played_today = true; Auth.me.streak = res.streak; }
  }

  // ══ 8. End of run ═══════════════════════════════════════════════════════

  function verseOutcome(v) {
    if (!v.answered) return 'skipped';
    var blanks = v.blanks || [];
    var right = blanks.filter(function (b) { return b.right; }).length;
    return right === blanks.length && right > 0 ? 'right' : right > 0 ? 'part' : 'wrong';
  }

  function shareText(res) {
    var squares = (res.verses || []).filter(function (v) { return v.answered; }).map(function (v) {
      var o = verseOutcome(v);
      return o === 'right' ? '🟩' : o === 'part' ? '🟨' : '🟥';
    }).join('');
    return '🌱 Seed Rush · ' + shortDate(res.game_day) + ' · ' + MODE_NAMES[res.mode] + ' · ' +
      res.score + ' pts\n' + (squares || '—') + '\ndollarseeds.app/seed-rush';
  }

  /** The one filled button of a daily end state. */
  function shareButton(res, status) {
    var text = shareText(res);
    var btn = h('button', { class: 'sr-btn sr-btn-primary', type: 'button' }, 'Share');
    btn.addEventListener('click', function () {
      var phone = navigator.share && matchMedia('(pointer: coarse)').matches;
      if (phone) {
        navigator.share({ text: text }).catch(function (e) { if (e && e.name !== 'AbortError') copy(); });
      } else copy();
    });
    function copy() {
      var done = function () { status.textContent = 'Copied!'; setTimeout(function () { status.textContent = ''; }, 2500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else fallback();
      function fallback() {
        var ta = h('textarea', { style: 'position:fixed;opacity:0;top:0;left:0' }); ta.value = text;
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { status.textContent = "Couldn't copy. Please try again."; }
        ta.remove();
      }
    }
    return btn;
  }

  function verseList(res) {
    return h('ul', { class: 'sr-result-list', role: 'list' }, (res.verses || []).map(function (v) {
      var o = verseOutcome(v);
      var label = { right: 'Right', part: 'Partly right', wrong: 'Wrong', skipped: 'Not answered' }[o];
      var icon = { right: '🟩', part: '🟨', wrong: '🟥', skipped: '⬜' }[o];
      var words = (v.blanks || []).map(function (b) { return b.correct; });
      return h('li', { class: 'sr-result-item' },
        h('span', { class: 'sr-result-icon', 'aria-hidden': 'true' }, icon),
        h('p', null,
          h('span', { class: 'sr-result-ref' }, h('a', { href: '/verses/' + v.slug }, v.reference)),
          h('span', { class: 'sr-result-status is-' + o }, label)),
        words.length ? h('p', { class: 'sr-result-words' }, 'Missing words: ', h('b', null, words.join(', '))) : null);
    }));
  }

  /** At most one quiet line about getting on the leaderboard. Daily only. */
  function leaderboardLine(res) {
    if (res.kind !== 'daily' || !Auth.sb) return null;
    if (!Auth.user) {
      return h('p', { class: 'sr-quiet-line' },
        'Want to see how well you scored in today\'s leaderboard and unlock exclusive badges? Sign up with an account. ',
        h('button', { class: 'sr-link-btn', type: 'button', onclick: function () { AccountDialog.open('signup'); } }, 'Create account'));
    }
    var me = Auth.me;
    if (me && !me.username) {
      return h('p', { class: 'sr-quiet-line' }, 'Pick a username to appear on the leaderboard. ',
        h('button', { class: 'sr-link-btn', type: 'button', onclick: function () { AccountDialog.open('username'); } }, 'Pick a username'));
    }
    if (me && !me.email_verified) {
      return h('p', { class: 'sr-quiet-line' }, 'Verify your email to appear on the leaderboard. ', verifySend());
    }
    return null;
  }

  /** The plant, optionally growing from the previous stage (once, after the
      run that crossed a threshold). */
  function plantBlock(streak, grew) {
    var stage = stageFor(streak);
    if (!grew) return h('div', { class: 'sr-plant-wrap' }, plantImg(stage, 'sr-plant-big'));
    var before = plantImg(stage - 1, 'sr-plant-big sr-grow-from');
    before.setAttribute('aria-hidden', 'true'); before.alt = '';
    return h('div', { class: 'sr-plant-wrap is-growing' }, before, plantImg(stage, 'sr-plant-big sr-grow-to'));
  }

  function renderResult(res, ctx) {
    ctx = ctx || {};
    Game.lastResult = res; Game.lastCtx = ctx;
    setPlaying(false);
    var daily = res.kind === 'daily';
    var streak = daily ? (res.streak || 0) : currentStreak();
    var grew = daily && ctx.fresh && !reduceMotion && streak > 0 && stageFor(streak - 1) !== stageFor(streak);

    var meta = res.words_right + ' right · ' + res.words_wrong + ' wrong · ' + MODE_NAMES[res.mode] +
      (daily && res.rank ? ' · Rank #' + res.rank : '');
    var listId = 'sr-verses-' + res.run_id;
    var list = h('div', { id: listId, class: 'sr-result-verses', hidden: true }, verseList(res));
    var toggle = h('button', { class: 'sr-btn sr-btn-secondary', type: 'button', 'aria-expanded': 'false', 'aria-controls': listId },
      daily ? "See today's verses" : 'See the verses');
    toggle.addEventListener('click', function () {
      var open = list.hidden;
      list.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    });
    var copied = h('span', { class: 'sr-copied', 'aria-live': 'polite' });
    var countdown = null;
    if (daily) {
      countdown = h('span', { class: 'sr-clock' }, '–');
      if (Day.data) liveCountdown(countdown, null, clockText);
    }

    var streakText = streak > 0
      ? h('p', { class: 'sr-streak' }, h('span', { class: 'sr-streak-num' }, String(streak)), h('span', { class: 'sr-streak-label' }, 'day streak'))
      : h('p', { class: 'sr-streak-empty' }, daily ? 'Play tomorrow to grow your streak' : "Play today's Seed Rush to grow your streak");

    gameScreen(h('div', { class: 'sr-end' },
      h('h1', { class: 'sr-only' }, daily ? "Today's Seed Rush result" : 'Practice result'),
      ctx.note ? h('p', { class: 'sr-quiet-line', role: 'status' }, ctx.note) : null,
      plantBlock(streak, grew),
      streakText,
      daily && streak > 0 ? h('p', { class: 'sr-hint-line' }, growthHint(streak)) : null,
      h('p', { class: 'sr-score-big' }, String(res.score), h('span', null, res.score === 1 ? ' pt' : ' pts')),
      h('p', { class: 'sr-score-meta' }, meta),
      daily ? h('div', { class: 'sr-cta-row' }, shareButton(res, copied), copied) : null,
      daily ? h('p', { class: 'sr-next' }, 'Next Seed Rush in ', countdown) : null,
      h('div', { class: 'sr-cta-row' }, daily ? [
        toggle,
        h('a', { class: 'sr-btn sr-btn-secondary', href: '/seed-rush/practice' }, 'Practice')
      ] : [
        h('button', { class: 'sr-btn sr-btn-secondary', type: 'button', onclick: function () { renderPrerun(); } }, 'Change mode'),
        toggle,
        h('button', { class: 'sr-btn sr-btn-primary', type: 'button', onclick: function () { countIn(res.mode); } }, 'Play again')
      ]),
      list,
      leaderboardLine(res)
    ), function () { renderResult(res, { already: ctx.already, note: ctx.note }); });
    window.scrollTo(0, 0);
  }

  // ══ 9. Study ════════════════════════════════════════════════════════════

  function bootStudy(root) {
    var cards = $all('[data-sr-card]', root);
    if (!cards.length) return;
    var nav = $('[data-sr-study-nav]', root), pos = $('[data-sr-study-pos]', root);
    var prev = $('[data-sr-prev]', root), next = $('[data-sr-next]', root);
    var index = 0;
    var fromHash = cards.findIndex(function (c) { return '#' + c.id === location.hash; });
    if (fromHash > 0) index = fromHash;

    function show(i) {
      index = Math.max(0, Math.min(cards.length - 1, i));
      cards.forEach(function (c, j) {
        c.classList.toggle('is-current', j === index);
        var d = $('details', c); if (d && j !== index) d.open = false;
      });
      pos.textContent = (index + 1) + ' of ' + cards.length;
      prev.disabled = index === 0; next.disabled = index === cards.length - 1;
    }
    root.classList.add('is-ready');
    nav.hidden = false;
    if (!matchMedia('(hover: none)').matches) $('[data-sr-study-keys]', root).hidden = false;
    prev.addEventListener('click', function () { show(index - 1); });
    next.addEventListener('click', function () { show(index + 1); });
    document.addEventListener('keydown', function (ev) {
      if (ev.altKey || ev.ctrlKey || ev.metaKey || /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); show(index - 1); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); show(index + 1); }
    });
    show(index);
  }

  // ══ 10. Verify ══════════════════════════════════════════════════════════

  function bootVerify(node) {
    var params = new URLSearchParams(location.search);
    var token = params.get('token');
    // The token is single-use; keep it out of history and referrers.
    if (token && history.replaceState) history.replaceState(null, '', location.pathname);

    function panel(title, text, extra) {
      clear(node);
      append(node, [h('h2', null, title), text ? h('p', null, text) : null, extra || null]);
    }
    function back() { return h('div', { class: 'sr-cta-row' }, h('a', { class: 'sr-btn sr-btn-primary', href: '/seed-rush' }, 'Back to Seed Rush')); }
    function expired() {
      var extra = Auth.user ? h('p', { class: 'sr-quiet-line' }, verifySend('Send a new email'))
        : h('div', { class: 'sr-cta-row' },
          h('button', { class: 'sr-btn sr-btn-primary', type: 'button', onclick: function () { AccountDialog.open('signin'); } }, 'Log in to send a new email'));
      panel('This link has expired', 'Verification links work for 24 hours.', extra);
    }

    if (!token) { panel("This link isn't valid", 'Open the link from your verification email, or ask for a new one from Seed Rush.', back()); return; }

    var state = 'checking';
    Auth.on(function () { if (state === 'expired') expired(); });
    withWake(function () {
      return api('POST', '/seed-rush/verification/confirm', { token: token }, { auth: 'none' });
    }, function (waiting) { if (waiting) panel('Checking your link…', 'Waking up the game…'); }).then(function () {
      state = 'verified';
      panel('Your email is verified', "Your email is verified. You'll now appear on the leaderboard.", back());
    }, function (e) {
      if (e.code === 'expired_token') { state = 'expired'; Auth.ready.then(expired); return; }
      if (e.code === 'invalid_token') { panel("This link isn't valid", "The token isn't valid. It may have been used already, or a newer email replaced it.", back()); return; }
      panel('Something went wrong', e.message,
        h('div', { class: 'sr-cta-row' }, h('button', { class: 'sr-btn sr-btn-primary', type: 'button', onclick: function () { location.reload(); } }, 'Try again')));
    });
  }

  // ══ 11. Boot ════════════════════════════════════════════════════════════

  function boot() {
    var game = $('[data-sr-game]');
    var study = $('[data-sr-study]');
    var verify = $('[data-sr-verify]');

    if (study) {
      bootStudy(study);
      Day.load().catch(function () {});      // wake the backend for the next run
      return;
    }
    Auth.init();
    if (game) bootGame(game);
    else if (verify) { Auth.ready.then(function () { return Auth.refreshMe(); }); bootVerify(verify); Day.load().catch(function () {}); }
    else Day.load().catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
