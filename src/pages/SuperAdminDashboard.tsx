import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import { Building2, DollarSign, Clock, CheckCircle, XCircle, LogOut, Trash2, Ban, Package, ShoppingCart, Edit2, Eye, EyeOff, Globe, MessageCircle } from 'lucide-react';
import PaymentApproval from '../components/superadmin/PaymentApproval';
import CountryTierManagement from '../components/superadmin/CountryTierManagement';
import { SupportChatManagement } from '../components/superadmin/SupportChatManagement';

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
  trial_ends_at: string | null;
  subscription_end_date: string | null;
  subscription_ends_at: string | null;
  is_payment_overdue: boolean;
  created_at: string;
  current_month_orders: number;
  current_product_count: number;
  trial_days_remaining: number;
  subscription_days_remaining: number;
  ending_soon: boolean;
  days_until_action_needed: number;
  owner: {
    name: string;
    email: string;
    phone: string;
  };
  tier: {
    name: string;
    order_limit_per_month: number;
    product_limit: number;
    trial_days: number;
  } | null;
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
  basicTierBusinesses: number;
  premiumTierBusinesses: number;
}

interface CountryOption {
  country: string;
  country_name: string;
  currency: string;
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<'restaurants' | 'payments' | 'sales' | 'tiers' | 'chat'>('restaurants');
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [salesStats, setSalesStats] = useState<SalesStats>({
    platformRevenueByCurrency: [],
    monthlyRevenueByCurrency: [],
    totalRenewals: 0,
    activeRestaurants: 0,
    trialRestaurants: 0,
    newRestaurantsToday: 0,
    newRestaurantsThisMonth: 0,
    totalProducts: 0,
    totalOrdersThisMonth: 0,
    basicTierBusinesses: 0,
    premiumTierBusinesses: 0
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
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [countries, setCountries] = useState<CountryOption[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedCountry]);

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      const { data: tiers } = await supabase
        .from('subscription_tiers')
        .select('country, country_name, currency')
        .order('country_name');

      if (tiers) {
        const uniqueCountries = Array.from(
          new Map(tiers.map(t => [t.country, t])).values()
        );
        setCountries(uniqueCountries);
      }
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'restaurants') {
        const { data: statusData } = await supabase
          .from('restaurant_subscription_status')
          .select('*')
          .order('created_at', { ascending: false });

        const restaurantsWithDetails = await Promise.all(
          (statusData || []).map(async (restaurant) => {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const [ordersData, productsData, ownerData] = await Promise.all([
              supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', restaurant.id)
                .gte('created_at', startOfMonth.toISOString())
                .neq('status', 'CANCELLED'),
              supabase
                .from('products')
                .select('id', { count: 'exact' })
                .eq('restaurant_id', restaurant.id),
              supabase
                .from('restaurants')
                .select('owner_id, subdomain, domain_status')
                .eq('id', restaurant.id)
                .maybeSingle()
                .then(async (res) => {
                  if (res.data) {
                    const userData = await supabase
                      .from('users')
                      .select('name, email, phone')
                      .eq('id', res.data.owner_id)
                      .maybeSingle();
                    return { ...res.data, owner: userData.data };
                  }
                  return res.data;
                })
            ]);

            return {
              ...restaurant,
              current_month_orders: ordersData.count || 0,
              current_product_count: productsData.count || 0,
              subdomain: ownerData?.subdomain || '',
              domain_status: ownerData?.domain_status || '',
              owner: ownerData?.owner || { name: '', email: '', phone: '' },
              tier: {
                name: restaurant.tier_name || 'No Tier',
                order_limit_per_month: restaurant.order_limit_per_month || 0,
                product_limit: restaurant.product_limit || 0,
                trial_days: restaurant.trial_days || 0
              }
            };
          })
        );

        setRestaurants(restaurantsWithDetails);
      } else if (activeTab === 'payments') {
        // Payment approval is handled by the PaymentApproval component
        setLoading(false);
        return;
      } else if (activeTab === 'sales') {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const { data: tiers } = await supabase
          .from('subscription_tiers')
          .select('*');

        let restaurantsQuery = supabase
          .from('restaurants')
          .select('id, status, created_at, country, current_tier_id');

        if (selectedCountry !== 'ALL') {
          restaurantsQuery = restaurantsQuery.eq('country', selectedCountry);
        }

        const { data: restaurantsData } = await restaurantsQuery;

        let invoicesQuery = supabase
          .from('payment_invoices')
          .select('*, restaurant:restaurants!inner(country)')
          .eq('status', 'APPROVED');

        if (selectedCountry !== 'ALL') {
          invoicesQuery = invoicesQuery.eq('restaurant.country', selectedCountry);
        }

        const { data: invoicesData } = await invoicesQuery;

        if (restaurantsData && tiers) {
          const tierMap = new Map(tiers.map(t => [t.id, t]));

          let currency = 'USD';
          if (selectedCountry !== 'ALL') {
            const countryTier = tiers.find(t => t.country === selectedCountry);
            currency = countryTier?.currency || 'USD';
          }

          let totalRevenue = 0;
          let totalRenewals = 0;

          if (invoicesData) {
            invoicesData.forEach(invoice => {
              totalRevenue += Number(invoice.amount);
              if (invoice.invoice_type === 'RENEWAL') {
                totalRenewals++;
              }
            });
          }

          const activeRestaurants = restaurantsData.filter(r => r.status === 'ACTIVE').length;
          const trialRestaurants = restaurantsData.filter(r => r.status === 'TRIAL').length;

          const newRestaurantsToday = restaurantsData.filter(
            r => new Date(r.created_at) >= startOfToday
          ).length;

          const newRestaurantsThisMonth = restaurantsData.filter(
            r => new Date(r.created_at) >= startOfMonth
          ).length;

          let monthlyRecurringRevenue = 0;
          let basicTierBusinesses = 0;
          let premiumTierBusinesses = 0;

          restaurantsData.forEach(restaurant => {
            if (restaurant.status === 'ACTIVE' && restaurant.current_tier_id) {
              const tier = tierMap.get(restaurant.current_tier_id);
              if (tier) {
                monthlyRecurringRevenue += Number(tier.monthly_price);

                if (tier.name.toLowerCase().includes('basic')) {
                  basicTierBusinesses++;
                } else if (tier.name.toLowerCase().includes('premium')) {
                  premiumTierBusinesses++;
                }
              }
            }
          });

          const restaurantIds = restaurantsData.map(r => r.id);

          const [productsData, ordersData] = await Promise.all([
            supabase
              .from('products')
              .select('id')
              .in('restaurant_id', restaurantIds.length > 0 ? restaurantIds : ['']),
            supabase
              .from('orders')
              .select('id, status')
              .in('restaurant_id', restaurantIds.length > 0 ? restaurantIds : [''])
              .gte('created_at', startOfMonth.toISOString())
          ]);

          const totalProducts = productsData.data?.length || 0;
          const totalOrdersThisMonth = ordersData.data?.filter(o => o.status !== 'CANCELLED').length || 0;

          setSalesStats({
            platformRevenueByCurrency: [{ currency, amount: totalRevenue }],
            monthlyRevenueByCurrency: [{ currency, amount: monthlyRecurringRevenue }],
            totalRenewals,
            activeRestaurants,
            trialRestaurants,
            newRestaurantsToday,
            newRestaurantsThisMonth,
            totalProducts,
            totalOrdersThisMonth,
            basicTierBusinesses,
            premiumTierBusinesses
          });
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
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
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('owner_id')
        .eq('id', restaurantId)
        .maybeSingle();

      const ownerId = restaurant?.owner_id;

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

      await supabase
        .from('payment_invoices')
        .delete()
        .eq('restaurant_id', restaurantId);

      if (ownerId) {
        const { data: supportTickets } = await supabase
          .from('support_tickets')
          .select('id')
          .eq('restaurant_id', restaurantId);

        if (supportTickets && supportTickets.length > 0) {
          const ticketIds = supportTickets.map(t => t.id);

          await supabase
            .from('support_messages')
            .delete()
            .in('ticket_id', ticketIds);
        }

        await supabase
          .from('support_tickets')
          .delete()
          .eq('restaurant_id', restaurantId);
      }

      const { error: restaurantError } = await supabase
        .from('restaurants')
        .delete()
        .eq('id', restaurantId);

      if (restaurantError) {
        throw restaurantError;
      }

      if (ownerId) {
        const { data: userData } = await supabase
          .from('users')
          .select('auth_id')
          .eq('id', ownerId)
          .maybeSingle();

        if (userData?.auth_id) {
          const { error: authError } = await supabase.auth.admin.deleteUser(userData.auth_id);

          if (authError) {
            console.error('Error deleting auth user:', authError);
          }
        }
      }

      loadData();
      alert('Business deleted successfully');
    } catch (error) {
      console.error('Error deleting business:', error);
      alert(`Error deleting business: ${error.message || 'Please try again.'}`);
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
            <Globe size={20} />
            Countries & Tiers
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MessageCircle size={20} />
            Support Chat
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
                        const daysLeft = restaurant.status === 'TRIAL'
                          ? restaurant.trial_days_remaining
                          : restaurant.subscription_days_remaining;
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
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Platform Revenue & Metrics</h2>
                  <div className="flex items-center gap-3">
                    <Globe className="text-orange-500" size={24} />
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium bg-white"
                    >
                      <option value="ALL">All Countries</option>
                      {countries.map(country => (
                        <option key={country.country} value={country.country}>
                          {country.country_name} ({country.country})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

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
                      <h3 className="text-sm font-medium text-gray-600">Active Businesses</h3>
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
                      <h3 className="text-sm font-medium text-gray-600">Businesses in Trial</h3>
                      <div className="p-2 bg-yellow-100 rounded-lg">
                        <Clock size={20} className="text-yellow-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.trialRestaurants}</p>
                    <p className="text-sm text-gray-500 mt-1">Trial period</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Basic Tier Businesses</h3>
                      <div className="p-2 bg-teal-100 rounded-lg">
                        <Building2 size={20} className="text-teal-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.basicTierBusinesses}</p>
                    <p className="text-sm text-gray-500 mt-1">Basic plan</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">Premium Tier Businesses</h3>
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Building2 size={20} className="text-indigo-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.premiumTierBusinesses}</p>
                    <p className="text-sm text-gray-500 mt-1">Premium plan</p>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-gray-600">New This Month</h3>
                      <div className="p-2 bg-pink-100 rounded-lg">
                        <Building2 size={20} className="text-pink-600" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{salesStats.newRestaurantsThisMonth}</p>
                    <p className="text-sm text-gray-500 mt-1">New businesses</p>
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
              <CountryTierManagement />
            )}

            {activeTab === 'chat' && (
              <SupportChatManagement />
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
