/**
 * Socket.io Client Manager
 * Handles all real-time communication with the backend
 * Production-grade connection management with reconnection logic
 */

import { io } from 'socket.io-client';

class SocketManager {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.eventListeners = new Map();
  }

  /**
   * Initialize and connect to Socket.io server
   * @param {string} serverUrl - Socket server URL
   * @param {string} userId - Current user ID
   * @param {Array} conversationIds - Conversation IDs to join
   */
  connect(serverUrl, userId, conversationIds = []) {
    if (this.socket?.connected) {
      console.log('✓ Already connected to Socket server');
      this.socket.emit('user:authenticate', userId, conversationIds);
      return;
    }

    console.log(`🔗 Connecting to Socket server: ${serverUrl}`);

    this.socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    // ────────────────────────────────────────────────────────
    // Connection Events
    // ────────────────────────────────────────────────────────

    this.socket.on('connect', () => {
      console.log(`✓ Socket.io connected: ${this.socket.id}`);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Authenticate user
      this.socket.emit('user:authenticate', userId, conversationIds);
      this.emit('connection:established', { userId, socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`✗ Socket.io disconnected: ${reason}`);
      this.isConnected = false;
      this.emit('connection:lost', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.emit('connection:error', error);
    });

    this.socket.on('reconnect_attempt', () => {
      this.reconnectAttempts++;
      console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.emit('connection:reconnecting', { attempt: this.reconnectAttempts });
    });

    // ────────────────────────────────────────────────────────
    // Presence Events
    // ────────────────────────────────────────────────────────

    this.socket.on('user:online', (data) => {
      console.log(`👤 User online: ${data.userId}`);
      this.emit('user:online', data);
    });

    this.socket.on('user:offline', (data) => {
      console.log(`👤 User offline: ${data.userId}`);
      this.emit('user:offline', data);
    });

    // ────────────────────────────────────────────────────────
    // Message Events
    // ────────────────────────────────────────────────────────

    this.socket.on('message:new', (message) => {
      console.log(`📨 New message: ${message.messageId}`);
      this.emit('message:new', message);
    });

    this.socket.on('message:sent', (data) => {
      console.log(`✓ Message sent: ${data.messageId}`);
      this.emit('message:sent', data);
    });

    this.socket.on('message:delivered', (message) => {
      console.log(`📦 Message delivered: ${message.messageId}`);
      this.emit('message:delivered', message);
    });

    this.socket.on('message:seen', (data) => {
      console.log(`👁️ Messages seen in ${data.conversationId}`);
      this.emit('message:seen', data);
    });

    this.socket.on('typing:update', (data) => {
      this.emit('typing:update', data);
    });

    // ────────────────────────────────────────────────────────
    // Call Events
    // ────────────────────────────────────────────────────────

    this.socket.on('call:ringing', (data) => {
      console.log(`📞 Incoming call: ${data.callId}`);
      this.emit('call:ringing', data);
    });

    this.socket.on('call:accepted', (data) => {
      console.log(`✓ Call accepted: ${data.callId}`);
      this.emit('call:accepted', data);
    });

    this.socket.on('call:rejected', (data) => {
      console.log(`✗ Call rejected: ${data.callId}`);
      this.emit('call:rejected', data);
    });

    this.socket.on('call:start', (data) => {
      console.log(`🎬 Call started: ${data.callId}`);
      this.emit('call:start', data);
    });

    this.socket.on('call:ended', (data) => {
      console.log(`✗ Call ended: ${data.callId}`);
      this.emit('call:ended', data);
    });

    // ────────────────────────────────────────────────────────
    // WebRTC Signaling
    // ────────────────────────────────────────────────────────

    this.socket.on('webrtc:offer', (data) => {
      this.emit('webrtc:offer', data);
    });

    this.socket.on('webrtc:answer', (data) => {
      this.emit('webrtc:answer', data);
    });

    this.socket.on('webrtc:ice-candidate', (data) => {
      this.emit('webrtc:ice-candidate', data);
    });

    this.socket.on('webrtc:connection-state', (data) => {
      this.emit('webrtc:connection-state', data);
    });

    // ────────────────────────────────────────────────────────
    // Error Handling
    // ────────────────────────────────────────────────────────

    this.socket.on('error', (error) => {
      console.error('❌ Socket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Disconnect from Socket server
   */
  disconnect() {
    if (this.socket) {
      console.log('🔌 Disconnecting from Socket server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // MESSAGING METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send a message
   */
  sendMessage(conversationId, messageId, senderId, content) {
    if (!this.isConnected) {
      console.error('❌ Not connected to Socket server');
      return;
    }

    console.log(`📤 Sending message: ${messageId}`);
    this.socket.emit('message:send', {
      conversationId,
      messageId,
      senderId,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Mark messages as seen
   */
  markMessagesSeen(conversationId, messageIds, userId) {
    if (!this.isConnected) return;

    this.socket.emit('message:seen', {
      conversationId,
      messageIds,
      userId,
    });
  }

  /**
   * Emit typing indicator
   */
  setTypingIndicator(conversationId, userId, isTyping) {
    if (!this.isConnected) return;

    if (isTyping) {
      this.socket.emit('typing:start', conversationId, userId);
    } else {
      this.socket.emit('typing:stop', conversationId, userId);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // CALLING METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Initiate a call
   */
  initiateCall(callId, initiatorId, recipientId, type, conversationId) {
    if (!this.isConnected) {
      console.error('❌ Not connected to Socket server');
      return;
    }

    console.log(`📞 Initiating ${type} call: ${callId}`);
    this.socket.emit('call:initiate', {
      callId,
      initiatorId,
      recipientId,
      type, // 'audio' or 'video'
      conversationId,
    });
  }

  /**
   * Accept a call
   */
  acceptCall(callId, userId) {
    if (!this.isConnected) return;

    console.log(`✓ Accepting call: ${callId}`);
    this.socket.emit('call:accept', { callId, userId });
  }

  /**
   * Reject a call
   */
  rejectCall(callId, userId, reason = 'user_rejected') {
    if (!this.isConnected) return;

    console.log(`✗ Rejecting call: ${callId}`);
    this.socket.emit('call:reject', { callId, userId, reason });
  }

  /**
   * End a call
   */
  endCall(callId, userId) {
    if (!this.isConnected) return;

    console.log(`🛑 Ending call: ${callId}`);
    this.socket.emit('call:end', { callId, userId });
  }

  // ═══════════════════════════════════════════════════════════════
  // WebRTC SIGNALING METHODS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Send WebRTC offer
   */
  sendWebRTCOffer(callId, from, to, offer) {
    if (!this.isConnected) return;

    this.socket.emit('webrtc:offer', { callId, from, to, offer });
  }

  /**
   * Send WebRTC answer
   */
  sendWebRTCAnswer(callId, from, to, answer) {
    if (!this.isConnected) return;

    this.socket.emit('webrtc:answer', { callId, from, to, answer });
  }

  /**
   * Send ICE candidate
   */
  sendICECandidate(callId, from, to, candidate) {
    if (!this.isConnected) return;

    this.socket.emit('webrtc:ice-candidate', { callId, from, to, candidate });
  }

  /**
   * Emit WebRTC connection state
   */
  emitConnectionState(callId, from, state) {
    if (!this.isConnected) return;

    this.socket.emit('webrtc:connection-state', { callId, from, state });
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT LISTENER MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      const list = this.eventListeners.get(event);
      const index = list.indexOf(callback);
      if (index !== -1) {
        list.splice(index, 1);
      }
    }
  }

  /**
   * Emit local event to all registered listeners
   */
  emit(event, data) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  /**
   * Check connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      socketId: this.socket?.id || null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Export singleton instance
export const socketManager = new SocketManager();
export default socketManager;
