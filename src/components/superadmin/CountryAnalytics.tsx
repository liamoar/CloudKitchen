import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../lib/utils';
import {
  Globe, TrendingUp, Building2, ShoppingCart, Users,
  DollarSign, RefreshCw, Calendar, Award
} from 'lucide-react';

interface CountryStats {
  country: string;
  country_name: string;
  currency: string;
  total_revenue: number;
  monthly_recurring_revenue: number;
  total_renewals: number;
  active_businesses: number;
  trial_businesses: number;
  basic_tier_businesses: number;
  premium_tier_businesses: number;
  new_businesses_this_month: number;
  total_businesses: number;
}

export default function CountryAnalytics() {
  const [countryStats, setCountryStats] = useState<CountryStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: tiers } = await supabase
        .from('subscription_tiers')
        .select('*');

      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('*');

      const { data: invoices } = await supabase
        .from('payment_invoices')
        .select('*')
        .eq('status', 'APPROVED');

      if (!tiers || !restaurants) {
        setLoading(false);
        return;
      }

      const countryMap = new Map<string, CountryStats>();

      tiers.forEach(tier => {
        if (!countryMap.has(tier.country)) {
          countryMap.set(tier.country, {
            country: tier.country,
            country_name: tier.country_name,
            currency: tier.currency,
            total_revenue: 0,
            monthly_recurring_revenue: 0,
            total_renewals: 0,
            active_businesses: 0,
            trial_businesses: 0,
            basic_tier_businesses: 0,
            premium_tier_businesses: 0,
            new_businesses_this_month: 0,
            total_businesses: 0,
          });
        }
      });

      restaurants.forEach(restaurant => {
        const tier = tiers.find(t => t.id === restaurant.current_tier_id);
        if (!tier) return;

        const stats = countryMap.get(restaurant.country);
        if (!stats) return;

        stats.total_businesses++;

        if (restaurant.subscription_status === 'ACTIVE') {
          stats.active_businesses++;
          stats.monthly_recurring_revenue += Number(tier.monthly_price);
        }

        if (restaurant.subscription_status === 'TRIAL') {
          stats.trial_businesses++;
        }

        if (tier.name.toLowerCase().includes('basic')) {
          stats.basic_tier_businesses++;
        } else if (tier.name.toLowerCase().includes('premium')) {
          stats.premium_tier_businesses++;
        }

        const createdAt = new Date(restaurant.created_at);
        if (createdAt >= startOfMonth) {
          stats.new_businesses_this_month++;
        }
      });

      if (invoices) {
        invoices.forEach(invoice => {
          const restaurant = restaurants.find(r => r.id === invoice.restaurant_id);
          if (!restaurant) return;

          const stats = countryMap.get(restaurant.country);
          if (!stats) return;

          stats.total_revenue += Number(invoice.amount);

          if (invoice.invoice_type === 'RENEWAL') {
            stats.total_renewals++;
          }
        });
      }

      setCountryStats(Array.from(countryMap.values()).sort((a, b) =>
        b.total_businesses - a.total_businesses
      ));
    } catch (error) {
      console.error('Error loading country analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredStats = selectedCountry === 'ALL'
    ? countryStats
    : countryStats.filter(s => s.country === selectedCountry);

  const displayedStat = filteredStats.length === 1 ? filteredStats[0] : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-orange-500" size={48} />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Country Analytics</h2>
            <p className="text-gray-600">Real-time business metrics by country</p>
          </div>
          <div className="flex items-center gap-3">
            <Globe className="text-orange-500" size={24} />
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium"
            >
              <option value="ALL">All Countries</option>
              {countryStats.map(stat => (
                <option key={stat.country} value={stat.country}>
                  {stat.country_name} ({stat.country})
                </option>
              ))}
            </select>
            <button
              onClick={loadData}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh data"
            >
              <RefreshCw size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {displayedStat && (
          <div className="grid md:grid-cols-4 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-green-900">Total Revenue</h4>
                <DollarSign size={20} className="text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-900">
                {formatCurrency(displayedStat.total_revenue, displayedStat.currency)}
              </p>
              <p className="text-xs text-green-700 mt-1">All time</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-blue-900">Monthly Recurring Revenue</h4>
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-900">
                {formatCurrency(displayedStat.monthly_recurring_revenue, displayedStat.currency)}
              </p>
              <p className="text-xs text-blue-700 mt-1">Per month</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-4 border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-purple-900">Total Renewals</h4>
                <RefreshCw size={20} className="text-purple-600" />
              </div>
              <p className="text-3xl font-bold text-purple-900">{displayedStat.total_renewals}</p>
              <p className="text-xs text-purple-700 mt-1">Subscription renewals</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow p-4 border border-orange-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-orange-900">Active Businesses</h4>
                <Building2 size={20} className="text-orange-600" />
              </div>
              <p className="text-3xl font-bold text-orange-900">{displayedStat.active_businesses}</p>
              <p className="text-xs text-orange-700 mt-1">Paying customers</p>
            </div>
          </div>
        )}

        {displayedStat && (
          <div className="grid md:grid-cols-4 lg:grid-cols-4 gap-4">
            <div className="bg-yellow-50 rounded-lg shadow p-4 border border-yellow-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-yellow-900">Businesses in Trial</h4>
                <Users size={20} className="text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-yellow-900">{displayedStat.trial_businesses}</p>
              <p className="text-xs text-yellow-700 mt-1">Trial period</p>
            </div>

            <div className="bg-teal-50 rounded-lg shadow p-4 border border-teal-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-teal-900">Basic Tier</h4>
                <Award size={20} className="text-teal-600" />
              </div>
              <p className="text-2xl font-bold text-teal-900">{displayedStat.basic_tier_businesses}</p>
              <p className="text-xs text-teal-700 mt-1">Basic plan</p>
            </div>

            <div className="bg-indigo-50 rounded-lg shadow p-4 border border-indigo-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-indigo-900">Premium Tier</h4>
                <Award size={20} className="text-indigo-600" />
              </div>
              <p className="text-2xl font-bold text-indigo-900">{displayedStat.premium_tier_businesses}</p>
              <p className="text-xs text-indigo-700 mt-1">Premium plan</p>
            </div>

            <div className="bg-pink-50 rounded-lg shadow p-4 border border-pink-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-pink-900">New This Month</h4>
                <Calendar size={20} className="text-pink-600" />
              </div>
              <p className="text-2xl font-bold text-pink-900">{displayedStat.new_businesses_this_month}</p>
              <p className="text-xs text-pink-700 mt-1">Joined this month</p>
            </div>
          </div>
        )}
      </div>

      {selectedCountry === 'ALL' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-bold text-gray-900">All Countries Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MRR</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Renewals</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Active</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trial</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Basic</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Premium</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">New</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {countryStats.map((stat) => (
                  <tr key={stat.country} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">{stat.country_name}</div>
                          <div className="text-xs text-gray-500">{stat.country} • {stat.currency}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-green-700">
                      {formatCurrency(stat.total_revenue, stat.currency)}
                    </td>
                    <td className="px-6 py-4 font-semibold text-blue-700">
                      {formatCurrency(stat.monthly_recurring_revenue, stat.currency)}
                    </td>
                    <td className="px-6 py-4 text-gray-700">{stat.total_renewals}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm font-medium">
                        {stat.active_businesses}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm font-medium">
                        {stat.trial_businesses}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{stat.basic_tier_businesses}</td>
                    <td className="px-6 py-4 text-gray-700">{stat.premium_tier_businesses}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded text-sm font-medium">
                        {stat.new_businesses_this_month}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
