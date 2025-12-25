import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  id: string;
  sender_type: 'business' | 'superadmin';
  message: string;
  created_at: string;
}

export function SupportChatPopup() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadRestaurantId();
  }, [user?.id]);

  useEffect(() => {
    if (restaurantId) {
      loadOrCreateChat();
    }
  }, [restaurantId]);

  useEffect(() => {
    if (chatId) {
      loadMessages();
      return subscribeToMessages();
    }
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadRestaurantId = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    if (error) console.error('Error loading business:', error);
    if (data) setRestaurantId(data.id);
  };

  const loadOrCreateChat = async () => {
    if (!restaurantId) return;

    const { data: existingChat } = await supabase
      .from('support_chats')
      .select('id')
      .eq('business_id', restaurantId)
      .eq('status', 'open')
      .maybeSingle();

    if (existingChat) {
      setChatId(existingChat.id);
      return;
    }

    const { data: newChat, error } = await supabase
      .from('support_chats')
      .insert({ business_id: restaurantId, status: 'open' })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating chat:', error);
      return;
    }

    if (newChat) setChatId(newChat.id);
  };

  const loadMessages = async () => {
    if (!chatId) return;
    const { data, error } = await supabase
      .from('support_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (data) {
      setMessages(data);
      const unread = data.filter(m => m.sender_type === 'superadmin').length;
      setUnreadCount(unread);
    }
  };

  const subscribeToMessages = () => {
    if (!chatId) return;

    const channel = supabase
      .channel(`support_messages_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `chat_id=eq.${chatId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatId || !user?.id) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          chat_id: chatId,
          sender_type: 'business',
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

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-orange-500 text-white p-4 rounded-full shadow-lg hover:bg-orange-600 transition-all z-50 flex items-center justify-center"
      >
        <MessageCircle size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          <div className="bg-orange-500 text-white p-4 rounded-t-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={20} />
              <h3 className="font-semibold">Support Chat</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-orange-600 p-1 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="bg-orange-50 p-3 border-b border-orange-100">
            <p className="text-xs text-orange-900 font-medium mb-2">Emergency Contact:</p>
            <div className="flex flex-col gap-1 text-xs text-orange-800">
              <div className="flex items-center gap-2">
                <Mail size={14} />
                <a href="mailto:support@hejo.app" className="hover:underline">support@hejo.app</a>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={14} />
                <a href="tel:+1234567890" className="hover:underline">+1 (234) 567-890</a>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-8">
                <MessageCircle size={48} className="mx-auto mb-2 text-gray-300" />
                <p>No messages yet.</p>
                <p className="text-xs mt-1">Send a message to start chatting with support.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_type === 'business' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.sender_type === 'business'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.sender_type === 'business' ? 'text-orange-100' : 'text-gray-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                disabled={sending}
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-orange-500 text-white p-2 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
