import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Globe, Upload, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Country {
  id: string;
  name: string;
  slug: string;
  short_name: string;
  currency: string;
  currency_symbol: string;
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  qr_url: string | null;
  status: 'active' | 'inactive';
  created_at: string;
}

interface CountryFormData {
  name: string;
  slug: string;
  short_name: string;
  currency: string;
  currency_symbol: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  qr_url: string;
  status: 'active' | 'inactive';
}

export function CountryManagement() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string>('');

  const [formData, setFormData] = useState<CountryFormData>({
    name: '',
    slug: '',
    short_name: '',
    currency: '',
    currency_symbol: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    qr_url: '',
    status: 'active',
  });

  useEffect(() => {
    loadCountries();
  }, []);

  const loadCountries = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .order('name');

      if (error) throw error;
      setCountries(data || []);
    } catch (err: any) {
      setError('Failed to load countries');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setQrFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setQrPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadQrCode = async (countrySlug: string): Promise<string | null> => {
    if (!qrFile) return null;

    try {
      setUploading(true);
      const fileExt = qrFile.name.split('.').pop();
      const fileName = `${countrySlug}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('country-qr-codes')
        .upload(filePath, qrFile, {
          upsert: true,
          contentType: qrFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('country-qr-codes')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(`Failed to upload QR code: ${err.message}`);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const deleteOldQrCode = async (qrUrl: string) => {
    try {
      const fileName = qrUrl.split('/').pop();
      if (!fileName) return;

      await supabase.storage
        .from('country-qr-codes')
        .remove([fileName]);
    } catch (err) {
      console.error('Failed to delete old QR code:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      let qrUrl = formData.qr_url;

      if (qrFile) {
        const uploadedUrl = await uploadQrCode(formData.slug);
        if (uploadedUrl) {
          qrUrl = uploadedUrl;
          if (editingCountry?.qr_url) {
            await deleteOldQrCode(editingCountry.qr_url);
          }
        }
      }

      const dataToSave = { ...formData, qr_url: qrUrl };

      if (editingCountry) {
        const { error } = await supabase
          .from('countries')
          .update(dataToSave)
          .eq('id', editingCountry.id);

        if (error) throw error;
        setMessage('Country updated successfully');
      } else {
        const { error } = await supabase
          .from('countries')
          .insert([dataToSave]);

        if (error) throw error;

        const { data: newCountry } = await supabase
          .from('countries')
          .select('id')
          .eq('slug', formData.slug)
          .single();

        if (newCountry) {
          await createDefaultTrialTier(newCountry.id);
        }

        setMessage('Country created successfully with Trial tier');
      }

      await loadCountries();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save country');
      console.error(err);
    }
  };

  const createDefaultTrialTier = async (countryId: string) => {
    try {
      await supabase.from('subscription_tiers').insert([
        {
          name: 'Trial',
          country_id: countryId,
          price: 0,
          days: 1,
          product_limit: 5,
          orders_per_month: 5,
          storage_limit: 100,
          features: {
            description: 'Try out the platform with limited features',
            includes: ['Basic dashboard', 'Limited products', 'Limited orders']
          },
          is_active: true,
          trial_days: 1,
          grace_period_days: 7,
        },
      ]);
    } catch (err) {
      console.error('Failed to create trial tier:', err);
    }
  };

  const handleEdit = (country: Country) => {
    setEditingCountry(country);
    setFormData({
      name: country.name,
      slug: country.slug,
      short_name: country.short_name,
      currency: country.currency,
      currency_symbol: country.currency_symbol,
      bank_name: country.bank_name || '',
      account_holder: country.account_holder || '',
      account_number: country.account_number || '',
      qr_url: country.qr_url || '',
      status: country.status,
    });
    setQrPreview(country.qr_url || '');
    setQrFile(null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this country? This will also delete all related subscription tiers.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('countries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMessage('Country deleted successfully');
      await loadCountries();
    } catch (err: any) {
      setError(err.message || 'Failed to delete country');
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      short_name: '',
      currency: '',
      currency_symbol: '',
      bank_name: '',
      account_holder: '',
      account_number: '',
      qr_url: '',
      status: 'active',
    });
    setEditingCountry(null);
    setShowForm(false);
    setQrFile(null);
    setQrPreview('');
    setError('');
    setMessage('');
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Country Management</h2>
          <p className="text-gray-600 mt-1">Manage countries and their payment configurations</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Add Country
          </button>
        )}
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
              {editingCountry ? 'Edit Country' : 'Add New Country'}
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
                  Country Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="United Arab Emirates"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Slug *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="uae"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Short Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.short_name}
                  onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="UAE"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="AED"
                  maxLength={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency Symbol *
                </label>
                <input
                  type="text"
                  required
                  value={formData.currency_symbol}
                  onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="AED"
                />
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-gray-900 mb-4">Payment Information</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={formData.bank_name}
                    onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Holder
                  </label>
                  <input
                    type="text"
                    value={formData.account_holder}
                    onChange={(e) => setFormData({ ...formData, account_holder: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment QR Code
                  </label>

                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          {uploading ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-gray-400 mb-2" />
                              <p className="text-sm text-gray-600">
                                <span className="font-semibold">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-gray-500 mt-1">PNG, JPG, GIF up to 5MB</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileChange}
                          disabled={uploading}
                        />
                      </label>
                    </div>

                    {qrPreview && (
                      <div className="relative">
                        <div className="w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden">
                          <img
                            src={qrPreview}
                            alt="QR Code Preview"
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setQrFile(null);
                            setQrPreview('');
                          }}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {qrFile && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                      <ImageIcon size={16} />
                      Selected: {qrFile.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={uploading}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <Save size={20} />
                {uploading ? 'Uploading...' : (editingCountry ? 'Update Country' : 'Create Country')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                disabled={uploading}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {countries.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Globe className="w-16 h-16 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No countries configured yet</p>
            <p className="text-sm text-gray-500 mt-1">Add your first country to get started</p>
          </div>
        ) : (
          countries.map((country) => (
            <div
              key={country.id}
              className="bg-white rounded-lg shadow-md p-6 border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{country.name}</h3>
                    <p className="text-sm text-gray-500">{country.short_name} • {country.slug}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      country.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {country.status}
                  </span>
                  <button
                    onClick={() => handleEdit(country)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(country.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Currency:</span>
                      <p className="font-semibold text-gray-900">{country.currency_symbol} ({country.currency})</p>
                    </div>
                    {country.bank_name && (
                      <div>
                        <span className="text-gray-600">Bank:</span>
                        <p className="font-semibold text-gray-900">{country.bank_name}</p>
                      </div>
                    )}
                    {country.account_holder && (
                      <div>
                        <span className="text-gray-600">Account Holder:</span>
                        <p className="font-semibold text-gray-900">{country.account_holder}</p>
                      </div>
                    )}
                    {country.account_number && (
                      <div>
                        <span className="text-gray-600">Account Number:</span>
                        <p className="font-semibold text-gray-900">{country.account_number}</p>
                      </div>
                    )}
                  </div>
                </div>

                {country.qr_url && (
                  <div className="flex-shrink-0">
                    <div className="text-xs text-gray-600 mb-1">Payment QR Code:</div>
                    <div className="w-24 h-24 border-2 border-gray-200 rounded-lg overflow-hidden bg-white">
                      <img
                        src={country.qr_url}
                        alt="Payment QR Code"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
