import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Layers, Github, Chrome } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FloatingInput } from '@/components/ui/floating-field';
import * as api from '@/services/api';
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const ok = await login(email, password);
        setLoading(false);
        if (ok) {
            navigate('/dashboard');
        }
        else {
            toast({ title: 'Login failed', description: 'Invalid email or password.', variant: 'destructive' });
        }
    };
    const handleGoogleSignIn = async () => {
        setOauthLoading(true);
        try {
            await api.initiateGoogleSignIn();
        }
        catch (error) {
            toast({ title: 'Google sign-in failed', description: String(error?.message || 'Unable to connect to Google'), variant: 'destructive' });
            setOauthLoading(false);
        }
    };
    return (<div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 subtle-grid opacity-25 pointer-events-none"/>
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Layers className="h-8 w-8"/>
            <span className="text-2xl font-bold tracking-tight">TaskFlow</span>
          </div>
          <p className="text-muted-foreground text-sm">Plan work, track progress, and deliver faster.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FloatingInput id="email" type="email" label="Email" value={email} onChange={e => setEmail(e.target.value)} required/>
              <FloatingInput id="password" type="password" label="Password" value={password} onChange={e => setPassword(e.target.value)} required/>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <Separator className="flex-1"/><span className="text-xs text-muted-foreground">OR</span><Separator className="flex-1"/>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="gap-2" onClick={handleGoogleSignIn} disabled={oauthLoading}>
                <Chrome className="h-4 w-4"/> {oauthLoading ? 'Signing...' : 'Google'}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'OAuth', description: 'GitHub sign-in coming soon.' })}>
                <Github className="h-4 w-4"/> GitHub
              </Button>
            </div>
          </CardContent>
          <CardFooter className="justify-center">
            <p className="text-sm text-muted-foreground">Don't have an account? <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link></p>
          </CardFooter>
        </Card>

        <div className="rounded-2xl border border-border/70 bg-card/80 p-4 text-xs text-muted-foreground space-y-1 shadow-sm">
          <p className="font-medium">Demo Credentials</p>
          <p>ADMIN: adithyayegiti93@gmail.com password: 123456</p>
         
        </div>
      </div>
    </div>);
}

