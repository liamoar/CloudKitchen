import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Search, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  restaurant_id: string;
  sender_type: 'BUSINESS' | 'SUPPORT';
  sender_id: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface Restaurant {
  id: string;
  name: string;
  subdomain: string | null;
  unread_count: number;
}

export function SupportChatManagement() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRestaurants();
  }, []);

  useEffect(() => {
    if (selectedRestaurantId) {
      loadMessages();
      markMessagesAsRead();
      return subscribeToMessages();
    }
  }, [selectedRestaurantId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadRestaurants = async () => {
    const { data: restaurantsData } = await supabase
      .from('restaurants')
      .select('id, name, subdomain')
      .order('name', { ascending: true });

    if (restaurantsData) {
      const restaurantsWithUnread = await Promise.all(
        restaurantsData.map(async (restaurant) => {
          const { count } = await supabase
            .from('support_messages')
            .select('*', { count: 'exact', head: true })
            .eq('restaurant_id', restaurant.id)
            .eq('sender_type', 'BUSINESS')
            .eq('read', false);

          return {
            ...restaurant,
            unread_count: count || 0,
          };
        })
      );

      setRestaurants(restaurantsWithUnread);
    }
  };

  const loadMessages = async () => {
    if (!selectedRestaurantId) return;

    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('restaurant_id', selectedRestaurantId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data) {
      setMessages(data);
    }
  };

  const subscribeToMessages = () => {
    if (!selectedRestaurantId) return;

    const channel = supabase
      .channel(`admin_support_messages_${selectedRestaurantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `restaurant_id=eq.${selectedRestaurantId}`,
        },
        () => {
          loadMessages();
          loadRestaurants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markMessagesAsRead = async () => {
    if (!selectedRestaurantId) return;

    await supabase
      .from('support_messages')
      .update({ read: true })
      .eq('restaurant_id', selectedRestaurantId)
      .eq('sender_type', 'BUSINESS')
      .eq('read', false);

    loadRestaurants();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedRestaurantId || !user?.id) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          restaurant_id: selectedRestaurantId,
          sender_type: 'SUPPORT',
          sender_id: user.id,
          message: newMessage.trim(),
        });

      if (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
        return;
      }

      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.subdomain?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedRestaurant = restaurants.find(r => r.id === selectedRestaurantId);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="flex h-[700px]">
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
              <MessageCircle className="text-orange-500" size={24} />
              Support Chats
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search businesses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredRestaurants.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                <Users size={48} className="mx-auto mb-2 text-gray-300" />
                <p>No businesses found</p>
              </div>
            ) : (
              filteredRestaurants.map((restaurant) => (
                <button
                  key={restaurant.id}
                  onClick={() => setSelectedRestaurantId(restaurant.id)}
                  className={`w-full p-4 text-left border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    selectedRestaurantId === restaurant.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{restaurant.name}</h3>
                      {restaurant.subdomain && (
                        <p className="text-xs text-gray-500 truncate">{restaurant.subdomain}.hejo.app</p>
                      )}
                    </div>
                    {restaurant.unread_count > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                        {restaurant.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedRestaurantId ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="font-semibold text-gray-900">{selectedRestaurant?.name}</h3>
                {selectedRestaurant?.subdomain && (
                  <p className="text-xs text-gray-500">{selectedRestaurant.subdomain}.hejo.app</p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8">
                    <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                    <p>No messages yet in this conversation.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'SUPPORT' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.sender_type === 'SUPPORT'
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-gray-900 border border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${
                            msg.sender_type === 'SUPPORT' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {msg.sender_type === 'SUPPORT' ? 'Support Team' : 'Business'}
                          </span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.sender_type === 'SUPPORT' ? 'text-blue-100' : 'text-gray-500'
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your reply..."
                    className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={sending}
                  />
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send size={20} />
                    Send
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageCircle size={64} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a business to view conversation</p>
                <p className="text-sm mt-1">Choose a business from the list to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
