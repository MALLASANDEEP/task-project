import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import * as api from '@/services/api';

export default function OAuthCallback() {
    const navigate = useNavigate();
    const { user, isAuthReady } = useAuth();
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(true);

    useEffect(() => {
        if (!isAuthReady) return;

        const processCallback = async () => {
            try {
                // Supabase automatically handles the OAuth params from URL
                // The session is established, now ensure profile exists
                const profile = await api.ensureProfileAfterOAuth();
                if (!profile) {
                    setError('Failed to create or fetch user profile');
                    setIsProcessing(false);
                    return;
                }

                // Redirect to dashboard
                setTimeout(() => {
                    navigate('/dashboard');
                }, 500);
            } catch (err) {
                console.error('[OAUTH_CALLBACK] Error:', err);
                setError(String(err?.message || 'OAuth callback failed'));
                setIsProcessing(false);
            }
        };

        if (user) {
            processCallback();
        } else {
            // Wait a bit more for auth to fully initialize
            const timer = setTimeout(() => {
                setError('Authentication failed. Please try again.');
                setIsProcessing(false);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [isAuthReady, user, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-8">
            <div className="w-full max-w-md space-y-6 text-center">
                {isProcessing ? (
                    <>
                        <div className="flex justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-r-transparent"/>
                        </div>
                        <p className="text-muted-foreground">Completing sign-in...</p>
                    </>
                ) : error ? (
                    <>
                        <p className="text-destructive font-medium">{error}</p>
                        <button
                            onClick={() => navigate('/login')}
                            className="text-primary hover:underline text-sm font-medium"
                        >
                            Back to login
                        </button>
                    </>
                ) : null}
            </div>
        </div>
    );
}
