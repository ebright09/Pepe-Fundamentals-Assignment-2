import { ApiError } from './errors.js';

/**
 * A thin client for the Neon Data API (PostgREST).
 *
 * Every call carries the *end user's* access token, not a service credential.
 * That is the whole security design: this process has no privileged database
 * identity, so Postgres evaluates the RLS policies for the signed-in user on
 * every statement and a bug in this file cannot expose another user's rows.
 */

/**
 * PostgREST filter values are comma/parenthesis delimited. Wrapping a value in
 * double quotes and escaping backslashes and quotes makes arbitrary user text
 * safe to embed in a filter expression.
 */
const quoteFilterValue = (value) => `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

export const createDataApi = (config, fetchImpl = globalThis.fetch) => {
  const base = config.dataApiUrl;

  const request = async (accessToken, path, { method = 'GET', body, prefer } = {}) => {
    const headers = {
      // Forwarding the caller's token is what makes RLS apply to this request.
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;

    let response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (cause) {
      throw new ApiError(502, 'Could not reach the database right now. Please try again.');
    }

    const text = await response.text();
    const payload = text ? safeJsonParse(text) : null;

    if (!response.ok) {
      throw translateDataApiError(response.status, payload);
    }
    return payload;
  };

  return {
    /** List the caller's contacts, sorted and filtered. */
    list: (accessToken, { sort, order, priority, q }) => {
      const params = new URLSearchParams();
      params.set('select', '*');
      // Secondary sort keeps pagination-free ordering stable and predictable.
      params.set('order', `${sort}.${order}.nullslast,created_at.desc`);
      if (priority && priority !== 'all') params.set('priority', `eq.${priority}`);
      if (q) {
        const needle = quoteFilterValue(`*${q}*`);
        params.set(
          'or',
          `(name.ilike.${needle},company.ilike.${needle},role.ilike.${needle},met_at.ilike.${needle},notes.ilike.${needle})`
        );
      }
      return request(accessToken, `/contacts?${params.toString()}`);
    },

    /**
     * Insert. We deliberately do not send user_id — the column's
     * `default auth.user_id()` fills it from the caller's own token.
     */
    create: async (accessToken, values) => {
      const rows = await request(accessToken, '/contacts?select=*', {
        method: 'POST',
        body: values,
        prefer: 'return=representation',
      });
      return Array.isArray(rows) ? rows[0] : rows;
    },

    /**
     * Update by id. There is no `user_id` filter here on purpose: the RLS
     * USING clause is what limits the statement to rows the caller owns, so a
     * request for someone else's id simply matches nothing and we 404.
     */
    update: async (accessToken, id, values) => {
      const rows = await request(accessToken, `/contacts?id=eq.${encodeURIComponent(id)}&select=*`, {
        method: 'PATCH',
        body: values,
        prefer: 'return=representation',
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw ApiError.notFound();
      return row;
    },

    /** Delete by id — again bounded by RLS rather than by an app-level filter. */
    remove: async (accessToken, id) => {
      const rows = await request(accessToken, `/contacts?id=eq.${encodeURIComponent(id)}&select=*`, {
        method: 'DELETE',
        prefer: 'return=representation',
      });
      const row = Array.isArray(rows) ? rows[0] : rows;
      if (!row) throw ApiError.notFound();
      return row;
    },
  };
};

const safeJsonParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/**
 * Map Postgres/PostgREST failures onto messages a user can act on, without
 * echoing raw database detail back to the browser.
 */
const translateDataApiError = (status, payload) => {
  const code = payload?.code;
  const detail = `${payload?.message ?? ''} ${payload?.details ?? ''}`;

  // 23514 = check_violation. Our CHECK constraints are the database-level
  // mirror of the Zod rules, so name them specifically.
  if (code === '23514') {
    if (detail.includes('contacts_priority_valid')) {
      return ApiError.badRequest('Priority must be one of: high, medium, low.', {
        priority: 'Priority must be one of: high, medium, low.',
      });
    }
    if (detail.includes('contacts_name_not_blank')) {
      return ApiError.badRequest('Name is required.', { name: 'Name is required.' });
    }
    return ApiError.badRequest('That contact does not satisfy a database constraint.');
  }

  // 42501 = insufficient_privilege, and PostgREST reports an RLS rejection on
  // insert/update as a violation of the WITH CHECK expression.
  if (status === 403 || code === '42501') {
    return ApiError.forbidden('You can only create or change contacts that belong to you.');
  }
  if (status === 401) {
    return ApiError.unauthorized('Your session has expired. Please sign in again.');
  }
  if (status === 404) {
    return ApiError.notFound();
  }
  if (status === 400) {
    return ApiError.badRequest('That request was not valid.');
  }

  return new ApiError(502, 'The database rejected that request. Please try again.');
};
