import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PhoneOff, Mic, MicOff, Video, VideoOff, MonitorUp } from 'lucide-react';
import { useState } from 'react';
import { CallSession } from '@/types';

export function CallModal({
  open,
  call,
  canJoin,
  onJoin,
  onEnd,
}: {
  open: boolean;
  call: CallSession | null;
  canJoin: boolean;
  onJoin: () => Promise<void>;
  onEnd: () => Promise<void>;
}) {
  const [micMuted, setMicMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {call?.type === 'video' ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {call?.type === 'video' ? 'Video Call' : 'Audio Call'}
            <Badge variant="outline" className="capitalize">{call?.status || 'ringing'}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="h-52 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 to-muted flex items-center justify-center text-sm text-muted-foreground">
            Your camera preview
          </div>
          <div className="h-52 rounded-2xl border border-border/70 bg-muted/40 flex items-center justify-center text-sm text-muted-foreground">
            Participant grid
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {canJoin && call?.status === 'ringing' && (
            <Button onClick={onJoin} className="rounded-xl">Join Call</Button>
          )}
          <Button variant="outline" onClick={() => setMicMuted((prev) => !prev)} className="rounded-xl">
            {micMuted ? <MicOff className="mr-1 h-4 w-4" /> : <Mic className="mr-1 h-4 w-4" />}
            {micMuted ? 'Unmute' : 'Mute'}
          </Button>
          <Button variant="outline" onClick={() => setCameraMuted((prev) => !prev)} className="rounded-xl">
            {cameraMuted ? <VideoOff className="mr-1 h-4 w-4" /> : <Video className="mr-1 h-4 w-4" />}
            {cameraMuted ? 'Camera On' : 'Camera Off'}
          </Button>
          <Button variant="outline" className="rounded-xl">
            <MonitorUp className="mr-1 h-4 w-4" /> Share Screen
          </Button>
          <Button variant="destructive" onClick={onEnd} className="rounded-xl">
            <PhoneOff className="mr-1 h-4 w-4" /> End Call
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
