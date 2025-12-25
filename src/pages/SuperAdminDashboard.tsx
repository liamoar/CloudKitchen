import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency } from '../lib/utils';
import { Building2, DollarSign, Clock, CheckCircle, XCircle, LogOut, Trash2, Ban, Package, ShoppingCart, Edit2, Eye, EyeOff, Globe, MessageCircle } from 'lucide-react';
import PaymentApproval from '../components/superadmin/PaymentApproval';
import { CountryManagement } from '../components/superadmin/CountryManagement';
import { TierManagement } from '../components/superadmin/TierManagement';
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
  const [activeTab, setActiveTab] = useState<'restaurants' | 'payments' | 'sales' | 'countries' | 'tiers' | 'chat'>('restaurants');
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
      const { data: countries } = await supabase
        .from('countries')
        .select('id, name, short_name, currency')
        .eq('status', 'active')
        .order('name');

      if (countries) {
        setCountries(countries.map(c => ({
          country: c.short_name,
          country_name: c.name,
          currency: c.currency
        })));
      }
    } catch (error) {
      console.error('Error loading countries:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'restaurants') {
        const { data: businessesData } = await supabase
          .from('businesses')
          .select(`
            id,
            name,
            slug,
            subdomain,
            is_subdomain_active,
            owner_id,
            status,
            trial_ends_at,
            current_period_starts_at,
            current_period_ends_at,
            created_at,
            countries!inner(
              name,
              short_name,
              currency
            ),
            subscription_tiers(
              name,
              price,
              days,
              product_limit,
              orders_per_month,
              trial_days
            )
          `)
          .order('created_at', { ascending: false });

        const restaurantsWithDetails = await Promise.all(
          (businessesData || []).map(async (business) => {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const [ordersData, productsData, ownerData] = await Promise.all([
              supabase
                .from('orders')
                .select('id', { count: 'exact' })
                .eq('business_id', business.id)
                .gte('created_at', startOfMonth.toISOString())
                .neq('status', 'CANCELLED'),
              supabase
                .from('products')
                .select('id', { count: 'exact' })
                .eq('business_id', business.id),
              supabase
                .from('users')
                .select('name, email, phone')
                .eq('id', business.owner_id)
                .maybeSingle()
            ]);

            const trialDaysRemaining = business.trial_ends_at
              ? Math.ceil((new Date(business.trial_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;

            const subscriptionDaysRemaining = business.current_period_ends_at
              ? Math.ceil((new Date(business.current_period_ends_at).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null;

            return {
              id: business.id,
              name: business.name,
              slug: business.slug,
              subdomain: business.subdomain,
              currency: business.countries?.currency || 'USD',
              country: business.countries?.short_name || '',
              status: business.status,
              domain_status: business.is_subdomain_active ? 'active' : 'inactive',
              trial_end_date: business.trial_ends_at,
              trial_ends_at: business.trial_ends_at,
              subscription_end_date: business.current_period_ends_at,
              subscription_ends_at: business.current_period_ends_at,
              is_payment_overdue: false,
              created_at: business.created_at,
              current_month_orders: ordersData.count || 0,
              current_product_count: productsData.count || 0,
              trial_days_remaining: trialDaysRemaining || 0,
              subscription_days_remaining: subscriptionDaysRemaining || 0,
              ending_soon: (trialDaysRemaining !== null && trialDaysRemaining < 7) ||
                          (subscriptionDaysRemaining !== null && subscriptionDaysRemaining < 7),
              days_until_action_needed: trialDaysRemaining || subscriptionDaysRemaining || 0,
              owner: ownerData || { name: '', email: '', phone: '' },
              tier: business.subscription_tiers ? {
                name: business.subscription_tiers.name,
                order_limit_per_month: business.subscription_tiers.orders_per_month || 0,
                product_limit: business.subscription_tiers.product_limit || 0,
                trial_days: business.subscription_tiers.trial_days || 0
              } : null
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

        let businessesQuery = supabase
          .from('businesses')
          .select(`
            id,
            status,
            created_at,
            subscription_tier_id,
            countries!inner(
              id,
              short_name,
              currency
            )
          `);

        if (selectedCountry !== 'ALL') {
          businessesQuery = businessesQuery.eq('countries.short_name', selectedCountry);
        }

        const { data: businessesData } = await businessesQuery;

        let invoicesQuery = supabase
          .from('payment_invoices')
          .select(`
            *,
            business:businesses!inner(
              id,
              countries!inner(
                short_name
              )
            )
          `)
          .eq('status', 'APPROVED');

        const { data: invoicesData } = await invoicesQuery;

        const filteredInvoices = selectedCountry !== 'ALL'
          ? invoicesData?.filter(inv => inv.business?.countries?.short_name === selectedCountry)
          : invoicesData;

        if (businessesData && tiers) {
          const tierMap = new Map(tiers.map(t => [t.id, t]));

          let currency = 'USD';
          if (selectedCountry !== 'ALL') {
            const selectedCountryData = businessesData[0]?.countries;
            currency = selectedCountryData?.currency || 'USD';
          }

          let totalRevenue = 0;
          let totalRenewals = 0;

          if (filteredInvoices) {
            filteredInvoices.forEach(invoice => {
              totalRevenue += Number(invoice.amount);
              if (invoice.invoice_type === 'RENEWAL') {
                totalRenewals++;
              }
            });
          }

          const activeRestaurants = businessesData.filter(b => b.status === 'ACTIVE').length;
          const trialRestaurants = businessesData.filter(b => b.status === 'TRIAL').length;

          const newRestaurantsToday = businessesData.filter(
            b => new Date(b.created_at) >= startOfToday
          ).length;

          const newRestaurantsThisMonth = businessesData.filter(
            b => new Date(b.created_at) >= startOfMonth
          ).length;

          let monthlyRecurringRevenue = 0;
          let basicTierBusinesses = 0;
          let premiumTierBusinesses = 0;

          businessesData.forEach(business => {
            if (business.status === 'ACTIVE' && business.subscription_tier_id) {
              const tier = tierMap.get(business.subscription_tier_id);
              if (tier) {
                const monthlyPrice = Number(tier.price) * (30 / (tier.days || 30));
                monthlyRecurringRevenue += monthlyPrice;

                if (tier.name.toLowerCase().includes('basic')) {
                  basicTierBusinesses++;
                } else if (tier.name.toLowerCase().includes('premium')) {
                  premiumTierBusinesses++;
                }
              }
            }
          });

          const businessIds = businessesData.map(b => b.id);

          const [productsData, ordersData] = await Promise.all([
            supabase
              .from('products')
              .select('id')
              .in('business_id', businessIds.length > 0 ? businessIds : ['']),
            supabase
              .from('orders')
              .select('id, status')
              .in('business_id', businessIds.length > 0 ? businessIds : [''])
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


  const deactivateBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to deactivate this business? They will not be able to operate until reactivated.')) {
      return;
    }

    try {
      await supabase
        .from('businesses')
        .update({ is_subdomain_active: false, status: 'SUSPENDED' })
        .eq('id', businessId);
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

  const deleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to DELETE this business? This will permanently remove all data including orders, products, and settings. This action cannot be undone!')) {
      return;
    }

    const confirmDelete = prompt('Type "DELETE" to confirm permanent deletion:');
    if (confirmDelete !== 'DELETE') {
      alert('Deletion cancelled.');
      return;
    }

    try {
      const { data: business } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', businessId)
        .maybeSingle();

      const ownerId = business?.owner_id;

      const { data: orders } = await supabase
        .from('orders')
        .select('id')
        .eq('business_id', businessId);

      if (orders && orders.length > 0) {
        const orderIds = orders.map(o => o.id);

        await supabase
          .from('order_items')
          .delete()
          .in('order_id', orderIds);
      }

      await supabase
        .from('orders')
        .delete()
        .eq('business_id', businessId);

      await supabase
        .from('products')
        .delete()
        .eq('business_id', businessId);

      await supabase
        .from('customers')
        .delete()
        .eq('business_id', businessId);

      await supabase
        .from('riders')
        .delete()
        .eq('business_id', businessId);

      await supabase
        .from('business_settings')
        .delete()
        .eq('business_id', businessId);

      await supabase
        .from('payment_invoices')
        .delete()
        .eq('business_id', businessId);

      const { data: supportChats } = await supabase
        .from('support_chats')
        .select('id')
        .eq('business_id', businessId);

      if (supportChats && supportChats.length > 0) {
        const chatIds = supportChats.map(c => c.id);

        await supabase
          .from('support_messages')
          .delete()
          .in('chat_id', chatIds);
      }

      await supabase
        .from('support_chats')
        .delete()
        .eq('business_id', businessId);

      const { error: businessError } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);

      if (businessError) {
        throw businessError;
      }

      if (ownerId) {
        const { data: userData } = await supabase
          .from('users')
          .select('auth_id')
          .eq('id', ownerId)
          .maybeSingle();

        if (userData?.auth_id) {
          const { data: session } = await supabase.auth.getSession();
          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;

          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.session?.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ authId: userData.auth_id }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('Error deleting auth user:', errorData);
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
            onClick={() => setActiveTab('countries')}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              activeTab === 'countries'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Globe size={20} />
            Countries
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

            {activeTab === 'countries' && (
              <CountryManagement />
            )}

            {activeTab === 'tiers' && (
              <TierManagement />
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
