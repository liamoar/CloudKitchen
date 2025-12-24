import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SubscriptionGuardProps {
  children: React.ReactNode;
  onSuspended: () => void;
}

export function SubscriptionGuard({ children, onSuspended }: SubscriptionGuardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [user?.id]);

  const checkSubscriptionStatus = async () => {
    if (!user?.id) return;

    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, subscription_status, status')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (restaurant) {
        if (restaurant.subscription_status === 'SUSPENDED') {
          setIsSuspended(true);
          onSuspended();
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h2>
          <p className="text-gray-600 mb-6">
            Your account has been suspended due to payment issues. Please update your subscription to restore access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
