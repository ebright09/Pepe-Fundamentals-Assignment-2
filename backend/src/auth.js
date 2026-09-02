import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import { ApiError } from './errors.js';

/**
 * Authentication middleware.
 *
 * The frontend signs in against Neon Managed Better Auth and receives a JWT.
 * It sends that token to this API as `Authorization: Bearer <token>`. We
 * verify the signature against Neon's published JWKS — we never trust the
 * token's contents without checking who signed it — and then hand the very
 * same token on to the Data API, so Postgres sees the real end user and
 * applies their RLS policies.
 */

let jwks;

const getJwks = (config) => {
  if (!jwks) jwks = createRemoteJWKSet(new URL(config.jwksUrl));
  return jwks;
};

/** Exposed for tests, which install their own verifier. */
export const __setJwksForTests = (fn) => {
  jwks = fn;
};

export const extractBearerToken = (header) => {
  if (!header || typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
};

export const requireAuth = (config) => async (req, _res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw ApiError.unauthorized('You must be signed in to do that.');
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(token, getJwks(config), {
        // Neon signs with the auth service as issuer; clock tolerance covers
        // small drift between the browser, this function and Neon.
        clockTolerance: 30,
      }));
    } catch (cause) {
      throw ApiError.unauthorized('Your session has expired or is not valid. Please sign in again.');
    }

    if (!payload.sub) {
      throw ApiError.unauthorized('That token is missing a user id.');
    }

    // The verified identity. Note that nothing downstream *trusts* this for
    // access control — it is used for logging and for sanity checks. The
    // actual enforcement happens in Postgres via RLS.
    req.userId = payload.sub;
    req.userEmail = payload.email ?? null;
    req.accessToken = token;
    next();
  } catch (error) {
    next(error);
  }
};

/** Read the `sub` from a token without verifying — for diagnostics only. */
export const unsafeDecodeSub = (token) => {
  try {
    return decodeJwt(token).sub ?? null;
  } catch {
    return null;
  }
};
