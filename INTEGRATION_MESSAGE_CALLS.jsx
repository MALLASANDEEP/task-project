/**
 * MessageCallsHub Integration Guide
 *
 * Complete example showing how to integrate the new Message & Calls Hub component
 * into your existing application.
 */

import { useState, useEffect, useCallback } from 'react';
import MessageCallsHub from '@/components/communication/MessageCallsHub';

// Example implementation in a conversation/task page
export function ConversationPage({ conversationId, currentUserId }) {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // Messages state
  const [messages, setMessages] = useState([]);
  const [messageStatuses, setMessageStatuses] = useState({});
  const [typingLabel, setTypingLabel] = useState('');

  // Calls state
  const [calls, setCalls] = useState([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);

  // Users state
  const [users, setUsers] = useState({});

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION: Load messages and calls
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    loadMessages();
    loadCalls();
    loadUsers();
  }, [conversationId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const loadMessages = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = useCallback(async (content) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          senderId: currentUserId,
          timestamp: new Date().toISOString()
        })
      });

      const newMessage = await response.json();
      setMessages(prev => [...prev, newMessage]);

      // Update status to 'sent'
      setMessageStatuses(prev => ({
        ...prev,
        [newMessage.id]: 'sent'
      }));

      // Socket.io would handle 'delivered' and 'seen' status updates
      // socketManager.on('message:delivered', ({ messageId }) => {
      //   setMessageStatuses(prev => ({ ...prev, [messageId]: 'delivered' }));
      // });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [conversationId, currentUserId]);

  const handleTyping = useCallback((isTyping) => {
    // Emit typing event through Socket.io
    if (isTyping) {
      // socketManager.emit('typing:start', { conversationId, userId: currentUserId });
      setTypingLabel('Someone is typing...');
    } else {
      // socketManager.emit('typing:stop', { conversationId, userId: currentUserId });
      setTypingLabel('');
    }
  }, [conversationId, currentUserId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CALL HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const loadCalls = async () => {
    setIsLoadingCalls(true);
    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/calls?userId=${currentUserId}`
      );
      const data = await response.json();

      // Structure expected for calls:
      // {
      //   id: string,
      //   type: 'audio' | 'video',
      //   duration: number (seconds),
      //   timestamp: ISO string,
      //   participants: string[],
      //   initiatedBy: string,
      //   status: 'completed' | 'missed' | 'rejected',
      //   missedBy: string[] | null,
      //   rejectedBy: string | null,
      //   recordingUrl?: string,
      //   endedAt?: ISO string
      // }

      setCalls(data.calls || []);
    } catch (error) {
      console.error('Error loading calls:', error);
    } finally {
      setIsLoadingCalls(false);
    }
  };

  const handleSelectCall = useCallback((call) => {
    console.log('Selected call:', call);
    // Optionally navigate to call details or replay
  }, []);

  const handleDeleteCall = useCallback(async (callId) => {
    try {
      await fetch(`/api/calls/${callId}`, { method: 'DELETE' });
      setCalls(prev => prev.filter(c => c.id !== callId));
    } catch (error) {
      console.error('Error deleting call:', error);
    }
  }, []);

  const handleReplayCall = useCallback((call) => {
    if (call.recordingUrl) {
      // Open video player or recording viewer
      console.log('Replaying call recording:', call.recordingUrl);
      // Could open a modal with video player
    }
  }, []);

  const handleCallInitiate = useCallback((callType) => {
    // This is called from ChatBox when user clicks Phone/Video buttons
    console.log('Initiating', callType, 'call');

    // Create call object
    const newCall = {
      id: `call-${Date.now()}`,
      type: callType,
      timestamp: new Date().toISOString(),
      participants: [currentUserId], // Will be populated with remote participant
      status: 'ringing',
      duration: 0
    };

    // You would typically emit this through Socket.io to start an actual call
    // socketManager.emit('call:initiate', { callType, conversationId, participants: [...] });

    console.log('Call initiated:', newCall);
  }, [conversationId, currentUserId]);

  const loadUsers = async () => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/users`);
      const data = await response.json();
      const usersMap = {};
      data.users?.forEach(user => {
        usersMap[user.id] = user;
      });
      setUsers(usersMap);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b border-border/50 px-6 py-4">
        <h1 className="text-2xl font-bold">Conversation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Messages & Call History
        </p>
      </header>

      <main className="flex-1 overflow-hidden px-6 py-4">
        <MessageCallsHub
          // Chat props
          messages={messages}
          currentUserId={currentUserId}
          users={users}
          disabled={false}
          typingLabel={typingLabel}
          onSendMessage={handleSendMessage}
          onTyping={handleTyping}
          onCallInitiate={handleCallInitiate}
          messageStatuses={messageStatuses}

          // Calls props
          calls={calls}
          onSelectCall={handleSelectCall}
          onDeleteCall={handleDeleteCall}
          onReplayCall={handleReplayCall}
          isLoadingCalls={isLoadingCalls}

          // Container props
          defaultTab="messages"
          className="max-w-4xl mx-auto"
        />
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EXPECTED API ENDPOINTS
// ═════════════════════════════════════════════════════════════════════════════

/*
GET /api/conversations/{conversationId}/messages
  Returns: { messages: Message[] }
  Message structure:
    {
      id: string,
      content: string,
      senderId: string,
      timestamp: ISO string,
      status: 'sent' | 'delivered' | 'seen'
    }

POST /api/conversations/{conversationId}/messages
  Body: { content: string, senderId: string, timestamp: ISO string }
  Returns: Message

GET /api/conversations/{conversationId}/calls
  Query: userId=<currentUserId>
  Returns: { calls: Call[] }
  Call structure:
    {
      id: string,
      type: 'audio' | 'video',
      duration: number,
      timestamp: ISO string,
      participants: string[],
      initiatedBy: string,
      status: 'completed' | 'missed' | 'rejected',
      missedBy: string[] | null,
      rejectedBy: string | null,
      recordingUrl: string | null,
      endedAt: ISO string | null
    }

DELETE /api/calls/{callId}
  Deletes a call from history

GET /api/conversations/{conversationId}/users
  Returns: { users: User[] }
  User structure:
    {
      id: string,
      name: string,
      avatar?: string,
      status?: 'online' | 'away' | 'offline'
    }
*/

// ═════════════════════════════════════════════════════════════════════════════
// SOCKET.IO EVENTS (OPTIONAL)
// ═════════════════════════════════════════════════════════════════════════════

/*
// Emit events (client → server)
socketManager.emit('message:send', { conversationId, content, senderId });
socketManager.emit('typing:start', { conversationId, userId });
socketManager.emit('typing:stop', { conversationId, userId });
socketManager.emit('call:initiate', { conversationId, callType, participants });
socketManager.emit('call:accept', { callId, userId });
socketManager.emit('call:reject', { callId, userId });
socketManager.emit('call:end', { callId, userId });

// Listen for events (server → client)
socketManager.on('message:received', ({ message }) => {
  setMessages(prev => [...prev, message]);
});

socketManager.on('message:delivered', ({ messageId }) => {
  setMessageStatuses(prev => ({ ...prev, [messageId]: 'delivered' }));
});

socketManager.on('message:seen', ({ messageId }) => {
  setMessageStatuses(prev => ({ ...prev, [messageId]: 'seen' }));
});

socketManager.on('typing:started', ({ userId }) => {
  setTypingLabel(`${users[userId]?.name} is typing...`);
});

socketManager.on('typing:stopped', ({ userId }) => {
  setTypingLabel('');
});

socketManager.on('call:incoming', ({ call }) => {
  // Show incoming call popup
});

socketManager.on('call:started', ({ call }) => {
  setCalls(prev => [...prev, call]);
});

socketManager.on('call:ended', ({ callId }) => {
  setCalls(prev =>
    prev.map(c => c.id === callId ? { ...c, status: 'completed' } : c)
  );
});
*/

export default ConversationPage;
