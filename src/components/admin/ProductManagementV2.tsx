import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Image as ImageIcon, Save, X, Grid, List } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BusinessFile {
  id: string;
  file_name: string;
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
}

interface ProductManagementV2Props {
  businessId: string;
  currency: string;
}

export default function ProductManagementV2({ businessId, currency }: ProductManagementV2Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadProducts();
  }, [businessId]);

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          images:product_images(
            id,
            file_id,
            display_order,
            is_primary,
            file:business_files(id, file_name, storage_path)
          )
        `)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Delete this product? This will also delete all variants and cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      setProducts(products.filter(p => p.id !== productId));
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert('Error deleting product: ' + error.message);
    }
  };

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('business-files').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  if (loading) {
    return <div className="text-center py-12">Loading products...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Products</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Product
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <ImageIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products yet</h3>
          <p className="text-gray-600 mb-4">Create your first product to start selling</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map(product => {
            const primaryImage = product.images?.find(img => img.is_primary)?.file;
            const firstImage = product.images?.[0]?.file;
            const displayImage = primaryImage || firstImage;

            return (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative h-48 bg-gray-200">
                  {displayImage ? (
                    <img
                      src={getImageUrl(displayImage.storage_path)}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  {!product.is_available && (
                    <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                      Unavailable
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-1">{product.name}</h3>
                  {product.category && (
                    <p className="text-sm text-gray-500 mb-2">{product.category}</p>
                  )}
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xl font-bold text-blue-600">
                      {currency}{product.base_price.toFixed(2)}
                    </span>
                    {product.has_variants && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        Has Variants
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center justify-center gap-1"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateProductModal
          businessId={businessId}
          currency={currency}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadProducts();
          }}
        />
      )}

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          businessId={businessId}
          currency={currency}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

interface CreateProductModalProps {
  businessId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateProductModal({ businessId, currency, onClose, onSuccess }: CreateProductModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    base_price: '',
    has_variants: false,
    track_inventory: false,
    is_available: true,
  });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [variantAttributes, setVariantAttributes] = useState<Array<{ name: string; values: string[] }>>([]);
  const [generatedVariants, setGeneratedVariants] = useState<Array<{ name: string; price: string; stock: string; sku: string }>>([]);
  const [saving, setSaving] = useState(false);

  const handleNext = () => {
    if (step === 1 && (!formData.name || !formData.base_price)) {
      alert('Please fill in product name and price');
      return;
    }
    if (step === 3 && formData.has_variants && variantAttributes.length === 0) {
      alert('Please define at least one variant attribute');
      return;
    }
    setStep(step + 1);
  };

  const handleGenerateVariants = () => {
    if (variantAttributes.length === 0) {
      setGeneratedVariants([]);
      return;
    }

    const combinations: string[][] = [[]];
    for (const attr of variantAttributes) {
      const newCombinations: string[][] = [];
      for (const combination of combinations) {
        for (const value of attr.values) {
          newCombinations.push([...combination, value]);
        }
      }
      combinations.length = 0;
      combinations.push(...newCombinations);
    }

    const variants = combinations.map((combo, index) => {
      const variantName = combo.join(' / ');
      const sku = `${formData.name.substring(0, 3).toUpperCase()}-${index + 1}`;
      return {
        name: variantName,
        price: formData.base_price,
        stock: formData.track_inventory ? '0' : '',
        sku: sku,
      };
    });

    setGeneratedVariants(variants);
  };

  useEffect(() => {
    if (formData.has_variants) {
      handleGenerateVariants();
    }
  }, [variantAttributes, formData.has_variants]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          business_id: businessId,
          name: formData.name,
          description: formData.description,
          category: formData.category,
          base_price: parseFloat(formData.base_price),
          has_variants: formData.has_variants,
          track_inventory: formData.track_inventory,
          is_available: formData.is_available,
        })
        .select()
        .single();

      if (productError) throw productError;

      if (selectedImages.length > 0) {
        const imageInserts = selectedImages.map((fileId, index) => ({
          product_id: product.id,
          file_id: fileId,
          display_order: index,
          is_primary: index === 0,
        }));

        const { error: imagesError } = await supabase
          .from('product_images')
          .insert(imageInserts);

        if (imagesError) throw imagesError;
      }

      if (formData.has_variants && generatedVariants.length > 0) {
        for (const variant of generatedVariants) {
          const { data: variantData, error: variantError } = await supabase
            .from('product_variants')
            .insert({
              product_id: product.id,
              sku: variant.sku,
              variant_name: variant.name,
              price: parseFloat(variant.price),
              stock_quantity: variant.stock ? parseInt(variant.stock) : 0,
              is_available: true,
            })
            .select()
            .single();

          if (variantError) throw variantError;

          const variantNameParts = variant.name.split(' / ');
          const attributes = variantAttributes.map((attr, index) => ({
            variant_id: variantData.id,
            attribute_name: attr.name,
            attribute_value: variantNameParts[index],
          }));

          const { error: attrsError } = await supabase
            .from('product_variant_attributes')
            .insert(attributes);

          if (attrsError) throw attrsError;
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error creating product:', error);
      alert('Error creating product: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold">Create Product - Step {step} of 4</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {step === 1 && (
            <Step1BasicInfo formData={formData} setFormData={setFormData} />
          )}
          {step === 2 && (
            <Step2Images
              businessId={businessId}
              selectedImages={selectedImages}
              setSelectedImages={setSelectedImages}
            />
          )}
          {step === 3 && formData.has_variants && (
            <Step3Variants
              variantAttributes={variantAttributes}
              setVariantAttributes={setVariantAttributes}
            />
          )}
          {step === 4 && formData.has_variants && (
            <Step4VariantMatrix
              generatedVariants={generatedVariants}
              setGeneratedVariants={setGeneratedVariants}
              currency={currency}
              trackInventory={formData.track_inventory}
            />
          )}
          {step === (formData.has_variants ? 4 : 3) && (
            <div className="border-t pt-4 mt-4">
              <h3 className="font-bold mb-2">Review</h3>
              <div className="space-y-2 text-sm">
                <p><strong>Product:</strong> {formData.name}</p>
                <p><strong>Price:</strong> {currency}{formData.base_price}</p>
                <p><strong>Images:</strong> {selectedImages.length} selected</p>
                {formData.has_variants && (
                  <p><strong>Variants:</strong> {generatedVariants.length} generated</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-6 border-t sticky bottom-0 bg-white">
          {step > 1 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 border rounded hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {step < (formData.has_variants ? 4 : 3) && (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Next
            </button>
          )}
          {step === (formData.has_variants ? 4 : 3) && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Creating...' : 'Create Product'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1BasicInfo({ formData, setFormData }: any) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold mb-4">Basic Information</h3>
      <div>
        <label className="block text-sm font-medium mb-1">Product Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="e.g., T-Shirt, Coffee, Pizza"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          rows={3}
          placeholder="Product description..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Category</label>
        <input
          type="text"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="e.g., Clothing, Food, Beverages"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Base Price *</label>
        <input
          type="number"
          step="0.01"
          value={formData.base_price}
          onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="0.00"
        />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.has_variants}
            onChange={(e) => setFormData({ ...formData, has_variants: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">Has Variants (Size, Color, etc.)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.track_inventory}
            onChange={(e) => setFormData({ ...formData, track_inventory: e.target.checked })}
            className="rounded"
          />
          <span className="text-sm">Track Inventory</span>
        </label>
      </div>
    </div>
  );
}

function Step2Images({ businessId, selectedImages, setSelectedImages }: any) {
  const [files, setFiles] = useState<BusinessFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles();
  }, [businessId]);

  const loadFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('business_files')
        .select('id, file_name, storage_path')
        .eq('business_id', businessId)
        .eq('file_type', 'product_image')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (storagePath: string) => {
    const { data } = supabase.storage.from('business-files').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const toggleImage = (fileId: string) => {
    if (selectedImages.includes(fileId)) {
      setSelectedImages(selectedImages.filter((id: string) => id !== fileId));
    } else {
      setSelectedImages([...selectedImages, fileId]);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading images...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Select Product Images</h3>
        <p className="text-sm text-gray-600">{selectedImages.length} selected</p>
      </div>
      {files.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
          <p className="text-gray-600">No images uploaded yet</p>
          <p className="text-sm text-gray-500 mt-1">Go to the Files tab to upload images first</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-96 overflow-auto">
          {files.map((file) => {
            const isSelected = selectedImages.includes(file.id);
            return (
              <div
                key={file.id}
                onClick={() => toggleImage(file.id)}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  isSelected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <img
                  src={getImageUrl(file.storage_path)}
                  alt={file.file_name}
                  className="w-full h-24 object-cover"
                />
                {isSelected && (
                  <div className="absolute top-1 right-1 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {selectedImages.indexOf(file.id) + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Step3Variants({ variantAttributes, setVariantAttributes }: any) {
  const [newAttrName, setNewAttrName] = useState('');
  const [newAttrValues, setNewAttrValues] = useState('');

  const addAttribute = () => {
    if (!newAttrName || !newAttrValues) {
      alert('Please enter attribute name and values');
      return;
    }

    const values = newAttrValues.split(',').map(v => v.trim()).filter(v => v);
    if (values.length === 0) {
      alert('Please enter at least one value');
      return;
    }

    setVariantAttributes([...variantAttributes, { name: newAttrName, values }]);
    setNewAttrName('');
    setNewAttrValues('');
  };

  const removeAttribute = (index: number) => {
    setVariantAttributes(variantAttributes.filter((_: any, i: number) => i !== index));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold mb-4">Define Variant Attributes</h3>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-900">
          Define attributes like Color, Size, Material, etc. For each attribute, enter comma-separated values.
        </p>
        <p className="text-sm text-blue-700 mt-1">
          Example: Attribute "Color" with values "Red, Blue, Green"
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Attribute Name</label>
          <input
            type="text"
            value={newAttrName}
            onChange={(e) => setNewAttrName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., Color, Size"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Values (comma-separated)</label>
          <input
            type="text"
            value={newAttrValues}
            onChange={(e) => setNewAttrValues(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., Red, Blue, Green"
          />
        </div>
      </div>
      <button
        onClick={addAttribute}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Add Attribute
      </button>

      {variantAttributes.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium mb-3">Added Attributes</h4>
          <div className="space-y-2">
            {variantAttributes.map((attr: any, index: number) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                <div>
                  <span className="font-medium">{attr.name}:</span>{' '}
                  <span className="text-gray-600">{attr.values.join(', ')}</span>
                </div>
                <button
                  onClick={() => removeAttribute(index)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step4VariantMatrix({ generatedVariants, setGeneratedVariants, currency, trackInventory }: any) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold mb-4">Variant Matrix ({generatedVariants.length} variants)</h3>
      <div className="overflow-auto max-h-96">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left p-2 border">Variant</th>
              <th className="text-left p-2 border">SKU</th>
              <th className="text-left p-2 border">Price</th>
              {trackInventory && <th className="text-left p-2 border">Stock</th>}
            </tr>
          </thead>
          <tbody>
            {generatedVariants.map((variant: any, index: number) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="p-2 border">{variant.name}</td>
                <td className="p-2 border">
                  <input
                    type="text"
                    value={variant.sku}
                    onChange={(e) => {
                      const updated = [...generatedVariants];
                      updated[index].sku = e.target.value;
                      setGeneratedVariants(updated);
                    }}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                <td className="p-2 border">
                  <input
                    type="number"
                    step="0.01"
                    value={variant.price}
                    onChange={(e) => {
                      const updated = [...generatedVariants];
                      updated[index].price = e.target.value;
                      setGeneratedVariants(updated);
                    }}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </td>
                {trackInventory && (
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={variant.stock}
                      onChange={(e) => {
                        const updated = [...generatedVariants];
                        updated[index].stock = e.target.value;
                        setGeneratedVariants(updated);
                      }}
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditProductModal({ product, businessId, currency, onClose, onSuccess }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto p-6">
        <h2 className="text-2xl font-bold mb-4">Edit Product</h2>
        <p className="text-gray-600">Edit functionality coming soon...</p>
        <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-600 text-white rounded">
          Close
        </button>
      </div>
    </div>
  );
}
