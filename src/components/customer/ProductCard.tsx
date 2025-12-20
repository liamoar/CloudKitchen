import { Plus } from 'lucide-react';
import type { Product } from '../../lib/database.types';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../lib/utils';

interface ProductCardProps {
  product: Product;
  currency?: string;
}

export function ProductCard({ product, currency = 'AED' }: ProductCardProps) {
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: product.price,
      type: 'PRODUCT',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="h-40 bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
        <span className="text-5xl">🍔</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg text-gray-800">{product.name}</h3>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-orange-600">{formatCurrency(product.price, currency)}</span>
          <button
            onClick={handleAddToCart}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            disabled={product.stock_quantity === 0}
          >
            <Plus size={18} />
            Add
          </button>
        </div>
        {product.stock_quantity === 0 && (
          <p className="text-red-500 text-sm mt-2">Out of stock</p>
        )}
      </div>
    </div>
  );
}
