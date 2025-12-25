import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Store, Globe, ExternalLink } from 'lucide-react';

interface Business {
  id: string;
  name: string;
  subdomain: string;
  status: string;
  is_subdomain_active: boolean;
}

export function LocalDevBusinessList() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, subdomain, status, is_subdomain_active')
        .order('name');

      if (error) throw error;
      setBusinesses(data || []);
    } catch (err) {
      console.error('Error loading businesses:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading businesses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-10 h-10 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Local Development</h1>
              <p className="text-gray-600 mt-1">
                Testing environment - Access businesses via route parameters
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="font-semibold text-blue-900 mb-2">How to use:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Click on any business below to access its customer view</li>
              <li>• Add <code className="bg-blue-100 px-1 rounded">/login</code> for business login</li>
              <li>• Add <code className="bg-blue-100 px-1 rounded">/admin</code> for business dashboard</li>
              <li>• Format: <code className="bg-blue-100 px-1 rounded">/business/subdomain/path</code></li>
            </ul>
          </div>

          <div className="mt-6">
            <a
              href="/backend-system"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <ExternalLink size={18} />
              Super Admin Panel
            </a>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Store className="w-6 h-6 text-blue-600" />
            Available Businesses
          </h2>

          {businesses.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p>No businesses created yet</p>
              <p className="text-sm mt-2">Create a business from the Super Admin panel</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {businesses.map((business) => (
                <div
                  key={business.id}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {business.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                        <code className="bg-gray-100 px-2 py-1 rounded">
                          {business.subdomain}
                        </code>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            business.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : business.status === 'trial'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {business.status}
                        </span>
                        {business.is_subdomain_active && (
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/business/${business.subdomain}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                        >
                          <Store size={16} />
                          Customer View
                        </a>
                        <a
                          href={`/business/${business.subdomain}/login`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
                        >
                          Login
                        </a>
                        <a
                          href={`/business/${business.subdomain}/admin`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                        >
                          Admin Dashboard
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
