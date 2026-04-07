import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as api from '@/services/api';
import { AlertTriangle, CheckCircle2, CircleDot, Clock3, FolderKanban, ListChecks, TrendingUp, } from 'lucide-react';
import { roleLabel } from '@/lib/rbac';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from 'recharts';
export default function Dashboard() {
    const { role, user } = useAuth();
    if (role === 'TEAM_MEMBER' && user) {
        return <MemberDashboard userId={user.id}/>;
    }
    return <WorkspaceDashboard role={role}/>;
}
function WorkspaceDashboard({ role }) {
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        const load = async () => {
            const [taskData, projectData] = await Promise.all([
                api.getTasks().catch(() => []),
                api.getProjects().catch(() => []),
            ]);
            setTasks(taskData);
            setProjects(projectData);
        };
        load();
    }, []);
    const now = Date.now();
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'completed').length;
    const pendingTasks = tasks.filter((t) => t.status !== 'completed').length;
    const overdueTasks = tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() < now).length;
    const statusData = [
        { name: 'To Do', value: tasks.filter((t) => t.status === 'pending').length, color: '#f59e0b' },
        { name: 'In Progress', value: tasks.filter((t) => t.status === 'in_progress').length, color: '#4f46e5' },
        { name: 'Done', value: tasks.filter((t) => t.status === 'completed').length, color: '#16a34a' },
    ];
    const productivityData = useMemo(() => {
        const base = [
            { label: 'Mon', completed: 0, created: 0 },
            { label: 'Tue', completed: 0, created: 0 },
            { label: 'Wed', completed: 0, created: 0 },
            { label: 'Thu', completed: 0, created: 0 },
            { label: 'Fri', completed: 0, created: 0 },
            { label: 'Sat', completed: 0, created: 0 },
            { label: 'Sun', completed: 0, created: 0 },
        ];
        tasks.forEach((task) => {
            const createdDate = new Date(task.createdAt);
            const completedDate = new Date(task.dueDate);
            const createdDay = createdDate.getDay();
            base[createdDay === 0 ? 6 : createdDay - 1].created += 1;
            if (task.status === 'completed') {
                const doneDay = completedDate.getDay();
                base[doneDay === 0 ? 6 : doneDay - 1].completed += 1;
            }
        });
        return base;
    }, [tasks]);
    return (<div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{roleLabel(role)} Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Live insights on project performance and delivery health.</p>
        </div>
        <Badge variant="outline" className="w-fit rounded-full border-primary/25 bg-primary/5 text-primary px-3 py-1">
          <TrendingUp className="mr-1 h-3.5 w-3.5"/>
          Productivity +12% this week
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Total Tasks" value={totalTasks} icon={ListChecks} color="text-primary" tone="bg-primary/10"/>
        <SummaryCard title="Completed Tasks" value={completedTasks} icon={CheckCircle2} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10"/>
        <SummaryCard title="Pending Tasks" value={pendingTasks} icon={Clock3} color="text-[hsl(var(--warning))]" tone="bg-[hsl(var(--warning))]/10"/>
        <SummaryCard title="Overdue Tasks" value={overdueTasks} icon={AlertTriangle} color="text-destructive" tone="bg-destructive/10"/>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Team Productivity</CardTitle>
            <CardDescription>Created vs completed tasks this week</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false}/>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }}/>
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12 }}/>
                <Tooltip contentStyle={{
            borderRadius: 12,
            borderColor: 'hsl(var(--border))',
            fontSize: 12,
        }}/>
                <Bar dataKey="created" radius={[8, 8, 0, 0]} fill="#818cf8"/>
                <Bar dataKey="completed" radius={[8, 8, 0, 0]} fill="#22c55e"/>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Task Progress</CardTitle>
            <CardDescription>Distribution across workflow stages</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {statusData.map((entry) => (<Cell key={entry.name} fill={entry.color}/>))}
                </Pie>
                <Tooltip contentStyle={{
            borderRadius: 12,
            borderColor: 'hsl(var(--border))',
            fontSize: 12,
        }}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 text-xs mt-2">
              {statusData.map((item) => (<div key={item.name} className="flex items-center gap-1.5 text-muted-foreground">
                  <CircleDot className="h-3.5 w-3.5" style={{ color: item.color }}/>
                  <span>{item.name}</span>
                </div>))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Tasks</CardTitle>
            <CardDescription>Latest updates from your workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.slice(0, 6).map((task) => (<div key={task.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={task.status}/>
              </div>))}
            {tasks.length === 0 && <EmptyState message="No tasks found yet. Create your first task to get started."/>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Projects Overview</CardTitle>
            <CardDescription>Project priority and delivery timeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.slice(0, 6).map((project) => (<div key={project.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                <div>
                  <p className="text-sm font-medium">{project.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(project.deadline).toLocaleDateString()}</p>
                </div>
                <PriorityBadge priority={project.priority}/>
              </div>))}
            {projects.length === 0 && <EmptyState message="No projects available for this workspace."/>}
          </CardContent>
        </Card>
      </div>
    </div>);
}
function MemberDashboard({ userId }) {
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        const load = async () => {
            const [taskData, projectData] = await Promise.all([
                api.getTasksForUser(userId).catch(() => []),
                api.getProjectsForUser(userId).catch(() => []),
            ]);
            setTasks(taskData);
            setProjects(projectData);
        };
        load();
    }, [userId]);
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const overdue = tasks.filter((t) => t.status !== 'completed' && new Date(t.dueDate).getTime() < Date.now()).length;
    return (<div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">My Work</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your assignments and keep delivery on schedule.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard title="Completed" value={completed} icon={CheckCircle2} color="text-[hsl(var(--success))]" tone="bg-[hsl(var(--success))]/10"/>
        <SummaryCard title="In Progress" value={inProgress} icon={Clock3} color="text-primary" tone="bg-primary/10"/>
        <SummaryCard title="Overdue" value={overdue} icon={AlertTriangle} color="text-destructive" tone="bg-destructive/10"/>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Tasks</CardTitle>
            <CardDescription>Tasks assigned to you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasks.map((task) => (<div key={task.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                </div>
                <StatusBadge status={task.status}/>
              </div>))}
            {tasks.length === 0 && <EmptyState message="No tasks assigned yet."/>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Projects</CardTitle>
            <CardDescription>Projects where you are a contributor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.map((project) => (<div key={project.id} className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 p-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <FolderKanban className="h-4 w-4"/>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">Due {new Date(project.deadline).toLocaleDateString()}</p>
                  </div>
                </div>
                <PriorityBadge priority={project.priority}/>
              </div>))}
            {projects.length === 0 && <EmptyState message="No projects assigned to your account."/>}
          </CardContent>
        </Card>
      </div>
    </div>);
}
function SummaryCard({ title, value, icon: Icon, tone, color, }) {
    return (<Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold mt-2">{value}</p>
          </div>
          <div className={`rounded-xl p-2.5 ${tone}`}>
            <Icon className={`h-5 w-5 ${color}`}/>
          </div>
        </div>
      </CardContent>
    </Card>);
}
function EmptyState({ message }) {
    return (<div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>);
}
export function StatusBadge({ status }) {
    const map = {
        pending: 'bg-[hsl(var(--warning))]/12 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/25',
        in_progress: 'bg-primary/10 text-primary border-primary/20',
        completed: 'bg-[hsl(var(--success))]/12 text-[hsl(var(--success))] border-[hsl(var(--success))]/25',
    };
    const labels = { pending: 'To Do', in_progress: 'In Progress', completed: 'Done' };
    return <Badge variant="outline" className={`text-[11px] rounded-full px-2.5 ${map[status] || ''}`}>{labels[status] || status}</Badge>;
}
export function PriorityBadge({ priority }) {
    const map = {
        high: 'bg-destructive/10 text-destructive border-destructive/25',
        medium: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/25',
        low: 'bg-muted text-muted-foreground border-border',
    };
    return <Badge variant="outline" className={`text-[11px] rounded-full capitalize px-2.5 ${map[priority] || ''}`}>{priority}</Badge>;
}

