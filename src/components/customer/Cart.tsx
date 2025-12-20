import { useState, useEffect } from 'react';
import { X, Minus, Plus, ShoppingCart, AlertCircle } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatCurrency, calculateDeliveryFee, validateMinimumOrder, type DeliveryFeeTier } from '../../lib/utils';

interface CartProps {
  onCheckout: () => void;
  currency?: string;
}

export function Cart({ onCheckout, currency = 'AED' }: CartProps) {
  const { items, removeItem, updateQuantity, total } = useCart();
  const { restaurantSlug } = useParams();
  const [minimumOrderAmount, setMinimumOrderAmount] = useState<number>(0);
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState<DeliveryFeeTier[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);

  useEffect(() => {
    const loadRestaurantSettings = async () => {
      if (!restaurantSlug) return;

      const { data } = await supabase
        .from('restaurants')
        .select('minimum_order_amount, delivery_fee_tiers, restaurant_currency')
        .eq('slug', restaurantSlug)
        .maybeSingle();

      if (data) {
        setMinimumOrderAmount(data.minimum_order_amount || 0);
        setDeliveryFeeTiers(data.delivery_fee_tiers || []);
      }
    };

    loadRestaurantSettings();
  }, [restaurantSlug]);

  useEffect(() => {
    if (deliveryFeeTiers.length > 0) {
      const fee = calculateDeliveryFee(total, deliveryFeeTiers);
      setDeliveryFee(fee);
    }
  }, [total, deliveryFeeTiers]);

  const validation = validateMinimumOrder(total, minimumOrderAmount);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <ShoppingCart size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Your Cart</h2>
      </div>
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 pb-4 border-b last:border-0">
            <div className="flex-1">
              <h3 className="font-medium text-gray-800">{item.name}</h3>
              <p className="text-sm text-gray-500">
                {item.type === 'BUNDLE' && 'Combo Deal'}
              </p>
              <p className="text-orange-600 font-semibold mt-1">{formatCurrency(item.price, currency)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 hover:bg-red-50 text-red-500 rounded"
            >
              <X size={20} />
            </button>
          </div>
        ))}
      </div>
      <div className="p-4 border-t bg-gray-50">
        {!validation.valid && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-xs text-yellow-800">
              {validation.message}
            </p>
          </div>
        )}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700">Subtotal</span>
            <span className="font-medium text-gray-900">{formatCurrency(total, currency)}</span>
          </div>
          {deliveryFeeTiers.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Delivery Fee (est.)</span>
              {deliveryFee === 0 ? (
                <span className="font-medium text-green-600">FREE</span>
              ) : (
                <span className="font-medium text-gray-900">{formatCurrency(deliveryFee, currency)}</span>
              )}
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-lg font-semibold text-gray-800">Total (est.)</span>
            <span className="text-2xl font-bold text-orange-600">
              {formatCurrency(total + deliveryFee, currency)}
            </span>
          </div>
        </div>
        <button
          onClick={onCheckout}
          disabled={!validation.valid}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Proceed to Checkout
        </button>
        {deliveryFeeTiers.length > 0 && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Final delivery fee will be calculated at checkout based on delivery type
          </p>
        )}
      </div>
    </div>
  );
}
