import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Layers } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Country {
  id: string;
  name: string;
  currency_symbol: string;
}

interface SubscriptionTier {
  id: string;
  name: string;
  country_id: string;
  price: number;
  days: integer;
  product_limit: number;
  orders_per_month: number;
  storage_limit: number;
  features: any;
  is_active: boolean;
  trial_days: number;
  grace_period_days: number;
  created_at: string;
}

interface TierFormData {
  name: string;
  country_id: string;
  price: string;
  days: string;
  product_limit: string;
  orders_per_month: string;
  storage_limit: string;
  features: string;
  is_active: boolean;
  trial_days: string;
  grace_period_days: string;
}

export function TierManagement() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<TierFormData>({
    name: '',
    country_id: '',
    price: '0',
    days: '30',
    product_limit: '50',
    orders_per_month: '100',
    storage_limit: '1000',
    features: JSON.stringify({
      description: '',
      includes: []
    }, null, 2),
    is_active: true,
    trial_days: '0',
    grace_period_days: '7',
  });

  useEffect(() => {
    loadCountries();
  }, []);

  useEffect(() => {
    if (selectedCountryId) {
      loadTiers();
    }
  }, [selectedCountryId]);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('countries')
        .select('id, name, currency_symbol')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setCountries(data || []);

      if (data && data.length > 0) {
        setSelectedCountryId(data[0].id);
      }
    } catch (err: any) {
      setError('Failed to load countries');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTiers = async () => {
    if (!selectedCountryId) return;

    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('country_id', selectedCountryId)
        .order('price');

      if (error) throw error;
      setTiers(data || []);
    } catch (err: any) {
      setError('Failed to load tiers');
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      let features;
      try {
        features = JSON.parse(formData.features);
      } catch {
        setError('Invalid JSON in features field');
        return;
      }

      const tierData = {
        name: formData.name,
        country_id: formData.country_id || selectedCountryId,
        price: parseFloat(formData.price),
        days: parseInt(formData.days),
        product_limit: parseInt(formData.product_limit),
        orders_per_month: parseInt(formData.orders_per_month),
        storage_limit: parseInt(formData.storage_limit),
        features,
        is_active: formData.is_active,
        trial_days: parseInt(formData.trial_days),
        grace_period_days: parseInt(formData.grace_period_days),
      };

      if (editingTier) {
        const { error } = await supabase
          .from('subscription_tiers')
          .update(tierData)
          .eq('id', editingTier.id);

        if (error) throw error;
        setMessage('Tier updated successfully');
      } else {
        const { error } = await supabase
          .from('subscription_tiers')
          .insert([tierData]);

        if (error) throw error;
        setMessage('Tier created successfully');
      }

      await loadTiers();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save tier');
      console.error(err);
    }
  };

  const handleEdit = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      country_id: tier.country_id,
      price: tier.price.toString(),
      days: tier.days.toString(),
      product_limit: tier.product_limit.toString(),
      orders_per_month: tier.orders_per_month.toString(),
      storage_limit: tier.storage_limit.toString(),
      features: JSON.stringify(tier.features, null, 2),
      is_active: tier.is_active,
      trial_days: tier.trial_days.toString(),
      grace_period_days: tier.grace_period_days.toString(),
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tier? Businesses using this tier may be affected.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage('Tier deleted successfully');
      await loadTiers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete tier');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      country_id: selectedCountryId,
      price: '0',
      days: '30',
      product_limit: '50',
      orders_per_month: '100',
      storage_limit: '1000',
      features: JSON.stringify({
        description: '',
        includes: []
      }, null, 2),
      is_active: true,
      trial_days: '0',
      grace_period_days: '7',
    });
    setEditingTier(null);
    setShowForm(false);
  };

  const selectedCountry = countries.find(c => c.id === selectedCountryId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (countries.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <Layers className="w-16 h-16 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No countries available</p>
        <p className="text-sm text-gray-500 mt-1">Please create a country first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Subscription Tier Management</h2>
          <p className="text-gray-600 mt-1">Manage subscription plans for each country</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Tier
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Country
        </label>
        <select
          value={selectedCountryId}
          onChange={(e) => setSelectedCountryId(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name} ({country.currency_symbol})
            </option>
          ))}
        </select>
      </div>

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {editingTier ? 'Edit Tier' : 'Add New Tier'}
            </h3>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tier Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Basic, Pro, Enterprise"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price ({selectedCountry?.currency_symbol}) *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (Days) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.days}
                  onChange={(e) => setFormData({ ...formData, days: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Trial Days *
                </label>
                <input
                  type="number"
                  required
                  value={formData.trial_days}
                  onChange={(e) => setFormData({ ...formData, trial_days: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grace Period (Days) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.grace_period_days}
                  onChange={(e) => setFormData({ ...formData, grace_period_days: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Limit *
                </label>
                <input
                  type="number"
                  required
                  value={formData.product_limit}
                  onChange={(e) => setFormData({ ...formData, product_limit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orders Per Month *
                </label>
                <input
                  type="number"
                  required
                  value={formData.orders_per_month}
                  onChange={(e) => setFormData({ ...formData, orders_per_month: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Storage Limit (MB) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.storage_limit}
                  onChange={(e) => setFormData({ ...formData, storage_limit: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Features (JSON) *
              </label>
              <textarea
                required
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                rows={6}
                placeholder='{"description": "Plan description", "includes": ["Feature 1", "Feature 2"]}'
              />
              <p className="text-xs text-gray-500 mt-1">Must be valid JSON format</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                Active (visible to users)
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={20} />
                {editingTier ? 'Update Tier' : 'Create Tier'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {tiers.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Layers className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No tiers for this country yet</p>
            <p className="text-sm text-gray-500 mt-1">Add your first subscription tier</p>
          </div>
        ) : (
          tiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        tier.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {tier.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedCountry?.currency_symbol}{tier.price}
                    <span className="text-sm text-gray-500 font-normal"> / {tier.days} days</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(tier)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(tier.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                <div>
                  <span className="text-gray-600">Products:</span>
                  <p className="font-semibold text-gray-900">{tier.product_limit}</p>
                </div>
                <div>
                  <span className="text-gray-600">Orders/Month:</span>
                  <p className="font-semibold text-gray-900">{tier.orders_per_month}</p>
                </div>
                <div>
                  <span className="text-gray-600">Trial Days:</span>
                  <p className="font-semibold text-gray-900">{tier.trial_days}</p>
                </div>
                <div>
                  <span className="text-gray-600">Grace Period:</span>
                  <p className="font-semibold text-gray-900">{tier.grace_period_days} days</p>
                </div>
              </div>

              {tier.features?.description && (
                <p className="text-sm text-gray-600 mb-2">{tier.features.description}</p>
              )}

              {tier.features?.includes && Array.isArray(tier.features.includes) && (
                <ul className="text-sm text-gray-700 space-y-1">
                  {tier.features.includes.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
