import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import { Building2, DollarSign, Clock, CheckCircle, XCircle, Settings, LogOut, Trash2, Ban, Package, ShoppingCart, Edit2, Eye, EyeOff } from 'lucide-react';
import PaymentApproval from '../components/superadmin/PaymentApproval';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  currency: string;
  country: string;
  status: string;
  domain_status: string;
  trial_end_date: string | null;
  subscription_end_date: string | null;
  is_payment_overdue: boolean;
  created_at: string;
  current_month_orders: number;
  current_product_count: number;
  owner: {
    name: string;
    email: string;
    phone: string;
  };
  tier: {
    name: string;
    order_limit_per_month: number;
    product_limit: number;
  } | null;
}

interface SubscriptionConfig {
  id: string;
  country: string;
  currency: string;
  monthly_price: number;
  trial_days: number;
  overdue_grace_days: number;
}

interface SubscriptionTier {
  id: string;
  name: string;
  country: string;
  monthly_price: number;
  product_limit: number;
  order_limit_per_month: number;
  storage_limit_mb: number;
  is_active: boolean;
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
  const [activeTab, setActiveTab] = useState<'restaurants' | 'payments' | 'sales' | 'config' | 'tiers'>('restaurants');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [configs, setConfigs] = useState<SubscriptionConfig[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
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
  const [editingBusiness, setEditingBusiness] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    newPassword: ''
  });
  const [showEditPassword, setShowEditPassword] = useState(false);

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
            owner:users!restaurants_owner_id_fkey(name, email, phone),
            tier:subscription_tiers!restaurants_tier_id_fkey(name, order_limit_per_month, product_limit)
          `)
          .order('created_at', { ascending: false });

        const restaurantsWithCounts = await Promise.all(
          (data || []).map(async (restaurant) => {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const [ordersData, productsData] = await Promise.all([
              supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', restaurant.id)
                .gte('created_at', startOfMonth.toISOString())
                .neq('status', 'CANCELLED'),
              supabase
                .from('products')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', restaurant.id)
            ]);

            return {
              ...restaurant,
              current_month_orders: ordersData.count || 0,
              current_product_count: productsData.count || 0
            };
          })
        );

        setRestaurants(restaurantsWithCounts);
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
      } else if (activeTab === 'tiers') {
        const { data } = await supabase
          .from('subscription_tiers')
          .select('*')
          .order('country, name');
        setTiers(data || []);
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

  const updateTier = async (tierId: string, field: string, value: number) => {
    try {
      await supabase
        .from('subscription_tiers')
        .update({ [field]: value })
        .eq('id', tierId);
      loadData();
    } catch (error) {
      console.error('Error updating tier:', error);
    }
  };

  const deactivateBusiness = async (restaurantId: string) => {
    if (!confirm('Are you sure you want to deactivate this business? They will not be able to operate until reactivated.')) {
      return;
    }

    try {
      await supabase
        .from('restaurants')
        .update({ domain_status: 'suspended', status: 'SUSPENDED' })
        .eq('id', restaurantId);
      loadData();
    } catch (error) {
      console.error('Error deactivating business:', error);
    }
  };

  const openEditBusiness = async (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    if (!restaurant) return;

    setEditFormData({
      name: restaurant.owner.name,
      email: restaurant.owner.email,
      phone: restaurant.owner.phone,
      newPassword: ''
    });
    setEditingBusiness(restaurantId);
  };

  const saveBusinessEdit = async () => {
    if (!editingBusiness) return;

    const restaurant = restaurants.find(r => r.id === editingBusiness);
    if (!restaurant) return;

    try {
      const updates: any = {
        name: editFormData.name,
        email: editFormData.email,
        phone: editFormData.phone
      };

      if (editFormData.newPassword && editFormData.newPassword.length >= 6) {
        updates.password = editFormData.newPassword;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('phone', restaurant.owner.phone);

      if (error) throw error;

      alert('Business details updated successfully');
      setEditingBusiness(null);
      loadData();
    } catch (error) {
      console.error('Error updating business:', error);
      alert('Error updating business details');
    }
  };

  const deleteBusiness = async (restaurantId: string) => {
    if (!confirm('Are you sure you want to DELETE this business? This will permanently remove all data including orders, products, and settings. This action cannot be undone!')) {
      return;
    }

    const confirmDelete = prompt('Type "DELETE" to confirm permanent deletion:');
    if (confirmDelete !== 'DELETE') {
      alert('Deletion cancelled.');
      return;
    }

    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurantId);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);

        await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds);

        await supabase
          .from('order_tracking_tokens')
          .delete()
          .in('order_id', orderIds);
      }

      await supabase
        .from('orders')
        .delete()
        .eq('restaurant_id', restaurantId);

      const { data: bundles } = await supabase
        .from('bundles')
        .select('id')
        .eq('restaurant_id', restaurantId);

      if (bundles && bundles.length > 0) {
        const bundleIds = bundles.map(b => b.id);

        await supabase
          .from('bundle_products')
          .delete()
          .in('bundle_id', bundleIds);
      }

      await supabase
        .from('bundles')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('products')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('product_categories')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('offers')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('featured_products')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('restaurant_settings')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('delivery_riders')
        .delete()
        .eq('restaurant_id', restaurantId);

      await supabase
        .from('payment_receipts')
        .delete()
        .eq('restaurant_id', restaurantId);

      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('restaurant_id', restaurantId);

      if (customers && customers.length > 0) {
        const customerIds = customers.map(c => c.id);

        await supabase
          .from('customer_addresses')
          .delete()
          .in('customer_id', customerIds);
      }

      await supabase
        .from('customers')
        .delete()
        .eq('restaurant_id', restaurantId);

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('owner_id')
        .eq('id', restaurantId)
        .maybeSingle();

      await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);

      if (restaurant?.owner_id) {
        await supabase
          .from('users')
          .delete()
          .eq('id', restaurant.owner_id);
      }

      loadData();
      alert('Business deleted successfully');
    } catch (error) {
      console.error('Error deleting business:', error);
      alert('Error deleting business. Please try again.');
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
            Businesses
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
            onClick={() => setActiveTab('tiers')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'tiers'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Package size={20} />
            Subscription Tiers
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
                          Business
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Owner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Tier / Usage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Days Left
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Business URL
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
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
                        const orderLimit = restaurant.tier?.order_limit_per_month || 0;
                        const productLimit = restaurant.tier?.product_limit || 0;
                        const orderUsage = orderLimit === -1 ? 'Unlimited' : `${restaurant.current_month_orders}/${orderLimit}`;
                        const productUsage = productLimit === -1 ? 'Unlimited' : `${restaurant.current_product_count}/${productLimit}`;

                        return (
                          <tr key={restaurant.id}>
                            <td className="px-6 py-4">
                              <div className="font-medium text-gray-900">{restaurant.name}</div>
                              <div className="text-xs text-gray-500">{restaurant.country}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{restaurant.owner?.name}</div>
                              <div className="text-xs text-gray-500">{restaurant.owner?.phone}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{restaurant.tier?.name || 'No Tier'}</div>
                              <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                <div className="flex items-center gap-1">
                                  <ShoppingCart size={12} />
                                  <span>{orderUsage}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Package size={12} />
                                  <span>{productUsage}</span>
                                </div>
                              </div>
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
                            <td className="px-6 py-4">
                              {restaurant.subdomain ? (
                                <a
                                  href={`https://${restaurant.subdomain}.hejo.app`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                  {restaurant.subdomain}.hejo.app
                                </a>
                              ) : (
                                <span className="text-sm text-gray-500">No subdomain</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => openEditBusiness(restaurant.id)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit Business Details"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => deactivateBusiness(restaurant.id)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Deactivate Business"
                                >
                                  <Ban size={16} />
                                </button>
                                <button
                                  onClick={() => deleteBusiness(restaurant.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete Business"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
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

            {activeTab === 'tiers' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Subscription Tiers Management</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Configure subscription tiers for each country. Set order limits, product limits, and pricing.
                    Use -1 for unlimited access.
                  </p>

                  <div className="space-y-8">
                    {['AE', 'NP'].map((country) => {
                      const countryTiers = tiers.filter(t => t.country === country);
                      return (
                        <div key={country} className="border rounded-lg p-6">
                          <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            {country === 'AE' ? 'United Arab Emirates (UAE)' : 'Nepal'}
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Price</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Limit/Month</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Limit</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage (MB)</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {countryTiers.map((tier) => (
                                  <tr key={tier.id}>
                                    <td className="px-4 py-4 font-medium text-gray-900">{tier.name}</td>
                                    <td className="px-4 py-4">
                                      <input
                                        type="number"
                                        value={tier.monthly_price}
                                        onChange={(e) => updateTier(tier.id, 'monthly_price', Number(e.target.value))}
                                        className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                      />
                                    </td>
                                    <td className="px-4 py-4">
                                      <input
                                        type="number"
                                        value={tier.order_limit_per_month}
                                        onChange={(e) => updateTier(tier.id, 'order_limit_per_month', Number(e.target.value))}
                                        className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                        placeholder="-1 = unlimited"
                                      />
                                      {tier.order_limit_per_month === -1 && (
                                        <span className="text-xs text-green-600 ml-2">Unlimited</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4">
                                      <input
                                        type="number"
                                        value={tier.product_limit}
                                        onChange={(e) => updateTier(tier.id, 'product_limit', Number(e.target.value))}
                                        className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                        placeholder="-1 = unlimited"
                                      />
                                      {tier.product_limit === -1 && (
                                        <span className="text-xs text-green-600 ml-2">Unlimited</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-4">
                                      <input
                                        type="number"
                                        value={tier.storage_limit_mb}
                                        onChange={(e) => updateTier(tier.id, 'storage_limit_mb', Number(e.target.value))}
                                        className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                                      />
                                    </td>
                                    <td className="px-4 py-4">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        tier.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        {tier.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Important Notes:</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>Use -1 to indicate unlimited orders or products</li>
                      <li>Basic tier limits: 40 orders per month by default</li>
                      <li>Premium tier: Typically unlimited (-1) for orders and products</li>
                      <li>Changes apply immediately to all businesses in that country/tier</li>
                      <li>Businesses are assigned tiers based on their country</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'config' && (
              <div className="bg-white rounded-lg shadow">
                <div className="p-6 border-b">
                  <h2 className="text-xl font-bold text-gray-900">General Configuration</h2>
                  <p className="text-sm text-gray-600 mt-1">Configure trial periods and grace days for each country</p>
                </div>
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
                              className="w-24 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={config.trial_days}
                              onChange={(e) => updateConfig(config.id, 'trial_days', Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={config.overdue_grace_days}
                              onChange={(e) => updateConfig(config.id, 'overdue_grace_days', Number(e.target.value))}
                              className="w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500"
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

      {editingBusiness && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Edit Business Details</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password (leave blank to keep current)
                </label>
                <div className="relative">
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    value={editFormData.newPassword}
                    onChange={(e) => setEditFormData({ ...editFormData, newPassword: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="Min. 6 characters"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showEditPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveBusinessEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingBusiness(null)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
