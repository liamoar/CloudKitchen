import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { MapPin, Phone, DollarSign, Package, AlertCircle, CheckCircle } from 'lucide-react';

interface Order {
  id: string;
  phone_number: string;
  delivery_address: string;
  total_amount: number;
  status: string;
  is_self_pickup: boolean;
  created_at: string;
  payment_method: string;
  payment_confirmed: boolean;
  delivery_notes: string | null;
  delivery_fee: number;
}

interface OrderItem {
  item_name: string;
  quantity: number;
  price: number;
}

export function RiderDelivery() {
  const { token } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadOrderData();
  }, [token]);

  const loadOrderData = async () => {
    if (!token) return;

    try {
      const { data: trackingData } = await supabase
        .from('order_tracking_tokens')
        .select('order_id, expires_at')
        .eq('token', token)
        .eq('token_type', 'RIDER')
        .maybeSingle();

      if (!trackingData) {
        setError('Invalid delivery link');
        setLoading(false);
        return;
      }

      if (new Date(trackingData.expires_at) < new Date()) {
        setExpired(true);
        setLoading(false);
        return;
      }

      const { data: orderData } = await supabase
        .from('orders')
        .select('*')
        .eq('id', trackingData.order_id)
        .maybeSingle();

      if (orderData) {
        setOrder(orderData);

        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderData.id);

        if (itemsData) {
          setItems(itemsData);
        }
      }
    } catch (err) {
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (newStatus: string) => {
    if (!order) return;

    setUpdating(true);
    setSuccess('');
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (updateError) throw updateError;

      setSuccess('Order status updated successfully!');
      await loadOrderData();
    } catch (err) {
      setError('Failed to update order status');
    } finally {
      setUpdating(false);
    }
  };

  const updatePaymentConfirmation = async (confirmed: boolean) => {
    if (!order) return;

    setUpdating(true);
    setSuccess('');
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_confirmed: confirmed })
        .eq('id', order.id);

      if (updateError) throw updateError;

      setSuccess(`Payment ${confirmed ? 'confirmed' : 'marked as pending'}!`);
      await loadOrderData();
    } catch (err) {
      setError('Failed to update payment status');
    } finally {
      setUpdating(false);
    }
  };

  const getAvailableActions = (status: string) => {
    const actions: { label: string; status: string; color: string }[] = [];

    if (status === 'DISPATCHED') {
      actions.push({ label: 'Mark Out for Delivery', status: 'OUT_FOR_DELIVERY', color: 'bg-blue-600 hover:bg-blue-700' });
    } else if (status === 'OUT_FOR_DELIVERY') {
      actions.push({ label: 'Mark as Delivered', status: 'DELIVERED', color: 'bg-green-600 hover:bg-green-700' });
      actions.push({ label: 'Return Order', status: 'RETURNED', color: 'bg-red-600 hover:bg-red-700' });
    }

    return actions;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading delivery details...</div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={64} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Link Expired</h2>
          <p className="text-gray-600">
            This delivery link has expired. Please contact the restaurant for assistance.
          </p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const actions = getAvailableActions(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Details</h1>
            <p className="text-gray-600">Order #{order.id.slice(0, 8).toUpperCase()}</p>
          </div>

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="text-green-600" size={24} />
              <p className="text-green-800">{success}</p>
            </div>
          )}

          {error && order && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={24} />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="bg-indigo-50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Current Status</h2>
              <p className="text-2xl font-bold text-indigo-600">{order.status.replace(/_/g, ' ')}</p>
            </div>

            {!order.is_self_pickup && (
              <div className="border-t pt-6">
                <div className="flex items-start gap-3 mb-4">
                  <MapPin className="text-indigo-600 flex-shrink-0" size={24} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">Delivery Address</h3>
                    <p className="text-gray-700">{order.delivery_address}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mb-4">
                  <Phone className="text-indigo-600 flex-shrink-0" size={24} />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Customer Phone</h3>
                    <a href={`tel:${order.phone_number}`} className="text-indigo-600 hover:text-indigo-800 font-medium">
                      {order.phone_number}
                    </a>
                  </div>
                </div>

                {order.delivery_notes && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">Delivery Instructions</h3>
                    <p className="text-gray-700 text-sm">{order.delivery_notes}</p>
                  </div>
                )}
              </div>
            )}

            <div className="border-t pt-6">
              <div className="flex items-start gap-3 mb-4">
                <Package className="text-indigo-600 flex-shrink-0" size={24} />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <div>
                          <p className="font-medium text-gray-900">{item.item_name}</p>
                          <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-gray-900">AED {item.price.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-start gap-3">
                <DollarSign className="text-indigo-600 flex-shrink-0" size={24} />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-2">Payment Details</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Payment Method:</span>
                      <span className="font-medium text-gray-900">
                        {order.payment_method === 'COD' ? 'Cash on Delivery' : 'Bank Transfer'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Payment Status:</span>
                      <span className={`font-medium ${order.payment_confirmed ? 'text-green-600' : 'text-yellow-600'}`}>
                        {order.payment_confirmed ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                    {order.delivery_fee > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Delivery Fee:</span>
                        <span className="text-gray-900">AED {order.delivery_fee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-lg font-semibold text-gray-900">Total Amount:</span>
                      <span className="text-2xl font-bold text-indigo-600">
                        AED {order.total_amount.toFixed(2)}
                      </span>
                    </div>

                    {order.payment_method === 'COD' && !order.payment_confirmed && order.status === 'OUT_FOR_DELIVERY' && (
                      <div className="pt-3 border-t">
                        <button
                          onClick={() => updatePaymentConfirmation(true)}
                          disabled={updating}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors disabled:bg-gray-400"
                        >
                          {updating ? 'Updating...' : 'Confirm Cash Payment Collected'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {actions.length > 0 && (
              <div className="border-t pt-6">
                <h3 className="font-semibold text-gray-900 mb-4">Update Status</h3>
                <div className="space-y-3">
                  {actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => updateOrderStatus(action.status)}
                      disabled={updating}
                      className={`w-full ${action.color} text-white py-3 px-4 rounded-lg font-semibold transition-colors disabled:bg-gray-400`}
                    >
                      {updating ? 'Updating...' : action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {order.status === 'DELIVERED' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircle className="mx-auto text-green-600 mb-3" size={48} />
                <h3 className="text-xl font-bold text-green-900 mb-2">Delivery Complete!</h3>
                <p className="text-green-700">This order has been successfully delivered.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
