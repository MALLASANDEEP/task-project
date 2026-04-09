/**
 * WORKING EXAMPLE: How to use MessageCallsHub
 * Copy this code into your page component
 */

import { useState, useEffect } from 'react';
import MessageCallsHub from '@/components/communication/MessageCallsHub';

export function YourChatPage() {
  // ───────────────────────────────────────────────────────
  // STATE
  // ───────────────────────────────────────────────────────

  const [messages, setMessages] = useState([
    {
      id: '1',
      content: 'Hey! How are you?',
      senderId: 'user1',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'seen'
    },
    {
      id: '2',
      content: 'I am good, thanks! How about you?',
      senderId: 'currentUser',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'delivered'
    },
    {
      id: '3',
      content: 'Great! Want to catch up on a call?',
      senderId: 'user1',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      status: 'sent'
    }
  ]);

  const [calls, setCalls] = useState([
    {
      id: 'call1',
      type: 'video',
      duration: 1205,
      timestamp: new Date(Date.now() - 86400000).toISOString(),
      participants: ['currentUser', 'user1'],
      initiatedBy: 'currentUser',
      status: 'completed'
    },
    {
      id: 'call2',
      type: 'audio',
      duration: 0,
      timestamp: new Date(Date.now() - 172800000).toISOString(),
      participants: ['currentUser', 'user1'],
      initiatedBy: 'user1',
      status: 'missed',
      missedBy: ['currentUser']
    }
  ]);

  const [users] = useState({
    'currentUser': { id: 'currentUser', name: 'You' },
    'user1': { id: 'user1', name: 'Alice Johnson' }
  });

  const currentUserId = 'currentUser';

  // ───────────────────────────────────────────────────────
  // MESSAGE HANDLERS
  // ───────────────────────────────────────────────────────

  const handleSendMessage = async (content) => {
    try {
      // Create new message
      const newMessage = {
        id: `msg-${Date.now()}`,
        content,
        senderId: currentUserId,
        timestamp: new Date().toISOString(),
        status: 'sent'
      };

      // Add to your messages
      setMessages(prev => [...prev, newMessage]);

      // HERE: Send to your API
      // const response = await fetch('/api/messages', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     conversationId: 'some-id',
      //     ...newMessage
      //   })
      // });

      console.log('Message sent:', newMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const handleTyping = (isTyping) => {
    console.log('User is typing:', isTyping);
    // HERE: Emit Socket.io event if you have it
    // socket.emit('typing', { isTyping, conversationId: 'some-id' });
  };

  // ───────────────────────────────────────────────────────
  // CALL HANDLERS
  // ───────────────────────────────────────────────────────

  const handleSelectCall = (call) => {
    console.log('Selected call:', call);
    // HERE: Show call details or replay modal
  };

  const handleDeleteCall = async (callId) => {
    try {
      // Remove from local state
      setCalls(prev => prev.filter(c => c.id !== callId));

      // HERE: Delete from your API
      // await fetch(`/api/calls/${callId}`, { method: 'DELETE' });

      console.log('Call deleted:', callId);
    } catch (error) {
      console.error('Error deleting call:', error);
    }
  };

  const handleReplayCall = (call) => {
    console.log('Replaying call:', call);
    // HERE: Open video player or recording viewer
  };

  const handleCallInitiate = (callType) => {
    console.log('Initiating', callType, 'call');
    // HERE: Start actual call with WebRTC/Socket.io
  };

  // ───────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4 bg-muted/30">
        <h1 className="text-2xl font-bold">Chat & Calls</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Messages and call history in one place
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden px-6 py-4">
        <div className="max-w-2xl mx-auto h-full">
          <MessageCallsHub
            // Messages props
            messages={messages}
            currentUserId={currentUserId}
            users={users}
            disabled={false}
            typingLabel="" // "Alice is typing..."
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            onCallInitiate={handleCallInitiate}
            messageStatuses={{}} // { 'msg-1': 'delivered' }

            // Calls props
            calls={calls}
            onSelectCall={handleSelectCall}
            onDeleteCall={handleDeleteCall}
            onReplayCall={handleReplayCall}
            isLoadingCalls={false}

            // Container
            defaultTab="messages"
            className="h-full"
          />
        </div>
      </main>
    </div>
  );
}

export default YourChatPage;
