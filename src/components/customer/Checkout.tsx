import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Truck, Store as StoreIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { supabase } from '../../lib/supabase';
import { useParams } from 'react-router-dom';
import { formatCurrency, calculateDeliveryFee, validateMinimumOrder, type DeliveryFeeTier } from '../../lib/utils';

interface CheckoutProps {
  onBack: () => void;
}

export function Checkout({ onBack }: CheckoutProps) {
  const { user } = useAuth();
  const { items, total, clearCart } = useCart();
  const { restaurantSlug } = useParams();
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string>('');
  const [trackingToken, setTrackingToken] = useState<string>('');
  const [restaurantId, setRestaurantId] = useState<string>('');
  const [deliveryType, setDeliveryType] = useState<'DELIVERY' | 'PICKUP'>('DELIVERY');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BANK_TRANSFER'>('COD');
  const [currency, setCurrency] = useState<string>('AED');
  const [minimumOrderAmount, setMinimumOrderAmount] = useState<number>(0);
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState<DeliveryFeeTier[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [validationError, setValidationError] = useState<string>('');

  const [formData, setFormData] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: '',
    city: '',
    notes: '',
  });

  useEffect(() => {
    const loadRestaurant = async () => {
      if (!restaurantSlug) return;

      const { data } = await supabase
        .from('restaurants')
        .select('id, restaurant_currency, minimum_order_amount, delivery_fee_tiers')
        .eq('slug', restaurantSlug)
        .maybeSingle();

      if (data) {
        setRestaurantId(data.id);
        setCurrency(data.restaurant_currency || 'AED');
        setMinimumOrderAmount(data.minimum_order_amount || 0);
        setDeliveryFeeTiers(data.delivery_fee_tiers || []);
      }
    };

    loadRestaurant();
  }, [restaurantSlug]);

  useEffect(() => {
    if (deliveryType === 'DELIVERY' && deliveryFeeTiers.length > 0) {
      const fee = calculateDeliveryFee(total, deliveryFeeTiers);
      setDeliveryFee(fee);
    } else {
      setDeliveryFee(0);
    }

    const validation = validateMinimumOrder(total, minimumOrderAmount);
    if (!validation.valid) {
      setValidationError(validation.message || '');
    } else {
      setValidationError('');
    }
  }, [total, deliveryType, deliveryFeeTiers, minimumOrderAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = validateMinimumOrder(total, minimumOrderAmount);
      if (!validation.valid) {
        alert(validation.message);
        return;
      }

      const deliveryAddress = deliveryType === 'DELIVERY'
        ? `${formData.address}, ${formData.city}`
        : 'Self Pickup';

      const finalTotal = total + deliveryFee;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user?.id || null,
          restaurant_id: restaurantId,
          phone_number: formData.phone,
          delivery_address: deliveryAddress,
          total_amount: finalTotal,
          discount_applied: 0,
          delivery_fee: deliveryFee,
          status: 'PENDING',
          payment_method: paymentMethod,
          is_self_pickup: deliveryType === 'PICKUP',
          payment_confirmed: false,
          delivery_notes: formData.notes || null,
        })
        .select()
        .single();

      if (orderError || !order) {
        throw new Error('Failed to create order');
      }

      const orderItems = items.map((item) => ({
        order_id: order.id,
        item_type: item.type,
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        throw new Error('Failed to create order items');
      }

      const tokenValue = `${order.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      await supabase.from('order_tracking_tokens').insert({
        token: tokenValue,
        order_id: order.id,
        token_type: 'CUSTOMER',
        expires_at: expiresAt.toISOString(),
      });

      setOrderId(order.id);
      setTrackingToken(tokenValue);
      setOrderPlaced(true);
      clearCart();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  if (orderPlaced) {
    const trackingUrl = `${window.location.origin}/${restaurantSlug}/track/${trackingToken}`;

    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
        <p className="text-gray-600 mb-4">Your order ID is: #{orderId.slice(0, 8).toUpperCase()}</p>

        {deliveryType === 'PICKUP' ? (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <StoreIcon className="mx-auto text-blue-600 mb-2" size={32} />
            <p className="text-gray-700 font-medium mb-1">Self Pickup</p>
            <p className="text-sm text-gray-600">
              We'll call you at {formData.phone} when your order is ready for pickup.
            </p>
          </div>
        ) : (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <Truck className="mx-auto text-blue-600 mb-2" size={32} />
            <p className="text-gray-700 font-medium mb-1">Home Delivery</p>
            <p className="text-sm text-gray-600">
              We'll call you at {formData.phone} to confirm your order and delivery details.
            </p>
          </div>
        )}

        {paymentMethod === 'BANK_TRANSFER' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 font-medium mb-2">Bank Transfer Selected</p>
            <p className="text-xs text-yellow-700">
              Please complete the bank transfer and the restaurant will confirm your payment.
            </p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 font-medium mb-2">Track Your Order</p>
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm underline break-all"
          >
            {trackingUrl}
          </a>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          Order More
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b flex items-center gap-4">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-semibold text-gray-800">Checkout</h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Delivery Type *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDeliveryType('DELIVERY')}
              className={`p-4 rounded-lg border-2 transition-all ${
                deliveryType === 'DELIVERY'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Truck className={`mx-auto mb-2 ${deliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-400'}`} size={32} />
              <p className={`font-medium ${deliveryType === 'DELIVERY' ? 'text-orange-600' : 'text-gray-700'}`}>
                Home Delivery
              </p>
            </button>
            <button
              type="button"
              onClick={() => setDeliveryType('PICKUP')}
              className={`p-4 rounded-lg border-2 transition-all ${
                deliveryType === 'PICKUP'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <StoreIcon className={`mx-auto mb-2 ${deliveryType === 'PICKUP' ? 'text-orange-600' : 'text-gray-400'}`} size={32} />
              <p className={`font-medium ${deliveryType === 'PICKUP' ? 'text-orange-600' : 'text-gray-700'}`}>
                Self Pickup
              </p>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Payment Method *
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setPaymentMethod('COD')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentMethod === 'COD'
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <p className={`font-medium ${paymentMethod === 'COD' ? 'text-green-600' : 'text-gray-700'}`}>
                  Cash on Delivery
                </p>
                <p className="text-xs text-gray-500 mt-1">Pay when you receive</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('BANK_TRANSFER')}
              className={`p-4 rounded-lg border-2 transition-all ${
                paymentMethod === 'BANK_TRANSFER'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="text-center">
                <p className={`font-medium ${paymentMethod === 'BANK_TRANSFER' ? 'text-blue-600' : 'text-gray-700'}`}>
                  Bank Transfer
                </p>
                <p className="text-xs text-gray-500 mt-1">Transfer before delivery</p>
              </div>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name *
          </label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>

        {deliveryType === 'DELIVERY' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Delivery Address *
              </label>
              <input
                type="text"
                required
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Street, Building, Landmark"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Delivery Notes / Special Instructions (Optional)
          </label>
          <textarea
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            placeholder="e.g., Ring the doorbell, Leave at door, Call on arrival..."
          />
        </div>

        {validationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-900 font-semibold text-sm">{validationError}</p>
              <p className="text-red-700 text-xs mt-1">
                Add more items to your cart to proceed with checkout.
              </p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">Subtotal</span>
              <span className="font-medium text-gray-900">{formatCurrency(total, currency)}</span>
            </div>
            {deliveryType === 'DELIVERY' && deliveryFee > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Delivery Fee</span>
                <span className="font-medium text-gray-900">{formatCurrency(deliveryFee, currency)}</span>
              </div>
            )}
            {deliveryType === 'DELIVERY' && deliveryFee === 0 && deliveryFeeTiers.length > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Delivery Fee</span>
                <span className="font-medium text-green-600">FREE</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-lg font-semibold text-gray-800">Total</span>
              <span className="text-2xl font-bold text-orange-600">
                {formatCurrency(total + deliveryFee, currency)}
              </span>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !!validationError}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
