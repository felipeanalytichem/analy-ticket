import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
// import { ScrollArea } from '@/components/ui/scroll-area'; // Temporarily disabled
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { 
  Send, 
  Paperclip, 
  Image, 
  Smile,
  MoreVertical,
  Download,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  X,
  Wifi,
  WifiOff,
  Loader2,
  Search,
  Plus
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ModernTicketChatProps {
  ticketId: string;
  className?: string;
  onMessageSent?: () => void; // Add callback for message events
}

interface MessageWithReactions {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type?: 'text' | 'file' | 'image' | 'system';
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  is_internal?: boolean;
  sender?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
    role: string;
  };
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  reactions?: Array<{
    emoji: string;
    users: string[];
    count: number;
  }>;
}

const EMOJI_LIST = ['👍', '👎', '❤️', '😊', '😂', '😮', '😢', '😡', '🎉', '🚀'];

export function ModernTicketChat({ ticketId, className, onMessageSent }: ModernTicketChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme } = useTheme();
  const { 
    messages: rawMessages, 
    sendMessage, 
    addReaction: hookAddReaction,
    removeReaction: hookRemoveReaction,
    isLoading, 
    error,
    connectionStatus,
    typingUsers,
    startTyping,
    stopTyping
  } = useChat(ticketId);
  
  const [messages, setMessages] = useState<MessageWithReactions[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localTypingDemo, setLocalTypingDemo] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [demoTyping, setDemoTyping] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(0);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced auto-scroll functionality
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    console.log('🔄 scrollToBottom called with behavior:', behavior);
    
    // Direct approach with the simple div
    if (scrollAreaRef.current) {
      console.log('📜 Found scroll container, scrolling...', {
        scrollHeight: scrollAreaRef.current.scrollHeight,
        scrollTop: scrollAreaRef.current.scrollTop,
        clientHeight: scrollAreaRef.current.clientHeight
      });
      
      if (behavior === 'smooth') {
        scrollAreaRef.current.scrollTo({
          top: scrollAreaRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    } else {
      console.warn('❌ No scroll container found');
    }
  }, []);

  // Track user scrolling to avoid auto-scroll when user is viewing old messages
  const handleScroll = useCallback(() => {
    if (scrollAreaRef.current) {
      const isAtBottom = scrollAreaRef.current.scrollHeight - scrollAreaRef.current.scrollTop <= scrollAreaRef.current.clientHeight + 50;
      
      // Show scroll button when not at bottom
      setShowScrollButton(!isAtBottom);
      
      if (!isAtBottom) {
        isUserScrollingRef.current = true;
        // Reset user scrolling flag after 3 seconds of no new messages
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        scrollTimeoutRef.current = setTimeout(() => {
          isUserScrollingRef.current = false;
        }, 3000);
      } else {
        isUserScrollingRef.current = false;
      }
    }
  }, []);

  // Convert raw messages to enhanced format with reactions
  useEffect(() => {
    console.log('🔄 ModernTicketChat: rawMessages updated, count:', rawMessages.length);
    const enhancedMessages: MessageWithReactions[] = rawMessages.map(msg => ({
      ...msg,
      content: (msg as any).content ?? (msg as any).message ?? '',
      status: 'sent',
      reactions: (msg as any).reactions || [],
    }));
    setMessages(enhancedMessages);
    console.log('✅ ModernTicketChat: messages state updated, count:', enhancedMessages.length);
  }, [rawMessages]);

  // Auto-scroll when messages change
  useEffect(() => {
    const currentMessageCount = messages.length;
    const hadNewMessage = currentMessageCount > lastMessageCountRef.current;
    
    console.log('🔄 Messages effect triggered:', {
      currentCount: currentMessageCount,
      lastCount: lastMessageCountRef.current,
      hadNewMessage,
      isUserScrolling: isUserScrollingRef.current,
      messages: messages.slice(-2).map(m => ({ id: m.id, content: m.content.slice(0, 20) }))
    });
    
    if (hadNewMessage && !isUserScrollingRef.current) {
      // Use smooth scroll for new messages, instant for initial load
      const behavior = lastMessageCountRef.current === 0 ? 'instant' : 'smooth';
      console.log('📜 Scheduling scroll with behavior:', behavior);
      
      // Multiple scroll attempts with different timings for reliability
      setTimeout(() => {
        console.log('📜 Executing scroll attempt 1');
        scrollToBottom(behavior);
      }, 50);
      
      setTimeout(() => {
        console.log('📜 Executing scroll attempt 2');
        scrollToBottom(behavior);
      }, 100);
      
      setTimeout(() => {
        console.log('📜 Executing scroll attempt 3');
        scrollToBottom(behavior);
      }, 200);
    }
    
    lastMessageCountRef.current = currentMessageCount;
  }, [messages, scrollToBottom]);

  // Scroll to bottom when component mounts
  useEffect(() => {
    setTimeout(() => scrollToBottom('instant'), 200);
  }, [scrollToBottom]);

  // Add scroll listener to ScrollArea
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.addEventListener('scroll', handleScroll);
      return () => scrollAreaRef.current?.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && scrollAreaRef.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // Debug typing users
  useEffect(() => {
    console.log('🔤 Typing users updated:', typingUsers);
  }, [typingUsers]);

  const handleSend = async () => {
    const value = messageText.trim();
    if (!value && !selectedFile) return;

    try {
      if (selectedFile) {
        await handleFileUpload(selectedFile);
        setSelectedFile(null);
      } else if (value) {
        await sendMessage(value, false);
        setMessageText('');
        setIsComposing(false);
      }
      
      // Trigger callback to refresh SLA and other components
      if (onMessageSent) {
        onMessageSent();
      }
      
      // Immediate scroll after sending
      setTimeout(() => scrollToBottom('smooth'), 50);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    try {
      await sendMessage(`📎 ${file.name}`, false);
      toast({
        title: "File uploaded",
        description: `${file.name} has been shared.`,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  // Add reaction to message
  const addReaction = async (messageId: string, emoji: string) => {
    try {
      if (hookAddReaction) {
        await hookAddReaction(messageId, emoji);
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
      toast({
        title: "Failed to add reaction",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  // Remove reaction from message
  const removeReaction = async (messageId: string, emoji: string) => {
    try {
      if (hookRemoveReaction) {
        await hookRemoveReaction(messageId, emoji);
      }
    } catch (error) {
      console.error('Error removing reaction:', error);
      toast({
        title: "Failed to remove reaction",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Demo typing test
  const testTypingIndicator = () => {
    setDemoTyping(true);
    setTimeout(() => setDemoTyping(false), 3000);
  };

  if (isLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border dark:border-gray-700">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-700 rounded-full"></div>
            <div className="w-12 h-12 border-4 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full animate-spin absolute top-0"></div>
          </div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[600px] flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30 rounded-xl border dark:border-gray-700">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 dark:text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Chat Unavailable</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Unable to load the chat. Please try again.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            <Loader2 className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-[600px] bg-white dark:bg-gray-900 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden", className)}>
      {/* Modern Header */}
      <div className="flex-shrink-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Chat</h3>
              <p className="text-blue-100 text-xs">Real-time messaging</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
              connectionStatus === 'SUBSCRIBED' 
                ? "bg-green-500/20 text-green-100" 
                : "bg-red-500/20 text-red-100"
            )}>
              {connectionStatus === 'SUBSCRIBED' ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">
                {connectionStatus === 'SUBSCRIBED' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-800">
        <div 
          ref={scrollAreaRef} 
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
        >
          <div ref={listRef} className="p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 rounded-full flex items-center justify-center mb-4">
                  <Send className="h-10 w-10 text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Start the conversation</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  Send your first message to begin chatting about this ticket.
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const isOwn = message.sender_id === user?.id;
                const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;
                
                return (
                  <div key={message.id} className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {showAvatar ? (
                        <Avatar className="h-8 w-8 border-2 border-white shadow-sm">
                          <AvatarImage src={message.sender?.avatar_url} />
                          <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
                            {getInitials(message.sender?.full_name || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>

                    {/* Message Content */}
                    <div className={cn("flex-1 max-w-[75%]", isOwn && "flex flex-col items-end")}>
                      {/* Sender info */}
                      {showAvatar && !isOwn && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {message.sender?.full_name}
                          </span>
                          {message.sender?.role && (
                            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                              {message.sender.role}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Message Bubble */}
                      <div className="group relative">
                        <div
                          className={cn(
                            "relative rounded-2xl px-4 py-3 max-w-full break-words shadow-sm",
                            isOwn
                              ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white"
                              : "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-600",
                            message.is_internal && "ring-2 ring-orange-200 dark:ring-orange-700 bg-orange-50 dark:bg-orange-900/20"
                          )}
                        >
                          <div className="text-sm leading-relaxed">
                            {message.content}
                          </div>

                          {/* File attachment */}
                          {message.message_type === 'file' && (
                            <div className={cn(
                              "mt-3 p-3 rounded-xl flex items-center gap-3",
                              isOwn ? "bg-white/20" : "bg-gray-50 dark:bg-gray-600"
                            )}>
                              <div className={cn(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                isOwn ? "bg-white/20" : "bg-blue-100"
                              )}>
                                <FileText className={cn("h-5 w-5", isOwn ? "text-white" : "text-blue-600")} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-sm font-medium truncate", isOwn ? "text-white" : "text-gray-900")}>
                                  {message.file_name}
                                </p>
                                <p className={cn("text-xs", isOwn ? "text-blue-100" : "text-gray-500")}>
                                  {message.file_size && formatFileSize(message.file_size)}
                                </p>
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className={cn(
                                  "h-8 w-8 p-0",
                                  isOwn ? "text-white hover:bg-white/20" : "text-gray-500 hover:bg-gray-100"
                                )}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          )}

                          {/* Message reactions */}
                          {message.reactions && message.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {message.reactions.map((reaction, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if (reaction.users.includes(user?.id || '')) {
                                      removeReaction(message.id, reaction.emoji);
                                    } else {
                                      addReaction(message.id, reaction.emoji);
                                    }
                                  }}
                                  className={cn(
                                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all hover:scale-105",
                                    reaction.users.includes(user?.id || '')
                                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-700"
                                      : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                  )}
                                >
                                  <span>{reaction.emoji}</span>
                                  <span>{reaction.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Message actions (show on hover) */}
                          <div className={cn(
                            "absolute top-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20",
                            isOwn ? "-left-10" : "-right-10"
                          )}>
                            <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 p-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0 hover:bg-gray-100 transition-colors"
                                      onClick={() => setShowEmojiPicker(message.id)}
                                    >
                                      <Smile className="h-4 w-4 text-gray-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Add reaction</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </div>
                        </div>

                        {/* Message time */}
                        <div className={cn(
                          "flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400",
                          isOwn && "flex-row-reverse"
                        )}>
                          <span>{formatTime(message.created_at)}</span>
                          {isOwn && (
                            <div className="flex items-center">
                              <CheckCheck className="h-3 w-3 text-blue-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {/* Typing indicator */}
            {typingUsers && typingUsers.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mx-4 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs bg-gray-200 dark:bg-gray-700">
                    {getInitials(typingUsers[0].user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>{typingUsers[0].user_name} is typing...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Input Area */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
        {/* File preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  {selectedFile.type.startsWith('image/') ? (
                    <Image className="h-5 w-5 text-blue-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-900">{selectedFile.name}</p>
                  <p className="text-xs text-blue-600">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedFile(null)}
                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-3">
          {/* Attachment button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 p-0 border-2 hover:border-blue-300 hover:bg-blue-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Attach file</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Text input */}
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={messageText}
              placeholder="Type your message..."
              onKeyPress={handleKeyPress}
              onChange={(e) => {
                setMessageText(e.target.value);
                setIsComposing(e.target.value.length > 0);
                
                // Debug logging
                console.log('🔤 Input changed, value length:', e.target.value.length);
                
                // Trigger typing indicator when user is typing
                if (e.target.value.length > 0) {
                  console.log('🔤 Calling startTyping...');
                  startTyping();
                } else {
                  console.log('🔤 Calling stopTyping...');
                  stopTyping();
                }
              }}
              className="pr-10 h-10 border-2 focus:border-blue-300 rounded-xl"
              disabled={isLoading}
            />
            
            {/* Emoji button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
                    onClick={() => setShowEmojiPicker(showEmojiPicker ? null : 'input')}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add emoji</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={isLoading || (!isComposing && !selectedFile)}
            className="h-10 w-10 p-0 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 rounded-xl"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
          
          {/* Test typing button (development only) */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              onClick={() => {
                console.log('🔤 Test button clicked - triggering typing demo');
                startTyping();
                setTimeout(() => stopTyping(), 3000);
              }}
              variant="outline"
              size="sm"
              className="h-10 px-3 text-xs"
            >
              Test Typing
            </Button>
          )}
        </div>

        {/* Quick emoji picker for input */}
        {showEmojiPicker === 'input' && (
          <div className="mt-3 p-3 bg-white border-2 border-gray-200 rounded-xl shadow-lg">
            <div className="flex flex-wrap gap-2">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    setMessageText(prev => prev + emoji);
                    setIsComposing(true);
                    setShowEmojiPicker(null);
                  }}
                  className="text-xl hover:bg-gray-100 rounded-lg p-2 transition-all hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />

      {/* Emoji picker for reactions */}
      {showEmojiPicker && showEmojiPicker !== 'input' && (
        <Dialog open={!!showEmojiPicker} onOpenChange={() => setShowEmojiPicker(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smile className="h-5 w-5" />
                Add Reaction
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-5 gap-3 p-4">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    addReaction(showEmojiPicker, emoji);
                    setShowEmojiPicker(null);
                  }}
                  className="text-3xl hover:bg-gray-100 rounded-xl p-3 transition-all hover:scale-110 flex items-center justify-center"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
