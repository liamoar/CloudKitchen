import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSubdomain } from '../lib/utils';
import { supabase } from '../lib/supabase';

export function RestaurantLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [businessName, setBusinessName] = useState<string | null>(null);

  useEffect(() => {
    loadBusinessName();
  }, []);

  const loadBusinessName = async () => {
    const subdomain = getSubdomain();
    if (!subdomain) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (restaurant) {
      setBusinessName(restaurant.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(phone, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-center mb-6">
            <Store size={48} className="text-orange-600" />
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">
            {businessName ? `${businessName}` : 'Restaurant Admin Login'}
          </h2>
          <p className="text-center text-gray-600 mb-6">
            {businessName ? 'Sign in to manage your dashboard' : 'Sign in to manage your restaurant'}
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="+1234567891"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 font-semibold mb-2">Demo Restaurant Credentials:</p>
            <p className="text-xs text-gray-600">Phone: +1234567891</p>
            <p className="text-xs text-gray-600">Password: owner123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
