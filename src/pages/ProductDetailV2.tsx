import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Check, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCart } from '../contexts/CartContext';

interface BusinessFile {
  id: string;
  storage_path: string;
}

interface ProductImage {
  id: string;
  file_id: string;
  display_order: number;
  is_primary: boolean;
  file?: BusinessFile;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  base_price: number;
  has_variants: boolean;
  is_available: boolean;
  track_inventory: boolean;
  images?: ProductImage[];
}

interface Variant {
  id: string;
  sku: string;
  variant_name: string;
  price: number;
  stock_quantity: number;
  is_available: boolean;
  attributes?: Array<{ attribute_name: string; attribute_value: string }>;
  images?: Array<{ file?: BusinessFile }>;
}

interface Business {
  id: string;
  name: string;
  currency: string;
}

export function ProductDetailV2() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  useEffect(() => {
    loadProductData();
  }, [productId]);

  const loadProductData = async () => {
    try {
      const subdomain = window.location.hostname.split('.')[0];

      const { data: businessData, error: businessError } = await supabase
        .from('businesses')
        .select('id, name, countries!inner(currency_symbol)')
        .eq('subdomain', subdomain)
        .maybeSingle();

      if (businessError || !businessData) {
        console.error('Error loading business:', businessError);
        return;
      }

      setBusiness({
        id: businessData.id,
        name: businessData.name || 'Store',
        currency: businessData.countries?.currency_symbol || '$',
      });

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          images:product_images(
            id,
            file_id,
            display_order,
            is_primary,
            file:business_files(id, storage_path)
          )
        `)
        .eq('id', productId)
        .eq('business_id', businessData.id)
        .eq('is_available', true)
        .maybeSingle();

      if (productError || !productData) {
        console.error('Error loading product:', productError);
        navigate('/');
        return;
      }

      productData.images?.sort((a, b) => a.display_order - b.display_order);
      setProduct(productData);

      if (productData.has_variants) {
        const { data: variantsData } = await supabase
          .from('product_variants')
          .select(`
            *,
            attributes:product_variant_attributes(attribute_name, attribute_value),
            images:product_variant_images(
              file:business_files(id, storage_path)
            )
          `)
          .eq('product_id', productId)
          .eq('is_available', true);

        setVariants(variantsData || []);
        if (variantsData && variantsData.length > 0) {
          setSelectedVariant(variantsData[0]);
        }
      }
    } catch (error) {
      console.error('Error in loadProductData:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('business-files').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleAttributeChange = (attrName: string, attrValue: string) => {
    const newSelection = { ...selectedAttributes, [attrName]: attrValue };
    setSelectedAttributes(newSelection);

    const matchingVariant = variants.find((v) =>
      v.attributes?.every(
        (attr) => newSelection[attr.attribute_name] === attr.attribute_value
      )
    );

    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
    }
  };

  const handleAddToCart = () => {
    if (!product || !business) return;

    if (product.has_variants && !selectedVariant) {
      alert('Please select all options');
      return;
    }

    const finalPrice = selectedVariant ? selectedVariant.price : product.base_price;
    const variantName = selectedVariant ? selectedVariant.variant_name : '';

    addItem({
      productId: product.id,
      variantId: selectedVariant?.id,
      name: product.name,
      variantName: variantName,
      price: finalPrice,
      quantity: quantity,
      currency: business.currency,
    });

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const getAllImages = () => {
    if (!product) return [];

    const productImages = product.images?.filter(img => img.file).map(img => img.file!) || [];
    const variantImages = selectedVariant?.images?.filter(img => img.file).map(img => img.file!) || [];

    return variantImages.length > 0 ? variantImages : productImages;
  };

  const getAttributeOptions = () => {
    if (!variants || variants.length === 0) return {};

    const options: Record<string, Set<string>> = {};

    variants.forEach((variant) => {
      variant.attributes?.forEach((attr) => {
        if (!options[attr.attribute_name]) {
          options[attr.attribute_name] = new Set();
        }
        options[attr.attribute_name].add(attr.attribute_value);
      });
    });

    return Object.fromEntries(
      Object.entries(options).map(([key, value]) => [key, Array.from(value)])
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product not found</h2>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:underline"
          >
            Return to store
          </button>
        </div>
      </div>
    );
  }

  const images = getAllImages();
  const displayPrice = selectedVariant ? selectedVariant.price : product.base_price;
  const attributeOptions = getAttributeOptions();
  const inStock = !product.track_inventory || (selectedVariant ? selectedVariant.stock_quantity > 0 : true);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back to Store
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 p-6">
            <div>
              {images.length > 0 ? (
                <>
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
                    <img
                      src={getImageUrl(images[selectedImageIndex].storage_path)}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {images.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((img, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`aspect-square rounded-lg overflow-hidden border-2 ${
                            selectedImageIndex === index
                              ? 'border-blue-600'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={getImageUrl(img.storage_path)}
                            alt={`${product.name} ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
                  <Package size={64} className="text-gray-400" />
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
                {product.category && (
                  <p className="text-sm text-gray-500 mb-4">{product.category}</p>
                )}
                <div className="text-3xl font-bold text-blue-600">
                  {business?.currency}{displayPrice.toFixed(2)}
                </div>
              </div>

              {product.description && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              {product.has_variants && Object.keys(attributeOptions).length > 0 && (
                <div className="space-y-4">
                  {Object.entries(attributeOptions).map(([attrName, values]) => (
                    <div key={attrName}>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        {attrName}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {values.map((value) => {
                          const isSelected = selectedAttributes[attrName] === value;
                          return (
                            <button
                              key={value}
                              onClick={() => handleAttributeChange(attrName, value)}
                              className={`px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-50 text-blue-600'
                                  : 'border-gray-300 hover:border-gray-400 text-gray-700'
                              }`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedVariant && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>SKU:</strong> {selectedVariant.sku}
                  </p>
                  {product.track_inventory && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Stock:</strong>{' '}
                      {selectedVariant.stock_quantity > 0
                        ? `${selectedVariant.stock_quantity} available`
                        : 'Out of stock'}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:border-gray-400"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center px-3 py-2 border-2 rounded-lg"
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center hover:border-gray-400"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {!inStock ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-red-700 font-medium">Out of Stock</p>
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={addedToCart}
                  className={`w-full py-4 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    addedToCart
                      ? 'bg-green-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {addedToCart ? (
                    <>
                      <Check size={20} />
                      Added to Cart!
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={20} />
                      Add to Cart
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
