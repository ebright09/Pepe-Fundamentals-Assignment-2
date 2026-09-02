import confetti from 'canvas-confetti';

/**
 * Celebration effects.
 *
 * Everything here is a no-op when the trip context reports calm mode; the
 * caller passes `enabled` so these helpers stay plain functions and can be
 * called from event handlers without hooks.
 */

const NEON = ['#ff2bd6', '#22e4ff', '#39ff14', '#ffb703', '#a855f7', '#ffffff'];

/** A two-sided burst, used whenever a contact is saved. */
export const burstConfetti = (enabled = true) => {
  if (!enabled) return;
  const base = { particleCount: 90, spread: 78, colors: NEON, disableForReducedMotion: true };
  confetti({ ...base, origin: { x: 0.15, y: 0.7 }, angle: 60 });
  confetti({ ...base, origin: { x: 0.85, y: 0.7 }, angle: 120 });
};

/** A bigger, longer shower for high-priority contacts. */
export const megaConfetti = (enabled = true) => {
  if (!enabled) return;
  const end = Date.now() + 1400;
  const tick = () => {
    confetti({
      particleCount: 6,
      startVelocity: 42,
      spread: 360,
      ticks: 90,
      colors: NEON,
      shapes: ['circle', 'square', 'star'],
      scalar: 1.1,
      disableForReducedMotion: true,
      origin: { x: Math.random(), y: Math.random() * 0.5 },
    });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();
};

/** A single upward pop, used for edits and smaller wins. */
export const popConfetti = (enabled = true, origin = { x: 0.5, y: 0.6 }) => {
  if (!enabled) return;
  confetti({
    particleCount: 45,
    spread: 55,
    startVelocity: 34,
    colors: NEON,
    origin,
    disableForReducedMotion: true,
  });
};
