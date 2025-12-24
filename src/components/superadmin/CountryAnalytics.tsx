import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import { Globe, TrendingUp, Building2, ShoppingCart } from 'lucide-react';

interface CountryStats {
  country: string;
  country_name: string;
  currency: string;
  active_restaurants: number;
  trial_restaurants: number;
  total_orders_this_month: number;
  total_revenue: number;
  monthly_recurring_revenue: number;
}

export default function CountryAnalytics() {
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [restaurantsData, tiersData, ordersData, paymentsData] = await Promise.all([
        supabase.from('restaurants').select('country, status, tier_id'),
        supabase.from('subscription_tiers').select('id, country, country_name, currency, monthly_price'),
        supabase
          .from('orders')
          .select('restaurant_id, created_at, status')
          .gte('created_at', startOfMonth.toISOString())
          .neq('status', 'CANCELLED'),
        supabase
          .from('payment_receipts')
          .select('restaurant_id, amount, currency, status')
          .eq('status', 'APPROVED')
      ]);

      if (restaurantsData.data && tiersData.data) {
        const tierMap = new Map(tiersData.data.map(t => [t.id, t]));

        const countryMap = new Map<string, CountryStats>();

        restaurantsData.data.forEach(restaurant => {
          const tier = tierMap.get(restaurant.tier_id);
          if (!tier) return;

          if (!countryMap.has(restaurant.country)) {
            countryMap.set(restaurant.country, {
              country: restaurant.country,
              country_name: tier.country_name,
              currency: tier.currency,
              active_restaurants: 0,
              trial_restaurants: 0,
              total_orders_this_month: 0,
              total_revenue: 0,
              monthly_recurring_revenue: 0
            });
          }

          const stats = countryMap.get(restaurant.country)!;
          if (restaurant.status === 'ACTIVE') {
            stats.active_restaurants++;
            stats.monthly_recurring_revenue += Number(tier.monthly_price);
          } else if (restaurant.status === 'TRIAL') {
            stats.trial_restaurants++;
          }
        });

        if (ordersData.data) {
          const restaurantCountryMap = new Map(
            restaurantsData.data.map(r => [r.tier_id, r.country])
          );

          ordersData.data.forEach(order => {
            const restaurant = restaurantsData.data.find(r =>
              tiersData.data.some(t => t.id === r.tier_id)
            );
            if (restaurant) {
              const stats = countryMap.get(restaurant.country);
              if (stats) {
                stats.total_orders_this_month++;
              }
            }
          });
        }

        if (paymentsData.data) {
          paymentsData.data.forEach(payment => {
            const restaurant = restaurantsData.data.find(r =>
              r.tier_id && tierMap.has(r.tier_id)
            );
            if (restaurant) {
              const stats = countryMap.get(restaurant.country);
              if (stats) {
                stats.total_revenue += Number(payment.amount);
              }
            }
          });
        }

        setCountryStats(Array.from(countryMap.values()).sort((a, b) =>
          b.active_restaurants - a.active_restaurants
        ));
      }
    } catch (error) {
      console.error('Error loading country analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = selectedCountry
    ? countryStats.filter(s => s.country === selectedCountry)
    : countryStats;

  const totalStats = countryStats.reduce(
    (acc, stat) => ({
      active: acc.active + stat.active_restaurants,
      trial: acc.trial + stat.trial_restaurants,
      orders: acc.orders + stat.total_orders_this_month
    }),
    { active: 0, trial: 0, orders: 0 }
  );

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Country-Based Analytics</h3>
        <select
          value={selectedCountry || ''}
          onChange={(e) => setSelectedCountry(e.target.value || null)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Countries</option>
          {countryStats.map(stat => (
            <option key={stat.country} value={stat.country}>
              {stat.country_name} ({stat.country})
            </option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Total Active</h4>
            <Building2 size={20} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalStats.active}</p>
          <p className="text-xs text-gray-500 mt-1">Paying customers</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Total Trial</h4>
            <Building2 size={20} className="text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalStats.trial}</p>
          <p className="text-xs text-gray-500 mt-1">Trial period</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-gray-600">Total Orders</h4>
            <ShoppingCart size={20} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalStats.orders}</p>
          <p className="text-xs text-gray-500 mt-1">This month</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Country
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Currency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Active
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trial
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Orders (Month)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                MRR
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Total Revenue
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStats.map((stat) => (
              <tr key={stat.country} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-gray-400" />
                    <div>
                      <div className="font-medium text-gray-900">{stat.country_name}</div>
                      <div className="text-xs text-gray-500">{stat.country}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-700 font-medium">{stat.currency}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                    {stat.active_restaurants}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">
                    {stat.trial_restaurants}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-700">{stat.total_orders_this_month}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    <TrendingUp size={14} className="text-blue-600" />
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(stat.monthly_recurring_revenue, stat.currency)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  {formatCurrency(stat.total_revenue, stat.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
