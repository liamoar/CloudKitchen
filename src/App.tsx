import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { LocalDevBusinessList } from './pages/LocalDevBusinessList';
import { CustomerView } from './pages/CustomerView';
import { SuperAdminLogin } from './pages/SuperAdminLogin';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { RestroAdminDashboard } from './pages/RestroAdminDashboard';
import { RestaurantLogin } from './pages/RestaurantLogin';
import { OrderTracking } from './pages/OrderTracking';
import { RiderDelivery } from './pages/RiderDelivery';
import { ProductDetailV2 as ProductDetail } from './pages/ProductDetailV2';
import { getSubdomain, isMainDomain, getMainDomainUrl } from './lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';

const isLocalDevelopment = () => {
  const hostname = window.location.hostname;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('stackblitz') ||
    hostname.includes('webcontainer') ||
    hostname.includes('csb.app') ||
    hostname.includes('replit') ||
    hostname.includes('gitpod') ||
    !hostname.includes('.')
  );
};

const isLocalhost = isLocalDevelopment();

function SubdomainValidator({ children }: { children: React.ReactNode }) {
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subdomain = getSubdomain();

  useEffect(() => {
    const validateSubdomain = async () => {
      if (!subdomain) {
        if (!isLocalhost) {
          window.location.href = getMainDomainUrl('/');
        }
        return;
      }

      const { data: business } = await supabase
        .from('businesses')
        .select('id, is_subdomain_active, status')
        .eq('subdomain', subdomain)
        .maybeSingle();

      if (!business) {
        setError(`Business "${subdomain}" not found`);
        setValidating(false);
        return;
      }

      if (!business.is_subdomain_active || business.status === 'inactive' || business.status === 'cancelled') {
        setError(`Business "${subdomain}" is not active`);
        setValidating(false);
        return;
      }

      setValidating(false);
    };

    validateSubdomain();
  }, [subdomain]);

  if (validating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          {isLocalhost && (
            <a href="/" className="text-blue-600 hover:text-blue-800 underline">
              Go to home
            </a>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

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
  const subdomain = getSubdomain();

  console.log('Hostname:', window.location.hostname);
  console.log('Subdomain:', subdomain);
  console.log('Is Main Domain:', onMainDomain);
  console.log('Is Localhost:', isLocalhost);

  if (onMainDomain && !isLocalhost) {
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

  if (isLocalhost && onMainDomain) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LocalDevBusinessList />} />
          <Route path="/backend-system" element={<SuperAdminLogin />} />
          <Route
            path="/backend-system/dashboard"
            element={
              <SuperAdminProtectedRoute>
                <SuperAdminDashboard />
              </SuperAdminProtectedRoute>
            }
          />

          <Route
            path="/business/:subdomain"
            element={
              <SubdomainValidator>
                <CustomerView />
              </SubdomainValidator>
            }
          />
          <Route
            path="/business/:subdomain/product/:productId"
            element={
              <SubdomainValidator>
                <ProductDetail />
              </SubdomainValidator>
            }
          />
          <Route
            path="/business/:subdomain/login"
            element={
              <SubdomainValidator>
                <RestaurantLogin />
              </SubdomainValidator>
            }
          />
          <Route
            path="/business/:subdomain/admin"
            element={
              <SubdomainValidator>
                <RestaurantAdminProtectedRoute>
                  <RestroAdminDashboard />
                </RestaurantAdminProtectedRoute>
              </SubdomainValidator>
            }
          />
          <Route
            path="/business/:subdomain/track/:token"
            element={
              <SubdomainValidator>
                <OrderTracking />
              </SubdomainValidator>
            }
          />
          <Route
            path="/business/:subdomain/rider/:token"
            element={
              <SubdomainValidator>
                <RiderDelivery />
              </SubdomainValidator>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <SubdomainValidator>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CustomerView />} />
          <Route path="/product/:productId" element={<ProductDetail />} />
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
    </SubdomainValidator>
  );
}

export default App;
