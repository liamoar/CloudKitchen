import { useState, useEffect } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { RestaurantSettings } from '../../lib/database.types';

const daysOfWeek = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function RestaurantSettings() {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    email: '',
    currency: 'INR',
    show_product_image: true,
    enable_stock_management: true,
    enable_categories: false,
    opening_time: {} as Record<string, { open: string; close: string }>,
  });

  useEffect(() => {
    loadRestaurantId();
  }, [user?.id]);

  useEffect(() => {
    if (restaurantId) {
      loadSettings();
    }
  }, [restaurantId]);

  const loadRestaurantId = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) setRestaurantId(data.id);
  };

  const loadSettings = async () => {
    if (!restaurantId) return;

    try {
      let { data } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (!data) {
        const defaultSettings = {
          restaurant_id: restaurantId,
          name: 'My Restaurant',
          address: '',
          city: '',
          phone: '',
          email: '',
          currency: 'INR',
          show_product_image: true,
          enable_stock_management: true,
          enable_categories: false,
          opening_time: daysOfWeek.reduce((acc, day) => ({
            ...acc,
            [day]: { open: '09:00', close: '22:00' },
          }), {}),
        };

        const { data: newData } = await supabase
          .from('restaurant_settings')
          .insert(defaultSettings)
          .select()
          .single();

        data = newData;
      }

      if (data) {
        setSettings(data);
        setFormData({
          name: data.name,
          address: data.address,
          city: data.city,
          phone: data.phone,
          email: data.email,
          currency: data.currency,
          show_product_image: data.show_product_image,
          enable_stock_management: data.enable_stock_management,
          enable_categories: data.enable_categories,
          opening_time: data.opening_time,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!restaurantId || !settings?.id) return;

    setSaving(true);
    setMessage('');

    try {
      const { error } = await supabase
        .from('restaurant_settings')
        .update(formData)
        .eq('id', settings.id)
        .eq('restaurant_id', restaurantId);

      if (error) throw error;
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleOpeningTimeChange = (day: string, field: 'open' | 'close', value: string) => {
    setFormData({
      ...formData,
      opening_time: {
        ...formData.opening_time,
        [day]: {
          ...formData.opening_time[day],
          [field]: value,
        },
      },
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Restaurant Settings</h2>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-800 mb-4">Feature Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_product_image}
                onChange={(e) => setFormData({ ...formData, show_product_image: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Show Product Images</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enable_stock_management}
                onChange={(e) => setFormData({ ...formData, enable_stock_management: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Enable Stock Management</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enable_categories}
                onChange={(e) => setFormData({ ...formData, enable_categories: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Enable Product Categories</span>
            </label>
          </div>
        </div>

        <div className="border-t pt-6">
          <h3 className="font-semibold text-gray-800 mb-4">Opening Hours</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {daysOfWeek.map((day) => (
              <div key={day} className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 w-16 capitalize">{day}</span>
                <input
                  type="time"
                  value={formData.opening_time[day]?.open || '09:00'}
                  onChange={(e) => handleOpeningTimeChange(day, 'open', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="time"
                  value={formData.opening_time[day]?.close || '22:00'}
                  onChange={(e) => handleOpeningTimeChange(day, 'close', e.target.value)}
                  className="flex-1 px-3 py-2 border rounded text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400"
        >
          <Save size={20} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
