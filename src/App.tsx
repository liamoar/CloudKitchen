import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { CustomerHome } from './pages/CustomerHome';
import { SuperAdminLogin } from './pages/SuperAdminLogin';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { RestroAdminDashboard } from './pages/RestroAdminDashboard';
import { RestaurantLogin } from './pages/RestaurantLogin';
import { OrderTracking } from './pages/OrderTracking';
import { RiderDelivery } from './pages/RiderDelivery';
import { getSubdomain, isMainDomain } from './lib/utils';

function SuperAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/backend-system" replace />;
  }

  if (user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RestaurantAdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'SUPER_ADMIN') {
    return <Navigate to="/backend-system/dashboard" replace />;
  }

  if (user.role !== 'RESTRO_OWNER') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  const onMainDomain = isMainDomain();

  if (onMainDomain) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/backend-system" element={<SuperAdminLogin />} />
          <Route
            path="/backend-system/dashboard"
            element={
              <SuperAdminProtectedRoute>
                <SuperAdminDashboard />
              </SuperAdminProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerHome />} />
        <Route path="/login" element={<RestaurantLogin />} />
        <Route
          path="/admin"
          element={
            <RestaurantAdminProtectedRoute>
              <RestroAdminDashboard />
            </RestaurantAdminProtectedRoute>
          }
        />
        <Route path="/track/:token" element={<OrderTracking />} />
        <Route path="/rider/:token" element={<RiderDelivery />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
