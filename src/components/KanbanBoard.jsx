/**
 * Kanban Board Component
 * Real-time drag-and-drop task board with Socket.io sync
 * Uses native HTML5 drag-and-drop (no external DnD library)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import * as api from '@/services/api';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/hooks/use-toast';
import { extractErrorMessage } from '@/lib/rbac';
import { Plus, Search, MessageSquare, Pencil, Trash2, Clock } from 'lucide-react';

/**
 * KANBAN BOARD - Shows tasks in columns by status
 * Supports real-time sync via Socket.io
 */
export function KanbanBoard({ projectId }) {
  const { user, can } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [optimisticUpdates, setOptimisticUpdates] = useState({});

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [tasksData, usersData] = await Promise.all([
        api.getTasks(projectId),
        api.getUsers(),
      ]);
      setTasks(tasksData || []);
      setUsers(usersData || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast({
        title: 'Failed to load tasks',
        description: extractErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Join board room for real-time updates
  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit('task:join-board', projectId, user?.id);

    return () => {
      socket.emit('task:leave-board', projectId, user?.id);
    };
  }, [socket, projectId, user?.id]);

  // Real-time event listeners
  useEffect(() => {
    if (!socket) return;

    const handleTaskCreated = (payload) => {
      setTasks((prev) => [...prev, payload.task]);
      toast({ title: 'Task created', description: payload.task.title });
    };

    const handleTaskUpdated = (payload) => {
      const { taskId, changes } = payload;
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id === taskId) {
            return { ...task, ...changes.new };
          }
          return task;
        })
      );
    };

    const handleTaskMoved = (payload) => {
      const { taskId, changes } = payload;
      setTasks((prev) =>
        prev.map((task) => {
          if (task.id === taskId) {
            return { ...task, status: changes.new.status };
          }
          return task;
        })
      );
      // Clear optimistic update
      setOptimisticUpdates((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    };

    const handleTaskDeleted = (payload) => {
      const { taskId } = payload;
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    };

    socket.on('task:created', handleTaskCreated);
    socket.on('task:updated', handleTaskUpdated);
    socket.on('task:moved', handleTaskMoved);
    socket.on('task:deleted', handleTaskDeleted);

    return () => {
      socket.off('task:created', handleTaskCreated);
      socket.off('task:updated', handleTaskUpdated);
      socket.off('task:moved', handleTaskMoved);
      socket.off('task:deleted', handleTaskDeleted);
    };
  }, [socket, toast]);

  // Filter tasks by search
  useEffect(() => {
    const filtered = tasks.filter((task) => {
      const s = search.toLowerCase();
      return (
        task.title.toLowerCase().includes(s) ||
        task.description.toLowerCase().includes(s)
      );
    });
    setFilteredTasks(filtered);
  }, [tasks, search]);

  // Columns configuration
  const columns = [
    { key: 'pending', title: 'To Do', color: 'bg-slate-50' },
    { key: 'in_progress', title: 'In Progress', color: 'bg-blue-50' },
    { key: 'completed', title: 'Done', color: 'bg-green-50' },
  ];

  // Native HTML5 drag-and-drop handlers
  const handleDragStart = (e, taskId, currentStatus) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.setData('currentStatus', currentStatus);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    const oldStatus = e.dataTransfer.getData('currentStatus');

    if (!taskId || oldStatus === targetStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // OPTIMISTIC UI: Update immediately
    setOptimisticUpdates((prev) => ({
      ...prev,
      [taskId]: targetStatus,
    }));

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    // EMIT to server + persist
    try {
      socket?.emit('task:moved', {
        taskId,
        projectId,
        userId: user?.id,
        fromStatus: oldStatus,
        toStatus: targetStatus,
      });

      // Actual API call
      await api.updateTaskStatus(taskId, targetStatus);

      toast({ title: 'Task moved successfully' });
    } catch (error) {
      // ROLLBACK on error
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: oldStatus } : t))
      );

      toast({
        title: 'Failed to move task',
        description: extractErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const getUserName = (userId) =>
    users.find((u) => u.id === userId)?.name || 'Unknown';

  const getInitials = (name) =>
    name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const getDaysRemaining = (dueDate) => {
    const days = Math.ceil((new Date(dueDate) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d left`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading tasks...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-lg"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {columns.map((column) => {
            const columnTasks = filteredTasks
              .filter((task) => {
                const optimistic = optimisticUpdates[task.id];
                if (optimistic !== undefined) return optimistic === column.key;
                return task.status === column.key;
              })
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return (
              <div
                key={column.key}
                className={`${column.color} rounded-xl p-4 min-h-[600px] border border-border/40`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.key)}
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant="outline" className="rounded-full">
                    {columnTasks.length}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id, task.status)}
                      className="transition-all cursor-grab active:cursor-grabbing"
                    >
                      <TaskCard
                        task={task}
                        users={users}
                        getInitials={getInitials}
                        getDaysRemaining={getDaysRemaining}
                      />
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No tasks in this column
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
}

/**
 * Individual Task Card
 */
function TaskCard({ task, users, getInitials, getDaysRemaining }) {
  const assignee = users.find((u) => u.id === task.assigned_to);

  return (
    <Card className="bg-white hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm leading-4 flex-1">{task.title}</h4>
          <PriorityBadge priority={task.priority} />
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">
          {task.description}
        </p>

        {/* Assignee */}
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 border border-border/70">
            <AvatarImage src={assignee?.avatar_url} alt={assignee?.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
              {getInitials(assignee?.name || 'Unknown')}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">
            {assignee?.name || 'Unassigned'}
          </span>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{getDaysRemaining(task.due_date)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ priority }) {
  const variants = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
  };

  return (
    <Badge variant="secondary" className={`text-xs ${variants[priority] || ''}`}>
      {priority}
    </Badge>
  );
}
