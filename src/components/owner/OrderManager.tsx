import { useState, useEffect } from 'react';
import { Clock, CheckCircle, ChefHat, Package } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Order, OrderItem, OrderStatus } from '../../lib/database.types';

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export function OrderManager() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadOrders = async () => {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersData) {
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', order.id);
          return { ...order, items: items || [] };
        })
      );
      setOrders(ordersWithItems);
    }
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    loadOrders();
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="text-yellow-500" size={20} />;
      case 'CONFIRMED':
        return <CheckCircle className="text-blue-500" size={20} />;
      case 'PREPARING':
        return <ChefHat className="text-orange-500" size={20} />;
      case 'COMPLETED':
        return <Package className="text-green-500" size={20} />;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading orders...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Orders</h2>

      <div className="grid gap-4">
        {orders.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-md text-center text-gray-500">
            No orders yet
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(order.status)}
                    <span className="font-semibold text-gray-800">
                      Order #{order.id.slice(0, 8)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(order.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    <strong>Phone:</strong> {order.phone_number}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Address:</strong> {order.delivery_address}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-orange-600">
                    ₹{order.total_amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">COD</p>
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
                      <span className="text-orange-600">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'CONFIRMED')}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm"
                  >
                    Confirm
                  </button>
                )}
                {order.status === 'CONFIRMED' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm"
                  >
                    Start Preparing
                  </button>
                )}
                {order.status === 'PREPARING' && (
                  <button
                    onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                  >
                    Mark Completed
                  </button>
                )}
                {order.status === 'COMPLETED' && (
                  <span className="text-sm text-green-600 font-medium">Order Completed</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
