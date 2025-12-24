import { useState, useEffect } from 'react';
import { Users, Search, TrendingUp, ShoppingBag, DollarSign, Calendar, Phone, Mail, MapPin, Package, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
  order_count: number;
  total_spent: number;
  last_order_date: string | null;
  addresses: CustomerAddress[];
}

interface CustomerAddress {
  label: string;
  full_address: string;
  city: string;
}

interface CustomerOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  items_count: number;
}

interface CustomerStats {
  total_customers: number;
  new_customers_this_month: number;
  returning_customers: number;
  total_revenue: number;
  average_order_value: number;
}

export function CustomerManagement() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'orders' | 'spent'>('recent');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Record<string, CustomerOrder[]>>({});
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [currency, setCurrency] = useState<string>('AED');

  useEffect(() => {
    loadRestaurant();
  }, [user?.id]);

  useEffect(() => {
    if (restaurantId) {
      loadCustomers();
      loadStats();
    }
  }, [restaurantId]);

  useEffect(() => {
    filterAndSortCustomers();
  }, [customers, searchTerm, sortBy]);

  const loadRestaurant = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('restaurants')
      .select('id, currency')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (data) {
      setRestaurantId(data.id);
      setCurrency(data.currency || 'AED');
    }
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('customer_id, total_amount, created_at, status')
        .eq('restaurant_id', restaurantId)
        .not('customer_id', 'is', null);

      if (!orders) return;

      const customerMap = new Map<string, {
        orderCount: number;
        totalSpent: number;
        lastOrderDate: string | null;
      }>();

      orders.forEach(order => {
        if (!order.customer_id) return;

        const existing = customerMap.get(order.customer_id) || {
          orderCount: 0,
          totalSpent: 0,
          lastOrderDate: null
        };

        existing.orderCount++;
        existing.totalSpent += order.total_amount;

        if (!existing.lastOrderDate || order.created_at > existing.lastOrderDate) {
          existing.lastOrderDate = order.created_at;
        }

        customerMap.set(order.customer_id, existing);
      });

      const customerIds = Array.from(customerMap.keys());

      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, phone, email, created_at')
        .in('id', customerIds);

      if (!customersData) return;

      const customersWithStats = await Promise.all(
        customersData.map(async (customer) => {
          const stats = customerMap.get(customer.id);

          const { data: addresses } = await supabase
            .from('customer_addresses')
            .select('label, full_address, city')
            .eq('customer_id', customer.id);

          return {
            ...customer,
            order_count: stats?.orderCount || 0,
            total_spent: stats?.totalSpent || 0,
            last_order_date: stats?.lastOrderDate || null,
            addresses: addresses || []
          };
        })
      );

      setCustomers(customersWithStats);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('customer_id, total_amount, created_at')
        .eq('restaurant_id', restaurantId)
        .not('customer_id', 'is', null);

      if (!orders) return;

      const uniqueCustomers = new Set(orders.map(o => o.customer_id));
      const total_customers = uniqueCustomers.size;

      const thisMonthStart = new Date();
      thisMonthStart.setDate(1);
      thisMonthStart.setHours(0, 0, 0, 0);

      const { data: newCustomersData } = await supabase
        .from('customers')
        .select('id')
        .gte('created_at', thisMonthStart.toISOString())
        .in('id', Array.from(uniqueCustomers));

      const new_customers_this_month = newCustomersData?.length || 0;

      const customerOrderCounts = new Map<string, number>();
      orders.forEach(order => {
        if (order.customer_id) {
          customerOrderCounts.set(
            order.customer_id,
            (customerOrderCounts.get(order.customer_id) || 0) + 1
          );
        }
      });

      const returning_customers = Array.from(customerOrderCounts.values())
        .filter(count => count > 1).length;

      const total_revenue = orders.reduce((sum, order) => sum + order.total_amount, 0);
      const average_order_value = orders.length > 0 ? total_revenue / orders.length : 0;

      setStats({
        total_customers,
        new_customers_this_month,
        returning_customers,
        total_revenue,
        average_order_value
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filterAndSortCustomers = () => {
    let filtered = [...customers];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(customer =>
        customer.name.toLowerCase().includes(term) ||
        customer.phone.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'orders':
          return b.order_count - a.order_count;
        case 'spent':
          return b.total_spent - a.total_spent;
        case 'recent':
        default:
          return new Date(b.last_order_date || b.created_at).getTime() -
                 new Date(a.last_order_date || a.created_at).getTime();
      }
    });

    setFilteredCustomers(filtered);
  };

  const loadCustomerOrders = async (customerId: string) => {
    if (customerOrders[customerId]) return;

    const { data: orders } = await supabase
      .from('orders')
      .select('id, created_at, total_amount, status')
      .eq('customer_id', customerId)
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (orders) {
      const ordersWithItemCount = await Promise.all(
        orders.map(async (order) => {
          const { count } = await supabase
            .from('order_items')
            .select('id', { count: 'exact', head: true })
            .eq('order_id', order.id);

          return {
            ...order,
            items_count: count || 0
          };
        })
      );

      setCustomerOrders(prev => ({
        ...prev,
        [customerId]: ordersWithItemCount
      }));
    }
  };

  const handleExpandCustomer = (customerId: string) => {
    if (expandedCustomer === customerId) {
      setExpandedCustomer(null);
    } else {
      setExpandedCustomer(customerId);
      loadCustomerOrders(customerId);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-700',
      'CONFIRMED': 'bg-blue-100 text-blue-700',
      'PREPARING': 'bg-orange-100 text-orange-700',
      'READY_FOR_DELIVERY': 'bg-purple-100 text-purple-700',
      'OUT_FOR_DELIVERY': 'bg-indigo-100 text-indigo-700',
      'DELIVERED': 'bg-green-100 text-green-700',
      'CANCELLED': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_customers}</p>
              </div>
              <Users className="text-blue-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">New This Month</p>
                <p className="text-3xl font-bold text-green-600">{stats.new_customers_this_month}</p>
              </div>
              <TrendingUp className="text-green-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Returning</p>
                <p className="text-3xl font-bold text-purple-600">{stats.returning_customers}</p>
              </div>
              <ShoppingBag className="text-purple-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-orange-600">
                  {formatCurrency(stats.total_revenue, currency)}
                </p>
              </div>
              <DollarSign className="text-orange-500" size={40} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Order Value</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(stats.average_order_value, currency)}
                </p>
              </div>
              <Package className="text-blue-500" size={40} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="recent">Most Recent</option>
            <option value="orders">Most Orders</option>
            <option value="spent">Highest Spent</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Users size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No customers found</p>
          </div>
        ) : (
          filteredCustomers.map((customer) => {
            const isExpanded = expandedCustomer === customer.id;
            const orders = customerOrders[customer.id] || [];

            return (
              <div key={customer.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleExpandCustomer(customer.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="font-semibold text-gray-900">{customer.name}</div>
                          {customer.order_count === 1 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                          <Phone size={12} />
                          {customer.phone}
                        </div>
                        {customer.email && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                            <Mail size={12} />
                            {customer.email}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-sm text-gray-600">Orders</div>
                        <div className="text-2xl font-bold text-orange-600">{customer.order_count}</div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-600">Total Spent</div>
                        <div className="text-xl font-bold text-green-600">
                          {formatCurrency(customer.total_spent, currency)}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-600">Last Order</div>
                        <div className="text-sm font-medium text-gray-900 flex items-center gap-1">
                          <Clock size={14} />
                          {customer.last_order_date ? formatDate(customer.last_order_date) : 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Customer since {formatDate(customer.created_at)}
                        </div>
                      </div>
                    </div>

                    <button className="ml-4 p-2 hover:bg-gray-100 rounded-lg">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Customer Details */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Customer Details</h4>
                        <div className="bg-white rounded-lg p-4 space-y-3">
                          <div>
                            <div className="text-sm text-gray-600">Contact</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone size={14} className="text-gray-400" />
                              <span className="text-sm">{customer.phone}</span>
                            </div>
                            {customer.email && (
                              <div className="flex items-center gap-2 mt-1">
                                <Mail size={14} className="text-gray-400" />
                                <span className="text-sm">{customer.email}</span>
                              </div>
                            )}
                          </div>

                          {customer.addresses.length > 0 && (
                            <div>
                              <div className="text-sm text-gray-600 mb-2">Saved Addresses</div>
                              {customer.addresses.map((address, idx) => (
                                <div key={idx} className="flex items-start gap-2 mb-2">
                                  <MapPin size={14} className="text-gray-400 mt-0.5" />
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-700">{address.label}</div>
                                    <div className="text-gray-600">{address.full_address}</div>
                                    <div className="text-gray-500">{address.city}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="pt-3 border-t">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-600">Total Orders</div>
                                <div className="text-xl font-bold text-orange-600">{customer.order_count}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-600">Lifetime Value</div>
                                <div className="text-xl font-bold text-green-600">
                                  {formatCurrency(customer.total_spent, currency)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Order History */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Order History</h4>
                        <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto">
                          {orders.length === 0 ? (
                            <p className="text-gray-500 text-sm">Loading orders...</p>
                          ) : (
                            <div className="space-y-3">
                              {orders.map((order) => (
                                <div key={order.id} className="pb-3 border-b last:border-b-0">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Calendar size={14} className="text-gray-400" />
                                      <span className="text-sm font-medium">
                                        {formatDate(order.created_at)}
                                      </span>
                                      <span className={`text-xs px-2 py-0.5 rounded ${getStatusColor(order.status)}`}>
                                        {order.status}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-600">{order.items_count} items</span>
                                    <span className="font-bold text-orange-600">
                                      {formatCurrency(order.total_amount, currency)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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
