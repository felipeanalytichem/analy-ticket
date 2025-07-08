import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { TicketCountProvider } from '@/contexts/TicketCountContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useCategoryInitializer } from '@/hooks/useCategoryInitializer';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageLoading } from '@/components/ui/page-loading';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';

// Main app pages
import DashboardPage from '@/pages/DashboardPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import TicketsPage from '@/pages/TicketsPage';
import KnowledgeBasePage from '@/pages/KnowledgeBasePage';
import { KnowledgeArticleView } from '@/components/knowledge/KnowledgeArticleView';
import TodoPage from '@/pages/TodoPage';
import ChangeLog from '@/pages/ChangeLog';

// Admin pages
import UserManagementPage from '@/pages/UserManagementPage';
import CategoryManagementPage from '@/pages/CategoryManagementPage';
import SLAConfigPage from '@/pages/SLAConfigPage';

// Legacy pages
import { Notifications } from '@/pages/Notifications';
import { ReopenRequests } from '@/pages/ReopenRequests';
import { DebugPage } from '@/pages/DebugPage';
import UpdateCategoriesPage from '@/pages/UpdateCategoriesPage';
import TicketDetail from '@/pages/TicketDetail';
import AgentDashboard from '@/pages/AgentDashboard';

// Lazy-loaded heavy pages
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const IntegrationsPage = lazy(() => import('@/pages/IntegrationsPage'));
const KnowledgeAdminPage = lazy(() => import('@/pages/KnowledgeAdminPage'));

function App() {
  // Initialize categories automatically
  const { isInitializing, error } = useCategoryInitializer();

  // Log category initialization status
  useEffect(() => {
    if (isInitializing) {
      // Debug logging removed for production
    }
    if (error) {
      // Error logging removed for production
    }
  }, [isInitializing, error]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <TicketCountProvider>
          <Router>
            <Routes>
              {/* Auth routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Profile and settings routes */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/changelog"
                element={
                  <ProtectedRoute>
                    <ChangeLog />
                  </ProtectedRoute>
                }
              />
              
              {/* Legacy routes */}
              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/debug"
                element={
                  <ProtectedRoute>
                    <DebugPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/update-categories"
                element={
                  <ProtectedRoute>
                    <UpdateCategoriesPage />
                  </ProtectedRoute>
                }
              />

              {/* Knowledge article view (outside layout) */}
              <Route
                path="/knowledge/:id"
                element={
                  <ProtectedRoute>
                    <KnowledgeArticleView />
                  </ProtectedRoute>
                }
              />
              
              {/* Main app routes with layout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DashboardPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DashboardPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agent-dashboard"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <AgentDashboard />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Ticket routes */}
              <Route
                path="/tickets"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TicketsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tickets/:status"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TicketsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Single Ticket detail route */}
              <Route
                path="/ticket/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TicketDetail />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Reopen requests */}
              <Route
                path="/reopen-requests"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ReopenRequests />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Knowledge base */}
              <Route
                path="/knowledge"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <KnowledgeBasePage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Todo */}
              <Route
                path="/todo"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <TodoPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Reports */}
              <Route
                path="/reports"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Suspense fallback={<PageLoading />}> 
                        <ReportsPage />
                      </Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Integrations */}
              <Route
                path="/integrations"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Suspense fallback={<PageLoading />}> 
                        <IntegrationsPage />
                      </Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              
              {/* Admin routes */}
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <UserManagementPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/categories"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CategoryManagementPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/sla"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SLAConfigPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/knowledge"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Suspense fallback={<PageLoading />}> 
                        <KnowledgeAdminPage />
                      </Suspense>
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster />
          </Router>
        </TicketCountProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
// Cache bust
