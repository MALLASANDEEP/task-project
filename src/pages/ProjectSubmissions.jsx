/**
 * Project Submissions Page
 * View and approve/reject project submissions
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getProjectSubmissions } from '@/services/api';
import ProjectSubmissionDetailModal from '@/components/project/ProjectSubmissionDetailModal';
import { Package, Loader2, Search } from 'lucide-react';

export function ProjectSubmissionsPage() {
  const { toast } = useToast();
  const { user, can } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const data = await getProjectSubmissions({});
      setSubmissions(data);
    } catch (err) {
      toast({
        title: 'Error loading submissions',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = (status) => {
    return submissions
      .filter(s => (status ? s.status === status : true))
      .filter(s =>
        s.project?.title?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  };

  const pendingSubmissions = filterSubmissions('pending');
  const approvedSubmissions = filterSubmissions('approved');
  const rejectedSubmissions = filterSubmissions('rejected');

  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);
    setShowDetail(true);
  };

  const handleStatusChange = () => {
    loadSubmissions();
  };

  const SubCard = ({ submission }) => (
    <div
      onClick={() => handleViewDetails(submission)}
      className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium">{submission.project?.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            By {submission.submitterName}
          </p>
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {submission.submissionNotes}
          </p>
        </div>
        <Badge className={`${
          submission.status === 'pending' ? 'bg-yellow-500' :
          submission.status === 'approved' ? 'bg-green-500' :
          'bg-red-500'
        } text-white capitalize ml-2 shrink-0`}>
          {submission.status}
        </Badge>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Project Submissions
        </h1>
        <p className="text-muted-foreground mt-2">
          Review and approve project submissions
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            Pending
            {pendingSubmissions.length > 0 && (
              <span className="ml-2 bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {pendingSubmissions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            {approvedSubmissions.length > 0 && (
              <span className="ml-2 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {approvedSubmissions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected
            {rejectedSubmissions.length > 0 && (
              <span className="ml-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                {rejectedSubmissions.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Pending Tab */}
        <TabsContent value="pending" className="space-y-3">
          {pendingSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No pending submissions
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {pendingSubmissions.map(submission => (
                  <SubCard key={submission.id} submission={submission} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Approved Tab */}
        <TabsContent value="approved" className="space-y-3">
          {approvedSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No approved submissions
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {approvedSubmissions.map(submission => (
                  <SubCard key={submission.id} submission={submission} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Rejected Tab */}
        <TabsContent value="rejected" className="space-y-3">
          {rejectedSubmissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No rejected submissions
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {rejectedSubmissions.map(submission => (
                  <SubCard key={submission.id} submission={submission} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Modal */}
      <ProjectSubmissionDetailModal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        submission={selectedSubmission}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}

export default ProjectSubmissionsPage;
