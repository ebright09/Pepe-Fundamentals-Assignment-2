import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { signIn, signUp } from '../auth.js';
import { Button, Field, Input } from './ui.jsx';
import { useToast } from './Toasts.jsx';
import { useFireworks } from '../fx/Fireworks.jsx';
import { megaConfetti } from '../fx/celebrate.js';
import { useTrip } from '../fx/TripContext.jsx';

/**
 * The sign-in / sign-up screen. Nothing else in the app renders until this
 * succeeds, so an unauthenticated visitor can never see a contact list at all.
 */
export const AuthGate = ({ onAuthenticated }) => {
  const [mode, setMode] = useState('sign-in');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { notify } = useToast();
  const { launch } = useFireworks();
  const { effects } = useTrip();

  const isSignUp = mode === 'sign-up';
  const set = (key) => (event) => setForm((f) => ({ ...f, [key]: event.target.value }));

  const validate = () => {
    const next = {};
    if (!form.email.trim()) next.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.password) next.password = 'Password is required.';
    else if (isSignUp && form.password.length < 8)
      next.password = 'Use at least 8 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    setBusy(true);
    setErrors({});
    try {
      if (isSignUp) {
        await signUp({ email: form.email.trim(), password: form.password, name: form.name.trim() });
      } else {
        await signIn({ email: form.email.trim(), password: form.password });
      }
      launch(3000);
      megaConfetti(effects);
      notify(isSignUp ? 'Welcome aboard! Your portal is live.' : 'Welcome back. Portal unlocked.');
      await onAuthenticated();
    } catch (error) {
      const message = error?.message ?? 'That did not work. Please try again.';
      setErrors({ form: message });
      notify(message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 30, rotateX: -8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="glass neon-frame w-full max-w-md p-7 sm:p-9"
      >
        <div className="mb-7 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            🌀
          </div>
          <h1 className="holo-text aberrate text-3xl font-black tracking-tight sm:text-4xl">
            Networking Tracker
          </h1>
          <p className="mt-2 text-sm text-violet-200/70">
            Your private orbit of people at Berkeley.
          </p>
        </div>

        <div
          className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-violet-400/25 bg-black/30 p-1"
          role="tablist"
        >
          {[
            ['sign-in', 'Sign in'],
            ['sign-up', 'Sign up'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => {
                setMode(value);
                setErrors({});
              }}
              className={`relative rounded-lg py-2 text-sm font-bold transition ${
                mode === value ? 'text-white' : 'text-violet-300/60 hover:text-violet-200'
              }`}
            >
              {mode === value && (
                <motion.span
                  layoutId="auth-tab"
                  className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-fuchsia-600/80 to-cyan-500/80"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} noValidate className="space-y-4">
          <AnimatePresence>
            {isSignUp && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Field label="Name" id="auth-name" hint="Optional — how you want to be greeted.">
                  <Input
                    id="auth-name"
                    autoComplete="name"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Oski Bear"
                  />
                </Field>
              </motion.div>
            )}
          </AnimatePresence>

          <Field label="Email" id="auth-email" error={errors.email}>
            <Input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              invalid={Boolean(errors.email)}
              value={form.email}
              onChange={set('email')}
              placeholder="you@berkeley.edu"
            />
          </Field>

          <Field
            label="Password"
            id="auth-password"
            error={errors.password}
            hint={isSignUp ? 'At least 8 characters.' : undefined}
          >
            <Input
              id="auth-password"
              type="password"
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              invalid={Boolean(errors.password)}
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
            />
          </Field>

          {errors.form ? (
            <p role="alert" className="rounded-lg border border-rose-400/50 bg-rose-950/40 px-3 py-2 text-sm font-semibold text-rose-200">
              {errors.form}
            </p>
          ) : null}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Opening the portal…' : isSignUp ? '✦ Create my portal' : '✦ Enter the portal'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-violet-300/50">
          Your contacts are private to your account. Postgres row-level security
          enforces that in the database itself, not just in this app.
        </p>
      </motion.div>
    </div>
  );
};
