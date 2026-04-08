import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FloatingInput, FloatingTextarea } from '@/components/ui/floating-field';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Users, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage, roleLabel } from '@/lib/rbac';
import { PriorityBadge, StatusBadge } from '@/pages/Dashboard';
import * as api from '@/services/api';

export default function ProjectDetail() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const { user, can } = useAuth();
    const { toast } = useToast();
    const [project, setProject] = useState(null);
    const [members, setMembers] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [manager, setManager] = useState(null);
    const [loading, setLoading] = useState(true);
    const [taskDialogOpen, setTaskDialogOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const projectData = await api.getProjectById(projectId);
                setProject(projectData);
                
                // Get members - handles missing table gracefully
                const membersData = await api.getProjectMembers(projectId);
                setMembers(membersData || []);
                
                const tasksData = await api.getTasksForProject(projectId);
                setTasks(tasksData || []);
                
                const usersData = await api.getUsers();
                setUsers(usersData || []);
                
                const managerMember = membersData.find(m => m.role === 'manager');
                if (managerMember) {
                    const managerUser = usersData.find(u => u.id === managerMember.user_id);
                    setManager(managerUser || null);
                }
            } catch (error) {
                console.error('Error loading project:', error);
                toast({ title: extractErrorMessage(error), variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [projectId, toast]);

    const isManager = manager?.id === user?.id || can('projects:update');
    const projectMembers = members
        .filter(m => m.role === 'member')
        .map(m => {
            const u = users.find(user => user.id === m.user_id);
            return u ? { ...u, assignedAt: m.assigned_at } : null;
        })
        .filter(Boolean);

    if (loading || !project) {
        return <div className="flex items-center justify-center h-96">Loading...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => navigate('/projects')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{project.title}</h1>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Project Manager</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {manager ? (
                            <div className="space-y-2">
                                <p className="font-medium">{manager.name}</p>
                                <Badge variant="secondary" className="text-xs">PROJECT_MANAGER</Badge>
                                {can('projects:update') && (
                                    <Button variant="outline" size="sm" onClick={() => navigate('/projects')}>Change Manager</Button>
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No manager assigned</p>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Project Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div>
                            <p className="text-muted-foreground">Priority</p>
                            <PriorityBadge priority={project.priority} />
                        </div>
                        <div>
                            <p className="text-muted-foreground">Deadline</p>
                            <p className="font-medium">{new Date(project.deadline).toLocaleDateString()}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{projectMembers.length}</p>
                        <p className="text-xs text-muted-foreground">Assigned members</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Team Members</CardTitle>
                        <CardDescription>People assigned to this project</CardDescription>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {projectMembers.map(member => (
                            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-background/60">
                                <div>
                                    <p className="font-medium">{member.name}</p>
                                    <p className="text-xs text-muted-foreground">{member.email}</p>
                                </div>
                                <Badge variant="outline" className="text-xs"> TEAM_MEMBER</Badge>
                            </div>
                        ))}
                        {projectMembers.length === 0 && (
                            <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle>Tasks</CardTitle>
                        <CardDescription>Tasks in this project</CardDescription>
                    </div>
                    {isManager && (
                            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="gap-2">
                                        <Plus className="h-4 w-4" />
                                        Create Task
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create Task</DialogTitle>
                                        <DialogDescription>Assign a task to a team member</DialogDescription>
                                    </DialogHeader>
                                    <TaskForm projectId={projectId} members={projectMembers} onSave={() => {
                                        setTaskDialogOpen(false);
                                        // Reload tasks
                                        api.getTasksForProject(projectId).then(setTasks);
                                    }} />
                                </DialogContent>
                            </Dialog>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {tasks.map(task => (
                        <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-background/60">
                            <div>
                                <p className="font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={task.status} />
                                <PriorityBadge priority={task.priority} />
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <p className="text-sm text-muted-foreground">No tasks in this project yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function TaskForm({ projectId, members, onSave }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [dueDate, setDueDate] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {};
        if (!title.trim()) nextErrors.title = 'Task title is required';
        if (!dueDate) nextErrors.dueDate = 'Due date is required';
        if (!assignedTo) nextErrors.assignedTo = 'Assignee is required';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setIsLoading(true);
        try {
            await api.createTask({
                title,
                description,
                projectId,
                status: 'pending',
                priority,
                dueDate: new Date(dueDate).toISOString(),
                assignedTo
            });
            toast({ title: 'Task created and notification sent' });
            onSave();
        } catch (error) {
            toast({ title: extractErrorMessage(error), variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <FloatingInput label="Task Title" value={title} onChange={e => setTitle(e.target.value)} error={errors.title} />
            <FloatingTextarea label="Description" value={description} onChange={e => setDescription(e.target.value)} />
            <div className="grid grid-cols-2 gap-4">
                <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                </Select>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-11 rounded-xl border border-input px-3 py-2" />
            </div>
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
            <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Assign To" />
                </SelectTrigger>
                <SelectContent>
                    {members.map(member => (
                        <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {errors.assignedTo && <p className="text-xs text-destructive">{errors.assignedTo}</p>}
            <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Creating...' : 'Create Task'}
            </Button>
        </form>
    );
}
