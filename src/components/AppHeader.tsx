import { useState, useEffect } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Moon, Search, Sun } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Notification } from '@/types';
import * as api from '@/services/api';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export function AppHeader() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    let active = true;
    if (!user) {
      setNotifications([]);
      return;
    }

    api.getNotificationsForUser(user.id)
      .then((data) => {
        if (active) setNotifications(data);
      })
      .catch(() => {
        if (active) setNotifications([]);
      });

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = api.subscribeCommunicationEvents((event) => {
      if (event.type === 'call:update' && event.call.status === 'ringing' && event.call.participants.includes(user.id)) {
        toast({
          title: 'Incoming call',
          description: `You have an incoming ${event.call.type} call.`,
        });
      }
    });
    return unsubscribe;
  }, [user, toast]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.toggle('dark');
    setIsDark(root.classList.contains('dark'));
  };

  const markRead = async (id: string) => {
    await api.markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    if (!user) return;
    await api.markAllNotificationsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  return (
    <header className="sticky top-0 z-30 h-16 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 md:px-6 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground hidden md:block whitespace-nowrap">
          Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
        </span>
        <div className="relative hidden lg:block w-[26rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search tasks, projects, users" className="pl-9 h-10 rounded-xl border-border/70 bg-card/90 shadow-sm" aria-label="Global search" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-xl">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[22rem] p-0 rounded-2xl border-border/70">
            <div className="flex items-center justify-between p-3 border-b border-border/70">
              <p className="font-medium text-sm">Notifications</p>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={markAllRead}>
                  <Check className="h-3 w-3 mr-1" /> Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>}
              {notifications.map(n => (
                <button key={n.id} className={`w-full text-left p-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`} onClick={() => markRead(n.id)}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="hidden sm:flex items-center gap-2 rounded-xl border border-border/70 bg-card/90 px-2.5 py-1.5 shadow-sm">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/95 to-primary/70 text-primary-foreground flex items-center justify-center text-sm font-bold">
            {user?.name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate max-w-[120px]">{user?.name || 'User'}</p>
            <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{user?.email || ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
