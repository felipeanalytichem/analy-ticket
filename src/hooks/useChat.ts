import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { EnhancedChatService } from '../lib/enhancedChatService';
import { useAuth } from '../contexts/AuthContext';
import type { ChatMessage, TicketChat, MessageReaction, TypingIndicator } from '../lib/enhancedChatService';

export function useChat(ticketId: string) {
  const { user } = useAuth();
  const [chat, setChat] = useState<TicketChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'SUBSCRIBED' | 'CHANNEL_ERROR' | 'CLOSED' | 'polling' | 'error'>('CLOSED');
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const subscriptionRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingDisplayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial chat data
  const loadChat = useCallback(async () => {
    if (!ticketId) return;

    try {
      setIsLoading(true);
      setError(null);

      const chatData = await EnhancedChatService.getTicketChat(ticketId);
      setChat(chatData);

      const messagesData = await EnhancedChatService.getChatMessages(chatData.id);
      setMessages(messagesData);

      // Mark as read
      if (user?.id) {
        await EnhancedChatService.markChatAsRead(chatData.id, user.id);
      }
    } catch (err) {
      console.error('Error loading chat:', err);
      setError('Erro ao carregar chat');
    } finally {
      setIsLoading(false);
    }
  }, [ticketId, user?.id]);

  // Send message with real-time delivery
  const sendMessage = useCallback(async (
    message: string,
    isInternal: boolean = false,
    replyTo?: string
  ) => {
    if (!chat || !user?.id) return;

    try {
      // Check rate limit before sending
      const canSend = await EnhancedChatService.checkRateLimit(user.id);
      if (!canSend) {
        throw new Error('Muitas mensagens enviadas. Aguarde um momento.');
      }

      const newMessage = await EnhancedChatService.sendChatMessage(
        chat.id,
        user.id,
        message,
        isInternal,
        replyTo
      );

      // Stop typing indicator when message is sent
      if (user?.user_metadata?.full_name) {
        await EnhancedChatService.stopTyping(chat.id, user.id);
      }

      // Immediately add message to local state for instant feedback
      setMessages(prev => {
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });

      // Force refresh after a short delay to ensure we have the latest state
      setTimeout(async () => {
        try {
          console.log('🔄 Post-send refresh to ensure message appears');
          const latestMessages = await EnhancedChatService.getChatMessages(chat.id);
          setMessages(latestMessages);
        } catch (err) {
          console.error('Post-send refresh failed:', err);
        }
      }, 200);

      return newMessage;
    } catch (err) {
      console.error('Error sending message:', err);
      throw new Error(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    }
  }, [chat, user?.id, user?.user_metadata?.full_name]);

  // Upload file
  const uploadFile = useCallback(async (file: File) => {
    if (!chat || !user?.id) return;

    try {
      const message = await EnhancedChatService.uploadChatFile(chat.id, user.id, file);
      // Add message immediately to local state
      setMessages(prev => {
        const exists = prev.some(m => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
      return message;
    } catch (err) {
      console.error('Error uploading file:', err);
      throw new Error('Erro ao enviar arquivo');
    }
  }, [chat, user?.id]);

  // Add reaction
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;

    try {
      await EnhancedChatService.addReaction(messageId, user.id, emoji);
      // Reload messages to get updated reactions
      if (chat?.id) {
        const messagesData = await EnhancedChatService.getChatMessages(chat.id);
        setMessages(messagesData);
      }
    } catch (err) {
      console.error('Error adding reaction:', err);
      throw new Error('Erro ao adicionar reação');
    }
  }, [user?.id, chat?.id]);

  // Remove reaction
  const removeReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!user?.id) return;

    try {
      await EnhancedChatService.removeReaction(messageId, user.id, emoji);
      // Reload messages to get updated reactions
      if (chat?.id) {
        const messagesData = await EnhancedChatService.getChatMessages(chat.id);
        setMessages(messagesData);
      }
    } catch (err) {
      console.error('Error removing reaction:', err);
      throw new Error('Erro ao remover reação');
    }
  }, [user?.id, chat?.id]);

  // Mark as read
  const markAsRead = useCallback(async () => {
    if (!chat || !user?.id) return;

    try {
      await EnhancedChatService.markChatAsRead(chat.id, user.id);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [chat, user?.id]);

  // Start typing indicator
  const startTyping = useCallback(async () => {
    if (!chat || !user) return;
    
    console.log('🔤 START TYPING called!', { chatId: chat.id, userId: user.id });
    
    try {
      // Broadcast to other users via real-time
      await EnhancedChatService.broadcastTyping(chat.id, user.id, user.user_metadata?.full_name || user.email || 'User');
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(async () => {
        console.log('🔤 Auto-stopping typing after timeout');
        await stopTyping();
      }, 3000);
    } catch (error) {
      console.error('Error starting typing indicator:', error);
    }
  }, [chat, user]);

  // Stop typing indicator
  const stopTyping = useCallback(async () => {
    if (!chat || !user) return;
    
    console.log('🔤 STOP TYPING called!', { chatId: chat.id, userId: user.id });
    
    try {
      // Stop broadcasting to other users
      await EnhancedChatService.stopTyping(chat.id, user.id);
      
      // Clear timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    } catch (error) {
      console.error('Error stopping typing indicator:', error);
    }
  }, [chat, user]);

  // Set up simple real-time subscription
  useEffect(() => {
    if (!chat?.id) return;

    const setupSubscription = async () => {
      try {
        console.log('🔄 Setting up simple real-time subscription for chat:', chat.id);

        // Clean up existing subscription
        if (subscriptionRef.current) {
          await subscriptionRef.current.unsubscribe();
          subscriptionRef.current = null;
        }

        // Test real-time connection first
        console.log('🧪 Testing real-time connection...');
        const testChannel = supabase.channel('test-connection');
        testChannel.subscribe((status) => {
          console.log('🧪 Test channel status:', status);
        });

        // Check if chat tables exist
        const exists = await EnhancedChatService.checkChatTablesExist();
        console.log('💬 Chat tables exist:', exists);
        
        if (!exists) {
          console.log('💬 Chat tables not available, using polling fallback');
          setConnectionStatus('polling');
          
          // Set up polling fallback
          const pollInterval = setInterval(async () => {
            try {
              const latestMessages = await EnhancedChatService.getChatMessages(chat.id);
              setMessages(prev => {
                if (latestMessages.length !== prev.length) {
                  console.log('🔄 Found new messages via polling:', latestMessages.length - prev.length);
                  return latestMessages;
                }
                return prev;
              });
            } catch (err) {
              console.error('Polling failed:', err);
            }
          }, 500); // Poll every 500ms for very fast updates

          subscriptionRef.current = { unsubscribe: () => clearInterval(pollInterval) };
          return;
        }

        // Subscribe to new messages with simple Supabase real-time
        console.log('🔗 Creating real-time subscription...');
        subscriptionRef.current = supabase
          .channel(`chat-${chat.id}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_messages',
              filter: `chat_id=eq.${chat.id}`
            },
            async (payload) => {
              console.log('📨 Real-time message received:', payload);
              try {
                // Reload all messages to get the latest state
                const messagesData = await EnhancedChatService.getChatMessages(chat.id);
                console.log('✅ Reloaded messages after real-time event, count:', messagesData.length);
                setMessages(messagesData);
              } catch (err) {
                console.error('Error reloading messages:', err);
              }
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'chat_message_reactions'
            },
            async (payload) => {
              console.log('😊 Real-time reaction received:', payload);
              try {
                // Reload messages to get updated reactions
                const messagesData = await EnhancedChatService.getChatMessages(chat.id);
                setMessages(messagesData);
              } catch (err) {
                console.error('Error reloading messages for reaction:', err);
              }
            }
          )
          .on(
            'broadcast',
            { event: 'typing' },
            (payload) => {
              console.log('🔤 Typing event received:', payload);
              const { user_id, user_name, chat_id } = payload.payload;
              
              // Only show typing for other users, not current user
              if (user_id !== user?.id && chat_id === chat.id) {
                const typingUser: TypingIndicator = {
                  user_id,
                  user_name,
                  timestamp: Date.now()
                };
                
                setTypingUsers(prev => {
                  const filtered = prev.filter(u => u.user_id !== user_id);
                  return [...filtered, typingUser];
                });
                
                // Auto-remove typing indicator after 5 seconds
                setTimeout(() => {
                  setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
                }, 5000);
              }
            }
          )
          .on(
            'broadcast',
            { event: 'stop_typing' },
            (payload) => {
              console.log('🔤 Stop typing event received:', payload);
              const { user_id } = payload.payload;
              
              // Remove typing indicator for this user
              setTypingUsers(prev => prev.filter(u => u.user_id !== user_id));
            }
          )
          .subscribe((status) => {
            console.log(`🔗 Real-time status: ${status} for chat ${chat.id}`);
            setConnectionStatus(status as any);
            
            if (status === 'SUBSCRIBED') {
              console.log('✅ Real-time subscription active!');
            } else if (status === 'CHANNEL_ERROR') {
              console.error('❌ Real-time subscription failed');
            }
          });

        console.log('✅ Simple real-time subscription established');

      } catch (error) {
        console.error('❌ Failed to set up real-time subscription:', error);
        setError('Erro ao estabelecer conexão em tempo real');
        setConnectionStatus('error');
        
        // Fallback to polling
        console.log('🔄 Setting up polling fallback...');
        const pollInterval = setInterval(async () => {
          try {
            const latestMessages = await EnhancedChatService.getChatMessages(chat.id);
            setMessages(prev => {
              if (latestMessages.length !== prev.length) {
                console.log('🔄 Found new messages via fallback polling:', latestMessages.length - prev.length);
                return latestMessages;
              }
              return prev;
            });
          } catch (err) {
            console.error('Fallback polling failed:', err);
          }
        }, 500); // Very fast fallback polling

        subscriptionRef.current = { unsubscribe: () => clearInterval(pollInterval) };
      }
    };

    setupSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [chat?.id]);

  // Load chat on mount
  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Force refresh messages
  const forceRefresh = useCallback(async () => {
    if (!chat?.id) return;
    
    console.log('🔄 Force refreshing messages for chat:', chat.id);
    try {
      const messagesData = await EnhancedChatService.getChatMessages(chat.id);
      console.log('✅ Force refresh completed, message count:', messagesData.length);
      setMessages(messagesData);
    } catch (err) {
      console.error('Force refresh failed:', err);
    }
  }, [chat?.id]);

  // Set up periodic refresh to ensure messages are always up to date
  useEffect(() => {
    if (!chat?.id) return;

    const refreshInterval = setInterval(async () => {
      try {
        const latestMessages = await EnhancedChatService.getChatMessages(chat.id);
        setMessages(prev => {
          // Only update if there are new messages to avoid unnecessary re-renders
          if (latestMessages.length !== prev.length || 
              JSON.stringify(latestMessages.map(m => m.id)) !== JSON.stringify(prev.map(m => m.id))) {
            console.log('🔄 Periodic refresh found updates, message count:', latestMessages.length);
            return latestMessages;
          }
          return prev;
        });
      } catch (err) {
        console.error('Periodic refresh failed:', err);
      }
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(refreshInterval);
  }, [chat?.id]);

  return {
    chat,
    messages,
    isLoading,
    error,
    connectionStatus,
    typingUsers,
    sendMessage,
    uploadFile,
    addReaction,
    removeReaction,
    markAsRead,
    startTyping,
    stopTyping,
    reload: loadChat,
    forceRefresh
  };
}
