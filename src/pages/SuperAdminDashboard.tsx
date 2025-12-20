import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import { Building2, DollarSign, Clock, CheckCircle, XCircle, Settings, LogOut } from 'lucide-react';
import PaymentApproval from '../components/superadmin/PaymentApproval';

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

interface SubscriptionConfig {
  id: string;
  country: string;
  currency: string;
  monthly_price: number;
  trial_days: number;
  overdue_grace_days: number;
}

interface SalesStats {
  platformRevenueByCurrency: { currency: string; amount: number }[];
  monthlyRevenueByCurrency: { currency: string; amount: number }[];
  totalRenewals: number;
  activeRestaurants: number;
  trialRestaurants: number;
  newRestaurantsToday: number;
  newRestaurantsThisMonth: number;
  totalProducts: number;
  totalOrdersThisMonth: number;
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'restaurants' | 'payments' | 'sales' | 'config'>('restaurants');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [configs, setConfigs] = useState<SubscriptionConfig[]>([]);
  const [salesStats, setSalesStats] = useState<SalesStats>({
    platformRevenueByCurrency: [],
    monthlyRevenueByCurrency: [],
    totalRenewals: 0,
    activeRestaurants: 0,
    trialRestaurants: 0,
    newRestaurantsToday: 0,
    newRestaurantsThisMonth: 0,
    totalProducts: 0,
    totalOrdersThisMonth: 0
  });
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
        // Payment approval is handled by the PaymentApproval component
        setLoading(false);
        return;
      } else if (activeTab === 'sales') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [paymentsData, restaurantsData, productsData, ordersData, configsData] = await Promise.all([
          supabase.from('payment_receipts').select('amount, status, submitted_at, currency'),
          supabase.from('restaurants').select('status, created_at, currency'),
          supabase.from('products').select('id'),
          supabase.from('orders').select('id, created_at, status').gte('created_at', startOfMonth.toISOString()),
          supabase.from('subscription_configs').select('monthly_price, currency')
        ]);

        if (paymentsData.data && restaurantsData.data) {
          const approvedPayments = paymentsData.data.filter(p => p.status === 'APPROVED');
          const totalRenewals = approvedPayments.length;

          const platformRevenueByCurrency: { [key: string]: number } = {};
          approvedPayments.forEach(p => {
            const curr = p.currency || 'USD';
            platformRevenueByCurrency[curr] = (platformRevenueByCurrency[curr] || 0) + p.amount;
          });

          const activeRestaurants = restaurantsData.data.filter(r => r.status === 'ACTIVE').length;
          const trialRestaurants = restaurantsData.data.filter(r => r.status === 'TRIAL').length;

          const newRestaurantsToday = restaurantsData.data.filter(
            r => new Date(r.created_at) >= startOfToday
          ).length;

          const newRestaurantsThisMonth = restaurantsData.data.filter(
            r => new Date(r.created_at) >= startOfMonth
          ).length;

          const monthlyRevenueByCurrency: { [key: string]: number } = {};
          const activeRestaurantsData = restaurantsData.data.filter(r => r.status === 'ACTIVE');

          configsData.data?.forEach(config => {
            const restaurantCount = activeRestaurantsData.filter(r => r.currency === config.currency).length;
            if (restaurantCount > 0) {
              monthlyRevenueByCurrency[config.currency] = restaurantCount * config.monthly_price;
            }
          });

          const totalProducts = productsData.data?.length || 0;
          const totalOrdersThisMonth = ordersData.data?.filter(o => o.status !== 'CANCELLED').length || 0;

          setSalesStats({
            platformRevenueByCurrency: Object.entries(platformRevenueByCurrency).map(([currency, amount]) => ({ currency, amount })),
            monthlyRevenueByCurrency: Object.entries(monthlyRevenueByCurrency).map(([currency, amount]) => ({ currency, amount })),
            totalRenewals,
            activeRestaurants,
            trialRestaurants,
            newRestaurantsToday,
            newRestaurantsThisMonth,
            totalProducts,
            totalOrdersThisMonth
          });
        }
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/backend-system');
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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8 flex-wrap">
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
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'sales'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Clock size={20} />
            Sales Report
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
                          Email
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
                              <div className="text-sm text-gray-700">{restaurant.owner?.email}</div>
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

            {activeTab === 'sales' && (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900">Platform Revenue & Metrics</h2>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Platform Revenue</h3>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <DollarSign size={20} className="text-green-600" />
                      </div>
                    </div>
                    {salesStats.platformRevenueByCurrency.length > 0 ? (
                      <div className="space-y-1">
                        {salesStats.platformRevenueByCurrency.map(({ currency, amount }) => (
                          <p key={currency} className="text-2xl font-bold text-gray-900">
                            {formatCurrency(amount, currency)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(0, 'USD')}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Total subscription revenue</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Monthly Recurring Revenue</h3>
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <DollarSign size={20} className="text-blue-600" />
                      </div>
                    </div>
                    {salesStats.monthlyRevenueByCurrency.length > 0 ? (
                      <div className="space-y-1">
                        {salesStats.monthlyRevenueByCurrency.map(({ currency, amount }) => (
                          <p key={currency} className="text-2xl font-bold text-gray-900">
                            {formatCurrency(amount, currency)}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-gray-900">
                        {formatCurrency(0, 'USD')}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">Expected monthly income</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Total Renewals</h3>
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <CheckCircle size={20} className="text-purple-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.totalRenewals}</p>
                    <p className="text-sm text-gray-500 mt-1">Approved payments</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Active Restaurants</h3>
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Building2 size={20} className="text-green-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.activeRestaurants}</p>
                    <p className="text-sm text-gray-500 mt-1">Paying customers</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Trial Restaurants</h3>
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Clock size={20} className="text-yellow-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.trialRestaurants}</p>
                    <p className="text-sm text-gray-500 mt-1">On trial period</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">New Today</h3>
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Building2 size={20} className="text-orange-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.newRestaurantsToday}</p>
                    <p className="text-sm text-gray-500 mt-1">Restaurants enrolled today</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">New This Month</h3>
                      <div className="p-2 bg-cyan-100 rounded-lg">
                        <Building2 size={20} className="text-cyan-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.newRestaurantsThisMonth}</p>
                    <p className="text-sm text-gray-500 mt-1">Restaurants this month</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Conversion Rate</h3>
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <CheckCircle size={20} className="text-indigo-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {salesStats.trialRestaurants + salesStats.activeRestaurants > 0
                        ? Math.round((salesStats.activeRestaurants / (salesStats.trialRestaurants + salesStats.activeRestaurants)) * 100)
                        : 0}%
                    </p>
                    <p className="text-sm text-gray-500 mt-1">Trial to paid conversion</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Activity Overview</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Products Across Platform</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {salesStats.totalProducts.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Orders This Month</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {salesStats.totalOrdersThisMonth.toLocaleString()}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Average Revenue per Customer</p>
                      {salesStats.platformRevenueByCurrency.length > 0 && salesStats.activeRestaurants > 0 ? (
                        <div className="space-y-1">
                          {salesStats.platformRevenueByCurrency.map(({ currency, amount }) => (
                            <p key={currency} className="text-xl font-bold text-gray-900">
                              {formatCurrency(amount / salesStats.activeRestaurants, currency)}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(0, 'USD')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="bg-white rounded-lg shadow p-6">
                <PaymentApproval />
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
