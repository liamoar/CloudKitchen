import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Clock, Calendar, DollarSign, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getCurrencySymbol } from '../../lib/utils';

interface PaymentInvoice {
  id: string;
  restaurant_id: string;
  tier_id: string;
  invoice_number: string;
  invoice_type: string;
  amount: number;
  currency: string;
  status: string;
  payment_receipt_url: string | null;
  submission_date: string | null;
  rejection_reason: string | null;
  due_date: string;
  billing_period_start: string;
  billing_period_end: string;
  created_at: string;
  restaurant: {
    id: string;
    name: string;
    subdomain: string;
    country: string;
    subscription_status: string;
  };
  tier: {
    name: string;
    monthly_price: number;
  };
}

export default function PaymentApproval() {
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentInvoice | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'>('SUBMITTED');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [filter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payment_invoices')
        .select(`
          *,
          restaurant:restaurants(id, name, subdomain, country, subscription_status),
          tier:subscription_tiers(name, monthly_price)
        `)
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data as any || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
      setMessage({ text: 'Failed to load invoices', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (invoice: PaymentInvoice) => {
    if (!confirm(`Approve payment for ${invoice.restaurant.name}?`)) return;

    setProcessing(true);
    setMessage(null);

    try {
      const subscriptionStartDate = new Date();
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setDate(subscriptionEndDate.getDate() + 30);

      await supabase
        .from('payment_invoices')
        .update({
          status: 'APPROVED',
          review_date: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      await supabase
        .from('restaurants')
        .update({
          subscription_status: 'ACTIVE',
          current_tier_id: invoice.tier_id,
          subscription_starts_at: subscriptionStartDate.toISOString(),
          subscription_ends_at: subscriptionEndDate.toISOString(),
          next_billing_date: subscriptionEndDate.toISOString(),
        })
        .eq('id', invoice.restaurant_id);

      setMessage({ text: 'Payment approved successfully!', type: 'success' });
      setSelectedInvoice(null);
      await loadInvoices();
    } catch (error) {
      console.error('Error approving payment:', error);
      setMessage({ text: 'Failed to approve payment', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (invoice: PaymentInvoice) => {
    if (!rejectionReason.trim()) {
      setMessage({ text: 'Please provide a rejection reason', type: 'error' });
      return;
    }

    if (!confirm(`Reject payment for ${invoice.restaurant.name}?`)) return;

    setProcessing(true);
    setMessage(null);

    try {
      await supabase
        .from('payment_invoices')
        .update({
          status: 'REJECTED',
          rejection_reason: rejectionReason,
          review_date: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      setMessage({ text: 'Payment rejected', type: 'success' });
      setSelectedInvoice(null);
      setRejectionReason('');
      await loadInvoices();
    } catch (error) {
      console.error('Error rejecting payment:', error);
      setMessage({ text: 'Failed to reject payment', type: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: any }> = {
      PENDING: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Clock },
      SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
      UNDER_REVIEW: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: AlertTriangle },
      APPROVED: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
      REJECTED: { bg: 'bg-red-100', text: 'text-red-700', icon: XCircle },
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

  const getInvoiceTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      TRIAL_CONVERSION: 'bg-blue-100 text-blue-700',
      RENEWAL: 'bg-green-100 text-green-700',
      UPGRADE: 'bg-purple-100 text-purple-700',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
        {type.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading payment submissions...</div>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Payment Approvals</h2>
          <div className="flex gap-2">
            {(['SUBMITTED', 'APPROVED', 'REJECTED', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === status
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'All' : status}
              </button>
            ))}
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Clock size={48} className="mx-auto mb-4 opacity-50" />
            <p>No {filter !== 'all' ? filter.toLowerCase() : ''} payment submissions found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restaurant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{invoice.restaurant.name}</p>
                        <p className="text-xs text-gray-500">{invoice.restaurant.subdomain}.hejo.app</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">{getInvoiceTypeBadge(invoice.invoice_type)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{invoice.tier.name}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      {getCurrencySymbol(invoice.currency)}{invoice.amount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {invoice.submission_date ? new Date(invoice.submission_date).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                      >
                        <Eye size={16} />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="text-xl font-bold text-gray-900">Payment Review</h3>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Invoice Number</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  {getStatusBadge(selectedInvoice.status)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Restaurant</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.restaurant.name}</p>
                  <p className="text-xs text-gray-500">{selectedInvoice.restaurant.subdomain}.hejo.app</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Type</p>
                  {getInvoiceTypeBadge(selectedInvoice.invoice_type)}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Plan</p>
                  <p className="font-semibold text-gray-900">{selectedInvoice.tier.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-lg font-bold text-orange-600">
                    {getCurrencySymbol(selectedInvoice.currency)}{selectedInvoice.amount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Billing Period</p>
                  <p className="text-xs text-gray-700">
                    {new Date(selectedInvoice.billing_period_start).toLocaleDateString()} - {new Date(selectedInvoice.billing_period_end).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Submitted</p>
                  <p className="text-xs text-gray-700">
                    {selectedInvoice.submission_date ? new Date(selectedInvoice.submission_date).toLocaleString() : 'Not submitted'}
                  </p>
                </div>
              </div>

              {selectedInvoice.payment_receipt_url && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Payment Receipt</p>
                  <a
                    href={selectedInvoice.payment_receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <ExternalLink size={16} />
                    View Receipt
                  </a>
                </div>
              )}

              {selectedInvoice.rejection_reason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason:</p>
                  <p className="text-sm text-red-700">{selectedInvoice.rejection_reason}</p>
                </div>
              )}

              {selectedInvoice.status === 'SUBMITTED' && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rejection Reason (if rejecting)
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                      placeholder="Provide a reason if rejecting..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(selectedInvoice)}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-semibold"
                    >
                      <CheckCircle size={20} />
                      {processing ? 'Processing...' : 'Approve Payment'}
                    </button>
                    <button
                      onClick={() => handleReject(selectedInvoice)}
                      disabled={processing || !rejectionReason.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg font-semibold"
                    >
                      <XCircle size={20} />
                      {processing ? 'Processing...' : 'Reject Payment'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50">
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setRejectionReason('');
                }}
                className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
