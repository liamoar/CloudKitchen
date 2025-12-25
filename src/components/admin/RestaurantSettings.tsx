import { useState, useEffect } from 'react';
import { Save, AlertCircle, Plus, Trash2, Eye, EyeOff, KeyRound, Upload, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, type DeliveryFeeTier } from '../../lib/utils';
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
    enable_multiple_sku: false,
    opening_time: {} as Record<string, { open: string; close: string }>,
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    bank_qr_code_url: '',
  });

  const [minimumOrderAmount, setMinimumOrderAmount] = useState<number>(0);
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState<DeliveryFeeTier[]>([]);

  const [showCredentialsSection, setShowCredentialsSection] = useState(false);
  const [credentialsData, setCredentialsData] = useState({
    email: '',
    phone: '',
    newPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsMessage, setCredentialsMessage] = useState('');
  const [uploadingQR, setUploadingQR] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

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
    const { data: businessData } = await supabase
      .from('businesses')
      .select('id, countries!inner(currency_symbol)')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (businessData) {
      setRestaurantId(businessData.id);

      const { data: settingsData } = await supabase
        .from('business_settings')
        .select('minimum_order_value, delivery_charges')
        .eq('business_id', businessData.id)
        .maybeSingle();

      if (settingsData) {
        setMinimumOrderAmount(settingsData.minimum_order_value || 0);
        setDeliveryFeeTiers(settingsData.delivery_charges || []);
      }

      if (businessData.countries?.currency_symbol) {
        setFormData(prev => ({ ...prev, currency: businessData.countries.currency_symbol }));
      }
    }
  };

  const loadSettings = async () => {
    if (!restaurantId) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('email, phone')
        .eq('id', user?.id)
        .maybeSingle();

      if (userData) {
        setCredentialsData({
          email: userData.email || '',
          phone: userData.phone || '',
          newPassword: ''
        });
      }

      const { data: businessData } = await supabase
        .from('businesses')
        .select('name, address, city')
        .eq('id', restaurantId)
        .maybeSingle();

      let { data } = await supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', restaurantId)
        .maybeSingle();

      if (!data) {
        const defaultSettings = {
          business_id: restaurantId,
          support_email: '',
          support_phone: '',
          address: businessData?.address || '',
          city: businessData?.city || '',
          show_product_images: true,
          enable_stock_management: true,
          enable_categories: false,
          enable_multiple_sku: false,
          opening_hours: daysOfWeek.reduce((acc, day) => ({
            ...acc,
            [day]: { open: '09:00', close: '22:00' },
          }), {}),
          minimum_order_value: 0,
          delivery_charges: [],
        };

        const { data: newData } = await supabase
          .from('business_settings')
          .insert(defaultSettings)
          .select()
          .single();

        data = newData;
      }

      if (data) {
        setSettings(data);
        setMinimumOrderAmount(data.minimum_order_value || 0);
        setDeliveryFeeTiers(data.delivery_charges || []);
        setQrPreview(data.qr_code_url || null);
        setFormData(prev => ({
          ...prev,
          name: businessData?.name || 'My Business',
          address: data.address || '',
          city: data.city || '',
          phone: data.support_phone || '',
          email: data.support_email || '',
          show_product_image: data.show_product_images || false,
          enable_stock_management: data.enable_stock_management || false,
          enable_categories: data.enable_categories || false,
          enable_multiple_sku: data.enable_multiple_sku || false,
          opening_time: data.opening_hours || {},
          bank_name: data.bank_name || '',
          account_holder_name: data.bank_holder_name || '',
          account_number: data.account_number || '',
          bank_qr_code_url: data.qr_code_url || '',
        }));
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
      const settingsData = {
        support_email: formData.email,
        support_phone: formData.phone,
        address: formData.address,
        city: formData.city,
        show_product_images: formData.show_product_image,
        enable_stock_management: formData.enable_stock_management,
        enable_categories: formData.enable_categories,
        enable_multiple_sku: formData.enable_multiple_sku,
        opening_hours: formData.opening_time,
        bank_name: formData.bank_name,
        bank_holder_name: formData.account_holder_name,
        account_number: formData.account_number,
        qr_code_url: formData.bank_qr_code_url,
        minimum_order_value: minimumOrderAmount,
        delivery_charges: deliveryFeeTiers,
      };

      const settingsError = await supabase
        .from('business_settings')
        .update(settingsData)
        .eq('id', settings.id)
        .eq('business_id', restaurantId);

      if (settingsError.error) throw settingsError.error;

      const businessError = await supabase
        .from('businesses')
        .update({
          address: formData.address,
          city: formData.city,
        })
        .eq('id', restaurantId);

      if (businessError.error) throw businessError.error;

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

  const addDeliveryFeeTier = () => {
    setDeliveryFeeTiers([
      ...deliveryFeeTiers,
      { min_amount: 0, max_amount: null, fee: 0 },
    ]);
  };

  const updateDeliveryFeeTier = (
    index: number,
    field: keyof DeliveryFeeTier,
    value: number | null
  ) => {
    const updated = [...deliveryFeeTiers];
    updated[index] = { ...updated[index], [field]: value };
    setDeliveryFeeTiers(updated);
  };

  const removeDeliveryFeeTier = (index: number) => {
    setDeliveryFeeTiers(deliveryFeeTiers.filter((_, i) => i !== index));
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !restaurantId) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file');
      return;
    }

    setUploadingQR(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}/bank-qr.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('business-qr-codes')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('business-qr-codes')
        .getPublicUrl(fileName);

      setQrPreview(publicUrl);
      setFormData({ ...formData, bank_qr_code_url: publicUrl });
      setMessage('QR code uploaded successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading QR code:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to upload QR code');
    } finally {
      setUploadingQR(false);
    }
  };

  const handleRemoveQR = async () => {
    if (!restaurantId) return;

    try {
      const fileName = `${restaurantId}/bank-qr.jpg`;
      await supabase.storage.from('business-qr-codes').remove([fileName]);

      const fileNamePng = `${restaurantId}/bank-qr.png`;
      await supabase.storage.from('business-qr-codes').remove([fileNamePng]);

      setQrPreview(null);
      setFormData({ ...formData, bank_qr_code_url: '' });
      setMessage('QR code removed');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error removing QR code:', error);
    }
  };

  const handleSaveCredentials = async () => {
    if (!user?.id) return;

    setSavingCredentials(true);
    setCredentialsMessage('');

    try {
      const updates: any = {
        email: credentialsData.email,
        phone: credentialsData.phone
      };

      if (credentialsData.newPassword && credentialsData.newPassword.length >= 6) {
        updates.password = credentialsData.newPassword;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setCredentialsMessage('Login credentials updated successfully!');
      setCredentialsData({ ...credentialsData, newPassword: '' });
      setTimeout(() => setCredentialsMessage(''), 3000);
    } catch (error) {
      setCredentialsMessage(error instanceof Error ? error.message : 'Failed to update credentials');
    } finally {
      setSavingCredentials(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading settings...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-800">Business Settings</h2>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6 border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <KeyRound size={24} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-lg">Login Credentials</h3>
              <p className="text-sm text-gray-600">Update your email, phone, or password</p>
            </div>
          </div>
          <button
            onClick={() => setShowCredentialsSection(!showCredentialsSection)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {showCredentialsSection ? 'Hide' : 'Edit Credentials'}
          </button>
        </div>

        {showCredentialsSection && (
          <div className="space-y-4 pt-4 border-t">
            {credentialsMessage && (
              <div className={`p-4 rounded-lg ${credentialsMessage.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {credentialsMessage}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={credentialsData.email}
                  onChange={(e) => setCredentialsData({ ...credentialsData, email: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={credentialsData.phone}
                  onChange={(e) => setCredentialsData({ ...credentialsData, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+123456789"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password (leave blank to keep current)
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={credentialsData.newPassword}
                  onChange={(e) => setCredentialsData({ ...credentialsData, newPassword: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-12"
                  placeholder="Min. 6 characters"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Only enter a new password if you want to change it
              </p>
            </div>

            <button
              onClick={handleSaveCredentials}
              disabled={savingCredentials}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400"
            >
              <Save size={20} />
              {savingCredentials ? 'Updating...' : 'Update Credentials'}
            </button>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">Business Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="My Restaurant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="123 Main Street"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Dubai"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <input
              type="text"
              value={formData.currency}
              disabled
              className="w-full px-4 py-2 border rounded-lg bg-gray-100 cursor-not-allowed text-gray-600"
              title="Currency is set based on your country tier and cannot be changed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set by your country tier
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
          <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">Contact Information</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Support Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="support@mybusiness.com"
            />
            <p className="text-xs text-gray-500 mt-1">
              Customers will see this on your storefront
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Support Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="+971 50 123 4567"
            />
            <p className="text-xs text-gray-500 mt-1">
              Customers will see this on your storefront
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">Feature Settings</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.show_product_image}
              onChange={(e) => setFormData({ ...formData, show_product_image: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 block">Show Product Images</span>
              <span className="text-xs text-gray-500">Display images for products</span>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.enable_stock_management}
              onChange={(e) => setFormData({ ...formData, enable_stock_management: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 block">Enable Stock Management</span>
              <span className="text-xs text-gray-500">Track inventory levels</span>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.enable_categories}
              onChange={(e) => setFormData({ ...formData, enable_categories: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 block">Enable Product Categories</span>
              <span className="text-xs text-gray-500">Organize products by category</span>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={formData.enable_multiple_sku}
              onChange={(e) => setFormData({ ...formData, enable_multiple_sku: e.target.checked })}
              className="w-5 h-5 rounded"
            />
            <div>
              <span className="text-sm font-medium text-gray-700 block">Enable Multiple SKU/Variants</span>
              <span className="text-xs text-gray-500">For products with color, size, etc.</span>
            </div>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">Order Settings</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Order Amount ({formData.currency})
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minimumOrderAmount}
              onChange={(e) => setMinimumOrderAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="0 = No minimum"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set to 0 to disable minimum order requirement
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Delivery Fee Tiers
              </label>
              <button
                type="button"
                onClick={addDeliveryFeeTier}
                className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 transition-colors"
              >
                <Plus size={16} />
                Add Tier
              </button>
            </div>
            {deliveryFeeTiers.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No delivery fee tiers configured. Click "Add Tier" to create one.
              </p>
            ) : (
              <div className="space-y-3">
                {deliveryFeeTiers.map((tier, index) => (
                  <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Min Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.min_amount}
                          onChange={(e) =>
                            updateDeliveryFeeTier(
                              index,
                              'min_amount',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">
                          Max Amount (blank = above)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.max_amount || ''}
                          onChange={(e) =>
                            updateDeliveryFeeTier(
                              index,
                              'max_amount',
                              e.target.value ? parseFloat(e.target.value) : null
                            )
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                          placeholder="∞"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 block mb-1">Fee</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={tier.fee}
                          onChange={(e) =>
                            updateDeliveryFeeTier(index, 'fee', parseFloat(e.target.value) || 0)
                          }
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDeliveryFeeTier(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Remove tier"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              Example: 0-30 = 8 fee, 30-50 = 5 fee, 50+ = 0 fee (free delivery)
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">Bank Details for Customer Payments</h3>
        <p className="text-sm text-gray-600">
          Add your bank details so customers can see payment information after order completion
        </p>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="e.g., Emirates NBD"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
            <input
              type="text"
              value={formData.account_holder_name}
              onChange={(e) => setFormData({ ...formData, account_holder_name: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              placeholder="Your business name"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Account Number / IBAN</label>
          <input
            type="text"
            value={formData.account_number}
            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="AE123456789012345678901"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Bank QR Code</label>
          <div className="flex items-start gap-4">
            {qrPreview ? (
              <div className="relative">
                <img
                  src={qrPreview}
                  alt="Bank QR Code"
                  className="w-32 h-32 object-contain border-2 border-gray-300 rounded-lg"
                />
                <button
                  type="button"
                  onClick={handleRemoveQR}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Remove QR code"
                >
                  <XIcon size={16} />
                </button>
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                <Upload size={32} className="text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors inline-flex">
                  <Upload size={20} />
                  {uploadingQR ? 'Uploading...' : qrPreview ? 'Change QR Code' : 'Upload QR Code'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQRUpload}
                  disabled={uploadingQR}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-gray-500 mt-2">
                Upload a QR code image for customers to scan and pay (JPG, PNG)
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
          These details will be shown to customers on the order tracking page after order completion
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
        <h3 className="text-xl font-semibold text-gray-800 border-b pb-3">Opening Hours</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {daysOfWeek.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-16 capitalize">{day}</span>
              <input
                type="time"
                value={formData.opening_time[day]?.open || '09:00'}
                onChange={(e) => handleOpeningTimeChange(day, 'open', e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-500">to</span>
              <input
                type="time"
                value={formData.opening_time[day]?.close || '22:00'}
                onChange={(e) => handleOpeningTimeChange(day, 'close', e.target.value)}
                className="flex-1 px-3 py-2 border rounded text-sm focus:ring-2 focus:ring-orange-500"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="sticky bottom-4 bg-white rounded-lg shadow-lg p-4 border-2 border-orange-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:bg-gray-400 text-lg"
        >
          <Save size={24} />
          {saving ? 'Saving Settings...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}
