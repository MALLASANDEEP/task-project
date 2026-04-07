import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageBubble } from '@/components/communication/MessageBubble';
import { Paperclip, Send } from 'lucide-react';
export function ChatBox({ messages, currentUserId, users, disabled, typingLabel, onSend, onTyping, }) {
    const [draft, setDraft] = useState('');
    const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users]);
    const handleSend = async () => {
        const text = draft.trim();
        if (!text || disabled)
            return;
        await onSend(text);
        setDraft('');
        onTyping?.(false);
    };
    return (<div className="flex h-full flex-col rounded-2xl border border-border/70 bg-card/75">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (<MessageBubble key={message.id} message={message} isOwn={message.senderId === currentUserId} sender={usersById[message.senderId]}/>))}
        {messages.length === 0 && (<div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation.
          </div>)}
      </div>

      <div className="border-t border-border/70 p-3">
        {typingLabel ? <p className="mb-2 text-xs text-muted-foreground">{typingLabel}</p> : null}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-xl" disabled={disabled}>
            <Paperclip className="h-4 w-4"/>
          </Button>
          <Input value={draft} onChange={(event) => {
            setDraft(event.target.value);
            onTyping?.(event.target.value.trim().length > 0);
        }} onKeyDown={(event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                handleSend();
            }
        }} placeholder={disabled ? 'Messaging disabled for your role' : 'Type a message... Use @username to mention'} className="h-11 rounded-xl" disabled={disabled}/>
          <Button className="rounded-xl" onClick={handleSend} disabled={disabled || !draft.trim()}>
            <Send className="mr-1 h-4 w-4"/> Send
          </Button>
        </div>
      </div>
    </div>);
}

