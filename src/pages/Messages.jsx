import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChatBox } from '@/components/communication/ChatBox';
import * as api from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
import { MessageCircle, Plus, Search } from 'lucide-react';
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
    const [selectedUserForDm, setSelectedUserForDm] = useState('');
    const [selectedProjectForGroup, setSelectedProjectForGroup] = useState('');
    const loadBase = async () => {
        try {
            const [conversationData, userData, projectData] = await Promise.all([
                api.getConversations(),
                api.getUsers(),
                api.getProjects(),
            ]);
            setConversations(conversationData);
            setUsers(userData);
            setProjects(projectData);
            if (!selectedConversationId && conversationData.length > 0) {
                setSelectedConversationId(conversationData[0].id);
            }
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const loadMessages = async (conversationId) => {
        if (!conversationId)
            return;
        try {
            const messageData = await api.getConversationMessages(conversationId);
            setMessages(messageData);
            await api.markMessagesSeen(conversationId);
            const typing = await api.getTypingUsers(conversationId);
            setTypingUsers(typing);
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    useEffect(() => {
        loadBase();
        const unsubscribe = api.subscribeCommunicationEvents((event) => {
            if (event.type === 'message:new' && event.conversationId === selectedConversationId) {
                setMessages((prev) => [...prev, event.message]);
            }
            if (event.type === 'message:new' || event.type === 'conversation:update') {
                loadBase();
            }
            if (event.type === 'typing:update' && event.conversationId === selectedConversationId) {
                api.getTypingUsers(selectedConversationId).then(setTypingUsers).catch(() => setTypingUsers([]));
            }
        });
        return unsubscribe;
    }, [selectedConversationId]);
    useEffect(() => {
        const timer = window.setInterval(() => {
            loadBase();
            if (selectedConversationId) {
                loadMessages(selectedConversationId);
            }
        }, 2500);
        return () => {
            window.clearInterval(timer);
        };
    }, [selectedConversationId]);
    useEffect(() => {
        loadMessages(selectedConversationId);
    }, [selectedConversationId]);
    const selectedConversation = useMemo(() => conversations.find((conversation) => conversation.id === selectedConversationId) || null, [conversations, selectedConversationId]);
    const usersById = useMemo(() => Object.fromEntries(users.map((item) => [item.id, item])), [users]);
    const visibleConversations = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return conversations;
        return conversations.filter((conversation) => {
            const title = getConversationTitle(conversation, usersById, projects, user?.id || '').toLowerCase();
            return title.includes(query);
        });
    }, [conversations, searchQuery, usersById, projects]);
    const typingLabel = typingUsers
        .map((typingUserId) => usersById[typingUserId]?.name || 'Someone')
        .slice(0, 2)
        .join(', ');
    const handleSend = async (text) => {
        if (!selectedConversationId)
            return;
        await api.sendMessage({ conversationId: selectedConversationId, content: text });
    };
    const handleTyping = async (isTyping) => {
        if (!selectedConversationId || !can('chat:send'))
            return;
        await api.setTypingIndicator(selectedConversationId, isTyping);
    };
    const handleCreateDirect = async () => {
        if (!selectedUserForDm)
            return;
        try {
            const conversation = await api.createDirectConversation(selectedUserForDm);
            setSelectedConversationId(conversation.id);
            setSelectedUserForDm('');
            await loadBase();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
    };
    const handleCreateProjectChat = async () => {
        if (!selectedProjectForGroup)
            return;
        try {
            const project = projects.find((item) => item.id === selectedProjectForGroup);
            const conversation = await api.createProjectConversation(selectedProjectForGroup, `${project?.title || 'Project'} Group`);
            setSelectedConversationId(conversation.id);
            setSelectedProjectForGroup('');
            await loadBase();
        }
        catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        }
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
    return (<div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground mt-1">Realtime team communication with role-aware access.</p>
        </div>
        <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/5 text-primary">
          Role: {role?.replace('_', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-[72vh]">
          <CardHeader className="space-y-3">
            <CardTitle className="text-lg">Conversations</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search conversations/messages" className="pl-9 h-10 rounded-xl"/>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={handleSearchMessages}>
                Search Messages
              </Button>
            </div>

            {can('chat:send') && (<div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-2">
                <div className="flex gap-2">
                  <Select value={selectedUserForDm} onValueChange={setSelectedUserForDm}>
                    <SelectTrigger className="h-9 rounded-lg">
                      <SelectValue placeholder="New DM"/>
                    </SelectTrigger>
                    <SelectContent>
                      {users
                .filter((candidate) => candidate.id !== user?.id)
                .map((candidate) => (<SelectItem key={candidate.id} value={candidate.id}>{candidate.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleCreateDirect} className="rounded-lg">
                    <Plus className="h-4 w-4"/>
                  </Button>
                </div>

                {can('chat:create-group') && (<div className="flex gap-2">
                    <Select value={selectedProjectForGroup} onValueChange={setSelectedProjectForGroup}>
                      <SelectTrigger className="h-9 rounded-lg">
                        <SelectValue placeholder="New project chat"/>
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (<SelectItem key={project.id} value={project.id}>{project.title}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleCreateProjectChat} className="rounded-lg">
                      <Plus className="h-4 w-4"/>
                    </Button>
                  </div>)}
              </div>)}
          </CardHeader>

          <CardContent className="space-y-2 overflow-y-auto">
            {visibleConversations.map((conversation) => (<button key={conversation.id} onClick={() => setSelectedConversationId(conversation.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedConversationId === conversation.id
                ? 'border-primary/35 bg-primary/5'
                : 'border-border/70 hover:bg-muted/30'}`}>
                <p className="text-sm font-medium">{getConversationTitle(conversation, usersById, projects, user?.id || '')}</p>
                <p className="text-[11px] text-muted-foreground mt-1 capitalize">{conversation.type} chat</p>
              </button>))}
            {visibleConversations.length === 0 && (<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No conversations available.
              </div>)}
          </CardContent>
        </Card>

        <div className="h-[72vh]">
          {selectedConversation ? (<ChatBox messages={messages} currentUserId={user.id} users={users} disabled={!can('chat:send')} typingLabel={typingLabel ? `${typingLabel} is typing...` : undefined} onSend={handleSend} onTyping={handleTyping}/>) : (<div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="mx-auto h-8 w-8 mb-2"/>
                Select or create a conversation to start chatting.
              </div>
            </div>)}
        </div>
      </div>

      {searchResults.length > 0 && (<Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Search Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {searchResults.slice(0, 8).map((result) => (<div key={result.id} className="rounded-xl border border-border/70 p-3 text-sm">
                <p>{result.content}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {usersById[result.senderId]?.name || 'Unknown'} • {new Date(result.createdAt).toLocaleString()}
                </p>
              </div>))}
          </CardContent>
        </Card>)}
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

