/**
 * Deployment Request Modal Component
 * Modal for creating a new deployment request with professional details
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
import { createDeploymentRequest } from '@/services/api';
import { Loader2, AlertCircle, Link2, Upload, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ENVIRONMENTS = [
  { value: 'staging', label: 'Staging (QA Testing)' },
  { value: 'test', label: 'Testing/Dev' },
  { value: 'preview', label: 'Preview (Live Preview)' },
  { value: 'production', label: 'Production' },
];

const PRE_DEPLOYMENT_CHECKLIST_ITEMS = [
  { id: 'backup', label: 'Database backup completed' },
  { id: 'tests', label: 'All tests passing' },
  { id: 'code-review', label: 'Code reviewed and approved' },
  { id: 'performance', label: 'Performance benchmarks verified' },
  { id: 'security', label: 'Security review completed' },
  { id: 'dependencies', label: 'Dependencies updated and verified' },
  { id: 'config', label: 'Configuration validated for target environment' },
  { id: 'docs', label: 'Documentation updated' },
  { id: 'rollback', label: 'Rollback plan documented' },
  { id: 'communication', label: 'Team communication completed' },
];

export function DeploymentRequestModal({
  isOpen = false,
  onClose = () => {},
  projects = [],
  onSuccess = () => {},
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [environment, setEnvironment] = useState('staging');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Professional details fields (all required)
  const [deploymentLink, setDeploymentLink] = useState('');
  const [changeNotes, setChangeNotes] = useState('');
  const [preDeploymentChecklist, setPreDeploymentChecklist] = useState('');
  const [postDeploymentInstructions, setPostDeploymentInstructions] = useState('');
  const [expectedDowntime, setExpectedDowntime] = useState('');

  // Pre-deployment checklist selection state
  const [selectedChecklistItems, setSelectedChecklistItems] = useState([]);
  const [customChecklistItem, setCustomChecklistItem] = useState('');

  // Documentation file state
  const [projectDocFile, setProjectDocFile] = useState(null);
  const [projectDocFileBase64, setProjectDocFileBase64] = useState(null);

  const projectTasks = selectedProject
    ? projects.find(p => p.id === selectedProject)?.tasks || []
    : [];

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
        const item = PRE_DEPLOYMENT_CHECKLIST_ITEMS.find(i => i.id === id);
        return `☐ ${item?.label || ''}`;
      })
      .filter(Boolean);

    if (customChecklistItem.trim()) {
      items.push(`☐ ${customChecklistItem.trim()}`);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedProject) {
      setError('Please select a project');
      return;
    }

    if (!description.trim()) {
      setError('Please add a description');
      return;
    }

    if (!deploymentLink.trim()) {
      setError('Deployment link is required');
      return;
    }

    if (!changeNotes.trim()) {
      setError('Change notes/changelog is required');
      return;
    }

    if (selectedChecklistItems.length === 0 && !customChecklistItem.trim()) {
      setError('Please select at least one pre-deployment checklist item');
      return;
    }

    if (!projectDocFile) {
      setError('Project documentation PDF is required');
      return;
    }

    if (!postDeploymentInstructions.trim()) {
      setError('Post-deployment instructions are required');
      return;
    }

    if (!expectedDowntime.trim()) {
      setError('Expected downtime is required');
      return;
    }

    try {
      setLoading(true);
      await createDeploymentRequest(
        selectedProject,
        selectedTasks,
        environment,
        description,
        {
          deploymentLink: deploymentLink.trim(),
          changeNotes: changeNotes.trim(),
          preDeploymentChecklist: generateChecklistText(),
          postDeploymentInstructions: postDeploymentInstructions.trim(),
          expectedDowntime: expectedDowntime.trim(),
          projectDocumentation: projectDocFileBase64,
          documentationFileName: projectDocFile?.name,
        }
      );

      toast({
        title: 'Success',
        description: 'Deployment request created. Awaiting approval.',
      });

      // Reset form
      setSelectedProject('');
      setSelectedTasks([]);
      setEnvironment('staging');
      setDescription('');
      setDeploymentLink('');
      setChangeNotes('');
      setPreDeploymentChecklist('');
      setPostDeploymentInstructions('');
      setExpectedDowntime('');
      setSelectedChecklistItems([]);
      setCustomChecklistItem('');
      setProjectDocFile(null);
      setProjectDocFileBase64(null);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || 'Failed to create deployment request');
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskToggle = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create Deployment Request</DialogTitle>
          <DialogDescription>
            Submit a comprehensive deployment request with all necessary details for review
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Alert */}
          {error && (
            <div className="flex gap-3 rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Project Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Project *</label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedTasks([]);
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Select project...</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </div>

          {/* Task Selection */}
          {selectedProject && projectTasks.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">
                Tasks (Optional)
              </label>
              <p className="text-xs text-muted-foreground">Select specific tasks to include in this deployment</p>
              <div className="space-y-2 max-h-[150px] overflow-y-auto rounded-lg border border-input p-3 bg-muted/30">
                {projectTasks.map(task => (
                  <label
                    key={task.id}
                    className="flex items-center gap-2 cursor-pointer rounded p-2 hover:bg-muted transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTasks.includes(task.id)}
                      onChange={() => handleTaskToggle(task.id)}
                      className="rounded border-input"
                    />
                    <span className="text-sm flex-1">{task.title}</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                      {task.status}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Environment Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold">Deployment Environment *</label>
            <div className="space-y-2">
              {ENVIRONMENTS.map(env => (
                <label
                  key={env.value}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition',
                    environment === env.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-input hover:bg-muted'
                  )}
                >
                  <input
                    type="radio"
                    name="environment"
                    value={env.value}
                    checked={environment === env.value}
                    onChange={(e) => setEnvironment(e.target.value)}
                    className="rounded-full"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{env.label}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Description *</label>
            <Textarea
              placeholder="Explain the purpose of this deployment (what's being deployed, why, etc.)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-4">Professional Deployment Details *</h3>
            <p className="text-xs text-muted-foreground mb-4">All fields below are required for a complete deployment request</p>

            {/* Deployment Link */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Deployment Link/URL *
              </label>
              <Input
                type="url"
                placeholder="https://example.com/deployment"
                value={deploymentLink}
                onChange={(e) => setDeploymentLink(e.target.value)}
                className="text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Link to the deployed project or release</p>
            </div>

            {/* Change Notes */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">What's New / Changelog *</label>
              <Textarea
                placeholder="- New feature: User authentication&#10;- Bug fix: Login issue&#10;- Performance: Improved load time"
                value={changeNotes}
                onChange={(e) => setChangeNotes(e.target.value)}
                className="min-h-[80px] text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Summary of changes and improvements in this deployment</p>
            </div>

            {/* Pre-Deployment Checklist */}
            <div className="space-y-3 mb-4">
              <label className="text-sm font-medium">Pre-Deployment Checklist *</label>
              <p className="text-xs text-muted-foreground">Select items or add custom checks</p>

              {/* Predefined Checklist Items */}
              <div className="rounded-lg border border-input p-4 space-y-3 bg-muted/30">
                {PRE_DEPLOYMENT_CHECKLIST_ITEMS.map(item => (
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
                  placeholder="e.g., Notify stakeholders"
                  value={customChecklistItem}
                  onChange={(e) => setCustomChecklistItem(e.target.value)}
                  className="text-sm"
                />
              </div>

              {/* Preview */}
              {(selectedChecklistItems.length > 0 || customChecklistItem.trim()) && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">Preview:</p>
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {generateChecklistText()}
                  </div>
                </div>
              )}
            </div>

            {/* Post-Deployment Instructions */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">Post-Deployment Instructions *</label>
              <Textarea
                placeholder="1. Verify all services are running&#10;2. Run smoke tests&#10;3. Monitor error logs&#10;4. Notify stakeholders of completion"
                value={postDeploymentInstructions}
                onChange={(e) => setPostDeploymentInstructions(e.target.value)}
                className="min-h-[80px] text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Steps to perform after deployment to ensure success</p>
            </div>

            {/* Expected Downtime */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Expected Downtime *</label>
              <Input
                placeholder="e.g., 5-10 minutes, No downtime expected, 2 hours (scheduled)"
                value={expectedDowntime}
                onChange={(e) => setExpectedDowntime(e.target.value)}
                className="text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">Expected service downtime or maintenance window</p>
            </div>

            {/* Project Documentation */}
            <div className="border-t pt-4 space-y-3">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Project Documentation (PDF) *</label>
                  <p className="text-xs text-muted-foreground mt-1">Import project documentation PDF file from your computer</p>
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
                        required
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
                    <li>• Include project overview, features, and deployment guide</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
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
                Creating Request...
              </>
            ) : (
              'Create Deployment Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DeploymentRequestModal;
