#!/usr/bin/env bash

# Jira-Like Upgrade - Getting Started Script
# This script helps you set up and test the new Jira features

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         Jira-Like Upgrade - Getting Started                   ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check dependencies
echo "📋 Checking dependencies..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 16+"
    exit 1
fi
echo "✓ Node.js $(node --version)"

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✓ npm $(npm --version)"

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "STEP 1: Apply Database Migration"
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "Instructions:"
echo "1. Open Supabase Dashboard"
echo "2. Navigate to SQL Editor"
echo "3. Create new query"
echo "4. Copy content from: supabase/migrations/006_jira_kanban_schema.sql"
echo "5. Paste into SQL Editor"
echo "6. Click 'Run'"
echo ""
read -p "❓ Migration applied? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please apply migration first. Exiting."
    exit 1
fi
echo "✓ Migration confirmed"

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "STEP 2: Environment Setup"
echo "═════════════════════════════════════════════════════════════════"
echo ""

# Check .env file
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating template..."
    cat > .env.local << 'EOF'
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Socket.io
SOCKET_PORT=8001
SOCKET_CORS_ORIGIN=https://task-project-3frx.onrender.com,https://task-project-3frx.onrender.com
EOF
    echo "📝 Created .env.local - Please update with your Supabase credentials"
    read -p "❓ Updated .env.local? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Please update .env.local and try again"
        exit 1
    fi
fi
echo "✓ Environment configured"

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "STEP 3: Install Dependencies (if needed)"
echo "═════════════════════════════════════════════════════════════════"
echo ""
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
else
    echo "✓ Dependencies already installed"
fi

echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "🚀 READY TO START!"
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "Run these commands in separate terminals:"
echo ""
echo "Terminal 1 (Socket.io Server on port 8001):"
echo "  $ npm run dev:server"
echo ""
echo "Terminal 2 (React Frontend on port 5173):"
echo "  $ npm run dev"
echo ""
echo "Then open browser to: https://task-project-3frx.onrender.com"
echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "✨ TESTING CHECKLIST"
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "1. ✓ Navigation: Go to Tasks page"
echo "   Expected: View tasks in board or table view"
echo ""
echo "2. ✓ Kanban Board:"
echo "   Open two browser windows side-by-side"
echo "   Window 1: Drag a task from To Do → In Progress"
echo "   Window 2: Should see update instantly (no refresh needed)"
echo ""
echo "3. ✓ Activity Logs:"
echo "   Move a task, check Supabase → activity_logs table"
echo "   Should see: action='moved', oldValue, newValue"
echo ""
echo "4. ✓ Real-Time Sync:"
echo "   Create a new task"
echo "   Should appear in other users' boards instantly"
echo ""
echo "5. ✓ Notifications:"
echo "   Assign a task to another user"
echo "   They should get a notification"
echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "📚 DOCUMENTATION"
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "Read these files for more information:"
echo ""
echo "├─ Start Here:"
echo "│  └─ DELIVERY.md (Overview & quick start)"
echo "│"
echo "├─ Then Choose (based on your need):"
echo "│  ├─ QUICK_REFERENCE.md (Quick lookup)"
echo "│  ├─ JIRA_UPGRADE_GUIDE.md (Full details)"
echo "│  ├─ INTEGRATION_CODE.jsx (How to integrate)"
echo "│  ├─ INTEGRATION_CHECKLIST.md (Test & deploy)"
echo "│  ├─ ARCHITECTURE.md (System design)"
echo "│  └─ README_JIRA.md (Documentation index)"
echo ""
echo "═════════════════════════════════════════════════════════════════"
echo "🎯 NEXT STEPS"
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "1. Start both servers (see above)"
echo "2. Open https://task-project-3frx.onrender.com"
echo "3. Go to Tasks page"
echo "4. Test Kanban drag-and-drop (see checklist above)"
echo "5. Open two windows and verify real-time sync"
echo "6. Read INTEGRATION_CODE.jsx to add Kanban to Tasks.jsx"
echo ""
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "✅ Setup complete! Happy coding! 🚀"
echo ""
