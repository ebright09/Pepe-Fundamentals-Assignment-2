import { AnimatePresence, motion } from 'framer-motion';
import { PriorityBadge } from './ui.jsx';

/**
 * One data set, two presentations: a table from `md` up, stacked cards below.
 * Both are driven by the same array, so nothing can drift between them.
 */

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
};

const RowActions = ({ contact, onEdit, onDelete, compact }) => (
  <div className={`flex gap-2 ${compact ? '' : 'justify-end'}`}>
    <button
      type="button"
      onClick={() => onEdit(contact)}
      className="rounded-lg border border-cyan-400/40 px-2.5 py-1 text-xs font-bold text-cyan-200 transition hover:bg-cyan-400/15"
      aria-label={`Edit ${contact.name}`}
    >
      Edit
    </button>
    <button
      type="button"
      onClick={() => onDelete(contact)}
      className="rounded-lg border border-rose-400/40 px-2.5 py-1 text-xs font-bold text-rose-200 transition hover:bg-rose-400/15"
      aria-label={`Delete ${contact.name}`}
    >
      Delete
    </button>
  </div>
);

export const ContactList = ({ contacts, onEdit, onDelete }) => (
  <>
    {/* Desktop / tablet: table */}
    <div className="glass hidden overflow-x-auto md:block">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <caption className="sr-only">Your networking contacts</caption>
        <thead>
          <tr className="border-b border-violet-400/25 text-xs tracking-widest text-violet-300/70 uppercase">
            <th scope="col" className="px-4 py-3 font-bold">Name</th>
            <th scope="col" className="px-4 py-3 font-bold">Company &amp; role</th>
            <th scope="col" className="px-4 py-3 font-bold">Where you met</th>
            <th scope="col" className="px-4 py-3 font-bold">Priority</th>
            <th scope="col" className="px-4 py-3 font-bold">Added</th>
            <th scope="col" className="px-4 py-3 text-right font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence initial={false}>
            {contacts.map((contact) => (
              <motion.tr
                key={contact.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="border-b border-violet-400/10 align-top transition hover:bg-violet-500/10"
              >
                <th scope="row" className="px-4 py-3.5 text-left font-bold text-white">
                  {contact.name}
                  {contact.notes ? (
                    <p className="mt-1 max-w-xs text-xs font-normal text-violet-200/55">
                      {contact.notes.length > 110
                        ? `${contact.notes.slice(0, 110)}…`
                        : contact.notes}
                    </p>
                  ) : null}
                </th>
                <td className="px-4 py-3.5 text-violet-100/85">
                  {contact.company || '—'}
                  {contact.role ? (
                    <span className="block text-xs text-violet-300/60">{contact.role}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3.5 text-violet-100/75">{contact.met_at || '—'}</td>
                <td className="px-4 py-3.5">
                  <PriorityBadge priority={contact.priority} />
                </td>
                <td className="px-4 py-3.5 text-xs whitespace-nowrap text-violet-300/60">
                  {formatDate(contact.created_at)}
                </td>
                <td className="px-4 py-3.5">
                  <RowActions contact={contact} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>

    {/* Mobile: cards */}
    <ul className="space-y-3 md:hidden">
      <AnimatePresence initial={false}>
        {contacts.map((contact) => (
          <motion.li
            key={contact.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="glass neon-frame p-4"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="text-base font-black text-white">{contact.name}</h3>
              <PriorityBadge priority={contact.priority} />
            </div>

            {contact.company || contact.role ? (
              <p className="text-sm text-violet-100/85">
                {[contact.role, contact.company].filter(Boolean).join(' · ')}
              </p>
            ) : null}

            {contact.met_at ? (
              <p className="mt-1 text-xs text-violet-300/65">📍 {contact.met_at}</p>
            ) : null}

            {contact.notes ? (
              <p className="mt-2 border-l-2 border-violet-400/40 pl-2.5 text-sm text-violet-200/70">
                {contact.notes}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-violet-300/50">
                Added {formatDate(contact.created_at)}
              </span>
              <RowActions contact={contact} onEdit={onEdit} onDelete={onDelete} compact />
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  </>
);
