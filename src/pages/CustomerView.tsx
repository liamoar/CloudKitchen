import { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, Bundle } from '../lib/database.types';
import { ProductCard } from '../components/customer/ProductCard';
import { BundleCard } from '../components/customer/BundleCard';
import { Cart } from '../components/customer/Cart';
import { Checkout } from '../components/customer/Checkout';
import { useCart } from '../contexts/CartContext';

export function CustomerView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const { items } = useCart();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [productsRes, bundlesRes] = await Promise.all([
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('bundles').select('*').eq('is_active', true),
      ]);

      if (productsRes.data) setProducts(productsRes.data);
      if (bundlesRes.data) setBundles(bundlesRes.data);
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
                <h1 className="text-2xl font-bold text-gray-800">Cloud Kitchen</h1>
                <p className="text-sm text-gray-500">Fresh food delivered to your door</p>
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
