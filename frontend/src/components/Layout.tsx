import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Building2,
  Calendar, ClipboardList, FileText, LogOut, Menu, X, User, Scan, FlaskConical,
} from 'lucide-react';

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/students', icon: Users, label: 'Students' },
  { to: '/admin/teachers', icon: GraduationCap, label: 'Teachers' },
  { to: '/admin/courses', icon: BookOpen, label: 'Courses' },
  { to: '/admin/classrooms', icon: Building2, label: 'Classrooms' },
  { to: '/admin/timetables', icon: Calendar, label: 'Timetables' },
  { to: '/admin/logs', icon: FileText, label: 'Audit Logs' },
];

const teacherLinks = [
  { to: '/teacher', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/teacher/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/teacher/attendance', icon: ClipboardList, label: 'Attendance' },
];

const testingLinks = [
  { to: '/testing', icon: FlaskConical, label: 'Test Recognition' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = user?.role === 'ADMIN' ? adminLinks : user?.role === 'TESTER' ? testingLinks : teacherLinks;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: '#FAFAFA' }}>

      {/* ===== SIDEBAR — BRUTAL ===== */}
      <aside className={`layout-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        {/* Brand */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 1.25rem',
            borderBottom: '3px solid #111111',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: '#CC0000',
                border: '2px solid #111',
                borderRadius: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Scan size={16} color="#FFFFFF" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
              SMARTATTEND
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="mobile-only lg:hidden"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#36454F' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav links */}
        <nav style={{ padding: '0.75rem', flex: 1, overflowY: 'auto' }}>
          {links.map((link) => {
            const isActive = location.pathname === link.to ||
              (link.to !== '/admin' && link.to !== '/teacher' && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  marginBottom: '0.25rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: 'none',
                  transition: 'all 0.15s ease-out',
                  ...(isActive
                    ? {
                        background: '#FFD700',
                        color: '#111111',
                        border: '2px solid #111111',
                        boxShadow: '2px 2px 0 #111111',
                      }
                    : {
                        background: 'transparent',
                        color: '#36454F',
                        border: '2px solid transparent',
                      }),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = '#F0F0F0';
                    e.currentTarget.style.color = '#111111';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#36454F';
                  }
                }}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User panel */}
        <div style={{ padding: '1rem', borderTop: '3px solid #111111', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0 0.25rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                background: '#000080',
                border: '2px solid #111',
                borderRadius: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <User size={16} color="#FFD700" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.firstName} {user?.lastName}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#36454F', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
                {user?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.5rem 0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#CC0000',
              background: 'none',
              border: '2px solid transparent',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#CC0000';
              e.currentTarget.style.color = '#FFFFFF';
              e.currentTarget.style.border = '2px solid #111';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#CC0000';
              e.currentTarget.style.border = '2px solid transparent';
            }}
          >
            <LogOut size={16} /> SIGN OUT
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.5)' }}
          className="mobile-only lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== MAIN CONTENT ===== */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* Top bar */}
        <header
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            borderBottom: '3px solid #111111',
            background: '#FFFFFF',
          }}
          className="lg:px-8"
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="mobile-only lg:hidden"
            style={{ marginRight: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: '#111' }}
          >
            <Menu size={20} />
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: '0.75rem', color: '#36454F', fontFamily: "'JetBrains Mono', monospace" }}>
            {user?.email}
          </span>
        </header>

        <main style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }} className="lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
