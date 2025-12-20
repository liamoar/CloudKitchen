import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Eye, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PaymentReceipt {
  id: string;
  amount: number;
  currency: string;
  receipt_image_url: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  transaction_type: 'upgrade' | 'renewal';
  notes: string;
  admin_notes: string;
  submitted_at: string;
  reviewed_at: string;
  subscription_tier: {
    name: string;
  };
  previous_tier?: {
    name: string;
  };
}

interface PaymentHistoryProps {
  restaurantId: string;
}

export default function PaymentHistory({ restaurantId }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PaymentReceipt | null>(null);

  useEffect(() => {
    loadPayments();
  }, [restaurantId]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_receipts')
        .select(`
          *,
          subscription_tier:subscription_tier_id (name),
          previous_tier:previous_tier_id (name)
        `)
        .eq('restaurant_id', restaurantId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pending Review
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      <h2 className="text-xl font-bold mb-4">Payment History</h2>

      {payments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No payment history yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">
                      {payment.currency} {payment.amount}
                    </h3>
                    {getStatusBadge(payment.status)}
                  </div>
                  <p className="text-sm text-gray-600">
                    {payment.transaction_type === 'upgrade' ? (
                      <>
                        Upgrade to <span className="font-medium">{payment.subscription_tier?.name}</span>
                        {payment.previous_tier && (
                          <> from <span className="font-medium">{payment.previous_tier.name}</span></>
                        )}
                      </>
                    ) : (
                      <>
                        Renewal for <span className="font-medium">{payment.subscription_tier?.name}</span> plan
                      </>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPayment(payment)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View Details"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Submitted: {formatDate(payment.submitted_at)}</span>
                {payment.reviewed_at && (
                  <span>Reviewed: {formatDate(payment.reviewed_at)}</span>
                )}
              </div>

              {payment.notes && (
                <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                  <span className="font-medium text-gray-700">Your note: </span>
                  <span className="text-gray-600">{payment.notes}</span>
                </div>
              )}

              {payment.admin_notes && (
                <div className="mt-2 p-3 bg-blue-50 rounded text-sm">
                  <span className="font-medium text-blue-700">Admin note: </span>
                  <span className="text-blue-600">{payment.admin_notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Payment Details</h2>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Amount</span>
                    <p className="text-xl font-bold">
                      {selectedPayment.currency} {selectedPayment.amount}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Status</span>
                    <div className="mt-1">{getStatusBadge(selectedPayment.status)}</div>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Type</span>
                  <p className="font-medium capitalize">{selectedPayment.transaction_type}</p>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Subscription Tier</span>
                  <p className="font-medium">{selectedPayment.subscription_tier?.name}</p>
                </div>

                {selectedPayment.previous_tier && (
                  <div>
                    <span className="text-sm text-gray-600">Previous Tier</span>
                    <p className="font-medium">{selectedPayment.previous_tier.name}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-gray-600">Submitted At</span>
                  <p className="font-medium">{formatDate(selectedPayment.submitted_at)}</p>
                </div>

                {selectedPayment.reviewed_at && (
                  <div>
                    <span className="text-sm text-gray-600">Reviewed At</span>
                    <p className="font-medium">{formatDate(selectedPayment.reviewed_at)}</p>
                  </div>
                )}

                {selectedPayment.notes && (
                  <div>
                    <span className="text-sm text-gray-600">Your Notes</span>
                    <p className="mt-1 p-3 bg-gray-50 rounded">{selectedPayment.notes}</p>
                  </div>
                )}

                {selectedPayment.admin_notes && (
                  <div>
                    <span className="text-sm text-gray-600">Admin Notes</span>
                    <p className="mt-1 p-3 bg-blue-50 rounded text-blue-700">
                      {selectedPayment.admin_notes}
                    </p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-gray-600 block mb-2">Payment Proof</span>
                  <img
                    src={selectedPayment.receipt_image_url}
                    alt="Payment proof"
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
              </div>

              <button
                onClick={() => setSelectedPayment(null)}
                className="w-full mt-6 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
