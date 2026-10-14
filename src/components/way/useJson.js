'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * GET a JSON endpoint and keep the result keyed by its URL, so switching URL
 * shows `loading` straight away without resetting state inside an effect.
 * Pass `null` to skip. Returns { data, error, loading, reload }.
 */
export function useJson(url) {
  const [state, setState] = useState({ url: null, data: null, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return undefined;
    const ctrl = new AbortController();
    fetch(url, { signal: ctrl.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        setState({ url, data, error: res.ok ? null : data?.error || `Request failed (${res.status})`, status: res.status });
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setState({ url, data: null, error: e.message || 'Network error' });
      });
    return () => ctrl.abort();
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = url && state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    status: current ? state.status : null,
    loading: !!url && !current,
    reload,
  };
}
