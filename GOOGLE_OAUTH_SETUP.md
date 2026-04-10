# Google OAuth Setup Guide

## Prerequisites
- Supabase project (with URL and anon key in `.env`)
- Google Cloud Console project

## Step 1: Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Enable the Google+ API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Web application"
   - Add authorized redirect URIs:
     - For local dev: `https://task-project-3frx.onrender.com`
     - For production: `https://yourdomain.com`
   - Copy your Client ID and Client Secret

## Step 2: Supabase Setup

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Authentication** > **Providers**
4. Find **Google** and click to configure
5. Enable Google provider
6. Paste your Google Client ID and Client Secret
7. Add redirect URLs (both will be used):
   - `https://task-project-3frx.onrender.com/auth/callback` (local dev)
   - `https://yourdomain.com/auth/callback` (production)
8. Save

## Step 3: Environment Variables

Make sure your `.env` file has:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 4: Start Your App

For local development on port 8081:
```bash
npm run dev
```

Visit `https://task-project-3frx.onrender.com/login` and click the Google button.

## Troubleshooting

**Error: "Unsafe attempt to load URL"**
- Make sure Supabase has `https://task-project-3frx.onrender.com/auth/callback` in authorized redirect URIs
- Clear browser cache and restart dev server

**Error: "OAuth provider not configured"**
- Go back to Step 2 and ensure Google provider is Enabled in Supabase
- Verify Client ID and Client Secret are correct

**Google button does nothing**
- Check browser console for errors
- Verify SUPABASE_URL and SUPABASE_ANON_KEY are set correctly
- Try incognito/private mode to clear cookies

## Local Development vs Production

The app automatically uses the current origin for OAuth redirect:
- Dev: `https://task-project-3frx.onrender.com/auth/callback`
- Production: `https://yourdomain.com/auth/callback`

**No configuration needed**—both URLs work as long as they're in Supabase's authorized list.

## Switching Between Dev Ports

If you run on a different port (e.g., 3000 instead of 8081), add that redirect URL to Supabase:
- `https://task-project-3frx.onrender.com/auth/callback`
