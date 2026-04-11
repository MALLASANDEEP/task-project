import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  Code2,
  Eye,
  FileCode2,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Layers3,
  Link2,
  PlayCircle,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';

const architectureSchema = [
  {
    table: 'code_projects',
    fields: ['id', 'project_id', 'name', 'default_branch', 'visibility', 'created_by', 'created_at'],
    purpose: 'One repository per project with project-level ownership and access rules.',
  },
  {
    table: 'code_branches',
    fields: ['id', 'project_id', 'name', 'base_branch_id', 'head_commit_id', 'is_protected', 'created_by', 'created_at'],
    purpose: 'Tracks Git-like branches and the latest commit pointer.',
  },
  {
    table: 'code_files',
    fields: ['id', 'project_id', 'branch_id', 'path', 'content', 'language', 'updated_by', 'updated_at'],
    purpose: 'Stores the latest file tree contents for each branch.',
  },
  {
    table: 'code_commits',
    fields: ['id', 'project_id', 'branch_id', 'message', 'author_id', 'parent_commit_id', 'linked_task_id', 'created_at'],
    purpose: 'Immutable version history with task and PR linkage.',
  },
  {
    table: 'code_pull_requests',
    fields: ['id', 'project_id', 'source_branch_id', 'target_branch_id', 'title', 'status', 'linked_task_id', 'created_by'],
    purpose: 'Branch merge requests with review status and task references.',
  },
  {
    table: 'task_code_links',
    fields: ['id', 'task_id', 'commit_id', 'pull_request_id', 'link_type', 'created_by', 'created_at'],
    purpose: 'Many-to-many links so tasks can point to commits or PRs.',
  },
];

const architectureApi = [
  { method: 'GET', path: '/projects/:projectId/code', description: 'Fetch repository overview, branches, commits, and pull requests.' },
  { method: 'GET', path: '/projects/:projectId/code/files?branch=main', description: 'Return the branch file tree and current file contents.' },
  { method: 'POST', path: '/projects/:projectId/code/commits', description: 'Create a commit with message, file snapshot, and linked task id.' },
  { method: 'POST', path: '/projects/:projectId/code/branches', description: 'Create a new branch from a source branch or commit.' },
  { method: 'GET', path: '/projects/:projectId/code/pull-requests', description: 'List PRs and their review state.' },
  { method: 'POST', path: '/tasks/:taskId/code-links', description: 'Link a task to a commit or pull request.' },
];

const frontendTree = [
  'Workspace',
  '└─ Projects',
  '   ├─ Overview',
  '   ├─ Tasks',
  '   ├─ Code Section',
  '   │  ├─ File Explorer',
  '   │  ├─ Code Editor',
  '   │  ├─ Commit History',
  '   │  ├─ Branches',
  '   │  └─ Pull Requests',
  '   └─ Team Members',
];

const permissionMatrix = [
  { role: 'ADMIN', actions: 'Full repository control, branch protection, merges, and task linkage.' },
  { role: 'PROJECT_MANAGER', actions: 'Create branches, commit, open PRs, and link tasks to code.' },
  { role: 'TEAM_LEADER', actions: 'Commit to assigned branches, review diffs, and link work items.' },
  { role: 'TEAM_MEMBER', actions: 'Edit allowed files, propose commits, and open review-ready PRs.' },
];

const codeKeywords = new Set([
  'import',
  'export',
  'function',
  'const',
  'let',
  'return',
  'if',
  'else',
  'new',
  'true',
  'false',
  'null',
  'undefined',
  'from',
  'type',
]);

