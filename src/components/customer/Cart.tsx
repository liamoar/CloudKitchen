import { X, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { formatCurrency } from '../../lib/utils';

interface CartProps {
  onCheckout: () => void;
  currency?: string;
}

export function Cart({ onCheckout, currency = 'AED' }: CartProps) {
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <ShoppingCart size={48} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500">Your cart is empty</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-800">Your Cart</h2>
      </div>
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-4 pb-4 border-b last:border-0">
            <div className="flex-1">
              <h3 className="font-medium text-gray-800">{item.name}</h3>
              <p className="text-sm text-gray-500">
                {item.type === 'BUNDLE' && 'Combo Deal'}
              </p>
              <p className="text-orange-600 font-semibold mt-1">{formatCurrency(item.price, currency)}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-medium">{item.quantity}</span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Plus size={16} />
              </button>
            </div>
            <button
              onClick={() => removeItem(item.id)}
              className="p-1 hover:bg-red-50 text-red-500 rounded"
            >
              <X size={20} />
            </button>
          </div>
        ))}
      </div>
      <div className="p-4 border-t bg-gray-50">
        <div className="flex justify-between items-center mb-4">
          <span className="text-lg font-semibold text-gray-800">Total</span>
          <span className="text-2xl font-bold text-orange-600">{formatCurrency(total, currency)}</span>
        </div>
        <button
          onClick={onCheckout}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors"
        >
          Proceed to Checkout
        </button>
      </div>
    </div>
  );
}
