import { useState } from 'react';
import { LogOut, Settings, Package, Receipt, BarChart3, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RestaurantSettings } from '../components/admin/RestaurantSettings.tsx';
import { ProductManagement } from '../components/admin/ProductManagement.tsx';
import { OrderManagement } from '../components/admin/OrderManagement.tsx';
import { SalesAnalytics } from '../components/admin/SalesAnalytics.tsx';

type Tab = 'settings' | 'products' | 'orders' | 'sales';

export function RestroAdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const tabs = [
    { id: 'orders' as Tab, label: 'Orders', icon: Receipt },
    { id: 'products' as Tab, label: 'Products', icon: Package },
    { id: 'sales' as Tab, label: 'Sales', icon: BarChart3 },
    { id: 'settings' as Tab, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package size={32} className="text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Restaurant Admin</h1>
                <p className="text-sm text-gray-500">{user?.name}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              Sign Out
            </button>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              {showMobileMenu ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <nav className={`flex gap-4 mb-8 flex-wrap md:flex-nowrap ${showMobileMenu ? 'flex-col' : 'flex-row'}`}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setActiveTab(id);
                setShowMobileMenu(false);
              }}
              className={`flex items-center gap-2 px-4 py-3 font-medium rounded-lg transition-colors ${
                activeTab === id
                  ? 'bg-orange-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="md:hidden flex items-center gap-2 px-4 py-3 font-medium rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </nav>

        {activeTab === 'settings' && <RestaurantSettings />}
        {activeTab === 'products' && <ProductManagement />}
        {activeTab === 'orders' && <OrderManagement />}
        {activeTab === 'sales' && <SalesAnalytics />}
      </div>
    </div>
  );
}
