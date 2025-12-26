import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Phone, MapPin, Clock, Mail, Search, Grid, List, X, Plus, Minus, CheckCircle, Gift, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { calculateDeliveryFee, validateMinimumOrder, formatCurrency, getSubdomain, getMainDomainUrl } from '../lib/utils';
import type { Product, Bundle, ProductCategory } from '../lib/database.types';

interface RestaurantInfo {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  is_open: boolean;
  currency: string;
  support_email: string;
  support_phone: string;
}

interface ProductVariant {
  id: string;
  product_id: string;
  sku_code: string;
  attributes: Record<string, string>;
  price: number;
  stock_quantity: number;
  is_active: boolean;
}

interface Settings {
  enable_categories: boolean;
  enable_multiple_sku: boolean;
  show_product_images: boolean;
  enable_stock_management: boolean;
}

export function CustomerHome() {
  const navigate = useNavigate();
  const subdomain = getSubdomain();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [variants, setVariants] = useState<Record<string, ProductVariant[]>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currency, setCurrency] = useState<string>('AED');
  const { items, addItem, removeItem, updateQuantity, clearCart, total } = useCart();

  const [restaurantData, setRestaurantData] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [finalTotal, setFinalTotal] = useState<number>(0);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductVariant>>({});

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
      if (!subdomain) {
        window.location.href = getMainDomainUrl('/');
        return;
      }

      const { data: business } = await supabase
        .from('businesses')
        .select(`
          id,
          name,
          address,
          status,
          is_subdomain_active,
          country:countries(currency, currency_symbol)
        `)
        .eq('subdomain', subdomain)
        .maybeSingle();

      if (!business) {
        window.location.href = getMainDomainUrl('/');
        return;
      }

      if (!business.is_subdomain_active || business.status === 'inactive' || business.status === 'cancelled') {
        window.location.href = getMainDomainUrl('/');
        return;
      }

      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('business_id', business.id)
        .maybeSingle();

      setRestaurantId(business.id);
      setCurrency(business.country?.currency_symbol || '$');
      setRestaurantData({
        id: business.id,
        minimum_order_amount: businessSettings?.minimum_order_value || 0,
        delivery_fee_tiers: businessSettings?.delivery_charges || [],
        status: business.status
      });

      if (businessSettings) {
        setRestaurantInfo({
          id: business.id,
          name: business.name || 'Our Store',
          phone: businessSettings.support_phone || '',
          email: businessSettings.support_email || '',
          address: businessSettings.address || business.address || '',
          city: businessSettings.city || '',
          is_open: true,
          currency: business.country?.currency_symbol || 'USD',
          support_email: businessSettings.support_email || '',
          support_phone: businessSettings.support_phone || '',
        });

        setSettings({
          enable_categories: businessSettings.enable_categories || false,
          enable_multiple_sku: businessSettings.enable_multiple_sku || false,
          show_product_images: businessSettings.show_product_images || false,
          enable_stock_management: businessSettings.enable_stock_management || false,
        });
      }

      const [productsRes, bundlesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_available', true).eq('business_id', business.id).order('created_at', { ascending: false }),
        supabase.from('bundles').select('*').eq('is_active', true).eq('business_id', business.id),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data);

        if (businessSettings?.enable_categories) {
          const uniqueCategories = Array.from(
            new Set(productsRes.data.map(p => p.category).filter(Boolean))
          ).map((cat, idx) => ({ id: cat, name: cat }));
          setCategories(uniqueCategories);
        }

        if (businessSettings?.enable_multiple_sku) {
          const productIds = productsRes.data.map(p => p.id);
          const { data: allVariants } = await supabase
            .from('product_variants')
            .select('*')
            .in('product_id', productIds)
            .eq('is_available', true);

          if (allVariants) {
            const variantsByProduct: Record<string, ProductVariant[]> = {};
            const initialSelected: Record<string, ProductVariant> = {};

            allVariants.forEach((variant) => {
              if (!variantsByProduct[variant.product_id]) {
                variantsByProduct[variant.product_id] = [];
              }
              variantsByProduct[variant.product_id].push(variant);
            });

            Object.entries(variantsByProduct).forEach(([productId, productVariants]) => {
              if (productVariants.length > 0) {
                initialSelected[productId] = productVariants[0];
              }
            });

            setVariants(variantsByProduct);
            setSelectedVariants(initialSelected);
          }
        }
      }
      if (bundlesRes.data) setBundles(bundlesRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const minOrderValidation = validateMinimumOrder(
        total,
        restaurantData?.minimum_order_amount || 0,
        currency
      );

      if (!minOrderValidation.valid) {
        alert(minOrderValidation.message);
        return;
      }

      const fee = checkoutForm.isSelfPickup ? 0 : calculateDeliveryFee(
        total,
        restaurantData?.delivery_fee_tiers || []
      );

      const orderTotal = total + fee;

      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          user_id: null,
          business_id: restaurantId,
          phone_number: checkoutForm.phone,
          delivery_address: checkoutForm.isSelfPickup ? 'Self Pickup' : `${checkoutForm.address}, ${checkoutForm.city}`,
          total_amount: orderTotal,
          delivery_fee: fee,
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

      const expiryHours = 24;
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

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const selectVariantByAttributes = (productId: string, attributeName: string, value: string) => {
    const productVariants = variants[productId];
    if (!productVariants) return;

    const currentVariant = selectedVariants[productId];
    const newAttributes = {
      ...(currentVariant?.attributes || {}),
      [attributeName]: value,
    };

    const matchingVariant = productVariants.find((v) => {
      return Object.entries(newAttributes).every(
        ([key, val]) => v.attributes[key] === val
      );
    });

    if (matchingVariant) {
      setSelectedVariants(prev => ({
        ...prev,
        [productId]: matchingVariant,
      }));
    }
  };

  const getAttributeOptions = (productId: string) => {
    const productVariants = variants[productId];
    if (!productVariants) return {};
    const options: Record<string, Set<string>> = {};

    productVariants.forEach((variant) => {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (!options[key]) {
          options[key] = new Set();
        }
        options[key].add(value);
      });
    });

    return Object.fromEntries(
      Object.entries(options).map(([key, values]) => [key, Array.from(values)])
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (orderPlaced) {
    const trackingUrl = `${window.location.origin}/track/${trackingToken}`;
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
            <p className="text-xs text-blue-700 mt-2">Link expires in 24 hours</p>
          </div>

          <button
            onClick={() => {
              setOrderPlaced(false);
              setShowCheckout(false);
            }}
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg"
          >
            Order More
          </button>
        </div>
      </div>
    );
  }

  if (showCheckout) {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={() => setShowCheckout(false)}
            className="mb-4 text-gray-600 hover:text-gray-800 flex items-center gap-2 font-medium"
          >
            ← Back to Cart
          </button>

          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={checkoutForm.name}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={checkoutForm.phone}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div className="flex items-center gap-2 bg-blue-50 p-4 rounded-xl border border-blue-200">
                <input
                  type="checkbox"
                  id="selfPickup"
                  checked={checkoutForm.isSelfPickup}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, isSelfPickup: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label htmlFor="selfPickup" className="text-sm font-medium text-gray-700 cursor-pointer">
                  Self Pickup - I'll pick up my order from the store
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
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                    <input
                      type="text"
                      required={!checkoutForm.isSelfPickup}
                      value={checkoutForm.city}
                      onChange={(e) => setCheckoutForm({ ...checkoutForm, city: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  value={checkoutForm.paymentMethod}
                  onChange={(e) => setCheckoutForm({ ...checkoutForm, paymentMethod: e.target.value as 'COD' | 'BANK_TRANSFER' })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
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
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {formatCurrency(orderTotal, currency)}
                  </span>
                </div>

                {isBelowMinimum && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-800 font-medium text-sm">
                      {minOrderValidation.message}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBelowMinimum}
                  className={`w-full py-3 rounded-xl font-semibold shadow-lg transition-all ${
                    isBelowMinimum
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white hover:shadow-xl'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span className="text-white text-xl font-bold">{restaurantInfo?.name.charAt(0) || 'S'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                  {restaurantInfo?.name || 'Our Store'}
                </h1>
                {restaurantInfo && (
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-600 mt-1">
                    {restaurantInfo.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} className="text-gray-400" />
                        <span className="truncate max-w-[150px] md:max-w-none">{restaurantInfo.city}</span>
                      </span>
                    )}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      restaurantInfo.is_open
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      <Clock size={12} />
                      {restaurantInfo.is_open ? 'Open' : 'Closed'}
                    </span>
                    {restaurantInfo.support_phone && (
                      <span className="hidden md:flex items-center gap-1">
                        <Phone size={14} className="text-gray-400" />
                        {restaurantInfo.support_phone}
                      </span>
                    )}
                    {restaurantInfo.support_email && (
                      <span className="hidden lg:flex items-center gap-1">
                        <Mail size={14} className="text-gray-400" />
                        {restaurantInfo.support_email}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className="relative bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-2"
            >
              <ShoppingCart size={20} />
              <span className="hidden sm:inline">Cart</span>
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-xl border transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                <Grid size={20} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-xl border transition-all ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                }`}
              >
                <List size={20} />
              </button>
            </div>
          </div>

          {settings?.enable_categories && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                All Items
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${
                    selectedCategory === category.id
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {bundles.length > 0 && selectedCategory === 'all' && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Special Combos</h2>
              <div className="h-1 flex-1 ml-4 bg-gradient-to-r from-amber-500 to-transparent rounded-full"></div>
            </div>
            <div className={`grid gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            }`}>
              {bundles.map((bundle) => (
                <div key={bundle.id} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden border-2 border-amber-200 flex flex-col">
                  <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center relative">
                    <Gift size={80} className="text-amber-400" />
                    <div className="absolute top-3 right-3 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      COMBO
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">{bundle.name}</h3>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">{bundle.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-4">
                      <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                        {formatCurrency(bundle.fixed_price, currency)}
                      </span>
                      <button
                        onClick={() => handleAddToCart({ id: bundle.id, name: bundle.name, price: bundle.fixed_price, type: 'BUNDLE' })}
                        className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
                      >
                        <Plus size={18} />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {selectedCategory === 'all' ? 'All Products' : selectedCategory}
            </h2>
            <div className="h-1 flex-1 ml-4 bg-gradient-to-r from-cyan-500 to-transparent rounded-full"></div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
              <p className="text-gray-500 text-lg">No products found</p>
            </div>
          ) : (
            <div className={`grid gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            }`}>
              {filteredProducts.map((product) => {
                const hasVariants = settings?.enable_multiple_sku && variants[product.id] && variants[product.id].length > 0;
                const selectedVariant = hasVariants ? selectedVariants[product.id] : null;
                const currentPrice = hasVariants && selectedVariant ? selectedVariant.price : product.price;
                const isOutOfStock = settings?.enable_stock_management
                  ? hasVariants
                    ? selectedVariant?.stock_quantity === 0
                    : product.stock_quantity === 0
                  : false;
                const attributeOptions = hasVariants ? getAttributeOptions(product.id) : {};

                return (
                  <div key={product.id} className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-100 flex flex-col">
                    <div className="h-48 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
                      {settings?.show_product_images && product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={64} className="text-blue-300" />
                      )}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">{product.description}</p>

                      {hasVariants && selectedVariant && (
                        <div className="space-y-3 mb-4">
                          {Object.entries(attributeOptions).map(([attrName, values]) => (
                            <div key={attrName}>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5 capitalize">
                                {attrName}
                              </label>
                              <div className="flex gap-2 flex-wrap">
                                {(values as string[]).map((value) => (
                                  <button
                                    key={value}
                                    onClick={() => selectVariantByAttributes(product.id, attrName, value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                      selectedVariant.attributes[attrName] === value
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                          {selectedVariant && (
                            <div className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block">
                              SKU: {selectedVariant.sku_code}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-auto pt-4">
                        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                          {formatCurrency(currentPrice, currency)}
                        </span>
                        <button
                          onClick={() => {
                            if (hasVariants && selectedVariant) {
                              handleAddToCart({
                                id: selectedVariant.id,
                                name: `${product.name} (${Object.values(selectedVariant.attributes).join(', ')})`,
                                price: selectedVariant.price,
                                type: 'PRODUCT',
                              });
                            } else {
                              handleAddToCart({ id: product.id, name: product.name, price: product.price, type: 'PRODUCT' });
                            }
                          }}
                          disabled={isOutOfStock}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold"
                        >
                          <Plus size={18} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {showCart && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          ></div>
          <div className="ml-auto relative bg-white w-full max-w-md shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <ShoppingCart size={64} className="text-gray-300 mb-4" />
                <p>Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="p-4 space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 pb-4 border-b">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">{item.name}</h3>
                        <p className="text-sm text-gray-500">
                          {item.type === 'BUNDLE' && 'Combo Deal'}
                        </p>
                        <p className="text-blue-600 font-semibold mt-1">
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
                        Minimum order: {formatCurrency(restaurantData.minimum_order_amount, currency)}
                      </p>
                      <p className="text-yellow-600 text-xs mt-1">
                        Add {formatCurrency(restaurantData.minimum_order_amount - total, currency)} more to checkout
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Items Total:</span>
                    <span>{formatCurrency(total, currency)}</span>
                  </div>

                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Delivery Fee (est.):</span>
                      <span>{formatCurrency(deliveryFee, currency)}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center mb-4 mt-2 pt-2 border-t">
                    <span className="text-lg font-semibold">Total (est.)</span>
                    <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
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
                    className={`w-full py-3 rounded-xl font-semibold transition-all shadow-lg ${
                      restaurantData?.minimum_order_amount > 0 && total < restaurantData.minimum_order_amount
                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                        : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white hover:shadow-xl'
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
        <div className="fixed bottom-4 right-4 z-50 animate-bounce">
          <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
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
