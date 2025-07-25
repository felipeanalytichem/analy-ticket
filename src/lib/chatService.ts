import { supabase } from '@/lib/supabase';

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

export class ChatService {
  private static typingTimeouts = new Map<string, NodeJS.Timeout>();
  private static readonly TYPING_TIMEOUT = 3000; // 3 seconds
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_FILE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

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

      // If there's any error or no chat found, try to create one
      if (error || !chat) {
        // Chat doesn't exist, create it
        const { data: created, error: createError } = await supabase
          .from('ticket_chats')
          .insert({ 
            ticket_id: ticketId,
            chat_type: 'ticket',
            is_active: true
          })
          .select('*')
          .single();

        if (createError) {
          console.error('Error creating ticket chat:', createError);
          throw new Error(`Failed to create chat for ticket ${ticketId}: ${createError.message}`);
        }
        chat = created;
      }

      return chat as TicketChat;
    } catch (error) {
      console.error('Error getting/creating ticket chat:', error);
      throw new Error(`Failed to get/create chat for ticket ${ticketId}: ${error.message}`);
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
          ),
          reactions:chat_message_reactions(
            id,
            user_id,
            emoji,
            created_at,
            user:users!chat_message_reactions_user_id_fkey(full_name)
          )
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((msg: any) => ({
        ...msg,
        content: msg.content ?? msg.message ?? '',
        status: msg.status || 'sent',
        reactions: msg.reactions || [],
        mentions: this.extractMentions(msg.content || ''),
      })) as ChatMessage[];
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
          reply_to: replyTo,
          status: 'sent'
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

      if (uploadError) throw uploadError;

      // Create message record
      const messageType = file.type.startsWith('image/') ? 'image' : 'file';
      
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          content: file.name,
          file_path: filePath,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          message_type: messageType,
          is_internal: isInternal,
          status: 'sent'
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

  /** Add reaction to message */
  static async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      await supabase
        .from('chat_message_reactions')
        .upsert({
          message_id: messageId,
          user_id: userId,
          emoji
        });
    } catch (error) {
      console.error('Error adding reaction:', error);
      throw error;
    }
  }

  /** Remove reaction from message */
  static async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      await supabase
        .from('chat_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);
    } catch (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }
  }

  /** Mark chat as read */
  static async markChatAsRead(chatId: string, userId: string): Promise<void> {
    try {
      // First, ensure the user is a participant
      const { error: participantError } = await supabase
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

      if (participantError) {
        console.error('Error updating chat participant:', participantError);
        // Continue anyway, don't throw
      }

      // Update message read status
      const { error: messageError } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('chat_id', chatId)
        .neq('sender_id', userId);

      if (messageError) {
        console.error('Error updating message read status:', messageError);
      }
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

      if (error) throw error;
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

      await supabase
        .from('chat_message_mentions')
        .insert(mentions);
    } catch (error) {
      console.error('Error creating mentions:', error);
    }
  }

  /** Get unread message count for user */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .rpc('get_unread_chat_messages_count', { user_uuid: userId });

      if (error) throw error;
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
} 