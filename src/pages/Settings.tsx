import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { roleLabel } from '@/lib/rbac';

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const isViewer = user?.role === 'VIEWER';
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const { toast } = useToast();

  const handleProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      toast({ title: 'VIEWER role is read-only', variant: 'destructive' });
      return;
    }
    updateProfile({ name, email });
    toast({ title: 'Profile updated' });
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewer) {
      toast({ title: 'VIEWER role is read-only', variant: 'destructive' });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    // In real app: call api.changePassword(currentPw, newPw)
    toast({ title: 'Password changed', description: 'Connect your backend to persist this change.' });
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Profile Information</CardTitle><CardDescription>Update your name and email</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleProfile} className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={user?.role ? roleLabel(user.role) : 'Unknown'} disabled />
            </div>
            <Button type="submit" disabled={isViewer}>Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Change Password</CardTitle><CardDescription>Update your account password</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required /></div>
            <Separator />
            <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={6} /></div>
            <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required /></div>
            <Button type="submit" disabled={isViewer}>Update Password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
