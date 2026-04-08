import { cn } from '@/lib/utils';
import { Check, CheckCheck } from 'lucide-react';
export function MessageBubble({ message, isOwn, sender, }) {
    const seenByOthers = Boolean(message?.seenBy?.some((userId) => userId !== message.senderId));
    const normalizedStatus = seenByOthers ? 'seen' : (message.status || 'sent');
    const receiptIcon = normalizedStatus === 'seen'
        ? <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label="Seen"/>
        : normalizedStatus === 'delivered'
            ? <CheckCheck className="h-3.5 w-3.5" aria-label="Delivered"/>
            : <Check className="h-3.5 w-3.5" aria-label="Sent"/>;
    return (<div className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[78%] rounded-2xl px-3 py-2 shadow-sm border', isOwn
            ? 'bg-primary text-primary-foreground border-primary/20 rounded-br-md'
            : 'bg-card text-card-foreground border-border/70 rounded-bl-md')}>
        {!isOwn && <p className="text-[11px] font-medium opacity-80 mb-1">{sender?.name || 'Unknown'}</p>}
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-75">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isOwn && <span title={normalizedStatus} className="inline-flex items-center">{receiptIcon}</span>}
        </div>
      </div>
    </div>);
}

