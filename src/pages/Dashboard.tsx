import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/services/api';
import { Task, Project } from '@/types';
import { FolderKanban, ListChecks, Users, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { roleLabel } from '@/lib/rbac';

export default function Dashboard() {
  const { role, user } = useAuth();

  if (role === 'ADMIN' || role === 'PROJECT_MANAGER' || role === 'VIEWER') {
    return <InsightsDashboard role={role} />;
  }
  return <UserDashboard userId={user!.id} />;
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InsightsDashboard({ role }: { role: 'ADMIN' | 'PROJECT_MANAGER' | 'VIEWER' }) {
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.getDashboardStats().then(setStats);
    api.getTasks().then(setTasks);
    api.getProjects().then(setProjects);
  }, []);

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{roleLabel(role)} Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of project and task progress</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Projects" value={stats.totalProjects} icon={FolderKanban} color="bg-primary/10 text-primary" />
        <StatCard title="Total Tasks" value={stats.totalTasks} icon={ListChecks} color="bg-accent/10 text-accent" />
        <StatCard title="Active Users" value={stats.activeUsers} icon={Users} color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" />
        <StatCard title="Completed" value={stats.tasksByStatus.completed} icon={CheckCircle2} color="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Task Status Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(['pending', 'in_progress', 'completed'] as const).map(status => {
              const count = stats.tasksByStatus[status];
              const pct = stats.totalTasks ? Math.round((count / stats.totalTasks) * 100) : 0;
              const colors = { pending: 'bg-[hsl(var(--warning))]', in_progress: 'bg-primary', completed: 'bg-[hsl(var(--success))]' };
              const labels = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-sm"><span>{labels[status]}</span><span className="font-medium">{count} ({pct}%)</span></div>
                  <div className="h-2 rounded-full bg-muted"><div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Tasks</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{projects.find(p => p.id === t.projectId)?.title}</p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UserDashboard({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.getTasksForUser(userId).then(setTasks);
    api.getProjectsForUser(userId).then(setProjects);
  }, [userId]);

  const pending = tasks.filter(t => t.status === 'pending').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const completed = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Your tasks and project overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pending" value={pending} icon={Clock} color="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" />
        <StatCard title="In Progress" value={inProgress} icon={TrendingUp} color="bg-primary/10 text-primary" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} color="bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">My Projects</CardTitle></CardHeader>
          <CardContent>
            {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects assigned</p>}
            <div className="space-y-3">
              {projects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-muted-foreground">Due {new Date(p.deadline).toLocaleDateString()}</p></div>
                  <PriorityBadge priority={p.priority} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">My Tasks</CardTitle></CardHeader>
          <CardContent>
            {tasks.length === 0 && <p className="text-sm text-muted-foreground">No tasks assigned</p>}
            <div className="space-y-3">
              {tasks.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div><p className="text-sm font-medium">{t.title}</p><p className="text-xs text-muted-foreground">Due {new Date(t.dueDate).toLocaleDateString()}</p></div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
    in_progress: 'bg-primary/10 text-primary border-primary/20',
    completed: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
  };
  const labels: Record<string, string> = { pending: 'Pending', in_progress: 'In Progress', completed: 'Completed' };
  return <Badge variant="outline" className={`text-[10px] ${map[status] || ''}`}>{labels[status] || status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    high: 'bg-destructive/10 text-destructive border-destructive/20',
    medium: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20',
    low: 'bg-muted text-muted-foreground border-muted-foreground/20',
  };
  return <Badge variant="outline" className={`text-[10px] capitalize ${map[priority] || ''}`}>{priority}</Badge>;
}
