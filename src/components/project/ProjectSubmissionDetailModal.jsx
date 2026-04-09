/**
 * Project Submission Detail Modal
 * For PM/Admin to review and approve/reject submissions with professional details
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
import { Loader2, Check, X, FileText, ExternalLink, CheckCircle } from 'lucide-react';

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
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{submission.project?.title}</DialogTitle>
              <DialogDescription>Project submission for approval</DialogDescription>
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

        <div className="space-y-6">
          {/* Submission Header Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Submitted By</p>
              <p className="font-medium">{submission.submitterName}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Date</p>
              <p className="font-medium">
                {submission.submittedAt ? new Date(submission.submittedAt).toLocaleDateString() : '-'}
              </p>
            </div>
          </div>

          {/* Basic Completion Notes */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Completion Notes</h3>
            <p className="text-sm text-muted-foreground p-3 bg-muted rounded">
              {submission.submissionNotes}
            </p>
          </div>

          {/* Professional Details Section */}
          {submission.completionSummary && (
            <>
              {/* Completion Summary */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Completion Summary</h3>
                <p className="text-sm text-muted-foreground p-3 bg-muted rounded whitespace-pre-wrap">
                  {submission.completionSummary}
                </p>
              </div>

              {/* Project Link */}
              {submission.projectLink && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Project Link</h3>
                  <a
                    href={submission.projectLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
                  >
                    {submission.projectLink}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Completion Checklist */}
              {submission.completionChecklist && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Completion Checklist
                  </h3>
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {submission.completionChecklist}
                  </div>
                </div>
              )}

              {/* Deliverables */}
              {submission.deliverables && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Deliverables</h3>
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {submission.deliverables}
                  </div>
                </div>
              )}

              {/* Next Steps */}
              {submission.nextSteps && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Next Steps</h3>
                  <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {submission.nextSteps}
                  </div>
                </div>
              )}

              {/* Project Documentation */}
              {submission.projectDocumentation && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Project Documentation
                    <span className="ml-auto text-xs font-normal bg-muted px-2 py-1 rounded">PDF</span>
                  </h3>
                  <div className="rounded-lg border border-input p-4 bg-muted/30 space-y-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-6 w-6 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {submission.documentationFileName || 'project-documentation.pdf'}
                        </p>
                        <p className="text-xs text-muted-foreground">PDF Document</p>
                      </div>
                    </div>

                    {/* PDF Viewer */}
                    <div className="rounded-lg border border-input bg-white dark:bg-slate-900 overflow-hidden">
                      <iframe
                        src={submission.projectDocumentation}
                        className="w-full h-[500px] rounded-lg"
                        title="Project Documentation PDF"
                        style={{ border: 'none' }}
                      />
                    </div>

                    {/* Download Button */}
                    <a
                      href={submission.projectDocumentation}
                      download={submission.documentationFileName || 'project-documentation.pdf'}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium transition"
                    >
                      <FileText className="h-4 w-4" />
                      Download PDF
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Rejection Reason if Rejected */}
          {submission.status === 'rejected' && submission.rejectionReason && (
            <div>
              <label className="text-xs font-medium text-red-600">REJECTION REASON</label>
              <p className="text-sm mt-1 p-3 bg-red-50 dark:bg-red-950/30 rounded border border-red-200 dark:border-red-800">
                {submission.rejectionReason}
              </p>
            </div>
          )}

          {/* Approval/Rejection Actions */}
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
                    Approve Project
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
            <div className="space-y-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-4">
              <label className="text-sm font-medium">Rejection Reason *</label>
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
