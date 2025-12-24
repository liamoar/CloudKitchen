import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getCurrencySymbol } from '../../lib/utils';
import { Plus, Edit2, Trash2, Save, X, Globe } from 'lucide-react';

interface SubscriptionTier {
  id: string;
  name: string;
  country: string;
  country_name: string;
  currency: string;
  monthly_price: number;
  product_limit: number;
  order_limit_per_month: number;
  storage_limit_mb: number;
  trial_days: number;
  overdue_grace_days: number;
  is_active: boolean;
  country_bank_name?: string;
  country_account_holder?: string;
  country_account_number?: string;
  country_bank_qr_url?: string;
}

interface CountryGroup {
  country: string;
  country_name: string;
  currency: string;
  tiers: SubscriptionTier[];
}

export default function CountryTierManagement() {
  const [countryGroups, setCountryGroups] = useState<CountryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SubscriptionTier>>({});
  const [addingCountry, setAddingCountry] = useState(false);
  const [newCountryForm, setNewCountryForm] = useState({
    country: '',
    country_name: '',
    currency: 'USD'
  });
  const [addingTier, setAddingTier] = useState<string | null>(null);
  const [newTierForm, setNewTierForm] = useState({
    name: '',
    monthly_price: 0,
    order_limit_per_month: 40,
    product_limit: 40,
    storage_limit_mb: 500
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('country, name');

      if (data) {
        const grouped = data.reduce((acc, tier) => {
          const existing = acc.find(g => g.country === tier.country);
          if (existing) {
            existing.tiers.push(tier);
          } else {
            acc.push({
              country: tier.country,
              country_name: tier.country_name,
              currency: tier.currency,
              tiers: [tier]
            });
          }
          return acc;
        }, [] as CountryGroup[]);

        setCountryGroups(grouped);
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditTier = (tier: SubscriptionTier) => {
    setEditingTier(tier.id);
    setEditForm(tier);
  };

  const cancelEdit = () => {
    setEditingTier(null);
    setEditForm({});
  };

  const saveTier = async () => {
    if (!editingTier) return;

    try {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .update({
          name: editForm.name,
          monthly_price: editForm.monthly_price,
          product_limit: editForm.product_limit,
          order_limit_per_month: editForm.order_limit_per_month,
          storage_limit_mb: editForm.storage_limit_mb,
          currency: editForm.currency,
          trial_days: editForm.trial_days,
          overdue_grace_days: editForm.overdue_grace_days,
          is_active: editForm.is_active,
          country_bank_name: editForm.country_bank_name || null,
          country_account_holder: editForm.country_account_holder || null,
          country_account_number: editForm.country_account_number || null,
          country_bank_qr_url: editForm.country_bank_qr_url || null,
        })
        .eq('id', editingTier)
        .select();

      if (error) {
        console.error('Error updating tier:', error);
        alert(`Error updating tier: ${error.message}`);
        return;
      }

      if (!data || data.length === 0) {
        alert('No rows were updated. Please check permissions.');
        return;
      }

      alert('Tier updated successfully!');
      await loadData();
      setEditingTier(null);
      setEditForm({});
    } catch (error: any) {
      console.error('Error updating tier:', error);
      alert(`Error updating tier: ${error?.message || 'Unknown error'}`);
    }
  };

  const deleteTier = async (tierId: string, tierName: string) => {
    if (!confirm(`Are you sure you want to delete the ${tierName} tier? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .delete()
        .eq('id', tierId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error deleting tier:', error);
      alert('Error deleting tier. Make sure no restaurants are using this tier.');
    }
  };

  const toggleTierStatus = async (tierId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .update({ is_active: !currentStatus })
        .eq('id', tierId);

      if (error) throw error;

      await loadData();
    } catch (error) {
      console.error('Error toggling tier status:', error);
      alert('Error updating tier status');
    }
  };

  const startAddCountry = () => {
    setAddingCountry(true);
    setNewCountryForm({
      country: '',
      country_name: '',
      currency: 'USD'
    });
  };

  const cancelAddCountry = () => {
    setAddingCountry(false);
    setNewCountryForm({
      country: '',
      country_name: '',
      currency: 'USD'
    });
  };

  const addCountry = async () => {
    if (!newCountryForm.country || !newCountryForm.country_name || !newCountryForm.currency) {
      alert('Please fill in all fields');
      return;
    }

    if (newCountryForm.country.length !== 2) {
      alert('Country code must be 2 characters (e.g., AE, US, NP)');
      return;
    }

    try {
      const basicTier = {
        name: 'Basic',
        country: newCountryForm.country.toUpperCase(),
        country_name: newCountryForm.country_name,
        currency: newCountryForm.currency,
        monthly_price: 20,
        product_limit: 40,
        order_limit_per_month: 40,
        storage_limit_mb: 500,
        trial_days: 15,
        overdue_grace_days: 2,
        is_active: true
      };

      const premiumTier = {
        name: 'Premium',
        country: newCountryForm.country.toUpperCase(),
        country_name: newCountryForm.country_name,
        currency: newCountryForm.currency,
        monthly_price: 40,
        product_limit: -1,
        order_limit_per_month: -1,
        storage_limit_mb: 2048,
        trial_days: 15,
        overdue_grace_days: 2,
        is_active: true
      };

      const { error } = await supabase
        .from('subscription_tiers')
        .insert([basicTier, premiumTier]);

      if (error) throw error;

      await loadData();
      setAddingCountry(false);
      setNewCountryForm({
        country: '',
        country_name: '',
        currency: 'USD'
      });
    } catch (error) {
      console.error('Error adding country:', error);
      alert('Error adding country. The country code might already exist.');
    }
  };

  const startAddTier = (country: string) => {
    setAddingTier(country);
    setNewTierForm({
      name: '',
      monthly_price: 0,
      order_limit_per_month: 40,
      product_limit: 40,
      storage_limit_mb: 500
    });
  };

  const cancelAddTier = () => {
    setAddingTier(null);
    setNewTierForm({
      name: '',
      monthly_price: 0,
      order_limit_per_month: 40,
      product_limit: 40,
      storage_limit_mb: 500
    });
  };

  const addTier = async (country: string) => {
    if (!newTierForm.name) {
      alert('Please enter a tier name');
      return;
    }

    const countryGroup = countryGroups.find(g => g.country === country);
    if (!countryGroup) return;

    try {
      const newTier = {
        name: newTierForm.name,
        country: country,
        country_name: countryGroup.country_name,
        currency: countryGroup.currency,
        monthly_price: newTierForm.monthly_price,
        product_limit: newTierForm.product_limit,
        order_limit_per_month: newTierForm.order_limit_per_month,
        storage_limit_mb: newTierForm.storage_limit_mb,
        trial_days: countryGroup.tiers[0]?.trial_days || 15,
        overdue_grace_days: countryGroup.tiers[0]?.overdue_grace_days || 2,
        is_active: true
      };

      const { error } = await supabase
        .from('subscription_tiers')
        .insert([newTier]);

      if (error) throw error;

      await loadData();
      setAddingTier(null);
      setNewTierForm({
        name: '',
        monthly_price: 0,
        order_limit_per_month: 40,
        product_limit: 40,
        storage_limit_mb: 500
      });
    } catch (error) {
      console.error('Error adding tier:', error);
      alert('Error adding tier');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Country & Subscription Tier Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage countries, currencies, and subscription tiers. All settings are unified per country.
          </p>
        </div>
        <button
          onClick={startAddCountry}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          Add Country
        </button>
      </div>

      {addingCountry && (
        <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-blue-500">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Country</h3>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country Code (2 chars)
              </label>
              <input
                type="text"
                value={newCountryForm.country}
                onChange={(e) => setNewCountryForm({ ...newCountryForm, country: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="AE"
                maxLength={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country Name
              </label>
              <input
                type="text"
                value={newCountryForm.country_name}
                onChange={(e) => setNewCountryForm({ ...newCountryForm, country_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="United Arab Emirates"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <input
                type="text"
                value={newCountryForm.currency}
                onChange={(e) => setNewCountryForm({ ...newCountryForm, currency: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="AED"
                maxLength={3}
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={addCountry}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save size={20} />
              Add Country with Default Tiers
            </button>
            <button
              onClick={cancelAddCountry}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              <X size={20} />
              Cancel
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This will create Basic and Premium tiers with default values that you can edit later.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {countryGroups.map((group) => (
          <div key={group.country} className="bg-white rounded-lg shadow border border-gray-200">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-6 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe size={24} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {group.country_name} ({group.country})
                  </h3>
                  <p className="text-sm text-gray-600">
                    Currency: {group.currency} ({getCurrencySymbol(group.currency)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => startAddTier(group.country)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Add Tier
              </button>
            </div>

            {addingTier === group.country && (
              <div className="p-4 bg-blue-50 border-b">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Add New Tier for {group.country}</h4>
                <div className="grid md:grid-cols-5 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tier Name</label>
                    <input
                      type="text"
                      value={newTierForm.name}
                      onChange={(e) => setNewTierForm({ ...newTierForm, name: e.target.value })}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="Standard"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Price</label>
                    <input
                      type="number"
                      value={newTierForm.monthly_price}
                      onChange={(e) => setNewTierForm({ ...newTierForm, monthly_price: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Orders/Month</label>
                    <input
                      type="number"
                      value={newTierForm.order_limit_per_month}
                      onChange={(e) => setNewTierForm({ ...newTierForm, order_limit_per_month: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="-1 = unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Product Limit</label>
                    <input
                      type="number"
                      value={newTierForm.product_limit}
                      onChange={(e) => setNewTierForm({ ...newTierForm, product_limit: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                      placeholder="-1 = unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Storage (MB)</label>
                    <input
                      type="number"
                      value={newTierForm.storage_limit_mb}
                      onChange={(e) => setNewTierForm({ ...newTierForm, storage_limit_mb: Number(e.target.value) })}
                      className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addTier(group.country)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Save size={14} />
                    Add
                  </button>
                  <button
                    onClick={cancelAddTier}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    <X size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders/Month</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product Limit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storage (MB)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial Days</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grace Days</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {group.tiers.map((tier) => (
                    <>
                    <tr key={tier.id} className={!tier.is_active ? 'bg-gray-50 opacity-60' : ''}>
                      {editingTier === tier.id ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editForm.monthly_price}
                              onChange={(e) => setEditForm({ ...editForm, monthly_price: Number(e.target.value) })}
                              className="w-24 px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editForm.order_limit_per_month}
                              onChange={(e) => setEditForm({ ...editForm, order_limit_per_month: Number(e.target.value) })}
                              className="w-24 px-2 py-1 border rounded text-sm"
                              placeholder="-1 = unlimited"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editForm.product_limit}
                              onChange={(e) => setEditForm({ ...editForm, product_limit: Number(e.target.value) })}
                              className="w-24 px-2 py-1 border rounded text-sm"
                              placeholder="-1 = unlimited"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editForm.storage_limit_mb}
                              onChange={(e) => setEditForm({ ...editForm, storage_limit_mb: Number(e.target.value) })}
                              className="w-24 px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editForm.trial_days}
                              onChange={(e) => setEditForm({ ...editForm, trial_days: Number(e.target.value) })}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={editForm.overdue_grace_days}
                              onChange={(e) => setEditForm({ ...editForm, overdue_grace_days: Number(e.target.value) })}
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editForm.is_active}
                                onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm">Active</span>
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={saveTier}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                                title="Save"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                                title="Cancel"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-900">{tier.name}</td>
                          <td className="px-4 py-3 text-gray-700">
                            {getCurrencySymbol(tier.currency)}{tier.monthly_price}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {tier.order_limit_per_month === -1 ? (
                              <span className="text-green-600 font-medium">Unlimited</span>
                            ) : (
                              tier.order_limit_per_month
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {tier.product_limit === -1 ? (
                              <span className="text-green-600 font-medium">Unlimited</span>
                            ) : (
                              tier.product_limit
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{tier.storage_limit_mb}</td>
                          <td className="px-4 py-3 text-gray-700">{tier.trial_days}</td>
                          <td className="px-4 py-3 text-gray-700">{tier.overdue_grace_days}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleTierStatus(tier.id, tier.is_active)}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                tier.is_active
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              }`}
                            >
                              {tier.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditTier(tier)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => deleteTier(tier.id, tier.name)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                    {editingTier === tier.id && (
                      <tr key={`${tier.id}-bank`}>
                        <td colSpan={9} className="px-4 py-4 bg-blue-50 border-t-2 border-blue-200">
                          <div className="space-y-3">
                            <h4 className="font-semibold text-gray-900 text-sm">Country-Level Bank Details for Subscription Payments</h4>
                            <p className="text-xs text-gray-600">
                              These bank details will be shown to restaurant owners when they need to pay for subscriptions
                            </p>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Bank Name</label>
                                <input
                                  type="text"
                                  value={editForm.country_bank_name || ''}
                                  onChange={(e) => setEditForm({ ...editForm, country_bank_name: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border rounded"
                                  placeholder="e.g., Emirates NBD"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Account Holder</label>
                                <input
                                  type="text"
                                  value={editForm.country_account_holder || ''}
                                  onChange={(e) => setEditForm({ ...editForm, country_account_holder: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border rounded"
                                  placeholder="Your company name"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Account Number / IBAN</label>
                                <input
                                  type="text"
                                  value={editForm.country_account_number || ''}
                                  onChange={(e) => setEditForm({ ...editForm, country_account_number: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border rounded"
                                  placeholder="AE123456789..."
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">QR Code URL (optional)</label>
                                <input
                                  type="url"
                                  value={editForm.country_bank_qr_url || ''}
                                  onChange={(e) => setEditForm({ ...editForm, country_bank_qr_url: e.target.value })}
                                  className="w-full px-2 py-1 text-sm border rounded"
                                  placeholder="https://..."
                                />
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Important Notes:</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Currency is set per country and applies to all tiers in that country</li>
          <li>Use -1 for unlimited orders or products</li>
          <li>Trial days and grace days are country-specific settings</li>
          <li>Businesses registered in a country will use that country's currency everywhere</li>
          <li>Inactive tiers cannot be selected by new businesses but existing ones keep their tier</li>
          <li>Deleting a tier is only possible if no businesses are using it</li>
        </ul>
      </div>
    </div>
  );
}
