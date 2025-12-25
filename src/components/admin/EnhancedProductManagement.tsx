import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, Download, Upload, ChevronLeft, ChevronRight, Grid2x2 as Grid, Table as TableIcon, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/utils';
import type { Product, ProductCategory, RestaurantSettings } from '../../lib/database.types';

interface ProductLimit {
  can_add: boolean;
  current_count: number;
  limit: number;
  tier_name: string;
  remaining: number;
}

export function EnhancedProductManagement() {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [activeView, setActiveView] = useState<'products' | 'categories'>('products');
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [productLimit, setProductLimit] = useState<ProductLimit | null>(null);

  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    stock_quantity: '',
    image_url: '',
    category_id: '',
    is_active: true,
  });

  const [productVariants, setProductVariants] = useState<Array<{
    id?: string;
    sku_code: string;
    attributes: Record<string, string>;
    price: string;
    stock_quantity: string;
    is_active: boolean;
    tempAttrKey: string;
    tempAttrValue: string;
  }>>([]);

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    loadRestaurantId();
  }, [user?.id]);

  useEffect(() => {
    if (restaurantId) {
      loadSettings();
      loadProducts();
      loadCategories();
      checkProductLimit();
    }
  }, [restaurantId]);

  const loadRestaurantId = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('businesses')
      .select('id, countries!inner(currency_symbol)')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) {
      setRestaurantId(data.id);
      setCurrency(data.countries?.currency_symbol || 'INR');
    }
  };

  const loadSettings = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', restaurantId)
      .maybeSingle();
    if (data) setSettings(data);
  };

  const loadProducts = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', restaurantId)
      .order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

  const loadCategories = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .eq('business_id', restaurantId)
      .order('display_order', { ascending: true });
    if (data) setCategories(data);
  };

  const checkProductLimit = async () => {
    if (!restaurantId) return;
    const { data, error } = await supabase.rpc('check_product_limit', {
      business_uuid: restaurantId
    });
    if (data && !error) {
      setProductLimit(data);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const generateCSVTemplate = () => {
    const headers = ['name', 'description', 'price'];

    if (settings?.enable_categories) {
      headers.push('category_name');
    }
    if (settings?.show_product_images) {
      headers.push('image_url');
    }
    if (settings?.enable_stock_management) {
      headers.push('stock_quantity');
    }
    headers.push('is_active');

    const sampleRow = [
      'Sample Product',
      'This is a sample product description',
      '99.99',
    ];

    if (settings?.enable_categories) {
      sampleRow.push('Category Name');
    }
    if (settings?.show_product_images) {
      sampleRow.push('https://example.com/image.jpg');
    }
    if (settings?.enable_stock_management) {
      sampleRow.push('100');
    }
    sampleRow.push('true');

    return [headers, sampleRow];
  };

  const downloadCSVTemplate = () => {
    const template = generateCSVTemplate();
    const csv = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product_template_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      return values;
    });
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !restaurantId) return;

    await checkProductLimit();
    if (productLimit && !productLimit.can_add) {
      showNotification(`Product limit reached! Your plan (${productLimit.tier_name}) allows ${productLimit.limit} products. Please upgrade to add more.`, 'error');
      event.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const headers = rows[0].map(h => h.toLowerCase().trim());
      const dataRows = rows.slice(1);

      let successCount = 0;
      let errorCount = 0;
      let skippedDueToLimit = 0;

      for (const row of dataRows) {
        if (row.length < 3 || !row[0]) continue;

        const { data: limitCheck } = await supabase.rpc('check_product_limit', {
          business_uuid: restaurantId
        });

        if (limitCheck && !limitCheck.can_add) {
          skippedDueToLimit++;
          continue;
        }

        const productData: any = {
          business_id: restaurantId,
          name: row[headers.indexOf('name')],
          description: row[headers.indexOf('description')] || '',
          price: parseFloat(row[headers.indexOf('price')]) || 0,
          is_active: row[headers.indexOf('is_active')]?.toLowerCase() === 'true',
        };

        if (settings?.enable_categories) {
          const categoryNameIdx = headers.indexOf('category_name');
          if (categoryNameIdx !== -1 && row[categoryNameIdx]) {
            const categoryName = row[categoryNameIdx];
            let category = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());

            if (!category) {
              const { data: newCategory } = await supabase
                .from('product_categories')
                .insert({
                  business_id: restaurantId,
                  name: categoryName,
                  is_active: true,
                })
                .select()
                .single();
              if (newCategory) {
                category = newCategory;
                setCategories([...categories, newCategory]);
              }
            }

            if (category) {
              productData.category_id = category.id;
            }
          }
        }

        if (settings?.show_product_images) {
          const imageIdx = headers.indexOf('image_url');
          if (imageIdx !== -1) {
            productData.image_url = row[imageIdx] || null;
          }
        }

        if (settings?.enable_stock_management) {
          const stockIdx = headers.indexOf('stock_quantity');
          if (stockIdx !== -1) {
            productData.stock_quantity = parseInt(row[stockIdx]) || 0;
          }
        }

        const { error } = await supabase
          .from('products')
          .insert(productData);

        if (error) {
          errorCount++;
          console.error('Error inserting product:', error);
        } else {
          successCount++;
        }
      }

      let message = `Import complete! ${successCount} products added`;
      if (errorCount > 0) message += `, ${errorCount} failed`;
      if (skippedDueToLimit > 0) message += `, ${skippedDueToLimit} skipped (limit reached)`;

      showNotification(message, errorCount > 0 || skippedDueToLimit > 0 ? 'error' : 'success');

      await loadProducts();
      await loadCategories();
      await checkProductLimit();
    } catch (error) {
      console.error('CSV upload error:', error);
      showNotification('Failed to process CSV file', 'error');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      showNotification('Failed to delete product', 'error');
    } else {
      showNotification('Product deleted successfully', 'success');
      loadProducts();
      checkProductLimit();
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Products in this category will be uncategorized.')) return;

    const { error } = await supabase
      .from('product_categories')
      .delete()
      .eq('id', id);

    if (error) {
      showNotification('Failed to delete category', 'error');
    } else {
      showNotification('Category deleted successfully', 'success');
      loadCategories();
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    if (!editingProductId) {
      await checkProductLimit();
      if (productLimit && !productLimit.can_add) {
        showNotification(`Product limit reached! Your plan (${productLimit.tier_name}) allows ${productLimit.limit} products. Please upgrade to add more.`, 'error');
        return;
      }
    }

    if (settings?.enable_multiple_sku && productVariants.length === 0) {
      showNotification('Please add at least one variant with SKU and price', 'error');
      return;
    }

    const productData: any = {
      business_id: restaurantId,
      name: productForm.name,
      description: productForm.description,
      price: settings?.enable_multiple_sku ? 0 : parseFloat(productForm.price),
      is_available: productForm.is_active,
    };

    if (settings?.enable_categories && productForm.category_id) {
      productData.category = productForm.category_id;
    }
    if (settings?.show_product_images && !settings?.enable_multiple_sku) {
      productData.image_url = productForm.image_url || null;
    }
    if (settings?.enable_stock_management && !settings?.enable_multiple_sku) {
      productData.stock_quantity = parseInt(productForm.stock_quantity) || 0;
    }

    try {
      let productId = editingProductId;

      if (editingProductId) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProductId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();
        if (error) throw error;
        productId = data.id;
      }

      if (settings?.enable_multiple_sku && productId) {
        if (editingProductId) {
          const { error: deleteError } = await supabase
            .from('product_variants')
            .delete()
            .eq('product_id', productId);
          if (deleteError) throw deleteError;
        }

        const variantsToInsert = productVariants.map(variant => ({
          business_id: restaurantId,
          product_id: productId,
          sku_code: variant.sku_code,
          attributes: variant.attributes,
          price: parseFloat(variant.price),
          stock_quantity: settings?.enable_stock_management ? parseInt(variant.stock_quantity) || 0 : 0,
          is_active: variant.is_active,
        }));

        const { error: variantsError } = await supabase
          .from('product_variants')
          .insert(variantsToInsert);
        if (variantsError) throw variantsError;
      }

      showNotification('Product saved successfully', 'success');
      setShowProductForm(false);
      setEditingProductId(null);
      setProductForm({
        name: '', description: '', price: '', stock_quantity: '',
        image_url: '', category_id: '', is_active: true,
      });
      setProductVariants([]);
      loadProducts();
      checkProductLimit();
    } catch (error) {
      showNotification('Failed to save product', 'error');
      console.error(error);
    }
  };

  const addVariant = () => {
    setProductVariants([...productVariants, {
      sku_code: '',
      attributes: {},
      price: '',
      stock_quantity: '0',
      is_active: true,
      tempAttrKey: '',
      tempAttrValue: '',
    }]);
  };

  const updateVariant = (index: number, field: string, value: any) => {
    const updatedVariants = [...productVariants];
    if (field === 'attributes') {
      updatedVariants[index].attributes = value;
    } else {
      (updatedVariants[index] as any)[field] = value;
    }
    setProductVariants(updatedVariants);
  };

  const removeVariant = (index: number) => {
    setProductVariants(productVariants.filter((_, i) => i !== index));
  };

  const addAttributeToVariant = (variantIndex: number) => {
    const variant = productVariants[variantIndex];
    if (!variant.tempAttrKey || !variant.tempAttrValue) {
      showNotification('Please enter both attribute name and value', 'error');
      return;
    }
    const updatedVariants = [...productVariants];
    updatedVariants[variantIndex].attributes = {
      ...updatedVariants[variantIndex].attributes,
      [variant.tempAttrKey]: variant.tempAttrValue
    };
    updatedVariants[variantIndex].tempAttrKey = '';
    updatedVariants[variantIndex].tempAttrValue = '';
    setProductVariants(updatedVariants);
  };

  const removeAttributeFromVariant = (variantIndex: number, attributeKey: string) => {
    const updatedVariants = [...productVariants];
    const newAttributes = { ...updatedVariants[variantIndex].attributes };
    delete newAttributes[attributeKey];
    updatedVariants[variantIndex].attributes = newAttributes;
    setProductVariants(updatedVariants);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    const categoryData = {
      business_id: restaurantId,
      name: categoryForm.name,
      description: categoryForm.description,
      display_order: parseInt(categoryForm.display_order) || 0,
      is_active: categoryForm.is_active,
    };

    let error;
    if (editingCategoryId) {
      ({ error } = await supabase
        .from('product_categories')
        .update(categoryData)
        .eq('id', editingCategoryId));
    } else {
      ({ error } = await supabase
        .from('product_categories')
        .insert(categoryData));
    }

    if (error) {
      showNotification('Failed to save category', 'error');
    } else {
      showNotification('Category saved successfully', 'success');
      setShowCategoryForm(false);
      setEditingCategoryId(null);
      setCategoryForm({ name: '', description: '', display_order: '0', is_active: true });
      loadCategories();
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const categoryTotalPages = Math.ceil(categories.length / itemsPerPage);
  const paginatedCategories = categories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`p-4 rounded-lg ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.message}
        </div>
      )}

      {productLimit && !productLimit.can_add && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">!</div>
            <div className="flex-1">
              <h3 className="font-bold text-orange-900 mb-1">Product Limit Reached</h3>
              <p className="text-orange-800 text-sm">
                You have reached your product limit of {productLimit.limit} products on the {productLimit.tier_name} plan.
                You cannot add more products. Please upgrade your plan to add more products.
              </p>
            </div>
          </div>
        </div>
      )}

      {productLimit && productLimit.can_add && productLimit.remaining <= 3 && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold">!</div>
            <div className="flex-1">
              <h3 className="font-bold text-yellow-900 mb-1">Approaching Product Limit</h3>
              <p className="text-yellow-800 text-sm">
                You have {productLimit.remaining} product slot(s) remaining out of {productLimit.limit} on the {productLimit.tier_name} plan.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveView('products'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                activeView === 'products'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TableIcon size={20} />
              Products
            </button>
            {settings?.enable_categories && (
              <button
                onClick={() => { setActiveView('categories'); setCurrentPage(1); }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  activeView === 'categories'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Grid size={20} />
                Categories
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={downloadCSVTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Download size={20} />
              Download Template
            </button>
            <label className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer">
              <Upload size={20} />
              {uploading ? 'Uploading...' : 'Upload CSV'}
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {activeView === 'products' ? (
              <button
                onClick={() => {
                  if (productLimit && !productLimit.can_add) {
                    showNotification(`Product limit reached! Your plan (${productLimit.tier_name}) allows ${productLimit.limit} products. Please upgrade to add more.`, 'error');
                    return;
                  }
                  setShowProductForm(true);
                  setEditingProductId(null);
                  setProductForm({
                    name: '', description: '', price: '', stock_quantity: '',
                    image_url: '', category_id: '', is_active: true,
                  });
                  setProductVariants([]);
                }}
                disabled={productLimit ? !productLimit.can_add : false}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  productLimit && !productLimit.can_add
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
              >
                <Plus size={20} />
                Add Product
              </button>
            ) : (
              <button
                onClick={() => {
                  setShowCategoryForm(true);
                  setEditingCategoryId(null);
                  setCategoryForm({ name: '', description: '', display_order: '0', is_active: true });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
              >
                <Plus size={20} />
                Add Category
              </button>
            )}
          </div>
        </div>

        {activeView === 'products' && (
          <>
            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
              {settings?.enable_categories && categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    {settings?.show_product_images && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Image</th>}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    {settings?.enable_categories && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Category</th>}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Price</th>
                    {settings?.enable_stock_management && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stock</th>}
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedProducts.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      {settings?.show_product_images && (
                        <td className="px-4 py-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded" />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">No img</div>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{product.description}</td>
                      {settings?.enable_categories && (
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {categories.find(c => c.id === product.category_id)?.name || '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(product.price, currency)}</td>
                      {settings?.enable_stock_management && (
                        <td className="px-4 py-3 text-sm text-gray-600">{product.stock_quantity || 0}</td>
                      )}
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          product.is_available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {product.is_available ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setEditingProductId(product.id);
                              setProductForm({
                                name: product.name,
                                description: product.description || '',
                                price: product.price.toString(),
                                stock_quantity: product.stock_quantity?.toString() || '0',
                                image_url: product.image_url || '',
                                category_id: product.category || '',
                                is_active: product.is_available,
                              });

                              if (settings?.enable_multiple_sku) {
                                const { data: variants } = await supabase
                                  .from('product_variants')
                                  .select('*')
                                  .eq('product_id', product.id)
                                  .order('created_at', { ascending: true });

                                if (variants) {
                                  setProductVariants(variants.map(v => ({
                                    id: v.id,
                                    sku_code: v.sku_code,
                                    attributes: v.attributes as Record<string, string>,
                                    price: v.price.toString(),
                                    stock_quantity: v.stock_quantity?.toString() || '0',
                                    is_active: v.is_active,
                                    tempAttrKey: '',
                                    tempAttrValue: '',
                                  })));
                                } else {
                                  setProductVariants([]);
                                }
                              } else {
                                setProductVariants([]);
                              }

                              setShowProductForm(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No products found. Add your first product or upload a CSV file.
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} products
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="px-4 py-2 border rounded-lg bg-gray-50">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {activeView === 'categories' && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Display Order</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedCategories.map(category => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{category.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{category.description || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{category.display_order}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          category.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {category.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setCategoryForm({
                                name: category.name,
                                description: category.description || '',
                                display_order: category.display_order.toString(),
                                is_active: category.is_active,
                              });
                              setShowCategoryForm(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {categories.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                No categories found. Add your first category to organize products.
              </div>
            )}

            {categoryTotalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, categories.length)} of {categories.length} categories
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="px-4 py-2 border rounded-lg bg-gray-50">
                    {currentPage} / {categoryTotalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(categoryTotalPages, p + 1))}
                    disabled={currentPage === categoryTotalPages}
                    className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showProductForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingProductId ? 'Edit Product' : 'Add New Product'}</h3>
            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={3}
                />
              </div>
              {!settings?.enable_multiple_sku && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              {settings?.enable_categories && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={productForm.category_id}
                    onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">No Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {settings?.show_product_images && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={productForm.image_url}
                    onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
              {settings?.enable_stock_management && !settings?.enable_multiple_sku && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={productForm.stock_quantity}
                    onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}

              {settings?.enable_multiple_sku && (
                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">Product Variants (SKUs)</h4>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
                    >
                      <Plus size={16} />
                      Add Variant
                    </button>
                  </div>

                  {productVariants.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded-lg">
                      No variants added. Click "Add Variant" to create SKUs with different prices{settings?.enable_stock_management ? ' and stock levels' : ''}.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {productVariants.map((variant, index) => (
                        <div key={index} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-700">Variant {index + 1}</h5>
                            <button
                              type="button"
                              onClick={() => removeVariant(index)}
                              className="text-red-600 hover:bg-red-50 p-1 rounded"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">SKU Code *</label>
                              <input
                                type="text"
                                required
                                value={variant.sku_code}
                                onChange={(e) => updateVariant(index, 'sku_code', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                                placeholder="e.g., PROD-RED-M"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Price *</label>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={variant.price}
                                onChange={(e) => updateVariant(index, 'price', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                          </div>

                          {settings?.enable_stock_management && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Stock Quantity</label>
                              <input
                                type="number"
                                value={variant.stock_quantity}
                                onChange={(e) => updateVariant(index, 'stock_quantity', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500"
                              />
                            </div>
                          )}

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-2">
                              Attributes (e.g., size, color) - <span className="text-orange-600 font-semibold">Required for variant selection on storefront</span>
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {Object.entries(variant.attributes).map(([key, value]) => (
                                <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                  {key}: {value}
                                  <button
                                    type="button"
                                    onClick={() => removeAttributeFromVariant(index, key)}
                                    className="hover:text-blue-900"
                                  >
                                    <XIcon size={12} />
                                  </button>
                                </span>
                              ))}
                              {Object.keys(variant.attributes).length === 0 && (
                                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                                  No attributes added - customers won't be able to select this variant!
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={variant.tempAttrKey}
                                onChange={(e) => updateVariant(index, 'tempAttrKey', e.target.value)}
                                className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                                placeholder="Attribute name (e.g., size)"
                              />
                              <input
                                type="text"
                                value={variant.tempAttrValue}
                                onChange={(e) => updateVariant(index, 'tempAttrValue', e.target.value)}
                                className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                                placeholder="Value (e.g., Small)"
                              />
                              <button
                                type="button"
                                onClick={() => addAttributeToVariant(index)}
                                className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm whitespace-nowrap"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={variant.is_active}
                              onChange={(e) => updateVariant(index, 'is_active', e.target.checked)}
                              className="w-4 h-4"
                            />
                            <label className="text-xs font-medium text-gray-700">Active</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={productForm.is_active}
                  onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductForm(false);
                    setEditingProductId(null);
                    setProductVariants([]);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCategoryForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full">
            <h3 className="text-xl font-bold mb-4">{editingCategoryId ? 'Edit Category' : 'Add New Category'}</h3>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={categoryForm.display_order}
                  onChange={(e) => setCategoryForm({ ...categoryForm, display_order: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cat_is_active"
                  checked={categoryForm.is_active}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="cat_is_active" className="text-sm font-medium text-gray-700">Active</label>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCategoryForm(false);
                    setEditingCategoryId(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
