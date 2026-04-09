import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { socketManager } from '@/lib/socketManager';

const RTC_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export function CallModal({ open, call, canJoin, onJoin, onEnd, currentUserId, }) {
    const [micMuted, setMicMuted] = useState(false);
    const [cameraMuted, setCameraMuted] = useState(false);
    const [mediaError, setMediaError] = useState('');
    const [callState, setCallState] = useState('ringing');
    const localPreviewRef = useRef(null);
    const remotePreviewRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const peerConnectionsRef = useRef(new Map());
    const queuedIceRef = useRef(new Map());
    const initiatedRef = useRef(false);
    const restartAttemptedRef = useRef(new Set());

    const callId = call?.id;
    const callType = call?.type;
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8001';
    const remoteParticipantIds = useMemo(() => (call?.participants || []).filter((participantId) => participantId !== currentUserId), [call?.participants, currentUserId]);
    const isInitiator = Boolean(call && currentUserId && (call.initiatedBy === currentUserId));

    const cleanupPeer = useCallback((remoteUserId) => {
      const peer = peerConnectionsRef.current.get(remoteUserId);
      if (!peer)
        return;
      peer.ontrack = null;
      peer.onicecandidate = null;
      peer.onconnectionstatechange = null;
      peer.oniceconnectionstatechange = null;
      peer.close();
      peerConnectionsRef.current.delete(remoteUserId);
    }, []);

    const cleanupAllPeers = useCallback(() => {
      Array.from(peerConnectionsRef.current.keys()).forEach((remoteUserId) => cleanupPeer(remoteUserId));
      peerConnectionsRef.current.clear();
      restartAttemptedRef.current.clear();
      queuedIceRef.current.clear();
      if (remotePreviewRef.current) {
        remotePreviewRef.current.srcObject = null;
      }
      remoteStreamRef.current = null;
    }, [cleanupPeer]);

    const stopLocalStream = useCallback(() => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (localPreviewRef.current) {
        localPreviewRef.current.srcObject = null;
      }
    }, []);

    const setLocalMedia = useCallback(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMediaError('Camera or microphone access is not supported in this browser.');
        return null;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (callType === 'audio') {
          stream.getVideoTracks().forEach((track) => {
            track.enabled = false;
          });
        }
        mediaStreamRef.current = stream;
        if (localPreviewRef.current) {
          localPreviewRef.current.srcObject = stream;
        }
        setMediaError('');
        return stream;
      }
      catch (error) {
        const message = String(error?.name || '').toLowerCase().includes('notallowed')
          ? 'Permission denied for camera/microphone.'
          : 'Unable to access microphone/camera. Check browser permissions.';
        setMediaError(message);
        window.alert(message);
        return null;
      }
    }, [callType]);

    const ensurePeerConnection = useCallback(async (remoteUserId, localStream, createOffer) => {
      if (!remoteUserId || !localStream)
        return;
      if (peerConnectionsRef.current.has(remoteUserId)) {
        return peerConnectionsRef.current.get(remoteUserId);
      }

      const peer = new RTCPeerConnection({ iceServers: RTC_ICE_SERVERS });
      localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));

      peer.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream)
          return;
        remoteStreamRef.current = stream;
        if (remotePreviewRef.current) {
          remotePreviewRef.current.srcObject = stream;
        }
      };

      peer.onicecandidate = (event) => {
        if (!event.candidate || !callId || !currentUserId)
          return;
        socketManager.sendICECandidate(callId, currentUserId, remoteUserId, event.candidate);
      };

      peer.onconnectionstatechange = async () => {
        const state = peer.connectionState;
        if (state === 'connected') {
          setCallState('ongoing');
        }
        else if (state === 'connecting') {
          setCallState('connecting');
        }
        else if (state === 'failed') {
          setCallState('connecting');
          if (!restartAttemptedRef.current.has(remoteUserId) && typeof peer.restartIce === 'function') {
            restartAttemptedRef.current.add(remoteUserId);
            try {
              peer.restartIce();
            }
            catch {
              setMediaError('Call connection failed. Please retry.');
            }
          }
        }
        else if (state === 'disconnected' || state === 'closed') {
          setCallState('ended');
        }
      };

      peer.oniceconnectionstatechange = () => {
        if (peer.iceConnectionState === 'failed' && typeof peer.restartIce === 'function') {
          try {
            peer.restartIce();
          }
          catch {
            setMediaError('Network issue while negotiating call.');
          }
        }
      };

      peerConnectionsRef.current.set(remoteUserId, peer);

      if (createOffer) {
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        if (callId && currentUserId) {
          socketManager.sendWebRTCOffer(callId, currentUserId, remoteUserId, offer);
        }
      }

      return peer;
    }, [callId, currentUserId]);

    useEffect(() => {
      if (!open || !callId || !currentUserId)
        return;

      socketManager.connect(socketUrl, currentUserId, [call?.conversationId].filter(Boolean));
      setCallState(call?.status || 'ringing');
      let active = true;

      const handleOffer = async ({ callId: incomingCallId, from, offer }) => {
        if (!active || incomingCallId !== callId)
          return;
        const stream = mediaStreamRef.current || (await setLocalMedia());
        if (!stream)
          return;
        setCallState('connecting');
        const peer = await ensurePeerConnection(from, stream, false);
        await peer.setRemoteDescription(new RTCSessionDescription(offer));

        const queued = queuedIceRef.current.get(from) || [];
        for (const candidate of queued) {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        queuedIceRef.current.delete(from);

        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socketManager.sendWebRTCAnswer(callId, currentUserId, from, answer);
      };

      const handleAnswer = async ({ callId: incomingCallId, from, answer }) => {
        if (!active || incomingCallId !== callId)
          return;
        const peer = peerConnectionsRef.current.get(from);
        if (!peer)
          return;
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
      };

      const handleIceCandidate = async ({ callId: incomingCallId, from, candidate }) => {
        if (!active || incomingCallId !== callId || !candidate)
          return;
        const peer = peerConnectionsRef.current.get(from);
        if (!peer || !peer.remoteDescription) {
          const queued = queuedIceRef.current.get(from) || [];
          queued.push(candidate);
          queuedIceRef.current.set(from, queued);
          return;
        }
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
        catch {
          // Ignore duplicate/stale candidate errors
        }
      };

      const handleCallAccepted = async ({ callId: incomingCallId, acceptedBy }) => {
        if (!active || incomingCallId !== callId || !isInitiator)
          return;
        const stream = mediaStreamRef.current || (await setLocalMedia());
        if (!stream)
          return;
        setCallState('connecting');
        await ensurePeerConnection(acceptedBy, stream, true);
      };

      const handleCallStart = ({ callId: incomingCallId }) => {
        if (!active || incomingCallId !== callId)
          return;
        setCallState('ongoing');
      };

      const handleCallRinging = ({ callId: incomingCallId }) => {
        if (!active || incomingCallId !== callId)
          return;
        setCallState('ringing');
      };

      const handleCallRejected = ({ callId: incomingCallId }) => {
        if (!active || incomingCallId !== callId)
          return;
        setCallState('ended');
      };

      const handleCallEnded = ({ callId: incomingCallId }) => {
        if (incomingCallId !== callId)
          return;
        setCallState('ended');
        cleanupAllPeers();
        stopLocalStream();
      };

      socketManager.on('webrtc:offer', handleOffer);
      socketManager.on('webrtc:answer', handleAnswer);
      socketManager.on('webrtc:ice-candidate', handleIceCandidate);
      socketManager.on('call:accepted', handleCallAccepted);
      socketManager.on('call:start', handleCallStart);
      socketManager.on('call:ringing', handleCallRinging);
      socketManager.on('call:rejected', handleCallRejected);
      socketManager.on('call:ended', handleCallEnded);

      setLocalMedia().then(async (stream) => {
        if (!active || !stream)
          return;
        if (isInitiator && !initiatedRef.current && call?.status === 'ringing') {
          initiatedRef.current = true;
          remoteParticipantIds.forEach((remoteUserId) => {
            socketManager.initiateCall(callId, currentUserId, remoteUserId, callType, call?.conversationId);
          });
        }
        if (isInitiator && call?.status === 'ongoing') {
          setCallState('connecting');
          for (const remoteUserId of remoteParticipantIds) {
            await ensurePeerConnection(remoteUserId, stream, true);
          }
        }
      });

      return () => {
        active = false;
        socketManager.off('webrtc:offer', handleOffer);
        socketManager.off('webrtc:answer', handleAnswer);
        socketManager.off('webrtc:ice-candidate', handleIceCandidate);
        socketManager.off('call:accepted', handleCallAccepted);
        socketManager.off('call:start', handleCallStart);
        socketManager.off('call:ringing', handleCallRinging);
        socketManager.off('call:rejected', handleCallRejected);
        socketManager.off('call:ended', handleCallEnded);
        cleanupAllPeers();
        stopLocalStream();
      };
    }, [open, callId, currentUserId, call?.conversationId, call?.status, callType, isInitiator, remoteParticipantIds, socketUrl, cleanupAllPeers, ensurePeerConnection, setLocalMedia, stopLocalStream]);

    const handleJoin = async () => {
      if (!callId || !currentUserId)
        return;
      setCallState('connecting');
      await onJoin?.();
      socketManager.acceptCall(callId, currentUserId);
    };

    const handleEnd = async () => {
      if (callId && currentUserId) {
        socketManager.endCall(callId, currentUserId);
      }
      setCallState('ended');
      cleanupAllPeers();
      stopLocalStream();
      await onEnd?.();
    };

  const toggleMic = () => {
    setMicMuted((previous) => {
      const next = !previous;
      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };
  const toggleCamera = () => {
    setCameraMuted((previous) => {
      const next = !previous;
      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getVideoTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };
    return (<Dialog open={open}>
      <DialogContent className="max-w-4xl overflow-hidden border-border/70 p-0 sm:rounded-3xl">
        <DialogHeader>
          <div className="border-b border-border/70 bg-gradient-to-br from-background to-muted/20 px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {call?.type === 'video' ? <Video className="h-4 w-4"/> : <Mic className="h-4 w-4"/>}
              {call?.type === 'video' ? 'Video Call' : 'Audio Call'}
              <Badge variant="outline" className="capitalize">{callState || call?.status || 'ringing'}</Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Live call dialog with local and remote media streams and call controls.
            </DialogDescription>
            <p className="mt-1 text-sm text-muted-foreground">
              {call ? `Call ID ${call.id.slice(0, 8)} · ${call.participants.length} participants` : 'Preparing call room...'}
            </p>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2">
          <div className="flex h-56 items-center justify-center overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/15 via-background to-muted/30 text-sm text-muted-foreground shadow-sm">
            {call?.type === 'video'
            ? (<video ref={localPreviewRef} autoPlay playsInline muted className="h-full w-full object-cover"/>)
            : (<div className="text-sm text-muted-foreground">Audio call mode</div>)}
          </div>
          <div className="flex h-56 items-center justify-center rounded-3xl border border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground shadow-sm">
            {call?.type === 'video' ? (<video ref={remotePreviewRef} autoPlay playsInline className="h-full w-full rounded-2xl object-cover"/>) : (<div className="text-center">
                <p className="font-medium text-foreground">Remote participant</p>
                <p className="mt-1 text-xs text-muted-foreground">Waiting for media stream...</p>
              </div>)}
          </div>
        </div>
        {mediaError && (<p className="mt-2 text-center text-sm text-destructive">{mediaError}</p>)}

        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/70 px-6 py-5">
          {canJoin && callState !== 'ended' && (<Button onClick={handleJoin} className="rounded-xl px-5">{callState === 'ongoing' ? 'Join Ongoing Call' : 'Join Call'}</Button>)}
          <Button variant="outline" onClick={toggleMic} className="rounded-xl px-4">
            {micMuted ? <MicOff className="mr-1 h-4 w-4"/> : <Mic className="mr-1 h-4 w-4"/>}
            {micMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="outline" onClick={toggleCamera} className="rounded-xl px-4">
            {cameraMuted ? <VideoOff className="mr-1 h-4 w-4"/> : <Video className="mr-1 h-4 w-4"/>}
            {cameraMuted ? 'Camera On' : 'Camera Off'}
          </Button>
          <Button variant="outline" className="rounded-xl px-4">
            <MonitorUp className="mr-1 h-4 w-4"/> Share Screen
          </Button>
          <Button variant="destructive" onClick={handleEnd} className="rounded-xl px-5">
            <PhoneOff className="mr-1 h-4 w-4"/> End Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>);
}

