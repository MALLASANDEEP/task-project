/**
 * Message & Calls Hub Component
 * Professional tabbed interface for messaging and call history
 */

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MessageCircle, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import ChatBoxEnhanced from './ChatBoxEnhanced';
import CallHistoryTab from './CallHistoryTab';

export function MessageCallsHub({
  // Chat props
  messages = [],
  currentUserId,
  users = {},
  disabled = false,
  typingLabel,
  onSendMessage,
  onTyping,
  onCallInitiate,
  messageStatuses = {},

  // Calls props
  calls = [],
  onSelectCall,
  onDeleteCall,
  onReplayCall,
  isLoadingCalls = false,

  // Container props
  className,
  defaultTab = 'messages'
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Count missed calls
  const missedCallsCount = calls.filter(
    call => call.missedBy?.includes(currentUserId)
  ).length;

  return (
    <div className={cn('flex flex-col h-full w-full bg-card rounded-lg border border-border/50 overflow-hidden', className)}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col h-full w-full"
      >
        {/* Tab Navigation */}
        <div className="border-b border-border/50 bg-muted/30">
          <TabsList className="w-full justify-start gap-2 rounded-none bg-transparent p-4">
            <TabsTrigger
              value="messages"
              className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Messages</span>
              {messages.length > 0 && (
                <span className="ml-1 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-accent text-xs font-semibold">
                  {messages.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="calls"
              className="relative gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              <Phone className="h-4 w-4" />
              <span>Calls</span>
              {calls.length > 0 && (
                <span className="ml-1 flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-accent text-xs font-semibold">
                  {calls.length}
                </span>
              )}
              {missedCallsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 text-xs font-bold text-white">
                  {missedCallsCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Messages Tab Content */}
        <TabsContent
          value="messages"
          className="flex-1 m-0 p-0 overflow-hidden"
        >
          <ChatBoxEnhanced
            messages={messages}
            currentUserId={currentUserId}
            users={users}
            disabled={disabled}
            typingLabel={typingLabel}
            onSend={onSendMessage}
            onTyping={onTyping}
            onCallInitiate={onCallInitiate}
            messageStatuses={messageStatuses}
          />
        </TabsContent>

        {/* Calls Tab Content */}
        <TabsContent
          value="calls"
          className="flex-1 m-0 p-0 overflow-hidden"
        >
          <CallHistoryTab
            calls={calls}
            currentUserId={currentUserId}
            users={users}
            onSelectCall={onSelectCall}
            onDeleteCall={onDeleteCall}
            onReplayCall={onReplayCall}
            isLoading={isLoadingCalls}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default MessageCallsHub;
