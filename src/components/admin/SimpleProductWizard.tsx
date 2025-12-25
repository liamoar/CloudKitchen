import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, Image as ImageIcon, Check, ChevronRight, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ProductOption {
  name: string;
  values: string[];
}

interface VariantWithImage {
  attributes: Record<string, string>;
  price: string;
  stock: string;
  sku: string;
  imageFile?: File;
  imagePreview?: string;
  imageUrl?: string;
}

interface SimpleProductWizardProps {
  businessId: string;
  enableStock: boolean;
  onSave: () => void;
  onCancel: () => void;
  editingProduct?: any;
}

export function SimpleProductWizard({
  businessId,
  enableStock,
  onSave,
  onCancel,
  editingProduct,
}: SimpleProductWizardProps) {
  const [step, setStep] = useState(1);

  // Basic info
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  // Variant questions
  const [hasOptions, setHasOptions] = useState<boolean | null>(null);
  const [option1Type, setOption1Type] = useState('');
  const [option1Values, setOption1Values] = useState('');
  const [option2Type, setOption2Type] = useState('');
  const [option2Values, setOption2Values] = useState('');
  const [needsOption2, setNeedsOption2] = useState(false);

  // Pricing
  const [samePrice, setSamePrice] = useState<boolean | null>(null);
  const [basePrice, setBasePrice] = useState('');

  // Images
  const [needsDifferentImages, setNeedsDifferentImages] = useState<boolean | null>(null);
  const [simpleImage, setSimpleImage] = useState<File | null>(null);
  const [simpleImagePreview, setSimpleImagePreview] = useState('');

  // Generated variants
  const [variants, setVariants] = useState<VariantWithImage[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingProduct) {
      loadExistingProduct();
    }
  }, [editingProduct]);

  const loadExistingProduct = async () => {
    if (!editingProduct) return;

    setProductName(editingProduct.name || '');
    setDescription(editingProduct.description || '');
    setSimpleImagePreview(editingProduct.image_url || '');

    try {
      const { data: existingVariants } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', editingProduct.id)
        .order('created_at');

      if (existingVariants && existingVariants.length > 0) {
        setHasOptions(true);

        const variantIds = existingVariants.map(v => v.id);
        const { data: variantImages } = await supabase
          .from('product_variant_images')
          .select('*')
          .in('variant_id', variantIds)
          .order('display_order');

        const imagesByVariant: Record<string, string> = {};
        if (variantImages) {
          variantImages.forEach(img => {
            if (!imagesByVariant[img.variant_id]) {
              imagesByVariant[img.variant_id] = img.image_url;
            }
          });
        }

        const loadedVariants = existingVariants.map(v => ({
          attributes: v.attributes,
          price: v.price.toString(),
          stock: v.stock_quantity.toString(),
          sku: v.sku_code,
          imageUrl: imagesByVariant[v.id],
          imagePreview: imagesByVariant[v.id],
        }));

        setVariants(loadedVariants);

        const allSamePrice = existingVariants.every(v => v.price === existingVariants[0].price);
        setSamePrice(allSamePrice);
        if (allSamePrice) {
          setBasePrice(existingVariants[0].price.toString());
        }

        const hasImages = Object.keys(imagesByVariant).length > 0;
        setNeedsDifferentImages(hasImages);

        const attrs = loadedVariants[0]?.attributes || {};
        const attrKeys = Object.keys(attrs);
        if (attrKeys.length > 0) {
          setOption1Type(attrKeys[0]);
          const uniqueValues1 = [...new Set(loadedVariants.map(v => v.attributes[attrKeys[0]]))];
          setOption1Values(uniqueValues1.join(', '));

          if (attrKeys.length > 1) {
            setNeedsOption2(true);
            setOption2Type(attrKeys[1]);
            const uniqueValues2 = [...new Set(loadedVariants.map(v => v.attributes[attrKeys[1]]))];
            setOption2Values(uniqueValues2.join(', '));
          }
        }
      } else {
        setHasOptions(false);
        setBasePrice(editingProduct.price?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading existing product:', error);
    }
  };

  const commonOptions = [
    { value: 'color', label: 'Color (Red, Blue, Green...)' },
    { value: 'size', label: 'Size (S, M, L, XL...)' },
    { value: 'capacity', label: 'Storage/Capacity (256GB, 512GB...)' },
    { value: 'material', label: 'Material (Cotton, Leather...)' },
    { value: 'style', label: 'Style/Model' },
  ];

  const generateVariants = () => {
    const opt1Values = option1Values.split(',').map(v => v.trim()).filter(Boolean);
    const opt2Values = needsOption2 ? option2Values.split(',').map(v => v.trim()).filter(Boolean) : [];

    const newVariants: VariantWithImage[] = [];

    if (opt2Values.length > 0) {
      // Two options (e.g., color + size)
      opt1Values.forEach(v1 => {
        opt2Values.forEach(v2 => {
          newVariants.push({
            attributes: { [option1Type]: v1, [option2Type]: v2 },
            price: basePrice,
            stock: '0',
            sku: `${productName.substring(0, 3).toUpperCase()}-${v1.substring(0, 3).toUpperCase()}-${v2.substring(0, 3).toUpperCase()}`,
          });
        });
      });
    } else {
      // One option only (e.g., just color)
      opt1Values.forEach(v1 => {
        newVariants.push({
          attributes: { [option1Type]: v1 },
          price: basePrice,
          stock: '0',
          sku: `${productName.substring(0, 3).toUpperCase()}-${v1.substring(0, 3).toUpperCase()}`,
        });
      });
    }

    setVariants(newVariants);
  };

  const updateVariantPrice = (index: number, price: string) => {
    const updated = [...variants];
    updated[index].price = price;
    setVariants(updated);
  };

  const updateVariantStock = (index: number, stock: string) => {
    const updated = [...variants];
    updated[index].stock = stock;
    setVariants(updated);
  };

  const updateVariantImage = (index: number, file: File) => {
    const updated = [...variants];
    updated[index].imageFile = file;
    updated[index].imagePreview = URL.createObjectURL(file);
    setVariants(updated);
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      setError('Please enter a product name');
      return;
    }

    if (!hasOptions && (!basePrice || parseFloat(basePrice) <= 0)) {
      setError('Please enter a valid price');
      return;
    }

    if (hasOptions && samePrice && (!basePrice || parseFloat(basePrice) <= 0)) {
      setError('Please enter a valid price for all options');
      return;
    }

    if (hasOptions && !samePrice) {
      const invalidVariants = variants.filter(v => !v.price || parseFloat(v.price) <= 0);
      if (invalidVariants.length > 0) {
        setError('Please enter a valid price for all variants');
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      const productData: any = {
        business_id: businessId,
        name: productName,
        description: description,
        price: hasOptions ? 0 : parseFloat(basePrice),
        is_available: true,
        stock_quantity: hasOptions ? 0 : (enableStock ? parseInt(basePrice) || 0 : 0),
      };

      // Upload simple product image if no variants
      if (!hasOptions && simpleImage) {
        const fileExt = simpleImage.name.split('.').pop();
        const fileName = `${businessId}/${Date.now()}/main.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, simpleImage, { upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);
          productData.image_url = urlData.publicUrl;
        }
      }

      let product;
      if (editingProduct) {
        const { data: updated, error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id)
          .select()
          .single();

        if (updateError) throw updateError;
        product = updated;

        if (hasOptions) {
          await supabase
            .from('product_variants')
            .delete()
            .eq('product_id', editingProduct.id);

          await supabase
            .from('product_variant_images')
            .delete()
            .in('variant_id', supabase.from('product_variants').select('id').eq('product_id', editingProduct.id));
        }
      } else {
        const { data: created, error: createError } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (createError) throw createError;
        product = created;
      }

      // Create variants if applicable
      if (hasOptions && variants.length > 0) {
        const variantsToInsert = variants.map(v => ({
          business_id: businessId,
          product_id: product.id,
          sku_code: v.sku,
          attributes: v.attributes,
          price: samePrice ? parseFloat(basePrice) : parseFloat(v.price),
          stock_quantity: enableStock ? parseInt(v.stock) || 0 : 0,
          is_active: true,
        }));

        const { data: insertedVariants, error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert)
          .select();

        if (variantsError) throw variantsError;

        // Upload variant images
        if (needsDifferentImages && insertedVariants) {
          for (let i = 0; i < variants.length; i++) {
            if (variants[i].imageFile) {
              const fileExt = variants[i].imageFile!.name.split('.').pop();
              const fileName = `${businessId}/${product.id}/${insertedVariants[i].id}.${fileExt}`;

              const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, variants[i].imageFile!, { upsert: true });

              if (!uploadError) {
                const { data: urlData } = supabase.storage
                  .from('product-images')
                  .getPublicUrl(fileName);

                await supabase
                  .from('product_variant_images')
                  .insert({
                    variant_id: insertedVariants[i].id,
                    image_url: urlData.publicUrl,
                    display_order: 0,
                  });
              }
            }
          }
        }
      }

      onSave();
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-1">Step 1: Basic Information</h3>
              <p className="text-sm text-blue-800">Let's start with the product name and description</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Product Name *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="e.g., Casual Pants"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Tell customers about this product..."
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!productName.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                Continue <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-1">Step 2: Product Options</h3>
              <p className="text-sm text-blue-800">Does your product come in different colors, sizes, or models?</p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <p className="text-lg font-semibold text-gray-900 mb-4">
                Does this product have different options?
              </p>
              <p className="text-sm text-gray-600 mb-4">
                For example: different colors, sizes, storage capacities, etc.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setHasOptions(false)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    hasOptions === false
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                      : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <div className="text-4xl mb-2">📦</div>
                  <div className="font-bold text-lg mb-1">No</div>
                  <div className="text-sm opacity-80">Simple product, one option only</div>
                  {hasOptions === false && (
                    <div className="mt-3">
                      <Check size={24} className="mx-auto" />
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setHasOptions(true)}
                  className={`p-6 rounded-xl border-2 transition-all ${
                    hasOptions === true
                      ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                      : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <div className="text-4xl mb-2">🎨</div>
                  <div className="font-bold text-lg mb-1">Yes</div>
                  <div className="text-sm opacity-80">Multiple colors, sizes, etc.</div>
                  {hasOptions === true && (
                    <div className="mt-3">
                      <Check size={24} className="mx-auto" />
                    </div>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(hasOptions ? 3 : 4)}
                disabled={hasOptions === null}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                Continue <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-1">Step 3: Define Options</h3>
              <p className="text-sm text-blue-800">What options does this product have?</p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <label className="block text-sm font-bold text-gray-900 mb-2">First Option Type</label>
              <select
                value={option1Type}
                onChange={(e) => setOption1Type(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
              >
                <option value="">Select an option type...</option>
                {commonOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>

              {option1Type && (
                <div className="mb-4">
                  <label className="block text-sm font-bold text-gray-900 mb-2">
                    What {option1Type}s are available?
                  </label>
                  <input
                    type="text"
                    value={option1Values}
                    onChange={(e) => setOption1Values(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder={`e.g., ${option1Type === 'color' ? 'Red, Blue, Green' : option1Type === 'size' ? 'S, M, L, XL' : option1Type === 'capacity' ? '256GB, 512GB, 1TB' : 'Option 1, Option 2, Option 3'}`}
                  />
                  <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
                </div>
              )}

              {option1Type && option1Values && (
                <div className="pt-4 border-t">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={needsOption2}
                      onChange={(e) => setNeedsOption2(e.target.checked)}
                      className="w-5 h-5"
                    />
                    <span className="font-semibold text-gray-900">
                      Add another option (e.g., size, capacity)
                    </span>
                  </label>
                </div>
              )}

              {needsOption2 && (
                <div className="mt-4 pt-4 border-t">
                  <label className="block text-sm font-bold text-gray-900 mb-2">Second Option Type</label>
                  <select
                    value={option2Type}
                    onChange={(e) => setOption2Type(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
                  >
                    <option value="">Select second option...</option>
                    {commonOptions.filter(o => o.value !== option1Type).map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {option2Type && (
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">
                        What {option2Type}s are available?
                      </label>
                      <input
                        type="text"
                        value={option2Values}
                        onChange={(e) => setOption2Values(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder={`e.g., ${option2Type === 'size' ? 'S, M, L, XL' : option2Type === 'capacity' ? '256GB, 512GB, 1TB' : 'Option 1, Option 2, Option 3'}`}
                      />
                      <p className="text-xs text-gray-500 mt-1">Separate with commas</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (needsOption2 && (!option2Type || !option2Values)) {
                    setError('Please fill in the second option');
                    return;
                  }
                  generateVariants();
                  setStep(4);
                }}
                disabled={!option1Type || !option1Values}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                Continue <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-1">Step 4: Pricing</h3>
              <p className="text-sm text-blue-800">Set the price for your product</p>
            </div>

            {hasOptions && (
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-4">
                <p className="text-lg font-semibold text-gray-900 mb-4">
                  Is the price the same for all options?
                </p>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button
                    onClick={() => setSamePrice(true)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      samePrice === true
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                        : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <div className="font-bold mb-1">Yes, same price</div>
                    <div className="text-sm opacity-80">All options cost the same</div>
                    {samePrice === true && <Check size={20} className="mx-auto mt-2" />}
                  </button>

                  <button
                    onClick={() => setSamePrice(false)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      samePrice === false
                        ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                        : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    <div className="font-bold mb-1">No, different prices</div>
                    <div className="text-sm opacity-80">Each option has its own price</div>
                    {samePrice === false && <Check size={20} className="mx-auto mt-2" />}
                  </button>
                </div>
              </div>
            )}

            {(!hasOptions || samePrice === true) && (
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Price *</label>
                <input
                  type="number"
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                  placeholder="0.00"
                />
              </div>
            )}

            {hasOptions && samePrice === false && variants.length > 0 && (
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h4 className="font-bold text-gray-900 mb-4">
                  Set price for each option: ({variants.length} variants)
                </h4>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {variants.map((variant, index) => (
                    <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1 font-medium text-gray-900">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <span key={key} className="mr-2 capitalize">
                            {key}: {value}
                          </span>
                        ))}
                      </div>
                      <input
                        type="number"
                        step="0.01"
                        value={variant.price}
                        onChange={(e) => updateVariantPrice(index, e.target.value)}
                        className="w-32 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Price"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(hasOptions ? 3 : 2)}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={
                  hasOptions
                    ? samePrice === null || (samePrice && !basePrice) || (!samePrice && variants.some(v => !v.price || parseFloat(v.price) <= 0))
                    : !basePrice || parseFloat(basePrice) <= 0
                }
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                Continue <ChevronRight size={20} />
              </button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-1">Step 5: Images</h3>
              <p className="text-sm text-blue-800">Add photos of your product</p>
            </div>

            {!hasOptions && (
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <label className="block text-sm font-bold text-gray-900 mb-3">Product Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border-2 border-gray-300">
                    {simpleImagePreview ? (
                      <img src={simpleImagePreview} alt="Product" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={48} className="text-gray-400" />
                    )}
                  </div>
                  <label className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer flex items-center gap-2 font-semibold">
                    <Upload size={20} />
                    {simpleImagePreview ? 'Change Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSimpleImage(file);
                          setSimpleImagePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {hasOptions && (
              <>
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 mb-4">
                  <p className="text-lg font-semibold text-gray-900 mb-4">
                    Do different options need different photos?
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    For example: show red product when customer selects red color
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setNeedsDifferentImages(false)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        needsDifferentImages === false
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                          : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      <div className="font-bold mb-1">No</div>
                      <div className="text-sm opacity-80">One photo for all</div>
                      {needsDifferentImages === false && <Check size={20} className="mx-auto mt-2" />}
                    </button>

                    <button
                      onClick={() => setNeedsDifferentImages(true)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        needsDifferentImages === true
                          ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                          : 'bg-white text-gray-900 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      <div className="font-bold mb-1">Yes</div>
                      <div className="text-sm opacity-80">Different photo for each option</div>
                      {needsDifferentImages === true && <Check size={20} className="mx-auto mt-2" />}
                    </button>
                  </div>
                </div>

                {needsDifferentImages && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                    <h4 className="font-bold text-gray-900 mb-4">
                      Upload photo for each option: ({variants.length} variants)
                    </h4>
                    <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                      {variants.map((variant, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="font-medium text-gray-900 mb-2 text-sm">
                            {Object.entries(variant.attributes).map(([key, value]) => `${value}`).join(' + ')}
                          </div>
                          <div className="w-full aspect-square bg-gray-200 rounded-lg overflow-hidden flex items-center justify-center mb-2">
                            {variant.imagePreview || variant.imageUrl ? (
                              <img
                                src={variant.imagePreview || variant.imageUrl}
                                alt={Object.values(variant.attributes).join(' ')}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon size={32} className="text-gray-400" />
                            )}
                          </div>
                          <label className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 cursor-pointer flex items-center justify-center gap-2 text-sm font-semibold">
                            <Upload size={16} />
                            {variant.imagePreview ? 'Change' : 'Upload'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) updateVariantImage(index, file);
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {enableStock && hasOptions && samePrice !== null && (
              <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
                <h4 className="font-bold text-gray-900 mb-4">
                  Stock Quantity (Optional): ({variants.length} variants)
                </h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {variants.map((variant, index) => (
                    <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
                      <div className="flex-1 font-medium text-gray-900 text-sm">
                        {Object.entries(variant.attributes).map(([key, value]) => `${value}`).join(' + ')}
                      </div>
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(e) => updateVariantStock(index, e.target.value)}
                        className="w-24 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(4)}
                className="px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Back
              </button>
              <button
                onClick={handleSave}
                disabled={saving || (hasOptions && needsDifferentImages === null)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 font-semibold"
              >
                {saving ? 'Saving...' : 'Save Product'} <Check size={20} />
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl p-8 max-w-3xl w-full my-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <XIcon size={24} />
            </button>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all ${
                  s <= step ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">Step {step} of 5</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-800">
            {error}
          </div>
        )}

        {renderStep()}
      </div>
    </div>
  );
}
