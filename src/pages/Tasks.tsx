import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge, PriorityBadge } from '@/pages/Dashboard';
import * as api from '@/services/api';
import { Task, User, Project, Priority, TaskStatus } from '@/types';
import { Plus, Search, MessageSquare, Pencil, Trash2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';

export default function Tasks() {
  const { can, role, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [commentTask, setCommentTask] = useState<Task | null>(null);
  const { toast } = useToast();

  const load = () => {
    api.getTasks()
      .then(setTasks)
      .catch((error) => {
        toast({ title: extractErrorMessage(error), variant: 'destructive' });
      });
    api.getUsers().then(setUsers);
    api.getProjects().then(setProjects);
  };
  useEffect(load, [role, user]);

  const filtered = tasks.filter(t => {
    const s = search.toLowerCase();
    const matchSearch = t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s);
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    try {
      await api.updateTaskStatus(id, status);
      toast({ title: 'Task status updated' });
      load();
    } catch (error) {
      toast({ title: extractErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTask(id);
      toast({ title: 'Task deleted' });
      load();
    } catch (error) {
      toast({ title: extractErrorMessage(error), variant: 'destructive' });
    }
  };

  const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Unknown';
  const getProjectTitle = (id: string) => projects.find(p => p.id === id)?.title || 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{role === 'TEAM_MEMBER' ? 'My Tasks' : 'Tasks'}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {can('tasks:create') && (
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Task</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? 'Edit Task' : 'Create Task'}</DialogTitle></DialogHeader>
              <TaskForm users={users} projects={projects} task={editing} onSave={() => { setDialogOpen(false); setEditing(null); load(); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tasks…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All Priority</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(t => (
          <Card key={t.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{t.title}</p>
                    <StatusBadge status={t.status} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{t.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>Project: {getProjectTitle(t.projectId)}</span>
                    <span>Assigned: {getUserName(t.assignedTo)}</span>
                    <span>Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                    {t.comments.length > 0 && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.comments.length}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(role === 'TEAM_MEMBER') && t.status !== 'completed' && (
                    <Select value={t.status} onValueChange={v => handleStatusChange(t.id, v as TaskStatus)}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
                    </Select>
                  )}
                  {can('comments:add') && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCommentTask(t)}>
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  )}
                  {(can('tasks:update') || can('tasks:delete')) && (
                    <>
                      {can('tasks:update') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(t); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {can('tasks:delete') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!commentTask} onOpenChange={o => { if (!o) setCommentTask(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Comments — {commentTask?.title}</DialogTitle></DialogHeader>
          {commentTask && <CommentsSection task={commentTask} users={users} userId={user!.id} onCommentAdded={load} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskForm({ users, projects, task, onSave }: { users: User[]; projects: Project[]; task: Task | null; onSave: () => void }) {
  const { can, user } = useAuth();
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo || user?.id || '');
  const [priority, setPriority] = useState<Priority>(task?.priority || 'medium');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'pending');
  const [dueDate, setDueDate] = useState(task?.dueDate?.split('T')[0] || '');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (task) {
        await api.updateTask(task.id, { title, description, projectId, assignedTo, priority, status, dueDate: new Date(dueDate).toISOString() });
        toast({ title: 'Task updated' });
      } else {
        await api.createTask({ title, description, projectId, assignedTo, priority, status, dueDate: new Date(dueDate).toISOString() });
        toast({ title: 'Task created' });
      }
      onSave();
    } catch (error) {
      toast({ title: extractErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2"><Label>Title</Label><Input value={title} onChange={e => setTitle(e.target.value)} required /></div>
      <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Assign To</Label>
          <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!can('tasks:assign')}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{users.filter(u => u.status === 'active' && u.role === 'TEAM_MEMBER').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={v => setStatus(v as TaskStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required /></div>
      </div>
      <Button type="submit" className="w-full">{task ? 'Update' : 'Create'} Task</Button>
    </form>
  );
}

function CommentsSection({ task, users, userId, onCommentAdded }: { task: Task; users: User[]; userId: string; onCommentAdded: () => void }) {
  const [comment, setComment] = useState('');
  const { toast } = useToast();

  const handleAdd = async () => {
    if (!comment.trim()) return;
    try {
      await api.addComment(task.id, userId, comment.trim());
      setComment('');
      toast({ title: 'Comment added' });
      onCommentAdded();
    } catch (error) {
      toast({ title: extractErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="max-h-60 overflow-y-auto space-y-3">
        {task.comments.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>}
        {task.comments.map(c => (
          <div key={c.id} className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{users.find(u => u.id === c.userId)?.name || 'Unknown'}</p>
              <p className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</p>
            </div>
            <p className="text-sm mt-1">{c.content}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input placeholder="Add a comment…" value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        <Button size="icon" onClick={handleAdd}><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
