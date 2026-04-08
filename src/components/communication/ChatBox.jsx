import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageBubble } from '@/components/communication/MessageBubble';
import { Paperclip, Send } from 'lucide-react';
export function ChatBox({ messages, currentUserId, users, disabled, typingLabel, onSend, onTyping, canDeleteMessage, onDeleteMessage, }) {
    const [draft, setDraft] = useState('');
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const endRef = useRef(null);
    const usersById = useMemo(() => Object.fromEntries(users.map((user) => [user.id, user])), [users]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);
    const handleSend = async () => {
        const text = draft.trim();
        if (!text || disabled)
            return;
      try {
        await onSend(text);
        setDraft('');
        onTyping?.(false);
      }
      catch {
        // Error feedback is handled by page-level toast
      }
    };
  const toggleSelectMessage = (messageId) => {
    setSelectedMessageIds((prev) => prev.includes(messageId) ? prev.filter((id) => id !== messageId) : [...prev, messageId]);
  };
  const handleDeleteSelected = async () => {
    const selectedMessages = messages.filter((message) => selectedMessageIds.includes(message.id));
    for (const message of selectedMessages) {
      if (canDeleteMessage?.(message)) {
        await onDeleteMessage?.(message);
      }
    }
    setSelectedMessageIds([]);
  };
    return (<div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[#2a3942] bg-[#111b21] shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#0b141a] p-4" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.035) 1px, transparent 0)', backgroundSize: '22px 22px' }}>
        {messages.map((message) => (<MessageBubble key={message.id} message={message} isOwn={message.senderId === currentUserId} sender={usersById[message.senderId]} canDelete={Boolean(canDeleteMessage?.(message))} onDelete={onDeleteMessage} canSelect isSelected={selectedMessageIds.includes(message.id)} onSelectMessage={toggleSelectMessage}/>))}
        <div ref={endRef}/>
        {messages.length === 0 && (<div className="rounded-xl border border-dashed border-[#2a3942] bg-[#111b21]/80 p-8 text-center text-sm text-[#8696a0]">
            No messages yet. Start the conversation.
          </div>)}
      </div>

      <div className="border-t border-[#2a3942] bg-[#202c33] p-3">
        {selectedMessageIds.length > 0 && (<div className="mb-2 flex items-center justify-between rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-xs text-[#9fb0bb]">
            <span>{selectedMessageIds.length} selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 rounded-lg border-[#2a3942] bg-[#1a252c] text-[#e9edef]" onClick={() => setSelectedMessageIds([])}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" className="h-7 rounded-lg" onClick={handleDeleteSelected}>
                Delete selected
              </Button>
            </div>
          </div>)}
        {typingLabel ? <p className="mb-2 text-xs text-[#8696a0]">{typingLabel}</p> : null}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-xl border-[#2a3942] bg-[#111b21] text-[#d1d7db] hover:bg-[#182229]" disabled={disabled}>
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
        }} placeholder={disabled ? 'Messaging disabled for your role' : 'Type a message... Use @username to mention'} className="h-11 rounded-xl border-[#2a3942] bg-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0]" disabled={disabled}/>
          <Button className="rounded-xl bg-[#00a884] text-white hover:bg-[#019b79]" onClick={handleSend} disabled={disabled || !draft.trim()}>
            <Send className="mr-1 h-4 w-4"/> Send
          </Button>
        </div>
      </div>
    </div>);
}

