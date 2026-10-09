import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ImageIcon, 
  BarChart3, 
  LogOut,
  Activity,
  Settings,
  Users,
  Hexagon
} from "lucide-react";
import { useAdminAuth } from "@/features/auth/hooks/useAdminAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/teams", icon: Users, label: "Provadores" },
  { href: "/admin/generations", icon: ImageIcon, label: "Gerações" },
  { href: "/admin/stats", icon: BarChart3, label: "Estatísticas" },
  { href: "/admin/status", icon: Activity, label: "Status" },
  { href: "/admin/settings", icon: Settings, label: "Configurações" },
];

export function AdminSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { logout, user } = useAdminAuth();

  return (
    <aside className={cn('flex flex-col bg-sidebar border-r border-sidebar-border', mobile ? 'h-full w-full' : 'sticky top-0 h-dvh w-60')}>
      {/* Header */}
      <div className="px-5 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Hexagon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-bold text-lg">FanFrame</p>
            <p className="text-xs text-muted-foreground">Administração</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 px-3 py-3 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User & Logout */}
      <div className="p-4 border-t border-border">
        <div className="mb-3 px-4">
          <p className="text-xs text-muted-foreground">Logado como</p>
          <p className="text-sm font-medium truncate">{user?.email}</p>
        </div>
        <button
          onClick={() => { onNavigate?.(); void logout(); }}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
