import { describe, it, expect } from 'vitest';
import {
  createContactSchema,
  updateContactSchema,
  listQuerySchema,
  PRIORITIES,
} from '../src/validation.js';

/**
 * The required automated validation test.
 *
 * These assertions cover the two rules the assignment calls out explicitly —
 * "empty names and invalid priority values fail with a clear error message" —
 * plus the ownership rule that a client may never set user_id itself.
 */

const valid = {
  name: 'Oski Bear',
  company: 'Cal Athletics',
  role: 'Mascot',
  met_at: 'Memorial Stadium',
  notes: 'Follow up before the Big Game.',
  priority: 'high',
};

const firstMessage = (result) => result.error.issues[0].message;

describe('createContactSchema — name is required', () => {
  it('accepts a well-formed contact', () => {
    const result = createContactSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Oski Bear');
    expect(result.data.priority).toBe('high');
  });

  it('rejects an empty name with a clear message', () => {
    const result = createContactSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Name is required.');
  });

  it('rejects a whitespace-only name — trimming happens before the check', () => {
    const result = createContactSchema.safeParse({ ...valid, name: '   ' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Name is required.');
  });

  it('rejects a missing name', () => {
    const { name, ...withoutName } = valid;
    const result = createContactSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Name is required.');
  });

  it('rejects a name longer than 120 characters', () => {
    const result = createContactSchema.safeParse({ ...valid, name: 'a'.repeat(121) });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Name must be 120 characters or fewer.');
  });

  it('trims surrounding whitespace from an otherwise valid name', () => {
    const result = createContactSchema.safeParse({ ...valid, name: '  Anne Chen  ' });
    expect(result.success).toBe(true);
    expect(result.data.name).toBe('Anne Chen');
  });
});

describe('createContactSchema — priority accepts only high, medium or low', () => {
  it.each(PRIORITIES)('accepts "%s"', (priority) => {
    const result = createContactSchema.safeParse({ ...valid, priority });
    expect(result.success).toBe(true);
    expect(result.data.priority).toBe(priority);
  });

  it('rejects an out-of-range value with a clear message', () => {
    const result = createContactSchema.safeParse({ ...valid, priority: 'urgent' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Priority must be one of: high, medium, low.');
  });

  it('rejects a differently-cased value', () => {
    const result = createContactSchema.safeParse({ ...valid, priority: 'HIGH' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Priority must be one of: high, medium, low.');
  });

  it('rejects a non-string priority', () => {
    const result = createContactSchema.safeParse({ ...valid, priority: 3 });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Priority must be one of: high, medium, low.');
  });

  it('defaults to medium when priority is omitted', () => {
    const { priority, ...withoutPriority } = valid;
    const result = createContactSchema.safeParse(withoutPriority);
    expect(result.success).toBe(true);
    expect(result.data.priority).toBe('medium');
  });
});

describe('createContactSchema — ownership cannot be set by the client', () => {
  it('rejects a body that tries to set user_id', () => {
    const result = createContactSchema.safeParse({ ...valid, user_id: 'someone-elses-id' });
    expect(result.success).toBe(false);
  });

  it('rejects a body that tries to set id', () => {
    const result = createContactSchema.safeParse({ ...valid, id: 'forced-id' });
    expect(result.success).toBe(false);
  });

  it('never produces a user_id for the database layer to use', () => {
    const result = createContactSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('user_id');
  });
});

describe('createContactSchema — optional fields', () => {
  it('stores blank optional fields as null rather than empty strings', () => {
    const result = createContactSchema.safeParse({ name: 'Sam', company: '   ', notes: '' });
    expect(result.success).toBe(true);
    expect(result.data.company).toBeNull();
    expect(result.data.notes).toBeNull();
  });

  it('rejects notes longer than 2000 characters', () => {
    const result = createContactSchema.safeParse({ ...valid, notes: 'n'.repeat(2001) });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Notes must be 2000 characters or fewer.');
  });
});

describe('updateContactSchema', () => {
  it('accepts a partial update', () => {
    const result = updateContactSchema.safeParse({ priority: 'low' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ priority: 'low' });
  });

  it('leaves omitted fields out entirely so a PATCH cannot wipe them', () => {
    const result = updateContactSchema.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
    expect(Object.keys(result.data)).toEqual(['name']);
  });

  it('still allows explicitly clearing an optional field with null', () => {
    const result = updateContactSchema.safeParse({ notes: null });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ notes: null });
  });

  it('rejects an empty body', () => {
    const result = updateContactSchema.safeParse({});
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Provide at least one field to update.');
  });

  it('rejects an invalid priority', () => {
    const result = updateContactSchema.safeParse({ priority: 'someday' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Priority must be one of: high, medium, low.');
  });

  it('rejects blanking out the name', () => {
    const result = updateContactSchema.safeParse({ name: '  ' });
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe('Name is required.');
  });

  it('refuses an attempt to re-assign the row to another user', () => {
    const result = updateContactSchema.safeParse({ name: 'Mine', user_id: 'other-user' });
    expect(result.success).toBe(false);
  });
});

describe('listQuerySchema — sorting and filtering', () => {
  it('applies sensible defaults', () => {
    const result = listQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ sort: 'created_at', order: 'desc', priority: 'all' });
  });

  it('accepts a valid sort and filter', () => {
    const result = listQuerySchema.safeParse({ sort: 'name', order: 'asc', priority: 'high' });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown sort column, so nothing arbitrary reaches the database', () => {
    const result = listQuerySchema.safeParse({ sort: 'user_id' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid priority filter', () => {
    const result = listQuerySchema.safeParse({ priority: 'urgent' });
    expect(result.success).toBe(false);
  });
});
