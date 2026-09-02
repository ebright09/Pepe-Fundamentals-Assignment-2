import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { Button } from './ui.jsx';

/** Deletion is irreversible, so it always goes through an explicit confirm. */
export const ConfirmDelete = ({ contact, onConfirm, onCancel, busy }) => (
  <Dialog.Root open={Boolean(contact)} onOpenChange={(open) => !open && onCancel()}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass w-full max-w-sm border-rose-400/50 p-6 text-center"
        >
          <div className="mb-3 text-4xl" aria-hidden="true">
            🗑️
          </div>
          <Dialog.Title className="mb-2 text-xl font-black text-rose-100">
            Delete this contact?
          </Dialog.Title>
          <Dialog.Description className="mb-6 text-sm text-violet-200/70">
            <span className="font-bold text-white">{contact?.name}</span> will be removed
            permanently. This cannot be undone.
          </Dialog.Description>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button variant="ghost" onClick={onCancel}>
              Keep it
            </Button>
            <Button variant="danger" onClick={onConfirm} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete forever'}
            </Button>
          </div>
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);
