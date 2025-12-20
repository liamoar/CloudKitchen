import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Edit2, Trash2, UserCheck, UserX } from 'lucide-react';

interface Rider {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export function RiderManagement() {
  const { user } = useAuth();
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    loadRestaurantId();
  }, [user?.id]);

  useEffect(() => {
    if (restaurantId) {
      loadRiders();
    }
  }, [restaurantId]);

  const loadRestaurantId = async () => {
    if (!user?.id) return;

    const { data } = await supabase
      .from('restaurants')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();

    if (data) {
      setRestaurantId(data.id);
    }
  };

  const loadRiders = async () => {
    if (!restaurantId) return;

    try {
      const { data } = await supabase
        .from('delivery_riders')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });

      if (data) {
        setRiders(data);
      }
    } catch (error) {
      console.error('Error loading riders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!restaurantId) return;

    try {
      if (editingRider) {
        await supabase
          .from('delivery_riders')
          .update({
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
          })
          .eq('id', editingRider.id)
          .eq('restaurant_id', restaurantId);
      } else {
        await supabase
          .from('delivery_riders')
          .insert({
            restaurant_id: restaurantId,
            name: formData.name,
            phone: formData.phone,
            email: formData.email || null,
          });
      }

      setFormData({ name: '', phone: '', email: '' });
      setShowForm(false);
      setEditingRider(null);
      loadRiders();
    } catch (error) {
      console.error('Error saving rider:', error);
      alert('Failed to save rider');
    }
  };

  const handleEdit = (rider: Rider) => {
    setEditingRider(rider);
    setFormData({
      name: rider.name,
      phone: rider.phone,
      email: rider.email || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (riderId: string) => {
    if (!restaurantId) return;
    if (!confirm('Are you sure you want to delete this rider?')) return;

    try {
      await supabase
        .from('delivery_riders')
        .delete()
        .eq('id', riderId)
        .eq('restaurant_id', restaurantId);

      loadRiders();
    } catch (error) {
      console.error('Error deleting rider:', error);
      alert('Failed to delete rider');
    }
  };

  const toggleActive = async (rider: Rider) => {
    if (!restaurantId) return;
    try {
      await supabase
        .from('delivery_riders')
        .update({ is_active: !rider.is_active })
        .eq('id', rider.id)
        .eq('restaurant_id', restaurantId);

      loadRiders();
    } catch (error) {
      console.error('Error updating rider status:', error);
    }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingRider(null);
    setFormData({ name: '', phone: '', email: '' });
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading riders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Delivery Riders</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold"
        >
          <Plus size={20} />
          Add Rider
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingRider ? 'Edit Rider' : 'Add New Rider'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (Optional)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold"
              >
                {editingRider ? 'Update' : 'Add'} Rider
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {riders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="mb-2">No delivery riders added yet</p>
            <p className="text-sm">Add riders to assign them to delivery orders</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {riders.map((rider) => (
                  <tr key={rider.id}>
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{rider.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <a href={`tel:${rider.phone}`} className="text-orange-600 hover:text-orange-800">
                        {rider.phone}
                      </a>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {rider.email || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActive(rider)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          rider.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {rider.is_active ? (
                          <>
                            <UserCheck size={14} />
                            Active
                          </>
                        ) : (
                          <>
                            <UserX size={14} />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(rider)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-blue-600"
                          title="Edit rider"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(rider.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
                          title="Delete rider"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
