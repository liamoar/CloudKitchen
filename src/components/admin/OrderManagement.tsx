import { useState, useEffect, useRef } from 'react';
import { 
  Search, Clock, CheckCircle, ChefHat, Package, Truck, Home, 
  XCircle, AlertTriangle, User, Copy, Phone, MapPin, CreditCard,
  User as UserIcon, Calendar, DollarSign, ChevronDown, ChevronUp,
  ArrowRight, Check, X, RefreshCw, Mail, UserCheck
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import type { Order, OrderItem, OrderStatus, PaymentMethod } from '../../lib/database.types';

interface OrderWithItems extends Order {
  items: OrderItem[];
  riderLink?: string;
  customerLink?: string;
  customerName?: string;
  customerEmail?: string;
  customerOrderCount?: number;
  isNewCustomer?: boolean;
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

const ITEMS_PER_PAGE = 10;

interface OrderManagementProps {
  currency?: string;
}

export function OrderManagement({ currency: propCurrency }: OrderManagementProps) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);

  const currency = propCurrency || restaurant?.restaurant_currency || 'USD';
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [newOrders, setNewOrders] = useState<Set<string>>(new Set());
  
  // Store scroll position when updating
  const scrollPositionRef = useRef(0);
  const isUpdatingRef = useRef(false);

  // Load restaurant and orders
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

  // Filter orders when criteria change
  useEffect(() => {
    filterOrders();
    setCurrentPage(1);
  }, [orders, searchTerm, selectedStatus]);

  // Restore scroll position after updates
  useEffect(() => {
    if (isUpdatingRef.current) {
      window.scrollTo(0, scrollPositionRef.current);
      isUpdatingRef.current = false;
    }
  }, [orders]);

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

          let customerName = 'Customer';
          let customerEmail = '';
          let customerOrderCount = 0;
          let isNewCustomer = true;
          let riderLink: string | undefined;
          let customerLink: string | undefined;

          if (order.customer_id) {
            const { data: customer } = await supabase
              .from('customers')
              .select('name, email')
              .eq('id', order.customer_id)
              .maybeSingle();

            if (customer) {
              customerName = customer.name;
              customerEmail = customer.email || '';
            }

            const { count } = await supabase
              .from('orders')
              .select('id', { count: 'exact', head: true })
              .eq('customer_id', order.customer_id)
              .eq('restaurant_id', restaurant.id);

            customerOrderCount = count || 0;
            isNewCustomer = customerOrderCount === 1;
          }

          // Get rider tracking token
          if (order.assigned_rider_id) {
            const { data: riderToken } = await supabase
              .from('order_tracking_tokens')
              .select('token')
              .eq('order_id', order.id)
              .eq('token_type', 'RIDER')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (riderToken) {
              riderLink = `${window.location.origin}/rider/${riderToken.token}`;
            }
          }

          // Get customer tracking token
          const { data: customerToken } = await supabase
            .from('order_tracking_tokens')
            .select('token')
            .eq('order_id', order.id)
            .eq('token_type', 'CUSTOMER')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (customerToken) {
            customerLink = `${window.location.origin}/track/${customerToken.token}`;
          }

          return {
            ...order,
            items: items || [],
            riderLink,
            customerLink,
            customerName,
            customerEmail,
            customerOrderCount,
            isNewCustomer
          };
        })
      );
      
      // Identify new orders
      const currentOrderIds = new Set(ordersWithItems.map(o => o.id));
      const previousOrderIds = new Set(orders.map(o => o.id));
      const newlyAdded = ordersWithItems
        .filter(o => !previousOrderIds.has(o.id) && !['DELIVERED', 'CANCELLED'].includes(o.status))
        .map(o => o.id);
      
      if (newlyAdded.length > 0) {
        setNewOrders(prev => new Set([...prev, ...newlyAdded]));
      }
      
      setOrders(ordersWithItems);
    }
    setLoading(false);
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (selectedStatus !== 'all') {
      if (selectedStatus === 'active') {
        filtered = filtered.filter(
          (order) => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status)
        );
      } else if (selectedStatus === 'new') {
        filtered = filtered.filter(
          (order) => order.status === 'PENDING'
        );
      } else {
        filtered = filtered.filter((order) => order.status === selectedStatus);
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((order) =>
        order.phone_number.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term) ||
        order.delivery_address.toLowerCase().includes(term) ||
        order.customerName?.toLowerCase().includes(term)
      );
    }

    setFilteredOrders(filtered);
  };

  // Remove from new orders when viewed
  const handleExpandOrder = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
    setNewOrders(prev => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  };

  // Save scroll position before update
  const saveScrollPosition = () => {
    scrollPositionRef.current = window.scrollY;
    isUpdatingRef.current = true;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!restaurant?.id) return;
    if (restaurant?.is_payment_overdue) {
      showNotification('Cannot process orders. Your subscription payment is overdue.', 'error');
      return;
    }
    
    saveScrollPosition();
    
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
    
    saveScrollPosition();
    
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
    
    saveScrollPosition();
    
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

      const riderUrl = `${window.location.origin}/rider/${tokenValue}`;
      const rider = riders.find(r => r.id === riderId);

      if (rider) {
        showNotification(`Rider ${rider.name} assigned successfully!`, 'success');
        
        // Show rider URL for sharing
        setTimeout(() => {
          alert(`Rider ${rider.name} assigned!\n\nShare this link with the rider:\n${riderUrl}\n\nOr copy it from the order details.`);
        }, 100);
      }

      loadOrders();
    } catch (error) {
      console.error('Error assigning rider:', error);
      showNotification('Failed to assign rider. Please try again.', 'error');
    }
  };

  const getStatusConfig = (status: OrderStatus) => {
    const configs = {
      PENDING: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', label: 'Pending' },
      CONFIRMED: { icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', label: 'Confirmed' },
      PREPARING: { icon: ChefHat, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', label: 'Preparing' },
      READY_FOR_DELIVERY: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', label: 'Ready for Delivery' },
      DISPATCHED: { icon: Truck, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', label: 'Dispatched (Rider Assigned)' },
      OUT_FOR_DELIVERY: { icon: Truck, color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300', label: 'Out for Delivery' },
      DELIVERED: { icon: Home, color: 'text-green-600', bg: 'bg-green-50 border-green-200', label: 'Delivered' },
      CANCELLED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200', label: 'Cancelled' },
      RETURNED: { icon: AlertTriangle, color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', label: 'Returned' },
    };
    return configs[status] || configs.PENDING;
  };

  const getNextStatus = (currentStatus: OrderStatus): OrderStatus | null => {
    const flow: Record<OrderStatus, OrderStatus | null> = {
      PENDING: 'CONFIRMED',
      CONFIRMED: 'PREPARING',
      PREPARING: 'READY_FOR_DELIVERY',
      READY_FOR_DELIVERY: 'DISPATCHED',
      DISPATCHED: 'OUT_FOR_DELIVERY',
      OUT_FOR_DELIVERY: 'DELIVERED',
      DELIVERED: null,
      CANCELLED: null,
      RETURNED: null,
    };
    return flow[currentStatus];
  };

  const getStatusOptions = (currentStatus: OrderStatus) => {
    if (currentStatus === 'DELIVERED' || currentStatus === 'CANCELLED') {
      return [];
    }
    
    const allStatuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY_FOR_DELIVERY', 'DISPATCHED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentIndex = allStatuses.indexOf(currentStatus);
    return allStatuses.slice(currentIndex + 1);
  };

  const StatusBadge = ({ status }: { status: OrderStatus }) => {
    const config = getStatusConfig(status);
    const Icon = config.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color} border`}>
        <Icon size={14} />
        {config.label}
      </span>
    );
  };

  const OrderCard = ({ order }: { order: OrderWithItems }) => {
    const statusConfig = getStatusConfig(order.status);
    const isExpanded = expandedOrder === order.id;
    const isNew = newOrders.has(order.id);
    const nextStatus = getNextStatus(order.status);
    const statusOptions = getStatusOptions(order.status);
    const isFinalStatus = order.status === 'DELIVERED' || order.status === 'CANCELLED';

    // Format date and time
    const orderDate = new Date(order.created_at);
    const formattedDate = orderDate.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
    const formattedTime = orderDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    return (
      <div 
        id={`order-${order.id.slice(0, 8)}`}
        className={`bg-white border rounded-lg mb-4 overflow-hidden transition-all duration-200 ${isNew ? 'border-l-4 border-l-orange-500' : ''} ${isNew ? 'bg-orange-50' : ''}`}
      >
        {/* Order Header */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {/* Top Row: Order ID, Status, Date */}
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900">#{order.id.slice(0, 8)}</span>
                  {isNew && (
                    <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                  )}
                  {order.is_self_pickup && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      PICKUP
                    </span>
                  )}
                </div>
                <StatusBadge status={order.status} />
                <div className="text-sm text-gray-500 ml-auto">
                  <Calendar size={14} className="inline mr-1" />
                  {formattedDate} at {formattedTime}
                </div>
              </div>
              
              {/* Middle Row: Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <UserIcon size={16} className="text-gray-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-gray-900">{order.customerName}</div>
                      {order.isNewCustomer && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                          NEW
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.customerOrderCount && order.customerOrderCount > 1 ? `${order.customerOrderCount} orders` : 'First order'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={16} className="text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{order.phone_number}</div>
                    {order.customerEmail && (
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Mail size={12} />
                        {order.customerEmail}
                      </div>
                    )}
                    {!order.customerEmail && (
                      <div className="text-sm text-gray-500">Phone</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900 capitalize">{order.payment_method === 'COD' ? 'Cash on Delivery' : 'Bank Transfer'}</div>
                    <div className="flex items-center gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${order.payment_confirmed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {order.payment_confirmed ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign size={16} className="text-gray-400" />
                  <div>
                    <div className="font-bold text-lg text-orange-600">
                      {formatCurrency(order.total_amount, currency)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="text-sm">
                <div className="flex items-start gap-2">
                  <MapPin size={16} className="text-gray-400 mt-0.5" />
                  <span className="text-gray-700">{order.delivery_address}</span>
                </div>
                {order.delivery_notes && (
                  <div className="mt-1 text-gray-600 italic">"{order.delivery_notes}"</div>
                )}
              </div>
            </div>
            
            <button
              onClick={() => handleExpandOrder(order.id)}
              className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="p-4 bg-gray-50 border-t">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Column - Order Details */}
              <div className="space-y-4">
                {/* Items */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Order Items</h4>
                  <div className="bg-white border rounded-lg p-3">
                    <ul className="space-y-2">
                      {order.items.map((item) => (
                        <li key={item.id} className="flex justify-between items-center py-1 border-b last:border-b-0">
                          <div>
                            <span className="font-medium">{item.quantity}x {item.item_name}</span>
                            {item.item_type === 'BUNDLE' && (
                              <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                COMBO
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-orange-600">
                            {formatCurrency(item.price * item.quantity, currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="flex justify-between mt-3 pt-3 border-t">
                      <span className="font-medium">Items Total</span>
                      <span className="font-bold">
                        {formatCurrency(order.total_amount - (order.delivery_fee || 0), currency)}
                      </span>
                    </div>
                    {order.delivery_fee > 0 && (
                      <div className="flex justify-between mt-2">
                        <span className="text-gray-600">Delivery Fee</span>
                        <span className="text-gray-700">
                          {formatCurrency(order.delivery_fee, currency)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between mt-2 pt-2 border-t font-bold">
                      <span>Total Amount</span>
                      <span className="text-orange-600">
                        {formatCurrency(order.total_amount, currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Customer Details</h4>
                  <div className="bg-white border rounded-lg p-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <UserIcon size={18} className="text-gray-400" />
                      <div>
                        <div className="font-medium">{order.customerName}</div>
                        <div className="text-sm text-gray-500">Customer Name</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-gray-400" />
                      <div>
                        <div className="font-medium">{order.phone_number}</div>
                        <div className="text-sm text-gray-500">Phone Number</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-gray-400 mt-0.5" />
                      <div>
                        <div className="font-medium">{order.delivery_address}</div>
                        <div className="text-sm text-gray-500">Delivery Address</div>
                        {order.delivery_notes && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                            <span className="font-medium text-yellow-800">Note: </span>
                            <span className="text-yellow-700">{order.delivery_notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-4">
                {/* Status Update - Only show for non-final statuses */}
                {!isFinalStatus && (
                  <div>
                    <h4 className="font-semibold text-gray-700 mb-2">Update Status</h4>
                    <div className="bg-white border rounded-lg p-3">
                      {/* Next Status Button */}
                      {nextStatus && (
                        <div className="mb-4">
                          <button
                            onClick={() => updateOrderStatus(order.id, nextStatus)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                          >
                            <ArrowRight size={18} />
                            Mark as {getStatusConfig(nextStatus).label}
                          </button>
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            Click to move to next status in workflow
                          </p>
                        </div>
                      )}
                      
                      {/* Cancel Button */}
                      {order.status !== 'CANCELLED' && (
                        <div className="mb-4">
                          <button
                            onClick={() => updateOrderStatus(order.id, 'CANCELLED')}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                          >
                            <X size={18} />
                            Cancel Order
                          </button>
                        </div>
                      )}
                      
                      {/* All Status Options */}
                      {statusOptions.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Or select specific status:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map((status) => (
                              <button
                                key={status}
                                onClick={() => updateOrderStatus(order.id, status)}
                                className={`px-3 py-2 rounded text-sm ${getStatusConfig(status).bg} ${getStatusConfig(status).color} border hover:opacity-90 transition-opacity`}
                              >
                                {getStatusConfig(status).label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Confirmation */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2">Payment Status</h4>
                  <div className="bg-white border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-medium">Payment Method</div>
                        <div className="text-sm text-gray-600 capitalize">{order.payment_method === 'COD' ? 'Cash on Delivery' : 'Bank Transfer'}</div>
                      </div>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={order.payment_confirmed}
                            onChange={(e) => updatePaymentConfirmation(order.id, e.target.checked)}
                            className="sr-only"
                            disabled={isFinalStatus && !order.payment_confirmed}
                          />
                          <div className={`w-12 h-6 rounded-full transition-colors ${order.payment_confirmed ? 'bg-green-500' : 'bg-gray-300'} ${isFinalStatus && !order.payment_confirmed ? 'opacity-50' : ''}`}>
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${order.payment_confirmed ? 'left-7' : 'left-1'}`} />
                          </div>
                        </div>
                        <span className={`font-medium ${order.payment_confirmed ? 'text-green-600' : 'text-gray-600'} ${isFinalStatus && !order.payment_confirmed ? 'opacity-50' : ''}`}>
                          {order.payment_confirmed ? 'Confirmed' : 'Pending'}
                        </span>
                      </label>
                    </div>
                    {isFinalStatus && !order.payment_confirmed && (
                      <p className="text-xs text-red-500 mt-2">
                        Note: Cannot confirm payment for delivered/cancelled orders
                      </p>
                    )}
                  </div>
                </div>

                {/* Tracking & Rider Assignment */}
                <div className="space-y-3">
                  {/* Customer Tracking - Only show if link exists */}
                  {order.customerLink && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Customer Tracking Link</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          readOnly
                          value={order.customerLink}
                          className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
                        />
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(order.customerLink!);
                            showNotification('Customer tracking link copied to clipboard!', 'success');
                          }}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                        >
                          <Copy size={16} />
                          Copy
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        Share this link with the customer to track their order
                      </p>
                    </div>
                  )}

                  {/* Rider Assignment & Link */}
                  {!order.is_self_pickup && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2">Delivery Management</h4>
                      <div className="bg-white border rounded-lg p-3 space-y-3">
                        {/* Rider Assignment for READY_FOR_DELIVERY */}
                        {order.status === 'READY_FOR_DELIVERY' && riders.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Assign Rider</label>
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
                            <p className="text-xs text-gray-500 mt-2">
                              Assigning a rider will change status to DISPATCHED
                            </p>
                          </div>
                        )}

                        {/* Rider Link for assigned riders */}
                        {order.riderLink && (
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">Rider Tracking Link</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={order.riderLink}
                                className="flex-1 px-3 py-2 border rounded-lg text-sm bg-gray-50"
                              />
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(order.riderLink!);
                                  showNotification('Rider link copied to clipboard!', 'success');
                                }}
                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                              >
                                <Copy size={16} />
                                Copy
                              </button>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Share this link with the assigned rider
                            </p>
                          </div>
                        )}

                        {/* Assigned Rider Info */}
                        {order.assigned_rider_id && (
                          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                            <UserCheck size={16} className="text-blue-600" />
                            <span className="text-sm text-blue-700">Rider assigned to this order</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="text-gray-600 mt-3">Loading orders...</p>
        </div>
      </div>
    );
  }

  // Calculate pagination values (MOVED INSIDE THE COMPONENT BODY)
  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {notification.message}
        </div>
      )}

      {/* Overdue Payment Warning */}
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

      {/* Header with Stats */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Order Management</h1>
            <p className="text-gray-600">Manage and track customer orders</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">{filteredOrders.length}</div>
              <div className="text-sm text-gray-600">Total Orders</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-600">{newOrders.size}</div>
              <div className="text-sm text-gray-600">New Orders</div>
            </div>
            <button
              onClick={loadOrders}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, phone, or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Orders</option>
              <option value="new">New (Pending)</option>
              <option value="active">Active Orders</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PREPARING">Preparing</option>
              <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Quick Status Stats */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {(['PENDING', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY'] as const).map((status) => {
              const count = orders.filter(o => o.status === status).length;
              if (count === 0) return null;
              
              const config = getStatusConfig(status);
              return (
                <button
                  key={status}
                  onClick={() => setSelectedStatus(status)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${selectedStatus === status ? config.bg + ' ' + config.color : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  <config.icon size={14} />
                  <span>{config.label}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${selectedStatus === status ? 'bg-white' : 'bg-gray-200'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-end">
            <span className="text-gray-600">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
            </span>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div>
        {currentOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No orders found</h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try changing your search criteria' : 'No orders have been placed yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Order Cards */}
            <div className="space-y-4">
              {currentOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex justify-center">
                <nav className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-2 rounded-lg border transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                  >
                    Previous
                  </button>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-4 py-2 rounded-lg transition-colors ${currentPage === pageNum ? 'bg-orange-500 text-white' : 'border hover:bg-gray-50'}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-2 rounded-lg border transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </nav>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}