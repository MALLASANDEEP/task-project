/**
 * Project Submit Modal
 * Enhanced modal for professional project submission with documentation
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { submitProject } from '@/services/api';
import { Loader2, AlertCircle, Link2, Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const PROJECT_COMPLETION_CHECKLIST_ITEMS = [
  { id: 'requirements', label: 'All requirements completed' },
  { id: 'testing', label: 'Testing completed and passed' },
  { id: 'code-review', label: 'Code review completed' },
  { id: 'documentation', label: 'Project documentation completed' },
  { id: 'bugs-fixed', label: 'All critical bugs fixed' },
  { id: 'deployment-ready', label: 'Ready for deployment' },
  { id: 'stakeholder-approval', label: 'Stakeholder approval received' },
  { id: 'backup', label: 'Backup plan documented' },
  { id: 'knowledge-transfer', label: 'Knowledge transfer completed' },
  { id: 'final-review', label: 'Final review passed' },
];

export function ProjectSubmitModal({
  isOpen = false,
  onClose = () => {},
  projectId,
  projectTitle = 'Project',
  projects = [],
  onSuccess = () => {},
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Project selection
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId)
    : null;

  // Basic fields
  const [notes, setNotes] = useState('');

  // Professional details
  const [projectLink, setProjectLink] = useState('');
  const [completionSummary, setCompletionSummary] = useState('');
  const [selectedChecklistItems, setSelectedChecklistItems] = useState([]);
  const [customChecklistItem, setCustomChecklistItem] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [nextSteps, setNextSteps] = useState('');

  // Documentation file
  const [projectDocFile, setProjectDocFile] = useState(null);
  const [projectDocFileBase64, setProjectDocFileBase64] = useState(null);

  const handleChecklistItemToggle = (itemId) => {
    setSelectedChecklistItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const generateChecklistText = () => {
    const items = selectedChecklistItems
      .map(id => {
        const item = PROJECT_COMPLETION_CHECKLIST_ITEMS.find(i => i.id === id);
        return `☑ ${item?.label || ''}`;
      })
      .filter(Boolean);

    if (customChecklistItem.trim()) {
      items.push(`☑ ${customChecklistItem.trim()}`);
    }

    return items.join('\n');
  };

  const handleDocumentationFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF only)
    if (file.type !== 'application/pdf') {
      toast({
        title: 'Invalid File Type',
        description: 'Only PDF files are supported',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'PDF file must be less than 10MB',
        variant: 'destructive',
      });
      return;
    }

    setProjectDocFile(file);

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result;
      setProjectDocFileBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const removeDocumentationFile = () => {
    setProjectDocFile(null);
    setProjectDocFileBase64(null);
  };

  const handleSubmit = async () => {
    setError('');

    if (!selectedProjectId) {
      setError('Please select a project');
      return;
    }

    if (!notes.trim()) {
      setError('Completion notes are required');
      return;
    }

    if (!projectLink.trim()) {
      setError('Project link is required');
      return;
    }

    if (!completionSummary.trim()) {
      setError('Completion summary is required');
      return;
    }

    if (selectedChecklistItems.length === 0 && !customChecklistItem.trim()) {
      setError('Please select at least one completion checklist item');
      return;
    }

    if (!deliverables.trim()) {
      setError('Deliverables list is required');
      return;
    }

    if (!nextSteps.trim()) {
      setError('Next steps are required');
      return;
    }

    if (!projectDocFile) {
      setError('Project documentation PDF is required');
      return;
    }

    try {
      setLoading(true);
      await submitProject(selectedProjectId, notes, {
        projectLink: projectLink.trim(),
        completionSummary: completionSummary.trim(),
        completionChecklist: generateChecklistText(),
        deliverables: deliverables.trim(),
        nextSteps: nextSteps.trim(),
        projectDocumentation: projectDocFileBase64,
        documentationFileName: projectDocFile?.name,
      });

      toast({
        title: 'Success',
        description: 'Project submitted for approval',
      });

      // Reset form
      setSelectedProjectId('');
      setNotes('');
      setProjectLink('');
      setCompletionSummary('');
      setSelectedChecklistItems([]);
      setCustomChecklistItem('');
      setDeliverables('');
      setNextSteps('');
      setProjectDocFile(null);
      setProjectDocFileBase64(null);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to submit project');
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {selectedProject ? `Submit Project: ${selectedProject.title}` : 'Submit Project'}
          </DialogTitle>
          <DialogDescription>
            {selectedProject ? 'Complete this comprehensive form to submit your project for approval' : 'Select and complete submission form for a project'}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-5">
          {/* Error Alert */}
          {error && (
            <div className="flex gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Project Selection */}
          {!projectId && (
            <div className="space-y-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
              <label className="text-sm font-semibold">Select Project to Submit *</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="">Choose a project...</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Select the project you want to submit for completion</p>
            </div>
          )}

          {selectedProjectId && (
            <>
          {/* Project Selection */}

          {/* Basic Section */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Project Submission Details</h3>

            {/* Completion Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Completion Notes *</label>
              <Textarea
                placeholder="Describe what has been completed, any notes for the reviewer..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Project Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Project Link/URL *
              </label>
              <Input
                type="url"
                placeholder="https://example.com/project"
                value={projectLink}
                onChange={(e) => setProjectLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Link to live project or repository</p>
            </div>
          </div>

          {/* Completion Details */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Completion Summary</h3>

            {/* Completion Summary */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Executive Summary *</label>
              <Textarea
                placeholder="Brief summary of project completion, achievements, and impact..."
                value={completionSummary}
                onChange={(e) => setCompletionSummary(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Completion Checklist */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Completion Checklist *</label>
              <p className="text-xs text-muted-foreground">Select items or add custom items</p>

              <div className="rounded-lg border border-input p-4 space-y-3 bg-muted/30">
                {PROJECT_COMPLETION_CHECKLIST_ITEMS.map(item => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedChecklistItems.includes(item.id)}
                      onChange={() => handleChecklistItemToggle(item.id)}
                      className="rounded border-input cursor-pointer"
                    />
                    <span className="text-sm">{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Custom Checklist Item */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Add Custom Item (Optional)</label>
                <Input
                  placeholder="e.g., Client approval obtained"
                  value={customChecklistItem}
                  onChange={(e) => setCustomChecklistItem(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          {/* Deliverables & Next Steps */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-sm font-semibold">Project Deliverables & Next Steps</h3>

            {/* Deliverables */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Deliverables List *</label>
              <Textarea
                placeholder="- Feature 1&#10;- Feature 2&#10;- Documentation&#10;- Test Suite&#10;- Deployment Guide"
                value={deliverables}
                onChange={(e) => setDeliverables(e.target.value)}
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">List all deliverables provided with this submission</p>
            </div>

            {/* Next Steps */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Next Steps *</label>
              <Textarea
                placeholder="1. Deployment to production&#10;2. User training&#10;3. Monitor and support&#10;4. Gather feedback"
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">Recommended next steps after approval</p>
            </div>
          </div>

          {/* Project Documentation */}
          <div className="border-t pt-4 space-y-3">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Project Documentation (PDF) *</label>
                <p className="text-xs text-muted-foreground mt-1">Import project documentation PDF file</p>
              </div>

              {!projectDocFile ? (
                <div className="border-2 border-dashed border-input rounded-lg p-6 hover:bg-muted/50 transition cursor-pointer">
                  <label className="flex flex-col items-center justify-center cursor-pointer">
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">Click to upload PDF</span>
                    <span className="text-xs text-muted-foreground mt-1">or drag and drop</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleDocumentationFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <div className="border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-green-600 dark:text-green-400 mt-1 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          {projectDocFile.name}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {(projectDocFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={removeDocumentationFile}
                      className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-green-700 dark:text-green-300">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleDocumentationFileChange}
                        className="hidden"
                      />
                      <span className="underline cursor-pointer hover:opacity-75">Change file</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-3">
                <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">📋 Requirements:</p>
                <ul className="space-y-1 text-blue-800 dark:text-blue-200">
                  <li>• PDF format only (.pdf)</li>
                  <li>• Maximum file size: 10 MB</li>
                  <li>• Include project overview, features, setup instructions, and deployment guide</li>
                </ul>
              </div>
            </div>
          </div>
            </>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectSubmitModal;
