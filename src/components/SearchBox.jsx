// Minimal search input with a leading icon and a clear button.
//   <SearchBox value={q} onChange={setQ} placeholder="Search banks…" />
export default function SearchBox({ value, onChange, placeholder = 'Search…', style }) {
  return (
    <div className="search-box" style={style}>
      <span className="search-icon" aria-hidden>⌕</span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear">
          ×
        </button>
      )}
    </div>
  );
}
