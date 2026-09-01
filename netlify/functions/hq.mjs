// Serves the password-gated Stevo HQ dashboard at /api/hq.
//
// This is a dumb pipe on purpose. It renders nothing: scripts/regen-dashboard.py
// builds the whole page every bot cycle and stores it in the tracker's
// stevo_hq_state row, and this function checks the shared password and hands that
// HTML back. One source of truth, and the page can change without a redeploy.
//
// Netlify env vars on the stevoapp.com site. Several names are accepted for each
// because the site already carried DASH_PASSWORD and TRACKER_SERVICE_KEY from the
// legacy /api/hq — matching the existing names beats copying the same secrets in
// again under new ones, which is two places to rotate and one to forget.
//   password: HQ_PASSWORD | HQ_PASS | DASH_PASS | DASH_PASSWORD   (already set)
//   key:      TRACKER_SERVICE | TRACKER_SERVICE_KEY               (already set)
//   url:      TRACKER_URL | TRACKER_SUPABASE_URL                  (must be added)
// The key is server-side only and never reaches the browser.

const PASS_VARS = ['HQ_PASSWORD', 'HQ_PASS', 'DASH_PASS', 'DASH_PASSWORD'];
const URL_VARS  = ['TRACKER_URL', 'TRACKER_SUPABASE_URL'];
const KEY_VARS  = ['TRACKER_SERVICE', 'TRACKER_SERVICE_KEY'];

// Length-independent comparison so the response time does not leak the password.
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const deny = () =>
  new Response('unauthorized', {
    status: 401,
    headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
  });

export default async (req) => {
  const expected = PASS_VARS.map((v) => process.env[v]).find(Boolean);
  // No password configured means locked, never open. A misconfigured deploy must
  // not publish the board.
  if (!expected) return deny();
  if (!sameSecret(req.headers.get('x-dash-pass') || '', expected)) return deny();

  const url = URL_VARS.map((v) => process.env[v]).find(Boolean);
  const key = KEY_VARS.map((v) => process.env[v]).find(Boolean);
  if (!url || !key) {
    return new Response(`HQ is not configured: need one of ${URL_VARS.join(' | ')} and one of ${KEY_VARS.join(' | ')}.`, {
      status: 500,
      headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  let page = '';
  try {
    const r = await fetch(`${url}/rest/v1/stevo_hq_state?id=eq.1&select=data`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!r.ok) throw new Error(`tracker ${r.status}`);
    page = (await r.json())?.[0]?.data?.page_html || '';
  } catch {
    return new Response('HQ state is unreachable right now. Try again in a minute.', {
      status: 502,
      headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  if (!page) {
    return new Response(
      'No dashboard has been published yet. The fix bot writes one every 2 hours ' +
        '(scripts/regen-dashboard.py).',
      { status: 503, headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  return new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Private board: no edge, browser or proxy caching, and keep it out of search.
      'cache-control': 'no-store, private',
      'x-robots-tag': 'noindex, nofollow',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
};

export const config = { path: '/api/hq' };
