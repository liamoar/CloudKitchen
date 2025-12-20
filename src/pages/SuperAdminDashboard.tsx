import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, DollarSign, Clock, CheckCircle, XCircle, Settings } from 'lucide-react';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  currency: string;
  country: string;
  status: string;
  trial_end_date: string | null;
  subscription_end_date: string | null;
  is_payment_overdue: boolean;
  created_at: string;
  owner: {
    name: string;
    email: string;
    phone: string;
  };
}

interface PaymentReceipt {
  id: string;
  amount: number;
  currency: string;
  receipt_image_url: string | null;
  status: string;
  submitted_at: string;
  notes: string | null;
  restaurant: {
    name: string;
    slug: string;
  };
}

interface SubscriptionConfig {
  id: string;
  country: string;
  currency: string;
  monthly_price: number;
  trial_days: number;
  overdue_grace_days: number;
}

export function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState<'restaurants' | 'payments' | 'config'>('restaurants');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [configs, setConfigs] = useState<SubscriptionConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'restaurants') {
        const { data } = await supabase
          .from('restaurants')
          .select(`
            *,
            owner:users!restaurants_owner_id_fkey(name, email, phone)
          `)
          .order('created_at', { ascending: false });
        setRestaurants(data || []);
      } else if (activeTab === 'payments') {
        const { data } = await supabase
          .from('payment_receipts')
          .select(`
            *,
            restaurant:restaurants(name, slug)
          `)
          .order('submitted_at', { ascending: false });
        setPayments(data || []);
      } else if (activeTab === 'config') {
        const { data } = await supabase
          .from('subscription_configs')
          .select('*')
          .order('country');
        setConfigs(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentReview = async (paymentId: string, status: 'APPROVED' | 'REJECTED', notes: string = '') => {
    try {
      await supabase
        .from('payment_receipts')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          notes
        })
        .eq('id', paymentId);

      if (status === 'APPROVED') {
        const payment = payments.find(p => p.id === paymentId);
        if (payment) {
          const restaurant = restaurants.find(r => r.id === payment.restaurant);
          if (restaurant) {
            const newSubEndDate = new Date();
            newSubEndDate.setMonth(newSubEndDate.getMonth() + 1);

            await supabase
              .from('restaurants')
              .update({
                status: 'ACTIVE',
                subscription_end_date: newSubEndDate.toISOString(),
                is_payment_overdue: false,
                overdue_since: null
              })
              .eq('id', restaurant.id);
          }
        }
      }

      loadData();
    } catch (error) {
      console.error('Error reviewing payment:', error);
    }
  };

  const updateConfig = async (configId: string, field: string, value: number) => {
    try {
      await supabase
        .from('subscription_configs')
        .update({ [field]: value })
        .eq('id', configId);
      loadData();
    } catch (error) {
      console.error('Error updating config:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'TRIAL': return 'bg-blue-100 text-blue-800';
      case 'ACTIVE': return 'bg-green-100 text-green-800';
      case 'SUSPENDED': return 'bg-red-100 text-red-800';
      case 'EXPIRED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('restaurants')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'restaurants'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Building2 size={20} />
            Restaurants
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'payments'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <DollarSign size={20} />
            Payments
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'config'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Settings size={20} />
            Configuration
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : (
          <>
            {activeTab === 'restaurants' && (
              <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Restaurant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Days Left
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Currency
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          URL
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {restaurants.map((restaurant) => {
                        const daysLeft = getDaysRemaining(
                          restaurant.status === 'TRIAL'
                            ? restaurant.trial_end_date
                            : restaurant.subscription_end_date
                        );
                        return (
                          <tr key={restaurant.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{restaurant.name}</div>
                              <div className="text-sm text-gray-500">{restaurant.slug}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{restaurant.owner?.name}</div>
                              <div className="text-xs text-gray-500">{restaurant.owner?.phone}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(restaurant.status)}`}>
                                {restaurant.status}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {daysLeft !== null && (
                                <span className={`text-sm ${daysLeft < 3 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                                  {daysLeft > 0 ? `${daysLeft} days` : 'Expired'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-700">
                              {restaurant.currency}
                            </td>
                            <td className="px-6 py-4">
                              <a
                                href={`/${restaurant.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:text-blue-800"
                              >
                                View
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div key={payment.id} className="bg-white rounded-lg shadow p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {payment.restaurant?.name}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {payment.amount} {payment.currency}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Submitted: {new Date(payment.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        payment.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {payment.status}
                      </span>
                    </div>

                    {payment.receipt_image_url && (
                      <div className="mb-4">
                        <img
                          src={payment.receipt_image_url}
                          alt="Receipt"
                          className="max-w-md rounded border"
                        />
                      </div>
                    )}

                    {payment.notes && (
                      <div className="mb-4 p-3 bg-gray-50 rounded">
                        <p className="text-sm text-gray-700">{payment.notes}</p>
                      </div>
                    )}

                    {payment.status === 'PENDING' && (
                      <div className="flex gap-3">
                        <button
                          onClick={() => handlePaymentReview(payment.id, 'APPROVED', 'Payment approved')}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                        >
                          <CheckCircle size={16} />
                          Approve
                        </button>
                        <button
                          onClick={() => handlePaymentReview(payment.id, 'REJECTED', 'Payment rejected')}
                          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {payments.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    No payment receipts yet
                  </div>
                )}
              </div>
            )}

            {activeTab === 'config' && (
              <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Country
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Currency
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Monthly Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Trial Days
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Overdue Grace Days
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {configs.map((config) => (
                        <tr key={config.id}>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {config.country}
                          </td>
                          <td className="px-6 py-4 text-gray-700">
                            {config.currency}
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={config.monthly_price}
                              onChange={(e) => updateConfig(config.id, 'monthly_price', Number(e.target.value))}
                              className="w-24 px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={config.trial_days}
                              onChange={(e) => updateConfig(config.id, 'trial_days', Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={config.overdue_grace_days}
                              onChange={(e) => updateConfig(config.id, 'overdue_grace_days', Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
