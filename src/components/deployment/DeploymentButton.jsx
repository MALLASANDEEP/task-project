/**
 * Deployment Button Component
 * Trigger button for creating a deployment request
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import DeploymentRequestModal from './DeploymentRequestModal';

export function DeploymentButton({ className, projects = [] }) {
  const { can } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Only show if user can create deployments
  if (!can('deployments:create')) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className={className}
      >
        <Package className="h-4 w-4 mr-2" />
        Deploy
      </Button>

      <DeploymentRequestModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        projects={projects}
      />
    </>
  );
}

export default DeploymentButton;
