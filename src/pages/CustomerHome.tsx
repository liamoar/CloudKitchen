import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart as CartIcon, X, Plus, Minus, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
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
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCart();

  const [checkoutForm, setCheckoutForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    paymentMethod: 'COD' as 'COD' | 'BANK_TRANSFER',
  });

  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (!restaurantSlug) {
        navigate('/');
        return;
      }

      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', restaurantSlug)
        .maybeSingle();

      if (!restaurant) {
        navigate('/');
        return;
      }

      setRestaurantId(restaurant.id);

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
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: null,
          restaurant_id: restaurantId,
          phone_number: checkoutForm.phone,
          delivery_address: `${checkoutForm.address}, ${checkoutForm.city}`,
          total_amount: total,
          discount_applied: 0,
          payment_method: checkoutForm.paymentMethod,
          payment_confirmed: false,
          status: 'PENDING',
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

      setOrderId(order.id);
      setOrderPlaced(true);
      clearCart();
    } catch (error) {
      alert('Failed to place order. Please try again.');
    }
  };

  const filteredProducts = products.filter((p) =>
    selectedCategory === 'all' || p.category_id === selectedCategory
  );

  const featuredProducts = products.filter((p) => featuredProductIds.includes(p.id));

  const getCurrencySymbol = (currency: string | undefined) => {
    switch (currency) {
      case 'USD': return '$';
      case 'EUR': return '€';
      case 'GBP': return '£';
      case 'INR': return '₹';
      case 'NPR': return 'रू';
      case 'AED': return 'د.إ';
      default: return '$';
    }
  };

  const currencySymbol = getCurrencySymbol(settings?.currency);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
          <p className="text-gray-600 mb-4">Order ID: {orderId.slice(0, 8)}</p>
          <p className="text-gray-600 mb-6">
            We'll call you at {checkoutForm.phone} to confirm your order.
          </p>
          <button
            onClick={() => {
              setOrderPlaced(false);
              setShowCheckout(false);
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            Order More
          </button>
        </div>
      </div>
    );
  }

  if (showCheckout) {
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
                <input
                  type="text"
                  required
                  value={checkoutForm.address}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, address: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={checkoutForm.city}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>

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
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-orange-600">
                    {currencySymbol}{total.toFixed(2)}
                  </span>
                </div>
                <button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold"
                >
                  Place Order
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
                        {currencySymbol}{product.price}
                      </span>
                      <button
                        onClick={() => addItem({ id: product.id, name: product.name, price: product.price, type: 'PRODUCT' })}
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
                      {currencySymbol}{product.price}
                    </span>
                    <button
                      onClick={() => addItem({ id: product.id, name: product.name, price: product.price, type: 'PRODUCT' })}
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
                          {currencySymbol}{item.price}
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
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-orange-600">
                      {currencySymbol}{total.toFixed(2)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setShowCart(false);
                      setShowCheckout(true);
                    }}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
