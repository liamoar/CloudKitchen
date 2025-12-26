import { useState, useEffect } from 'react';
import { Plus, Package, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../lib/database.types';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../lib/utils';
import { getSubdomain } from '../../lib/utils';
import { supabase } from '../../lib/supabase';

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

interface Settings {
  enable_categories: boolean;
  enable_multiple_sku: boolean;
  show_product_images: boolean;
  enable_stock_management: boolean;
}

interface ProductCardProps {
  product: Product;
  currency?: string;
  variants?: ProductVariant[];
  settings?: Settings | null;
  viewMode?: 'grid' | 'list';
}

export function ProductCard({
  product,
  currency = 'AED',
  variants,
  settings,
  viewMode = 'grid',
}: ProductCardProps) {
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    variants && variants.length > 0 ? variants[0] : null
  );
  const [variantImages, setVariantImages] = useState<Record<string, string>>({});
  const [loadingImages, setLoadingImages] = useState(false);

  useEffect(() => {
    if (!variants || variants.length === 0) return;

    const loadVariantImages = async () => {
      setLoadingImages(true);
      try {
        const variantIds = variants.map(v => v.id);
        const { data } = await supabase
          .from('product_variant_images')
          .select('variant_id, image_url')
          .in('variant_id', variantIds)
          .order('display_order', { ascending: true });

        if (data) {
          const imageMap: Record<string, string> = {};
          data.forEach(img => {
            if (!imageMap[img.variant_id]) {
              imageMap[img.variant_id] = img.image_url;
            }
          });
          setVariantImages(imageMap);
        }
      } catch (error) {
        console.error('Error loading variant images:', error);
      } finally {
        setLoadingImages(false);
      }
    };

    loadVariantImages();
  }, [variants]);

  const getAttributeOptions = () => {
    if (!variants) return {};
    const options: Record<string, Set<string>> = {};

    variants.forEach((variant) => {
      if (!variant.attributes || typeof variant.attributes !== 'object') return;

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

  const attributeOptions = getAttributeOptions();
  const hasValidVariants = settings?.enable_multiple_sku && variants && variants.length > 0 && Object.keys(attributeOptions).length > 0;
  const hasVariants = settings?.enable_multiple_sku && variants && variants.length > 0;
  const currentPrice = hasValidVariants && selectedVariant ? selectedVariant.price : product.price;
  const isOutOfStock = settings?.enable_stock_management
    ? hasValidVariants
      ? selectedVariant?.stock_quantity === 0
      : product.stock_quantity === 0
    : false;

  const getCurrentImage = () => {
    if (hasValidVariants && selectedVariant && variantImages[selectedVariant.id]) {
      return variantImages[selectedVariant.id];
    }
    return product.image_url;
  };

  const currentImage = getCurrentImage();

  const handleAddToCart = () => {
    if (hasValidVariants && selectedVariant) {
      const attributeValues = selectedVariant.attributes
        ? Object.values(selectedVariant.attributes).join(', ')
        : '';
      addItem({
        id: selectedVariant.id,
        name: `${product.name}${attributeValues ? ` (${attributeValues})` : ''}`,
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
  };

  const handleViewDetails = () => {
    const subdomain = getSubdomain();
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocalhost && subdomain) {
      navigate(`/business/${subdomain}/product/${product.id}`);
    } else {
      navigate(`/product/${product.id}`);
    }
  };

  const selectVariantByAttributes = (attributeName: string, value: string) => {
    if (!variants) return;

    const newAttributes = {
      ...(selectedVariant?.attributes || {}),
      [attributeName]: value,
    };

    const matchingVariant = variants.find((v) => {
      if (!v.attributes) return false;
      return Object.entries(newAttributes).every(
        ([key, val]) => v.attributes[key] === val
      );
    });

    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="bg-white border border-gray-200 hover:border-black transition-all overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-48 h-48 bg-gray-100 flex items-center justify-center flex-shrink-0">
            {settings?.show_product_images && currentImage ? (
              <img
                src={currentImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package size={64} className="text-gray-400" />
            )}
          </div>
          <div className="flex-1 p-6 flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1">
              <h3
                onClick={handleViewDetails}
                className="font-semibold text-lg text-black mb-2 cursor-pointer hover:text-gray-600 transition-colors"
              >
                {product.name}
              </h3>
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{product.description}</p>

              {hasVariants && !hasValidVariants && (
                <div className="mb-4 p-3 bg-gray-100 border border-gray-300">
                  <p className="text-xs text-gray-700">
                    This product has variants but they are not configured correctly. Click "View" for details.
                  </p>
                </div>
              )}

              {hasValidVariants && selectedVariant && (
                <div className="space-y-3 mb-4">
                  {Object.entries(attributeOptions).map(([attrName, values]) => (
                    <div key={attrName}>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase">
                        {attrName}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {values.map((value) => (
                          <button
                            key={value}
                            onClick={() => selectVariantByAttributes(attrName, value)}
                            className={`px-3 py-1.5 text-xs font-medium transition-all border ${
                              selectedVariant.attributes?.[attrName] === value
                                ? 'bg-black text-white border-black'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-black'
                            }`}
                          >
                            {value}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {selectedVariant && (
                    <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg inline-block">
                      SKU: {selectedVariant.sku_code}
                    </div>
                  )}
                </div>
              )}

              {isOutOfStock && (
                <span className="inline-block px-3 py-1 bg-black text-white text-xs font-medium">
                  Out of Stock
                </span>
              )}
            </div>

            <div className="flex flex-col justify-between items-end gap-3">
              <span className="text-2xl font-bold text-black">
                {formatCurrency(currentPrice, currency)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleViewDetails}
                  className="bg-white border border-black text-black hover:bg-black hover:text-white px-4 py-2 flex items-center gap-2 transition-all font-medium"
                >
                  <Eye size={18} />
                  View
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="bg-black hover:bg-gray-800 text-white px-5 py-2 flex items-center gap-2 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  <Plus size={18} />
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 hover:border-black transition-all overflow-hidden flex flex-col">
      <div className="h-48 bg-gray-100 flex items-center justify-center relative overflow-hidden">
        {settings?.show_product_images && currentImage ? (
          <img
            src={currentImage}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package size={64} className="text-gray-400" />
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <span className="bg-white text-black px-4 py-2 font-semibold">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <h3
          onClick={handleViewDetails}
          className="font-semibold text-base text-black mb-1.5 line-clamp-1 cursor-pointer hover:text-gray-600 transition-colors"
        >
          {product.name}
        </h3>
        <p className="text-xs text-gray-600 mb-3 line-clamp-2 flex-1">{product.description}</p>

        {hasVariants && !hasValidVariants && (
          <div className="mb-3 p-2 bg-gray-100 border border-gray-300">
            <p className="text-xs text-gray-700">
              Variants not configured. Click "View" for details.
            </p>
          </div>
        )}

        {hasValidVariants && selectedVariant && (
          <div className="space-y-2 mb-3">
            {Object.entries(attributeOptions).map(([attrName, values]) => (
              <div key={attrName}>
                <label className="block text-xs font-medium text-gray-700 mb-1 uppercase">
                  {attrName}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {values.map((value) => (
                    <button
                      key={value}
                      onClick={() => selectVariantByAttributes(attrName, value)}
                      className={`px-2.5 py-1 text-xs font-medium transition-all border ${
                        selectedVariant.attributes?.[attrName] === value
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-black'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {selectedVariant && (
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 inline-block">
                SKU: {selectedVariant.sku_code}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2.5 mt-auto pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold text-black">
              {formatCurrency(currentPrice, currency)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleViewDetails}
              className="flex-1 bg-white border border-black text-black hover:bg-black hover:text-white px-3 py-2 flex items-center justify-center gap-1.5 transition-all font-medium text-sm"
            >
              <Eye size={14} />
              View
            </button>
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="flex-1 bg-black hover:bg-gray-800 text-white px-3 py-2 flex items-center justify-center gap-1.5 transition-all disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-sm"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
