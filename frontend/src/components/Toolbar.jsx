import { Select } from './ui.jsx';

/**
 * Search, priority filter and sort controls. Sorting and filtering are applied
 * by Postgres rather than in the browser, so the list stays correct however
 * many contacts there are.
 */

const SORTS = [
  ['created_at', 'Date added'],
  ['name', 'Name'],
  ['company', 'Company'],
  ['role', 'Role'],
  ['priority', 'Priority'],
  ['updated_at', 'Last updated'],
];

const FILTERS = [
  ['all', 'All', '#a855f7'],
  ['high', 'High', '#ff2bd6'],
  ['medium', 'Medium', '#22e4ff'],
  ['low', 'Low', '#39ff14'],
];

export const Toolbar = ({ query, onChange, count }) => {
  const update = (patch) => onChange({ ...query, ...patch });

  return (
    <div className="glass mb-5 space-y-4 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-violet-300/50"
            aria-hidden="true"
          >
            🔍
          </span>
          <input
            type="search"
            value={query.q}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="Search names, companies, notes…"
            aria-label="Search contacts"
            className="w-full rounded-xl border border-violet-400/30 bg-black/40 py-2.5 pr-3.5 pl-10 text-violet-50 placeholder:text-violet-300/35 focus:border-cyan-300 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort-by" className="sr-only">
            Sort by
          </label>
          <Select
            id="sort-by"
            value={query.sort}
            onChange={(event) => update({ sort: event.target.value })}
            className="w-auto min-w-36"
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                Sort: {label}
              </option>
            ))}
          </Select>

          <button
            type="button"
            onClick={() => update({ order: query.order === 'asc' ? 'desc' : 'asc' })}
            className="glow-on-hover rounded-xl border border-violet-400/30 bg-black/40 px-3 py-2.5 text-lg text-violet-100"
            aria-label={`Sort ${query.order === 'asc' ? 'descending' : 'ascending'}`}
            title={query.order === 'asc' ? 'Ascending' : 'Descending'}
          >
            {query.order === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs font-bold tracking-widest text-violet-300/60 uppercase">
          Priority
        </span>
        {FILTERS.map(([value, label, color]) => {
          const active = query.priority === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => update({ priority: value })}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
                active
                  ? 'border-transparent text-black'
                  : 'border-violet-400/30 text-violet-200/70 hover:border-violet-300/60'
              }`}
              style={active ? { background: color, boxShadow: `0 0 16px ${color}` } : undefined}
            >
              {label}
            </button>
          );
        })}
        <span className="ml-auto text-xs font-semibold text-violet-300/60">
          {count} {count === 1 ? 'contact' : 'contacts'}
        </span>
      </div>
    </div>
  );
};
