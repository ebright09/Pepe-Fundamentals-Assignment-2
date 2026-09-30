import { useCallback, useEffect, useState } from 'react';
import { neon, isConfigured, authUrl } from './neonClient.js';

/**
 * A thin wrapper over the Neon/Better Auth client.
 *
 * The SDK is at 0.7.0-beta, so each call is written to accept either the
 * `signIn.email({...})` shape or a plain `signIn({...})`, and the token getter
 * tries the documented accessors in turn. That keeps a minor SDK change from
 * breaking sign-in outright.
 */

const unwrap = (result) => {
  if (result?.error) {
    const message =
      result.error.message || result.error.statusText || 'That did not work. Please try again.';
    throw new Error(message);
  }
  return result?.data ?? result;
};

const call = async (namespace, payload) => {
  if (typeof namespace?.email === 'function') return unwrap(await namespace.email(payload));
  if (typeof namespace === 'function') return unwrap(await namespace(payload));
  throw new Error('The authentication client is not available.');
};

export const signUp = ({ email, password, name }) =>
  call(neon.auth.signUp, { email, password, name: name || email.split('@')[0] });

export const signIn = ({ email, password }) => call(neon.auth.signIn, { email, password });

export const signOut = async () => {
  const result = await neon.auth.signOut();
  return unwrap(result);
};

/**
 * The JWT to send to our API.
 *
 * Better Auth keeps an HTTP-only session cookie and mints a short-lived JWT
 * from it, so this is called before each request rather than cached.
 *
 * It fetches `<auth>/token` directly instead of going through the SDK. The
 * client is a Proxy that turns any property access into a request, and neither
 * `token()` nor `getToken()` produced a usable JWT here — `getToken()` resolves
 * to `/get-token`, which does not exist and 404s on every call. A plain
 * credentialed GET to `/token` is the request the endpoint actually answers,
 * verified against the deployed auth service. The SDK accessors remain as
 * fallbacks in case a future version changes this.
 */
const readToken = (payload) =>
  payload?.data?.token ?? payload?.token ?? payload?.access_token ?? null;

export const getAccessToken = async () => {
  if (authUrl) {
    try {
      const response = await fetch(`${authUrl.replace(/\/+$/, '')}/token`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        const token = readToken(await response.json());
        if (typeof token === 'string' && token.length > 0) return token;
      }
    } catch {
      /* fall through to the SDK */
    }
  }

  const auth = neon?.auth;
  if (!auth) return null;

  for (const accessor of ['token', 'getToken']) {
    if (typeof auth[accessor] === 'function') {
      try {
        const result = await auth[accessor]();
        const token = readToken(result) ?? (typeof result === 'string' ? result : null);
        if (typeof token === 'string' && token.length > 0) return token;
      } catch {
        /* try the next accessor */
      }
    }
  }

  try {
    const session = await auth.getSession();
    const data = session?.data ?? session;
    const token = data?.access_token ?? data?.token ?? data?.session?.token;
    if (typeof token === 'string' && token.length > 0) return token;
  } catch {
    /* no session */
  }
  return null;
};

/**
 * Current session state: `{ user, status }` where status is
 * 'loading' | 'signed-in' | 'signed-out'.
 */
export const useSession = () => {
  const [state, setState] = useState({
    user: null,
    status: isConfigured ? 'loading' : 'signed-out',
  });

  const refresh = useCallback(async () => {
    if (!isConfigured) return;
    try {
      const result = await neon.auth.getSession();
      const data = result?.data ?? result;
      const user = data?.user ?? null;
      setState({ user, status: user ? 'signed-in' : 'signed-out' });
    } catch {
      setState({ user: null, status: 'signed-out' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
};
