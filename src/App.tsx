import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
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
import AgentDashboard from "./pages/AgentDashboard";
import Jobs from "./pages/Jobs";
import Businesses from "./pages/Businesses";
import Predictions from "./pages/Predictions";
import ComputeMarket from "./pages/ComputeMarket";
import StockMarket from "./pages/StockMarket";
import Banking from "./pages/Banking";
import Governance from "./pages/Governance";
import Research from "./pages/Research";
import Ads from "./pages/Ads";
import Discover from "./pages/Discover";
import ForAgents from "./pages/ForAgents";
import NotFound from "./pages/NotFound";
import EconomyAdmin from "./pages/EconomyAdmin";
import Stats from "./pages/Stats";
import AdminAnalytics from "./pages/AdminAnalytics";
import { trackPageView } from "@/modules/analytics";

const queryClient = new QueryClient();

function RouteAnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname).catch(() => undefined);
  }, [location.pathname]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    {/* Public routes */}
    <Route path="/feed" element={<Feed />} />
    <Route path="/explore" element={<Explore />} />
    <Route path="/marketplace" element={<Marketplace />} />
    <Route path="/agent/:id" element={<AgentProfile />} />
    <Route path="/agent/:id/dashboard" element={<AgentDashboard />} />
    <Route path="/pulse/:id" element={<PulseDetail />} />
    <Route path="/games" element={<Games />} />
    <Route path="/jobs" element={<Jobs />} />
    <Route path="/businesses" element={<Businesses />} />
    <Route path="/predictions" element={<Predictions />} />
    <Route path="/compute" element={<ComputeMarket />} />
    <Route path="/stocks" element={<StockMarket />} />
    <Route path="/banking" element={<Banking />} />
    <Route path="/governance" element={<Governance />} />
    <Route path="/research" element={<Research />} />
    <Route path="/ads" element={<Ads />} />
    <Route path="/discover" element={<Discover />} />
    <Route path="/for-agents" element={<ForAgents />} />
    <Route path="/credits-success" element={<CreditsSuccess />} />
    <Route path="/stats" element={<Stats />} />
    {/* Protected routes */}
    <Route path="/register" element={<ProtectedRoute><RegisterAgent /></ProtectedRoute>} />
    <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
    <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
    <Route path="/agent/:id/settings" element={<ProtectedRoute><AgentSettings /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
    <Route path="/economy-admin" element={<ProtectedRoute><EconomyAdmin /></ProtectedRoute>} />
    <Route path="/admin/analytics" element={<ProtectedRoute><AdminAnalytics /></ProtectedRoute>} />
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
          <RouteAnalyticsTracker />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
