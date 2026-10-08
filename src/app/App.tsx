import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TeamProvadorPage from "@/app/TeamPage";
import NotFound from "@/pages/NotFound";
import TermosDeUso from "@/pages/TermosDeUso";
const UploadAssets = lazy(() => import("@/features/admin/pages/UploadAssets"));
const AdminLogin = lazy(() => import("@/features/admin/pages/Login"));
const AdminDashboard = lazy(() => import("@/features/admin/pages/Dashboard"));
const AdminGenerations = lazy(() => import("@/features/admin/pages/Generations"));
const AdminStats = lazy(() => import("@/features/admin/pages/Stats"));
const AdminAlerts = lazy(() => import("@/features/admin/pages/Alerts"));
const AdminSystemStatus = lazy(() => import("@/features/admin/pages/SystemStatus"));
const AdminSettings = lazy(() => import("@/features/admin/pages/Settings"));
const AdminTeams = lazy(() => import("@/features/admin/pages/Teams"));
const AdminTeamEdit = lazy(() => import("@/features/admin/pages/TeamEdit"));
import { ProtectedAdminRoute } from "@/features/admin/components/ProtectedAdminRoute";
import { TeamProvider } from "@/features/teams/TeamContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TeamProvider>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Suspense fallback={<div role="status" className="p-8 text-center">Carregando…</div>}>
        <Routes>
          {/* Root redirects to admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          
          {/* Team provador route */}
          <Route path="/:slug" element={<TeamProvadorPage />} />
          
          <Route path="/termos-de-uso" element={<TermosDeUso />} />
          <Route path="/admin/upload-assets" element={<ProtectedAdminRoute><UploadAssets /></ProtectedAdminRoute>} />
          
          {/* Admin Routes */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
          <Route path="/admin/generations" element={<ProtectedAdminRoute><AdminGenerations /></ProtectedAdminRoute>} />
          <Route path="/admin/stats" element={<ProtectedAdminRoute><AdminStats /></ProtectedAdminRoute>} />
          <Route path="/admin/status" element={<ProtectedAdminRoute><AdminSystemStatus /></ProtectedAdminRoute>} />
          <Route path="/admin/alerts" element={<ProtectedAdminRoute><AdminAlerts /></ProtectedAdminRoute>} />
          <Route path="/admin/settings" element={<ProtectedAdminRoute><AdminSettings /></ProtectedAdminRoute>} />
          <Route path="/admin/teams" element={<ProtectedAdminRoute><AdminTeams /></ProtectedAdminRoute>} />
          <Route path="/admin/teams/:slug" element={<ProtectedAdminRoute><AdminTeamEdit /></ProtectedAdminRoute>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
    </TeamProvider>
  </QueryClientProvider>
);

export default App;
