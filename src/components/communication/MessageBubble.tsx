import { ChatMessage, User } from '@/types';
import { cn } from '@/lib/utils';

export function MessageBubble({
  message,
  isOwn,
  sender,
}: {
  message: ChatMessage;
  isOwn: boolean;
  sender?: User;
}) {
  return (
    <div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3 py-2 shadow-sm border',
          isOwn
            ? 'bg-primary text-primary-foreground border-primary/20 rounded-br-md'
            : 'bg-card text-card-foreground border-border/70 rounded-bl-md',
        )}
      >
        {!isOwn && <p className="text-[11px] font-medium opacity-80 mb-1">{sender?.name || 'Unknown'}</p>}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-75">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isOwn && <span className="uppercase tracking-wide">{message.status}</span>}
        </div>
      </div>
    </div>
  );
}
