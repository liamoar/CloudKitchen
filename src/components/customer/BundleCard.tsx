import { Plus, Package } from 'lucide-react';
import type { Bundle } from '../../lib/database.types';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../lib/utils';

interface BundleCardProps {
  bundle: Bundle;
  currency?: string;
}

export function BundleCard({ bundle, currency = 'AED' }: BundleCardProps) {
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem({
      id: bundle.id,
      name: bundle.name,
      price: bundle.fixed_price,
      type: 'BUNDLE',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border-2 border-green-200">
      <div className="h-40 bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
        <Package size={64} className="text-green-600" />
      </div>
      <div className="p-4">
        <div className="flex items-start gap-2">
          <h3 className="font-semibold text-lg text-gray-800 flex-1">{bundle.name}</h3>
          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
            COMBO
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{bundle.description}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-green-600">{formatCurrency(bundle.fixed_price, currency)}</span>
          <button
            onClick={handleAddToCart}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
