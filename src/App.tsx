import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { CustomerHome } from './pages/CustomerHome.tsx';
import { RestroAdminLogin } from './pages/RestroAdminLogin.tsx';
import { RestroAdminDashboard } from './pages/RestroAdminDashboard.tsx';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || (user.role !== 'RESTRO_OWNER' && user.role !== 'SUPER_ADMIN')) {
    return <Navigate to="/restro-admin" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CustomerHome />} />
        <Route path="/restro-admin" element={<RestroAdminLogin />} />
        <Route
          path="/restro-admin/dashboard"
          element={
            <ProtectedRoute>
              <RestroAdminDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
