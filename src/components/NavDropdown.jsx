import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// Dropdown menu for the topbar. Accepts:
//   label       — text shown on the trigger
//   items       — array of { to, label, onClick?, divider? }
//   matchPaths  — array of path prefixes; when the current URL starts with any
//                 of them, the trigger renders in "active" state.
// Items with `to` render as <NavLink>. Items with `onClick` render as <button>.
export default function NavDropdown({ label, items, matchPaths = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  // Close the menu when the route changes
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const active = matchPaths.some(p => location.pathname.startsWith(p));

  return (
    <div className="nav-dropdown" ref={ref}>
      <button
        type="button"
        className={`nav-dropdown-trigger ${active ? 'active' : ''} ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
        <span className="chev-small">▾</span>
      </button>
      {open && (
        <div className="nav-dropdown-menu" role="menu">
          {items.map((item, i) => {
            if (item.divider) return <div key={`d${i}`} className="nav-dropdown-divider" />;
            if (item.to) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  className={({ isActive }) => `nav-dropdown-item ${isActive ? 'active' : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.icon && <span className="nav-item-icon">{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.hint && <span className="nav-item-hint">{item.hint}</span>}
                </NavLink>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="nav-dropdown-item"
                onClick={() => { item.onClick?.(); setOpen(false); }}
              >
                {item.icon && <span className="nav-item-icon">{item.icon}</span>}
                <span>{item.label}</span>
                {item.hint && <span className="nav-item-hint">{item.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
