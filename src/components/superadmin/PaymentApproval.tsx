import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Eye, Clock, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PaymentReceipt {
  id: string;
  restaurant_id: string;
  amount: number;
  currency: string;
  receipt_image_url: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  transaction_type: 'upgrade' | 'renewal';
  notes: string;
  admin_notes: string;
  submitted_at: string;
  reviewed_at: string;
  subscription_tier_id: string;
  previous_tier_id: string;
  restaurant: {
    name: string;
    slug: string;
    status: string;
  };
  subscription_tier: {
    id: string;
    name: string;
    monthly_price: number;
  };
  previous_tier?: {
    name: string;
  };
}

export default function PaymentApproval() {
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentReceipt | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');

  useEffect(() => {
    loadPayments();
  }, [filter]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('payment_receipts')
        .select(`
          *,
          restaurant:restaurant_id (name, slug, status),
          subscription_tier:subscription_tier_id (id, name, monthly_price),
          previous_tier:previous_tier_id (name)
        `)
        .order('submitted_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payment: PaymentReceipt) => {
    if (!confirm(`Approve payment of ${payment.currency} ${payment.amount} for ${payment.restaurant.name}?`)) {
      return;
    }

    setProcessing(true);
    try {
      // Update payment status
      const { error: updateError } = await supabase
        .from('payment_receipts')
        .update({
          status: 'APPROVED',
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      // Update restaurant subscription
      const updates: any = {
        tier_id: payment.subscription_tier_id,
        status: 'ACTIVE',
        is_payment_overdue: false,
        overdue_since: null,
      };

      // Set subscription end date to 30 days from now
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      updates.subscription_end_date = endDate.toISOString();

      const { error: restaurantError } = await supabase
        .from('restaurants')
        .update(updates)
        .eq('id', payment.restaurant_id);

      if (restaurantError) throw restaurantError;

      setSelectedPayment(null);
      setAdminNotes('');
      loadPayments();
      alert('Payment approved successfully!');
    } catch (err: any) {
      console.error('Failed to approve payment:', err);
      alert('Failed to approve payment: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (payment: PaymentReceipt) => {
    if (!adminNotes.trim()) {
      alert('Please provide a reason for rejection in admin notes');
      return;
    }

    if (!confirm(`Reject payment from ${payment.restaurant.name}?`)) {
      return;
    }

    setProcessing(true);
    try {
      const { error } = await supabase
        .from('payment_receipts')
        .update({
          status: 'REJECTED',
          admin_notes: adminNotes,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (error) throw error;

      setSelectedPayment(null);
      setAdminNotes('');
      loadPayments();
      alert('Payment rejected');
    } catch (err: any) {
      console.error('Failed to reject payment:', err);
      alert('Failed to reject payment: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Approved
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Payment Approvals</h2>
        <div className="flex gap-2">
          {(['all', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status === 'all' ? 'All' : status}
            </button>
          ))}
        </div>
      </div>

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No payments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold">{payment.restaurant.name}</h3>
                    {getStatusBadge(payment.status)}
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="ml-2 font-semibold text-blue-600">
                        {payment.currency} {payment.amount}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Type:</span>
                      <span className="ml-2 font-medium capitalize">
                        {payment.transaction_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Target Plan:</span>
                      <span className="ml-2 font-medium">
                        {payment.subscription_tier?.name}
                      </span>
                    </div>
                    {payment.previous_tier && (
                      <div>
                        <span className="text-gray-600">From:</span>
                        <span className="ml-2 font-medium">
                          {payment.previous_tier.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-sm text-gray-500">
                    Submitted: {formatDate(payment.submitted_at)}
                  </div>

                  {payment.notes && (
                    <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                      <span className="font-medium text-gray-700">Restaurant note: </span>
                      <span className="text-gray-600">{payment.notes}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => {
                    setSelectedPayment(payment);
                    setAdminNotes(payment.admin_notes || '');
                  }}
                  className="ml-4 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View & Review"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Review Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold">{selectedPayment.restaurant.name}</h2>
                  <div className="mt-2">{getStatusBadge(selectedPayment.status)}</div>
                </div>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Payment Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="ml-2 font-bold text-lg text-blue-600">
                        {selectedPayment.currency} {selectedPayment.amount}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Transaction Type:</span>
                      <span className="ml-2 font-medium capitalize">
                        {selectedPayment.transaction_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Target Tier:</span>
                      <span className="ml-2 font-medium">
                        {selectedPayment.subscription_tier?.name}
                      </span>
                    </div>
                    {selectedPayment.previous_tier && (
                      <div>
                        <span className="text-gray-600">Previous Tier:</span>
                        <span className="ml-2 font-medium">
                          {selectedPayment.previous_tier.name}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Submitted:</span>
                      <span className="ml-2">{formatDate(selectedPayment.submitted_at)}</span>
                    </div>
                    {selectedPayment.reviewed_at && (
                      <div>
                        <span className="text-gray-600">Reviewed:</span>
                        <span className="ml-2">{formatDate(selectedPayment.reviewed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-700 mb-3">Restaurant Info</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Slug:</span>
                      <span className="ml-2 font-mono">{selectedPayment.restaurant.slug}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Current Status:</span>
                      <span className="ml-2 font-medium">{selectedPayment.restaurant.status}</span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Restaurant Notes</h3>
                  <p className="p-3 bg-gray-50 rounded text-sm">{selectedPayment.notes}</p>
                </div>
              )}

              <div className="mb-4">
                <h3 className="font-semibold text-gray-700 mb-2">Payment Proof</h3>
                <img
                  src={selectedPayment.receipt_image_url}
                  alt="Payment proof"
                  className="w-full rounded-lg border border-gray-200"
                />
              </div>

              {selectedPayment.status === 'PENDING' && (
                <>
                  <div className="mb-6">
                    <label className="block font-semibold text-gray-700 mb-2">
                      Admin Notes {selectedPayment.status === 'PENDING' && '(Required for rejection)'}
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Add notes about this payment review..."
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleReject(selectedPayment)}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      <XCircle size={20} />
                      {processing ? 'Processing...' : 'Reject Payment'}
                    </button>
                    <button
                      onClick={() => handleApprove(selectedPayment)}
                      disabled={processing}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <CheckCircle size={20} />
                      {processing ? 'Processing...' : 'Approve Payment'}
                    </button>
                  </div>
                </>
              )}

              {selectedPayment.status !== 'PENDING' && selectedPayment.admin_notes && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Admin Notes</h3>
                  <p className="p-3 bg-blue-50 rounded text-sm text-blue-700">
                    {selectedPayment.admin_notes}
                  </p>
                </div>
              )}

              {selectedPayment.status !== 'PENDING' && (
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="w-full px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
