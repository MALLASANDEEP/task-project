/**
 * Deployment Detail Modal Component
 * Shows full deployment details, approval, and deployment options
 */

import { useState, useEffect } from 'react';
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
  getDeploymentItems,
  getDeploymentLogs,
  approveDeployment,
  rejectDeployment,
  deployToEnvironment,
} from '@/services/api';
import { Loader2, AlertCircle, Check, X, Send, Clock, User, ExternalLink, Zap, CheckCircle, BookOpen, AlertTriangle, Link2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-500' },
  approved: { label: 'Approved', color: 'bg-blue-500' },
  rejected: { label: 'Rejected', color: 'bg-red-500' },
  deployed: { label: 'Deployed', color: 'bg-green-500' },
  failed: { label: 'Failed', color: 'bg-red-600' },
  reverted: { label: 'Reverted', color: 'bg-orange-500' },
};

const ENV_CONFIG = {
  staging: { label: 'Staging' },
  test: { label: 'Testing' },
  preview: { label: 'Preview' },
  production: { label: 'Production' },
};

export function DeploymentDetailModal({
  isOpen = false,
  onClose = () => {},
  deployment,
  requesterName = 'Unknown',
  onStatusChange = () => {},
}) {
  const { toast } = useToast();
  const { can } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState('staging');

  useEffect(() => {
    if (isOpen && deployment) {
      loadData();
    }
  }, [isOpen, deployment?.id]);

  const loadData = async () => {
    try {
      const [itemsData, logsData] = await Promise.all([
        getDeploymentItems(deployment.id),
        getDeploymentLogs(deployment.id),
      ]);
      setItems(itemsData);
      setLogs(logsData);
    } catch (err) {
      console.error('Error loading deployment details:', err);
    }
  };

  const handleApprove = async () => {
    try {
      setLoading(true);
      await approveDeployment(deployment.id, approvalNotes);
      toast({ title: 'Deployment approved' });
      onStatusChange?.();
      setShowApprovalForm(false);
      setApprovalNotes('');
      loadData();
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
        title: 'Please provide a rejection reason',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await rejectDeployment(deployment.id, rejectionReason);
      toast({ title: 'Deployment rejected' });
      onStatusChange?.();
      setShowRejectionForm(false);
      setRejectionReason('');
      loadData();
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

  const handleDeploy = async () => {
    try {
      setLoading(true);
      await deployToEnvironment(deployment.id, selectedEnv);
      toast({ title: 'Deployment started', description: `Deploying to ${selectedEnv}...` });
      onStatusChange?.();
      loadData();
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

  const statusConfig = STATUS_CONFIG[deployment?.status] || STATUS_CONFIG.pending;
  const canApproveReject = can('deployments:approve') && deployment?.status === 'pending';
  const canDeploy = can('deployments:deploy') && deployment?.status === 'approved';

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Deployment Details</DialogTitle>
              <DialogDescription>
                {deployment?.environment} • {deployment?.status}
              </DialogDescription>
            </div>
            <Badge className={`${statusConfig.color} text-white`}>
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground">
              {deployment?.description}
            </p>
          </div>

          {/* Deployment Link */}
          {deployment?.deploymentLink && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Deployment Link
              </h3>
              <a
                href={deployment.deploymentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
              >
                {deployment.deploymentLink}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Change Notes */}
          {deployment?.changeNotes && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                What's New / Changelog
              </h3>
              <div className="rounded-lg bg-muted/50 p-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {deployment.changeNotes}
              </div>
            </div>
          )}

          {/* Pre-Deployment Checklist */}
          {deployment?.preDeploymentChecklist && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Pre-Deployment Checklist
              </h3>
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {deployment.preDeploymentChecklist}
              </div>
            </div>
          )}

          {/* Expected Downtime */}
          {deployment?.expectedDowntime && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Expected Downtime
              </h3>
              <p className="text-sm bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-yellow-800 dark:text-yellow-200">
                {deployment.expectedDowntime}
              </p>
            </div>
          )}

          {/* Post-Deployment Instructions */}
          {deployment?.postDeploymentInstructions && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Post-Deployment Instructions
              </h3>
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {deployment.postDeploymentInstructions}
              </div>
            </div>
          )}

          {/* Project Documentation */}
          {deployment?.projectDocumentation && (
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Project Documentation
                <span className="ml-auto text-xs font-normal bg-muted px-2 py-1 rounded">
                  PDF
                </span>
              </h3>
              <div className="rounded-lg border border-input p-4 bg-muted/30 space-y-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-6 w-6 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {deployment.documentationFileName || 'project-documentation.pdf'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF Document
                    </p>
                  </div>
                </div>

                {/* PDF Viewer */}
                {deployment.projectDocumentation && (
                  <div className="rounded-lg border border-input bg-white dark:bg-slate-900 overflow-hidden">
                    <iframe
                      src={deployment.projectDocumentation}
                      className="w-full h-[500px] rounded-lg"
                      title="Project Documentation PDF"
                      style={{ border: 'none' }}
                    />
                  </div>
                )}

                {/* Download Button */}
                <a
                  href={deployment.projectDocumentation}
                  download={deployment.documentationFileName || 'project-documentation.pdf'}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-medium transition"
                >
                  <FileText className="h-4 w-4" />
                  Download PDF
                </a>
              </div>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Requested By</p>
              <p className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                {requesterName}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Environment</p>
              <Badge variant="outline">
                {ENV_CONFIG[deployment?.environment]?.label}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground">Requested At</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {formatDate(deployment?.requestedAt)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{statusConfig.label}</p>
            </div>
          </div>

          {/* Rejection Note */}
          {deployment?.status === 'rejected' && deployment?.notesRejection && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
              <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                Rejection Reason
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {deployment.notesRejection}
              </p>
            </div>
          )}

          {/* Included Tasks */}
          {items.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Included Tasks</h3>
              <div className="space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-input p-2 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span>{item.task?.title || 'Unknown Task'}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.task?.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          {logs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Activity Timeline</h3>
              <div className="space-y-3 max-h-[200px] overflow-y-auto">
                {logs.map(log => (
                  <div
                    key={log.id}
                    className="flex gap-3 text-xs pb-3 border-b border-border last:border-0"
                  >
                    <div className="w-12 text-right text-muted-foreground">
                      {formatDate(log.timestamp)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{log.userName}</p>
                      <p className="text-muted-foreground">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approval Form */}
          {canApproveReject && !showRejectionForm && (
            <>
              {!showApprovalForm ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowApprovalForm(true)}
                    className="flex-1"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRejectionForm(true)}
                    className="flex-1 text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-input bg-muted/50 p-3">
                  <label className="text-sm font-medium">Approval Notes (Optional)</label>
                  <Textarea
                    placeholder="Add any notes or approval instructions..."
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleApprove}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Confirm Approval
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowApprovalForm(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Rejection Form */}
          {canApproveReject && !showApprovalForm && (
            <>
              {!showRejectionForm ? null : (
                <div className="space-y-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3">
                  <label className="text-sm font-medium">Rejection Reason</label>
                  <Textarea
                    placeholder="Explain why this deployment is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleReject}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Confirm Rejection
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRejectionForm(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Deploy Form */}
          {canDeploy && (
            <div className="space-y-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
              <label className="text-sm font-medium">Select Environment to Deploy</label>
              <select
                value={selectedEnv}
                onChange={(e) => setSelectedEnv(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="staging">Staging</option>
                <option value="test">Testing</option>
                <option value="preview">Preview</option>
              </select>
              <Button
                size="sm"
                onClick={handleDeploy}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Deploy Now
                  </>
                )}
              </Button>
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

export default DeploymentDetailModal;
