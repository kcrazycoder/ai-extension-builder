import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, getLoginUrl, getErrorMessage } from './api';
import type { Extension, User } from './types';
import { validatePrompt, clearUser } from './types';
import { ThemeProvider } from './context/ThemeContext';
import { ChatLayout } from './components/layout/ChatLayout';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { InputArea } from './components/chat/InputArea';
import { Sparkles, LogIn } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<Extension[]>([]);
  // We'll use this to track which extension is "active" in the chat view.
  // If null, we are in "New Chat" mode.
  const [activeExtension, setActiveExtension] = useState<Extension | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>('Initializing...');

  // Authentication Effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userId = params.get('userId');
    const email = params.get('email');

    if (token && userId && email) {
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      localStorage.setItem('email', email);
      setUser({ id: userId, email });
      apiClient.setAuth(token, userId);
      window.history.replaceState({}, '', '/');
    } else {
      const storedToken = localStorage.getItem('token');
      const storedUserId = localStorage.getItem('userId');
      const storedEmail = localStorage.getItem('email');

      if (storedToken && storedUserId && storedEmail) {
        setUser({ id: storedUserId, email: storedEmail });
        apiClient.setAuth(storedToken, storedUserId);
      }
    }
  }, []);

  // Listen for auth logout
  useEffect(() => {
    const handleLogout = () => {
      setUser(null);
      setHistory([]);
      setActiveExtension(null);
    };
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    try {
      const extensions = await apiClient.getHistory();
      setHistory(extensions);

      // If we have a currentJobId, we find that extension and set it as active

    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  }, [user, currentJobId]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  // Poll for job status
  useEffect(() => {
    if (!currentJobId || !user) return;

    const interval = setInterval(async () => {
      try {
        const job = await apiClient.getJobStatus(currentJobId);

        if (job.progress_message) {
          setProgressMessage(job.progress_message);
        }

        // If we are looking at the "active" generation, we might want to update it live
        // But for now, let's just refresh history on completion
        if (job.status === 'completed' || job.status === 'failed') {
          setIsGenerating(false);
          setCurrentJobId(null);
          await fetchHistory();

          // Try to set the completed extension as active if we were waiting for it
          // Since we don't know the extension ID from the job ID easily without scanning history:
          const latestHistory = await apiClient.getHistory();
          // The job result IS the extension in our simplified backend-frontend contract if getJobStatus returns Extension
          // So we can match by ID if job.id corresponds to Extension ID.
          const completedExt = latestHistory.find(e => e.id === job.id) || latestHistory[0];
          if (completedExt) setActiveExtension(completedExt);
        }
      } catch (err) {
        console.error('Failed to poll job status', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentJobId, user, fetchHistory]);

  // Compute version history for the active extension
  const activeVersions = React.useMemo(() => {
    if (!activeExtension || history.length === 0) return [];

    // 1. Find root
    let root = activeExtension;
    while (root.parentId) {
      const parent = history.find(e => e.id === root.parentId);
      if (parent) root = parent;
      else break; // Orphaned?
    }

    // 2. Find all descendants of root (naively find all that map back to root)
    // This requires traversing up for EVERY item in history to see if it hits root.
    // Optimization: Build adjacency list? For small history, O(N*Depth) is fine.

    const versionTree: Extension[] = [];
    history.forEach(ext => {
      let curr: Extension | undefined = ext;
      while (curr) {
        if (curr.id === root.id) {
          versionTree.push(ext);
          break;
        }
        if (!curr.parentId) break; // Reached different root
        curr = history.find(e => e.id === curr!.parentId);
      }
    });

    // Sort by creation date descending
    return versionTree.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activeExtension, history]);


  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      alert(validation.error || 'Invalid prompt'); // Simple alert for now, or use a toast later
      return;
    }

    setIsGenerating(true);
    setProgressMessage('Starting...');
    // Clear active extension to show "Thinking..." state in Chat Area effectively
    setActiveExtension(null);

    // We want to "optimistically" show the user prompt immediately?
    // The ChatArea handles `currentExtension`. If we set `activeExtension` to a temporary object, we can show it.
    // However, the real ID comes from the backend.

    try {
      // If we have an active extension, this is an update request
      const parentId = activeExtension ? activeExtension.id : undefined;
      const response = await apiClient.generateExtension(prompt, parentId);
      setCurrentJobId(response.jobId);

      // Fetch history immediately to hopefully see the "processing" item
      // But typically there is race condition. we will rely on "IsGenerating" state in ChatArea
      // to show a loading placeholder until polling finds the new item.

      setPrompt('');
    } catch (err) {
      alert(getErrorMessage(err)); // Replace with better error UI
      setIsGenerating(false);
    }
  };

  const handleDownload = async (ext: Extension) => {
    try {
      const blob = await apiClient.downloadExtension(ext.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extension-${ext.id}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download extension.');
    }
  };

  const handleLogout = () => {
    clearUser();
    apiClient.setToken(null);
    setUser(null);
    setHistory([]);
    setActiveExtension(null);
  };

  const handleLogin = () => {
    window.location.href = getLoginUrl();
  };

  if (!user) {
    // Keeping the original Login UI but wrapped in ThemeProvider if we want dark mode there too
    // For now, let's just leave it clean but use standard classes
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-8 transition-colors">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center space-y-6 border border-slate-100 dark:border-zinc-800">
            <div className="flex justify-center">
              <Sparkles className="w-16 h-16 text-primary-500" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">AI Extension Builder</h1>
            <p className="text-slate-600 dark:text-slate-400">
              Sign in to start generating browser extensions with AI.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-primary-500/25"
            >
              <LogIn className="w-5 h-5" />
              Sign in with WorkOS
            </button>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ChatLayout
        sidebar={
          <Sidebar
            history={history}
            currentExtensionId={activeExtension?.id || null}
            onSelectExtension={setActiveExtension}
            onNewChat={() => setActiveExtension(null)}
            onLogout={handleLogout}
            userEmail={user.email}
          />
        }
      >
        <div className="flex flex-col h-full">
          <ChatArea
            currentExtension={activeExtension}
            onDownload={handleDownload}
            isGenerating={isGenerating}
            userEmail={user.email}
            progressMessage={progressMessage}
            versions={activeVersions}
            onSelectVersion={setActiveExtension}
          />
          <div className="flex-shrink-0">
            <InputArea
              prompt={prompt}
              setPrompt={setPrompt}
              onSubmit={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </ChatLayout>
    </ThemeProvider>
  );
}

export default App;
