import { useState, useEffect } from 'react';
import { Calendar, DollarSign, CheckCircle, Clock, AlertTriangle, CreditCard, Upload, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrencySymbol } from '../../lib/utils';

interface SubscriptionStatusProps {
  currency?: string;
}

interface RestaurantData {
  id: string;
  name: string;
  country: string;
  status: string;
  subscription_status: string;
  current_tier_id: string | null;
  trial_ends_at: string | null;
  subscription_starts_at: string | null;
  subscription_ends_at: string | null;
  next_billing_date: string | null;
  trial_days_remaining: number;
  subscription_days_remaining: number;
  ending_soon: boolean;
}

interface TierData {
  id: string;
  name: string;
  country: string;
  currency: string;
  monthly_price: number;
  product_limit: number;
  order_limit_per_month: number;
  storage_limit_mb: number;
  is_active: boolean;
  country_bank_name: string | null;
  country_account_holder: string | null;
  country_account_number: string | null;
  country_bank_qr_url: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type: string;
  amount: number;
  currency: string;
  status: string;
  payment_receipt_url: string | null;
  submission_date: string | null;
  review_date: string | null;
  rejection_reason: string | null;
  due_date: string;
  created_at: string;
  tier: {
    name: string;
  };
}

export function SubscriptionStatus({ currency }: SubscriptionStatusProps) {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [currentTier, setCurrentTier] = useState<TierData | null>(null);
  const [availableTiers, setAvailableTiers] = useState<TierData[]>([]);
  const [selectedTier, setSelectedTier] = useState<TierData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanSelection, setShowPlanSelection] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [expandedBankDetails, setExpandedBankDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const loadData = async () => {
    if (!user?.id) return;

    try {
      const { data: restaurantBasic } = await supabase
        .from('restaurants')
        .select('id, owner_id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!restaurantBasic) return;

      const { data: restaurantData } = await supabase
        .from('restaurant_subscription_status')
        .select('*')
        .eq('id', restaurantBasic.id)
        .maybeSingle();

      if (restaurantData) {
        const transformedData = {
          ...restaurantData,
          subscription_status: restaurantData.status,
          current_tier_id: restaurantData.current_tier_id
        };
        setRestaurant(transformedData as any);

        const { data: tiersData } = await supabase
          .from('subscription_tiers')
          .select('*')
          .eq('country', restaurantData.country)
          .eq('is_active', true)
          .order('monthly_price');

        if (tiersData) {
          setAvailableTiers(tiersData);
        }

        if (restaurantData.current_tier_id) {
          const { data: tierData } = await supabase
            .from('subscription_tiers')
            .select('*')
            .eq('id', restaurantData.current_tier_id)
            .maybeSingle();

          if (tierData) {
            setCurrentTier(tierData);
          }
        }

        const { data: invoicesData } = await supabase
          .from('payment_invoices')
          .select(`
            *,
            tier:subscription_tiers(name)
          `)
          .eq('restaurant_id', restaurantData.id)
          .order('created_at', { ascending: false });

        if (invoicesData) {
          setInvoices(invoicesData as any);
        }
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (tier: TierData) => {
    setSelectedTier(tier);
    setShowPaymentForm(true);
    setShowPlanSelection(false);
  };

  const handleSubmitPayment = async () => {
    if (!restaurant || !selectedTier || !receiptUrl.trim()) {
      setMessage({ text: 'Please upload payment receipt', type: 'error' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const invoiceType = restaurant.subscription_status === 'TRIAL'
        ? 'TRIAL_CONVERSION'
        : currentTier && selectedTier.id !== currentTier.id
        ? 'UPGRADE'
        : 'RENEWAL';

      const { data: functionData, error: functionError } = await supabase.rpc(
        'generate_invoice_number'
      );

      if (functionError) throw functionError;

      const invoiceNumber = functionData || `INV-${Date.now()}`;

      const dueDate = new Date();
      const billingStart = new Date();
      const billingEnd = new Date();
      billingEnd.setDate(billingEnd.getDate() + 30);

      const { error: insertError } = await supabase
        .from('payment_invoices')
        .insert({
          restaurant_id: restaurant.id,
          tier_id: selectedTier.id,
          invoice_number: invoiceNumber,
          invoice_type: invoiceType,
          amount: selectedTier.monthly_price,
          currency: selectedTier.currency,
          status: 'SUBMITTED',
          payment_receipt_url: receiptUrl,
          submission_date: new Date().toISOString(),
          due_date: dueDate.toISOString(),
          billing_period_start: billingStart.toISOString(),
          billing_period_end: billingEnd.toISOString(),
        });

      if (insertError) throw insertError;

      setMessage({ text: 'Payment submitted successfully! Awaiting admin approval.', type: 'success' });
      setReceiptUrl('');
      setShowPaymentForm(false);
      setSelectedTier(null);
      await loadData();
    } catch (error) {
      console.error('Error submitting payment:', error);
      setMessage({ text: 'Failed to submit payment. Please try again.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      TRIAL: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Trial Period' },
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700', label: 'Active' },
      OVERDUE: { bg: 'bg-red-100', text: 'text-red-700', label: 'Payment Overdue' },
      SUSPENDED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Suspended' },
    };
    const badge = badges[status] || badges.TRIAL;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getInvoiceStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      PENDING: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
      SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
      UNDER_REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: X },
    };
    const badge = badges[status] || badges.PENDING;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon size={14} />
        {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading subscription details...</div>;
  }

  if (!restaurant) {
    return <div className="text-center py-8 text-red-600">Failed to load restaurant data</div>;
  }

  const pendingInvoice = invoices.find(inv => inv.status === 'PENDING' || inv.status === 'REJECTED');
  const trialDaysLeft = restaurant.trial_days_remaining || 0;
  const subscriptionDaysLeft = restaurant.subscription_days_remaining || 0;

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Subscription Status</h2>
          {getStatusBadge(restaurant.subscription_status)}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {restaurant.subscription_status === 'TRIAL' && restaurant.trial_ends_at && (
            <div className={`${trialDaysLeft <= 2 ? 'bg-red-50' : 'bg-blue-50'} rounded-lg p-4`}>
              <div className="flex items-center gap-3 mb-2">
                <Clock className={trialDaysLeft <= 2 ? 'text-red-600' : 'text-blue-600'} size={24} />
                <h3 className={`font-semibold ${trialDaysLeft <= 2 ? 'text-red-900' : 'text-blue-900'}`}>Trial Period</h3>
              </div>
              <p className={`text-2xl font-bold ${trialDaysLeft <= 2 ? 'text-red-900' : 'text-blue-900'} mb-1`}>
                {trialDaysLeft >= 0 ? trialDaysLeft : 0} {trialDaysLeft === 1 ? 'Day' : 'Days'}
              </p>
              <p className={`text-xs ${trialDaysLeft <= 2 ? 'text-red-700' : 'text-blue-700'}`}>
                {trialDaysLeft > 0 ? 'until trial ends' : 'Trial ended'}
              </p>
              <p className={`text-xs ${trialDaysLeft <= 2 ? 'text-red-600' : 'text-blue-600'} mt-2`}>
                Ends: {new Date(restaurant.trial_ends_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {restaurant.subscription_status === 'ACTIVE' && restaurant.subscription_ends_at && (
            <div className={`${subscriptionDaysLeft <= 5 ? 'bg-orange-50' : 'bg-green-50'} rounded-lg p-4`}>
              <div className="flex items-center gap-3 mb-2">
                <Calendar className={subscriptionDaysLeft <= 5 ? 'text-orange-600' : 'text-green-600'} size={24} />
                <h3 className={`font-semibold ${subscriptionDaysLeft <= 5 ? 'text-orange-900' : 'text-green-900'}`}>Next Renewal</h3>
              </div>
              <p className={`text-2xl font-bold ${subscriptionDaysLeft <= 5 ? 'text-orange-900' : 'text-green-900'} mb-1`}>
                {subscriptionDaysLeft >= 0 ? subscriptionDaysLeft : 0} Days
              </p>
              <p className={`text-xs ${subscriptionDaysLeft <= 5 ? 'text-orange-700' : 'text-green-700'}`}>
                until next billing
              </p>
              <p className={`text-xs ${subscriptionDaysLeft <= 5 ? 'text-orange-600' : 'text-green-600'} mt-2`}>
                Due: {new Date(restaurant.subscription_ends_at).toLocaleDateString()}
              </p>
            </div>
          )}

          {currentTier && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="text-green-600" size={24} />
                <h3 className="font-semibold text-green-900">Current Plan</h3>
              </div>
              <p className="text-sm text-green-800 font-semibold">{currentTier.name}</p>
              <p className="text-xs text-green-700 mt-1">
                {getCurrencySymbol(currentTier.currency)}{currentTier.monthly_price}/month
              </p>
            </div>
          )}

        </div>

        <div className="mt-6 flex gap-3">
          {!currentTier && (
            <button
              onClick={() => setShowPlanSelection(!showPlanSelection)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold"
            >
              Choose a Plan
            </button>
          )}
          {currentTier && restaurant.subscription_status === 'ACTIVE' && (
            <button
              onClick={() => setShowPlanSelection(!showPlanSelection)}
              className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold"
            >
              Upgrade Plan
            </button>
          )}
          {pendingInvoice && (
            <button
              onClick={() => {
                setSelectedTier(availableTiers.find(t => t.id === pendingInvoice.tier_id) || null);
                setShowPaymentForm(true);
              }}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold"
            >
              Complete Payment
            </button>
          )}
        </div>
      </div>

      {showPlanSelection && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Available Plans</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {availableTiers.map((tier) => (
              <div
                key={tier.id}
                className={`border-2 rounded-lg p-4 ${
                  tier.id === currentTier?.id
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                <h4 className="text-lg font-bold text-gray-900">{tier.name}</h4>
                <p className="text-3xl font-bold text-orange-600 my-3">
                  {getCurrencySymbol(tier.currency)}{tier.monthly_price}
                  <span className="text-sm text-gray-600">/month</span>
                </p>
                <ul className="space-y-2 text-sm text-gray-700 mb-4">
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-green-600" />
                    {tier.product_limit === -1 ? 'Unlimited' : tier.product_limit} Products
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-green-600" />
                    {tier.order_limit_per_month === -1 ? 'Unlimited' : tier.order_limit_per_month} Orders/month
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={16} className="text-green-600" />
                    {tier.storage_limit_mb}MB Storage
                  </li>
                </ul>
                {tier.id !== currentTier?.id && (
                  <button
                    onClick={() => handleSelectPlan(tier)}
                    className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium"
                  >
                    Select Plan
                  </button>
                )}
                {tier.id === currentTier?.id && (
                  <div className="w-full px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium text-center">
                    Current Plan
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showPaymentForm && selectedTier && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Complete Payment</h3>

          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-900 mb-2">Payment Details</h4>
            <div className="space-y-1 text-sm">
              <p><span className="text-blue-700">Plan:</span> <span className="font-semibold">{selectedTier.name}</span></p>
              <p><span className="text-blue-700">Amount:</span> <span className="font-semibold text-lg">{getCurrencySymbol(selectedTier.currency)}{selectedTier.monthly_price}</span></p>
            </div>
          </div>

          {selectedTier.country_bank_name && (
            <div className="border border-blue-300 rounded-lg overflow-hidden mb-6">
              <button
                onClick={() => setExpandedBankDetails(!expandedBankDetails)}
                className="w-full p-4 bg-blue-50 hover:bg-blue-100 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-3">
                  <DollarSign size={24} className="text-blue-600" />
                  <div className="text-left">
                    <h4 className="font-semibold text-gray-900">Bank Transfer Details</h4>
                    <p className="text-sm text-gray-600">Click to view payment information</p>
                  </div>
                </div>
                {expandedBankDetails ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
              </button>

              {expandedBankDetails && (
                <div className="p-6 bg-white border-t space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Bank Name</p>
                    <p className="font-semibold text-gray-900">{selectedTier.country_bank_name}</p>
                  </div>
                  {selectedTier.country_account_holder && (
                    <div>
                      <p className="text-sm text-gray-600">Account Holder</p>
                      <p className="font-semibold text-gray-900">{selectedTier.country_account_holder}</p>
                    </div>
                  )}
                  {selectedTier.country_account_number && (
                    <div>
                      <p className="text-sm text-gray-600">Account Number / IBAN</p>
                      <p className="font-mono font-semibold text-gray-900 text-lg">{selectedTier.country_account_number}</p>
                    </div>
                  )}
                  {selectedTier.country_bank_qr_url && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">QR Code</p>
                      <img
                        src={selectedTier.country_bank_qr_url}
                        alt="Payment QR Code"
                        className="w-48 h-48 object-contain border rounded"
                        onError={(e) => e.currentTarget.style.display = 'none'}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Receipt URL <span className="text-red-600">*</span>
              </label>
              <input
                type="url"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder="https://example.com/receipt.jpg"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Upload your payment receipt to a cloud service (Google Drive, Dropbox, etc.) and paste the public link here
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSubmitPayment}
                disabled={uploading || !receiptUrl.trim()}
                className="flex-1 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
              >
                <Upload size={20} />
                {uploading ? 'Submitting...' : 'Submit Payment'}
              </button>
              <button
                onClick={() => {
                  setShowPaymentForm(false);
                  setSelectedTier(null);
                  setReceiptUrl('');
                }}
                className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Payment History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{invoice.invoice_type.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{invoice.tier.name}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {getCurrencySymbol(invoice.currency)}{invoice.amount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(invoice.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{getInvoiceStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-3 text-sm">
                      {invoice.payment_receipt_url && (
                        <a
                          href={invoice.payment_receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          View Receipt
                        </a>
                      )}
                      {invoice.status === 'REJECTED' && invoice.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">{invoice.rejection_reason}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
