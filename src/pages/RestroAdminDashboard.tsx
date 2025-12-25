import { useState, useEffect } from 'react';
import { LogOut, Settings, Package, Receipt, BarChart3, Menu, X, CreditCard, Users, Store, Phone, Mail, Clock, ExternalLink, MapPin, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RestaurantSettings } from '../components/admin/RestaurantSettings';
import { EnhancedProductManagement } from '../components/admin/EnhancedProductManagement';
import { OrderManagement } from '../components/admin/OrderManagement';
import { SalesAnalytics } from '../components/admin/SalesAnalytics';
import { SubscriptionStatus } from '../components/admin/SubscriptionStatus';
import { RiderManagement } from '../components/admin/RiderManagement';
import { CustomerManagement } from '../components/admin/CustomerManagement';
import { SupportChatPopup } from '../components/admin/SupportChatPopup';
import { SubscriptionAlert } from '../components/admin/SubscriptionAlert';

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
  subscription_status?: string;
  trial_ends_at?: string;
  subscription_ends_at?: string;
}

export function RestroAdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('settings');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [showTrialWarning, setShowTrialWarning] = useState(false);

  useEffect(() => {
    const handleAuthTokens = async () => {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (accessToken && refreshToken && type === 'signup') {
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error('Error setting session:', error);
          } else {
            window.history.replaceState({}, '', '/admin');
          }
        } catch (err) {
          console.error('Error handling auth tokens:', err);
        }
      }
    };

    handleAuthTokens();
  }, []);

  useEffect(() => {
    loadRestaurantInfo();
  }, [user?.id]);

  const loadRestaurantInfo = async () => {
    if (!user?.id) return;

    try {
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          subdomain,
          status,
          trial_ends_at,
          current_period_ends_at,
          country:countries(name, currency, currency_symbol)
        `)
        .eq('owner_id', user.id)
        .maybeSingle();

      if (businessError) {
        console.error('Error loading business:', businessError);
        return;
      }

      if (business) {
        const { data: settings, error: settingsError } = await supabase
          .from('business_settings')
          .select('support_phone, support_email, address, city')
          .eq('business_id', business.id)
          .maybeSingle();

        if (settingsError) {
          console.error('Error loading settings:', settingsError);
        }

        const currency = business.country?.currency_symbol || '$';
        const businessName = business.name || 'My Business';

        setRestaurantInfo({
          name: businessName,
          phone: settings?.support_phone || '',
          email: settings?.support_email || '',
          address: `${settings?.address || ''}, ${settings?.city || ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
          subdomain: business.subdomain || '',
          is_open: business.status === 'active' || business.status === 'trial',
          currency: currency,
          country: business.country?.name || 'US',
          subscription_status: business.status,
          trial_ends_at: business.trial_ends_at,
          subscription_ends_at: business.current_period_ends_at,
        });

        if (business.status === 'trial' && business.trial_ends_at) {
          const daysLeft = Math.ceil((new Date(business.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setTrialDaysLeft(daysLeft);
          setShowTrialWarning(daysLeft <= 5 && daysLeft >= 0);
        }

        if (business.status === 'overdue' || business.status === 'suspended') {
          setActiveTab('subscription');
        }
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
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
    { id: 'products' as Tab, label: 'Products', icon: Package },
    { id: 'orders' as Tab, label: 'Orders', icon: Receipt },
    // Temporarily disabled tabs - will enable one by one after testing
    // { id: 'customers' as Tab, label: 'Customers', icon: UserCheck },
    // { id: 'riders' as Tab, label: 'Riders', icon: Users },
    // { id: 'sales' as Tab, label: 'Sales', icon: BarChart3 },
    // { id: 'subscription' as Tab, label: 'Subscription', icon: CreditCard },
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
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
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
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                      {restaurantInfo.phone && (
                        <span className="flex items-center gap-1">
                          <Phone size={14} />
                          {restaurantInfo.phone}
                        </span>
                      )}
                      {restaurantInfo.email && (
                        <span className="flex items-center gap-1">
                          <Mail size={14} />
                          {restaurantInfo.email}
                        </span>
                      )}
                    </div>
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

      {/* Temporarily disabled */}
      {/* <SubscriptionAlert /> */}

      {showTrialWarning && trialDaysLeft !== null && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-yellow-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">
                  {trialDaysLeft === 0 ? 'Your trial ends today!' : `Your trial ends in ${trialDaysLeft} ${trialDaysLeft === 1 ? 'day' : 'days'}!`}
                </p>
                <p className="text-xs text-yellow-800">
                  Please subscribe to a plan to continue using all features without interruption.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('subscription')}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Subscribe Now
              </button>
            </div>
          </div>
        </div>
      )}

      {restaurantInfo?.subscription_status === 'OVERDUE' && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-900">
                  Your subscription payment is overdue!
                </p>
                <p className="text-xs text-red-800">
                  Please complete your payment to avoid service suspension.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('subscription')}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Pay Now
              </button>
            </div>
          </div>
        </div>
      )}

      {restaurantInfo?.subscription_status === 'SUSPENDED' && (
        <div className="bg-red-600">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <AlertTriangle size={24} className="text-white flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  Your account has been suspended due to non-payment
                </p>
                <p className="text-xs text-red-100">
                  Your customer store is currently unavailable. Complete payment to restore access.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('subscription')}
                className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
              >
                Restore Access
              </button>
            </div>
          </div>
        </div>
      )}

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

        {restaurantInfo?.subscription_status === 'SUSPENDED' ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <AlertTriangle size={64} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h2>
            <p className="text-gray-600 mb-6">
              Your account is suspended. Please go to the Subscription tab to complete payment and restore access.
            </p>
            <button
              onClick={() => setActiveTab('subscription')}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
            >
              Go to Subscription
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'settings' && <RestaurantSettings />}
            {activeTab === 'products' && <EnhancedProductManagement />}
            {activeTab === 'orders' && <OrderManagement currency={restaurantInfo?.currency} />}
            {/* Temporarily disabled - will enable one by one */}
            {/* {activeTab === 'customers' && <CustomerManagement />} */}
            {/* {activeTab === 'riders' && <RiderManagement />} */}
            {/* {activeTab === 'sales' && <SalesAnalytics currency={restaurantInfo?.currency} />} */}
            {/* {activeTab === 'subscription' && <SubscriptionStatus currency={restaurantInfo?.currency} />} */}
          </>
        )}
      </div>

      {/* Temporarily disabled */}
      {/* <SupportChatPopup /> */}
    </div>
  );
}
