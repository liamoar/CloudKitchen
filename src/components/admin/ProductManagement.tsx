import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Star, StarOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Product, ProductCategory, FeaturedProduct, RestaurantSettings } from '../../lib/database.types';

export function ProductManagement() {
  const { user } = useAuth();
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<FeaturedProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showProductForm, setShowProductForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{message: string; type: 'success' | 'error'} | null>(null);
  const [productLimit, setProductLimit] = useState<number>(-1);
  const [limitReached, setLimitReached] = useState(false);

  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    stock_quantity: '',
    image_url: '',
    category_id: '',
    is_active: true,
  });

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
      loadFeaturedProducts();
    }
  }, [restaurantId]);

  useEffect(() => {
    if (settings?.enable_categories && restaurantId) {
      loadCategories();
    }
  }, [settings, restaurantId]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const loadRestaurantId = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('businesses')
      .select('id, tier:subscription_tiers(product_limit)')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (data) {
      setRestaurantId(data.id);
      const limit = data.tier?.product_limit || -1;
      setProductLimit(limit);
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
    if (data) {
      setProducts(data);
      if (productLimit !== -1 && data.length >= productLimit) {
        setLimitReached(true);
      } else {
        setLimitReached(false);
      }
    }
  };

  const loadCategories = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('product_categories')
      .select('*')
      .eq('business_id', restaurantId)
      .order('display_order');
    if (data) setCategories(data);
  };

  const loadFeaturedProducts = async () => {
    if (!restaurantId) return;
    const { data } = await supabase
      .from('featured_products')
      .select('*')
      .eq('business_id', restaurantId);
    if (data) setFeaturedProducts(data);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    if (!editingProductId && limitReached) {
      showNotification(`Product limit reached! Your tier allows ${productLimit} products. Please upgrade your subscription.`, 'error');
      return;
    }

    try {
      const productData: any = {
        business_id: restaurantId,
        name: productForm.name,
        description: productForm.description,
        price: parseFloat(productForm.price),
        is_available: productForm.is_active,
      };

      if (settings?.enable_stock_management) {
        productData.stock_quantity = productForm.stock_quantity ? parseInt(productForm.stock_quantity) : null;
      } else {
        productData.stock_quantity = null;
      }

      if (settings?.show_product_image) {
        productData.image_url = productForm.image_url || null;
      } else {
        productData.image_url = null;
      }

      if (settings?.enable_categories) {
        productData.category = productForm.category_id || null;
      } else {
        productData.category = null;
      }

      if (editingProductId) {
        const { error } = await supabase.from('products').update(productData).eq('id', editingProductId).eq('business_id', restaurantId);
        if (error) throw error;
        showNotification('Product updated successfully!', 'success');
      } else {
        const { error } = await supabase.from('products').insert(productData);
        if (error) throw error;
        showNotification('Product added successfully!', 'success');
      }

      resetProductForm();
      loadProducts();
    } catch (error) {
      showNotification('Failed to save product. Please try again.', 'error');
      console.error('Error saving product:', error);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    try {
      const categoryData = {
        business_id: restaurantId,
        name: categoryForm.name,
        description: categoryForm.description || null,
        display_order: parseInt(categoryForm.display_order),
        is_active: categoryForm.is_active,
      };

      if (editingCategoryId) {
        const { error } = await supabase.from('product_categories').update(categoryData).eq('id', editingCategoryId).eq('business_id', restaurantId);
        if (error) throw error;
        showNotification('Category updated successfully!', 'success');
      } else {
        const { error } = await supabase.from('product_categories').insert(categoryData);
        if (error) throw error;
        showNotification('Category added successfully!', 'success');
      }

      resetCategoryForm();
      loadCategories();
    } catch (error) {
      showNotification('Failed to save category. Please try again.', 'error');
      console.error('Error saving category:', error);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      stock_quantity: product.stock_quantity !== null && product.stock_quantity !== undefined ? product.stock_quantity.toString() : '',
      image_url: product.image_url || '',
      category_id: product.category || '',
      is_active: product.is_available,
    });
    setShowProductForm(true);
  };

  const handleEditCategory = (category: ProductCategory) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description || '',
      display_order: category.display_order.toString(),
      is_active: category.is_active,
    });
    setShowCategoryForm(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!restaurantId) return;
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const { error } = await supabase.from('products').delete().eq('id', id).eq('business_id', restaurantId);
        if (error) throw error;
        showNotification('Product deleted successfully!', 'success');
        loadProducts();
      } catch (error) {
        showNotification('Failed to delete product.', 'error');
        console.error('Error deleting product:', error);
      }
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!restaurantId) return;
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        const { error } = await supabase.from('product_categories').delete().eq('id', id).eq('business_id', restaurantId);
        if (error) throw error;
        showNotification('Category deleted successfully!', 'success');
        loadCategories();
      } catch (error) {
        showNotification('Failed to delete category.', 'error');
        console.error('Error deleting category:', error);
      }
    }
  };

  const toggleFeatured = async (productId: string) => {
    if (!restaurantId) return;

    try {
      const isFeatured = featuredProducts.some((fp) => fp.product_id === productId);

      if (isFeatured) {
        const fp = featuredProducts.find((fp) => fp.product_id === productId);
        if (fp) {
          const { error } = await supabase.from('featured_products').delete().eq('id', fp.id).eq('business_id', restaurantId);
          if (error) throw error;
          showNotification('Removed from featured products!', 'success');
        }
      } else {
        const { error } = await supabase.from('featured_products').insert({
          business_id: restaurantId,
          product_id: productId,
          display_order: featuredProducts.length,
        });
        if (error) throw error;
        showNotification('Added to featured products!', 'success');
      }

      loadFeaturedProducts();
    } catch (error) {
      showNotification('Failed to update featured status.', 'error');
      console.error('Error toggling featured:', error);
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      price: '',
      stock_quantity: '',
      image_url: '',
      category_id: '',
      is_active: true,
    });
    setEditingProductId(null);
    setShowProductForm(false);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      name: '',
      description: '',
      display_order: '0',
      is_active: true,
    });
    setEditingCategoryId(null);
    setShowCategoryForm(false);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredProductsList = products.filter((p) =>
    featuredProducts.some((fp) => fp.product_id === p.id)
  );

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {notification.message}
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Product Management</h2>
        <div className="flex gap-2">
          {settings?.enable_categories && (
            <button
              onClick={() => setShowCategoryForm(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus size={20} />
              Add Category
            </button>
          )}
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => setShowProductForm(true)}
              disabled={limitReached}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                limitReached
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-orange-500 hover:bg-orange-600 text-white'
              }`}
              title={limitReached ? `Product limit reached (${productLimit})` : 'Add a new product'}
            >
              <Plus size={20} />
              Add Product
            </button>
            {productLimit !== -1 && (
              <span className={`text-xs ${limitReached ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                {products.length} / {productLimit} products
                {limitReached && ' - Limit reached!'}
              </span>
            )}
          </div>
        </div>
      </div>

      {settings?.enable_categories && showCategoryForm && (
        <form onSubmit={handleCategorySubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <h3 className="font-semibold text-lg">
            {editingCategoryId ? 'Edit Category' : 'Add New Category'}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input
                type="number"
                value={categoryForm.display_order}
                onChange={(e) => setCategoryForm({ ...categoryForm, display_order: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              rows={2}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={categoryForm.is_active}
              onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg"
            >
              {editingCategoryId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetCategoryForm}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {settings?.enable_categories && categories.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-md">
          <h3 className="font-semibold mb-3">Categories</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium">{category.name}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-1 hover:bg-gray-100 rounded text-blue-600"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category.id)}
                    className="p-1 hover:bg-gray-100 rounded text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showProductForm && (
        <form onSubmit={handleProductSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
          <h3 className="font-semibold text-lg">
            {editingProductId ? 'Edit Product' : 'Add New Product'}
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={productForm.name}
                onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price ({settings?.currency || 'INR'})
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={productForm.price}
                onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              required
              value={productForm.description}
              onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg"
              rows={3}
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {settings?.enable_stock_management && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                <input
                  type="number"
                  required
                  value={productForm.stock_quantity}
                  onChange={(e) => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
            )}
            {settings?.enable_categories && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={productForm.category_id}
                  onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">No Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {settings?.show_product_image && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
              <input
                type="url"
                value={productForm.image_url}
                onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          )}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={productForm.is_active}
              onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium text-gray-700">Active</span>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg"
            >
              {editingProductId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetProductForm}
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {featuredProductsList.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-lg shadow-md">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Star className="text-yellow-500" size={20} />
            Featured Products
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {featuredProductsList.map((product) => (
              <div key={product.id} className="bg-white p-4 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium">{product.name}</h4>
                  <button
                    onClick={() => toggleFeatured(product.id)}
                    className="text-yellow-500 hover:text-yellow-600"
                  >
                    <StarOff size={18} />
                  </button>
                </div>
                <p className="text-orange-600 font-semibold">{settings?.currency || 'INR'} {product.price}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          {settings?.enable_categories && categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {filteredProducts.map((product) => {
          const isFeatured = featuredProducts.some((fp) => fp.product_id === product.id);
          const category = categories.find((c) => c.id === product.category);

          return (
            <div
              key={product.id}
              className="bg-white p-4 rounded-lg shadow-md flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{product.name}</h3>
                  {!product.is_available && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Inactive</span>
                  )}
                  {category && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {category.name}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{product.description}</p>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="text-orange-600 font-semibold">
                    {settings?.currency || 'INR'} {product.price}
                  </span>
                  {settings?.enable_stock_management && product.stock_quantity !== null && product.stock_quantity !== undefined && (
                    <span className="text-gray-600">Stock: {product.stock_quantity}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleFeatured(product.id)}
                  className={`p-2 rounded-lg ${
                    isFeatured ? 'text-yellow-500 bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={isFeatured ? 'Remove from featured' : 'Add to featured'}
                >
                  {isFeatured ? <Star size={18} /> : <StarOff size={18} />}
                </button>
                <button
                  onClick={() => handleEditProduct(product)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-blue-600"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => handleDeleteProduct(product.id)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
