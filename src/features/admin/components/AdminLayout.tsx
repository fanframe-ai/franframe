import { ReactNode, useState } from "react";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { Menu, Hexagon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="admin-shell min-h-screen bg-background lg:flex">
      <div className="hidden lg:block lg:shrink-0"><AdminSidebar /></div>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <div className="flex items-center gap-2 font-bold"><Hexagon className="h-5 w-5" />FanFrame</div>
        <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogTrigger asChild><Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Abrir navegação" title="Abrir navegação"><Menu className="h-5 w-5" /></Button></DialogTrigger>
          <DialogContent aria-describedby={undefined} className="left-0 top-0 flex h-dvh w-[min(320px,90vw)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:rounded-none">
            <DialogTitle className="sr-only">Navegação administrativa</DialogTitle>
            <AdminSidebar mobile onNavigate={() => setMenuOpen(false)} />
          </DialogContent>
        </Dialog>
      </header>
      <main id="admin-content" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:p-8">
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
