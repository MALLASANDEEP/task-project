/**
 * INTEGRATION GUIDE: How to Add Kanban to Tasks.jsx
 * 
 * This file shows the minimal changes needed to add Kanban view
 * while keeping your existing table view.
 * 
 * Copy & paste the relevant sections into your Tasks.jsx
 */

// =============================================================================
// STEP 1: Import the Kanban Component
// =============================================================================
// Add this to your imports at the top of Tasks.jsx:

import { KanbanBoard } from '@/components/KanbanBoard';

// =============================================================================
// STEP 2: Add View Mode State
// =============================================================================
// In your Tasks component, add this near the top:

export default function Tasks() {
  const { can, role, user } = useAuth();
  
  // NEW: Add view mode state
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'table'
  
  // ... existing state declarations ...
}

// =============================================================================
// STEP 3: Update the Header Section
// =============================================================================
// Find the header/title section and update it:

return (
  <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-3xl font-semibold">
          {role === 'TEAM_LEADER' ? 'My Tasks' : 'Task Board'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {viewMode === 'kanban' 
            ? 'Organize your work with drag-and-drop kanban board.'
            : 'View all tasks in a detailed table format.'}
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        {/* NEW: View Mode Toggle Buttons */}
        <div className="flex items-center gap-1 bg-secondary p-1 rounded-lg">
          <Button
            variant={viewMode === 'kanban' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('table')}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            Table
          </Button>
        </div>

        {can('tasks:create') && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4"/>
                New Task
              </Button>
            </DialogTrigger>
            {/* ... rest of dialog ... */}
          </Dialog>
        )}
      </div>
    </div>

    {/* NEW: Conditional View */}
    {viewMode === 'kanban' ? (
      // ==================== KANBAN VIEW ====================
      <KanbanBoard projectId={selectedProjectId} />
    ) : (
      // ==================== TABLE VIEW ====================
      <>
        {/* Your existing table view code here */}
        {/* Just wrap all the existing grid/card layout in this section */}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile label="Total" value={counts.total} />
          <MetricTile label="Completed" value={counts.completed} tone="text-[hsl(var(--success))]" />
          <MetricTile label="Pending" value={counts.pending} tone="text-[hsl(var(--warning))]" />
          <MetricTile label="Overdue" value={counts.overdue} tone="text-destructive" />
        </div>

        <Card>
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                <Input 
                  placeholder="Search title or description" 
                  className="pl-9 rounded-xl h-10" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-[160px] rounded-xl">
                  <SelectValue placeholder="Priority"/>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ... rest of existing table view ... */}
      </>
    )}
  </div>
);

// =============================================================================
// STEP 4: Add Missing Imports
// =============================================================================
// Add these icons to your existing lucide-react imports:

import { 
  Plus, 
  Search, 
  Send, 
  Trash2, 
  Pencil, 
  MessageSquare, 
  CalendarDays,
  LayoutGrid,  // NEW
  List         // NEW
} from 'lucide-react';

// =============================================================================
// STEP 5: Determine Project ID (Important for Kanban)
// =============================================================================
// Add a state to track selected project (if not already doing this):

const [selectedProjectId, setSelectedProjectId] = useState(null);

// If you want to auto-select the first project:
useEffect(() => {
  if (projects.length > 0 && !selectedProjectId) {
    setSelectedProjectId(projects[0].id);
  }
}, [projects, selectedProjectId]);

// Or if Kanban should show all tasks (remove projectId filter):
// Just pass a "null" or "all" value to KanbanBoard

// =============================================================================
// STEP 6: Update Component Props
// =============================================================================
// Make sure KanbanBoard receives the right prop:

<KanbanBoard 
  projectId={selectedProjectId || null}  // null = show all
/>

// =============================================================================
// COMPLETE EXAMPLE: Minimal Integration
// =============================================================================

/*
Add this to Tasks.jsx:

1. Import statement:
   import { KanbanBoard } from '@/components/KanbanBoard';
   import { LayoutGrid, List } from 'lucide-react';

2. In component:
   const [viewMode, setViewMode] = useState('kanban');

3. In JSX:
   <Button
     variant={viewMode === 'kanban' ? 'default' : 'ghost'}
     onClick={() => setViewMode('kanban')}
   >
     <LayoutGrid className="h-4 w-4" /> Kanban
   </Button>

   {viewMode === 'kanban' ? (
     <KanbanBoard projectId={projectId} />
   ) : (
     <YourExistingTableView />
   )}
*/

// =============================================================================
// OPTIONAL: Add Project/Team Filter to Kanban
// =============================================================================

/*
If you want to filter Kanban by project:

<Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
  <SelectTrigger>
    <SelectValue placeholder="Select Project" />
  </SelectTrigger>
  <SelectContent>
    {projects.map(project => (
      <SelectItem key={project.id} value={project.id}>
        {project.title}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

<KanbanBoard projectId={selectedProjectId} />
*/

// =============================================================================
// IMPORTANT NOTES
// =============================================================================

/*
1. KanbanBoard Component:
   - Loads tasks internally via API
   - Listens to Socket.io events
   - Handles permissions automatically
   - No need to manage state from parent

2. Existing Features Still Work:
   - Create/Edit/Delete forms
   - Search and filters
   - Metrics display
   - Notifications

3. Socket.io Connection:
   - Must be initialized in your App root
   - useSocket hook handles it
   - No additional setup needed

4. Performance:
   - For large task lists (1000+), add pagination
   - Consider caching project list
   - Debounce search input

5. Mobile Responsiveness:
   - Kanban is responsive (single column on mobile)
   - Drag-drop works on touch devices
   - Test on mobile before deploy
*/

// =============================================================================
// TESTING YOUR INTEGRATION
// =============================================================================

/*
1. Click "Kanban" button → Should load Kanban view
2. Click "Table" button → Should load existing table view
3. In Kanban: Drag task between columns
4. Open second browser window → Should see update instantly
5. Create new task → Appears in correct column
6. Check browser console → No errors should appear
*/

// =============================================================================
// TROUBLESHOOTING
// =============================================================================

/*
Error: "KanbanBoard not found"
→ Make sure KanbanBoard.jsx exists in src/components/

Error: "Socket events not triggering"
→ Check if Socket.io server is running (npm run dev:server)
→ Check browser console for Socket.io connection errors

Error: "Tasks not loading"
→ Verify API key in .env
→ Check Supabase tables exist
→ Verify RLS policies allow reading

Task not moving after drag?
→ Check if task.id matches database task.id format
→ Verify user has 'tasks:update' permission
→ Check API response for errors in console
*/

// =============================================================================
export default Tasks;
