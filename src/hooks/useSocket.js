/**
 * useSocket Hook
 * React hook for managing Socket.io connections and events
 */

import { useEffect, useCallback, useMemo, useRef } from 'react';
import { socketManager } from '@/lib/socketManager';

export function useSocket(userId, conversationIds = []) {
  const subscribedEventsRef = useRef(new Set());
  const conversationIdsKey = useMemo(() => JSON.stringify(conversationIds || []), [conversationIds]);
  const prevConversationIdsRef = useRef(conversationIdsKey);

  useEffect(() => {
    if (!userId) return;

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8001';
    const subscribedEvents = subscribedEventsRef.current;

    // Connect to socket server
    socketManager.connect(socketUrl, userId, conversationIds);

    return () => {
      // Clean up
      subscribedEvents.forEach((eventName) => {
        socketManager.socket?.off(eventName);
      });
      subscribedEvents.clear();
    };
  }, [userId, conversationIds]);

  // Update conversationIds when they change
  useEffect(() => {
    if (prevConversationIdsRef.current !== conversationIdsKey) {
      prevConversationIdsRef.current = conversationIdsKey;
      if (socketManager.isConnected) {
        socketManager.socket?.emit('user:authenticate', userId, conversationIds);
      }
    }
  }, [conversationIds, conversationIdsKey, userId]);

  // ──────────────────────────────────────────────────────────────
  // Event Subscription Helper
  // ──────────────────────────────────────────────────────────────

  const on = useCallback((event, handler) => {
    socketManager.on(event, handler);
    subscribedEventsRef.current.add(event);

    return () => {
      socketManager.off(event, handler);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Messaging Methods
  // ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback((conversationId, messageId, content) => {
    socketManager.sendMessage(conversationId, messageId, userId, content);
  }, [userId]);

  const markSeen = useCallback((conversationId, messageIds) => {
    socketManager.markMessagesSeen(conversationId, messageIds, userId);
  }, [userId]);

  const setTyping = useCallback((conversationId, isTyping) => {
    socketManager.setTypingIndicator(conversationId, userId, isTyping);
  }, [userId]);

  // ──────────────────────────────────────────────────────────────
  // Calling Methods
  // ──────────────────────────────────────────────────────────────

  const initiateCall = useCallback((callId, recipientId, type, conversationId) => {
    socketManager.initiateCall(callId, userId, recipientId, type, conversationId);
  }, [userId]);

  const acceptCall = useCallback((callId) => {
    socketManager.acceptCall(callId, userId);
  }, [userId]);

  const rejectCall = useCallback((callId, reason) => {
    socketManager.rejectCall(callId, userId, reason);
  }, [userId]);

  const endCall = useCallback((callId) => {
    socketManager.endCall(callId, userId);
  }, [userId]);

  // ──────────────────────────────────────────────────────────────
  // WebRTC Signaling Methods
  // ──────────────────────────────────────────────────────────────

  const sendOffer = useCallback((callId, to, offer) => {
    socketManager.sendWebRTCOffer(callId, userId, to, offer);
  }, [userId]);

  const sendAnswer = useCallback((callId, to, answer) => {
    socketManager.sendWebRTCAnswer(callId, userId, to, answer);
  }, [userId]);

  const sendICE = useCallback((callId, to, candidate) => {
    socketManager.sendICECandidate(callId, userId, to, candidate);
  }, [userId]);

  const broadcastConnectionState = useCallback((callId, state) => {
    socketManager.emitConnectionState(callId, userId, state);
  }, [userId]);

  return {
    // Connection
    isConnected: socketManager.isConnected,
    on,

    // Messaging
    sendMessage,
    markSeen,
    setTyping,

    // Calling
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,

    // WebRTC
    sendOffer,
    sendAnswer,
    sendICE,
    broadcastConnectionState,
  };
}

export default useSocket;
