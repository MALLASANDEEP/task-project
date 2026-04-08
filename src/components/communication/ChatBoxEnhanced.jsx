/**
 * Enhanced Real-time ChatBox Component
 * WhatsApp-like messaging with real-time sync, status indicators, and optimized rendering
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Paperclip, MoreVertical, Phone, Video, Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import './ChatBox.css'; // Custom styles for animations

export function ChatBoxEnhanced({
  messages = [],
  currentUserId,
  users = {},
  disabled = false,
  typingLabel,
  onSend,
  onTyping,
  onCallInitiate,
  messageStatuses = {}, // { messageId: 'sent' | 'delivered' | 'seen' }
}) {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [optimisticMessages, setOptimisticMessages] = useState([]);

  // ──────────────────────────────────────────────────────────────
  // Auto-scroll to latest message with smooth animation
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        const scrollElement = scrollRef.current;
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
      });
    }
  }, [messages, optimisticMessages]);

  // ──────────────────────────────────────────────────────────────
  // Debounced Typing Indicator
  // ──────────────────────────────────────────────────────────────

  const handleInputChange = useCallback((e) => {
    const value = e.target.value;
    setInputValue(value);

    // Debounce typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.length > 0 && !isTyping) {
      setIsTyping(true);
      onTyping?.(true);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      onTyping?.(false);
    }, 2000);
  }, [isTyping, onTyping]);

  // ──────────────────────────────────────────────────────────────
  // Send Message with Optimistic UI Update
  // ──────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || disabled) return;

    const messageContent = inputValue.trim();
    const messageId = `opt-${Date.now()}-${Math.random()}`;

    // Add optimistic message
    setOptimisticMessages((prev) => [
      ...prev,
      {
        id: messageId,
        content: messageContent,
        senderId: currentUserId,
        timestamp: new Date().toISOString(),
        status: 'sending',
        optimistic: true,
      },
    ]);

    setInputValue('');
    setIsTyping(false);
    onTyping?.(false);

    try {
      // Send through Socket.io
      await onSend?.(messageContent);

      // Update optimistic message to sent
      setOptimisticMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, status: 'sent' } : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Failed to send message', variant: 'destructive' });

      // Remove optimistic message on error
      setOptimisticMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    }
  }, [inputValue, disabled, currentUserId, onSend, onTyping, toast]);

  // ──────────────────────────────────────────────────────────────
  // Merged messages with optimistic state (sorted by time)
  // ──────────────────────────────────────────────────────────────

  const mergedMessages = useMemo(() => {
    const allMessages = [...messages, ...optimisticMessages];
    return allMessages.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );
  }, [messages, optimisticMessages]);

  // ──────────────────────────────────────────────────────────────
  // Message Status Indicator
  // ──────────────────────────────────────────────────────────────

  const MessageStatusIcon = ({ messageId, status, senderIsMe }) => {
    if (!senderIsMe) return null;

    const statusMap = {
      'sending': { icon: 'clock', color: 'text-gray-400' },
      'sent': { icon: 'check', color: 'text-gray-400' },
      'delivered': { icon: 'check-check', color: 'text-gray-400' },
      'seen': { icon: 'check-check', color: 'text-blue-500' },
    };

    const stat = statusMap[status] || statusMap['sent'];

    if (stat.icon === 'check-check') {
      return <CheckCheck className={cn('h-4 w-4', stat.color)} />;
    }
    return <Check className={cn('h-4 w-4', stat.color)} />;
  };

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 p-4 flex items-center justify-between bg-muted/30">
        <div className="flex-1">
          <h2 className="font-semibold">Chat</h2>
          {typingLabel && <p className="text-xs text-muted-foreground italic">{typingLabel}</p>}
        </div>
        {onCallInitiate && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onCallInitiate('audio')}
              className="rounded-full"
            >
              <Phone className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onCallInitiate('video')}
              className="rounded-full"
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4 space-y-3">
        {mergedMessages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-muted-foreground">
            <div>
              <MessageCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Start a conversation</p>
            </div>
          </div>
        ) : (
          mergedMessages.map((message) => {
            const senderIsMe = message.senderId === currentUserId;
            const sender = users[message.senderId];
            const status = messageStatuses[message.id] || message.status;

            return (
              <div
                key={message.id}
                className={cn(
                  'flex gap-2 animate-message-in',
                  senderIsMe ? 'justify-end' : 'justify-start'
                )}
              >
                {!senderIsMe && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
                    {sender?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}

                <div className={cn('max-w-[70%] group')}>
                  {/* Sender name for group chats */}
                  {!senderIsMe && (
                    <p className="text-xs text-muted-foreground mb-1">{sender?.name || 'Unknown'}</p>
                  )}

                  {/* Message bubble */}
                  <div
                    className={cn(
                      'rounded-2xl px-4 py-2 break-words transition-all',
                      senderIsMe
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-muted-foreground rounded-bl-none',
                      message.optimistic && 'opacity-70'
                    )}
                  >
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>

                  {/* Timestamp and status */}
                  <div className="flex gap-1 items-center mt-1 px-2 text-[11px] text-muted-foreground">
                    <span>
                      {new Date(message.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {senderIsMe && (
                      <MessageStatusIcon
                        messageId={message.id}
                        status={status}
                        senderIsMe={true}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border/50 p-3 bg-muted/20 flex gap-2">
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          className="rounded-full"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Input
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message..."
          disabled={disabled}
          className="rounded-full"
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!inputValue.trim() || disabled}
          className="rounded-full"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default ChatBoxEnhanced;
