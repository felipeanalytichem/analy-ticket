import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { 
  Send, 
  Paperclip, 
  Image, 
  Search,
  MoreVertical,
  Download,
  Reply,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  X,
  Smile,
  Plus,
  Wifi,
  WifiOff,
  Loader2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EnhancedTicketChatProps {
  ticketId: string;
  className?: string;
}

interface MessageWithStatus {
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

export function EnhancedTicketChat({ ticketId, className }: EnhancedTicketChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
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
  
  // Enhanced state
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Convert raw messages to enhanced format
  useEffect(() => {
    console.log('Raw messages received:', rawMessages);
    const enhancedMessages: MessageWithStatus[] = rawMessages.map(msg => {
      console.log(`Message ${(msg as any).id} reactions:`, (msg as any).reactions);
      return {
        ...msg,
        content: (msg as any).content ?? (msg as any).message ?? '',
        status: 'sent',
        reactions: (msg as any).reactions || [],
      };
    });
    setMessages(enhancedMessages);
  }, [rawMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle typing indicators with WebSocket
  const handleTyping = useCallback(() => {
    if (!user?.id || !startTyping) return;

    startTyping();

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (stopTyping) {
        stopTyping();
      }
    }, 3000);
  }, [user, startTyping, stopTyping]);

  // Handle input change with typing indicators
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIsComposing(value.length > 0);
    handleTyping();
  }, [handleTyping]);

  // Send message with enhanced features
  const handleSend = async () => {
    const value = inputRef.current?.value.trim();
    if (!value && !selectedFile) return;

    try {
      // Stop typing indicator when sending
      if (stopTyping) {
        stopTyping();
      }

      if (selectedFile) {
        // Handle file upload
        await handleFileUpload(selectedFile);
        setSelectedFile(null);
      } else if (value) {
        // Send text message
        await sendMessage(value, false);
        if (inputRef.current) inputRef.current.value = '';
        setIsComposing(false);
      }
      
      setReplyTo(null);
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
    const ALLOWED_FILE_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: "File too large",
        description: "File size must be less than 10MB.",
        variant: "destructive",
      });
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      toast({
        title: "File type not supported",
        description: "Please upload an image, PDF, or document file.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Here you would implement actual file upload logic
      // For now, we'll simulate it
      const fileName = file.name;
      const fileSize = file.size;
      const mimeType = file.type;
      
      // Send file message
      await sendMessage(`📎 ${fileName}`, false);
      
      toast({
        title: "File uploaded",
        description: `${fileName} has been shared.`,
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
      
      // Show preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviewImage(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
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

  // Handle key press for sending messages
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get user initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Render message status
  const renderMessageStatus = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-3 w-3 animate-spin text-gray-400" />;
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  // Render connection status
  const renderConnectionStatus = () => {
    const getStatusColor = () => {
      switch (connectionStatus) {
        case 'SUBSCRIBED': return 'text-green-500';
        case 'CONNECTING': return 'text-yellow-500';
        case 'CHANNEL_ERROR':
        case 'TIMED_OUT': return 'text-red-500';
        default: return 'text-gray-400';
      }
    };

    const getStatusIcon = () => {
      if (connectionStatus === 'SUBSCRIBED') {
        return <Wifi className="h-3 w-3" />;
      }
      return <WifiOff className="h-3 w-3" />;
    };

    const getStatusText = () => {
      switch (connectionStatus) {
        case 'SUBSCRIBED': return 'Connected';
        case 'CONNECTING': return 'Connecting...';
        case 'CHANNEL_ERROR': return 'Connection error';
        case 'TIMED_OUT': return 'Connection timeout';
        default: return 'Disconnected';
      }
    };

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("flex items-center gap-1 text-xs", getStatusColor())}>
              {getStatusIcon()}
              <span className="hidden sm:inline">{getStatusText()}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Real-time connection status</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!typingUsers || typingUsers.length === 0) return null;

    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500">
        <div className="flex gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span>
          {typingUsers.length === 1 
            ? `${typingUsers[0]} is typing...`
            : `${typingUsers.slice(0, -1).join(', ')} and ${typingUsers[typingUsers.length - 1]} are typing...`
          }
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Loading chat...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-[600px]">
        <CardContent className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-2 text-center">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <p className="text-sm text-gray-500">Failed to load chat</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <Card className="h-[600px] flex flex-col overflow-hidden">
        {/* Chat Header */}
        <CardHeader className="flex-shrink-0 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <CardTitle className="text-lg">Chat</CardTitle>
              </div>
              {renderConnectionStatus()}
            </div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSearch(!showSearch)}
                      className="h-8 w-8 p-0"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Search messages</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <FileText className="h-4 w-4 mr-2" />
                    Export chat
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Report issue
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Search Bar */}
          {showSearch && (
            <div className="mt-3">
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
              />
            </div>
          )}
        </CardHeader>

        <Separator />

        {/* Messages Area */}
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div ref={listRef} className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="h-8 w-8 text-gray-400" />
                  </div>
                  <h3 className="font-medium text-gray-900 mb-2">No messages yet</h3>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Start the conversation by sending a message below.
                  </p>
                </div>
              ) : (
                messages
                  .filter(msg => 
                    !searchQuery || 
                    msg.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    msg.sender?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((message, index) => {
                    const isOwn = message.sender_id === user?.id;
                    const showAvatar = index === 0 || messages[index - 1].sender_id !== message.sender_id;
                    const showName = showAvatar && !isOwn;
                    
                    return (
                      <div key={message.id} className={cn("flex gap-3", isOwn && "flex-row-reverse")}>
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {showAvatar ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={message.sender?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {getInitials(message.sender?.full_name || 'U')}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="w-8" />
                          )}
                        </div>

                        {/* Message Content */}
                        <div className={cn("flex-1 max-w-[70%]", isOwn && "flex flex-col items-end")}>
                          {/* Sender Name */}
                          {showName && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-gray-900">
                                {message.sender?.full_name}
                              </span>
                              {message.sender?.role && (
                                <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                                  {message.sender.role}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div
                            className={cn(
                              "group relative rounded-2xl px-4 py-2 max-w-full break-words",
                              isOwn
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 text-gray-900",
                              message.is_internal && "border-2 border-orange-200 bg-orange-50"
                            )}
                          >
                            {/* Reply indicator */}
                            {replyTo === message.id && (
                              <div className="text-xs opacity-75 mb-1">
                                Replying to this message
                              </div>
                            )}

                            {/* Message content */}
                            <div className="text-sm leading-relaxed">
                              {message.content}
                            </div>

                            {/* File attachment */}
                            {message.message_type === 'file' && (
                              <div className="mt-2 p-2 rounded-lg bg-black/10 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="text-xs">{message.file_name}</span>
                                <Button size="sm" variant="ghost" className="h-6 w-6 p-0 ml-auto">
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                            )}

                            {/* Message reactions */}
                            {message.reactions && message.reactions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
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
                                      "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors",
                                      reaction.users.includes(user?.id || '')
                                        ? "bg-blue-100 text-blue-700"
                                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                                    )}
                                  >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Message actions (show on hover) */}
                            <div className="absolute -top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1 bg-white rounded-full shadow-lg border p-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => setShowEmojiPicker(message.id)}
                                      >
                                        <Smile className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Add reaction</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => setReplyTo(message.id)}
                                      >
                                        <Reply className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Reply</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            </div>
                          </div>

                          {/* Message metadata */}
                          <div className={cn(
                            "flex items-center gap-2 mt-1 text-xs text-gray-500",
                            isOwn && "flex-row-reverse"
                          )}>
                            <span>
                              {new Date(message.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {isOwn && renderMessageStatus(message.status)}
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
              
              {/* Typing indicator */}
              {renderTypingIndicator()}
            </div>
          </ScrollArea>
        </CardContent>

        <Separator />

        {/* Input Area */}
        <CardContent className="flex-shrink-0 p-4">
          {/* Reply indicator */}
          {replyTo && (
            <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Reply className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Replying to message</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setReplyTo(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* File preview */}
          {selectedFile && (
            <div className="flex items-center justify-between mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
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
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewImage(null);
                }}
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {/* Attachment button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 w-10 p-0 flex-shrink-0"
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
                placeholder="Type your message..."
                onKeyPress={handleKeyPress}
                onChange={handleInputChange}
                className="pr-12 resize-none min-h-[40px] max-h-[120px]"
                disabled={isLoading}
              />
              
              {/* Emoji picker button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
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
              className="h-10 w-10 p-0 flex-shrink-0"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Quick emoji picker */}
          {showEmojiPicker === 'input' && (
            <div className="mt-2 p-2 bg-white border rounded-lg shadow-lg">
              <div className="flex flex-wrap gap-2">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      if (inputRef.current) {
                        inputRef.current.value += emoji;
                        setIsComposing(true);
                      }
                      setShowEmojiPicker(null);
                    }}
                    className="text-lg hover:bg-gray-100 rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,.pdf,.doc,.docx,.txt"
      />

      {/* Emoji picker for messages */}
      {showEmojiPicker && showEmojiPicker !== 'input' && (
        <Dialog open={!!showEmojiPicker} onOpenChange={() => setShowEmojiPicker(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Reaction</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-5 gap-2 p-4">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    addReaction(showEmojiPicker, emoji);
                    setShowEmojiPicker(null);
                  }}
                  className="text-2xl hover:bg-gray-100 rounded-lg p-3 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Image preview dialog */}
      {previewImage && (
        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Image Preview</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 
