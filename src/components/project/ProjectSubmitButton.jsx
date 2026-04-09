/**
 * Project Submit Button Component
 * Can be used with a specific projectId or with a projects list for selection
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getProjects } from '@/services/api';
import ProjectSubmitModal from './ProjectSubmitModal';

export function ProjectSubmitButton({ projectId, disabled = false }) {
  const { can } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Load available projects when modal opens and no specific projectId
  useEffect(() => {
    if (isOpen && !projectId) {
      loadAvailableProjects();
    }
  }, [isOpen, projectId]);

  const loadAvailableProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await getProjects();
      // Filter to only projects that haven't been submitted yet
      const unsubmittedProjects = data.filter(p => p.projectStatus !== 'submitted' && p.projectStatus !== 'completed');
      setProjects(unsubmittedProjects);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  if (!can('projects:submit')) return null;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="default"
        size="sm"
        disabled={disabled || loadingProjects}
      >
        <Package className="h-4 w-4 mr-2" />
        {loadingProjects ? 'Loading...' : 'Submit Project'}
      </Button>
      <ProjectSubmitModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        projectId={projectId}
        projects={projects}
      />
    </>
  );
}

export default ProjectSubmitButton;
