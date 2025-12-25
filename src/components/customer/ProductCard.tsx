import { useState } from 'react';
import { Plus, Package, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '../../lib/database.types';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../lib/utils';
import { getSubdomain } from '../../lib/utils';

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

  const getAttributeOptions = () => {
    if (!variants) return {};
    const options: Record<string, Set<string>> = {};

    variants.forEach((variant) => {
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

  const handleAddToCart = () => {
    if (hasValidVariants && selectedVariant) {
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
      <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-100">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-48 h-48 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center flex-shrink-0">
            {settings?.show_product_images && product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package size={64} className="text-blue-300" />
            )}
          </div>
          <div className="flex-1 p-6 flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex-1">
              <h3
                onClick={handleViewDetails}
                className="font-bold text-xl text-gray-900 mb-2 cursor-pointer hover:text-blue-600 transition-colors"
              >
                {product.name}
              </h3>
              <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>

              {hasVariants && !hasValidVariants && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    This product has variants but they are not configured correctly. Click "View" for details.
                  </p>
                </div>
              )}

              {hasValidVariants && selectedVariant && (
                <div className="space-y-3 mb-4">
                  {Object.entries(attributeOptions).map(([attrName, values]) => (
                    <div key={attrName}>
                      <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                        {attrName}
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {values.map((value) => (
                          <button
                            key={value}
                            onClick={() => selectVariantByAttributes(attrName, value)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
                    <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded-lg inline-block">
                      SKU: {selectedVariant.sku_code}
                    </div>
                  )}
                </div>
              )}

              {isOutOfStock && (
                <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-sm font-medium rounded-lg">
                  Out of Stock
                </span>
              )}
            </div>

            <div className="flex flex-col justify-between items-end gap-3">
              <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                {formatCurrency(currentPrice, currency)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleViewDetails}
                  className="bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-4 py-3 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg font-semibold"
                >
                  <Eye size={20} />
                  View
                </button>
                <button
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold"
                >
                  <Plus size={20} />
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
    <div className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden border border-gray-100 flex flex-col">
      <div className="h-48 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center relative overflow-hidden">
        {settings?.show_product_images && product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
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
        <h3
          onClick={handleViewDetails}
          className="font-bold text-lg text-gray-900 mb-2 line-clamp-1 cursor-pointer hover:text-blue-600 transition-colors"
        >
          {product.name}
        </h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">{product.description}</p>

        {hasVariants && !hasValidVariants && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs text-yellow-800">
              Variants not configured. Click "View" for details.
            </p>
          </div>
        )}

        {hasValidVariants && selectedVariant && (
          <div className="space-y-3 mb-4">
            {Object.entries(attributeOptions).map(([attrName, values]) => (
              <div key={attrName}>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 capitalize">
                  {attrName}
                </label>
                <div className="flex gap-2 flex-wrap">
                  {values.map((value) => (
                    <button
                      key={value}
                      onClick={() => selectVariantByAttributes(attrName, value)}
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

        <div className="space-y-3 mt-auto pt-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
              {formatCurrency(currentPrice, currency)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleViewDetails}
              className="flex-1 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg font-semibold text-sm"
            >
              <Eye size={16} />
              View
            </button>
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed font-semibold text-sm"
            >
              <Plus size={16} />
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
