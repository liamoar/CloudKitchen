import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, XCircle, Eye, X, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PaymentInvoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  payment_receipt_url: string | null;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  invoice_type: 'TRIAL_CONVERSION' | 'UPGRADE' | 'RENEWAL';
  rejection_reason: string | null;
  created_at: string;
  submission_date: string | null;
  review_date: string | null;
  due_date: string;
  billing_period_start: string;
  billing_period_end: string;
  tier: {
    name: string;
    monthly_price: number;
  } | null;
}

interface PaymentHistoryProps {
  restaurantId: string;
}

export default function PaymentHistory({ restaurantId }: PaymentHistoryProps) {
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentInvoice | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [restaurantId]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_invoices')
        .select(`
          *,
          tier:subscription_tiers!payment_invoices_tier_id_fkey (name, monthly_price)
        `)
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pending Payment
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            <Clock className="w-4 h-4" />
            Under Review
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

  const getInvoiceTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TRIAL_CONVERSION: 'Trial Conversion',
      UPGRADE: 'Plan Upgrade',
      RENEWAL: 'Plan Renewal',
    };
    return labels[type] || type;
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
      <h2 className="text-xl font-bold mb-4">Payment Invoices</h2>

      {invoices.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-lg">
                      {invoice.currency} {invoice.amount}
                    </h3>
                    {getStatusBadge(invoice.status)}
                  </div>
                  <p className="text-sm text-gray-600 mb-1">
                    Invoice #{invoice.invoice_number}
                  </p>
                  <p className="text-sm text-gray-700">
                    {getInvoiceTypeBadge(invoice.invoice_type)} - <span className="font-medium">{invoice.tier?.name || 'Unknown Plan'}</span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedInvoice(invoice)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="View Details"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Created: {formatDate(invoice.created_at)}</span>
                <span>Due: {formatDate(invoice.due_date)}</span>
              </div>

              {invoice.submission_date && (
                <div className="mt-2 text-sm text-gray-500">
                  Submitted: {formatDate(invoice.submission_date)}
                </div>
              )}

              {invoice.rejection_reason && (
                <div className="mt-3 p-3 bg-red-50 rounded text-sm">
                  <span className="font-medium text-red-700">Rejection Reason: </span>
                  <span className="text-red-600">{invoice.rejection_reason}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Invoice Details</h2>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Invoice Number</span>
                    <p className="font-bold text-gray-900">{selectedInvoice.invoice_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Status</span>
                    <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Amount</span>
                    <p className="text-xl font-bold text-orange-600">
                      {selectedInvoice.currency} {selectedInvoice.amount}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Type</span>
                    <p className="font-medium">{getInvoiceTypeBadge(selectedInvoice.invoice_type)}</p>
                  </div>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Subscription Tier</span>
                  <p className="font-medium">{selectedInvoice.tier?.name || 'Unknown'}</p>
                </div>

                <div>
                  <span className="text-sm text-gray-600">Billing Period</span>
                  <p className="font-medium">
                    {formatDate(selectedInvoice.billing_period_start)} - {formatDate(selectedInvoice.billing_period_end)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-600">Created</span>
                    <p className="font-medium">{formatDate(selectedInvoice.created_at)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Due Date</span>
                    <p className="font-medium">{formatDate(selectedInvoice.due_date)}</p>
                  </div>
                </div>

                {selectedInvoice.submission_date && (
                  <div>
                    <span className="text-sm text-gray-600">Submitted At</span>
                    <p className="font-medium">{formatDate(selectedInvoice.submission_date)}</p>
                  </div>
                )}

                {selectedInvoice.review_date && (
                  <div>
                    <span className="text-sm text-gray-600">Reviewed At</span>
                    <p className="font-medium">{formatDate(selectedInvoice.review_date)}</p>
                  </div>
                )}

                {selectedInvoice.rejection_reason && (
                  <div>
                    <span className="text-sm text-gray-600">Rejection Reason</span>
                    <p className="mt-1 p-3 bg-red-50 rounded text-red-700">
                      {selectedInvoice.rejection_reason}
                    </p>
                  </div>
                )}

                {selectedInvoice.payment_receipt_url && (
                  <div>
                    <span className="text-sm text-gray-600 block mb-2">Payment Proof</span>
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

                {selectedInvoice.status === 'PENDING' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Please submit your payment proof to proceed with this invoice.
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
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
