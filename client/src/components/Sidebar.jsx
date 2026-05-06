import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, ArrowRightLeft, ShoppingCart, Receipt, Factory, Database, LogOut, Copy, CheckCircle, Users } from 'lucide-react';
import { auth } from '../api';

const navItems = [
  { section: 'Overview', items: [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  ]},
  { section: 'Inventory', items: [
    { path: '/inventory', icon: Package, label: 'Stock Master' },
    { path: '/transactions', icon: ArrowRightLeft, label: 'Transactions' },
  ]},
  { section: 'Operations', items: [
    { path: '/purchase', icon: ShoppingCart, label: 'Purchase Entry' },
    { path: '/sales', icon: Receipt, label: 'Sales / Billing' },
    { path: '/production', icon: Factory, label: 'Production' },
  ]},
];

export default function Sidebar({ user }) {
  const [copied, setCopied] = useState(false);

  const copyInviteCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon"><Database size={20} /></div>
        <div>
          <h1>StockFlow</h1>
          <p>{user?.companyName || 'Inventory Management'}</p>
        </div>
      </div>

      {navItems.map((section) => (
        <div className="sidebar-section" key={section.section}>
          <div className="sidebar-section-title">{section.section}</div>
          <nav className="sidebar-nav">
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <item.icon className="icon" size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}

      {/* Invite Code Section */}
      {user?.inviteCode && (
        <div className="sidebar-invite">
          <div className="sidebar-section-title">Invite Team</div>
          <div className="invite-code-bar" onClick={copyInviteCode} title="Click to copy invite code">
            <Users size={14} />
            <span className="invite-code-value">{user.inviteCode}</span>
            {copied ? <CheckCircle size={14} className="invite-copied" /> : <Copy size={14} />}
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user-info">
          <div className="sidebar-user-avatar">
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="sidebar-user-details">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-role">{user?.role === 'admin' ? 'Admin' : 'Member'}</div>
          </div>
          <button className="btn-logout" onClick={auth.logout} title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
