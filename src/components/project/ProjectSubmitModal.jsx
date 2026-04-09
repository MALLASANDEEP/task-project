/**
 * Project Submit Modal
 * Simple modal for project submission
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
import { useToast } from '@/hooks/use-toast';
import { submitProject } from '@/services/api';
import { Loader2 } from 'lucide-react';

export function ProjectSubmitModal({
  isOpen = false,
  onClose = () => {},
  projectId,
  projectTitle = 'Project',
  onSuccess = () => {},
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!notes.trim()) {
      toast({ title: 'Please add completion notes', variant: 'destructive' });
      return;
    }

    try {
      setLoading(true);
      await submitProject(projectId, notes);
      toast({
        title: 'Success',
        description: 'Project submitted for approval',
      });
      setNotes('');
      onSuccess?.();
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Submit Project: {projectTitle}</DialogTitle>
          <DialogDescription>
            Complete this form to submit your project for approval by Project Manager or Admin
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Completion Notes</label>
            <Textarea
              placeholder="Describe what has been completed, any notes for the reviewer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-2 min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
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
