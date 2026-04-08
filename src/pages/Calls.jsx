import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CallModal } from '@/components/communication/CallModal';
import * as api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
import { Phone, Video } from 'lucide-react';
export default function CallsPage() {
    const { can, user } = useAuth();
    const { toast } = useToast();
    const [conversations, setConversations] = useState([]);
    const [activeCalls, setActiveCalls] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState('');
    const [selectedCall, setSelectedCall] = useState(null);
    const load = useCallback(async () => {
        try {
            const [conversationData, callData] = await Promise.all([
                api.getConversations(),
                api.getActiveCalls(),
            ]);
            setConversations(conversationData);
            setActiveCalls(callData);
        setSelectedConversationId((prev) => (prev || conversationData[0]?.id || ''));
        setSelectedCall((prev) => {
          if (!prev)
            return prev;
          return callData.find((call) => call.id === prev.id) || null;
        });
        return callData;
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        return [];
        }
    }, [toast]);
    useEffect(() => {
      load();
      const unsubscribe = api.subscribeToActiveCalls(async (event) => {
        const latestCalls = await load();
        if (event.type === 'call:update' && event.call) {
          setSelectedCall(event.call.status === 'ended' ? null : event.call);
          return;
        }
        if (event.callId) {
          setSelectedCall((prev) => {
            if (!prev || prev.id !== event.callId)
              return prev;
            return latestCalls.find((call) => call.id === event.callId) || null;
          });
            }
        });
        return unsubscribe;
    }, [load]);
    const selectedConversation = useMemo(() => conversations.find((conversation) => conversation.id === selectedConversationId), [conversations, selectedConversationId]);
    const startCall = async (type) => {
        if (!selectedConversationId)
            return;
        try {
            const call = await api.startCall(selectedConversationId, type);
            setSelectedCall(call);
          await load();
            toast({ title: `${type === 'video' ? 'Video' : 'Audio'} call started` });
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const joinSelectedCall = async () => {
        if (!selectedCall)
            return;
        try {
            const updated = await api.joinCall(selectedCall.id);
            setSelectedCall(updated);
          await load();
            toast({ title: 'Joined call' });
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const endSelectedCall = async () => {
        if (!selectedCall)
            return;
        await api.endCall(selectedCall.id);
        setSelectedCall(null);
      await load();
        toast({ title: 'Call ended' });
    };
    return (<div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Calls</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Launch audio/video calls with your team. VIEWER role cannot join calls.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Start New Call</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <Select value={selectedConversationId} onValueChange={setSelectedConversationId}>
            <SelectTrigger className="h-11 rounded-xl md:w-[320px]">
              <SelectValue placeholder="Select conversation"/>
            </SelectTrigger>
            <SelectContent>
              {conversations.map((conversation) => (<SelectItem key={conversation.id} value={conversation.id}>
                  {conversation.title || conversation.type}
                </SelectItem>))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={() => startCall('audio')} disabled={!can('calls:initiate') || !selectedConversation}>
              <Phone className="mr-1 h-4 w-4"/> Audio Call
            </Button>
            <Button onClick={() => startCall('video')} disabled={!can('calls:initiate') || !selectedConversation}>
              <Video className="mr-1 h-4 w-4"/> Video Call
            </Button>
          </div>

          {!can('calls:initiate') && (<Badge variant="outline" className="rounded-full">Your role can join only</Badge>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active / Incoming Calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeCalls.map((call) => (<button key={call.id} onClick={() => setSelectedCall(call)} className="w-full rounded-xl border border-border/70 p-3 text-left hover:bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="font-medium capitalize">{call.type} call</p>
                <Badge variant="outline" className="capitalize">{call.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Participants: {call.participants.length} • Started {new Date(call.startedAt).toLocaleTimeString()}
              </p>
            </button>))}

          {activeCalls.length === 0 && (<div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No active calls right now.
            </div>)}
        </CardContent>
      </Card>

      <CallModal open={!!selectedCall} call={selectedCall} canJoin={can('calls:join') && selectedCall?.participants.includes(user.id) === true} onJoin={joinSelectedCall} onEnd={endSelectedCall}/>
    </div>);
}

