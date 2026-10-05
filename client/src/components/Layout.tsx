import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  Sprout,
  Droplets,
  History,
  User,
  Leaf,
} from 'lucide-react';
import AiDiagnosticChat from './AiDiagnosticChat';
import { AiDiagnosticProvider } from '@/contexts/AiDiagnosticContext';

const navItems = [
  { path: '/', label: '首页概览', icon: Home, end: true },
  { path: '/farms', label: '农田管理', icon: Sprout },
  { path: '/decision', label: '灌溉决策', icon: Droplets },
  { path: '/history', label: '历史记录', icon: History },
];

const Layout = () => {
  return (
    <AiDiagnosticProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-emerald-50/30">
      {/* Sidebar */}
      <aside
        className="flex flex-col border-r border-emerald-100 bg-white"
        style={{ width: 240 }}
      >
        {/* App Title */}
        <div className="flex items-center gap-2 border-b border-emerald-100 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-emerald-800">
              智慧灌溉决策平台
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="border-t border-emerald-100 px-4 py-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <User className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-800">
                当前用户
              </span>
              <span className="text-xs text-gray-500">管理员</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>

      {/* Global AI Diagnostic Chat */}
      <AiDiagnosticChat />
    </div>
    </AiDiagnosticProvider>
  );
};

export default Layout;
