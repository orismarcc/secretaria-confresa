import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ConnectionStatus, OnlineIndicator } from '@/components/ConnectionStatus';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Wrench,
  Building2,
  FileText,
  LogOut,
  Menu,
  X,
  UserCog,
  BarChart3,
  CalendarDays,
  Package,
  Receipt,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import logoTransparent from '@/assets/logo-transparent.png';

interface AppLayoutProps {
  children: ReactNode;
}

const adminNavItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/analytics', label: 'Análises', icon: BarChart3 },
  { path: '/calendar', label: 'Calendário', icon: CalendarDays },
  { path: '/deliveries', label: 'Entregas', icon: Package },
  { path: '/dam', label: 'DAMs', icon: Receipt },
  { path: '/services', label: 'Atendimentos', icon: ClipboardList },
  { path: '/producers', label: 'Produtores', icon: Users },
  { path: '/operators', label: 'Operadores', icon: UserCog },
  { path: '/demand-types', label: 'Tipos de Demanda', icon: FileText },
  { path: '/settlements', label: 'Assentamentos', icon: Building2 },
  { path: '/machinery', label: 'Maquinários', icon: Wrench },
];

const operatorNavItems = [
  { path: '/operator', label: 'Meus Atendimentos', icon: ClipboardList },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { profile, role, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = hasRole('admin') ? adminNavItems : operatorNavItems;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const NavButton = ({ item }: { item: { path: string; label: string; icon: React.ElementType } }) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <button
        onClick={() => handleNavClick(item.path)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'hover:bg-sidebar-accent text-sidebar-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
        <span className="font-medium">{item.label}</span>
      </button>
    );
  };

  // Clickable user profile block → navigates to /settings
  const UserProfileButton = ({ compact = false }: { compact?: boolean }) => {
    const isActive = location.pathname === '/settings';
    return (
      <button
        onClick={() => handleNavClick('/settings')}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
          isActive
            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
            : 'hover:bg-sidebar-accent text-sidebar-foreground'
        )}
        title="Configurações"
      >
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-sm font-bold text-primary">
          {(profile?.name || 'U').charAt(0).toUpperCase()}
        </div>
        {!compact && (
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{profile?.name || 'Usuário'}</p>
            <p className="text-xs opacity-60 truncate">{profile?.email}</p>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ConnectionStatus />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground shadow-lg safe-area-top">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-primary-foreground hover:bg-primary/90"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>

            <div className="flex items-center gap-3">
              <img src={logoTransparent} alt="Logo" className="h-10 w-auto" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold leading-none">Secretaria de Agricultura</h1>
                <p className="text-xs opacity-80">Sistema de Gestão de Demandas</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <OnlineIndicator className="hidden sm:flex" />

            {/* Header name — clickable to settings on mobile */}
            <button
              onClick={() => navigate('/settings')}
              className="hidden md:flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
            >
              <span className="opacity-80">{profile?.name || 'Usuário'}</span>
              <span className="px-2 py-0.5 rounded-full bg-primary-foreground/20 text-xs uppercase">
                {role === 'admin' ? 'Admin' : 'Operador'}
              </span>
            </button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-primary-foreground hover:bg-primary/90"
            >
              <LogOut className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground min-h-[calc(100vh-4rem)] sticky top-16">
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => <NavButton key={item.path} item={item} />)}
          </nav>
          {/* User profile at bottom — click to go to settings */}
          <div className="p-3 border-t border-sidebar-border">
            <UserProfileButton />
          </div>
        </aside>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="absolute left-0 top-0 bottom-0 w-72 bg-sidebar text-sidebar-foreground animate-slide-in flex flex-col">
              <div className="p-4 border-b border-sidebar-border">
                <div className="flex items-center gap-3">
                  <img src={logoTransparent} alt="Logo" className="h-10 w-auto" />
                  <span className="font-bold">Menu</span>
                </div>
              </div>

              <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                {navItems.map((item) => <NavButton key={item.path} item={item} />)}
              </nav>

              {/* User profile at bottom — click to go to settings */}
              <div className="p-3 border-t border-sidebar-border flex items-center gap-2">
                <div className="flex-1">
                  <UserProfileButton />
                </div>
                <OnlineIndicator />
              </div>
            </aside>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-6 safe-area-bottom overflow-x-hidden">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
