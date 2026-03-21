import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  ImageIcon, 
  BarChart3, 
  Bell, 
  LogOut,
  Shield,
  Activity,
  Settings,
  Eye,
  Images,
  Users
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/generations", icon: ImageIcon, label: "Gerações" },
  { href: "/admin/stats", icon: BarChart3, label: "Estatísticas" },
  { href: "/admin/status", icon: Activity, label: "Status" },
  { href: "/admin/alerts", icon: Bell, label: "Alertas" },
  { href: "/admin/settings", icon: Settings, label: "Configurações" },
  
  { href: "/admin/preview", icon: Eye, label: "Preview" },
  { href: "/admin/assets", icon: Images, label: "Assets" },
];

export function AdminSidebar() {
  const location = useLocation();
  const { logout, user } = useAdminAuth();

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">Provador Tricolor</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <item.icon className="h-5 w-5" />
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
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sair
        </button>
      </div>
    </aside>
  );
}
