import { z } from 'zod';
import { ApiError } from './errors.js';

/**
 * Trusted, server-side validation.
 *
 * The browser also gives immediate feedback, but that is only a convenience —
 * a request can always be made directly against the API with curl. These
 * schemas are the authority, and the CHECK constraints in db/schema.sql are a
 * further backstop inside Postgres itself.
 */

export const PRIORITIES = ['high', 'medium', 'low'];

/** Priority accepts only high, medium or low — nothing else. */
const priority = z.enum(PRIORITIES, {
  errorMap: () => ({ message: 'Priority must be one of: high, medium, low.' }),
});

/** Trim first, then check: a name of "   " is empty, not valid. */
const requiredName = z
  .string({ required_error: 'Name is required.', invalid_type_error: 'Name must be text.' })
  .transform((value) => value.trim())
  .pipe(
    z.string().min(1, 'Name is required.').max(120, 'Name must be 120 characters or fewer.')
  );

/**
 * An optional free-text field. `.optional()` is the outermost wrapper, so an
 * absent key stays absent (PATCH leaves that column alone) while an explicit
 * null or blank string clears it.
 */
const patchText = (max, label) =>
  z
    .union([z.string(), z.null()], {
      invalid_type_error: `${label} must be text.`,
    })
    .transform((value) => {
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed === '' ? null : trimmed;
    })
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer.`).nullable())
    .optional();

/** Same, but on create an absent key means "store null". */
const optionalText = (max, label) => patchText(max, label).default(null);

/**
 * Create. `.strict()` rejects unknown keys outright — most importantly it
 * rejects an attempt to set `user_id`, which only the database may populate
 * (via its auth.user_id() default).
 */
export const createContactSchema = z
  .object({
    name: requiredName,
    company: optionalText(120, 'Company'),
    role: optionalText(120, 'Role'),
    met_at: optionalText(160, 'Where you met'),
    notes: optionalText(2000, 'Notes'),
    priority: priority.default('medium'),
  })
  .strict();

/**
 * Update. Every field is optional and omitted fields are dropped rather than
 * nulled, but at least one must be present. `user_id` and `id` remain
 * un-settable, so a row can never be handed to another user through this API.
 */
export const updateContactSchema = z
  .object({
    name: requiredName.optional(),
    company: patchText(120, 'Company'),
    role: patchText(120, 'Role'),
    met_at: patchText(160, 'Where you met'),
    notes: patchText(2000, 'Notes'),
    priority: priority.optional(),
  })
  .strict()
  .transform((value) =>
    Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined))
  )
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update.',
  });

const SORTABLE = ['name', 'company', 'role', 'priority', 'created_at', 'updated_at'];

/** Query parameters for the list endpoint: sorting, filtering and search. */
export const listQuerySchema = z.object({
  sort: z.enum(SORTABLE, { errorMap: () => ({ message: `Sort must be one of: ${SORTABLE.join(', ')}.` }) })
    .default('created_at'),
  order: z.enum(['asc', 'desc'], { errorMap: () => ({ message: "Order must be 'asc' or 'desc'." }) })
    .default('desc'),
  priority: z.enum([...PRIORITIES, 'all'], {
    errorMap: () => ({ message: "Priority filter must be one of: high, medium, low, all." }),
  }).default('all'),
  q: z.string().max(120, 'Search text must be 120 characters or fewer.').optional(),
});

export const uuidSchema = z.string().uuid('That is not a valid contact id.');

/**
 * Turn a ZodError into { message, fields } the UI can render inline.
 *
 * Zod's own text for a rejected unknown key is developer-facing, and the most
 * likely unknown key here is a deliberate attempt to set `user_id`. Both cases
 * get a message that says what actually went wrong.
 */
const describeIssue = (issue) => {
  if (issue.code === 'unrecognized_keys') {
    const keys = issue.keys ?? [];
    if (keys.includes('user_id') || keys.includes('id')) {
      return 'A contact\u2019s owner is set by the database and cannot be supplied by the client.';
    }
    return `That request contained unexpected field(s): ${keys.join(', ')}.`;
  }
  return issue.message;
};

export const formatZodError = (error) => {
  const fields = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!fields[key]) fields[key] = describeIssue(issue);
  }
  const first = error.issues[0];
  return { message: first ? describeIssue(first) : 'That request was not valid.', fields };
};

/** Parse, or throw a 400 carrying per-field messages. */
export const parseOrThrow = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    const { message, fields } = formatZodError(result.error);
    throw ApiError.badRequest(message, fields);
  }
  return result.data;
};
