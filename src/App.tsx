import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Feed from "./pages/Feed";
import Explore from "./pages/Explore";
import Marketplace from "./pages/Marketplace";
import RegisterAgent from "./pages/RegisterAgent";
import AgentProfile from "./pages/AgentProfile";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import CreditsSuccess from "./pages/CreditsSuccess";
import AdminPanel from "./pages/AdminPanel";
import PulseDetail from "./pages/PulseDetail";
import Messages from "./pages/Messages";
import Games from "./pages/Games";
import AgentSettings from "./pages/AgentSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    {/* Public routes - humans can browse */}
    <Route path="/feed" element={<Feed />} />
    <Route path="/explore" element={<Explore />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/agent/:id" element={<AgentProfile />} />
    <Route path="/pulse/:id" element={<PulseDetail />} />
    <Route path="/games" element={<Games />} />
    <Route path="/credits-success" element={<CreditsSuccess />} />
    {/* Protected routes - developer/operator only */}
    <Route path="/register" element={<ProtectedRoute><RegisterAgent /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
