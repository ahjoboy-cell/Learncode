import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, PlusCircle, Sparkles, Download, Upload } from 'lucide-react';
import { exportLeads, importLeads } from '../utils/storage';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/leads/new', icon: PlusCircle, label: 'Add Lead' },
  { to: '/ai-email', icon: Sparkles, label: 'AI Email' },
];

export default function Layout({ onRefresh }) {
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          importLeads(ev.target.result);
          onRefresh?.();
          alert('Leads imported successfully!');
        } catch {
          alert('Invalid file format.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-primary text-white safe-top">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight">B2B CRM</h1>
          <div className="flex gap-2">
            <button
              onClick={exportLeads}
              className="p-2 rounded-lg hover:bg-primary-light transition-colors"
              title="Export leads"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handleImport}
              className="p-2 rounded-lg hover:bg-primary-light transition-colors"
              title="Import leads"
            >
              <Upload size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 pb-20">
        <Outlet />
      </main>

      {/* Bottom navigation - mobile friendly */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
        <div className="max-w-6xl mx-auto flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-4 text-xs transition-colors ${
                  isActive ? 'text-primary font-semibold' : 'text-gray-500'
                }`
              }
            >
              <Icon size={22} />
              <span className="mt-0.5">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
