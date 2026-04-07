import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Projects from "./pages/Projects";
import Teams from "./pages/Teams";
import Tasks from "./pages/Tasks";
import Messages from "./pages/Messages";
import Calls from "./pages/Calls";
import UsersManagement from "./pages/UsersManagement";
import AdminTaskProvider from "./pages/AdminTaskProvider";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/teams" element={<ProtectedRoute requiredPermission="teams:manage"><Teams /></ProtectedRoute>} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/messages" element={<ProtectedRoute requiredPermission="chat:view"><Messages /></ProtectedRoute>} />
              <Route path="/calls" element={<ProtectedRoute requiredPermission="calls:join"><Calls /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requiredPermission="users:manage"><UsersManagement /></ProtectedRoute>} />
              <Route path="/admin-provider" element={<ProtectedRoute requiredPermission="projects:create"><AdminTaskProvider /></ProtectedRoute>} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
