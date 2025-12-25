import { useState, useEffect } from 'react';
import { DollarSign, ShoppingCart, CreditCard, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import type { Order } from '../../lib/database.types';

interface SalesData {
  totalOrders: number;
  totalRevenue: number;
  codOrders: number;
  bankTransferOrders: number;
  codRevenue: number;
  bankTransferRevenue: number;
  confirmedPayments: number;
}

interface SalesAnalyticsProps {
  currency?: string;
}

export function SalesAnalytics({ currency = 'USD' }: SalesAnalyticsProps) {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [salesData, setSalesData] = useState<SalesData>({
    totalOrders: 0,
    totalRevenue: 0,
    codOrders: 0,
    bankTransferOrders: 0,
    codRevenue: 0,
    bankTransferRevenue: 0,
    confirmedPayments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRestaurantId();
  }, [user?.id]);

  useEffect(() => {
    if (restaurantId) {
      loadSalesData();
    }
  }, [period, restaurantId]);

  const loadRestaurantId = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) setRestaurantId(data.id);
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'day':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return startDate.toISOString();
  };

  const loadSalesData = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const startDate = getDateRange();

    const { data: orders } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', restaurantId)
      .gte('created_at', startDate)
      .neq('status', 'CANCELLED');

    if (orders) {
      const data: SalesData = {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.total_amount, 0),
        codOrders: orders.filter((o) => o.payment_method === 'COD').length,
        bankTransferOrders: orders.filter((o) => o.payment_method === 'BANK_TRANSFER').length,
        codRevenue: orders
          .filter((o) => o.payment_method === 'COD')
          .reduce((sum, order) => sum + order.total_amount, 0),
        bankTransferRevenue: orders
          .filter((o) => o.payment_method === 'BANK_TRANSFER')
          .reduce((sum, order) => sum + order.total_amount, 0),
        confirmedPayments: orders.filter((o) => o.payment_confirmed).length,
      };

      setSalesData(data);
    }

    setLoading(false);
  };

  const StatCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: any;
    color: string;
  }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading sales data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Sales Analytics</h2>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium capitalize transition-colors ${
                period === p
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {p === 'day' ? 'Today' : p === 'week' ? 'Last 7 Days' : p === 'month' ? 'Last 30 Days' : 'Last Year'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(salesData.totalRevenue, currency)}
          icon={DollarSign}
          color="bg-green-500"
        />
        <StatCard
          title="Total Orders"
          value={salesData.totalOrders}
          subtitle={`${salesData.confirmedPayments} payments confirmed`}
          icon={ShoppingCart}
          color="bg-blue-500"
        />
        <StatCard
          title="COD Orders"
          value={salesData.codOrders}
          subtitle={formatCurrency(salesData.codRevenue, currency)}
          icon={DollarSign}
          color="bg-orange-500"
        />
        <StatCard
          title="Bank Transfer"
          value={salesData.bankTransferOrders}
          subtitle={formatCurrency(salesData.bankTransferRevenue, currency)}
          icon={CreditCard}
          color="bg-purple-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="text-orange-500" size={20} />
            Payment Method Breakdown
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Cash on Delivery</span>
                <span className="text-sm font-semibold text-orange-600">
                  {salesData.totalOrders > 0
                    ? ((salesData.codOrders / salesData.totalOrders) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full"
                  style={{
                    width: `${salesData.totalOrders > 0 ? (salesData.codOrders / salesData.totalOrders) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {salesData.codOrders} orders • {formatCurrency(salesData.codRevenue, currency)}
              </p>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Bank Transfer</span>
                <span className="text-sm font-semibold text-purple-600">
                  {salesData.totalOrders > 0
                    ? ((salesData.bankTransferOrders / salesData.totalOrders) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{
                    width: `${salesData.totalOrders > 0 ? (salesData.bankTransferOrders / salesData.totalOrders) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {salesData.bankTransferOrders} orders • {formatCurrency(salesData.bankTransferRevenue, currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-4">Payment Status</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Confirmed Payments</p>
                <p className="text-2xl font-bold text-green-600">{salesData.confirmedPayments}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {salesData.totalOrders > 0
                    ? ((salesData.confirmedPayments / salesData.totalOrders) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Pending Confirmation</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {salesData.totalOrders - salesData.confirmedPayments}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">
                  {salesData.totalOrders > 0
                    ? (((salesData.totalOrders - salesData.confirmedPayments) / salesData.totalOrders) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="font-semibold text-lg mb-4">Summary</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-1">Average Order Value</p>
            <p className="text-xl font-bold text-gray-800">
              {formatCurrency(salesData.totalOrders > 0 ? (salesData.totalRevenue / salesData.totalOrders) : 0, currency)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-1">COD Average</p>
            <p className="text-xl font-bold text-gray-800">
              {formatCurrency(salesData.codOrders > 0 ? (salesData.codRevenue / salesData.codOrders) : 0, currency)}
            </p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 mb-1">Bank Transfer Average</p>
            <p className="text-xl font-bold text-gray-800">
              {formatCurrency(salesData.bankTransferOrders > 0
                ? (salesData.bankTransferRevenue / salesData.bankTransferOrders)
                : 0, currency)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
