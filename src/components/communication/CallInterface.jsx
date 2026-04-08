/**
 * Enhanced Call Interface Component
 * Production-grade audio/video calling with proper permissions handling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Phone, PhoneOff, Video, Mic, MicOff, VideoOff, Volume2, MoreVertical, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import './CallInterface.css';

export function CallInterface({
  isOpen,
  call,
  isIncoming = false,
  isOngoing = false,
  localStream,
  remoteStream,
  isAudioEnabled = true,
  isVideoEnabled = true,
  connectionStats,
  isLoading = false,
  onAccept,
  onReject,
  onEnd,
  onToggleAudio,
  onToggleVideo,
  participants = [],
  isGroupCall = false,
}) {
  const { toast } = useToast();
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState('unknown');
  const callStartTimeRef = useRef(null);
  const durationIntervalRef = useRef(null);

  // ──────────────────────────────────────────────────────────────
  // Local Video Stream Setup
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOngoing || !localStream) return;

    const videoElement = localVideoRef.current;
    if (videoElement) {
      videoElement.srcObject = localStream;
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [localStream, isOngoing]);

  // ──────────────────────────────────────────────────────────────
  // Remote Video Stream Setup
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!remoteStream) return;

    const videoElement = remoteVideoRef.current;
    if (videoElement) {
      videoElement.srcObject = remoteStream;
    }

    return () => {
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [remoteStream]);

  // ──────────────────────────────────────────────────────────────
  // Call Duration Timer
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isOngoing) return;

    if (!callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
    }

    durationIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - callStartTimeRef.current;
      setCallDuration(Math.floor(elapsed / 1000));
    }, 1000);

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isOngoing]);

  // ──────────────────────────────────────────────────────────────
  // Connection Quality Monitor
  // ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!connectionStats) return;

    const { avgBitrate, packetLoss, latency } = connectionStats;

    if (latency > 300 || packetLoss > 5) {
      setConnectionQuality('poor');
    } else if (latency > 150 || packetLoss > 2) {
      setConnectionQuality('fair');
    } else if (latency > 50) {
      setConnectionQuality('good');
    } else {
      setConnectionQuality('excellent');
    }
  }, [connectionStats]);

  // ──────────────────────────────────────────────────────────────
  // Format call duration
  // ──────────────────────────────────────────────────────────────

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ──────────────────────────────────────────────────────────────
  // Incoming Call Screen
  // ──────────────────────────────────────────────────────────────

  if (isIncoming && !isOngoing) {
    return (
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-md bg-gradient-to-b from-primary/10 to-card border-2 border-primary/20">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl">Incoming Call</DialogTitle>
            <DialogDescription className="sr-only">
              Incoming {call?.type === 'video' ? 'video' : 'audio'} call from {call?.initiatorName || 'someone'}. Accept or reject the call.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-6 py-8">
            {/* Caller Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-4xl font-bold text-white animate-pulse-ring">
                {call?.initiatorId?.[0]?.toUpperCase() || '?'}
              </div>
              {call?.type === 'video' && (
                <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white">
                  <Video className="h-4 w-4" />
                </div>
              )}
            </div>

            {/* Caller Info */}
            <div className="text-center">
              <h3 className="text-lg font-semibold">{call?.initiatorName || 'Someone'}</h3>
              <p className="text-sm text-muted-foreground">
                {call?.type === 'video' ? '📹 Video Call' : '📞 Audio Call'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-4 w-full">
              <Button
                onClick={() => onReject?.(call?.id)}
                variant="destructive"
                className="flex-1 rounded-full h-12 text-base"
                disabled={isLoading}
              >
                <PhoneOff className="mr-2 h-5 w-5" />
                Reject
              </Button>

              <Button
                onClick={() => onAccept?.(call?.id)}
                className="flex-1 rounded-full h-12 text-base bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                <Phone className="mr-2 h-5 w-5" />
                Accept
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Ongoing Call Screen
  // ──────────────────────────────────────────────────────────────

  if (isOngoing && isOpen) {
    const isVideoCall = call?.type === 'video';

    return (
      <Dialog open={isOpen}>
        <DialogContent className="sm:max-w-4xl h-[90vh] p-0 border-0 rounded-2xl overflow-hidden">
          <DialogDescription className="sr-only">
            Ongoing {call?.type === 'video' ? 'video' : 'audio'} call with {call?.initiatorName || 'participants'}. Use controls to manage audio, video, and end the call.
          </DialogDescription>
          <div className="relative w-full h-full bg-black flex flex-col">
            {/* Remote Video (Large) */}
            {isVideoCall && remoteStream ? (
              <div className="flex-1 relative bg-black/80">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />

                {/* Local Video (Picture in Picture) */}
                <div className="absolute bottom-4 right-4 w-32 h-32 rounded-lg overflow-hidden border-2 border-white/20 bg-black/60 shadow-lg">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ) : (
              // Audio-only mode
              <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                <div className="text-center">
                  <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center text-5xl font-bold text-primary">
                    {call?.initiatorId?.[0]?.toUpperCase() || '?'}
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {call?.initiatorName || 'Audio Call'}
                  </h2>
                  <p className="text-lg text-white/70">{formatDuration(callDuration)}</p>
                </div>
              </div>
            )}

            {/* Top Status Bar */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-black/40 border-white/20 text-white">
                  {formatDuration(callDuration)}
                </Badge>
                {isGroupCall && (
                  <Badge variant="outline" className="bg-black/40 border-white/20 text-white">
                    {participants.length} participants
                  </Badge>
                )}
              </div>

              {/* Connection Quality */}
              <Badge
                variant="outline"
                className={cn(
                  'bg-black/40 border-white/20 text-white capitalize',
                  connectionQuality === 'excellent' && 'border-green-500/50 text-green-400',
                  connectionQuality === 'good' && 'border-blue-500/50 text-blue-400',
                  connectionQuality === 'fair' && 'border-yellow-500/50 text-yellow-400',
                  connectionQuality === 'poor' && 'border-red-500/50 text-red-400'
                )}
              >
                {connectionQuality}
              </Badge>
            </div>

            {/* Control Bar */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-4">
              {/* Mic Toggle */}
              <Button
                onClick={() => onToggleAudio?.()}
                variant={isAudioEnabled ? 'default' : 'destructive'}
                size="lg"
                className="rounded-full h-14 w-14"
              >
                {isAudioEnabled ? (
                  <Mic className="h-6 w-6" />
                ) : (
                  <MicOff className="h-6 w-6" />
                )}
              </Button>

              {/* Video Toggle (only for video calls) */}
              {isVideoCall && (
                <Button
                  onClick={() => onToggleVideo?.()}
                  variant={isVideoEnabled ? 'default' : 'destructive'}
                  size="lg"
                  className="rounded-full h-14 w-14"
                >
                  {isVideoEnabled ? (
                    <Video className="h-6 w-6" />
                  ) : (
                    <VideoOff className="h-6 w-6" />
                  )}
                </Button>
              )}

              {/* Volume Control */}
              <Button variant="default" size="lg" className="rounded-full h-14 w-14">
                <Volume2 className="h-6 w-6" />
              </Button>

              {/* End Call */}
              <Button
                onClick={() => onEnd?.(call?.id)}
                variant="destructive"
                size="lg"
                className="rounded-full h-14 w-14"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>

              {/* More Options */}
              <Button variant="default" size="lg" className="rounded-full h-14 w-14">
                <MoreVertical className="h-6 w-6" />
              </Button>
            </div>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/20 border-t-white mx-auto mb-4" />
                  <p>Connecting...</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

export default CallInterface;
