import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { roleLabel } from '@/lib/rbac';
import * as api from '@/services/api';
export default function SettingsPage() {
    const { user, updateProfile } = useAuth();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [isChangingPw, setIsChangingPw] = useState(false);
    const { toast } = useToast();
    const handleProfile = (e) => {
        e.preventDefault();
      updateProfile({ name, email })
        .then((ok) => {
        if (ok) {
          toast({ title: 'Profile updated' });
          return;
        }
        toast({ title: 'Unable to update profile', variant: 'destructive' });
      })
        .catch(() => toast({ title: 'Unable to update profile', variant: 'destructive' }));
    };
    const handlePassword = async (e) => {
        e.preventDefault();
        if (!currentPw.trim()) {
            toast({ title: 'Current password is required', variant: 'destructive' });
            return;
        }
        if (!newPw.trim()) {
            toast({ title: 'New password is required', variant: 'destructive' });
            return;
        }
        if (newPw.length < 6) {
            toast({ title: 'New password must be at least 6 characters', variant: 'destructive' });
            return;
        }
        if (newPw !== confirmPw) {
            toast({ title: 'Passwords do not match', variant: 'destructive' });
            return;
        }
        setIsChangingPw(true);
        try {
            await api.changePassword(currentPw, newPw);
            toast({ title: 'Password updated successfully' });
            setCurrentPw('');
            setNewPw('');
            setConfirmPw('');
        }
        catch (error) {
            toast({ title: String(error?.message || 'Failed to change password'), variant: 'destructive' });
        }
        finally {
            setIsChangingPw(false);
        }
    };
    return (<div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your profile and preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">Profile Information</CardTitle><CardDescription>Update your name and email</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handleProfile} className="space-y-4">
            <div className="space-y-2"><Label>Full Name</Label><Input value={name} onChange={e => setName(e.target.value)}/></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)}/></div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={user?.role ? roleLabel(user.role) : 'Unknown'} disabled/>
            </div>
            <Button type="submit">Save Changes</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Change Password</CardTitle><CardDescription>Update your account password</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} disabled={isChangingPw} required/></div>
            <Separator />
            <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} disabled={isChangingPw} required minLength={6}/></div>
            <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} disabled={isChangingPw} required/></div>
            <Button type="submit" disabled={isChangingPw}>{isChangingPw ? 'Updating...' : 'Update Password'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>);
}

