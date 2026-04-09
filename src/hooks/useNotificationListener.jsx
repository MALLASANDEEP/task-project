import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/services/api';
import { toast } from 'sonner';

/**
 * Hook that listens for incoming messages and calls
 * Shows notifications that redirect to Messages page when clicked
 */
export function useNotificationListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    // Listen for communication events
    const unsubscribe = api.subscribeCommunicationEvents((event) => {
      // Handle new messages
      if (event.type === 'message:new' && event.message) {
        const message = event.message;

        // Don't show notification for own messages
        if (message.senderId === user.id) return;

        // Show notification with redirect capability
        toast.custom((t) => (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-background p-4 border border-border shadow-lg">
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">New Message</p>
              <p className="text-xs text-muted-foreground mt-1">{message.content?.substring(0, 60) || 'You received a new message'}</p>
            </div>
            <button
              onClick={() => {
                navigate(`/messages?conversation=${message.conversationId}`);
                toast.dismiss(t);
              }}
              className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              View
            </button>
          </div>
        ), {
          duration: 10000,
          position: 'top-right',
        });
      }

      // Handle call updates (incoming/missed calls)
      if (event.type === 'call:update' && event.call) {
        const call = event.call;

        // Don't show notification for own calls
        if (call.initiatedBy === user.id) return;

        // Show notification for incoming active calls
        if (call.status === 'active' || call.status === 'ringing') {
          const callType = call.type === 'video' ? 'Video' : 'Audio';

          toast.custom((t) => (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background p-4 border border-border shadow-lg">
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Incoming {callType} Call</p>
                <p className="text-xs text-muted-foreground mt-1">{callType.toLowerCase()} call from participant</p>
              </div>
              <button
                onClick={() => {
                  navigate('/messages?tab=calls');
                  toast.dismiss(t);
                }}
                className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Answer
              </button>
            </div>
          ), {
            duration: 30000,
            position: 'top-right',
          });
        }

        // Show notification for missed calls
        if (call.status === 'ended' && !call.answeredBy?.includes(user.id)) {
          toast.custom((t) => (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-background p-4 border border-border shadow-lg">
              <div className="flex-1">
                <p className="font-semibold text-foreground text-sm">Missed Call</p>
                <p className="text-xs text-muted-foreground mt-1">You missed a {call.type} call</p>
              </div>
              <button
                onClick={() => {
                  navigate('/messages?tab=calls');
                  toast.dismiss(t);
                }}
                className="flex-shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                View
              </button>
            </div>
          ), {
            duration: 10000,
            position: 'top-right',
          });
        }
      }
    });

    return unsubscribe;
  }, [user?.id, navigate, location.pathname]);
}
