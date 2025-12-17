import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { CustomerView } from './pages/CustomerView';
import { LoginPage } from './pages/LoginPage';
import { OwnerDashboard } from './pages/OwnerDashboard';

function App() {
  const { user } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (showLogin && !user) {
    return (
      <LoginPage
        onBack={() => setShowLogin(false)}
        onSuccess={() => setShowLogin(false)}
      />
    );
  }

  if (user && (user.role === 'RESTRO_OWNER' || user.role === 'SUPER_ADMIN')) {
    return <OwnerDashboard />;
  }

  return (
    <>
      <CustomerView />
      <button
        onClick={() => setShowLogin(true)}
        className="fixed bottom-6 right-6 bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg font-medium transition-colors"
      >
        Owner Login
      </button>
    </>
  );
}

export default App;
