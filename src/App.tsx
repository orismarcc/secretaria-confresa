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
import AnalyticsPage from "./pages/AnalyticsPage";
import MapPage from "./pages/MapPage";
import CalendarPage from "./pages/CalendarPage";
import OperatorPage from "./pages/OperatorPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (adminOnly && !hasRole('admin')) return <Navigate to="/operator" replace />;
  
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, hasRole } = useAuth();
  
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={hasRole('admin') ? '/dashboard' : '/operator'} replace /> : <LoginPage />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? (hasRole('admin') ? '/dashboard' : '/operator') : '/login'} replace />} />
      
      {/* Admin Routes */}
      <Route path="/dashboard" element={<ProtectedRoute adminOnly><DashboardPage /></ProtectedRoute>} />
      <Route path="/services" element={<ProtectedRoute adminOnly><ServicesPage /></ProtectedRoute>} />
      <Route path="/producers" element={<ProtectedRoute adminOnly><ProducersPage /></ProtectedRoute>} />
      <Route path="/operators" element={<ProtectedRoute adminOnly><OperatorsPage /></ProtectedRoute>} />
      <Route path="/demand-types" element={<ProtectedRoute adminOnly><DemandTypesPage /></ProtectedRoute>} />
      <Route path="/settlements" element={<ProtectedRoute adminOnly><SettlementsPage /></ProtectedRoute>} />
      <Route path="/machinery" element={<ProtectedRoute adminOnly><MachineryPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute adminOnly><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/map" element={<ProtectedRoute adminOnly><MapPage /></ProtectedRoute>} />
      <Route path="/calendar" element={<ProtectedRoute adminOnly><CalendarPage /></ProtectedRoute>} />
      
      {/* Operator Route */}
      <Route path="/operator" element={<ProtectedRoute><OperatorPage /></ProtectedRoute>} />
      
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
