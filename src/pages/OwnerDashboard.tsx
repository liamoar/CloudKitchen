import { useState } from 'react';
import { LogOut, Package, ShoppingBag, Receipt } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ProductManager } from '../components/owner/ProductManager';
import { OrderManager } from '../components/owner/OrderManager';

type Tab = 'products' | 'orders';

export function OwnerDashboard() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag size={32} className="text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Restaurant Dashboard</h1>
                <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 flex gap-4 border-b">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'orders'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Receipt size={20} />
            Orders
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'products'
                ? 'text-orange-600 border-b-2 border-orange-600'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <Package size={20} />
            Products
          </button>
        </div>

        {activeTab === 'orders' && <OrderManager />}
        {activeTab === 'products' && <ProductManager />}
      </div>
    </div>
  );
}
