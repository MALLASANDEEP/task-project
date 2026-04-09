/**
 * Project Submission Detail Modal
 * For PM/Admin to approve or reject submissions
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  approveProjectSubmission,
  rejectProjectSubmission,
} from '@/services/api';
import { Loader2, Check, X } from 'lucide-react';

export function ProjectSubmissionDetailModal({
  isOpen = false,
  onClose = () => {},
  submission,
  onStatusChange = () => {},
}) {
  const { toast } = useToast();
  const { can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    try {
      setLoading(true);
      await approveProjectSubmission(submission.id);
      toast({
        title: 'Approved',
        description: 'Project submission approved',
      });
      onStatusChange?.();
      onClose?.();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: 'Please provide rejection reason',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await rejectProjectSubmission(submission.id, rejectionReason);
      toast({
        title: 'Rejected',
        description: 'Project submission rejected',
      });
      onStatusChange?.();
      onClose?.();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!submission) return null;

  const canApprove = can('projects:approve');
  const isPending = submission.status === 'pending';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>{submission.project?.title}</DialogTitle>
              <DialogDescription>Project submission details</DialogDescription>
            </div>
            <Badge className={`${
              submission.status === 'pending' ? 'bg-yellow-500' :
              submission.status === 'approved' ? 'bg-green-500' :
              'bg-red-500'
            } text-white capitalize`}>
              {submission.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Submission Info */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              SUBMITTED BY
            </label>
            <p className="text-sm">{submission.submitterName}</p>
          </div>

          {/* Submission Notes */}
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              COMPLETION NOTES
            </label>
            <p className="text-sm mt-1 p-3 bg-muted rounded">
              {submission.submissionNotes}
            </p>
          </div>

          {/* Rejection Reason if Rejected */}
          {submission.status === 'rejected' && submission.rejectionReason && (
            <div>
              <label className="text-xs font-medium text-red-600">
                REJECTION REASON
              </label>
              <p className="text-sm mt-1 p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                {submission.rejectionReason}
              </p>
            </div>
          )}

          {/* Approval Form */}
          {canApprove && isPending && !showRejectForm && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                variant="outline"
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          )}

          {/* Rejection Form */}
          {canApprove && isPending && showRejectForm && (
            <div className="space-y-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-3">
              <label className="text-sm font-medium">Rejection Reason</label>
              <Textarea
                placeholder="Explain why project submission is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[80px]"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleReject}
                  disabled={loading}
                  variant="destructive"
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    'Confirm Rejection'
                  )}
                </Button>
                <Button
                  onClick={() => setShowRejectForm(false)}
                  variant="outline"
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectSubmissionDetailModal;
