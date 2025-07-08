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
  Smile, 
  Search,
  MoreVertical,
  Download,
  Reply,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  FileText,
  X
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

interface TicketChatProps {
  ticketId: string;
  className?: string;
}

interface MessageWithStatus {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type?: 'text' | 'file' | 'image';
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
  }>;
}

const EMOJI_LIST = ['👍', '👎', '❤️', '😊', '😂', '😮', '😢', '😡', '🎉', '🚀'];

export function TicketChat({ ticketId, className }: TicketChatProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { messages: rawMessages, sendMessage, isLoading, error } = useChat(ticketId);
  
  // Enhanced state
  const [messages, setMessages] = useState<MessageWithStatus[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Convert raw messages to enhanced format
  useEffect(() => {
    const enhancedMessages: MessageWithStatus[] = rawMessages.map(msg => ({
      ...msg,
      content: (msg as any).content ?? (msg as any).message ?? '',
      status: 'sent',
      reactions: [],
    }));
    setMessages(enhancedMessages);
  }, [rawMessages]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (!user?.id) return;

    setIsTyping(true);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 3000);
  }, [user]);

  // Send message with enhanced features
  const handleSend = async () => {
    const value = inputRef.current?.value.trim();
    if (!value && !selectedFile) return;

    try {
      if (selectedFile) {
        // Handle file upload
        await handleFileUpload(selectedFile);
        setSelectedFile(null);
      } else if (value) {
        // Send text message
        await sendMessage(value, false);
        if (inputRef.current) inputRef.current.value = '';
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
        title: "File type not allowed",
        description: "Please upload a supported file type.",
        variant: "destructive",
      });
      return;
    }

    try {
      // For now, just send the file name as a message
      // In a real implementation, you would upload to storage first
      await sendMessage(`📎 ${file.name} (${formatFileSize(file.size)})`, false);
      
      toast({
        title: "File uploaded",
        description: `${file.name} has been shared in the chat.`,
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
  const addReaction = (messageId: string, emoji: string) => {
    if (!user?.id) return;

    setMessages(prev => 
      prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || [];
          const existingReaction = reactions.find(r => r.emoji === emoji);
          
          if (existingReaction) {
            // Toggle user's reaction
            const userIndex = existingReaction.users.indexOf(user.id);
            if (userIndex > -1) {
              existingReaction.users.splice(userIndex, 1);
              if (existingReaction.users.length === 0) {
                return {
                  ...msg,
                  reactions: reactions.filter(r => r.emoji !== emoji)
                };
              }
            } else {
              existingReaction.users.push(user.id);
            }
          } else {
            // Add new reaction
            reactions.push({
              emoji,
              users: [user.id]
            });
          }
          
          return { ...msg, reactions };
        }
        return msg;
      })
    );
    
    setShowEmojiPicker(null);
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get user initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Render message status icon
  const renderMessageStatus = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Clock className="h-3 w-3 text-gray-400" />;
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

  // Filter messages based on search
  const filteredMessages = searchQuery 
    ? messages.filter(msg => 
        msg.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  return (
    <Card className={cn("flex flex-col h-[600px]", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            💬 {t('chat.tab')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setShowSearch(true)}>
                  <Search className="h-4 w-4 mr-2" />
                  Search Messages
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {showSearch && (
          <div className="mt-2">
            <Input
                              placeholder={t('chat.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={listRef}>
          {isLoading && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">{t('chat.loading')}</p>
            </div>
          )}
          
          {error && (
            <div className="text-center py-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {!isLoading && filteredMessages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No messages found' : t('chat.noMessages')}
              </p>
            </div>
          )}

          <div className="space-y-4 py-4">
            {filteredMessages.map((msg, index) => {
              const isMine = msg.sender_id === user?.id;
              const showAvatar = !isMine && (
                index === 0 || 
                filteredMessages[index - 1]?.sender_id !== msg.sender_id
              );
              const isFile = msg.message_type === 'file' || msg.content.startsWith('📎');

              return (
                <div key={msg.id} className={cn(
                  "flex gap-3 group",
                  isMine ? "justify-end" : "justify-start"
                )}>
                  {!isMine && (
                    <div className="flex-shrink-0">
                      {showAvatar ? (
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={msg.sender?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {getInitials(msg.sender?.full_name || msg.sender?.email || 'U')}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-8 w-8" />
                      )}
                    </div>
                  )}

                  <div className={cn(
                    "flex flex-col max-w-[70%]",
                    isMine ? "items-end" : "items-start"
                  )}>
                    {!isMine && showAvatar && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {msg.sender?.full_name || msg.sender?.email}
                        </span>
                        {msg.sender?.role && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            {msg.sender.role}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className={cn(
                      "rounded-lg px-3 py-2 relative group",
                      isMine 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted",
                      isFile && "border border-border"
                    )}>
                      {isFile ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">{msg.content}</span>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      )}

                      {/* Message actions */}
                      <div className="absolute -top-8 right-0 hidden group-hover:flex bg-background border rounded shadow-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowEmojiPicker(msg.id)}
                        >
                          <Smile className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setReplyTo(msg.id)}
                        >
                          <Reply className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msg.reactions.map((reaction) => (
                          <Button
                            key={reaction.emoji}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => addReaction(msg.id, reaction.emoji)}
                          >
                            {reaction.emoji} {reaction.users.length}
                          </Button>
                        ))}
                      </div>
                    )}

                    {/* Message metadata */}
                    <div className={cn(
                      "flex items-center gap-1 mt-1",
                      isMine ? "flex-row-reverse" : "flex-row"
                    )}>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                      {isMine && renderMessageStatus(msg.status)}
                      {msg.is_internal && (
                        <Badge variant="secondary" className="text-xs">
                          Internal
                        </Badge>
                      )}
                    </div>
                  </div>

                  {isMine && (
                    <div className="flex-shrink-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {getInitials(user?.user_metadata?.full_name || user?.email || 'You')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Typing indicators */}
          {typingUsers.length > 0 && (
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span>
                  {typingUsers.length === 1 
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.length} people are typing...`
                  }
                </span>
              </div>
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Input area */}
        <div className="p-4 space-y-3">
          {/* Reply indicator */}
          {replyTo && (
            <div className="flex items-center justify-between bg-muted rounded p-2">
              <div className="flex items-center gap-2 text-sm">
                <Reply className="h-4 w-4" />
                <span>Replying to message</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyTo(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* File preview */}
          {selectedFile && (
            <div className="flex items-center justify-between bg-muted rounded p-2">
              <div className="flex items-center gap-2 text-sm">
                <Paperclip className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span className="text-muted-foreground">
                  ({formatFileSize(selectedFile.size)})
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewImage(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                title="Attach image"
              >
                <Image className="h-4 w-4" />
              </Button>
            </div>
            
            <Input
              ref={inputRef}
              placeholder={t('chat.typeMessage')}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                } else {
                  handleTyping();
                }
              }}
              disabled={isLoading}
            />
            
            <Button onClick={handleSend} disabled={isLoading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </CardContent>

      {/* Emoji picker dialog */}
      <Dialog open={!!showEmojiPicker} onOpenChange={() => setShowEmojiPicker(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Reaction</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2">
            {EMOJI_LIST.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                className="h-12 w-12 text-2xl"
                onClick={() => showEmojiPicker && addReaction(showEmojiPicker, emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview dialog */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="space-y-4">
              <img 
                src={previewImage} 
                alt="Preview" 
                className="w-full h-auto rounded-lg"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreviewImage(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSend}>
                  Send Image
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
} 