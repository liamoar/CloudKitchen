import { useState, useEffect } from 'react';
import { Calendar, DollarSign, Upload, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Restaurant {
  id: string;
  name: string;
  currency: string;
  country: string;
  status: string;
  trial_end_date: string | null;
  subscription_end_date: string | null;
  is_payment_overdue: boolean;
}

interface SubscriptionConfig {
  monthly_price: number;
  currency: string;
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [config, setConfig] = useState<SubscriptionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (restaurantData) {
        setRestaurant(restaurantData);

        const { data: configData } = await supabase
          .from('subscription_configs')
          .select('monthly_price, currency')
          .eq('country', restaurantData.country)
          .maybeSingle();

        setConfig(configData);
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
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

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!receiptImage || !restaurant || !config) {
      setMessage('Please enter receipt image URL');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('payment_receipts')
        .insert({
          restaurant_id: restaurant.id,
          amount: config.monthly_price,
          currency: config.currency,
          receipt_image_url: receiptImage,
          status: 'PENDING',
        });

      if (error) throw error;

      setMessage('Payment receipt submitted successfully. Awaiting admin approval.');
      setReceiptImage('');
    } catch (error) {
      setMessage('Failed to submit receipt. Please try again.');
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-600">Loading subscription details...</div>
      </div>
    );
  }

  if (!restaurant || !config) {
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
        <div className="flex items-center gap-3 mb-4">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Subscription Status</h3>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1 ${getStatusColor()}`}>
              {restaurant.status}
            </span>
          </div>
        </div>

        <div className="space-y-3">
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

          <div className="flex items-center gap-2 text-gray-700">
            <DollarSign size={18} />
            <span>Monthly: {config.monthly_price} {config.currency}</span>
          </div>

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
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Renew Subscription</h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-900 font-medium mb-2">Bank Transfer Details:</p>
          <p className="text-sm text-blue-800">Account Name: RestaurantOS Platform</p>
          <p className="text-sm text-blue-800">Account Number: 1234567890</p>
          <p className="text-sm text-blue-800">Bank: Example Bank</p>
          <p className="text-sm text-blue-800">Amount: {config.monthly_price} {config.currency}</p>
        </div>

        {message && (
          <div className={`p-3 rounded-lg mb-4 text-sm ${
            message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmitReceipt} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Receipt Image URL
            </label>
            <input
              type="url"
              required
              value={receiptImage}
              onChange={(e) => setReceiptImage(e.target.value)}
              placeholder="https://example.com/receipt.jpg"
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Upload your image to an image hosting service and paste the URL here
            </p>
          </div>

          <button
            type="submit"
            disabled={uploading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-400"
          >
            <Upload size={18} />
            {uploading ? 'Submitting...' : 'Submit Payment Receipt'}
          </button>
        </form>
      </div>
    </div>
  );
}