function createRepositoryTemplate(projectTitle) {
  const baseFiles = {
    'README.md': `# ${projectTitle}\n\nProject code workspace for task linkage, review-ready changes, and branch history.`,
    'src/pages/Login.jsx': `import { useState } from 'react';\n\nexport default function Login() {\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n\n  const handleSubmit = (event) => {\n    event.preventDefault();\n    return { email, password };\n  };\n\n  return (\n    <form onSubmit={handleSubmit}>\n      <input value={email} onChange={(event) => setEmail(event.target.value)} />\n      <input value={password} onChange={(event) => setPassword(event.target.value)} type=\"password\" />\n    </form>\n  );\n}`,
    'src/components/TaskLinkBadge.jsx': `export function TaskLinkBadge({ taskId, label }) {\n  return <span data-task={taskId}>{label}</span>;\n}`,
    'src/lib/repository.js': `export const repositoryPermissions = {\n  admin: ['commit', 'branch', 'merge', 'link'],\n  manager: ['commit', 'branch', 'merge', 'link'],\n  leader: ['commit', 'branch', 'link'],\n  member: ['commit', 'link'],\n};`,
    'server/routes/code.js': `export function registerCodeRoutes(app) {\n  app.get('/projects/:projectId/code', () => {});\n}`,
  };

  const featureFiles = {
    ...baseFiles,
    'src/pages/Login.jsx': `import { useState } from 'react';\n\nexport default function Login() {\n  const [email, setEmail] = useState('');\n  const [password, setPassword] = useState('');\n\n  const handleSubmit = (event) => {\n    event.preventDefault();\n    if (!email || !password) {\n      return null;\n    }\n\n    return { email, password, redirectTo: '/dashboard' };\n  };\n\n  return (\n    <form onSubmit={handleSubmit}>\n      <input value={email} onChange={(event) => setEmail(event.target.value)} />\n      <input value={password} onChange={(event) => setPassword(event.target.value)} type=\"password\" />\n      <button type=\"submit\">Sign in</button>\n    </form>\n  );\n}`,
  };

  return {
    defaultBranch: 'main',
    selectedFile: 'src/pages/Login.jsx',
    selectedCommitId: 'c-1418',
    commitMessage: 'Fix login flow and connect task link',
    newBranchName: 'feature/code-section-preview',
    pullRequestTitle: 'Ship code section preview with login fix',
    flowStep: 0,
    flowLog: ['Workspace initialized for repository preview.'],
    selectedTaskId: '',
    branches: {
      main: {
        name: 'main',
        protected: true,
        files: baseFiles,
        commits: [
          {
            id: 'c-1401',
            message: 'Initialize repository workspace',
            author: 'Priya Patel',
            createdAt: '2026-04-05T09:30:00Z',
            linkedTaskId: null,
            snapshot: baseFiles,
          },
        ],
        pullRequests: [],
      },
      'feature/login-flow': {
        name: 'feature/login-flow',
        protected: false,
        files: featureFiles,
        commits: [
          {
            id: 'c-1412',
            message: 'Refine login form and redirect handling',
            author: 'Rohan Mehta',
            createdAt: '2026-04-08T13:10:00Z',
            linkedTaskId: null,
            snapshot: featureFiles,
          },
          {
            id: 'c-1418',
            message: 'Link login bug task to repository change',
            author: 'Priya Patel',
            createdAt: '2026-04-09T15:45:00Z',
            linkedTaskId: null,
            snapshot: featureFiles,
          },
        ],
        pullRequests: [
          {
            id: 'pr-22',
            title: 'Improve login flow and repository links',
            sourceBranch: 'feature/login-flow',
            targetBranch: 'main',
            status: 'open',
            linkedTaskId: null,
            commits: ['c-1412', 'c-1418'],
            createdAt: '2026-04-09T16:00:00Z',
          },
        ],
      },
      'release/1.0': {
        name: 'release/1.0',
        protected: true,
        files: baseFiles,
        commits: [
          {
            id: 'c-1390',
            message: 'Prepare stable release baseline',
            author: 'Aarav Sharma',
            createdAt: '2026-04-02T11:00:00Z',
            linkedTaskId: null,
            snapshot: baseFiles,
          },
        ],
        pullRequests: [],
      },
    },
    branchOrder: ['main', 'feature/login-flow', 'release/1.0'],
  };
}

function cloneRepository(repository) {
  return JSON.parse(JSON.stringify(repository));
}

function collectFolderPaths(filePaths) {
  const folders = new Set();
  filePaths.forEach((filePath) => {
    const parts = filePath.split('/');
    parts.slice(0, -1).forEach((_, index) => {
      folders.add(parts.slice(0, index + 1).join('/'));
    });
  });
  return folders;
}

