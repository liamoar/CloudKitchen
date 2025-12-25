import { Plus, Gift } from 'lucide-react';
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
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl shadow-md hover:shadow-xl transition-all overflow-hidden border-2 border-amber-200 flex flex-col">
      <div className="h-48 bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center relative">
        <Gift size={80} className="text-amber-400" />
        <div className="absolute top-3 right-3 bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
          COMBO
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-bold text-lg text-gray-900 mb-2 line-clamp-1">{bundle.name}</h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-1">{bundle.description}</p>

        <div className="flex items-center justify-between mt-auto pt-4">
          <span className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
            {formatCurrency(bundle.fixed_price, currency)}
          </span>
          <button
            onClick={handleAddToCart}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl font-semibold"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
