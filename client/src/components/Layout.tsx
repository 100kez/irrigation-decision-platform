import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  Sprout,
  Droplets,
  History,
  User,
  Leaf,
  Menu,
} from 'lucide-react';
import AiDiagnosticChat from './AiDiagnosticChat';
import { AiDiagnosticProvider } from '@/contexts/AiDiagnosticContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const navItems = [
  { path: '/', label: '首页概览', icon: Home, end: true },
  { path: '/farms', label: '农田管理', icon: Sprout },
  { path: '/decision', label: '灌溉决策', icon: Droplets },
  { path: '/history', label: '历史记录', icon: History },
];

/** 桌面侧栏与手机抽屉共用的导航内容 */
const SidebarNavContent = ({ onNavigate }: { onNavigate?: () => void }) => (
  <>
    <nav className="flex-1 space-y-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            onClick={onNavigate}
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
    <div className="border-t border-emerald-100 px-4 pt-4 pb-safe">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <User className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-800">当前用户</span>
          <span className="text-xs text-gray-500">管理员</span>
        </div>
      </div>
    </div>
  </>
);

const Layout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <AiDiagnosticProvider>
      <div className="flex h-dvh w-full flex-col overflow-hidden bg-emerald-50/30 md:flex-row">
        {/* 手机顶部标题栏(≥768px 隐藏) */}
        <header className="flex items-center gap-2 border-b border-emerald-100 bg-white px-3 pb-2 pt-safe pl-safe pr-safe md:hidden">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                aria-label="打开导航菜单"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 p-0">
              <SheetHeader className="border-b border-emerald-100 px-4 pb-4 pt-safe">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <Leaf className="h-5 w-5" />
                  </div>
                  <SheetTitle className="text-base font-bold text-emerald-800">
                    智慧灌溉决策平台
                  </SheetTitle>
                </div>
                <SheetDescription className="sr-only">
                  平台导航菜单
                </SheetDescription>
              </SheetHeader>
              <SidebarNavContent onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <h1 className="text-base font-bold text-emerald-800">
            智慧灌溉决策平台
          </h1>
        </header>

        {/* 桌面侧栏(<768px 隐藏) */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-emerald-100 bg-white md:flex">
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

          <SidebarNavContent />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 sm:p-6">
          <Outlet />
        </main>

        {/* Global AI Diagnostic Chat */}
        <AiDiagnosticChat />
      </div>
    </AiDiagnosticProvider>
  );
};

export default Layout;
