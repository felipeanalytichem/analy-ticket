import { supabase } from './supabase';

export interface TicketChat {
  id: string;
  ticket_id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  chat_type?: 'ticket' | 'direct';
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  message_type: 'text' | 'file' | 'system' | 'image';
  is_read: boolean;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  sender?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  };
  reactions?: MessageReaction[];
  mentions?: string[];
  reply_to?: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    full_name: string;
  };
}

export interface ChatParticipant {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  last_read_at?: string;
  can_write: boolean;
  user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  };
}

export interface TypingIndicator {
  user_id: string;
  user_name: string;
  timestamp: number;
}

export class EnhancedChatService {
  private static typingTimeouts = new Map<string, NodeJS.Timeout>();
  private static readonly TYPING_TIMEOUT = 3000; // 3 seconds
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  // WebSocket connection management
  private static connections = new Map<string, any>();
  private static connectionStatus = new Map<string, 'connecting' | 'connected' | 'disconnected' | 'error'>();
  private static reconnectTimeouts = new Map<string, NodeJS.Timeout>();
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RECONNECT_DELAY = 3000; // 3 seconds

  // Rate limiting cache
  private static rateLimitCache: Map<string, number[]>;

  /** Check if chat tables exist */
  static async checkChatTablesExist(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .select('id')
        .limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /** Get or create a chat for a ticket */
  static async getTicketChat(ticketId: string): Promise<TicketChat> {
    try {
      // Try to fetch existing chat
      let { data: chat, error } = await supabase
        .from('ticket_chats')
        .select('*')
        .eq('ticket_id', ticketId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Chat doesn't exist, create it
        const { data: created, error: createError } = await supabase
          .from('ticket_chats')
          .insert({ 
            ticket_id: ticketId,
            chat_type: 'ticket'
          })
          .select('*')
          .single();

        if (createError) throw createError;
        chat = created;
      } else if (error) {
        throw error;
      }

      return chat as TicketChat;
    } catch (error) {
      console.error('Error getting/creating ticket chat:', error);
      throw error;
    }
  }

  /** Get chat messages with enhanced data */
  static async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:users!chat_messages_sender_id_fkey(
            id,
            full_name,
            email,
            avatar_url,
            role
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get reactions separately to avoid complex joins
      const messageIds = (data || []).map(msg => msg.id);
      let reactionsData: any[] = [];
      
      if (messageIds.length > 0) {
        const { data: reactions } = await supabase
          .from('chat_message_reactions')
          .select(`
            id,
            message_id,
            user_id,
            emoji,
            created_at,
            user:users!chat_message_reactions_user_id_fkey(
              full_name
            )
          `)
          .in('message_id', messageIds);
        
        reactionsData = reactions || [];
      }

      return (data || []).map((msg: any) => {
        // Group reactions by emoji for this message
        const messageReactions = reactionsData.filter(r => r.message_id === msg.id);
        const groupedReactions = messageReactions.reduce((acc: any, reaction: any) => {
          const emoji = reaction.emoji;
          if (!acc[emoji]) {
            acc[emoji] = {
              emoji,
              users: [],
              count: 0
            };
          }
          acc[emoji].users.push(reaction.user_id);
          acc[emoji].count += 1;
          return acc;
        }, {});

        const reactions = Object.values(groupedReactions);

        console.log(`Message ${msg.id} has ${reactions.length} reaction types:`, reactions);

        return {
          ...msg,
          content: msg.content ?? msg.message ?? '',
          status: msg.status || 'sent',
          reactions,
          mentions: this.extractMentions(msg.content || ''),
        };
      }) as ChatMessage[];
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }

  /** Send a text message */
  static async sendChatMessage(
    chatId: string,
    senderId: string,
    content: string,
    isInternal = false,
    replyTo?: string
  ): Promise<ChatMessage> {
    try {
      const mentions = this.extractMentions(content);
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          content,
          is_internal: isInternal,
          message_type: 'text',
          reply_to: replyTo
        })
        .select(`
          *,
          sender:users!chat_messages_sender_id_fkey(
            id,
            full_name,
            email,
            avatar_url,
            role
          )
        `)
        .single();

      if (error) throw error;

      // Handle mentions
      if (mentions.length > 0) {
        await this.createMentions(data.id, mentions);
      }

      // Create notification for ticket participants (non-blocking)
      this.createChatMessageNotification(chatId, senderId, content, isInternal).catch(err => {
        console.warn('Failed to create chat message notification (non-blocking):', err);
      });

      return {
        ...data,
        content: data.content ?? data.message ?? '',
        status: 'sent',
        reactions: [],
        mentions,
      } as ChatMessage;
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  /** Upload and send file message */
  static async uploadChatFile(
    chatId: string,
    senderId: string,
    file: File,
    isInternal = false
  ): Promise<ChatMessage> {
    try {
      // Validate file
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error('File size exceeds 10MB limit');
      }

      if (!this.ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error('File type not allowed');
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `chat-files/${chatId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file);

      if (uploadError) {
        console.warn('Storage upload failed, creating message without file:', uploadError);
        // Continue without file upload for now
      }

      // Create message record
      const messageType = file.type.startsWith('image/') ? 'image' : 'file';
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          content: file.name,
          file_path: uploadError ? undefined : filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          message_type: messageType,
          is_internal: isInternal
        })
        .select(`
          *,
          sender:users!chat_messages_sender_id_fkey(
            id,
            full_name,
            email,
            avatar_url,
            role
          )
        `)
        .single();

      if (error) throw error;

      return {
        ...data,
        content: data.content ?? data.message ?? '',
        status: 'sent',
        reactions: [],
        mentions: [],
      } as ChatMessage;
    } catch (error) {
      console.error('Error uploading chat file:', error);
      throw error;
    }
  }

  /** Get file URL from storage */
  static async getFileUrl(filePath: string): Promise<string> {
    try {
      const { data } = await supabase.storage
        .from('chat-attachments')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      return data?.signedUrl || '';
    } catch (error) {
      console.error('Error getting file URL:', error);
      return '';
    }
  }

  /** Add a reaction to a message */
  static async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      // More robust check for existing reactions to avoid .single() errors.
      const { count, error: countError } = await supabase
        .from('chat_message_reactions')
        .select('*', { count: 'exact', head: true })
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);

      if (countError) {
        throw countError;
      }

      // If count is greater than 0, the reaction already exists.
      if (count !== null && count > 0) {
        console.warn('Reaction already exists.');
        return;
      }
      
      const { error: insertError } = await supabase
        .from('chat_message_reactions')
        .insert({
          message_id: messageId,
          user_id: userId,
          emoji,
        });

      if (insertError) throw insertError;

    } catch (error) {
      console.error('Could not add reaction:', error);
      throw error;
    }
  }

  /** Remove a reaction from a message */
  static async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('chat_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);

      if (error) {
        console.warn('Could not remove reaction:', error);
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
      // Don't throw to avoid breaking the UI
    }
  }

  /** Mark chat as read */
  static async markChatAsRead(chatId: string, userId: string): Promise<void> {
    try {
      // Try to update chat participants table, but don't fail if it doesn't exist
      const { error } = await supabase
        .from('chat_participants')
        .upsert({
          chat_id: chatId,
          user_id: userId,
          last_read_at: new Date().toISOString(),
          joined_at: new Date().toISOString(),
          can_write: true
        }, {
          onConflict: 'chat_id,user_id'
        });

      if (error) {
        console.warn('Could not update chat participants:', error);
      }

      // Update message read status
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', userId);
    } catch (error) {
      console.error('Error marking chat as read:', error);
    }
  }

  /** Get chat participants */
  static async getChatParticipants(chatId: string): Promise<ChatParticipant[]> {
    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          *,
          user:users!chat_participants_user_id_fkey(
            id,
            full_name,
            email,
            avatar_url,
            role
          )
        `)
        .eq('chat_id', chatId);

      if (error) {
        console.warn('Could not get chat participants:', error);
        return [];
      }
      return data as ChatParticipant[];
    } catch (error) {
      console.error('Error getting chat participants:', error);
      return [];
    }
  }

