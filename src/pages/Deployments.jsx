/**
 * Deployments Page Component
 * Main page for managing deployments with approval workflow
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getDeployments, getProjects } from '@/services/api';
import DeploymentButton from '@/components/deployment/DeploymentButton';
import DeploymentCard from '@/components/deployment/DeploymentCard';
import DeploymentDetailModal from '@/components/deployment/DeploymentDetailModal';
import {
  Package,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DeploymentsPage() {
  const { toast } = useToast();
  const { user, can } = useAuth();
  const [deployments, setDeployments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDeployment, setSelectedDeployment] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [userMap, setUserMap] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [deploymentsData, projectsData] = await Promise.all([
        getDeployments({}),
        getProjects(),
      ]);
      setDeployments(deploymentsData);
      setProjects(projectsData);

      // Build user map
      const users = {};
      deploymentsData.forEach(d => {
        if (d.requestedBy && !users[d.requestedBy]) {
          users[d.requestedBy] = `User ${d.requestedBy.slice(0, 4)}`;
        }
      });
      setUserMap(users);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load deployments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterDeployments = (status) => {
    return deployments
      .filter(d => status ? d.status === status : true)
      .filter(d =>
        d.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const pendingApprovals = filterDeployments('pending');
  const approvedDeployments = filterDeployments('approved');
  const allHistory = deployments.filter(d => searchTerm === '' || d.description.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleViewDetails = (deployment) => {
    setSelectedDeployment(deployment);
    setShowDetail(true);
  };

  const handleStatusChange = () => {
    loadData();
  };

  const canApproveDeploy = can('deployments:approve');

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border/50 bg-muted/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="h-6 w-6" />
              Deployments
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage project deployments and approval workflows
            </p>
          </div>
          <DeploymentButton projects={projects} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex flex-col">
          {/* Search Bar */}
          <div className="border-b border-border/50 px-6 py-3 bg-background">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search deployments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={loadData}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Refresh'
                )}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="pending" className="h-full flex flex-col">
              <TabsList className="w-full justify-start gap-2 rounded-none border-b border-border/50 bg-transparent p-4">
                <TabsTrigger
                  value="pending"
                  className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <Clock className="h-4 w-4" />
                  <span>Pending</span>
                  {pendingApprovals.length > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-xs font-semibold text-white">
                      {pendingApprovals.length}
                    </span>
                  )}
                </TabsTrigger>

                {canApproveDeploy && (
                  <TabsTrigger
                    value="approved"
                    className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <CheckCircle className="h-4 w-4" />
                    <span>Approved</span>
                    {approvedDeployments.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-blue-500 text-xs font-semibold text-white">
                        {approvedDeployments.length}
                      </span>
                    )}
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="history"
                  className="gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>History</span>
                </TabsTrigger>
              </TabsList>

              {/* Tab Contents */}
              <div className="flex-1 overflow-hidden">
                {/* Pending Approvals Tab */}
                <TabsContent value="pending" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-3">
                      {loading ? (
                        <div className="flex items-center justify-center h-32">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : pendingApprovals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                          <p className="text-sm text-muted-foreground">
                            No pending approvals
                          </p>
                        </div>
                      ) : (
                        pendingApprovals.map(deployment => (
                          <DeploymentCard
                            key={deployment.id}
                            deployment={deployment}
                            requesterName={
                              projects.find(p => p.id === deployment.projectId)?.title ||
                              'Unknown'
                            }
                            onClick={() => handleViewDetails(deployment)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Approved Deployments Tab */}
                {canApproveDeploy && (
                  <TabsContent value="approved" className="h-full m-0 p-0">
                    <ScrollArea className="h-full">
                      <div className="p-6 space-y-3">
                        {loading ? (
                          <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : approvedDeployments.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-32 text-center">
                            <CheckCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground">
                              No approved deployments pending deployment
                            </p>
                          </div>
                        ) : (
                          approvedDeployments.map(deployment => (
                            <DeploymentCard
                              key={deployment.id}
                              deployment={deployment}
                              requesterName={
                                projects.find(p => p.id === deployment.projectId)?.title ||
                                'Unknown'
                              }
                              onClick={() => handleViewDetails(deployment)}
                            />
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                )}

                {/* History Tab */}
                <TabsContent value="history" className="h-full m-0 p-0">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-3">
                      {loading ? (
                        <div className="flex items-center justify-center h-32">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      ) : allHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <Package className="h-12 w-12 text-muted-foreground/50 mb-3" />
                          <p className="text-sm text-muted-foreground">
                            No deployments found
                          </p>
                        </div>
                      ) : (
                        allHistory.map(deployment => (
                          <DeploymentCard
                            key={deployment.id}
                            deployment={deployment}
                            requesterName={
                              projects.find(p => p.id === deployment.projectId)?.title ||
                              'Unknown'
                            }
                            onClick={() => handleViewDetails(deployment)}
                          />
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      <DeploymentDetailModal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        deployment={selectedDeployment}
        requesterName={
          selectedDeployment
            ? projects.find(p => p.id === selectedDeployment.projectId)?.title ||
              'Unknown'
            : 'Unknown'
        }
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export default DeploymentsPage;
