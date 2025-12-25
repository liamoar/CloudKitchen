import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Package, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';
import { formatCurrency } from '../lib/utils';
import type { Product } from '../lib/database.types';

interface ProductVariant {
  id: string;
  product_id: string;
  sku_code: string;
  attributes: Record<string, string>;
  price: number;
  stock_quantity: number;
  is_active: boolean;
}

interface VariantImage {
  id: string;
  variant_id: string;
  image_url: string;
  display_order: number;
}

interface BusinessInfo {
  id: string;
  name: string;
  currency: string;
}

interface Settings {
  enable_multiple_sku: boolean;
  show_product_images: boolean;
  enable_stock_management: boolean;
}

export function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantImages, setVariantImages] = useState<Record<string, VariantImage[]>>({});
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    loadProductData();
  }, [productId]);

  const loadProductData = async () => {
    try {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('id, name, countries!inner(currency_symbol)')
        .maybeSingle();

      if (!businessData) return;

      setBusiness({
        id: businessData.id,
        name: businessData.name || 'Our Store',
        currency: businessData.countries?.currency_symbol || 'USD',
      });

      const { data: productData } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('business_id', businessData.id)
        .maybeSingle();

      if (!productData) {
        navigate(-1);
        return;
      }

      setProduct(productData);

      const { data: settingsData } = await supabase
        .from('business_settings')
        .select('enable_multiple_sku, show_product_images, enable_stock_management')
        .eq('business_id', businessData.id)
        .maybeSingle();

      if (settingsData) {
        setSettings(settingsData);

        if (settingsData.enable_multiple_sku) {
          const { data: variantsData } = await supabase
            .from('product_variants')
            .select('*')
            .eq('product_id', productId)
            .eq('is_active', true)
            .order('created_at');

          if (variantsData && variantsData.length > 0) {
            setVariants(variantsData);
            setSelectedVariant(variantsData[0]);

            const variantIds = variantsData.map((v) => v.id);
            const { data: imagesData } = await supabase
              .from('product_variant_images')
              .select('*')
              .in('variant_id', variantIds)
              .order('display_order');

            if (imagesData) {
              const imagesByVariant: Record<string, VariantImage[]> = {};
              imagesData.forEach((img) => {
                if (!imagesByVariant[img.variant_id]) {
                  imagesByVariant[img.variant_id] = [];
                }
                imagesByVariant[img.variant_id].push(img);
              });
              setVariantImages(imagesByVariant);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!product) return;

    if (selectedVariant) {
      addItem({
        id: selectedVariant.id,
        name: `${product.name} (${Object.values(selectedVariant.attributes).join(', ')})`,
        price: selectedVariant.price,
        type: 'PRODUCT',
      });
    } else {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        type: 'PRODUCT',
      });
    }

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const getCurrentImage = () => {
    if (settings?.show_product_images) {
      if (selectedVariant && variantImages[selectedVariant.id]?.length > 0) {
        return variantImages[selectedVariant.id][0].image_url;
      }
      return product?.image_url;
    }
    return null;
  };

  const currentPrice = selectedVariant ? selectedVariant.price : product?.price || 0;
  const isOutOfStock = settings?.enable_stock_management
    ? selectedVariant
      ? selectedVariant.stock_quantity === 0
      : product?.stock_quantity === 0
    : false;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Product not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={24} className="text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{business?.name}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8">
              <div className="aspect-square bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl flex items-center justify-center overflow-hidden">
                {getCurrentImage() ? (
                  <img
                    src={getCurrentImage()!}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={120} className="text-blue-300" />
                )}
              </div>
            </div>

            <div className="p-8 flex flex-col">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h2>
              <p className="text-gray-600 mb-6 text-lg">{product.description}</p>

              {settings?.enable_multiple_sku && variants.length > 0 ? (
                <div className="space-y-6 mb-8">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Variants</h3>
                    <div className="space-y-3">
                      {variants.map((variant) => {
                        const isSelected = selectedVariant?.id === variant.id;
                        const variantImage = variantImages[variant.id]?.[0];
                        const variantOutOfStock = settings?.enable_stock_management && variant.stock_quantity === 0;

                        return (
                          <button
                            key={variant.id}
                            onClick={() => setSelectedVariant(variant)}
                            disabled={variantOutOfStock}
                            className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300 bg-white'
                            } ${variantOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center gap-4">
                              {settings?.show_product_images && variantImage && (
                                <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                  <img
                                    src={variantImage.image_url}
                                    alt={`${product.name} - ${Object.values(variant.attributes).join(', ')}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-900">
                                    {Object.values(variant.attributes).join(', ')}
                                  </span>
                                  {isSelected && (
                                    <Check size={18} className="text-blue-600 flex-shrink-0" />
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 mb-1">SKU: {variant.sku_code}</div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-lg font-bold text-blue-600">
                                    {formatCurrency(variant.price, business?.currency)}
                                  </span>
                                  {variantOutOfStock && (
                                    <span className="text-sm text-red-600 font-medium">Out of Stock</span>
                                  )}
                                  {settings?.enable_stock_management && !variantOutOfStock && (
                                    <span className="text-sm text-gray-500">
                                      Stock: {variant.stock_quantity}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-8">
                  {product.category && (
                    <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium mb-4">
                      {product.category}
                    </div>
                  )}
                  {settings?.enable_stock_management && (
                    <div className="text-sm text-gray-500 mb-4">
                      {isOutOfStock ? (
                        <span className="text-red-600 font-medium">Out of Stock</span>
                      ) : (
                        <span>Stock: {product.stock_quantity}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-auto">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {formatCurrency(currentPrice, business?.currency)}
                  </span>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold text-lg"
                >
                  {addedToCart ? (
                    <>
                      <Check size={24} />
                      Added to Cart
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={24} />
                      {isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