  /** Send typing indicator */
  static async sendTypingIndicator(chatId: string, userId: string, userName: string): Promise<void> {
    try {
      const channel = `chat-${chatId}`;
      await supabase.realtime.channel(channel).send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: userId,
          user_name: userName,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('Error sending typing indicator:', error);
    }
  }

  /** Extract mentions from message content */
  static extractMentions(content: string): string[] {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[2]); // Extract user ID
    }
    
    return mentions;
  }

  /** Create mention records */
  private static async createMentions(messageId: string, userIds: string[]): Promise<void> {
    try {
      const mentions = userIds.map(userId => ({
        message_id: messageId,
        mentioned_user_id: userId
      }));

      const { error } = await supabase
        .from('chat_message_mentions')
        .insert(mentions);

      if (error) {
        console.warn('Could not create mentions:', error);
      }
    } catch (error) {
      console.error('Error creating mentions:', error);
    }
  }

  /** Get unread message count for user */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_chat_messages_count', { user_uuid: userId });

      if (error) {
        console.warn('Could not get unread count:', error);
        return 0;
      }
      return data || 0;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /** Search messages in chat */
  static async searchMessages(chatId: string, query: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          sender:users!chat_messages_sender_id_fkey(
            id,
            full_name,
            email,
            avatar_url,
            role
          )
        `)
        .eq('chat_id', chatId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((msg: any) => ({
        ...msg,
        content: msg.content ?? msg.message ?? '',
        status: msg.status || 'sent',
        reactions: [],
        mentions: this.extractMentions(msg.content || ''),
      })) as ChatMessage[];
    } catch (error) {
      console.error('Error searching messages:', error);
      return [];
    }
  }

  /** Rate limiting check */
  static async checkRateLimit(userId: string): Promise<boolean> {
    // Simple rate limiting - max 10 messages per minute
    const key = `rate_limit_${userId}`;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute ago
    
    // This would typically use Redis or a proper cache
    // For now, we'll use a simple in-memory approach
    if (!this.rateLimitCache) {
      this.rateLimitCache = new Map();
    }
    
    const userMessages = this.rateLimitCache.get(key) || [];
    const recentMessages = userMessages.filter((timestamp: number) => timestamp > windowStart);
    
    if (recentMessages.length >= 10) {
      return false; // Rate limit exceeded
    }
    
    recentMessages.push(now);
    this.rateLimitCache.set(key, recentMessages);
    return true;
  }

  /** Create chat message notification */
  private static async createChatMessageNotification(
    chatId: string,
    senderId: string,
    content: string,
    isInternal: boolean
  ): Promise<void> {
    try {
      // Get the ticket ID from chat ID
      const { data: chat, error: chatError } = await supabase
        .from('ticket_chats')
        .select('ticket_id')
        .eq('id', chatId)
        .single();

      if (chatError || !chat) {
        console.warn('Could not find ticket for chat:', chatId);
        return;
      }

      // Get ticket details to find who to notify
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets_new')
        .select('user_id, assigned_to, title, ticket_number, status')
        .eq('id', chat.ticket_id)
        .single();

      if (ticketError || !ticket) {
        console.warn('Could not find ticket details for notification:', chat.ticket_id);
        return;
      }

      // Don't send notifications for closed tickets
      if (ticket.status === 'closed') {
        return;
      }

      // Get sender details
      const { data: sender, error: senderError } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', senderId)
        .single();

      if (senderError || !sender) {
        console.warn('Could not find sender details for notification:', senderId);
        return;
      }

      const notifications = [];
      const notifiedUsers = new Set();

      // Notify ticket creator (if not the sender and not internal message)
      if (ticket.user_id !== senderId && !isInternal) {
        const notification = {
          user_id: ticket.user_id,
          type: 'comment_added',
          title: '💬 Nova Mensagem Recebida',
          message: `Você recebeu uma nova mensagem no chamado ${ticket.ticket_number || '#' + chat.ticket_id.slice(-8)}. Clique para ver a mensagem e continuar a conversa.`,
          ticket_id: chat.ticket_id,
          read: false,
          priority: 'medium',
          created_at: new Date().toISOString()
        };
        
        notifications.push(notification);
        notifiedUsers.add(ticket.user_id);
        console.log('💬 Will notify ticket creator:', ticket.user_id);
      }

      // Notify assigned agent (if exists, different from sender, and not internal)
      if (ticket.assigned_to && 
          ticket.assigned_to !== senderId && 
          ticket.assigned_to !== ticket.user_id &&
          !isInternal &&
          !notifiedUsers.has(ticket.assigned_to)) {
        const notification = {
          user_id: ticket.assigned_to,
          type: 'comment_added',
          title: '💬 Nova Mensagem no Ticket',
          message: `Nova mensagem adicionada ao ticket ${ticket.ticket_number || '#' + chat.ticket_id.slice(-8)} por ${sender.full_name || 'usuário'}.`,
          ticket_id: chat.ticket_id,
          read: false,
          priority: 'medium',
          created_at: new Date().toISOString()
        };
        
        notifications.push(notification);
        notifiedUsers.add(ticket.assigned_to);
        console.log('💬 Will notify assigned agent:', ticket.assigned_to);
      }

      // Insert notifications
      if (notifications.length > 0) {
        const { error: insertError } = await supabase
          .from('notifications')
          .insert(notifications);

        if (insertError) {
          console.error('Error creating chat message notifications:', insertError);
        } else {
          console.log(`✅ Created ${notifications.length} chat message notifications`);
        }
      } else {
        console.log('💬 No notifications needed for this message');
      }

    } catch (error) {
      console.error('Error creating chat message notification:', error);
    }
  }

  /** 
   * Subscribe to real-time chat updates with enhanced WebSocket management
   */
  static async subscribeToChat(
    chatId: string, 
    callbacks: {
      onMessage?: (message: ChatMessage) => void;
      onReaction?: (reaction: MessageReaction) => void;
      onTyping?: (typing: TypingIndicator) => void;
      onConnectionChange?: (status: string) => void;
      onError?: (error: any) => void;
    }
  ): Promise<() => void> {
    try {
      // Check if chat tables exist
      const exists = await this.checkChatTablesExist();
      if (!exists) {
        console.warn('💬 Chat tables not available, WebSocket subscription disabled');
        callbacks.onError?.('Chat tables not available');
        return () => {};
      }

      const channelName = `enhanced-chat-${chatId}`;
      
      // Clean up existing connection
      if (this.connections.has(channelName)) {
        await this.unsubscribeFromChat(chatId);
      }

      // Set connecting status
      this.connectionStatus.set(channelName, 'connecting');
      callbacks.onConnectionChange?.('connecting');

      // Create new subscription
      const channel = supabase
        .channel(channelName, {
          config: {
            presence: {
              key: chatId,
            },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `chat_id=eq.${chatId}`
          },
          async (payload) => {
            console.log('🔄 Real-time message received:', payload);
            try {
              // Get full message data with relations
              const { data: messageData, error } = await supabase
                .from('chat_messages')
                .select(`
                  *,
                  sender:users!chat_messages_sender_id_fkey(
                    id,
                    full_name,
                    email,
                    avatar_url,
                    role
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (!error && messageData) {
                const message: ChatMessage = {
                  ...messageData,
                  content: messageData.content ?? messageData.message ?? '',
                  status: 'sent',
                  reactions: [],
                  mentions: this.extractMentions(messageData.content || ''),
                };
                callbacks.onMessage?.(message);
              }
            } catch (err) {
              console.error('Error processing real-time message:', err);
              callbacks.onError?.(err);
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
            console.log('🔄 Real-time reaction received:', payload);
            try {
              // Get full reaction data with user info
              const { data: reactionData, error } = await supabase
                .from('chat_message_reactions')
                .select(`
                  *,
                  user:users!chat_message_reactions_user_id_fkey(
                    full_name
                  )
                `)
                .eq('id', payload.new.id)
                .single();

              if (!error && reactionData) {
                callbacks.onReaction?.(reactionData as MessageReaction);
              }
            } catch (err) {
              console.error('Error processing real-time reaction:', err);
              callbacks.onError?.(err);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'chat_message_reactions'
          },
          async (payload) => {
            console.log('🔄 Real-time reaction removed:', payload);
            // Handle reaction removal - could trigger a callback for UI updates
            callbacks.onReaction?.({
              ...payload.old,
              _deleted: true
            } as MessageReaction & { _deleted: boolean });
          }
        )
        .on('presence', { event: 'sync' }, () => {
          console.log('🔄 Presence sync');
          const presenceState = channel.presenceState();
          console.log('Current presence:', presenceState);
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('🔄 User joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('🔄 User left:', key, leftPresences);
        })
        .subscribe(async (status) => {
          console.log(`🔄 WebSocket status: ${status} for chat ${chatId}`);
          this.connectionStatus.set(channelName, status as any);
          callbacks.onConnectionChange?.(status);

          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to chat updates');
            // Track presence
            await channel.track({
              user_id: (await supabase.auth.getUser()).data.user?.id,
              online_at: new Date().toISOString(),
            });
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ WebSocket subscription error');
            callbacks.onError?.('WebSocket subscription failed');
            // Attempt reconnection
            this.scheduleReconnect(chatId, callbacks);
          } else if (status === 'TIMED_OUT') {
            console.warn('⏰ WebSocket subscription timed out');
            callbacks.onError?.('WebSocket connection timed out');
            this.scheduleReconnect(chatId, callbacks);
          }
        });

      // Store connection
      this.connections.set(channelName, channel);

      // Return unsubscribe function
      return () => this.unsubscribeFromChat(chatId);

    } catch (error) {
      console.error('Error setting up WebSocket subscription:', error);
      callbacks.onError?.(error);
      return () => {};
    }
  }

  /**
   * Unsubscribe from chat updates
   */
  static async unsubscribeFromChat(chatId: string): Promise<void> {
    const channelName = `enhanced-chat-${chatId}`;
    const connection = this.connections.get(channelName);
    
    if (connection) {
      try {
        await connection.unsubscribe();
        this.connections.delete(channelName);
        this.connectionStatus.delete(channelName);
        
        // Clear any pending reconnection
        const timeout = this.reconnectTimeouts.get(channelName);
        if (timeout) {
          clearTimeout(timeout);
          this.reconnectTimeouts.delete(channelName);
        }
        
        console.log(`✅ Unsubscribed from chat ${chatId}`);
      } catch (error) {
        console.error('Error unsubscribing from chat:', error);
      }
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private static scheduleReconnect(
    chatId: string, 
    callbacks: {
      onMessage?: (message: ChatMessage) => void;
      onReaction?: (reaction: MessageReaction) => void;
      onTyping?: (typing: TypingIndicator) => void;
      onConnectionChange?: (status: string) => void;
      onError?: (error: any) => void;
    },
    attempt: number = 1
  ): void {
    if (attempt > this.MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Max reconnection attempts reached for chat ${chatId}`);
      callbacks.onError?.('Max reconnection attempts reached');
      return;
    }

    const channelName = `enhanced-chat-${chatId}`;
    const delay = this.RECONNECT_DELAY * Math.pow(2, attempt - 1); // Exponential backoff

    console.log(`🔄 Scheduling reconnection attempt ${attempt} for chat ${chatId} in ${delay}ms`);
    
    const timeout = setTimeout(async () => {
      try {
        console.log(`🔄 Attempting to reconnect to chat ${chatId} (attempt ${attempt})`);
        await this.subscribeToChat(chatId, callbacks);
      } catch (error) {
        console.error(`❌ Reconnection attempt ${attempt} failed:`, error);
        this.scheduleReconnect(chatId, callbacks, attempt + 1);
      }
    }, delay);

    this.reconnectTimeouts.set(channelName, timeout);
  }

  /**
   * Get WebSocket connection status
   */
  static getConnectionStatus(chatId: string): string {
    const channelName = `enhanced-chat-${chatId}`;
    return this.connectionStatus.get(channelName) || 'disconnected';
  }

  /**
   * Send typing indicator via WebSocket
   */
  static async broadcastTyping(chatId: string, userId: string, userName: string): Promise<void> {
    try {
      console.log('🔤 Broadcasting typing indicator:', { chatId, userId, userName });
      
      const channel = supabase.channel(`chat-${chatId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: userId,
          user_name: userName,
          chat_id: chatId,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('✅ Typing indicator broadcasted successfully');
    } catch (error) {
      console.error('Error broadcasting typing indicator:', error);
    }
  }

  /**
   * Stop typing indicator
   */
  static async stopTyping(chatId: string, userId: string): Promise<void> {
    try {
      console.log('🔤 Broadcasting stop typing:', { chatId, userId });
      
      const channel = supabase.channel(`chat-${chatId}`);
      
      await channel.send({
        type: 'broadcast',
        event: 'stop_typing',
        payload: {
          user_id: userId,
          chat_id: chatId,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('✅ Stop typing broadcasted successfully');
    } catch (error) {
      console.error('Error stopping typing indicator:', error);
    }
  }

  /**
   * Test WebSocket connection and real-time functionality
   */
  static async testRealtimeConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing Supabase real-time connection...');
      
      // Test basic connection
      const channel = supabase.channel('test-connection');
      
      let isConnected = false;
      
      const promise = new Promise<boolean>((resolve) => {
        channel
          .on('presence', { event: 'sync' }, () => {
            console.log('🧪 Presence sync successful');
            isConnected = true;
          })
          .subscribe(async (status) => {
            console.log('🧪 Test channel status:', status);
            if (status === 'SUBSCRIBED') {
              console.log('🧪 Test subscription successful');
              isConnected = true;
              resolve(true);
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.log('🧪 Test subscription failed:', status);
              resolve(false);
            }
          });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          if (!isConnected) {
            console.log('🧪 Test connection timeout');
            resolve(false);
          }
        }, 10000);
      });
      
      const result = await promise;
      
      // Cleanup
      await channel.unsubscribe();
      
      console.log('🧪 Real-time test result:', result);
      return result;
      
    } catch (error) {
      console.error('🧪 Real-time test failed:', error);
      return false;
    }
  }

  /**
   * Check if user has permission to access chat tables
   */
  static async checkChatPermissions(): Promise<{canRead: boolean, canWrite: boolean}> {
    try {
      // Test read permission
      const { error: readError } = await supabase
        .from('chat_messages')
        .select('id')
        .limit(1);
      
      const canRead = !readError;
      
      // Test write permission (we'll use a dummy insert that should fail due to constraints)
      const { error: writeError } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: 'test',
          sender_id: 'test',
          content: 'test',
          message_type: 'text'
        });
      
      // If we get a constraint error, it means we have write permission but data is invalid
      // If we get a permission error, we don't have write permission
      const canWrite = writeError?.code !== '42501'; // 42501 is insufficient privilege error
      
      console.log('🔐 Chat permissions check:', { canRead, canWrite, readError, writeError });
      
      return { canRead, canWrite };
    } catch (error) {
      console.error('🔐 Permission check failed:', error);
      return { canRead: false, canWrite: false };
    }
  }
} 
