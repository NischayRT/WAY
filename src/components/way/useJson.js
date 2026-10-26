'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

// Responses kept for this browser tab, keyed by URL: going back to a page
// shows its last data at once while a fresh copy loads in the background
// (stale-while-revalidate). Small and short-lived on purpose.
const cache = new Map(); // url -> { data, error, status, t }
const MAX_ENTRIES = 80;
const FRESH_MS = 30 * 1000; // younger than this: don't even refetch
const inflight = new Map(); // url -> Promise, so two widgets share one request

function remember(url, entry) {
  cache.delete(url);
  cache.set(url, entry);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
}

function load(url) {
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url)
    .then(async (res) => {
      const data = await res.json().catch(() => null);
      const entry = { data, error: res.ok ? null : data?.error || `Request failed (${res.status})`, status: res.status, t: Date.now() };
      // Only successful answers are reused; errors are always retried.
      if (res.ok) remember(url, entry);
      return entry;
    })
    .catch((e) => ({ data: null, error: e.message || 'Network error', status: null, t: Date.now() }))
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/** Drop cached responses whose URL starts with `prefix` (e.g. after a change). */
export function invalidateJson(prefix = '') {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

// Cached responses belong to one account. Whenever the signed-in user changes
// (sign-out, or a different account signing in on the same tab without a
// reload), forget everything so the next account never sees the last one's data.
let cacheOwner;
let watching = false;
function watchAccount() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  try {
    createClient().auth.onAuthStateChange((_event, session) => {
      const owner = session?.user?.id ?? null;
      if (owner !== cacheOwner) {
        cache.clear();
        inflight.clear();
        cacheOwner = owner;
      }
    });
  } catch {
    // No auth client (e.g. tests): nothing to watch.
  }
}

/**
 * GET a JSON endpoint and keep the result keyed by its URL, so switching URL
 * shows `loading` straight away without resetting state inside an effect.
 * A URL seen earlier in this tab shows its last data immediately and is
 * refreshed in the background. Pass `null` to skip.
 * Returns { data, error, status, loading, reload }.
 */
export function useJson(url) {
  watchAccount();
  const [state, setState] = useState(() => (url && cache.has(url) ? { url, ...cache.get(url) } : { url: null, data: null, error: null }));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    let live = true;
    const hit = cache.get(url);
    if (hit) {
      // Show the last answer now (if this hook isn't already on it)...
      setState((s) => (s.url === url ? s : { url, ...hit }));
      // ...and skip the network entirely when it is very recent.
      if (!nonce && Date.now() - hit.t < FRESH_MS) return undefined;
    }
    load(url).then((entry) => {
      if (live) setState({ url, ...entry });
    });
    return () => {
      live = false;
    };
  }, [url, nonce]);

  const reload = useCallback(() => {
    if (url) cache.delete(url);
    setNonce((n) => n + 1);
  }, [url]);

  const current = url && state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    status: current ? state.status : null,
    loading: !!url && !current,
    reload,
  };
}
