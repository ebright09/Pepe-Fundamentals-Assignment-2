import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrip, MAX_TRIP } from '../fx/TripContext.jsx';
import { Button } from './ui.jsx';

/** Intensity slider, a one-click maximum, and the calm-mode escape hatch. */
const TripControls = () => {
  const { intensity, setIntensity, calm, toggleCalm, maxTrip, melting } = useTrip();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label
          htmlFor="trip-intensity"
          className="text-xs font-bold tracking-widest text-violet-300/70 uppercase"
        >
          Trip
        </label>
        <input
          id="trip-intensity"
          type="range"
          min="0"
          max={MAX_TRIP}
          step="0.1"
          value={intensity}
          disabled={calm}
          onChange={(event) => setIntensity(Number(event.target.value))}
          className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-fuchsia-500 disabled:opacity-40 sm:w-32"
          aria-label="Visual effect intensity"
          aria-valuetext={`${Math.round((intensity / MAX_TRIP) * 100)} percent${melting ? ', melting' : ''}`}
        />
      </div>

      <button
        type="button"
        onClick={maxTrip}
        disabled={calm}
        className={`rounded-full border px-3 py-1 text-xs font-black tracking-wider uppercase transition disabled:opacity-40 ${
          melting
            ? 'border-transparent bg-gradient-to-r from-fuchsia-500 via-amber-400 to-cyan-400 text-black'
            : 'border-fuchsia-400/50 text-fuchsia-200 hover:border-fuchsia-300'
        }`}
        title="Everything, all the way up"
      >
        {melting ? '🫠 Melting' : '🌈 Max trip'}
      </button>
      <button
        type="button"
        onClick={toggleCalm}
        aria-pressed={calm}
        className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
          calm
            ? 'border-emerald-400/70 bg-emerald-400/20 text-emerald-100'
            : 'border-violet-400/30 text-violet-200/70 hover:border-violet-300/60'
        }`}
        title="Turn every animation off"
      >
        {calm ? '🌿 Calm mode on' : '🌿 Calm mode'}
      </button>
    </div>
  );
};

export const Header = ({ user, onSignOut, onAdd, signingOut }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="glass neon-frame mb-6 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="holo-text aberrate truncate text-2xl font-black tracking-tight sm:text-3xl">
            🌀 Networking Tracker
          </h1>
          <p className="mt-0.5 truncate text-xs text-violet-200/60 sm:text-sm">
            Signed in as{' '}
            <span className="font-semibold text-violet-100">
              {user?.email ?? user?.name ?? 'you'}
            </span>
          </p>
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-4 lg:flex">
          <TripControls />
          <Button onClick={onAdd}>✦ Add contact</Button>
          <Button variant="ghost" onClick={onSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-2 lg:hidden">
          <Button onClick={onAdd} className="px-3 py-2 text-xs">
            ✦ Add
          </Button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label="More options"
            className="rounded-xl border border-violet-400/30 bg-black/40 px-3 py-2 text-violet-100"
          >
            ☰
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden lg:hidden"
          >
            <div className="mt-4 flex flex-col gap-4 border-t border-violet-400/20 pt-4">
              <TripControls />
              <Button variant="ghost" onClick={onSignOut} disabled={signingOut}>
                {signingOut ? 'Signing out…' : 'Sign out'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
