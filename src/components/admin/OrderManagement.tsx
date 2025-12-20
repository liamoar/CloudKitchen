import { useState, useEffect } from 'react';
import { Search, Clock, CheckCircle, ChefHat, Package, Truck, Home, XCircle, AlertTriangle, User, Copy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import type { Order, OrderItem, OrderStatus, PaymentMethod } from '../../lib/database.types';

interface OrderWithItems extends Order {
  items: OrderItem[];
  riderLink?: string;
}

interface Restaurant {
  id: string;
  slug: string;
  is_payment_overdue: boolean;
  status: string;
  restaurant_currency: string;
}

interface Rider {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}

export function OrderManagement() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchPhone, setSearchPhone] = useState('');
  const [viewMode, setViewMode] = useState<'new' | 'history'>('new');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    loadRestaurantStatus();
  }, [user?.id]);

  useEffect(() => {
    if (restaurant?.id) {
      loadOrders();
      const interval = setInterval(loadOrders, 30000);
      return () => clearInterval(interval);
    }
  }, [restaurant?.id]);

  useEffect(() => {
    filterOrders();
  }, [orders, searchPhone, viewMode]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadRestaurantStatus = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('restaurants')
      .select('id, slug, is_payment_overdue, status, restaurant_currency')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (data) {
      setRestaurant(data);
      loadRiders(data.id);
    }
  };

  const loadRiders = async (restaurantId: string) => {
    const { data } = await supabase
      .from('delivery_riders')
      .select('id, name, phone, is_active')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('name');

    if (data) {
      setRiders(data);
    }
  };

  const loadOrders = async () => {
    if (!restaurant?.id) return;

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });

    if (ordersData) {
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);

          let riderLink: string | undefined;
          if (order.assigned_rider_id) {
            const { data: tokenData } = await supabase
              .from('order_tracking_tokens')
              .select('token')
              .eq('order_id', order.id)
              .eq('token_type', 'RIDER')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (tokenData) {
              riderLink = restaurant?.slug
                ? `${window.location.origin}/${restaurant.slug}/rider/${tokenData.token}`
                : `${window.location.origin}/rider/${tokenData.token}`;
            }
          }

          return { ...order, items: items || [], riderLink };
        })
      );
      setOrders(ordersWithItems);
    }
    setLoading(false);
  };

  const filterOrders = () => {
    let filtered = orders;

    if (viewMode === 'new') {
      filtered = filtered.filter(
        (order) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status)
      );
    } else {
      filtered = filtered.filter(
        (order) => ['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status)
      );
    }

    if (searchPhone) {
      filtered = filtered.filter((order) =>
        order.phone_number.includes(searchPhone)
      );
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!restaurant?.id) return;
    if (restaurant?.is_payment_overdue) {
      showNotification('Cannot process orders. Your subscription payment is overdue.', 'error');
      return;
    }
    try {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId).eq('restaurant_id', restaurant.id);
      if (error) throw error;
      showNotification('Order status updated successfully!', 'success');
      loadOrders();
    } catch (error) {
      showNotification('Failed to update order status.', 'error');
      console.error('Error updating status:', error);
    }
  };

  const updatePaymentConfirmation = async (orderId: string, confirmed: boolean) => {
    if (!restaurant?.id) return;
    try {
      const { error } = await supabase.from('orders').update({ payment_confirmed: confirmed }).eq('id', orderId).eq('restaurant_id', restaurant.id);
      if (error) throw error;
      showNotification(`Payment ${confirmed ? 'confirmed' : 'unconfirmed'} successfully!`, 'success');
      loadOrders();
    } catch (error) {
      showNotification('Failed to update payment confirmation.', 'error');
      console.error('Error updating payment:', error);
    }
  };

  const assignRider = async (orderId: string, riderId: string) => {
    if (!restaurant?.id) return;
    try {
      await supabase
        .from('orders')
        .update({ assigned_rider_id: riderId })
        .eq('id', orderId)
        .eq('restaurant_id', restaurant.id);

      const tokenValue = `${orderId}-rider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await supabase.from('order_tracking_tokens').insert({
        token: tokenValue,
        order_id: orderId,
        token_type: 'RIDER',
        expires_at: expiresAt.toISOString(),
      });

      const riderUrl = restaurant?.slug
        ? `${window.location.origin}/${restaurant.slug}/rider/${tokenValue}`
        : `${window.location.origin}/rider/${tokenValue}`;
      const rider = riders.find(r => r.id === riderId);

      if (rider) {
        alert(`Rider ${rider.name} assigned!\n\nShare this link with the rider:\n${riderUrl}`);
        showNotification(`Rider ${rider.name} assigned successfully!`, 'success');
      }

      loadOrders();
    } catch (error) {
      console.error('Error assigning rider:', error);
      showNotification('Failed to assign rider. Please try again.', 'error');
    }
  };

  const getStatusConfig = (status: OrderStatus) => {
    const configs = {
      PENDING: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Pending' },
      CONFIRMED: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-50', label: 'Confirmed' },
      PREPARING: { icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50', label: 'Preparing' },
      READY_FOR_DELIVERY: { icon: Package, color: 'text-purple-500', bg: 'bg-purple-50', label: 'Ready' },
      DISPATCHED: { icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-50', label: 'Dispatched' },
      OUT_FOR_DELIVERY: { icon: Truck, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Out for Delivery' },
      DELIVERED: { icon: Home, color: 'text-green-500', bg: 'bg-green-50', label: 'Delivered' },
      CANCELLED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Cancelled' },
      RETURNED: { icon: AlertTriangle, color: 'text-gray-500', bg: 'bg-gray-50', label: 'Returned' },
    };
    return configs[status] || configs.PENDING;
  };

  const getNextActions = (status: OrderStatus) => {
    const actions: { label: string; status: OrderStatus; color: string }[] = [];

    if (status === 'PENDING') {
      actions.push({ label: 'Confirm Order', status: 'CONFIRMED', color: 'bg-blue-500 hover:bg-blue-600' });
      actions.push({ label: 'Cancel', status: 'CANCELLED', color: 'bg-red-500 hover:bg-red-600' });
    } else if (status === 'CONFIRMED') {
      actions.push({ label: 'Start Preparing', status: 'PREPARING', color: 'bg-orange-500 hover:bg-orange-600' });
    } else if (status === 'PREPARING') {
      actions.push({ label: 'Mark Ready', status: 'READY_FOR_DELIVERY', color: 'bg-purple-500 hover:bg-purple-600' });
    } else if (status === 'READY_FOR_DELIVERY') {
      actions.push({ label: 'Dispatch', status: 'DISPATCHED', color: 'bg-indigo-500 hover:bg-indigo-600' });
    } else if (status === 'DISPATCHED') {
      actions.push({ label: 'Out for Delivery', status: 'OUT_FOR_DELIVERY', color: 'bg-blue-600 hover:bg-blue-700' });
    } else if (status === 'OUT_FOR_DELIVERY') {
      actions.push({ label: 'Mark Delivered', status: 'DELIVERED', color: 'bg-green-500 hover:bg-green-600' });
    }

    return actions;
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {notification.message}
        </div>
      )}
      {restaurant?.is_payment_overdue && (
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="text-red-600 flex-shrink-0" size={24} />
          <div>
            <p className="text-red-900 font-semibold">Subscription Payment Overdue</p>
            <p className="text-red-700 text-sm mt-1">
              Your subscription payment is overdue. You cannot process orders until payment is confirmed.
              Please go to the Subscription tab to renew.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Order Management</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('new')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'new'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            New Orders ({orders.filter(o => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status)).length})
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'history'
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            History ({orders.filter(o => ['DELIVERED', 'CANCELLED', 'RETURNED'].includes(o.status)).length})
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="tel"
            placeholder="Search by phone number..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-500">
            {searchPhone ? 'No orders found for this phone number' : 'No orders yet'}
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            const StatusIcon = statusConfig.icon;
            const nextActions = getNextActions(order.status);

            return (
              <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex items-start justify-between mb-4 flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusConfig.bg}`}>
                        <StatusIcon className={statusConfig.color} size={18} />
                        <span className={`font-semibold text-sm ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <span className="text-sm text-gray-500">
                        #{order.id.slice(0, 8)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">
                      <strong>Phone:</strong> {order.phone_number}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>Type:</strong>{' '}
                      {order.is_self_pickup ? (
                        <span className="text-blue-600 font-medium">Self Pickup</span>
                      ) : (
                        <span className="text-green-600 font-medium">Home Delivery</span>
                      )}
                    </p>
                    <p className="text-sm text-gray-700">
                      <strong>{order.is_self_pickup ? 'Pickup Location' : 'Address'}:</strong> {order.delivery_address}
                    </p>
                    {order.delivery_notes && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                        <p className="text-xs font-semibold text-yellow-900">Delivery Notes:</p>
                        <p className="text-xs text-yellow-800">{order.delivery_notes}</p>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(order.total_amount, restaurant?.restaurant_currency || 'AED')}
                    </p>
                    {order.delivery_fee > 0 && !order.is_self_pickup && (
                      <p className="text-xs text-gray-600 mt-1">
                        (includes {formatCurrency(order.delivery_fee, restaurant?.restaurant_currency || 'AED')} delivery fee)
                      </p>
                    )}
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">
                        {order.payment_method === 'COD' ? 'Cash on Delivery' : 'Bank Transfer'}
                      </p>
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={order.payment_confirmed}
                          onChange={(e) => updatePaymentConfirmation(order.id, e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className={order.payment_confirmed ? 'text-green-600 font-medium' : 'text-gray-600'}>
                          {order.payment_confirmed ? 'Payment Confirmed' : 'Confirm Payment'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold text-gray-700 mb-2">Items:</h4>
                  <ul className="space-y-1">
                    {order.items.map((item) => (
                      <li key={item.id} className="text-sm text-gray-600 flex justify-between">
                        <span>
                          {item.quantity}x {item.item_name}
                          {item.item_type === 'BUNDLE' && (
                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              COMBO
                            </span>
                          )}
                        </span>
                        <span className="text-orange-600 font-medium">
                          {formatCurrency(item.price * item.quantity, restaurant?.restaurant_currency || 'AED')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {!order.is_self_pickup && order.status === 'READY_FOR_DELIVERY' && riders.length > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                      <User size={16} />
                      Assign Delivery Rider
                    </label>
                    <select
                      onChange={(e) => e.target.value && assignRider(order.id, e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      defaultValue=""
                    >
                      <option value="">Select a rider...</option>
                      {riders.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name} - {rider.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!order.is_self_pickup && order.assigned_rider_id && order.riderLink && (
                  <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <label className="flex items-center gap-2 text-sm font-medium text-green-900 mb-2">
                      <Truck size={16} />
                      Rider Assigned - Share Link with Rider
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={order.riderLink}
                        className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm text-gray-700"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(order.riderLink!);
                          showNotification('Link copied to clipboard!', 'success');
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                      >
                        <Copy size={16} />
                        Copy
                      </button>
                    </div>
                    <p className="text-xs text-green-700 mt-2">
                      Send this link to the rider so they can view the delivery address and update the order status.
                    </p>
                  </div>
                )}

                {nextActions.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {nextActions.map((action) => (
                      <button
                        key={action.status}
                        onClick={() => updateOrderStatus(order.id, action.status)}
                        className={`px-4 py-2 ${action.color} text-white rounded-lg text-sm font-medium transition-colors`}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
