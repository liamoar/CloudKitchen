import { useState, useEffect } from 'react';
import { LogOut, Settings, Package, Receipt, BarChart3, Menu, X, CreditCard, Users, Store, Phone, Mail, Clock, ExternalLink, MapPin, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RestaurantSettings } from '../components/admin/RestaurantSettings';
import { ProductManagement } from '../components/admin/ProductManagement';
import { OrderManagement } from '../components/admin/OrderManagement';
import { SalesAnalytics } from '../components/admin/SalesAnalytics';
import { SubscriptionStatus } from '../components/admin/SubscriptionStatus';
import { RiderManagement } from '../components/admin/RiderManagement';
import { CustomerManagement } from '../components/admin/CustomerManagement';

type Tab = 'settings' | 'products' | 'orders' | 'sales' | 'subscription' | 'riders' | 'customers';

interface RestaurantInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  subdomain: string;
  is_open: boolean;
  currency: string;
  country: string;
}

export function RestroAdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);

  useEffect(() => {
    loadRestaurantInfo();
  }, [user?.id]);

  const loadRestaurantInfo = async () => {
    if (!user?.id) return;

    try {
      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .select(`
          id,
          name,
          subdomain,
          is_open,
          country,
          restaurant_currency,
          tier:subscription_tiers(currency)
        `)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (restError) {
        console.error('Error loading restaurant:', restError);
        return;
      }

      if (restaurant) {
        const { data: settings, error: settingsError } = await supabase
          .from('restaurant_settings')
          .select('name, phone, email, address')
          .eq('restaurant_id', restaurant.id)
          .maybeSingle();

        if (settingsError) {
          console.error('Error loading settings:', settingsError);
        }

        const currency = restaurant.tier?.currency || restaurant.restaurant_currency || 'USD';
        const restaurantName = settings?.name || restaurant.name || 'My Restaurant';

        setRestaurantInfo({
          name: restaurantName,
          phone: settings?.phone || '',
          email: settings?.email || '',
          address: settings?.address || '',
          subdomain: restaurant.subdomain || '',
          is_open: restaurant.is_open,
          currency: currency,
          country: restaurant.country || 'US',
        });
      }
    } catch (error) {
      console.error('Error in loadRestaurantInfo:', error);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const tabs = [
    { id: 'orders' as Tab, label: 'Orders', icon: Receipt },
    { id: 'products' as Tab, label: 'Products', icon: Package },
    { id: 'customers' as Tab, label: 'Customers', icon: UserCheck },
    { id: 'riders' as Tab, label: 'Riders', icon: Users },
    { id: 'sales' as Tab, label: 'Sales', icon: BarChart3 },
    { id: 'subscription' as Tab, label: 'Subscription', icon: CreditCard },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store size={32} className="text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{restaurantInfo?.name || 'hejo.app'}</h1>
                {restaurantInfo && (
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                    {restaurantInfo.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={14} />
                        {restaurantInfo.phone}
                      </span>
                    )}
                    {restaurantInfo.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {restaurantInfo.address}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      restaurantInfo.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <Clock size={12} />
                      {restaurantInfo.is_open ? 'Open' : 'Closed'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {restaurantInfo?.subdomain && (
                <a
                  href={`https://${restaurantInfo.subdomain}.hejo.app`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ExternalLink size={20} />
                  View Store
                </a>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut size={20} />
                Sign Out
              </button>
            </div>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className={`flex gap-4 mb-8 flex-wrap md:flex-nowrap ${showMobileMenu ? 'flex-col' : 'flex-row'}`}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setShowMobileMenu(false);
              }}
              className={`flex items-center gap-2 px-4 py-3 font-medium rounded-lg transition-colors ${
                activeTab === id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="md:hidden flex items-center gap-2 px-4 py-3 font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </nav>

        {activeTab === 'settings' && <RestaurantSettings />}
        {activeTab === 'products' && <ProductManagement currency={restaurantInfo?.currency} />}
        {activeTab === 'orders' && <OrderManagement currency={restaurantInfo?.currency} />}
        {activeTab === 'customers' && <CustomerManagement />}
        {activeTab === 'riders' && <RiderManagement />}
        {activeTab === 'sales' && <SalesAnalytics currency={restaurantInfo?.currency} />}
        {activeTab === 'subscription' && <SubscriptionStatus currency={restaurantInfo?.currency} />}
      </div>
    </div>
  );
}
