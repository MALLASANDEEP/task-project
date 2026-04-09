/**
 * Project Submit Button Component
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ProjectSubmitModal from './ProjectSubmitModal';

export function ProjectSubmitButton({ projectId, disabled = false }) {
  const { can } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!can('projects:submit')) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="default"
        size="sm"
        disabled={disabled}
      >
        <Package className="h-4 w-4 mr-2" />
        Submit Project
      </Button>
      <ProjectSubmitModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        projectId={projectId}
      />
    </>
  );
}

export default ProjectSubmitButton;
