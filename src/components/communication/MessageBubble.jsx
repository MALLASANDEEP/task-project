import { cn } from '@/lib/utils';
import { Check, CheckCheck, ChevronDown } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
export function MessageBubble({ message, isOwn, sender, canDelete = false, onDelete, canSelect = false, isSelected = false, onSelectMessage, }) {
    const seenByOthers = Boolean(message?.seenBy?.some((userId) => userId !== message.senderId));
const normalizedStatus = message.seen_at
  ? "seen"
  : message.delivered_at
  ? "delivered"
  : "sent";
    const receiptIcon = normalizedStatus === 'seen'
        ? <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label="Seen"/>
        : normalizedStatus === 'delivered'
            ? <CheckCheck className="h-3.5 w-3.5" aria-label="Delivered"/>
            : <Check className="h-3.5 w-3.5" aria-label="Sent"/>;
    const wrapperClassName = cn('group flex w-full gap-2', isOwn ? 'justify-end' : 'justify-start');
    const canShowActions = Boolean(canSelect || (canDelete && onDelete));
    const actionMenu = (<>
      {canSelect && (<ContextMenuItem onSelect={() => onSelectMessage?.(message.id)}>
          {isSelected ? 'Unselect message' : 'Select message'}
        </ContextMenuItem>)}
      <ContextMenuItem onSelect={() => navigator.clipboard?.writeText(message.content || '')}>
        Copy message
      </ContextMenuItem>
      {canDelete && onDelete && (<ContextMenuItem onSelect={() => onDelete(message)} className="text-destructive focus:text-destructive">
          Delete message
        </ContextMenuItem>)}
    </>);
    const bubble = (<>
      {!isOwn && (<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#233138] text-[11px] font-semibold text-[#d1d7db]">
          {(sender?.name || 'U').slice(0, 2).toUpperCase()}
        </div>)}
      <div className={cn('group relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm border', isSelected && 'ring-1 ring-[#00a884] ring-offset-1 ring-offset-[#0b141a]', isOwn
            ? 'bg-[#005c4b] text-[#e9edef] border-[#005c4b] rounded-br-md'
            : 'bg-[#202c33] text-[#e9edef] border-[#2a3942] rounded-bl-md')}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="absolute right-1 top-1 hidden rounded p-0.5 text-[#9fb0bb] opacity-0 transition hover:bg-black/20 group-hover:opacity-100 focus:opacity-100 md:inline-flex" aria-label="Message actions">
              <ChevronDown className="h-3.5 w-3.5"/>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? 'end' : 'start'} className="border-[#2a3942] bg-[#111b21] text-[#e9edef]">
            {canSelect && (<DropdownMenuItem onClick={() => onSelectMessage?.(message.id)}>
                {isSelected ? 'Unselect message' : 'Select message'}
              </DropdownMenuItem>)}
            <DropdownMenuItem onClick={() => navigator.clipboard?.writeText(message.content || '')}>
              Copy message
            </DropdownMenuItem>
            {canDelete && onDelete && (<DropdownMenuItem onClick={() => onDelete(message)} className="text-destructive focus:text-destructive">
                Delete message
              </DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        {!isOwn && <p className="mb-1 text-[11px] font-medium text-[#53bdeb]">{sender?.name || 'Unknown'}</p>}
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        <div className="mt-1 flex items-center justify-end gap-2 text-[10px] text-[#9fb0bb]">
          <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {isOwn && <span title={normalizedStatus} className="inline-flex items-center">{receiptIcon}</span>}
        </div>
      </div>
    </>);
    if (!canShowActions) {
        return <div className={wrapperClassName}>{bubble}</div>;
    }
    return (<ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={wrapperClassName}>{bubble}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {actionMenu}
      </ContextMenuContent>
    </ContextMenu>);
}

