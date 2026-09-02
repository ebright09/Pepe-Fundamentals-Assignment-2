import { motion } from 'framer-motion';

/**
 * Shared primitives. Keeping buttons, fields and badges here means the neon
 * treatment is defined once and every screen inherits it.
 */

export const PRIORITY_STYLES = {
  high: {
    label: 'High',
    chip: 'bg-fuchsia-500/25 text-fuchsia-200 border-fuchsia-400/60',
    dot: '#ff2bd6',
  },
  medium: {
    label: 'Medium',
    chip: 'bg-cyan-500/20 text-cyan-100 border-cyan-400/60',
    dot: '#22e4ff',
  },
  low: {
    label: 'Low',
    chip: 'bg-emerald-500/20 text-emerald-100 border-emerald-400/60',
    dot: '#39ff14',
  },
};

export const PriorityBadge = ({ priority }) => {
  const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase ${style.chip}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: style.dot, boxShadow: `0 0 8px ${style.dot}` }}
      />
      {style.label}
    </span>
  );
};

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 text-white shadow-lg shadow-fuchsia-900/40',
  ghost: 'bg-white/5 text-violet-100 border border-violet-400/30 hover:bg-white/10',
  danger: 'bg-rose-600/80 text-white hover:bg-rose-500',
};

export const Button = ({ variant = 'primary', className = '', children, ...props }) => (
  <motion.button
    whileHover={{ scale: props.disabled ? 1 : 1.04 }}
    whileTap={{ scale: props.disabled ? 1 : 0.96 }}
    transition={{ type: 'spring', stiffness: 420, damping: 18 }}
    className={`glow-on-hover inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold tracking-wide disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    {...props}
  >
    {children}
  </motion.button>
);

/** A labelled input that renders its own validation message when given one. */
export const Field = ({ label, error, hint, id, children }) => (
  <label htmlFor={id} className="block">
    <span className="mb-1.5 block text-xs font-bold tracking-widest text-violet-200/80 uppercase">
      {label}
    </span>
    {children}
    {error ? (
      <span role="alert" className="mt-1.5 block text-sm font-semibold text-rose-300">
        {error}
      </span>
    ) : hint ? (
      <span className="mt-1.5 block text-xs text-violet-300/60">{hint}</span>
    ) : null}
  </label>
);

const inputBase =
  'w-full rounded-xl border bg-black/40 px-3.5 py-2.5 text-violet-50 placeholder:text-violet-300/35 transition focus:outline-none';

export const Input = ({ invalid, className = '', ...props }) => (
  <input
    className={`${inputBase} ${
      invalid ? 'border-rose-400/80 focus:border-rose-300' : 'border-violet-400/30 focus:border-cyan-300'
    } ${className}`}
    aria-invalid={invalid || undefined}
    {...props}
  />
);

export const Textarea = ({ invalid, className = '', ...props }) => (
  <textarea
    className={`${inputBase} min-h-24 resize-y ${
      invalid ? 'border-rose-400/80 focus:border-rose-300' : 'border-violet-400/30 focus:border-cyan-300'
    } ${className}`}
    aria-invalid={invalid || undefined}
    {...props}
  />
);

export const Select = ({ invalid, className = '', children, ...props }) => (
  <select
    className={`${inputBase} appearance-none ${
      invalid ? 'border-rose-400/80' : 'border-violet-400/30 focus:border-cyan-300'
    } ${className}`}
    aria-invalid={invalid || undefined}
    {...props}
  >
    {children}
  </select>
);
