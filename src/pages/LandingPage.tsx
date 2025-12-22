import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Package, TrendingUp, Shield, Zap, Globe, CheckCircle, Truck, BarChart, Clock, Users, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateSubdomain, buildSubdomainUrl } from '../lib/utils';

interface SubscriptionTier {
  id: string;
  name: string;
  monthly_price: number;
  product_limit: number;
  order_limit_per_month: number;
  storage_limit_mb: number;
}

export function LandingPage() {
  const navigate = useNavigate();
  const [showSignup, setShowSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('AE');

  const [formData, setFormData] = useState({
    businessName: '',
    subdomain: '',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    country: 'AE',
    city: '',
    tier: 'Basic'
  });

  const [subdomainError, setSubdomainError] = useState('');
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  useEffect(() => {
    loadTiers();
  }, [selectedCountry]);

  const loadTiers = async () => {
    const { data } = await supabase
      .from('subscription_tiers')
      .select('*')
      .eq('country', selectedCountry)
      .eq('is_active', true)
      .order('monthly_price');

    if (data) {
      setTiers(data);
    }
  };

  const getCurrencySymbol = (country: string) => {
    switch (country) {
      case 'AE': return 'AED';
      case 'US': return 'USD';
      case 'GB': return 'GBP';
      case 'EU': return 'EUR';
      case 'IN': return 'INR';
      case 'NP': return 'NPR';
      default: return 'USD';
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
        .from('restaurants')
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

      const slug = formData.subdomain;

      const { data: owner, error: ownerError } = await supabase
        .from('users')
        .insert({
          role: 'RESTRO_OWNER',
          name: formData.ownerName,
          phone: formData.phone,
          email: formData.email,
          password: formData.password
        })
        .select()
        .single();

      if (ownerError) throw ownerError;

      const selectedTier = tiers.find(t => t.name === formData.tier);

      const { data: config } = await supabase
        .from('subscription_configs')
        .select('trial_days, currency')
        .eq('country', formData.country)
        .maybeSingle();

      const trialDays = config?.trial_days || 15;
      const currency = config?.currency || getCurrencySymbol(formData.country);
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);

      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .insert({
          name: formData.businessName,
          slug: slug,
          subdomain: formData.subdomain.toLowerCase(),
          owner_id: owner.id,
          currency: currency,
          country: formData.country,
          status: 'TRIAL',
          trial_end_date: trialEndDate.toISOString(),
          tier_id: selectedTier?.id
        })
        .select()
        .single();

      if (restError) throw restError;

      await supabase.from('restaurant_settings').insert({
        user_id: owner.id,
        restaurant_id: restaurant.id,
        name: formData.businessName,
        address: '',
        city: formData.city,
        phone: formData.phone,
        email: formData.email,
        currency: currency,
        enable_categories: true
      });

      const categories = [
        { name: 'Featured', description: 'Featured items', display_order: 1 },
        { name: 'Popular', description: 'Popular items', display_order: 2 },
        { name: 'New Arrivals', description: 'New items', display_order: 3 },
        { name: 'Special Offers', description: 'Special deals', display_order: 4 }
      ];

      for (const cat of categories) {
        await supabase.from('product_categories').insert({
          user_id: owner.id,
          restaurant_id: restaurant.id,
          ...cat
        });
      }

      localStorage.setItem('user', JSON.stringify(owner));
      window.location.href = buildSubdomainUrl(formData.subdomain, '/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: Store,
      title: 'Multi-Business Support',
      description: 'Perfect for restaurants, cafes, retail stores, and e-commerce businesses'
    },
    {
      icon: Package,
      title: 'Product Management',
      description: 'Easily manage your inventory with categories, pricing, and stock tracking'
    },
    {
      icon: Truck,
      title: 'Delivery Management',
      description: 'Built-in rider management and real-time order tracking for customers'
    },
    {
      icon: BarChart,
      title: 'Sales Analytics',
      description: 'Track revenue, orders, and performance with detailed analytics'
    },
    {
      icon: Clock,
      title: 'Real-time Updates',
      description: 'Live order notifications and status updates for seamless operations'
    },
    {
      icon: Users,
      title: 'Customer Experience',
      description: 'Beautiful storefront with order tracking and multiple payment options'
    }
  ];

  const countryOptions = [
    { code: 'AE', name: 'UAE', currency: 'AED' },
    { code: 'NP', name: 'Nepal', currency: 'NPR' },
    { code: 'IN', name: 'India', currency: 'INR' },
    { code: 'US', name: 'USA', currency: 'USD' },
    { code: 'GB', name: 'UK', currency: 'GBP' },
    { code: 'EU', name: 'Europe', currency: 'EUR' }
  ];

  if (showSignup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <nav className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-2">
              <Store className="text-emerald-600" size={32} />
              <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">OrderFlow</span>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-xl shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Start Your Business Online</h2>
            <p className="text-gray-600 mb-6">Join hundreds of businesses already using OrderFlow</p>

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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Your Business Name"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Your Business URL
                </label>
                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-transparent">
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
                    .yourdomain.com
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
                    Available! Your store will be at: {formData.subdomain}.yourdomain.com
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Choose a unique subdomain for your business (3-63 characters, lowercase letters, numbers, and hyphens only)
                </p>
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    value={formData.country}
                    onChange={(e) => {
                      setFormData({ ...formData, country: e.target.value });
                      setSelectedCountry(e.target.value);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {countryOptions.map(opt => (
                      <option key={opt.code} value={opt.code}>{opt.name} ({opt.currency})</option>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Your City"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Subscription Tier
                </label>
                <select
                  value={formData.tier}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="Basic">Basic Tier</option>
                  <option value="Premium">Premium Tier</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Min. 6 characters"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !!subdomainError || checkingSubdomain || formData.subdomain.length < 3}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white py-4 rounded-lg font-semibold text-lg transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Start Free Trial'}
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <nav className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Store className="text-emerald-600" size={32} />
              <span className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">OrderFlow</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/backend-system')}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                Admin Portal
              </button>
              <button
                onClick={() => setShowSignup(true)}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-all shadow-md"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-block mb-6">
            <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-semibold">
              All-in-One Business Management Platform
            </span>
          </div>
          <h1 className="text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Grow Your Business<br />
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
              Online in Minutes
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            Complete solution for restaurants, cafes, retail stores, and e-commerce businesses.
            Manage orders, inventory, delivery riders, and track everything in real-time.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => setShowSignup(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Start Free Trial
            </button>
            <a
              href="#pricing"
              className="bg-white hover:bg-gray-50 text-gray-900 px-8 py-4 rounded-lg text-lg font-semibold transition-all shadow-md border-2 border-gray-200"
            >
              View Pricing
            </a>
          </div>
          <p className="text-sm text-gray-500 mt-6">
            <CheckCircle className="inline w-4 h-4 text-emerald-600" /> 15-day free trial • No credit card required • Cancel anytime
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 shadow-md hover:shadow-xl transition-all border border-gray-100 hover:border-emerald-200 transform hover:-translate-y-1"
            >
              <div className="bg-gradient-to-br from-emerald-100 to-teal-100 w-14 h-14 rounded-lg flex items-center justify-center mb-5">
                <feature.icon className="text-emerald-600" size={28} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-gray-600 mb-8">Choose the plan that fits your business needs</p>

          <div className="inline-flex items-center gap-3 bg-white px-4 py-2 rounded-lg shadow-md">
            <Globe size={20} className="text-emerald-600" />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-transparent border-0 text-gray-900 font-medium focus:ring-0 cursor-pointer"
            >
              {countryOptions.map(opt => (
                <option key={opt.code} value={opt.code}>{opt.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className={`bg-white rounded-2xl p-8 shadow-lg border-2 ${
                tier.name === 'Premium'
                  ? 'border-emerald-500 relative transform scale-105'
                  : 'border-gray-200'
              }`}
            >
              {tier.name === 'Premium' && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                <div className="flex items-baseline justify-center gap-2 mb-4">
                  <span className="text-5xl font-bold text-gray-900">{tier.monthly_price}</span>
                  <span className="text-xl text-gray-600">{getCurrencySymbol(selectedCountry)}</span>
                  <span className="text-gray-500">/month</span>
                </div>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">
                    <strong>{tier.product_limit === -1 ? 'Unlimited' : tier.product_limit}</strong> Products
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">
                    <strong>{tier.order_limit_per_month === -1 ? 'Unlimited' : tier.order_limit_per_month}</strong> Orders per month
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">
                    <strong>{tier.storage_limit_mb >= 1024 ? `${tier.storage_limit_mb / 1024}GB` : `${tier.storage_limit_mb}MB`}</strong> Storage
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Delivery rider management</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Real-time order tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Sales analytics & reports</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                  <span className="text-gray-700">Multi-currency support</span>
                </li>
                {tier.name === 'Premium' && (
                  <li className="flex items-start gap-3">
                    <CheckCircle className="text-emerald-600 flex-shrink-0 mt-0.5" size={20} />
                    <span className="text-gray-700">Priority support</span>
                  </li>
                )}
              </ul>

              <button
                onClick={() => {
                  setFormData({ ...formData, tier: tier.name });
                  setShowSignup(true);
                }}
                className={`w-full py-4 rounded-lg font-semibold text-lg transition-all shadow-md hover:shadow-lg ${
                  tier.name === 'Premium'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white'
                    : 'bg-gray-900 hover:bg-gray-800 text-white'
                }`}
              >
                Start Free Trial
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 mt-8">
          All plans include a 15-day free trial. No credit card required.
        </p>
      </section>

      <section className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Business?</h2>
          <p className="text-xl mb-10 opacity-90">
            Join hundreds of businesses managing orders, inventory, and deliveries with OrderFlow
          </p>
          <button
            onClick={() => setShowSignup(true)}
            className="bg-white text-emerald-600 hover:bg-gray-50 px-10 py-4 rounded-lg text-lg font-semibold transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
          >
            Start Your Free Trial
          </button>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <Store size={24} />
              <span className="text-xl font-bold">OrderFlow</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2024 OrderFlow. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
