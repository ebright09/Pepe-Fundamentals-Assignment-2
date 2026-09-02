import { motion } from 'framer-motion';
import { Button } from './ui.jsx';

/**
 * The four states every data view needs: loading, empty, error and a
 * first-run prompt. Each one says what is happening and what to do next.
 */

export const LoadingList = () => (
  <div className="space-y-3" role="status" aria-live="polite">
    <span className="sr-only">Loading your contacts…</span>
    {[0, 1, 2, 3].map((i) => (
      <div
        key={i}
        className="glass h-20 animate-pulse"
        style={{
          animationDelay: `${i * 120}ms`,
          background:
            'linear-gradient(90deg, rgba(168,85,247,0.10), rgba(34,228,255,0.16), rgba(168,85,247,0.10))',
        }}
      />
    ))}
  </div>
);

export const EmptyState = ({ filtered, onClear, onAdd }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass neon-frame px-6 py-14 text-center"
  >
    <div className="mb-3 text-5xl" aria-hidden="true">
      {filtered ? '🔍' : '🌀'}
    </div>
    <h3 className="holo-text mb-2 text-2xl font-black">
      {filtered ? 'Nothing matches that' : 'Your constellation is empty'}
    </h3>
    <p className="mx-auto mb-6 max-w-md text-sm text-violet-200/70">
      {filtered
        ? 'No contact matches your current search and filter. Try widening them.'
        : 'Add the first person you want to stay connected with at Berkeley, and watch this place light up.'}
    </p>
    {filtered ? (
      <Button variant="ghost" onClick={onClear}>
        Clear filters
      </Button>
    ) : (
      <Button onClick={onAdd}>✦ Add your first contact</Button>
    )}
  </motion.div>
);

export const ErrorState = ({ message, onRetry }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.97 }}
    animate={{ opacity: 1, scale: 1 }}
    role="alert"
    className="glass border-rose-400/50 px-6 py-10 text-center"
  >
    <div className="mb-3 text-4xl" aria-hidden="true">
      ⚠️
    </div>
    <h3 className="mb-2 text-xl font-black text-rose-200">Could not load your contacts</h3>
    <p className="mx-auto mb-6 max-w-md text-sm text-violet-200/70">{message}</p>
    {onRetry ? (
      <Button variant="ghost" onClick={onRetry}>
        Try again
      </Button>
    ) : null}
  </motion.div>
);
