import { useNavigate } from 'react-router-dom';
import NavDropdown from './NavDropdown.jsx';
import { useQuickAdd } from '../lib/quickAddContext.jsx';

// Topbar "+ New ▾" button — opens global modals for adding banks/LPs/clients/
// affinity rules, or navigates to /routing for a fresh routing session.
export default function QuickAdd() {
  const { openQuickAdd } = useQuickAdd();
  const navigate = useNavigate();

  const items = [
    { label: 'Bank',          onClick: () => openQuickAdd({ kind: 'bank' }) },
    { label: 'LP',            onClick: () => openQuickAdd({ kind: 'lp' }) },
    { label: 'Client',        onClick: () => openQuickAdd({ kind: 'client' }) },
    { label: 'Affinity rule', onClick: () => openQuickAdd({ kind: 'affinity' }) },
    { divider: true },
    { label: 'Route new client…', onClick: () => navigate('/routing?reset=1') }
  ];

  return (
    <div className="quickadd-wrap">
      <NavDropdown label={<span><strong>+ New</strong></span>} items={items} />
    </div>
  );
}
