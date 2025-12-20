import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Package, Clock, CheckCircle, Truck, Home, XCircle, AlertCircle } from 'lucide-react';

interface Order {
  id: string;
  phone_number: string;
  delivery_address: string;
  total_amount: number;
  status: string;
  is_self_pickup: boolean;
  created_at: string;
  payment_method: string;
}

export function OrderTracking() {
  const { token } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    loadOrderData();
    const interval = setInterval(loadOrderData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const loadOrderData = async () => {
    if (!token) return;

    try {
      const { data: trackingData } = await supabase
        .from('order_tracking_tokens')
        .select('order_id, expires_at')
        .eq('token', token)
        .eq('token_type', 'CUSTOMER')
        .maybeSingle();

      if (!trackingData) {
        setError('Invalid tracking link');
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
      }
    } catch (err) {
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, any> = {
      PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Order Received' },
      CONFIRMED: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Order Confirmed' },
      PREPARING: { icon: Package, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Preparing Your Order' },
      READY_FOR_DELIVERY: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-100', label: 'Ready for Pickup' },
      DISPATCHED: { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-100', label: 'Order Dispatched' },
      OUT_FOR_DELIVERY: { icon: Truck, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Out for Delivery' },
      DELIVERED: { icon: Home, color: 'text-green-600', bg: 'bg-green-100', label: 'Delivered' },
      CANCELLED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Cancelled' },
      RETURNED: { icon: AlertCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Returned' },
    };
    return configs[status] || configs.PENDING;
  };

  const getStatusProgress = (status: string) => {
    const orderFlow = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIndex = orderFlow.indexOf(status);
    return currentIndex >= 0 ? ((currentIndex + 1) / orderFlow.length) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading order details...</div>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={64} className="mx-auto text-yellow-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Tracking Link Expired</h2>
          <p className="text-gray-600">
            This tracking link has expired. Please contact the restaurant for order updates.
          </p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle size={64} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
          <p className="text-gray-600">{error || 'Unable to find order details'}</p>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;
  const progress = getStatusProgress(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
            <p className="text-gray-600">Order ID: {order.id.slice(0, 8).toUpperCase()}</p>
          </div>

          <div className={`${statusConfig.bg} rounded-lg p-6 mb-8`}>
            <div className="flex items-center gap-4">
              <StatusIcon className={statusConfig.color} size={48} />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{statusConfig.label}</h2>
                <p className="text-gray-600 mt-1">
                  {order.status === 'DELIVERED' && 'Your order has been delivered successfully!'}
                  {order.status === 'OUT_FOR_DELIVERY' && 'Your order is on the way!'}
                  {order.status === 'DISPATCHED' && 'Your order has been dispatched to the delivery partner'}
                  {order.status === 'READY_FOR_DELIVERY' && 'Your order is ready and waiting for pickup'}
                  {order.status === 'PREPARING' && 'We are preparing your order'}
                  {order.status === 'CONFIRMED' && 'Your order has been confirmed'}
                  {order.status === 'PENDING' && 'We have received your order'}
                  {order.status === 'CANCELLED' && 'Your order has been cancelled'}
                  {order.status === 'RETURNED' && 'Your order has been returned'}
                </p>
              </div>
            </div>
          </div>

          {!['CANCELLED', 'RETURNED'].includes(order.status) && (
            <div className="mb-8">
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block text-blue-600">
                      Progress
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-blue-600">
                      {Math.round(progress)}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
                  <div
                    style={{ width: `${progress}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500"
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t pt-6 space-y-4">
            <h3 className="font-semibold text-gray-900 mb-4">Order Details</h3>

            <div>
              <p className="text-sm text-gray-600">Order Placed</p>
              <p className="font-medium text-gray-900">
                {new Date(order.created_at).toLocaleString()}
              </p>
            </div>

            {order.is_self_pickup ? (
              <div>
                <p className="text-sm text-gray-600">Pickup Method</p>
                <p className="font-medium text-gray-900">Self Pickup</p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">Delivery Address</p>
                <p className="font-medium text-gray-900">{order.delivery_address}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-gray-600">Payment Method</p>
              <p className="font-medium text-gray-900">
                {order.payment_method === 'COD' ? 'Cash on Delivery' : 'Bank Transfer'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-blue-600">
                AED {order.total_amount.toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-600">Contact Number</p>
              <p className="font-medium text-gray-900">{order.phone_number}</p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              This page updates automatically every 10 seconds. Keep it open to track your order in real-time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
