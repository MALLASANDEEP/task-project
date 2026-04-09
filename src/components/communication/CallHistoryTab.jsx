/**
 * Call History Tab Component
 * Displays past calls with professional styling
 */

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Video,
  Clock,
  Trash2,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function CallHistoryTab({
  calls = [],
  currentUserId,
  users = {},
  onSelectCall,
  onDeleteCall,
  onReplayCall,
  isLoading = false,
  emptyMessage = 'No calls yet'
}) {
  const { toast } = useToast();
  const [selectedCallId, setSelectedCallId] = useState(null);

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Get participant names
  const getParticipantNames = (participantIds = []) => {
    if (!Array.isArray(participantIds)) return 'Unknown';
    return participantIds
      .filter(id => id !== currentUserId)
      .map(id => users[id]?.name || `User ${id.slice(0, 4)}`)
      .join(', ') || 'You';
  };

  // Get status badge
  const getCallStatusBadge = (call) => {
    if (call.missedBy?.includes(currentUserId)) {
      return <Badge className="bg-red-500">Missed</Badge>;
    }
    if (call.rejectedBy) {
      return <Badge variant="secondary">Rejected</Badge>;
    }
    return <Badge variant="outline">Completed</Badge>;
  };

  // Handle copy details
  const handleCopyDetails = useCallback((call) => {
    const details = `Call: ${call.type === 'video' ? 'Video' : 'Audio'} | Duration: ${formatDuration(call.duration)} | Time: ${new Date(call.timestamp).toLocaleString()}`;
    navigator.clipboard.writeText(details);
    toast({ title: 'Call details copied!' });
  }, [toast]);

  // Handle delete
  const handleDelete = useCallback((callId) => {
    onDeleteCall?.(callId);
    toast({ title: 'Call removed from history' });
  }, [onDeleteCall, toast]);

  // Sorted calls
  const sortedCalls = useMemo(() => {
    return [...calls].sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    );
  }, [calls]);

  // Group by date
  const groupedCalls = useMemo(() => {
    const groups = {};
    sortedCalls.forEach(call => {
      const date = new Date(call.timestamp);
      const dateKey = date.toLocaleDateString([], {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(call);
    });
    return groups;
  }, [sortedCalls]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading call history...</p>
        </div>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Phone className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground font-medium">{emptyMessage}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Start a call to see history here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-3 bg-muted/30">
        <h2 className="font-semibold text-sm">
          Call History ({calls.length})
        </h2>
      </div>

      {/* Calls List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {Object.entries(groupedCalls).map(([dateKey, dateCalls]) => (
            <div key={dateKey}>
              {/* Date Header */}
              <p className="text-xs font-semibold text-muted-foreground uppercase px-2 mb-2">
                {dateKey}
              </p>

              {/* Call Items */}
              <div className="space-y-2">
                {dateCalls.map((call) => (
                  <div
                    key={call.id}
                    className={cn(
                      'group rounded-lg border border-border/30 p-3 transition-all hover:border-border/60 hover:bg-accent/40 cursor-pointer',
                      selectedCallId === call.id && 'border-primary/50 bg-primary/5'
                    )}
                    onClick={() => {
                      setSelectedCallId(call.id);
                      onSelectCall?.(call);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Icon & Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn(
                          'p-2 rounded-lg shrink-0',
                          call.type === 'video' ? 'bg-blue-500/10' : 'bg-green-500/10'
                        )}>
                          {call.type === 'video' ? (
                            <Video className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Phone className="h-4 w-4 text-green-600 dark:text-green-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">
                              {getParticipantNames(call.participants)}
                            </p>
                            {getCallStatusBadge(call)}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(call.duration)}
                            </span>
                            <span>{formatTime(call.timestamp)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyDetails(call);
                          }}
                          title="Copy details"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(call.id);
                          }}
                          title="Delete call"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border/50 px-4 py-3 bg-muted/20 text-center">
        <p className="text-xs text-muted-foreground">
          Showing {calls.length} call{calls.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

export default CallHistoryTab;
