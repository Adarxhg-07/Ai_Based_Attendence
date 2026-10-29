import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Building2,
  Calendar, ClipboardList, FileText, LogOut, Menu, X, User, Sparkles, FlaskConical,
} from 'lucide-react';
import clsx from 'clsx';

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
    <div className="min-h-screen flex">
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-maroon-700/8 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-navy-800/10 blur-[120px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-gold-500/5 blur-[100px]" />
      </div>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 transform transition-transform lg:translate-x-0 lg:static lg:inset-auto',
          'bg-[#08080e]/90 backdrop-blur-2xl border-r border-white/[0.06]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between h-16 px-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-maroon-700 to-maroon-900 flex items-center justify-center border border-maroon-600/30">
              <Sparkles size={16} className="text-gold-400" />
            </div>
            <span className="text-lg font-bold gradient-text">Attendance</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/50 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="p-3 space-y-1 mt-2">
          {links.map((link) => {
            const isActive = location.pathname === link.to ||
              (link.to !== '/admin' && link.to !== '/teacher' && location.pathname.startsWith(link.to));
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-r from-maroon-700/25 to-maroon-900/15 text-maroon-400 border border-maroon-600/25'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
                )}
              >
                <link.icon size={18} className={isActive ? 'text-maroon-400' : ''} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-maroon-800 to-maroon-950 flex items-center justify-center border border-maroon-700/30">
              <User size={16} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white/90 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-xs text-white/40 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-maroon-400 hover:bg-maroon-900/20 rounded-xl transition-colors"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="h-16 flex items-center px-4 lg:px-8 shrink-0 border-b border-white/[0.04]">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-4 text-white/60 hover:text-white">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <span className="text-sm text-white/40">{user?.email}</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