function buildFileTree(filePaths) {
  const root = [];
  filePaths.slice().sort().forEach((filePath) => {
    const parts = filePath.split('/');
    let currentLevel = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      const existing = currentLevel.find((item) => item.name === part && item.type === (isFile ? 'file' : 'folder'));
      if (existing) {
        currentLevel = existing.children || [];
        return;
      }

      const node = isFile
        ? { type: 'file', name: part, path: currentPath }
        : { type: 'folder', name: part, path: currentPath, children: [] };
      currentLevel.push(node);
      currentLevel = node.children || [];
    });
  });

  const sortNodes = (nodes) => nodes
    .sort((left, right) => {
      if (left.type !== right.type) {
        return left.type === 'folder' ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    })
    .map((node) => (node.type === 'folder' ? { ...node, children: sortNodes(node.children || []) } : node));

  return sortNodes(root);
}

function createDiff(before = '', after = '') {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLength = Math.max(beforeLines.length, afterLines.length);
  const diff = [];

  for (let index = 0; index < maxLength; index += 1) {
    const previous = beforeLines[index];
    const current = afterLines[index];
    if (previous === current) {
      if (typeof current !== 'undefined') {
        diff.push({ type: 'context', value: current, line: index + 1 });
      }
      continue;
    }

    if (typeof previous !== 'undefined') {
      diff.push({ type: 'removed', value: previous, line: index + 1 });
    }
    if (typeof current !== 'undefined') {
      diff.push({ type: 'added', value: current, line: index + 1 });
    }
  }

  return diff;
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function renderHighlightedLine(line, lineIndex) {
  return line.split(/(\b(?:import|export|function|const|let|return|if|else|new|true|false|null|undefined|from|type)\b|\".*?\"|\'.*?\')/g).map((segment, segmentIndex) => {
    if (!segment) {
      return null;
    }
    if (codeKeywords.has(segment)) {
      return <span key={`${lineIndex}-${segmentIndex}`} className="text-sky-500">{segment}</span>;
    }
    if ((segment.startsWith('"') && segment.endsWith('"')) || (segment.startsWith("'") && segment.endsWith("'"))) {
      return <span key={`${lineIndex}-${segmentIndex}`} className="text-amber-500">{segment}</span>;
    }
    return <span key={`${lineIndex}-${segmentIndex}`}>{segment}</span>;
  });
}

function FileTreeNode({ node, depth, expandedFolders, onToggleFolder, onSelectFile, selectedFile }) {
  const isExpanded = node.type === 'folder' && expandedFolders.has(node.path);

  if (node.type === 'folder') {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {isExpanded ? <FolderOpen className="h-4 w-4 text-amber-500" /> : <Folder className="h-4 w-4 text-amber-500" />}
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded && node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            expandedFolders={expandedFolders}
            onToggleFolder={onToggleFolder}
            onSelectFile={onSelectFile}
            selectedFile={selectedFile}
          />
        ))}
      </div>
    );
  }

  const isSelected = selectedFile === node.path;
  return (
    <button
      type="button"
      onClick={() => onSelectFile(node.path)}
      className={cn(
        'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/70',
        isSelected ? 'bg-primary/10 text-primary' : 'text-foreground'
      )}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
    >
      <FileCode2 className="h-4 w-4" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

export default function ProjectCodeSection({ project, tasks = [], members = [], canEdit = false }) {
  const [repository, setRepository] = useState(() => createRepositoryTemplate(project.title));
  const [activeBranch, setActiveBranch] = useState(repository.defaultBranch);
  const [selectedFile, setSelectedFile] = useState(repository.selectedFile);
  const [draftContent, setDraftContent] = useState(repository.branches[repository.defaultBranch].files[repository.selectedFile]);
  const [selectedCommitId, setSelectedCommitId] = useState(repository.selectedCommitId);
  const [commitMessage, setCommitMessage] = useState(repository.commitMessage);
  const [newBranchName, setNewBranchName] = useState(repository.newBranchName);
  const [pullRequestTitle, setPullRequestTitle] = useState(repository.pullRequestTitle);
  const [selectedTaskId, setSelectedTaskId] = useState(repository.selectedTaskId);
  const [expandedFolders, setExpandedFolders] = useState(() => collectFolderPaths(Object.keys(repository.branches[repository.defaultBranch].files)));
  const [flowStep, setFlowStep] = useState(repository.flowStep);
  const [flowLog, setFlowLog] = useState(repository.flowLog);
  const lastProjectId = useRef(project.id);

  useEffect(() => {
    if (lastProjectId.current === project.id) {
      return;
    }
    lastProjectId.current = project.id;
    const nextRepository = createRepositoryTemplate(project.title);
    setRepository(nextRepository);
    setActiveBranch(nextRepository.defaultBranch);
    setSelectedFile(nextRepository.selectedFile);
    setDraftContent(nextRepository.branches[nextRepository.defaultBranch].files[nextRepository.selectedFile]);
    setSelectedCommitId(nextRepository.selectedCommitId);
    setCommitMessage(nextRepository.commitMessage);
    setNewBranchName(nextRepository.newBranchName);
    setPullRequestTitle(nextRepository.pullRequestTitle);
    setSelectedTaskId('');
    setExpandedFolders(collectFolderPaths(Object.keys(nextRepository.branches[nextRepository.defaultBranch].files)));
    setFlowStep(nextRepository.flowStep);
    setFlowLog(nextRepository.flowLog);
  }, [project.id, project.title]);

  useEffect(() => {
    if (tasks.length === 0) {
      setSelectedTaskId('');
      return;
    }
    if (!tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  const activeBranchData = repository.branches[activeBranch];
  const fileTree = useMemo(() => buildFileTree(Object.keys(activeBranchData?.files || {})), [activeBranchData]);
  const selectedCommit = activeBranchData?.commits.find((commit) => commit.id === selectedCommitId) || activeBranchData?.commits[0] || null;
  const selectedCommitIndex = activeBranchData?.commits.findIndex((commit) => commit.id === selectedCommit?.id) ?? -1;
  const previousCommit = selectedCommitIndex > 0 ? activeBranchData?.commits[selectedCommitIndex - 1] : null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0] || null;
  const selectedFileDiff = createDiff(previousCommit?.snapshot?.[selectedFile] || '', selectedCommit?.snapshot?.[selectedFile] || activeBranchData?.files?.[selectedFile] || '');
  const repoStats = {
    branches: Object.keys(repository.branches).length,
    commits: Object.values(repository.branches).reduce((count, branch) => count + branch.commits.length, 0),
    pullRequests: Object.values(repository.branches).reduce((count, branch) => count + (branch.pullRequests?.length || 0), 0),
    files: Object.keys(activeBranchData?.files || {}).length,
  };
  const totalCodeMembers = members.length;

  useEffect(() => {
    if (!activeBranchData) {
      return;
    }
    const availableFiles = Object.keys(activeBranchData.files || {});
    if (availableFiles.length === 0) {
      setSelectedFile('');
      setDraftContent('');
      return;
    }
    if (!availableFiles.includes(selectedFile)) {
      setSelectedFile(availableFiles[0]);
    }
    const nextFile = availableFiles.includes(selectedFile) ? selectedFile : availableFiles[0];
    setDraftContent(activeBranchData.files[nextFile] || '');
    setExpandedFolders(collectFolderPaths(availableFiles));
    if (!selectedCommitId || !activeBranchData.commits.some((commit) => commit.id === selectedCommitId)) {
      setSelectedCommitId(activeBranchData.commits[0]?.id || '');
    }
  }, [activeBranch, activeBranchData, selectedFile, selectedCommitId]);

  const updateRepository = (updater) => {
    setRepository((current) => {
      const next = cloneRepository(current);
      updater(next);
      return next;
    });
  };

  const handleFileChange = (value) => {
    setDraftContent(value);
    updateRepository((next) => {
      next.branches[activeBranch].files[selectedFile] = value;
    });
  };

  const handleCommit = () => {
    if (!canEdit) {
      setFlowLog((current) => [...current, 'Repository actions are read-only for the current role.']);
      return;
    }
    if (!commitMessage.trim() || !selectedFile) {
      setFlowLog((current) => [...current, 'Enter a commit message and choose a file before saving changes.']);
      return;
    }

    const commitId = `c-${Date.now().toString().slice(-6)}`;
    updateRepository((next) => {
      const branch = next.branches[activeBranch];
      const snapshot = cloneRepository(branch.files);
      branch.commits = [
        {
          id: commitId,
          message: commitMessage.trim(),
          author: 'Current user',
          createdAt: new Date().toISOString(),
          linkedTaskId: selectedTask?.id || null,
          snapshot,
        },
        ...branch.commits,
      ];
      branch.files[selectedFile] = draftContent;
    });
    setSelectedCommitId(commitId);
    setFlowLog((current) => [...current, `Committed changes to ${activeBranch} with message: ${commitMessage.trim()}.`]);
  };

  const handleCreateBranch = () => {
    if (!canEdit) {
      setFlowLog((current) => [...current, 'Branch creation is limited by role permissions.']);
      return;
    }
    const branchName = newBranchName.trim();
    if (!branchName || repository.branches[branchName]) {
      setFlowLog((current) => [...current, 'Choose a unique branch name before creating it.']);
      return;
    }

    updateRepository((next) => {
      const sourceBranch = next.branches[activeBranch];
      next.branches[branchName] = {
        name: branchName,
        protected: false,
        files: cloneRepository(sourceBranch.files),
        commits: cloneRepository(sourceBranch.commits),
        pullRequests: [],
      };
      next.branchOrder = [branchName, ...next.branchOrder.filter((name) => name !== branchName)];
    });
    setActiveBranch(branchName);
    setFlowLog((current) => [...current, `Created branch ${branchName} from ${activeBranch}.`]);
  };

  const handleCreatePullRequest = () => {
    if (!canEdit) {
      setFlowLog((current) => [...current, 'Pull request creation is limited by role permissions.']);
      return;
    }
    const branch = repository.branches[activeBranch];
    if (!branch) {
      return;
    }

    const pullRequest = {
      id: `pr-${Date.now().toString().slice(-6)}`,
      title: pullRequestTitle.trim() || `Review changes from ${activeBranch}`,
      sourceBranch: activeBranch,
      targetBranch: 'main',
      status: 'open',
      linkedTaskId: selectedTask?.id || null,
      commits: branch.commits.slice(0, 3).map((commit) => commit.id),
      createdAt: new Date().toISOString(),
    };

    updateRepository((next) => {
      next.branches[activeBranch].pullRequests = [pullRequest, ...(next.branches[activeBranch].pullRequests || [])];
    });
    setFlowLog((current) => [...current, `Opened pull request: ${pullRequest.title}.`]);
  };

  const handleDemoAdvance = () => {
    const demoBranch = 'feature/login-flow';
    const demoFile = 'src/pages/Login.jsx';
    const demoTask = tasks[0]?.id || '';

    if (flowStep === 0) {
      if (repository.branches[demoBranch]) {
        setActiveBranch(demoBranch);
      }
      if (repository.branches[demoBranch]?.files[demoFile]) {
        setSelectedFile(demoFile);
      }
      setSelectedTaskId(demoTask);
      setFlowLog((current) => [...current, 'Step 1: switched to the feature branch and opened the login file.']);
      setFlowStep(1);
      return;
    }

    if (flowStep === 1) {
      const updated = `${draftContent}\n\n// Demo edit: add a task link and redirect note.`;
      setDraftContent(updated);
      updateRepository((next) => {
        next.branches[activeBranch].files[selectedFile] = updated;
      });
      setCommitMessage('Fix login flow and link the bug task');
      setFlowLog((current) => [...current, 'Step 2: edited the file and prepared a commit message.']);
      setFlowStep(2);
      return;
    }

    if (flowStep === 2) {
      handleCommit();
      setFlowLog((current) => [...current, 'Step 3: committed the change and captured the diff.']);
      setFlowStep(3);
      return;
    }

    if (flowStep === 3) {
      setPullRequestTitle('Review login fix and repository preview');
      handleCreatePullRequest();
      setFlowLog((current) => [...current, 'Step 4: opened a PR and linked it back to the issue.']);
      setFlowStep(4);
      return;
    }

    setFlowStep(0);
    setFlowLog((current) => [...current, 'Demo reset.']);
  };

  const renderStatusBadge = (status) => {
    const variant = status === 'open' ? 'default' : status === 'merged' ? 'secondary' : 'outline';
    return <Badge variant={variant}>{status.toUpperCase()}</Badge>;
  };

  return (
    <Tabs defaultValue="repository" className="space-y-4">
      <TabsList className="flex w-full flex-wrap justify-start gap-2 bg-muted/60 p-1">
        <TabsTrigger value="repository" className="gap-2"><Code2 className="h-4 w-4" />Repository</TabsTrigger>
        <TabsTrigger value="architecture" className="gap-2"><Layers3 className="h-4 w-4" />Architecture</TabsTrigger>
        <TabsTrigger value="flow" className="gap-2"><PlayCircle className="h-4 w-4" />Test Flow</TabsTrigger>
      </TabsList>

      <TabsContent value="repository" className="space-y-4">
        <div className="rounded-3xl border border-border/70 bg-background/80 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border/70 p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1"><GitBranch className="h-3 w-3" />{activeBranch}</Badge>
                <Badge variant="outline" className="gap-1"><GitCommit className="h-3 w-3" />{repoStats.commits} commits</Badge>
                <Badge variant="outline" className="gap-1"><GitPullRequest className="h-3 w-3" />{repoStats.pullRequests} PRs</Badge>
                <Badge variant="outline" className="gap-1"><FileCode2 className="h-3 w-3" />{repoStats.files} files</Badge>
                <Badge variant="outline" className="gap-1"><Eye className="h-3 w-3" />{totalCodeMembers} members</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Branch selector, commit action, and linked task flow for {project.title}.</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[220px_180px_1fr_auto] lg:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Branch</label>
                <Select value={activeBranch} onValueChange={setActiveBranch}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {repository.branchOrder.map((branchName) => (
                      <SelectItem key={branchName} value={branchName}>{branchName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Linked task</label>
                <Select value={selectedTaskId || ''} onValueChange={setSelectedTaskId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select task" /></SelectTrigger>
                  <SelectContent>
                    {tasks.length === 0 ? <SelectItem value="none" disabled>No tasks available</SelectItem> : null}
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>{task.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 lg:col-span-1">
                <label className="text-xs font-medium text-muted-foreground">Commit message</label>
                <Input value={commitMessage} onChange={(event) => setCommitMessage(event.target.value)} placeholder="Summarize the change" className="h-11 rounded-xl" />
              </div>
              <Button type="button" className="h-11 gap-2 rounded-xl" onClick={handleCommit} disabled={!canEdit}>
                <GitCommit className="h-4 w-4" />Commit
              </Button>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
            <aside className="border-b border-border/70 bg-muted/20 xl:border-b-0 xl:border-r xl:border-border/70">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Files</p>
                  <p className="text-xs text-muted-foreground">Repository explorer</p>
                </div>
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <ScrollArea className="h-[420px]">
                <div className="space-y-1 p-3">
                  {fileTree.map((node) => (
                    <FileTreeNode
                      key={node.path}
                      node={node}
                      depth={0}
                      expandedFolders={expandedFolders}
                      onToggleFolder={(folderPath) => {
                        setExpandedFolders((current) => {
                          const next = new Set(current);
                          if (next.has(folderPath)) {
                            next.delete(folderPath);
                          } else {
                            next.add(folderPath);
                          }
                          return next;
                        });
                      }}
                      onSelectFile={setSelectedFile}
                      selectedFile={selectedFile}
                    />
                  ))}
                </div>
              </ScrollArea>
            </aside>

            <main className="min-w-0 border-b border-border/70 xl:border-b-0 xl:border-r xl:border-border/70">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{selectedFile || 'No file selected'}</p>
                  <p className="text-xs text-muted-foreground">Edit the current branch snapshot in place.</p>
                </div>
                <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" />{canEdit ? 'Editor enabled' : 'Read only'}</Badge>
              </div>

              <div className="space-y-4 p-4">
                <Textarea
                  value={draftContent}
                  onChange={(event) => handleFileChange(event.target.value)}
                  className="min-h-[250px] rounded-2xl border-border/80 bg-background/90 font-mono text-[13px] leading-6"
                  spellCheck="false"
                  disabled={!canEdit}
                />

                <Card className="border-dashed border-border/80 bg-muted/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Syntax preview</CardTitle>
                    <CardDescription>Lightweight highlighting for a repository preview.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[180px] rounded-xl border border-border/60 bg-background/80 p-3">
                      <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-foreground">
                        {draftContent.split('\n').map((line, lineIndex) => (
                          <div key={`${lineIndex}-${line}`} className="flex gap-3">
                            <span className="w-8 select-none text-right text-[10px] text-muted-foreground">{lineIndex + 1}</span>
                            <span className="flex-1">{renderHighlightedLine(line, lineIndex)}</span>
                          </div>
                        ))}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            </main>

            <aside className="space-y-4 bg-muted/10 p-4">
              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><GitCommit className="h-4 w-4" />Commit history</CardTitle>
                  <CardDescription>Click any commit to inspect the diff.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ScrollArea className="h-[180px] pr-2">
                    <div className="space-y-2">
                      {activeBranchData?.commits.map((commit) => (
                        <button
                          key={commit.id}
                          type="button"
                          onClick={() => setSelectedCommitId(commit.id)}
                          className={cn(
                            'w-full rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/60',
                            selectedCommit?.id === commit.id ? 'border-primary/50 bg-primary/5' : 'border-border/60'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{commit.message}</p>
                              <p className="text-xs text-muted-foreground">{commit.id} · {commit.author}</p>
                            </div>
                            <GitCommit className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            {commit.linkedTaskId ? <Badge variant="secondary" className="text-[10px]">Task {commit.linkedTaskId}</Badge> : <Badge variant="outline" className="text-[10px]">No task link</Badge>}
                            <span className="text-[10px] text-muted-foreground">{formatTimestamp(commit.createdAt)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><GitBranch className="h-4 w-4" />Branches</CardTitle>
                  <CardDescription>Create or switch branches.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input value={newBranchName} onChange={(event) => setNewBranchName(event.target.value)} placeholder="feature/new-branch" className="rounded-xl" />
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={handleCreateBranch} disabled={!canEdit}>
                    <Plus className="h-4 w-4" />Create branch
                  </Button>
                  <div className="space-y-2">
                    {repository.branchOrder.map((branchName) => {
                      const branch = repository.branches[branchName];
                      return (
                        <button
                          key={branchName}
                          type="button"
                          className={cn(
                            'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-muted/60',
                            activeBranch === branchName ? 'border-primary/50 bg-primary/5' : 'border-border/60'
                          )}
                          onClick={() => setActiveBranch(branchName)}
                        >
                          <div>
                            <p className="text-sm font-medium">{branchName}</p>
                            <p className="text-xs text-muted-foreground">{branch.commits.length} commits</p>
                          </div>
                          {branch.protected ? <Badge variant="secondary" className="text-[10px]">Protected</Badge> : <Badge variant="outline" className="text-[10px]">Branch</Badge>}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><GitPullRequest className="h-4 w-4" />Pull requests</CardTitle>
                  <CardDescription>Open review requests from the active branch.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input value={pullRequestTitle} onChange={(event) => setPullRequestTitle(event.target.value)} placeholder="Review title" className="rounded-xl" />
                  <Button type="button" className="w-full gap-2" onClick={handleCreatePullRequest} disabled={!canEdit}>
                    <GitPullRequest className="h-4 w-4" />Open PR
                  </Button>
                  <div className="space-y-2">
                    {activeBranchData?.pullRequests?.length ? activeBranchData.pullRequests.map((pullRequest) => (
                      <div key={pullRequest.id} className="rounded-xl border border-border/60 bg-background/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{pullRequest.title}</p>
                            <p className="text-xs text-muted-foreground">{pullRequest.sourceBranch} → {pullRequest.targetBranch}</p>
                          </div>
                          {renderStatusBadge(pullRequest.status)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                          {pullRequest.linkedTaskId ? <Badge variant="secondary" className="text-[10px] gap-1"><Link2 className="h-3 w-3" />Task {pullRequest.linkedTaskId}</Badge> : null}
                          <Badge variant="outline" className="text-[10px] gap-1"><Eye className="h-3 w-3" />{pullRequest.commits.length} commits</Badge>
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">No pull requests yet.</p>}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><GitMerge className="h-4 w-4" />Diff viewer</CardTitle>
            <CardDescription>Basic line-by-line view for the selected commit and file.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[220px] rounded-2xl border border-border/60 bg-background/80 p-3">
              <div className="space-y-1 font-mono text-xs">
                {selectedFileDiff.length > 0 ? selectedFileDiff.map((line, index) => (
                  <div
                    key={`${line.type}-${line.line}-${index}`}
                    className={cn(
                      'flex gap-3 rounded px-2 py-1',
                      line.type === 'added' && 'bg-emerald-500/10 text-emerald-600',
                      line.type === 'removed' && 'bg-rose-500/10 text-rose-600',
                      line.type === 'context' && 'text-muted-foreground'
                    )}
                  >
                    <span className="w-8 select-none text-right text-[10px] opacity-70">{line.line}</span>
                    <span className="whitespace-pre-wrap">{line.type === 'added' ? `+ ${line.value}` : line.type === 'removed' ? `- ${line.value}` : `  ${line.value}`}</span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Select a commit to compare file changes.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="architecture" className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-sm">Database schema</CardTitle>
              <CardDescription>Minimal Git-like repository model for a project-scoped code section.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {architectureSchema.map((item) => (
                <div key={item.table} className="rounded-xl border border-border/60 bg-background/80 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{item.table}</p>
                    <Badge variant="outline" className="text-[10px]">table</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{item.purpose}</p>
                  <p className="mt-2 text-xs font-mono text-foreground/80">{item.fields.join(' · ')}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-sm">API structure</CardTitle>
              <CardDescription>REST endpoints for repository, branch, commit, PR, and task-link workflows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {architectureApi.map((route) => (
                <div key={`${route.method}-${route.path}`} className="rounded-xl border border-border/60 bg-background/80 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{route.method}</Badge>
                    <p className="font-mono text-sm">{route.path}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{route.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-sm">Frontend component structure</CardTitle>
              <CardDescription>Reusable pieces for the project tab shell and repository view.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-xl border border-border/60 bg-background/80 p-4 font-mono text-xs leading-6 text-foreground">{frontendTree.join('\n')}</pre>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-sm">Role permissions</CardTitle>
              <CardDescription>Repository actions should be permission-aware and project-scoped.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {permissionMatrix.map((item) => (
                <div key={item.role} className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/80 p-3">
                  <Badge variant="outline" className="text-[10px]">{item.role}</Badge>
                  <p className="text-sm text-muted-foreground">{item.actions}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Example UI layout</CardTitle>
              <CardDescription>Workspace-like layout with projects on the left and code tools inside the project.</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-xl border border-border/60 bg-background/80 p-4 font-mono text-xs leading-6 text-foreground">Workspace\n └── Projects\n      ├── Overview\n      ├── Tasks\n      ├── Code Section\n      │     ├── Files\n      │     ├── Commits\n      │     ├── Branches\n      │     └── Pull Requests\n      │\n      ├── Tasks (linked to commits / PRs)\n      │\n      └── Team Members</pre>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="flow" className="space-y-4">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2"><PlayCircle className="h-4 w-4" />Interactive test flow</CardTitle>
            <CardDescription>Walk through branch creation, file editing, commit, and PR creation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
              {[
                'Open feature branch and file',
                'Edit code and prepare commit',
                'Commit the changes',
                'Open a PR and link a task',
              ].map((label, index) => {
                const active = flowStep === index;
                const complete = flowStep > index;
                return (
                  <div key={label} className={cn('rounded-2xl border p-4 transition-colors', active ? 'border-primary/50 bg-primary/5' : 'border-border/60 bg-background/80')}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Step {index + 1}</p>
                      {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : active ? <CircleDashed className="h-4 w-4 text-primary" /> : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{label}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" className="gap-2" onClick={handleDemoAdvance} disabled={!canEdit && flowStep < 2}>
                <PlayCircle className="h-4 w-4" />{flowStep < 4 ? 'Run next demo step' : 'Restart demo'}
              </Button>
              <Button type="button" variant="outline" className="gap-2" onClick={() => {
                setFlowStep(0);
                setFlowLog(['Demo reset.']);
              }}>
                <RefreshCcw className="h-4 w-4" />Reset flow
              </Button>
              <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" />Linked task: {selectedTask?.title || 'none'}</Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Current flow state</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Branch: <span className="font-medium text-foreground">{activeBranch}</span></p>
                  <p>File: <span className="font-medium text-foreground">{selectedFile || 'none'}</span></p>
                  <p>Commit message: <span className="font-medium text-foreground">{commitMessage || 'empty'}</span></p>
                  <p>Pull request title: <span className="font-medium text-foreground">{pullRequestTitle || 'empty'}</span></p>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Flow log</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[220px] rounded-xl border border-border/60 bg-background/80 p-3">
                    <div className="space-y-2 text-sm">
                      {flowLog.map((entry, index) => (
                        <div key={`${entry}-${index}`} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-muted-foreground">
                          {entry}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
