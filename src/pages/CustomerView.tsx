import { useState, useEffect } from 'react';
import { ShoppingBag, Phone, MapPin, Clock, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, Bundle } from '../lib/database.types';
import { ProductCard } from '../components/customer/ProductCard';
import { BundleCard } from '../components/customer/BundleCard';
import { Cart } from '../components/customer/Cart';
import { Checkout } from '../components/customer/Checkout';
import { useCart } from '../contexts/CartContext';

interface RestaurantInfo {
  name: string;
  phone: string;
  address: string;
  delivery_fee: number;
  minimum_order: number;
  is_open: boolean;
  currency: string;
}

export function CustomerView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const { items } = useCart();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('id, currency, is_open, delivery_fee, minimum_order')
        .maybeSingle();

      if (restaurant) {
        const { data: settings } = await supabase
          .from('restaurant_settings')
          .select('name, phone, address')
          .eq('restaurant_id', restaurant.id)
          .maybeSingle();

        if (settings) {
          setRestaurantInfo({
            name: settings.name || 'Our Store',
            phone: settings.phone || '',
            address: settings.address || '',
            delivery_fee: restaurant.delivery_fee || 0,
            minimum_order: restaurant.minimum_order || 0,
            is_open: restaurant.is_open,
            currency: restaurant.currency || 'USD',
          });
        }

        const [productsRes, bundlesRes] = await Promise.all([
          supabase.from('products').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true),
          supabase.from('bundles').select('*').eq('restaurant_id', restaurant.id).eq('is_active', true),
        ]);

        if (productsRes.data) setProducts(productsRes.data);
        if (bundlesRes.data) setBundles(bundlesRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading menu...</div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <Checkout onBack={() => setShowCheckout(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag size={32} className="text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{restaurantInfo?.name || 'Our Store'}</h1>
                {restaurantInfo && (
                  <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mt-1">
                    {restaurantInfo.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={14} />
                        {restaurantInfo.phone}
                      </span>
                    )}
                    {restaurantInfo.address && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {restaurantInfo.address}
                      </span>
                    )}
                    {restaurantInfo.delivery_fee > 0 && (
                      <span className="flex items-center gap-1">
                        <Truck size={14} />
                        Delivery: {restaurantInfo.currency} {restaurantInfo.delivery_fee}
                      </span>
                    )}
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      restaurantInfo.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      <Clock size={12} />
                      {restaurantInfo.is_open ? 'Open Now' : 'Closed'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="bg-orange-500 text-white px-4 py-2 rounded-full font-semibold">
                Cart: {items.length}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {bundles.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Special Combos</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  {bundles.map((bundle) => (
                    <BundleCard key={bundle.id} bundle={bundle} />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Menu</h2>
              <div className="grid sm:grid-cols-2 gap-6">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <Cart onCheckout={() => setShowCheckout(true)} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
