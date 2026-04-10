import { useState, useEffect, useRef } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, LogOut, Moon, Search, Settings, Sun, Upload, UserPen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import * as api from '@/services/api';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { roleLabel } from '@/lib/rbac';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
export function AppHeader() {
    const { user, role, logout, updateProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
    const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
    const [profileName, setProfileName] = useState('');
    const [profileEmail, setProfileEmail] = useState('');
    const [profileImage, setProfileImage] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const fileInputRef = useRef(null);
    useEffect(() => {
        let active = true;
        if (!user) {
            setNotifications([]);
            return;
        }
        api.getNotificationsForUser(user.id)
            .then((data) => {
            if (active)
                setNotifications(data);
        })
            .catch(() => {
            if (active)
                setNotifications([]);
        });
        return () => {
            active = false;
        };
    }, [user]);
    useEffect(() => {
        if (!user)
            return;
        const timer = window.setInterval(() => {
            api.getNotificationsForUser(user.id)
                .then((data) => setNotifications(data))
                .catch(() => undefined);
        }, 3000);
        return () => {
            window.clearInterval(timer);
        };
    }, [user]);
    useEffect(() => {
        if (!user)
            return;
        const unsubscribe = api.subscribeCommunicationEvents((event) => {
          const isIncomingRing = event.type === 'call:update'
            && event.call?.status === 'ringing'
            && event.call.participants.includes(user.id)
            && event.call.initiatedBy !== user.id;
          if (isIncomingRing) {
                toast({
                    title: 'Incoming call',
                    description: `You have an incoming ${event.call.type} call.`,
                });
            }
          if (event.type === 'call:update' && event.callId) {
            toast({
              title: 'Call updated',
              description: 'A call status changed. Open Messages or Calls to join or continue.',
            });
          }
        });
        return unsubscribe;
    }, [user, toast]);
    useEffect(() => {
      setProfileName(user?.name || '');
      setProfileEmail(user?.email || '');
      setProfileImage(user?.avatarUrl || '');
    }, [user]);
    const unreadCount = notifications.filter(n => !n.read).length;
    const profileInitial = user?.name?.charAt(0).toUpperCase() ?? '?';
    const toggleTheme = () => {
        const root = document.documentElement;
        root.classList.toggle('dark');
        setIsDark(root.classList.contains('dark'));
    };
    const markRead = async (id) => {
        await api.markNotificationRead(id);
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };
    const handleNotificationClick = async (notification) => {
      await markRead(notification.id).catch(() => undefined);
      if (notification.linkPath) {
        navigate(notification.linkPath);
      }
    };
    const markAllRead = async () => {
        if (!user)
            return;
        await api.markAllNotificationsRead(user.id);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };
    const openProfileEditor = () => {
      setProfileName(user?.name || '');
      setProfileEmail(user?.email || '');
      setProfileImage(user?.avatarUrl || '');
      setIsProfileDialogOpen(true);
    };
    const onImageSelected = (event) => {
      const file = event.target.files?.[0];
      if (!file)
        return;
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Please choose an image file', variant: 'destructive' });
        return;
      }
      if (file.size > 1024 * 1024) {
        toast({ title: 'Image size must be 1MB or less', variant: 'destructive' });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setProfileImage(typeof reader.result === 'string' ? reader.result : '');
      };
      reader.readAsDataURL(file);
    };
    const saveProfile = async (event) => {
      event.preventDefault();
      if (!profileName.trim() || !profileEmail.trim()) {
        toast({ title: 'Name and email are required', variant: 'destructive' });
        return;
      }
      setIsSavingProfile(true);
      const updated = await updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
        avatarUrl: profileImage || null,
      });
      setIsSavingProfile(false);
      if (updated) {
        toast({ title: 'Profile updated' });
        setIsProfileDialogOpen(false);
        return;
      }
      toast({ title: 'Unable to update profile', variant: 'destructive' });
    };
    return (<header className="sticky top-0 z-30 h-16 flex items-center justify-between border-b border-border/60 bg-background/85 px-4 md:px-6 backdrop-blur-xl shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground hidden md:block whitespace-nowrap">
          Welcome back, <span className="font-medium text-foreground">{user?.name}</span>
        </span>
        <div className="relative hidden lg:block w-[26rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search tasks, projects, users" className="pl-9 h-10 rounded-xl border-border/70 bg-card/90 shadow-sm" aria-label="Global search"/>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={toggleTheme} aria-label="Toggle theme">
          {isDark ? <Sun className="h-4 w-4"/> : <Moon className="h-4 w-4"/>}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-xl">
              <Bell className="h-4 w-4"/>
              {unreadCount > 0 && (<Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-destructive text-destructive-foreground">
                  {unreadCount}
                </Badge>)}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[22rem] p-0 rounded-2xl border-border/70">
            <div className="flex items-center justify-between p-3 border-b border-border/70">
              <p className="font-medium text-sm">Notifications</p>
              {unreadCount > 0 && (<Button variant="ghost" size="sm" className="h-auto py-1 px-2 text-xs" onClick={markAllRead}>
                  <Check className="h-3 w-3 mr-1"/> Mark all read
                </Button>)}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && <p className="p-4 text-sm text-muted-foreground text-center">No notifications</p>}
              {notifications.map(n => (<button key={n.id} className={`w-full text-left p-3 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`} onClick={() => handleNotificationClick(n)}>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                  {(n.type === 'message' || n.type === 'mention') && n.linkPath ? (<p className="mt-1 text-[10px] font-medium text-primary">Go to message</p>) : null}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </button>))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open profile menu">
              <Avatar className="h-9 w-9 border border-border/70">
                <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || 'User'} />
                <AvatarFallback className="font-semibold">{profileInitial}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2">
            <DropdownMenuLabel className="px-2 py-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9 border border-border/70">
                  <AvatarImage src={user?.avatarUrl || ''} alt={user?.name || 'User'} />
                  <AvatarFallback className="font-semibold">{profileInitial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
                </div>
              </div>
              {role && <Badge variant="secondary" className="mt-2 text-[10px]">{roleLabel(role)}</Badge>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={openProfileEditor}>
              <UserPen className="h-4 w-4 mr-2" />
              Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your personal details and profile image.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 border border-border/70">
                <AvatarImage src={profileImage || ''} alt={profileName || 'User'} />
                <AvatarFallback className="font-semibold">{profileName?.charAt(0).toUpperCase() || profileInitial}</AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                {profileImage && (<Button type="button" variant="ghost" size="sm" onClick={() => setProfileImage('')}>
                    Remove
                  </Button>)}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onImageSelected} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsProfileDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>);
}

