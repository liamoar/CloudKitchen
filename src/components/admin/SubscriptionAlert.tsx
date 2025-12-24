import { AlertTriangle, Clock, CreditCard, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SubscriptionInfo {
  status: string;
  trial_days_remaining: number;
  subscription_days_remaining: number;
  ending_soon: boolean;
  tier_name: string;
  monthly_price: number;
  currency: string;
}

export function SubscriptionAlert() {
  const { user } = useAuth();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadSubscriptionInfo();
  }, [user?.id]);

  const loadSubscriptionInfo = async () => {
    if (!user?.id) return;

    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (!restaurant) return;

    const { data } = await supabase
      .from('restaurant_subscription_status')
      .select('*')
      .eq('id', restaurant.id)
      .maybeSingle();

    if (data) {
      setSubscriptionInfo(data);
    }
  };

  if (!subscriptionInfo || !subscriptionInfo.ending_soon || dismissed) {
    return null;
  }

  const daysRemaining = subscriptionInfo.status === 'TRIAL'
    ? subscriptionInfo.trial_days_remaining
    : subscriptionInfo.subscription_days_remaining;

  const message = subscriptionInfo.status === 'TRIAL'
    ? `Your trial period ends in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Please upgrade to continue using the service.`
    : `Your subscription renewal is due in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Submit payment to avoid service interruption.`;

  const bgColor = daysRemaining <= 2 ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200';
  const textColor = daysRemaining <= 2 ? 'text-red-900' : 'text-orange-900';
  const iconColor = daysRemaining <= 2 ? 'text-red-600' : 'text-orange-600';

  return (
    <div className={`${bgColor} border-b border-t px-4 py-3`}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {daysRemaining <= 2 ? (
            <AlertTriangle size={20} className={iconColor} />
          ) : (
            <Clock size={20} className={iconColor} />
          )}
          <div className="flex items-center gap-2">
            <p className={`text-sm font-medium ${textColor}`}>
              {message}
            </p>
            {subscriptionInfo.status === 'TRIAL' && (
              <span className="px-2 py-1 bg-white rounded text-xs font-medium text-gray-700">
                {subscriptionInfo.tier_name} - {subscriptionInfo.monthly_price} {subscriptionInfo.currency}/month
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className={`p-1 hover:bg-white/50 rounded transition-colors ${textColor}`}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
