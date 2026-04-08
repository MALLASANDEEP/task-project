import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
export function CallModal({ open, call, canJoin, onJoin, onEnd, }) {
    const [micMuted, setMicMuted] = useState(false);
    const [cameraMuted, setCameraMuted] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const localPreviewRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const callId = call?.id;
  const callType = call?.type;
  useEffect(() => {
    if (!open || !call) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMediaError('Camera or microphone access is not supported in this browser.');
      return;
    }
    let active = true;
    const previewElement = localPreviewRef.current;
    const constraints = callType === 'video'
      ? { audio: true, video: true }
      : { audio: true, video: false };
    setMediaError('');
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      if (previewElement) {
        previewElement.srcObject = stream;
      }
    })
      .catch(() => {
      setMediaError('Unable to access microphone/camera. Check browser permissions.');
    });
    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (previewElement) {
        previewElement.srcObject = null;
      }
    };
  }, [open, call, callId, callType]);
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
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {call?.type === 'video' ? <Video className="h-4 w-4"/> : <Mic className="h-4 w-4"/>}
            {call?.type === 'video' ? 'Video Call' : 'Audio Call'}
            <Badge variant="outline" className="capitalize">{call?.status || 'ringing'}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="h-52 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 to-muted flex items-center justify-center text-sm text-muted-foreground">
            {call?.type === 'video'
            ? (<video ref={localPreviewRef} autoPlay playsInline muted className="h-full w-full object-cover"/>)
            : (<div className="text-sm text-muted-foreground">Audio call mode</div>)}
          </div>
          <div className="h-52 rounded-2xl border border-border/70 bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            Participant grid
          </div>
        </div>
        {mediaError && (<p className="mt-2 text-center text-sm text-destructive">{mediaError}</p>)}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {canJoin && call?.status === 'ringing' && (<Button onClick={onJoin} className="rounded-xl">Join Call</Button>)}
          <Button variant="outline" onClick={toggleMic} className="rounded-xl">
            {micMuted ? <MicOff className="mr-1 h-4 w-4"/> : <Mic className="mr-1 h-4 w-4"/>}
            {micMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="outline" onClick={toggleCamera} className="rounded-xl">
            {cameraMuted ? <VideoOff className="mr-1 h-4 w-4"/> : <Video className="mr-1 h-4 w-4"/>}
            {cameraMuted ? 'Camera On' : 'Camera Off'}
          </Button>
          <Button variant="outline" className="rounded-xl">
            <MonitorUp className="mr-1 h-4 w-4"/> Share Screen
          </Button>
          <Button variant="destructive" onClick={onEnd} className="rounded-xl">
            <PhoneOff className="mr-1 h-4 w-4"/> End Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>);
}

