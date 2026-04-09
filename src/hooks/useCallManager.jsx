import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { socketManager } from '@/lib/socketManager';

/**
 * Global hook for managing incoming/outgoing calls
 * Handles call state, WebRTC setup, and user interactions
 * Used across the entire app to show incoming call popups
 */
export function useCallManager() {
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callState, setCallState] = useState('idle'); // idle, ringing, connecting, ongoing, ended
  const callTimeoutRef = useRef(null);

  /**
   * Handle incoming call
   */
  const handleIncomingCall = useCallback((callData) => {
    console.log('📞 Incoming call received:', callData);

    setIncomingCall({
      id: callData.callId,
      initiatorId: callData.initiatorId,
      initiatorName: callData.initiatorName || 'Unknown User',
      type: callData.type || 'audio', // 'audio' or 'video'
      conversationId: callData.conversationId,
      timestamp: new Date(),
    });

    setCallState('ringing');

    // Auto-reject after 45 seconds
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = setTimeout(() => {
      console.log('⏱️ Call auto-rejected (timeout)');
      handleRejectCall();
    }, 45000);
  }, []);

  /**
   * Accept incoming call
   */
  const handleAcceptCall = useCallback(async (callId) => {
    if (!incomingCall || !callId) return;

    console.log('✓ Accepting call:', callId);

    try {
      setCallState('connecting');

      // Tell server we accepted
      socketManager.acceptCall(callId, incomingCall.initiatorId);

      // Navigate to messages page with call in focus
      navigate(`/messages?conversation=${incomingCall.conversationId}&call=${callId}`);

      // Clear timeout
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);

      setIsCallActive(true);
      setIncomingCall(null);
    } catch (error) {
      console.error('❌ Error accepting call:', error);
      setCallState('ended');
    }
  }, [incomingCall, navigate]);

  /**
   * Reject incoming call
   */
  const handleRejectCall = useCallback((callId = incomingCall?.id) => {
    if (!callId) return;

    console.log('✗ Rejecting call:', callId);

    socketManager.rejectCall(callId, incomingCall?.initiatorId);

    // Clear timeout
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);

    setCallState('ended');
    setIncomingCall(null);

    // Reset after a brief moment
    setTimeout(() => {
      setCallState('idle');
    }, 500);
  }, [incomingCall?.id, incomingCall?.initiatorId]);

  /**
   * End active call
   */
  const handleEndCall = useCallback((callId) => {
    if (!callId) return;

    console.log('🛑 Ending call:', callId);
    socketManager.endCall(callId, incomingCall?.initiatorId);

    setIsCallActive(false);
    setCallState('ended');
    setIncomingCall(null);

    // Reset after a brief moment
    setTimeout(() => {
      setCallState('idle');
    }, 500);
  }, [incomingCall?.initiatorId]);

  /**
   * Reset call state
   */
  const resetCallState = useCallback(() => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    setIncomingCall(null);
    setIsCallActive(false);
    setCallState('idle');
  }, []);

  return {
    // State
    incomingCall,
    isCallActive,
    callState,

    // Methods
    handleIncomingCall,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    resetCallState,
  };
}

export default useCallManager;
