export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'TEAM_MEMBER' | 'VIEWER';
export type UserStatus = 'active' | 'inactive';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  status: UserStatus;
  avatar?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  createdBy: string;
  assignedUsers: string[];
  deadline: string;
  priority: Priority;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: string[];
  projects: string[];
  createdAt: string;
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedTo: string;
  status: TaskStatus;
  priority: Priority;
  comments: Comment[];
  dueDate: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'task_assigned' | 'task_updated' | 'comment' | 'project_assigned';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}
