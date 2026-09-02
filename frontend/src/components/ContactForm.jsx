import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { Button, Field, Input, Select, Textarea } from './ui.jsx';

/**
 * Create/edit dialog.
 *
 * The client-side checks below are for immediate feedback only. The server
 * validates the same rules and its `fields` map is merged into `errors`, so an
 * error raised by the API lands next to the right input.
 */

const BLANK = { name: '', company: '', role: '', met_at: '', notes: '', priority: 'medium' };

export const ContactForm = ({ open, onOpenChange, contact, onSubmit, busy, serverErrors }) => {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(contact);

  useEffect(() => {
    if (!open) return;
    setForm(
      contact
        ? {
            name: contact.name ?? '',
            company: contact.company ?? '',
            role: contact.role ?? '',
            met_at: contact.met_at ?? '',
            notes: contact.notes ?? '',
            priority: contact.priority ?? 'medium',
          }
        : BLANK
    );
    setErrors({});
  }, [open, contact]);

  useEffect(() => {
    if (serverErrors && Object.keys(serverErrors).length) setErrors(serverErrors);
  }, [serverErrors]);

  const set = (key) => (event) => {
    setForm((f) => ({ ...f, [key]: event.target.value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    else if (form.name.trim().length > 120) next.name = 'Name must be 120 characters or fewer.';
    if (!['high', 'medium', 'low'].includes(form.priority))
      next.priority = 'Priority must be one of: high, medium, low.';
    if (form.notes.length > 2000) next.notes = 'Notes must be 2000 characters or fewer.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 py-8 sm:items-center"
          aria-describedby={undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="glass neon-frame w-full max-w-lg p-6 sm:p-7"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="holo-text text-2xl font-black">
                  {isEdit ? 'Edit contact' : 'New contact'}
                </Dialog.Title>
                <p className="mt-1 text-sm text-violet-200/60">
                  {isEdit ? 'Update what you know about them.' : 'Who did you just meet?'}
                </p>
              </div>
              <Dialog.Close
                className="rounded-lg px-2 py-1 text-violet-300/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                ✕
              </Dialog.Close>
            </div>

            <form onSubmit={submit} noValidate className="space-y-4">
              <Field label="Name" id="c-name" error={errors.name}>
                <Input
                  id="c-name"
                  required
                  autoFocus
                  value={form.name}
                  onChange={set('name')}
                  invalid={Boolean(errors.name)}
                  placeholder="Priya Raman"
                  maxLength={200}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company" id="c-company" error={errors.company}>
                  <Input
                    id="c-company"
                    value={form.company}
                    onChange={set('company')}
                    invalid={Boolean(errors.company)}
                    placeholder="Berkeley Lab"
                  />
                </Field>
                <Field label="Role" id="c-role" error={errors.role}>
                  <Input
                    id="c-role"
                    value={form.role}
                    onChange={set('role')}
                    invalid={Boolean(errors.role)}
                    placeholder="Research Scientist"
                  />
                </Field>
              </div>

              <Field label="Where you met" id="c-met" error={errors.met_at}>
                <Input
                  id="c-met"
                  value={form.met_at}
                  onChange={set('met_at')}
                  invalid={Boolean(errors.met_at)}
                  placeholder="Sutardja Dai Hall career fair"
                />
              </Field>

              <Field label="Priority" id="c-priority" error={errors.priority}>
                <Select
                  id="c-priority"
                  value={form.priority}
                  onChange={set('priority')}
                  invalid={Boolean(errors.priority)}
                >
                  <option value="high">High — reach out this week</option>
                  <option value="medium">Medium — keep warm</option>
                  <option value="low">Low — nice to know</option>
                </Select>
              </Field>

              <Field
                label="Notes"
                id="c-notes"
                error={errors.notes}
                hint={`${form.notes.length} / 2000 characters`}
              >
                <Textarea
                  id="c-notes"
                  value={form.notes}
                  onChange={set('notes')}
                  invalid={Boolean(errors.notes)}
                  placeholder="Talked about her lab's work on battery chemistry. Send the paper I mentioned."
                />
              </Field>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Saving…' : isEdit ? 'Save changes' : '✦ Add contact'}
                </Button>
              </div>
            </form>
          </motion.div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
