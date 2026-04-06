import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PriorityBadge } from '@/pages/Dashboard';
import * as api from '@/services/api';
import { Project, User, Priority } from '@/types';
import { Plus, Search, Calendar, Users, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';

export default function Projects() {
  const { role, can, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const { toast } = useToast();

  const load = () => {
    const pFn = role === 'TEAM_MEMBER' ? api.getProjectsForUser(user!.id) : api.getProjects();
    pFn.then(setProjects).catch((error) => {
      toast({ title: extractErrorMessage(error), variant: 'destructive' });
    });
    api.getUsers().then(setUsers);
  };
  useEffect(load, [role, user]);

  const filtered = projects.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === 'all' || p.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

  const handleDelete = async (id: string) => {
    try {
      await api.deleteProject(id);
      toast({ title: 'Project deleted' });
      load();
    } catch (error) {
      toast({ title: extractErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{role === 'TEAM_MEMBER' ? 'My Projects' : 'Projects'}</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        {can('projects:create') && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> New Project</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? 'Edit Project' : 'Create Project'}</DialogTitle></DialogHeader>
              <ProjectForm users={users} project={editing} onSave={() => { setDialogOpen(false); setEditing(null); load(); }} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(p => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{p.title}</CardTitle>
                <PriorityBadge priority={p.priority} />
              </div>
              <CardDescription className="line-clamp-2">{p.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.deadline).toLocaleDateString()}</span>
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.assignedUsers.length} members</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                {p.assignedUsers.slice(0, 3).map(uid => {
                  const u = users.find(u => u.id === uid);
                  return u ? <Badge key={uid} variant="secondary" className="text-[10px]">{u.name.split(' ')[0]}</Badge> : null;
                })}
                {p.assignedUsers.length > 3 && <Badge variant="secondary" className="text-[10px]">+{p.assignedUsers.length - 3}</Badge>}
              </div>
              {(can('projects:update') || can('projects:delete')) && (
                <div className="flex gap-2 pt-2 border-t">
                  {can('projects:update') && (
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setEditing(p); setDialogOpen(true); }}><Pencil className="h-3 w-3" />Edit</Button>
                  )}
                  {can('projects:delete') && (
                    <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3 w-3" />Delete</Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ProjectForm({ users, project, onSave }: { users: User[]; project: Project | null; onSave: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState(project?.title || '');
  const [description, setDescription] = useState(project?.description || '');
  const [priority, setPriority] = useState<Priority>(project?.priority || 'medium');
  const [deadline, setDeadline] = useState(project?.deadline?.split('T')[0] || '');
  const [assigned, setAssigned] = useState<string[]>(project?.assignedUsers || []);
  const { toast } = useToast();

  const toggle = (id: string) => setAssigned(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (project) {
        await api.updateProject(project.id, { title, description, priority, deadline: new Date(deadline).toISOString(), assignedUsers: assigned });
        toast({ title: 'Project updated' });
      } else {
        await api.createProject({ title, description, priority, deadline: new Date(deadline).toISOString(), assignedUsers: assigned, createdBy: user!.id });
        toast({ title: 'Project created' });
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
          <Label>Priority</Label>
          <Select value={priority} onValueChange={v => setPriority(v as Priority)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} required /></div>
      </div>
      <div className="space-y-2">
        <Label>Assign Members</Label>
        <div className="flex flex-wrap gap-2">
          {users.filter(u => u.role === 'TEAM_MEMBER' && u.status === 'active').map(u => (
            <Badge key={u.id} variant={assigned.includes(u.id) ? 'default' : 'outline'} className="cursor-pointer" onClick={() => toggle(u.id)}>
              {u.name}
            </Badge>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full">{project ? 'Update' : 'Create'} Project</Button>
    </form>
  );
}
