import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart as CartIcon, X, Plus, Minus, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { calculateDeliveryFee, validateMinimumOrder, formatCurrency } from '../lib/utils';
import type { Product, Bundle, RestaurantSettings, ProductCategory, FeaturedProduct } from '../lib/database.types';

export function CustomerHome() {
  const { restaurantSlug } = useParams();
  const navigate = useNavigate();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [featuredProductIds, setFeaturedProductIds] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState<string>('AED');
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCart();
  
  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(0); // ADDED: Track delivery fee
  const [finalTotal, setFinalTotal] = useState<number>(0); // ADDED: Track final total (cart + delivery)

  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    paymentMethod: 'COD' as 'COD' | 'BANK_TRANSFER',
    isSelfPickup: false,
  });

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [addedItemName, setAddedItemName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showAddedToast) {
      const timer = setTimeout(() => {
        setShowAddedToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showAddedToast]);

  // ADDED: Recalculate delivery fee and final total when cart or self-pickup changes
  useEffect(() => {
    if (restaurantData) {
      const fee = checkoutForm.isSelfPickup ? 0 : calculateDeliveryFee(
        total,
        restaurantData?.delivery_fee_tiers || []
      );
      setDeliveryFee(fee);
      setFinalTotal(total + fee);
    }
  }, [total, restaurantData, checkoutForm.isSelfPickup]);

  const handleAddToCart = (item: { id: string; name: string; price: number; type: 'PRODUCT' | 'BUNDLE' }) => {
    addItem(item);
    setAddedItemName(item.name);
    setShowAddedToast(true);
  };

  const loadData = async () => {
    try {
      if (!restaurantSlug) {
        navigate('/');
        return;
      }

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, restaurant_currency, minimum_order_amount, delivery_fee_tiers')
        .eq('slug', restaurantSlug)
        .maybeSingle();

      if (!restaurant) {
        navigate('/');
        return;
      }

      setRestaurantId(restaurant.id);
      setCurrency(restaurant.restaurant_currency || 'AED');
      setRestaurantData(restaurant);

      const [productsRes, bundlesRes, settingsRes, categoriesRes, featuredRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true).eq('restaurant_id', restaurant.id),
        supabase.from('bundles').select('*').eq('is_active', true).eq('restaurant_id', restaurant.id),
        supabase.from('restaurant_settings').select('*').eq('restaurant_id', restaurant.id).maybeSingle(),
        supabase.from('product_categories').select('*').eq('is_active', true).eq('restaurant_id', restaurant.id).order('display_order'),
        supabase.from('featured_products').select('product_id').eq('restaurant_id', restaurant.id),
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (bundlesRes.data) setBundles(bundlesRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (featuredRes.data) setFeaturedProductIds(featuredRes.data.map((f) => f.product_id));
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Validate minimum order amount
      const minOrderValidation = validateMinimumOrder(
        total,
        restaurantData?.minimum_order_amount || 0,
        currency
      );
      
      if (!minOrderValidation.valid) {
        alert(minOrderValidation.message);
        return;
      }

      // Calculate delivery fee (already calculated in useEffect)
      const fee = checkoutForm.isSelfPickup ? 0 : calculateDeliveryFee(
        total,
        restaurantData?.delivery_fee_tiers || []
      );

      // Final total = cart total + delivery fee
      const orderTotal = total + fee;

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: null,
          restaurant_id: restaurantId,
          phone_number: checkoutForm.phone,
          delivery_address: checkoutForm.isSelfPickup ? 'Self Pickup' : `${checkoutForm.address}, ${checkoutForm.city}`,
          total_amount: orderTotal, // Use final total (cart + delivery)
          delivery_fee: fee, // Store delivery fee separately
          discount_applied: 0,
          payment_method: checkoutForm.paymentMethod,
          payment_confirmed: false,
          status: 'PENDING',
          is_self_pickup: checkoutForm.isSelfPickup,
        })
        .select()
        .single();

      if (error || !order) throw new Error('Failed to create order');

      const orderItems = items.map((item) => ({
        order_id: order.id,
        item_type: item.type,
        item_id: item.id,
        item_name: item.name,
        quantity: item.quantity,
        price: item.price,
      }));

      await supabase.from('order_items').insert(orderItems);

      const { data: settingsData } = await supabase
        .from('restaurant_settings')
        .select('tracking_url_expiry_hours')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      const expiryHours = settingsData?.tracking_url_expiry_hours || 2;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      const token = `${order.id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      await supabase.from('order_tracking_tokens').insert({
        order_id: order.id,
        token: token,
        token_type: 'CUSTOMER',
        expires_at: expiresAt.toISOString(),
      });

      setOrderId(order.id);
      setTrackingToken(token);
      setOrderPlaced(true);
      clearCart();
    } catch (error) {
      console.error('Order error:', error);
      alert('Failed to place order. Please try again.');
    }
  };

  const filteredProducts = products.filter((p) =>
    selectedCategory === 'all' || p.category_id === selectedCategory
  );

  const featuredProducts = products.filter((p) => featuredProductIds.includes(p.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (orderPlaced) {
    const trackingUrl = `${window.location.origin}/${restaurantSlug}/track/${trackingToken}`;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
          <p className="text-gray-600 mb-4">Order ID: {orderId.slice(0, 8)}</p>
          <p className="text-gray-600 mb-4">
            We'll call you at {checkoutForm.phone} to confirm your order.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm font-semibold text-blue-900 mb-2">Track Your Order</p>
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 break-all"
            >
              {trackingUrl}
            </a>
            <p className="text-xs text-blue-700 mt-2">Link expires in 2 hours</p>
          </div>

          <button
            onClick={() => {
              setOrderPlaced(false);
              setShowCheckout(false);
            }}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Order More
          </button>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    // Calculate final totals
    const fee = checkoutForm.isSelfPickup ? 0 : calculateDeliveryFee(
      total,
      restaurantData?.delivery_fee_tiers || []
    );
    const orderTotal = total + fee;
    
    const minOrderValidation = validateMinimumOrder(
      total,
      restaurantData?.minimum_order_amount || 0,
      currency
    );
    const isBelowMinimum = !minOrderValidation.valid;

    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setShowCheckout(false)}
            className="mb-4 text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            ← Back to Cart
          </button>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Checkout</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={checkoutForm.phone}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 p-4 rounded-lg">
                <input
                  type="checkbox"
                  id="selfPickup"
                  checked={checkoutForm.isSelfPickup}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, isSelfPickup: e.target.checked })}
                  className="w-4 h-4 text-orange-600 rounded"
                />
                <label htmlFor="selfPickup" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Self Pickup - I'll pick up my order from the restaurant
                </label>
              </div>

              {!checkoutForm.isSelfPickup && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                    <input
                      type="text"
                      required={!checkoutForm.isSelfPickup}
                      value={checkoutForm.address}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      required={!checkoutForm.isSelfPickup}
                      value={checkoutForm.city}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={checkoutForm.paymentMethod}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, paymentMethod: e.target.value as 'COD' | 'BANK_TRANSFER' })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="COD">Cash on Delivery</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div className="border-t pt-4 mt-6">
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Items Total:</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>
                  
                  {!checkoutForm.isSelfPickup && fee > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Delivery Fee:</span>
                      <span>{formatCurrency(fee, currency)}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-orange-600">
                    {formatCurrency(orderTotal, currency)}
                  </span>
                </div>
                
                {isBelowMinimum && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium text-sm">
                      ❌ {minOrderValidation.message}
                    </p>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={isBelowMinimum}
                  className={`w-full py-3 rounded-lg font-semibold ${
                    isBelowMinimum
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : 'bg-orange-500 hover:bg-orange-600 text-white'
                  }`}
                >
                  {isBelowMinimum ? 'Order Below Minimum' : 'Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{settings?.name || 'Restaurant'}</h1>
              {settings?.address && (
                <p className="text-sm text-gray-500">{settings.address}, {settings.city}</p>
              )}
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
            >
              <CartIcon size={20} />
              Cart {items.length > 0 && `(${items.length})`}
              {/* ADDED: Show final total in cart button */}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {featuredProducts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Featured</h2>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                  {settings?.show_product_image && product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="h-40 bg-gradient-to-br from-orange-100 to-yellow-100 flex items-center justify-center text-4xl">
                      🍽️
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800">{product.name}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-lg font-bold text-orange-600">
                        {formatCurrency(product.price, currency)}
                      </span>
                      <button
                        onClick={() => handleAddToCart({ id: product.id, name: product.name, price: product.price, type: 'PRODUCT' })}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-1"
                      >
                        <Plus size={16} />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {settings?.enable_categories && categories.length > 0 && (
          <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap ${
                  selectedCategory === category.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        )}

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Menu</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                {settings?.show_product_image && product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-40 object-cover" />
                ) : (
                  <div className="h-40 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-4xl">
                    🍽️
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-800">{product.name}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-lg font-bold text-orange-600">
                      {formatCurrency(product.price, currency)}
                    </span>
                    <button
                      onClick={() => handleAddToCart({ id: product.id, name: product.name, price: product.price, type: 'PRODUCT' })}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-1"
                    >
                      <Plus size={16} />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-8 text-gray-500">
                Your cart is empty
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 pb-4 border-b">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">{item.name}</h3>
                        <p className="text-orange-600 font-semibold mt-1">
                          {formatCurrency(item.price, currency)}
                        </p>
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
                  {restaurantData?.minimum_order_amount > 0 && total < restaurantData.minimum_order_amount && (
                    <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-yellow-800 font-medium text-sm">
                        ⚠️ Minimum order: {formatCurrency(restaurantData.minimum_order_amount, currency)}
                      </p>
                      <p className="text-yellow-600 text-xs mt-1">
                        Add {formatCurrency(restaurantData.minimum_order_amount - total, currency)} more to checkout
                      </p>
                    </div>
                  )}
                  
                  {/* Show cart items total */}
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Items Total:</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>
                  
                  {/* Show delivery fee if applicable */}
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Delivery Fee:</span>
                      <span>{formatCurrency(deliveryFee, currency)}</span>
                    </div>
                  )}
                  
                  {/* Show final total (items + delivery) */}
                  <div className="flex justify-between items-center mb-4 mt-2">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {formatCurrency(finalTotal, currency)}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => {
                      if (restaurantData?.minimum_order_amount > 0 && total < restaurantData.minimum_order_amount) {
                        alert(`Minimum order amount is ${formatCurrency(restaurantData.minimum_order_amount, currency)}`);
                        return;
                      }
                      setShowCart(false);
                      setShowCheckout(true);
                    }}
                    disabled={restaurantData?.minimum_order_amount > 0 && total < restaurantData.minimum_order_amount}
                    className={`w-full py-3 rounded-lg font-semibold ${
                      restaurantData?.minimum_order_amount > 0 && total < restaurantData.minimum_order_amount
                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                        : 'bg-orange-500 hover:bg-orange-600 text-white'
                    }`}
                  >
                    {restaurantData?.minimum_order_amount > 0 && total < restaurantData.minimum_order_amount
                      ? `Add ${formatCurrency(restaurantData.minimum_order_amount - total, currency)} more`
                      : 'Proceed to Checkout'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAddedToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <CheckCircle size={24} />
            <div>
              <p className="font-semibold">Added to cart!</p>
              <p className="text-sm opacity-90">{addedItemName}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}