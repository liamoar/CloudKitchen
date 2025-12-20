import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Sparkles, TrendingUp, Shield, Zap, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function LandingPage() {
  const navigate = useNavigate();
  const [showSignup, setShowSignup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    restaurantName: '',
    ownerName: '',
    phone: '',
    email: '',
    password: '',
    country: 'AE',
    city: ''
  });

  const features = [
    {
      icon: Sparkles,
      title: 'Easy Menu Management',
      description: 'Create and manage your menu with categories, products, and pricing in minutes'
    },
    {
      icon: TrendingUp,
      title: 'Real-time Orders',
      description: 'Receive and manage orders instantly with our intuitive dashboard'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Your data is protected with enterprise-grade security'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Optimized for speed to ensure smooth operations during peak hours'
    },
    {
      icon: Globe,
      title: 'Multi-Currency Support',
      description: 'Support for AED, USD, EUR, GBP, INR, and NPR currencies'
    },
    {
      icon: ShoppingBag,
      title: 'Customer Portal',
      description: 'Give your customers a beautiful online ordering experience'
    }
  ];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const slug = `r${Date.now()}-${formData.restaurantName.toLowerCase().replace(/\s+/g, '-')}`;

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

      const { data: config } = await supabase
        .from('subscription_configs')
        .select('trial_days, currency')
        .eq('country', formData.country)
        .maybeSingle();

      const trialDays = config?.trial_days || 15;
      const currency = config?.currency || 'USD';
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + trialDays);

      const { data: restaurant, error: restError } = await supabase
        .from('restaurants')
        .insert({
          name: formData.restaurantName,
          slug: slug,
          owner_id: owner.id,
          currency: currency,
          country: formData.country,
          status: 'TRIAL',
          trial_end_date: trialEndDate.toISOString()
        })
        .select()
        .single();

      if (restError) throw restError;

      await supabase.from('restaurant_settings').insert({
        user_id: owner.id,
        restaurant_id: restaurant.id,
        name: formData.restaurantName,
        address: '',
        city: formData.city,
        phone: formData.phone,
        email: formData.email,
        currency: currency,
        enable_categories: true
      });

      const categories = [
        { name: 'Appetizers', description: 'Delicious starters', display_order: 1 },
        { name: 'Main Course', description: 'Hearty main dishes', display_order: 2 },
        { name: 'Beverages', description: 'Refreshing drinks', display_order: 3 },
        { name: 'Desserts', description: 'Sweet treats', display_order: 4 }
      ];

      for (const cat of categories) {
        await supabase.from('product_categories').insert({
          user_id: owner.id,
          restaurant_id: restaurant.id,
          ...cat
        });
      }

      localStorage.setItem('user', JSON.stringify(owner));
      navigate(`/${slug}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create restaurant');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShoppingBag className="text-blue-600" size={32} />
              <span className="text-2xl font-bold text-gray-900">RestaurantOS</span>
            </div>
            <button
              onClick={() => navigate('/backend-system')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Admin
            </button>
          </div>
        </div>
      </nav>

      {!showSignup ? (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              Manage Your Restaurant with Ease
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Complete online ordering solution for restaurants. Get started with a 15-day free trial,
              then continue for just 60 AED/month.
            </p>
            <button
              onClick={() => setShowSignup(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors shadow-lg"
            >
              Start Your Free Trial
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow"
              >
                <feature.icon className="text-blue-600 mb-4" size={32} />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-600 text-white rounded-lg p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-xl mb-6">Join restaurants already using RestaurantOS</p>
            <button
              onClick={() => setShowSignup(true)}
              className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
            >
              Create Your Restaurant
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Your Restaurant</h2>
            <p className="text-gray-600 mb-6">Start your 15-day free trial today</p>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.restaurantName}
                  onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <select
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AE">UAE (AED)</option>
                    <option value="NP">Nepal (NPR)</option>
                    <option value="IN">India (INR)</option>
                    <option value="US">USA (USD)</option>
                    <option value="GB">UK (GBP)</option>
                    <option value="EU">Europe (EUR)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Restaurant'}
              </button>

              <button
                type="button"
                onClick={() => setShowSignup(false)}
                className="w-full text-gray-600 hover:text-gray-900 py-2"
              >
                Back
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
