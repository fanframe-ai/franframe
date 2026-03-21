import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import TeamProvadorPage from "./pages/TeamProvador";
import NotFound from "./pages/NotFound";
import Teste from "./pages/Teste";
import TermosDeUso from "./pages/TermosDeUso";
import UploadAssets from "./pages/UploadAssets";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminGenerations from "./pages/admin/Generations";
import AdminStats from "./pages/admin/Stats";
import AdminAlerts from "./pages/admin/Alerts";
import AdminSystemStatus from "./pages/admin/SystemStatus";
import AdminSettings from "./pages/admin/Settings";
import AdminTeams from "./pages/admin/Teams";
import AdminTeamEdit from "./pages/admin/TeamEdit";
import { ProtectedAdminRoute } from "./components/admin/ProtectedAdminRoute";
import { TeamProvider } from "./contexts/TeamContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TeamProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Root redirects to admin */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          
          {/* Team provador route */}
          <Route path="/:slug" element={<TeamProvadorPage />} />
          
          <Route path="/teste" element={<Teste />} />
          <Route path="/termos-de-uso" element={<TermosDeUso />} />
          <Route path="/upload-assets" element={<UploadAssets />} />
          
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
      </BrowserRouter>
    </TooltipProvider>
    </TeamProvider>
  </QueryClientProvider>
);

export default App;
