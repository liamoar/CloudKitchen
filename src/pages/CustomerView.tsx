import { useState, useEffect } from 'react';
import { ShoppingCart, Phone, MapPin, Clock, Mail, Search, Grid, List, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product, Bundle } from '../lib/database.types';
import { ProductCard } from '../components/customer/ProductCard';
import { BundleCard } from '../components/customer/BundleCard';
import { Cart } from '../components/customer/Cart';
import { Checkout } from '../components/customer/Checkout';
import { useCart } from '../contexts/CartContext';
import { getSubdomain } from '../lib/utils';

interface RestaurantInfo {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  delivery_fee: number;
  minimum_order: number;
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

interface Category {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
}

interface Settings {
  enable_categories: boolean;
  enable_multiple_sku: boolean;
  show_product_images: boolean;
  enable_stock_management: boolean;
}

export function CustomerView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [variants, setVariants] = useState<Record<string, ProductVariant[]>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showCartSidebar, setShowCartSidebar] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { items } = useCart();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const subdomain = getSubdomain();
      let businessQuery = supabase
        .from('businesses')
        .select('id, name, subdomain, countries!inner(currency_symbol)');

      if (subdomain) {
        businessQuery = businessQuery.eq('subdomain', subdomain);
      }

      const { data: business } = await businessQuery.maybeSingle();

      if (business) {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('*')
          .eq('business_id', business.id)
          .maybeSingle();

        if (businessSettings) {
          setRestaurantInfo({
            id: business.id,
            name: business.name || 'Our Store',
            phone: businessSettings.support_phone || '',
            address: businessSettings.address || business.address || '',
            city: businessSettings.city || '',
            delivery_fee: 0,
            minimum_order: 0,
            is_open: true,
            currency: business.countries?.currency_symbol || 'USD',
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

        const [productsRes, bundlesRes, categoriesRes] = await Promise.all([
          supabase
            .from('products')
            .select('*')
            .eq('business_id', business.id)
            .eq('is_available', true)
            .order('created_at', { ascending: false }),
          supabase
            .from('bundles')
            .select('*')
            .eq('business_id', business.id)
            .eq('is_active', true),
          businessSettings?.enable_categories
            ? supabase
                .from('product_categories')
                .select('*')
                .eq('business_id', business.id)
                .eq('is_active', true)
                .order('display_order', { ascending: true })
            : Promise.resolve({ data: [] }),
        ]);

        if (productsRes.data) {
          setProducts(productsRes.data);

          if (businessSettings?.enable_multiple_sku) {
            const { data: allVariants } = await supabase
              .from('product_variants')
              .select('*')
              .eq('business_id', business.id)
              .eq('is_active', true);

            if (allVariants) {
              const variantsByProduct: Record<string, ProductVariant[]> = {};
              allVariants.forEach((variant) => {
                if (!variantsByProduct[variant.product_id]) {
                  variantsByProduct[variant.product_id] = [];
                }
                variantsByProduct[variant.product_id].push(variant);
              });
              setVariants(variantsByProduct);
            }
          }
        }
        if (bundlesRes.data) setBundles(bundlesRes.data);
        if (categoriesRes.data) setCategories(categoriesRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
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
    <div className="min-h-screen bg-white">
      <header className="bg-black text-white sticky top-0 z-30 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-white text-black flex items-center justify-center flex-shrink-0 font-bold">
                <span className="text-lg">{restaurantInfo?.name.charAt(0) || 'S'}</span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg md:text-xl font-semibold truncate">
                  {restaurantInfo?.name || 'Our Store'}
                </h1>
                {restaurantInfo && (
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-300 mt-0.5">
                    {restaurantInfo.city && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        <span className="truncate max-w-[150px] md:max-w-none">{restaurantInfo.city}</span>
                      </span>
                    )}
                    <span className={`flex items-center gap-1 px-2 py-0.5 text-xs ${
                      restaurantInfo.is_open
                        ? 'bg-white text-black'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      <Clock size={10} />
                      {restaurantInfo.is_open ? 'Open' : 'Closed'}
                    </span>
                    {restaurantInfo.support_phone && (
                      <span className="hidden md:flex items-center gap-1">
                        <Phone size={12} />
                        {restaurantInfo.support_phone}
                      </span>
                    )}
                    {restaurantInfo.support_email && (
                      <span className="hidden lg:flex items-center gap-1">
                        <Mail size={12} />
                        {restaurantInfo.support_email}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setShowCartSidebar(true)}
              className="relative bg-white text-black px-4 md:px-5 py-2 md:py-2.5 font-medium transition-all hover:bg-gray-200 flex items-center gap-2"
            >
              <ShoppingCart size={18} />
              <span className="hidden sm:inline">Cart</span>
              {items.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-black text-white text-xs font-bold w-5 h-5 flex items-center justify-center">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 md:py-8">
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 focus:border-black outline-none transition-all"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 border transition-all ${
                  viewMode === 'grid'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-black'
                }`}
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 border transition-all ${
                  viewMode === 'list'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-black'
                }`}
              >
                <List size={18} />
              </button>
            </div>
          </div>

          {settings?.enable_categories && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-2 font-medium whitespace-nowrap transition-all border ${
                  selectedCategory === 'all'
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                All Items
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 font-medium whitespace-nowrap transition-all border ${
                    selectedCategory === category.id
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-200'
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
            <div className="mb-4 pb-2 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-black">Special Combos</h2>
            </div>
            <div className={`grid gap-4 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-1'
            }`}>
              {bundles.map((bundle) => (
                <BundleCard key={bundle.id} bundle={bundle} />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 pb-2 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-black">
              {selectedCategory === 'all' ? 'All Products' : categories.find(c => c.id === selectedCategory)?.name}
            </h2>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 border border-gray-200">
              <p className="text-gray-500 text-lg">No products found</p>
            </div>
          ) : (
            <div className={`grid gap-6 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1'
            }`}>
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currency={restaurantInfo?.currency}
                  variants={variants[product.id]}
                  settings={settings}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {showCartSidebar && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCartSidebar(false)}
          ></div>
          <div className="ml-auto relative bg-white w-full max-w-md shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
              <button
                onClick={() => setShowCartSidebar(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <Cart
                onCheckout={() => {
                  setShowCartSidebar(false);
                  setShowCheckout(true);
                }}
                currency={restaurantInfo?.currency}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
