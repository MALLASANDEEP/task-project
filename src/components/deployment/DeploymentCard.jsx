/**
 * Deployment Card Component
 * Shows a deployment summary with status badge
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Package, Clock, User } from 'lucide-react';
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
  staging: { label: 'Staging', bg: 'bg-blue-100 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300' },
  test: { label: 'Testing', bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-300' },
  preview: { label: 'Preview', bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300' },
  production: { label: 'Production', bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-300' },
};

export function DeploymentCard({
  deployment,
  requesterName = 'Unknown',
  onClick = () => {},
  className,
}) {
  const statusConfig = STATUS_CONFIG[deployment.status] || STATUS_CONFIG.pending;
  const envConfig = ENV_CONFIG[deployment.environment] || ENV_CONFIG.staging;

  const formatDate = (dateString) => {
    if (!dateString) return 'Not yet';
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-4 cursor-pointer transition hover:shadow-md hover:border-primary/50',
        className
      )}
    >
      <div className="space-y-3">
        {/* Header: Status + Environment */}
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <Badge className={`${statusConfig.color} text-white`}>
              {statusConfig.label}
            </Badge>
            <Badge className={`${envConfig.bg} ${envConfig.text} border-0`}>
              {envConfig.label}
            </Badge>
          </div>
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Description */}
        <div>
          <p className="text-sm text-foreground line-clamp-2">
            {deployment.description}
          </p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="truncate">{requesterName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDate(deployment.requestedAt)}</span>
          </div>
        </div>

        {/* Rejection note */}
        {deployment.status === 'rejected' && deployment.notesRejection && (
          <div className="rounded bg-red-50 dark:bg-red-950/30 p-2 border border-red-200 dark:border-red-800">
            <p className="text-xs text-red-700 dark:text-red-400">
              <span className="font-medium">Rejection reason:</span> {deployment.notesRejection}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default DeploymentCard;
