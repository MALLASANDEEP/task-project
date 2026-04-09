import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { CallModal } from '@/components/communication/CallModal';
import * as api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
import { Phone, Video, Search, Link2, Grid3X3, CalendarPlus } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
export default function CallsPage() {
    const { can, user } = useAuth();
    const { toast } = useToast();
    const [users, setUsers] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [activeCalls, setActiveCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState('');
    const [selectedCall, setSelectedCall] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const load = useCallback(async () => {
      setIsLoading(true);
        try {
        const [conversationData, callData, userData, historyData] = await Promise.all([
                api.getConversations(),
                api.getActiveCalls(),
                api.getUsers(),
          api.getCallHistory().catch(() => []),
            ]);
            setConversations(conversationData);
            setActiveCalls(callData);
        setCallHistory(historyData || []);
            setUsers(userData);
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
        finally {
          setIsLoading(false);
        }
    }, [toast]);
    useEffect(() => {
      load();
      const unsubscribe = api.subscribeToActiveCalls(async (event) => {
        const latestCalls = await load();
        if (event.type === 'call:update' && !event.call && event.callId) {
          setSelectedCall((prev) => {
            if (!prev || prev.id !== event.callId)
              return latestCalls.find((call) => call.id === event.callId) || prev;
            return latestCalls.find((call) => call.id === event.callId) || prev;
          });
          return;
        }
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
    const usersById = useMemo(() => Object.fromEntries(users.map((item) => [item.id, item])), [users]);
    const directConversations = useMemo(() => conversations.filter((conversation) => conversation.type === 'direct'), [conversations]);
    const favouriteConversations = useMemo(() => directConversations.slice(0, 2), [directConversations]);
    const filteredFavourites = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      if (!query)
        return favouriteConversations;
      return favouriteConversations.filter((conversation) => getConversationTitle(conversation, usersById, user?.id).toLowerCase().includes(query));
    }, [favouriteConversations, searchQuery, user?.id, usersById]);
    const filteredRecentCalls = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      const recentRows = (callHistory || []).slice(0, 30);
      if (!query)
        return recentRows;
      return recentRows.filter((callRow) => {
        const conversation = conversations.find((item) => item.id === callRow.conversationId);
        const title = getConversationTitle(conversation, usersById, user?.id).toLowerCase();
        return title.includes(query);
      });
    }, [callHistory, conversations, searchQuery, user?.id, usersById]);
    const incomingActiveCalls = useMemo(() => activeCalls.filter((call) => call.initiatedBy !== user?.id), [activeCalls, user?.id]);
    const outgoingActiveCalls = useMemo(() => activeCalls.filter((call) => call.initiatedBy === user?.id), [activeCalls, user?.id]);
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
    const canDeleteCallHistory = useCallback((call) => {
      if (!call || !user)
        return false;
      return user.role === 'ADMIN' || call.initiatedBy === user.id;
    }, [user]);
    const handleDeleteCallHistory = async (call) => {
      if (!call?.id)
        return;
      try {
        await api.deleteCallHistory(call.id);
        await load();
        toast({ title: 'Call history deleted' });
      }
      catch (error) {
        toast({ title: extractErrorMessage(error), variant: 'destructive' });
      }
    };
    return (<div className="rounded-2xl bg-[#111b21] p-3 text-[#e9edef] md:p-4">
      <div className="grid min-h-[78vh] grid-cols-1 overflow-hidden rounded-2xl border border-[#2a3942] bg-[#0b141a] lg:grid-cols-[420px_minmax(0,1fr)]">
        <div className="border-r border-[#2a3942] bg-[#111b21]">
          <div className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-semibold">Calls</h1>
              <Badge className="bg-[#202c33] text-[#9fb0bb]">{activeCalls.length} active</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8696a0]"/>
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name or number" className="h-11 rounded-full border-[#2a3942] bg-[#202c33] pl-10 text-[#e9edef] placeholder:text-[#8696a0]"/>
            </div>
          </div>

          <div className="space-y-5 px-4 pb-4">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#d1d7db]">Favourites</h3>
              <div className="space-y-2">
                {filteredFavourites.map((conversation) => {
                    const title = getConversationTitle(conversation, usersById, user?.id);
                    return (<div key={conversation.id} className="flex items-center justify-between rounded-xl px-2 py-2 transition hover:bg-[#1a252c]">
                        <button onClick={() => setSelectedConversationId(conversation.id)} className="flex flex-1 items-center gap-3 text-left">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#233138] text-sm font-semibold text-[#e9edef]">
                            {title.slice(0, 1).toUpperCase()}
                          </div>
                          <p className="text-xl leading-none text-[#e9edef]">{title}</p>
                        </button>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-[#d1d7db] hover:bg-[#202c33]" onClick={() => { setSelectedConversationId(conversation.id); startCall('video'); }}>
                            <Video className="h-4 w-4"/>
                          </Button>
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full text-[#d1d7db] hover:bg-[#202c33]" onClick={() => { setSelectedConversationId(conversation.id); startCall('audio'); }}>
                            <Phone className="h-4 w-4"/>
                          </Button>
                        </div>
                      </div>);
                })}
              </div>
            </section>

            <div className="h-px bg-[#2a3942]"/>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-[#d1d7db]">Recent</h3>
              <div className="space-y-2">
                {filteredRecentCalls.map((callRow) => {
                    const conversation = conversations.find((item) => item.id === callRow.conversationId);
                    const title = getConversationTitle(conversation, usersById, user?.id);
                    return (<button key={callRow.id} onClick={() => setSelectedConversationId(callRow.conversationId)} className={`flex w-full items-center justify-between rounded-xl px-2 py-2 text-left transition ${selectedConversationId === callRow.conversationId ? 'bg-[#202c33]' : 'hover:bg-[#1a252c]'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#233138] text-sm font-semibold text-[#e9edef]">
                            {title.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xl leading-none text-[#e9edef]">{title}</p>
                            <p className="mt-1 text-xs text-[#9fb0bb]">{`${callRow.type} ${callRow.status}`}</p>
                          </div>
                        </div>
                        <span className="text-xs text-[#9fb0bb]">{callRow?.startedAt ? new Date(callRow.startedAt).toLocaleDateString() : ''}</span>
                      </button>);
                })}
                {!isLoading && filteredFavourites.length === 0 && filteredRecentCalls.length === 0 && (<div className="rounded-xl border border-dashed border-[#2a3942] p-6 text-center text-sm text-[#8696a0]">
                    No call contacts found.
                  </div>)}
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col justify-between bg-[#0b141a] p-6">
          <div className="grid grid-cols-2 gap-8 place-self-center">
            <button onClick={() => startCall('video')} disabled={!selectedConversationId || !can('calls:initiate')} className="flex h-36 w-36 flex-col items-center justify-center gap-4 rounded-3xl border border-[#2a3942] bg-[#111b21] text-center transition hover:border-[#00a884] disabled:opacity-50">
              <Video className="h-8 w-8 text-[#e9edef]"/>
              <span className="text-2xl font-medium text-[#e9edef]">Start call</span>
            </button>
            <button className="flex h-36 w-36 flex-col items-center justify-center gap-4 rounded-3xl border border-[#2a3942] bg-[#111b21] text-center transition hover:border-[#00a884]">
              <Link2 className="h-8 w-8 text-[#e9edef]"/>
              <span className="text-2xl font-medium text-[#e9edef]">New call link</span>
            </button>
            <button onClick={() => startCall('audio')} disabled={!selectedConversationId || !can('calls:initiate')} className="flex h-36 w-36 flex-col items-center justify-center gap-4 rounded-3xl border border-[#2a3942] bg-[#111b21] text-center transition hover:border-[#00a884] disabled:opacity-50">
              <Grid3X3 className="h-8 w-8 text-[#e9edef]"/>
              <span className="text-2xl font-medium text-[#e9edef]">Call a number</span>
            </button>
            <button className="flex h-36 w-36 flex-col items-center justify-center gap-4 rounded-3xl border border-[#2a3942] bg-[#111b21] text-center transition hover:border-[#00a884]">
              <CalendarPlus className="h-8 w-8 text-[#e9edef]"/>
              <span className="text-2xl font-medium text-[#e9edef]">Schedule call</span>
            </button>
          </div>

          <div className="space-y-3">
            {incomingActiveCalls.length > 0 && (<Card className="border-[#2a3942] bg-[#111b21]">
                <CardHeader>
                  <CardTitle className="text-sm text-[#e9edef]">Incoming Calls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {incomingActiveCalls.map((call) => (<button key={call.id} onClick={() => setSelectedCall(call)} className="flex w-full items-center justify-between rounded-lg border border-[#2a3942] bg-[#0b141a] p-2 text-left">
                      <div>
                        <p className="text-sm font-medium capitalize text-[#e9edef]">{call.type} call</p>
                        <p className="text-xs text-[#8696a0]">Incoming • {call.participants.length} participants</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{call.status}</Badge>
                    </button>))}
                </CardContent>
              </Card>)}

            {outgoingActiveCalls.length > 0 && (<Card className="border-[#2a3942] bg-[#111b21]">
                <CardHeader>
                  <CardTitle className="text-sm text-[#e9edef]">Outgoing Calls</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {outgoingActiveCalls.map((call) => (<button key={call.id} onClick={() => setSelectedCall(call)} className="flex w-full items-center justify-between rounded-lg border border-[#2a3942] bg-[#0b141a] p-2 text-left">
                      <div>
                        <p className="text-sm font-medium capitalize text-[#e9edef]">{call.type} call</p>
                        <p className="text-xs text-[#8696a0]">Outgoing • {call.participants.length} participants</p>
                      </div>
                      <Badge variant="outline" className="capitalize">{call.status}</Badge>
                    </button>))}
                </CardContent>
              </Card>)}

            <div className="flex items-center justify-between rounded-xl border border-[#2a3942] bg-[#111b21] px-4 py-3 text-sm text-[#9fb0bb]">
              <span>Your personal calls are end-to-end encrypted</span>
              <Badge variant="outline">Secure</Badge>
            </div>
          </div>
        </div>
      </div>

      <Card className="mt-4 overflow-hidden border-[#2a3942] bg-[#111b21] shadow-sm">
        <CardHeader className="border-b border-[#2a3942]">
          <CardTitle className="text-lg text-[#e9edef]">Recent Call History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-4 md:p-6">
          {callHistory.slice(0, 30).map((call) => {
            const conversation = conversations.find((item) => item.id === call.conversationId);
            const card = (<div className="w-full rounded-2xl border border-[#2a3942] bg-[#0b141a] p-4 text-left shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize text-[#e9edef]">{call.type} call • {conversation?.title || conversation?.type || 'Conversation'}</p>
                    <p className="mt-1 text-xs text-[#8696a0]">
                      {call.initiatedBy === user?.id ? 'Outgoing' : 'Incoming'} • Participants: {call.participants.length} • Started {new Date(call.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline" className="capitalize">{call.status}</Badge>
                </div>
              </div>);
            if (!canDeleteCallHistory(call)) {
                return <div key={call.id}>{card}</div>;
            }
            return (<ContextMenu key={call.id}>
                <ContextMenuTrigger asChild>
                  <div>{card}</div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => handleDeleteCallHistory(call)} className="text-destructive focus:text-destructive">
                    Delete call history
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>);
        })}

          {!isLoading && callHistory.length === 0 && (<div className="rounded-2xl border border-dashed border-[#2a3942] bg-[#0b141a] p-8 text-center text-sm text-[#8696a0]">
              No call history available.
            </div>)}
        </CardContent>
      </Card>

      <CallModal open={!!selectedCall} call={selectedCall} canJoin={can('calls:join')} onJoin={joinSelectedCall} onEnd={endSelectedCall} currentUserId={user.id}/>
    </div>);
}

function getConversationTitle(conversation, usersById, currentUserId) {
    if (!conversation)
        return 'Conversation';
    if (conversation.type === 'direct') {
        const participant = (conversation.participants || [])
            .filter((participantId) => participantId !== currentUserId)
            .map((participantId) => usersById[participantId])
            .find((candidate) => candidate);
        return participant?.name || 'Direct message';
    }
    return conversation.title || 'Group chat';
}

