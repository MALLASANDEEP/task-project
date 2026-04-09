import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChatBox } from '@/components/communication/ChatBox';
import { CallModal } from '@/components/communication/CallModal';
import * as api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
import { MessageCircle, Plus, Search, Phone, Video, Users } from 'lucide-react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLocation } from 'react-router-dom';
export default function MessagesPage() {
    const { user, can, role } = useAuth();
    const { toast } = useToast();
    const [conversations, setConversations] = useState([]);
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [selectedConversationId, setSelectedConversationId] = useState('');
    const [messages, setMessages] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isBaseLoading, setIsBaseLoading] = useState(true);
    const [isMessagesLoading, setIsMessagesLoading] = useState(false);
    const [activeCalls, setActiveCalls] = useState([]);
    const [callHistory, setCallHistory] = useState([]);
    const [selectedCall, setSelectedCall] = useState(null);
    const [isCallsLoading, setIsCallsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('messages');
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeTab, setComposeTab] = useState('message');
    const [composeQuery, setComposeQuery] = useState('');
    const [sidebarFilter, setSidebarFilter] = useState('all');
    const [highlightedMessageId, setHighlightedMessageId] = useState('');
    const location = useLocation();
    const dedupeMessages = useCallback((items) => {
      const map = new Map();
      (items || []).forEach((item) => {
        if (!item?.id)
          return;
        map.set(item.id, item);
      });
      return Array.from(map.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }, []);
    const loadBase = useCallback(async (options = {}) => {
      const shouldShowLoader = options.silent !== true;
      if (shouldShowLoader) {
        setIsBaseLoading(true);
      }
        try {
            const [conversationData, userData, projectData, callData, historyResult] = await Promise.all([
                api.getConversations(),
                api.getUsers(),
                api.getProjects(),
                api.getActiveCalls(),
                api.getCallHistory().catch(() => []),
            ]);
            setConversations(conversationData);
            setUsers(userData);
            setProjects(projectData);
            setActiveCalls(callData);
            setCallHistory(historyResult || []);
            if (!selectedConversationId && conversationData.length > 0) {
                setSelectedConversationId(conversationData[0].id);
            }
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
        finally {
          if (shouldShowLoader) {
            setIsBaseLoading(false);
          }
        }
      }, [selectedConversationId, toast]);
      const loadMessages = useCallback(async (conversationId, options = {}) => {
        if (!conversationId)
            return;
        const shouldShowLoader = options.silent !== true;
        if (shouldShowLoader) {
          setIsMessagesLoading(true);
        }
        try {
            const messageData = await api.getConversationMessages(conversationId);
            setMessages(dedupeMessages(messageData));
            await api.markMessagesSeen(conversationId);
            const typing = await api.getTypingUsers(conversationId);
            setTypingUsers(typing);
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
        finally {
          if (shouldShowLoader) {
            setIsMessagesLoading(false);
          }
        }
      }, [dedupeMessages, toast]);
    useEffect(() => {
      loadBase({ silent: false });
        const unsubscribe = api.subscribeCommunicationEvents((event) => {
            if (event.type === 'message:new' || event.type === 'conversation:update' || event.type === 'call:update') {
          loadBase({ silent: true });
            }
            if (event.type === 'call:update' && event.call && event.call.id === selectedCall?.id) {
              setSelectedCall((previous) => previous?.id === event.call.id ? { ...previous, ...event.call } : previous);
            }
            else if (event.type === 'call:update' && event.callId && selectedCall?.id === event.callId) {
              loadBase({ silent: true });
            }
            if (event.type === 'typing:update' && event.conversationId === selectedConversationId) {
                api.getTypingUsers(selectedConversationId).then(setTypingUsers).catch(() => setTypingUsers([]));
            }
        });
        return unsubscribe;
    }, [loadBase, selectedConversationId]);
    useEffect(() => {
      const params = new URLSearchParams(location.search);
      const conversationId = params.get('conversation') || '';
      const messageId = params.get('message') || '';
      if (conversationId) {
        setSelectedConversationId(conversationId);
        setActiveTab('messages');
      }
      if (messageId) {
        setHighlightedMessageId(messageId);
      }
      else {
        setHighlightedMessageId('');
      }
    }, [location.search]);
    useEffect(() => {
      if (!selectedConversationId)
        return;
      const unsubscribeRealtime = api.subscribeToConversationMessages(selectedConversationId, (incomingMessage) =>
         {
      
        setMessages((prev) => dedupeMessages([...prev, incomingMessage]));
        if (incomingMessage.senderId !== user?.id) {
          api.markMessagesSeen(selectedConversationId).catch(() => undefined);
        }
      });
      return unsubscribeRealtime;
    }, [dedupeMessages, selectedConversationId, user?.id]);
    useEffect(() => {
      const unsubscribeStatus = api.subscribeCommunicationEvents((event) => {
        if (event.type === 'message:seen' || event.type === 'message:status') {
          setMessages((prev) =>
            prev.map((msg) => {
              if (event.messageIds?.includes(msg.id) || event.messageId === msg.id) {
                return {
                  ...msg,
                  status: event.status || 'seen',
                  seen_at: new Date().toISOString(),
                };
              }
              return msg;
            })
          );
        }
      });

      return unsubscribeStatus;
    }, []);
    useEffect(() => {
        const timer = window.setInterval(() => {
        loadBase({ silent: true });
            if (selectedConversationId) {
            loadMessages(selectedConversationId, { silent: true });
            }
      }, 15000);
        return () => {
            window.clearInterval(timer);
        };
    }, [loadBase, loadMessages, selectedConversationId]);
    useEffect(() => {
      setMessages([]);
      loadMessages(selectedConversationId, { silent: false });
    }, [loadMessages, selectedConversationId]);
    useEffect(() => {
      if (!highlightedMessageId)
        return;
      return undefined;
    }, [highlightedMessageId, messages]);
    useEffect(() => {
      const unsubscribeCalls = api.subscribeToActiveCalls(async (event) => {
        await loadBase();
        if (event.type === 'call:update' && event.call) {
          setSelectedCall(event.call.status === 'ended' ? null : event.call);
          return;
        }
        if (event.callId) {
          setSelectedCall((prev) => {
            if (!prev || prev.id !== event.callId) return prev;
            return (activeCalls || []).find((call) => call.id === event.callId) || null;
          });
        }
      });
      return unsubscribeCalls;
    }, [loadBase, activeCalls]);
    const selectedConversation = useMemo(() => conversations.find((conversation) => conversation.id === selectedConversationId) || null, [conversations, selectedConversationId]);
    const usersById = useMemo(() => Object.fromEntries(users.map((item) => [item.id, item])), [users]);
    const directConversations = useMemo(() => conversations.filter((conversation) => conversation.type === 'direct'), [conversations]);
    const groupedConversations = useMemo(() => conversations.filter((conversation) => conversation.type !== 'direct'), [conversations]);
    const directByOtherUserId = useMemo(() => {
      const map = new Map();
      directConversations.forEach((conversation) => {
        const otherUserId = (conversation.participants || []).find((participantId) => participantId !== user?.id);
        if (otherUserId && !map.has(otherUserId)) {
          map.set(otherUserId, conversation);
        }
      });
      return map;
    }, [directConversations, user?.id]);
    const visibleMessageUsers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
      const baseUsers = users
        .filter((candidate) => candidate.id !== user?.id)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      return baseUsers.filter((candidate) => {
        if (!query)
          return true;
        return String(candidate.name || '').toLowerCase().includes(query);
      });
    }, [searchQuery, user?.id, users]);
    const visibleGroupConversations = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      return groupedConversations.filter((conversation) => {
        if (!query)
          return true;
        const title = getConversationTitle(conversation, usersById, projects, user?.id || '').toLowerCase();
        return title.includes(query);
      });
    }, [groupedConversations, projects, searchQuery, user?.id, usersById]);
    const shouldShowMessagesSection = sidebarFilter === 'all' || sidebarFilter === 'messages';
    const shouldShowGroupsSection = sidebarFilter === 'all' || sidebarFilter === 'groups';
    const composeUsers = useMemo(() => {
      const query = composeQuery.trim().toLowerCase();
      return users
        .filter((candidate) => candidate.id !== user?.id)
        .filter((candidate) => !query || String(candidate.name || '').toLowerCase().includes(query))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    }, [composeQuery, user?.id, users]);
    const composeProjects = useMemo(() => {
      const query = composeQuery.trim().toLowerCase();
      return projects
        .filter((project) => !query || String(project.title || '').toLowerCase().includes(query))
        .sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }, [composeQuery, projects]);
    const typingLabel = typingUsers
        .map((typingUserId) => usersById[typingUserId]?.name || 'Someone')
        .slice(0, 2)
        .join(', ');
    const handleSend = async (payload) => {
        if (!selectedConversationId)
            return;
      try {
        const normalizedPayload = typeof payload === 'string' ? { content: payload } : (payload || {});
        await api.sendMessage({
          conversationId: selectedConversationId,
          content: normalizedPayload.content || '',
          fileUrl: normalizedPayload.fileUrl,
          type: normalizedPayload.type || 'text',
        });
        await loadMessages(selectedConversationId, { silent: true });
      }
      catch (error) {
        toast({ title: extractErrorMessage(error), variant: 'destructive' });
        if (String(error?.message || '').toLowerCase().includes('conversation not found')) {
          await loadBase();
        }
        return;
      }
    };
    const handleTyping = async (isTyping) => {
        if (!selectedConversationId || !can('chat:send'))
            return;
        await api.setTypingIndicator(selectedConversationId, isTyping);
    };
    const handleDeleteMessage = async (message) => {
      if (!message?.id)
        return;
      try {
        await api.deleteMessage(message.id);
        await loadMessages(selectedConversationId);
        toast({ title: 'Message deleted' });
      }
      catch (error) {
        toast({ title: extractErrorMessage(error), variant: 'destructive' });
      }
    };
    const canDeleteMessage = useCallback((message) => {
      if (!message || !user)
        return false;
      return role === 'ADMIN' || message.senderId === user.id;
    }, [role, user]);
    const handleCreateDirect = async (targetUserId) => {
      if (!targetUserId)
        return;
        try {
        const conversation = await api.createDirectConversation(targetUserId);
            setSelectedConversationId(conversation.id);
        setActiveTab('messages');
            await loadBase();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const handleCreateProjectChat = async (projectId) => {
      if (!projectId)
            return;
        try {
        const project = projects.find((item) => item.id === projectId);
        const conversation = await api.createProjectConversation(projectId, `${project?.title || 'Project'} Group`);
            setSelectedConversationId(conversation.id);
        setActiveTab('messages');
            await loadBase();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const openUserChat = async (targetUserId) => {
      const existing = directByOtherUserId.get(targetUserId);
      if (existing?.id) {
      setSelectedConversationId(existing.id);
      setActiveTab('messages');
      return;
      }
      await handleCreateDirect(targetUserId);
    };
    const handleComposeUser = async (targetUserId) => {
      await openUserChat(targetUserId);
      setIsComposeOpen(false);
      setComposeQuery('');
    };
    const handleComposeProject = async (projectId) => {
      await handleCreateProjectChat(projectId);
      setIsComposeOpen(false);
      setComposeQuery('');
    };
    const handleSearchMessages = async () => {
        try {
            const result = await api.searchMessages(searchQuery);
            setSearchResults(result);
        }
        catch {
            setSearchResults([]);
        }
    };
    const startCall = async (type) => {
        if (!selectedConversationId)
            return;
        try {
            const call = await api.startCall(selectedConversationId, type);
            setSelectedCall(call);
            await loadBase();
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
            await loadBase();
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
        await loadBase();
        toast({ title: 'Call ended' });
    };
    const handleDeleteCallHistory = async (call) => {
      if (!call?.id)
        return;
      try {
        await api.deleteCallHistory(call.id);
        await loadBase();
        toast({ title: 'Call history deleted' });
      }
      catch (error) {
        toast({ title: extractErrorMessage(error), variant: 'destructive' });
      }
    };
    const canDeleteCallHistory = useCallback((call) => {
      if (!call || !user)
        return false;
      return role === 'ADMIN' || call.initiatedBy === user.id;
    }, [role, user]);
    return (<div className="space-y-4 rounded-2xl bg-[#111b21] p-3 text-[#e9edef] md:p-4">
      <div className="overflow-hidden rounded-[22px] border border-[#2a3942] bg-[linear-gradient(135deg,#202c33_0%,#111b21_70%,#0b141a_100%)] p-4 text-[#e9edef] shadow-[0_14px_40px_rgba(0,0,0,0.28)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-3">
            <Badge variant="outline" className="w-fit rounded-full border-[#2a3942] bg-[#0b141a] text-[#e9edef]">
              Messaging Hub
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Messages & Calls</h1>
              <p className="mt-2 max-w-xl text-sm text-[#9fb0bb] md:text-base">
                Individual chats, groups, and calls in one WhatsApp-like workspace.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <div className="rounded-2xl border border-[#2a3942] bg-[#0b141a] px-4 py-3">
              <p className="text-[#9fb0bb]">Conversations</p>
              <p className="mt-1 text-lg font-semibold text-[#e9edef]">{conversations.length}</p>
            </div>
            <div className="rounded-2xl border border-[#2a3942] bg-[#0b141a] px-4 py-3">
              <p className="text-[#9fb0bb]">Active calls</p>
              <p className="mt-1 text-lg font-semibold text-[#e9edef]">{activeCalls.length}</p>
            </div>
            <div className="rounded-2xl border border-[#2a3942] bg-[#0b141a] px-4 py-3">
              <p className="text-[#9fb0bb]">Role</p>
              <p className="mt-1 text-lg font-semibold text-[#e9edef]">{role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-[72vh] overflow-hidden border-[#2a3942] bg-[#111b21] shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg text-[#e9edef]">Chats</CardTitle>
              <Badge variant="secondary" className="rounded-full bg-[#202c33] text-[#9fb0bb]">{visibleMessageUsers.length} shown</Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8696a0]"/>
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search or start a new chat" className="h-10 rounded-xl border-[#2a3942] bg-[#202c33] pl-9 text-[#e9edef] placeholder:text-[#8696a0]"/>
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSidebarFilter('all')} className={`rounded-full px-3 py-1 font-medium transition ${sidebarFilter === 'all' ? 'bg-[#00a884] text-white' : 'border border-[#2a3942] bg-[#111b21] text-[#9fb0bb]'}`}>
                All
              </button>
              <button onClick={() => setSidebarFilter('messages')} className={`rounded-full px-3 py-1 font-medium transition ${sidebarFilter === 'messages' ? 'bg-[#00a884] text-white' : 'border border-[#2a3942] bg-[#111b21] text-[#9fb0bb]'}`}>
                Messages
              </button>
              <button onClick={() => setSidebarFilter('groups')} className={`rounded-full px-3 py-1 font-medium transition ${sidebarFilter === 'groups' ? 'bg-[#00a884] text-white' : 'border border-[#2a3942] bg-[#111b21] text-[#9fb0bb]'}`}>
                Groups
              </button>
            </div>
          </CardHeader>

          <CardContent className="relative h-[calc(100%-140px)] space-y-3 overflow-y-auto pb-20">
            {isBaseLoading && (<div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>)}
            {shouldShowMessagesSection && <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#7d8f99]">Messages</p>
              <div className="space-y-2">
                {visibleMessageUsers.map((candidate) => {
                    const conversation = directByOtherUserId.get(candidate.id);
                    const isSelected = Boolean(conversation?.id) && selectedConversationId === conversation.id;
                    const lastDate = conversation?.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString() : '';
                    return (<button key={candidate.id} onClick={() => openUserChat(candidate.id)} className={`w-full rounded-lg border p-3 text-left transition ${isSelected
                            ? 'border-[#00a884] bg-[#202c33]'
                            : 'border-[#2a3942] bg-[#111b21] hover:bg-[#1a252c]'}`}>
                        <p className="text-sm font-medium text-[#e9edef]">{candidate.name}</p>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#8696a0]">
                          <span>Direct</span>
                          {lastDate ? <span>{lastDate}</span> : <span>Start chat</span>}
                        </div>
                      </button>);
                })}
              </div>
            </div>}

            {shouldShowGroupsSection && <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#7d8f99]">Groups</p>
              <div className="space-y-2">
                {visibleGroupConversations.map((conversation) => (<button key={conversation.id} onClick={() => { setSelectedConversationId(conversation.id); setActiveTab('messages'); }} className={`w-full rounded-lg border p-3 text-left transition ${selectedConversationId === conversation.id
                        ? 'border-[#00a884] bg-[#202c33]'
                        : 'border-[#2a3942] bg-[#111b21] hover:bg-[#1a252c]'}`}>
                    <p className="text-sm font-medium text-[#e9edef]">{getConversationTitle(conversation, usersById, projects, user?.id || '')}</p>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#8696a0]">
                      <span className="capitalize">{conversation.type}</span>
                      {conversation.lastMessageAt ? <span>{new Date(conversation.lastMessageAt).toLocaleDateString()}</span> : null}
                    </div>
                  </button>))}
              </div>
            </div>}

            {!isBaseLoading &&
                ((shouldShowMessagesSection && visibleMessageUsers.length === 0) || !shouldShowMessagesSection) &&
                ((shouldShowGroupsSection && visibleGroupConversations.length === 0) || !shouldShowGroupsSection) && (<div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No users or groups available.
              </div>)}

            {can('chat:send') && (<div className="pointer-events-none absolute bottom-4 right-4">
                <Button size="icon" onClick={() => { setIsComposeOpen(true); setComposeTab('message'); }} className="pointer-events-auto h-12 w-12 rounded-full bg-[#00a884] text-white shadow-lg hover:bg-[#019b79]">
                  <Plus className="h-5 w-5"/>
                </Button>
              </div>)}
          </CardContent>
        </Card>

        <Card className="h-[72vh] overflow-hidden border-[#2a3942] bg-[#0b141a] shadow-sm">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <CardContent className="flex-1 overflow-hidden bg-[#0b141a] p-0">
              <TabsContent value="messages" className="h-full m-0 p-4 flex flex-col">
                {selectedConversation && (<div className="mb-4 flex items-center justify-between rounded-2xl border border-[#2a3942] bg-[#202c33] px-4 py-3 shadow-sm">
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#e9edef]">{getConversationTitle(selectedConversation, usersById, projects, user?.id || '')}</h3>
                      <p className="text-xs capitalize text-[#8696a0]">{selectedConversation.type} conversation</p>
                    </div>
                    {can('calls:initiate') && (<div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => startCall('audio')} className="rounded-lg h-9 p-2">
                          <Phone className="h-4 w-4"/>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startCall('video')} className="rounded-lg h-9 p-2">
                          <Video className="h-4 w-4"/>
                        </Button>
                      </div>)}
                  </div>)}

                {isMessagesLoading && selectedConversation && messages.length === 0 ? (<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/60 text-muted-foreground">
                    Loading messages...
                  </div>) : selectedConversation ? (<div className="h-full flex flex-col">
                      <ChatBox messages={messages} currentUserId={user.id} users={users} disabled={!can('chat:send')} typingLabel={typingLabel ? `${typingLabel} is typing...` : undefined} onSend={handleSend} onTyping={handleTyping} canDeleteMessage={canDeleteMessage} onDeleteMessage={handleDeleteMessage} highlightedMessageId={highlightedMessageId}/>
                    </div>) : (<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/60 text-muted-foreground">
                      <div className="text-center">
                        <MessageCircle className="mx-auto h-8 w-8 mb-2 opacity-50"/>
                        <p>Select a conversation to start chatting</p>
                      </div>
                    </div>)}
              </TabsContent>

              <TabsContent value="calls" className="h-full m-0 p-4 overflow-y-auto">
                <div className="space-y-3">
                  {can('calls:initiate') && selectedConversation && (<div className="space-y-2 p-3 rounded-lg border border-border/70 bg-muted/20">
                      <p className="text-sm font-medium">Start a call with {getConversationTitle(selectedConversation, usersById, projects, user?.id || '')}</p>
                      <div className="flex gap-2">
                        <Button onClick={() => startCall('audio')} disabled={!can('calls:initiate')} className="flex-1 rounded-lg">
                          <Phone className="h-4 w-4 mr-2"/>
                          Audio
                        </Button>
                        <Button onClick={() => startCall('video')} disabled={!can('calls:initiate')} className="flex-1 rounded-lg">
                          <Video className="h-4 w-4 mr-2"/>
                          Video
                        </Button>
                      </div>
                    </div>)}

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Active Calls</p>
                      <Badge variant="secondary" className="rounded-full">{activeCalls.length}</Badge>
                    </div>
                    {isCallsLoading && (<div className="text-center text-sm text-muted-foreground py-4">Loading calls...</div>)}
                    {activeCalls.length === 0 && !isCallsLoading && (<div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">No active calls right now</div>)}

                    {activeCalls.map((call) => (<button key={call.id} onClick={() => setSelectedCall(call)} className="w-full rounded-2xl border border-border/70 bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium capitalize">{call.type} call</p>
                            <p className="text-xs text-muted-foreground">
                              {call.initiatedBy === user?.id ? 'Outgoing' : 'Incoming'} • {call.participants.length} participants • Started {new Date(call.startedAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <Badge variant="outline" className="capitalize">{call.status}</Badge>
                        </div>
                      </button>))}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-medium">Recent Call History</p>
                      <Badge variant="secondary" className="rounded-full">{callHistory.length}</Badge>
                    </div>
                    {callHistory.length === 0 && (<div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">No call history yet</div>)}
                    {callHistory.slice(0, 30).map((call) => {
                      const conversationMeta = conversations.find((conversation) => conversation.id === call.conversationId);
                      const callTitle = conversationMeta
                        ? getConversationTitle(conversationMeta, usersById, projects, user?.id || '')
                        : 'Conversation';
                        const card = (<div className="w-full rounded-2xl border border-border/70 bg-card p-3 text-left shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium capitalize">{call.type} call • {callTitle}</p>
                                <p className="text-xs text-muted-foreground">
                                  {call.participants.length} participants • {new Date(call.startedAt).toLocaleString()}
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
                  </div>
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {searchResults.length > 0 && (<Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {searchResults.slice(0, 5).map((result) => (<div key={result.id} className="rounded-lg border border-border/70 p-3 text-sm">
                <p>{result.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {usersById[result.senderId]?.name || 'Unknown'} • {new Date(result.createdAt).toLocaleString()}
                </p>
              </div>))}
          </CardContent>
        </Card>)}

      <Dialog open={isComposeOpen} onOpenChange={(open) => { setIsComposeOpen(open); if (!open) setComposeQuery(''); }}>
        <DialogContent className="max-w-xl border-[#2a3942] bg-[#111b21] p-0 text-[#e9edef]">
          <DialogHeader className="border-b border-[#2a3942] bg-[#202c33] px-5 py-4">
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new direct message or a new group conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-4">
            <div className="flex gap-2 rounded-xl border border-[#2a3942] bg-[#0b141a] p-1">
              <button onClick={() => setComposeTab('message')} className={`flex-1 rounded-lg px-3 py-2 text-sm ${composeTab === 'message' ? 'bg-[#00a884] text-white' : 'text-[#9fb0bb]'}`}>
                <MessageCircle className="mr-2 inline h-4 w-4"/> New Message
              </button>
              <button onClick={() => setComposeTab('group')} className={`flex-1 rounded-lg px-3 py-2 text-sm ${composeTab === 'group' ? 'bg-[#00a884] text-white' : 'text-[#9fb0bb]'}`}>
                <Users className="mr-2 inline h-4 w-4"/> New Group
              </button>
            </div>

            <Input value={composeQuery} onChange={(event) => setComposeQuery(event.target.value)} placeholder={composeTab === 'message' ? 'Search users' : 'Search projects'} className="h-10 rounded-xl border-[#2a3942] bg-[#202c33] text-[#e9edef] placeholder:text-[#8696a0]"/>

            {composeTab === 'message' ? (<div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {composeUsers.map((candidate) => (<button key={candidate.id} onClick={() => handleComposeUser(candidate.id)} className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-left transition hover:bg-[#1a252c]">
                    <p className="text-sm font-medium text-[#e9edef]">{candidate.name}</p>
                    <p className="text-[11px] text-[#8696a0]">Start direct chat</p>
                  </button>))}
                {composeUsers.length === 0 && (<div className="rounded-lg border border-dashed border-[#2a3942] p-4 text-center text-sm text-[#8696a0]">
                    No users found.
                  </div>)}
              </div>) : (<div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {can('chat:create-group') && composeProjects.map((project) => (<button key={project.id} onClick={() => handleComposeProject(project.id)} className="w-full rounded-lg border border-[#2a3942] bg-[#111b21] px-3 py-2 text-left transition hover:bg-[#1a252c]">
                    <p className="text-sm font-medium text-[#e9edef]">{project.title}</p>
                    <p className="text-[11px] text-[#8696a0]">Create group chat</p>
                  </button>))}
                {(!can('chat:create-group') || composeProjects.length === 0) && (<div className="rounded-lg border border-dashed border-[#2a3942] p-4 text-center text-sm text-[#8696a0]">
                    {can('chat:create-group') ? 'No projects found.' : 'You do not have permission to create groups.'}
                  </div>)}
              </div>)}
          </div>
        </DialogContent>
      </Dialog>

      <CallModal open={!!selectedCall} call={selectedCall} canJoin={can('calls:join')} onJoin={joinSelectedCall} onEnd={endSelectedCall} currentUserId={user.id}/>
    </div>);
}
function getConversationTitle(conversation, usersById, projects, currentUserId) {
    if (conversation.type === 'project') {
        const project = projects.find((item) => item.id === conversation.projectId);
        return conversation.title || project?.title || 'Project chat';
    }
    if (conversation.type === 'direct') {
        const participant = conversation.participants
            .filter((participantId) => participantId !== currentUserId)
            .map((participantId) => usersById[participantId])
            .find((candidate) => candidate);
        return participant?.name || 'Direct message';
    }
    return conversation.title || 'Team chat';
}

