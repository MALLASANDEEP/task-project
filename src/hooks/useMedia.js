/**
 * useMedia Hook
 * React hook for managing media devices and WebRTC connections
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { mediaManager } from '@/lib/mediaManager';

export function useMedia() {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [mediaError, setMediaError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStats, setConnectionStats] = useState(null);
  const [availableDevices, setAvailableDevices] = useState(null);

  const statsIntervalRef = useRef(null);

  // ──────────────────────────────────────────────────────────────
  // Request Media Access
  // ──────────────────────────────────────────────────────────────

  const requestMedia = useCallback(async (mediaType = 'audio-video') => {
    setIsLoading(true);
    setMediaError(null);

    try {
      const stream = await mediaManager.getLocalStream(mediaType);

      if (stream.error) {
        setMediaError({
          type: 'permission_denied',
          code: stream.code,
          message: stream.message,
        });
        setIsLoading(false);
        return null;
      }

      setLocalStream(stream);
      setIsAudioEnabled(stream.getAudioTracks().length > 0);
      setIsVideoEnabled(stream.getVideoTracks().length > 0);

      return stream;
    } catch (error) {
      setMediaError({
        type: 'error',
        message: error.message,
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Stop Media
  // ──────────────────────────────────────────────────────────────

  const stopMedia = useCallback(() => {
    mediaManager.stopLocalStream();
    setLocalStream(null);
    setIsAudioEnabled(false);
    setIsVideoEnabled(false);
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Toggle Audio/Video
  // ──────────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const newState = mediaManager.toggleAudio(!isAudioEnabled);
    setIsAudioEnabled(newState);
    return newState;
  }, [isAudioEnabled]);

  const toggleVideo = useCallback(() => {
    const newState = mediaManager.toggleVideo(!isVideoEnabled);
    setIsVideoEnabled(newState);
    return newState;
  }, [isVideoEnabled]);

  // ──────────────────────────────────────────────────────────────
  // Create Peer Connection
  // ──────────────────────────────────────────────────────────────

  const createCall = useCallback((callId) => {
    try {
      const peerConnection = mediaManager.createPeerConnection(callId);

      // Handle remote tracks
      peerConnection.ontrack = (event) => {
        console.log(`📥 Remote track: ${event.track.kind}`);
        setRemoteStream(event.streams[0]);
      };

      return peerConnection;
    } catch (error) {
      setMediaError({ type: 'error', message: error.message });
      return null;
    }
  }, []);

  // ──────────────────────────────────────────────────────────────
  // WebRTC Operations
  // ──────────────────────────────────────────────────────────────

  const createOffer = useCallback(async (callId) => {
    try {
      const offer = await mediaManager.createOffer(callId);
      return offer;
    } catch (error) {
      setMediaError({ type: 'error', message: error.message });
      return null;
    }
  }, []);

  const createAnswer = useCallback(async (callId) => {
    try {
      const answer = await mediaManager.createAnswer(callId);
      return answer;
    } catch (error) {
      setMediaError({ type: 'error', message: error.message });
      return null;
    }
  }, []);

  const handleOffer = useCallback(async (callId, offer) => {
    try {
      await mediaManager.handleOffer(callId, offer);
    } catch (error) {
      setMediaError({ type: 'error', message: error.message });
    }
  }, []);

  const handleAnswer = useCallback(async (callId, answer) => {
    try {
      await mediaManager.handleAnswer(callId, answer);
    } catch (error) {
      setMediaError({ type: 'error', message: error.message });
    }
  }, []);

  const addICECandidate = useCallback(async (callId, candidate) => {
    try {
      await mediaManager.addICECandidate(callId, candidate);
    } catch (error) {
      setMediaError({ type: 'error', message: error.message });
    }
  }, []);

  const endCall = useCallback((callId) => {
    mediaManager.closePeerConnection(callId);
    mediaManager.stopLocalStream();
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Connection Stats Monitoring
  // ──────────────────────────────────────────────────────────────

  const startStatsMonitoring = useCallback((callId, interval = 1000) => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }

    statsIntervalRef.current = setInterval(async () => {
      const stats = await mediaManager.getConnectionStats(callId);
      setConnectionStats(stats);
    }, interval);
  }, []);

  const stopStatsMonitoring = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Enumerate Devices
  // ──────────────────────────────────────────────────────────────

  const getAvailableDevices = useCallback(async () => {
    const devices = await mediaManager.enumerateDevices();
    setAvailableDevices(devices);
    return devices;
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Cleanup
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      stopMedia();
      stopStatsMonitoring();
    };
  }, [stopMedia, stopStatsMonitoring]);

  return {
    // Stream state
    localStream,
    remoteStream,
    isAudioEnabled,
    isVideoEnabled,
    isLoading,
    mediaError,
    connectionStats,
    availableDevices,

    // Methods
    requestMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    createCall,
    createOffer,
    createAnswer,
    handleOffer,
    handleAnswer,
    addICECandidate,
    endCall,
    startStatsMonitoring,
    stopStatsMonitoring,
    getAvailableDevices,

    // Utilities
    isWebRTCSupported: mediaManager.isWebRTCSupported(),
  };
}

export default useMedia;
