import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, Package, TrendingUp, Shield, Globe, CheckCircle,
  Truck, BarChart, Clock, Users, CreditCard, ShoppingCart,
  MapPin, Bell, Smartphone, Target, ArrowRight, Star,
  Layout, Settings, Eye, EyeOff, MessageSquare
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateSubdomain, buildSubdomainUrl } from '../lib/utils';

interface Country {
  id: string;
  name: string;
  slug: string;
  short_name: string;
  currency: string;
  currency_symbol: string;
}

interface SubscriptionTier {
  id: string;
  name: string;
  country_id: string;
  price: number;
  days: number;
  product_limit: number;
  orders_per_month: number;
  storage_limit: number;
  features: {
    includes?: string[];
    description?: string;
  };
  trial_days: number;
}

export function LandingPage() {
  const navigate = useNavigate();
  const [showSignup, setShowSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [redirectUrl, setRedirectUrl] = useState('');

  const [formData, setFormData] = useState({
    businessName: '',
    subdomain: '',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    countryId: '',
    city: '',
    tierId: ''
  });

  const [subdomainError, setSubdomainError] = useState('');
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    if (selectedCountry) {
      loadTiers(selectedCountry.id);
    }
  }, [selectedCountry]);

  const loadCountries = async () => {
    const { data } = await supabase
      .from('countries')
      .select('*')
      .eq('status', 'active')
      .order('name');

    if (data && data.length > 0) {
      setCountries(data);
      detectCountryByIP(data);
    }
  };

  const detectCountryByIP = async (availableCountries: Country[]) => {
    const getDefaultCountry = () => {
      const uaeCountry = availableCountries.find(
        c => c.short_name.toUpperCase() === 'UAE' || c.short_name.toUpperCase() === 'AE'
      );
      return uaeCountry || availableCountries[0];
    };

    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();

      if (data.country_code) {
        const detectedCode = data.country_code.toUpperCase();
        const matchedCountry = availableCountries.find(
          c => c.short_name.toUpperCase() === detectedCode
        );

        if (matchedCountry) {
          setSelectedCountry(matchedCountry);
          setFormData(prev => ({ ...prev, countryId: matchedCountry.id }));
        } else {
          const defaultCountry = getDefaultCountry();
          setSelectedCountry(defaultCountry);
          setFormData(prev => ({ ...prev, countryId: defaultCountry.id }));
        }
      } else {
        const defaultCountry = getDefaultCountry();
        setSelectedCountry(defaultCountry);
        setFormData(prev => ({ ...prev, countryId: defaultCountry.id }));
      }
    } catch (error) {
      console.error('Error detecting country:', error);
      const defaultCountry = getDefaultCountry();
      setSelectedCountry(defaultCountry);
      setFormData(prev => ({ ...prev, countryId: defaultCountry.id }));
    }
  };

  const loadTiers = async (countryId: string) => {
    const { data } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('country_id', countryId)
      .eq('is_active', true)
      .order('price');

    if (data) {
      setTiers(data);
      if (data.length > 0 && !formData.tierId) {
        setFormData(prev => ({ ...prev, tierId: data[0].id }));
      }
    }
  };

  const checkSubdomainAvailability = async (subdomain: string) => {
    const validation = validateSubdomain(subdomain);
    if (!validation.valid) {
      setSubdomainError(validation.message || 'Invalid subdomain');
      return false;
    }

    setCheckingSubdomain(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id')
        .eq('subdomain', subdomain.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error('Error checking subdomain:', error);
        setSubdomainError('Error checking availability');
        return false;
      }

      if (data) {
        setSubdomainError('This subdomain is already taken');
        return false;
      }

      setSubdomainError('');
      return true;
    } catch (err) {
      setSubdomainError('Error checking availability');
      return false;
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const handleSubdomainChange = async (value: string) => {
    const lowercase = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setFormData({ ...formData, subdomain: lowercase });

    if (lowercase.length >= 3) {
      await checkSubdomainAvailability(lowercase);
    } else if (lowercase.length > 0) {
      setSubdomainError('Subdomain must be at least 3 characters');
    } else {
      setSubdomainError('');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.subdomain) {
        setError('Please enter a subdomain for your business');
        setLoading(false);
        return;
      }

      const isAvailable = await checkSubdomainAvailability(formData.subdomain);
      if (!isAvailable) {
        setError(subdomainError || 'Subdomain is not available');
        setLoading(false);
        return;
      }

      if (!formData.countryId || !formData.tierId) {
        setError('Please select a country and subscription plan');
        setLoading(false);
        return;
      }

      const slug = formData.subdomain;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.ownerName,
            phone: formData.phone,
            role: 'RESTRO_OWNER',
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('This email is already registered. Please use a different email or try logging in.');
        }
        throw authError;
      }
      if (!authData.user) throw new Error('Failed to create account');

      let owner = null;
      let retries = 0;
      const maxRetries = 5;

      while (!owner && retries < maxRetries) {
        const { data } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (data) {
          owner = data;
        } else {
          retries++;
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      if (!owner) throw new Error('Failed to create user profile. Please contact support.');

      const selectedTier = tiers.find(t => t.id === formData.tierId);
      if (!selectedTier) throw new Error('Invalid subscription plan selected');

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + selectedTier.trial_days);

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: formData.businessName,
          slug: slug,
          subdomain: formData.subdomain.toLowerCase(),
          owner_id: owner.id,
          country_id: formData.countryId,
          subscription_tier_id: formData.tierId,
          status: 'trial',
          trial_ends_at: trialEndDate.toISOString()
        })
        .select()
        .single();

      if (businessError) throw businessError;

      const targetUrl = buildSubdomainUrl(formData.subdomain.toLowerCase(), '/admin');
      setRedirectUrl(targetUrl);
      setShowLoadingScreen(true);
      setLoading(false);

      const steps = [0, 1, 2, 3];
      const stepDelay = 3750;

      steps.forEach((step, index) => {
        setTimeout(() => {
          setLoadingStep(step);
        }, index * stepDelay);
      });

      setTimeout(() => {
        window.location.href = targetUrl;
      }, 15000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setLoading(false);
    }
  };


  const features = [
    {
      icon: ShoppingCart,
      title: 'Beautiful Online Storefront',
      description: 'Professional-looking store with your custom domain. No design skills needed.',
      image: 'storefront'
    },
    {
      icon: Package,
      title: 'Smart Product Management',
      description: 'Add products, set prices, manage inventory. Organize with categories and bundles.',
      image: 'products'
    },
    {
      icon: Bell,
      title: 'Real-time Order Management',
      description: 'Live order notifications. Update status instantly. Track every order from placement to delivery.',
      image: 'orders'
    },
    {
      icon: Users,
      title: 'Customer Insights',
      description: 'Know your customers. Track order history, identify VIPs, and build relationships.',
      image: 'customers'
    },
    {
      icon: Truck,
      title: 'Delivery Rider Management',
      description: 'Manage your delivery team. Assign orders. Track deliveries in real-time.',
      image: 'riders'
    },
    {
      icon: Eye,
      title: 'Customer Order Tracking',
      description: 'Customers get unique tracking links. They see real-time order status updates.',
      image: 'tracking'
    },
    {
      icon: BarChart,
      title: 'Sales Analytics Dashboard',
      description: 'Track revenue, top products, order trends. Make data-driven decisions.',
      image: 'analytics'
    },
    {
      icon: CreditCard,
      title: 'Flexible Payment Options',
      description: 'Support Cash on Delivery and Bank Transfer. Confirm payments easily.',
      image: 'payments'
    }
  ];

  const benefits = [
    {
      icon: Zap,
      title: '2-3 Minutes Setup',
      description: 'No lengthy forms. No paperwork. Just basic info and you\'re live.'
    },
    {
      icon: Globe,
      title: 'Custom Domain Included',
      description: 'Your business gets its own professional URL: yourbusiness.hejo.app'
    },
    {
      icon: Shield,
      title: 'No Business Registration Required',
      description: 'Start immediately. Perfect for individuals and small businesses starting out.'
    },
    {
      icon: TrendingUp,
      title: 'No Hidden Charges',
      description: 'Transparent pricing. What you see is what you pay. No surprises.'
    },
    {
      icon: Clock,
      title: 'Launch in Minutes',
      description: 'Add products, configure settings, and go live. It\'s that simple.'
    },
    {
      icon: Target,
      title: 'Production Ready',
      description: 'Built for real businesses. Handle real orders from day one.'
    }
  ];

  if (showLoadingScreen) {
    const loadingSteps = [
      { icon: CheckCircle, title: 'Creating Your Account', description: 'Setting up your business profile' },
      { icon: Globe, title: 'Activating Your Storefront', description: 'Configuring your custom domain' },
      { icon: Layout, title: 'Preparing Your Dashboard', description: 'Setting up your admin panel' },
      { icon: Zap, title: 'Ready to Launch!', description: 'Redirecting to your business dashboard' }
    ];

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 border border-blue-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Zap className="text-white" size={32} />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Setting Up Your Business</h2>
            <p className="text-gray-600">Please wait while we prepare everything for you</p>
          </div>

          <div className="space-y-6">
            {loadingSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = loadingStep > index;
              const isCurrent = loadingStep === index;
              const isPending = loadingStep < index;

              return (
                <div
                  key={index}
                  className={`flex items-start gap-4 p-4 rounded-lg transition-all ${
                    isCompleted ? 'bg-green-50 border border-green-200' :
                    isCurrent ? 'bg-blue-50 border border-blue-200 animate-pulse' :
                    'bg-gray-50 border border-gray-200 opacity-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isCompleted ? 'bg-green-500' :
                    isCurrent ? 'bg-blue-500 animate-spin' :
                    'bg-gray-300'
                  }`}>
                    <StepIcon className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg ${
                      isCompleted ? 'text-green-900' :
                      isCurrent ? 'text-blue-900' :
                      'text-gray-500'
                    }`}>
                      {step.title}
                    </h3>
                    <p className={`text-sm ${
                      isCompleted ? 'text-green-700' :
                      isCurrent ? 'text-blue-700' :
                      'text-gray-500'
                    }`}>
                      {step.description}
                    </p>
                  </div>
                  {isCompleted && (
                    <CheckCircle className="text-green-500 flex-shrink-0" size={24} />
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 text-center">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {loadingStep === loadingSteps.length - 1
                ? 'Redirecting now...'
                : `Step ${loadingStep + 1} of ${loadingSteps.length}`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (showSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10 border-b border-blue-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">hejo.app</span>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-blue-100">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Launch Your Business Online</h2>
            <p className="text-gray-600 mb-6">Complete the form below and go live in 2 minutes</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Business Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your Business Name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Your Business URL
                </label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                  <input
                    type="text"
                    required
                    value={formData.subdomain}
                    onChange={(e) => handleSubdomainChange(e.target.value)}
                    className="flex-1 px-4 py-3 border-0 focus:ring-0"
                    placeholder="mybusiness"
                    minLength={3}
                    maxLength={63}
                    pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
                  />
                  <span className="px-4 py-3 bg-gray-100 text-gray-600 text-sm whitespace-nowrap border-l">
                    .hejo.app
                  </span>
                </div>
                {checkingSubdomain && (
                  <p className="text-sm text-blue-600 mt-1">Checking availability...</p>
                )}
                {subdomainError && (
                  <p className="text-sm text-red-600 mt-1">{subdomainError}</p>
                )}
                {!subdomainError && formData.subdomain.length >= 3 && !checkingSubdomain && (
                  <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={14} />
                    Available! Your store will be at: {formData.subdomain}.hejo.app
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your Full Name"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+123456789"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    value={formData.countryId}
                    onChange={(e) => {
                      const country = countries.find(c => c.id === e.target.value);
                      if (country) {
                        setFormData({ ...formData, countryId: e.target.value, tierId: '' });
                        setSelectedCountry(country);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {countries.map(country => (
                      <option key={country.id} value={country.id}>
                        {country.name} ({country.currency_symbol})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Your City"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Subscription Plan
                </label>
                <select
                  value={formData.tierId}
                  onChange={(e) => setFormData({ ...formData, tierId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select a plan</option>
                  {tiers.map(tier => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} - {selectedCountry?.currency_symbol}{tier.price}/{tier.days} days
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                    placeholder="Min. 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !!subdomainError || checkingSubdomain || formData.subdomain.length < 3 || !formData.tierId}
                className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white py-4 rounded-lg font-semibold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Your Business...' : 'Launch My Business'}
              </button>

              <button
                type="button"
                onClick={() => setShowSignup(false)}
                className="w-full text-gray-600 hover:text-gray-900 py-2 font-medium"
              >
                Back to Home
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-10 border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">hejo.app</span>
            </div>
            <button
              onClick={() => setShowSignup(true)}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-block mb-6">
            <span className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-200">
              No Business License • No Paperwork • No Hidden Fees
            </span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Launch Your Store<br />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              In 2-3 Minutes
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Complete business management system for restaurants, cafes, retail stores.
            <strong className="text-gray-900"> No registration hassles. No payment upfront. No complexity.</strong><br />
            Just sign up and start selling with your own custom domain.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => setShowSignup(true)}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
            >
              Start Free - No Credit Card
              <ArrowRight size={20} />
            </button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-600" size={18} />
              <span>Free trial included</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-600" size={18} />
              <span>Setup in 2-3 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-600" size={18} />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Businesses Choose hejo.app
          </h2>
          <p className="text-lg text-gray-600">Perfect for those starting out without the bureaucracy</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 shadow-md hover:shadow-xl transition-all border border-blue-100 hover:border-blue-300"
            >
              <div className="bg-gradient-to-br from-blue-100 to-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
                <benefit.icon className="text-blue-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {benefit.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Run Your Business
          </h2>
          <p className="text-lg text-gray-600">Powerful features that work together seamlessly</p>
        </div>

        <div className="space-y-24">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 items-center`}
            >
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold mb-4 border border-blue-200">
                  <feature.icon size={16} />
                  Feature #{index + 1}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  {feature.title}
                </h3>
                <p className="text-lg text-gray-600 leading-relaxed mb-6">
                  {feature.description}
                </p>
                <button
                  onClick={() => setShowSignup(true)}
                  className="text-blue-600 font-semibold hover:text-blue-700 flex items-center gap-2"
                >
                  Get started with this feature
                  <ArrowRight size={18} />
                </button>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl p-8 border-2 border-blue-200 shadow-xl min-h-[300px] flex items-center justify-center">
                  <div className="text-center">
                    <feature.icon className="text-blue-600 mx-auto mb-4" size={64} />
                    <p className="text-gray-600 font-medium">{feature.title}</p>
                    <p className="text-sm text-gray-500 mt-2">Live system feature preview</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-12 text-white text-center shadow-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Perfect for Small Businesses</h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Whether you're a restaurant, cafe, bakery, grocery store, or retail shop -
            if you want a proper system without the hassle, hejo.app is for you.
          </p>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">2-3 min</div>
              <div className="text-sm opacity-90">Setup Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">$0</div>
              <div className="text-sm opacity-90">Upfront Cost</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">0</div>
              <div className="text-sm opacity-90">Hidden Fees</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold mb-1">100%</div>
              <div className="text-sm opacity-90">Hassle-Free</div>
            </div>
          </div>
          <button
            onClick={() => setShowSignup(true)}
            className="bg-white text-blue-600 hover:bg-gray-100 px-10 py-4 rounded-lg text-lg font-semibold transition-all shadow-xl inline-flex items-center gap-2"
          >
            Launch Your Business Now
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-lg text-gray-600 mb-8">No hidden charges. Pay only for what you use.</p>

          <div className="inline-flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-md border border-blue-100">
            <Globe size={20} className="text-blue-600" />
            <select
              value={selectedCountry?.id || ''}
              onChange={(e) => {
                const country = countries.find(c => c.id === e.target.value);
                if (country) setSelectedCountry(country);
              }}
              className="bg-transparent border-0 text-gray-900 font-medium focus:ring-0 cursor-pointer"
            >
              {countries.map(country => (
                <option key={country.id} value={country.id}>{country.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className={`bg-white rounded-2xl p-8 shadow-xl border-2 ${
                index === tiers.length - 1
                  ? 'border-blue-500 relative transform scale-105'
                  : 'border-gray-200'
              }`}
            >
              {index === tiers.length - 1 && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-5xl font-bold text-gray-900">{tier.price}</span>
                  <span className="text-xl text-gray-600">{selectedCountry?.currency_symbol}</span>
                  <span className="text-gray-500">/{tier.days} days</span>
                </div>
                <p className="text-sm text-gray-500">{tier.trial_days} days free trial</p>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">
                    <strong>{tier.product_limit === -1 ? 'Unlimited' : tier.product_limit}</strong> Products
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">
                    <strong>{tier.orders_per_month === -1 ? 'Unlimited' : tier.orders_per_month}</strong> Orders per month
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">
                    <strong>{tier.storage_limit >= 1024 ? `${tier.storage_limit / 1024}GB` : `${tier.storage_limit}MB`}</strong> Storage
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Custom subdomain</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Delivery rider management</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Real-time order tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Customer management</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Sales analytics & reports</span>
                </li>
                {tier.features?.includes && tier.features.includes.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
                {index === tiers.length - 1 && (
                  <li className="flex items-start gap-3">
                    <Star className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                    <span className="text-gray-700 font-semibold">Best value for growing businesses</span>
                  </li>
                )}
              </ul>

              <button
                onClick={() => {
                  setFormData({ ...formData, tierId: tier.id });
                  setShowSignup(true);
                }}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg ${
                  index === tiers.length - 1
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                Start Free Trial
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 mt-12 text-lg">
          <strong>Free trial</strong> on all plans. No credit card required. Cancel anytime.
        </p>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <Zap className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold">hejo.app</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2024 hejo.app. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
