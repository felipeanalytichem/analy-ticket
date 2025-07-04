import { useState, useRef } from 'react';
import { MessageCircle, Paperclip, Smile, Image, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface TicketChatProps {
  ticketId: string;
  className?: string;
}

export function TicketChat({ ticketId, className }: TicketChatProps) {
  const [message, setMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFiles = (files: File[]) => {
    // TODO: Implement file upload
    console.log('Files to upload:', files);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((file): file is File => file !== null);
    
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Chat Messages Area */}
      <div className="min-h-[400px] rounded-lg bg-zinc-950/50 p-4 flex flex-col items-center justify-center">
        <div className="text-center space-y-2">
          <MessageCircle className="h-12 w-12 text-zinc-500 mx-auto" />
          <h3 className="text-lg font-medium text-zinc-300">Start the conversation</h3>
          <p className="text-sm text-zinc-500 max-w-sm">
            Send a message to begin chatting. You can also:
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Paperclip className="h-4 w-4" />
              Attach files
            </span>
            <span className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              Drop images
            </span>
            <span className="flex items-center gap-1">
              <Smile className="h-4 w-4" />
              Add emoji
            </span>
          </div>
        </div>
      </div>

      {/* Message Input */}
      <div
        className={cn(
          'rounded-lg border border-zinc-800 bg-zinc-950/50 p-4',
          isDragging && 'border-blue-500 bg-blue-500/10'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Textarea
          placeholder="Type your message... (Shift + Enter for new line)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              // TODO: Send message
            }
          }}
          className="min-h-[100px] bg-transparent border-0 resize-none focus-visible:ring-0 p-0 placeholder:text-zinc-600"
        />
        <div className="flex items-center justify-between mt-4 gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-400"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-400"
            >
              <Smile className="h-4 w-4" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              onChange={(e) => handleFiles(Array.from(e.target.files || []))}
            />
          </div>
          <Button
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!message.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
} 