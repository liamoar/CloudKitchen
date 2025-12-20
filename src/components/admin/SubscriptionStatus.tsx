import { useState, useEffect } from 'react';
import { Calendar, DollarSign, CheckCircle, Clock, AlertTriangle, CreditCard, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PaymentSubmission from './PaymentSubmission';
import PaymentHistory from './PaymentHistory';

interface Restaurant {
  id: string;
  name: string;
  currency: string;
  country: string;
  status: string;
  trial_end_date: string | null;
  subscription_end_date: string | null;
  is_payment_overdue: boolean;
  tier: SubscriptionTier | null;
}

interface SubscriptionTier {
  id: string;
  name: string;
  monthly_price: number;
  product_limit: number;
  order_limit_per_month: number;
  features: any;
}

interface SubscriptionConfig {
  monthly_price: number;
  currency: string;
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<'upgrade' | 'renewal'>('renewal');

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select(`
          *,
          tier:tier_id (
            id,
            name,
            monthly_price,
            product_limit,
            order_limit_per_month,
            features
          )
        `)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (restaurantData) {
        setRestaurant(restaurantData);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    loadData();
  };

  const getDaysRemaining = () => {
    if (!restaurant) return null;

    const endDate = restaurant.status === 'TRIAL'
      ? restaurant.trial_end_date
      : restaurant.subscription_end_date;

    if (!endDate) return null;

    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-600">Loading subscription details...</div>
      </div>
    );
  }

  if (!restaurant) {
    return null;
  }

  const daysRemaining = getDaysRemaining();
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 5;
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  const getStatusColor = () => {
    if (restaurant.is_payment_overdue || isExpired) return 'bg-red-100 text-red-800';
    if (isExpiringSoon) return 'bg-yellow-100 text-yellow-800';
    if (restaurant.status === 'TRIAL') return 'bg-blue-100 text-blue-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusIcon = () => {
    if (restaurant.is_payment_overdue || isExpired) return <AlertTriangle className="text-red-600" size={24} />;
    if (isExpiringSoon) return <Clock className="text-yellow-600" size={24} />;
    return <CheckCircle className="text-green-600" size={24} />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Subscription Status</h3>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${getStatusColor()}`}>
                {restaurant.status}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {restaurant.tier && (
            <div className="flex items-center gap-2 text-gray-700">
              <TrendingUp size={18} />
              <span>Current Plan: <strong>{restaurant.tier.name}</strong></span>
            </div>
          )}

          {restaurant.status === 'TRIAL' && daysRemaining !== null && (
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar size={18} />
              <span>Trial ends in {daysRemaining > 0 ? `${daysRemaining} days` : 'expired'}</span>
            </div>
          )}

          {restaurant.status === 'ACTIVE' && daysRemaining !== null && (
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar size={18} />
              <span>Subscription {daysRemaining > 0 ? `renews in ${daysRemaining} days` : 'expired'}</span>
            </div>
          )}

          {restaurant.tier && (
            <div className="flex items-center gap-2 text-gray-700">
              <DollarSign size={18} />
              <span>Monthly: {restaurant.tier.monthly_price} {restaurant.currency}</span>
            </div>
          )}

          {restaurant.is_payment_overdue && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
              <p className="text-red-800 font-medium">Payment Overdue</p>
              <p className="text-sm text-red-600 mt-1">
                Your subscription has expired. Order processing is disabled. Please submit payment to continue.
              </p>
            </div>
          )}

          {isExpiringSoon && !isExpired && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-yellow-800 font-medium">Subscription Expiring Soon</p>
              <p className="text-sm text-yellow-700 mt-1">
                Please submit payment to renew your subscription.
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={() => {
              setPaymentType('renewal');
              setShowPaymentModal(true);
            }}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <CreditCard size={18} />
            Pay Now (Renewal)
          </button>
          {restaurant.status === 'TRIAL' && (
            <button
              onClick={() => {
                setPaymentType('upgrade');
                setShowPaymentModal(true);
              }}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
            >
              <TrendingUp size={18} />
              Upgrade Plan
            </button>
          )}
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <PaymentHistory restaurantId={restaurant.id} />
      </div>

      {/* Payment Submission Modal */}
      {showPaymentModal && (
        <PaymentSubmission
          restaurantId={restaurant.id}
          currentTier={restaurant.tier || undefined}
          country={restaurant.country}
          currency={restaurant.currency}
          transactionType={paymentType}
          onSuccess={handlePaymentSuccess}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
}
