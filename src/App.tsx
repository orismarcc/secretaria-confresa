// App entry point
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ServicesPage from "./pages/ServicesPage";
import ProducersPage from "./pages/ProducersPage";
import OperatorsPage from "./pages/OperatorsPage";
import DemandTypesPage from "./pages/DemandTypesPage";
import SettlementsPage from "./pages/SettlementsPage";
import MachineryPage from "./pages/MachineryPage";
import TransitoPage from "./pages/TransitoPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalendarPage from "./pages/CalendarPage";
import DeliveriesPage from "./pages/DeliveriesPage";
import ImportServicesPage from "./pages/ImportServicesPage";
import SettingsPage from "./pages/SettingsPage";
import OperatorPage from "./pages/OperatorPage";
import FieldServicesPage from "./pages/FieldServicesPage";
import DAMPage from "./pages/DAMPage";
import PatrimonyPage from "./pages/PatrimonyPage";
import SEFAZPage from "./pages/SEFAZPage";
import ImportSEFAZPage from "./pages/ImportSEFAZPage";
import AuditPage from "./pages/AuditPage";
import MaintenancePage from "./pages/MaintenancePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Loading = () => <div className="min-h-screen flex items-center justify-center">Carregando...</div>;

// Página inicial por perfil: equipe interna → Dashboard; Assistente de Campo →
// Atendimentos; operador → Meus Atendimentos.
function homeFor(isAdmin: boolean, isAssistente: boolean) {
  if (!isAdmin) return '/operator';
  return isAssistente ? '/field-services' : '/dashboard';
}

// Só decide o destino DEPOIS de carregar o papel do usuário — antes, com o papel
// ainda nulo, a equipe interna caía em /operator.
function HomeRedirect() {
  const { isAuthenticated, isLoading, hasRole, isAssistente } = useAuth();
  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={homeFor(hasRole('admin'), isAssistente)} replace />;
}

function ProtectedRoute({ children, adminOnly = false, fullAdminOnly = false, assistenteOk = false, operatorOnly = false }: { children: React.ReactNode; adminOnly?: boolean; fullAdminOnly?: boolean; assistenteOk?: boolean; operatorOnly?: boolean }) {
  const { isAuthenticated, isLoading, hasRole, isFullAdmin, isAssistente } = useAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Área do operador: equipe interna é levada à sua página inicial.
  if (operatorOnly && hasRole('admin')) return <Navigate to={homeFor(true, isAssistente)} replace />;
  if ((adminOnly || fullAdminOnly) && !hasRole('admin')) return <Navigate to="/operator" replace />;
  // Assistente de Campo: só acessa as áreas liberadas (Maquinários e Atendimentos por operador).
  if (isAssistente && !assistenteOk) return <Navigate to="/field-services" replace />;
  // DAM e afins: só admin pleno (Secretário/Diretor/Supervisor), não Coordenador.
  if (fullAdminOnly && !isFullAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Não autenticado: LoginPage permanece montada mesmo durante a tentativa de login. */}
      <Route path="/login" element={isAuthenticated ? <HomeRedirect /> : <LoginPage />} />
      <Route path="/" element={<HomeRedirect />} />

      {/* Admin Routes */}
      <Route path="/dashboard" element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute adminOnly><ServicesPage /></ProtectedRoute>} />
      <Route path="/producers" element={<ProtectedRoute adminOnly><ProducersPage /></ProtectedRoute>} />
      <Route path="/operators" element={<ProtectedRoute adminOnly><OperatorsPage /></ProtectedRoute>} />
      <Route path="/demand-types" element={<ProtectedRoute adminOnly><DemandTypesPage /></ProtectedRoute>} />
      <Route path="/settlements" element={<ProtectedRoute adminOnly><SettlementsPage /></ProtectedRoute>} />
      <Route path="/machinery" element={<ProtectedRoute adminOnly assistenteOk><MachineryPage /></ProtectedRoute>} />
      <Route path="/transito" element={<ProtectedRoute adminOnly><TransitoPage /></ProtectedRoute>} />
      <Route path="/field-services" element={<ProtectedRoute adminOnly assistenteOk><FieldServicesPage /></ProtectedRoute>} />
      <Route path="/maintenance" element={<ProtectedRoute adminOnly><MaintenancePage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute adminOnly><CalendarPage /></ProtectedRoute>} />
      <Route path="/deliveries" element={<ProtectedRoute adminOnly><DeliveriesPage /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute adminOnly><ImportServicesPage /></ProtectedRoute>} />
      <Route path="/dam" element={<ProtectedRoute fullAdminOnly><DAMPage /></ProtectedRoute>} />
      <Route path="/patrimony" element={<ProtectedRoute adminOnly><PatrimonyPage /></ProtectedRoute>} />
      <Route path="/sefaz" element={<ProtectedRoute adminOnly><SEFAZPage /></ProtectedRoute>} />
      <Route path="/import-sefaz" element={<ProtectedRoute adminOnly><ImportSEFAZPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute adminOnly><AuditPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute assistenteOk><SettingsPage /></ProtectedRoute>} />

      {/* Operator Route */}
      <Route path="/operator" element={<ProtectedRoute operatorOnly><OperatorPage /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
