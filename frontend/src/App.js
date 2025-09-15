import React, { Suspense, lazy, useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';

// Lazy-load pages to reduce initial bundle size
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Parts = lazy(() => import('./pages/Parts'));
const Formulas = lazy(() => import('./pages/Formulas'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Upload = lazy(() => import('./pages/Upload'));
const SamsungModels = lazy(() => import('./pages/SamsungModels'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));

// React Query with sensible defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 min
      cacheTime: 5 * 60 * 1000, // 5 min
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-600 dark:text-gray-300">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3" />
        Loading...
      </div>
    );
  }
  return isAuthenticated ? children : <Navigate to="/login" state={{ from: location }} replace />;
}

// Simple dark mode hook (persist in localStorage)
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('st_dark');
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  useEffect(() => {
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
    localStorage.setItem('st_dark', dark ? 'true' : 'false');
  }, [dark]);
  return { dark, setDark };
}

function AppContent() {
  const { isAuthenticated, isAdmin } = useAuth();
  const { dark, setDark } = useDarkMode();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-pink-50 to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 transition-colors">{/* background */}
      {isAuthenticated && <Navbar dark={dark} setDark={setDark} />}
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24 text-gray-600 dark:text-gray-300">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3" />
            Loading...
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {/* For admins show Dashboard at root, for users show Calculator as the main page */}
                {isAdmin ? <Dashboard /> : <Calculator />}
              </ProtectedRoute>
            }
          />
          <Route path="/parts" element={<ProtectedRoute><Parts /></ProtectedRoute>} />
          <Route path="/formulas" element={<ProtectedRoute><Formulas /></ProtectedRoute>} />
          <Route path="/calculator" element={<ProtectedRoute><Calculator /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/samsung-models" element={<ProtectedRoute><SamsungModels /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
        </Routes>
      </Suspense>
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
