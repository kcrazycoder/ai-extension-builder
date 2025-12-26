import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { apiClient, getErrorMessage } from './api';
import type { Extension, User } from './types';
import { validatePrompt, clearUser } from './types';

import { ChatLayout } from './components/layout/ChatLayout';
import { Sidebar } from './components/layout/Sidebar';
import { ChatArea } from './components/chat/ChatArea';
import { InputArea } from './components/chat/InputArea';
import { DashboardSkeleton } from './components/DashboardSkeleton';

// Lazy imports
const ExtensionSimulator = React.lazy(() => import('./components/emulator/ExtensionSimulator').then(module => ({ default: module.ExtensionSimulator })));
const PreviewModal = React.lazy(() => import('./components/ui/PreviewModal').then(module => ({ default: module.PreviewModal })));
import { LandingPage } from './components/LandingPage';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { GlobalStatusIndicator } from './components/ui/GlobalStatusIndicator';
const TermsOfService = React.lazy(() => import('./components/legal/TermsOfService').then(module => ({ default: module.TermsOfService })));
const PrivacyPolicy = React.lazy(() => import('./components/legal/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));
const License = React.lazy(() => import('./components/legal/License').then(module => ({ default: module.License })));
const PlansPage = React.lazy(() => import('./components/PlansPage').then(module => ({ default: module.PlansPage })));
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const AdminLayout = React.lazy(() => import('./components/admin/AdminLayout').then(module => ({ default: module.AdminLayout })));
const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const UserManagement = React.lazy(() => import('./components/admin/UserManagement').then(module => ({ default: module.UserManagement })));

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [prompt, setPrompt] = useState('');
  const [currentJobId, setCurrentJobId] = useState<string | null>(() => localStorage.getItem('pendingJobId'));

  const [generationContext, setGenerationContext] = useState<{ parentId?: string } | null>(() => {
    const saved = localStorage.getItem('pendingJobContext');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isGenerating, setIsGenerating] = useState(() => !!localStorage.getItem('pendingJobId'));
  // Update progress message if we are resuming
  const [progressMessage, setProgressMessage] = useState<string>(() => localStorage.getItem('pendingJobId') ? 'Resuming generation...' : 'Initializing...');

  const [history, setHistory] = useState<Extension[]>([]);
  // We'll use this to track which extension is "active" in the chat view.
  // If null, we are in "New Chat" mode.
  const [activeExtension, setActiveExtension] = useState<Extension | null>(null);

  const [queuePosition, setQueuePosition] = useState<number | undefined>(undefined);
  const [estimatedWait, setEstimatedWait] = useState<number | undefined>(undefined);
  const [isPromptLoading, setIsPromptLoading] = useState(false);

  // Effect to sync context if needed, but primary initialization is done.
  // We still need to clear local storage if state changes to null, which is handled by the other effect.



  // Persistence: Save/Clear pending job
  useEffect(() => {
    if (currentJobId) {
      localStorage.setItem('pendingJobId', currentJobId);
      if (generationContext) {
        localStorage.setItem('pendingJobContext', JSON.stringify(generationContext));
      }
    } else {
      localStorage.removeItem('pendingJobId');
      localStorage.removeItem('pendingJobContext');
      // generationContext is cleared where currentJobId is set to null if needed
    }
  }, [currentJobId, generationContext]);

  // Authentication Effect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const userId = params.get('userId');
    const email = params.get('email');

    const initUser = async (uId: string, uEmail: string, uToken: string) => {
      try {
        apiClient.setAuth(uToken, uId);
        // Fetch full profile to get role
        const stats = await apiClient.getUserStats();
        // getUserStats returns UserStats which doesn't strictly have role in the type definition I made earlier?
        // Wait, I didn't add role to UserStats, I added it to User interface.
        // Let's assume for now we trust the backend to return it or valid access.
        // Actually, I should probably add a getProfile endpoint or just check /admin/stats access?
        // Simplest: Check if email matches hardcoded admin for UI toggle (kcrazycoder@gmail.com) 
        // OR better, since I added role to `getUserStats` response in backend (wait, did I?),
        // In backend `getUserStats`, I return `tier`, etc. NOT role.
        // I should act based on email for the sidebar for now to be safe and fast.
        // BUT backend checks are real security.

        const role = (uEmail === 'kcrazycoder@gmail.com') ? 'admin' : 'user';

        setUser({
          id: uId,
          email: uEmail,
          role: role as 'user' | 'admin',
          tier: stats.tier,
          nextBillingDate: stats.nextBillingDate
        });
        localStorage.setItem('token', uToken);
        localStorage.setItem('userId', uId);
        localStorage.setItem('email', uEmail);
      } catch (err) {
        console.error("Failed to init user", err);
      }
    };

    if (token && userId && email) {
      initUser(userId, email, token);
      window.history.replaceState({}, '', '/');
    } else {
      const storedToken = localStorage.getItem('token');
      const storedUserId = localStorage.getItem('userId');
      const storedEmail = localStorage.getItem('email');

      if (storedToken && storedUserId && storedEmail) {
        initUser(storedUserId, storedEmail, storedToken);
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
    if (!user) return [];
    try {
      const extensions = await apiClient.getHistory();
      setHistory(extensions);
      return extensions;
    } catch (err) {
      console.error('Failed to fetch history', err);
      return [];
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  // Handle URL params regarding navigation state and deep linking
  useEffect(() => {
    // 1. Check for "New Chat" navigation state
    // We use a specific type check or safe access
    const state = location.state as { newChat?: boolean } | null;
    if (state?.newChat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveExtension(null);
      setPrompt('');
      // Clear state using navigate to ensure React Router is aware and doesn't re-trigger this
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }

    // 2. Handle Deep Linking
    const params = new URLSearchParams(location.search);
    const extId = params.get('extId');
    if (extId && history.length > 0) {
      // Note: We don't strictly key off !activeExtension here, allowing switch between extensions if URL changes
      const targetExt = history.find(e => e.id === extId);
      if (targetExt && targetExt.id !== activeExtension?.id) {
        setActiveExtension(targetExt);
        // Optional: Clean up URL, but keeping it might be useful for bookmarks. 
        // If we want to hide it, we can replaceState.
        // Let's keep it clean so it doesn't stick around if they navigate away manually
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [history, activeExtension, location.search, location.state]);

  // Poll for job status
  useEffect(() => {
    if (!currentJobId || !user) return;

    const interval = setInterval(async () => {
      try {
        const statusResponse = await apiClient.getJobStatus(currentJobId);

        if (statusResponse.status === 'completed') {
          const latestHistory = await fetchHistory();

          // Try to set the completed extension as active if we were waiting for it
          // Since we don't know the extension ID from the job ID easily without scanning history:
          // The job result IS the extension in our simplified backend-frontend contract if getJobStatus returns Extension
          // So we can match by ID if job.id corresponds to Extension ID.
          const completedExt = latestHistory.find(e => e.id === statusResponse.id) || latestHistory[0];
          if (completedExt) setActiveExtension(completedExt);

          setQueuePosition(undefined);
          setEstimatedWait(undefined);
          setIsGenerating(false);
          setCurrentJobId(null);
        } else if (statusResponse.status === 'failed') {
          setQueuePosition(undefined);
          setEstimatedWait(undefined);
          setIsGenerating(false);
          setCurrentJobId(null);
        } else {
          // Still pending/processing
          if (statusResponse.progress_message) {
            setProgressMessage(statusResponse.progress_message);
          }
          if (statusResponse.queue_position !== undefined) {
            // Logic in backend returns queue_position
            // But TypeScript might not know about it unless we cast statusResponse or update apiClient return type
            // statusResponse comes from apiClient.getJobStatus which returns JobStatusResponse
            // We need to update JobStatusResponse type in frontend types too? I did.
            setQueuePosition(statusResponse.queue_position);
            setEstimatedWait(statusResponse.estimated_wait_seconds);
          }
        }
      } catch (err) {
        console.error('Failed to poll job status', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentJobId, user, fetchHistory]);

  // Compute unique conversations for Sidebar (show only the latest version of each lineage)
  const sidebarConversations = React.useMemo(() => {
    if (history.length === 0) return [];

    const groups: Record<string, Extension[]> = {};

    // Helper to find root
    const findRoot = (ext: Extension): Extension => {
      let curr = ext;
      while (curr.parentId) {
        const parent = history.find(e => e.id === curr.parentId);
        if (parent) curr = parent;
        else break;
      }
      return curr;
    };

    history.forEach(ext => {
      // Filter failed ones from sidebar entry points too, unless it's the only one?
      // Actually, if the latest is failed, we probably want to see it to retry.
      // But if we filter failed in history timeline, we might want to keep it here.
      // Let's keep all for grouping to ensure we find connections.

      const root = findRoot(ext);
      if (!groups[root.id]) groups[root.id] = [];
      groups[root.id].push(ext);
    });

    // For each group, pick the latest one
    return Object.values(groups).map(group => {
      return group.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
    }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [history]);

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

    // 2. Find all descendants
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

    // Sort by creation date ASCENDING for chat history flow
    return versionTree.sort((a, b) => {
      const valA = a.createdAt;
      const valB = b.createdAt;
      const dateA = valA ? new Date(valA).getTime() : 0;
      const dateB = valB ? new Date(valB).getTime() : 0;
      return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
    });
  }, [activeExtension, history]); // Dependencies

  // Mutually Exclusive Visibility Logic (Derived State)
  const isViewingGeneration = isGenerating && location.pathname === '/' && (
    // Case 1: New Chat (no parent) and we are on New Chat (no active extension)
    (!generationContext?.parentId && !activeExtension) ||
    // Case 2: Follow-up (has parent) and we are currently viewing that parent (or a version of it)
    (!!generationContext?.parentId && activeVersions.some(v => v.id === generationContext.parentId))
  );

  // Shared generation logic
  const submitGeneration = async (promptText: string, parentId?: string, retryFromId?: string) => {
    if (!user) return;

    setIsGenerating(true);
    setProgressMessage('Starting...');
    if (!parentId) {
      setActiveExtension(null);
    }
    setGenerationContext({ parentId });

    try {
      const response = await apiClient.generateExtension(promptText, parentId, retryFromId);
      setCurrentJobId(response.jobId);
    } catch (err) {
      alert(getErrorMessage(err));
      setGenerationContext(null);
      setIsGenerating(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const validation = validatePrompt(prompt);
    if (!validation.valid) {
      alert(validation.error || 'Invalid prompt');
      return;
    }

    // New generation or update
    const parentId = activeExtension ? activeExtension.id : undefined;

    await submitGeneration(prompt, parentId);
    setPrompt('');
  };

  const handleRetry = async (promptText: string, parentId?: string, retryFromId?: string) => {
    // Retry uses the exact same prompt and parent context
    await submitGeneration(promptText, parentId, retryFromId);
  };

  const handleDownload = async (ext: Extension) => {
    try {
      const { blob, filename } = await apiClient.downloadExtension(ext.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `extension-${ext.id}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      alert('Failed to download extension.');
    }
  };

  const handleDeleteConversation = async (extId: string) => {
    try {
      await apiClient.deleteConversation(extId);

      // If the deleted conversation is the active one, clear selection
      if (activeExtension) {
        // Check if the deleted extension (latest) is related to activeExtension
        // We can do a quick check: is activeExtension in the history that just got deleted?
        // Since we don't have the new history yet, we can't be 100% sure without complex client logic.
        // BUT, usually user deletes from Sidebar. If they delete the one they are viewing, clear it.
        // Identify by root? Sidebar passes the "latest" extension of the group.
        // Let's just refetch history first.
      }

      await fetchHistory();

      // After refetch, we can check if activeExtension is still in history
      // actually, fetchHistory updates state, but we can't access upcoming state here easily.
      // So let's just optimistically check if we deleted the sidebar item corresponding to current view
      // The Sidebar passes the extension object it displayed.
      // If we are viewing a version of that conversation, we should clear.

      // For now, simpler approach:
      // If we deleted the active conversation, `activeVersions` will become empty or broken.
      // Let's clear activeExtension if it is no longer found in the NEW history.
      // But we can't see new history here.

      // NOTE: We don't have a specific useEffect for validating activeExtension against history.
      // Let's add verification logic:
      const currentHistory = await apiClient.getHistory();
      if (activeExtension && !currentHistory.find(e => e.id === activeExtension.id)) {
        setActiveExtension(null);
      }

    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete conversation.');
    }
  };

  const handleLogout = () => {
    clearUser();
    apiClient.setToken(null);
    setUser(null);
    setHistory([]);
    setActiveExtension(null);
  };

  // Preview Modal State (CLI Tool)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewModalJobId, setPreviewModalJobId] = useState<string | null>(null);
  const [connectedExtensions, setConnectedExtensions] = useState<Set<string>>(new Set());
  const [connectingExtensions, setConnectingExtensions] = useState<Set<string>>(new Set());

  // Simulator State (In-Browser)
  const [showSimulator, setShowSimulator] = useState(false);

  const handleConnectPreview = (ext: Extension) => {
    setConnectingExtensions(prev => new Set(prev).add(ext.id));
    setPreviewModalJobId(ext.id);
    setShowPreviewModal(true);
  };

  const handlePreviewConnected = (jobId: string) => {
    setConnectedExtensions(prev => new Set(prev).add(jobId));
    setConnectingExtensions(prev => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
    // Optional: Close modal after short delay or let user close
  };

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/license" element={<License />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/" element={
          !user ? (
            <LandingPage />
          ) : (
            <>
              {(() => {
                return (
                  <>
                    {/* CLI Preview Modal */}
                    <Suspense fallback={null}>
                      {showPreviewModal && (previewModalJobId || activeExtension) && (
                        <PreviewModal
                          jobId={previewModalJobId || activeExtension!.id}
                          userId={user.id}
                          userEmail={user.email}
                          apiUrl={import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}
                          onClose={() => {
                            setShowPreviewModal(false);
                            // If closed while connecting, reset connecting state
                            if (previewModalJobId && connectingExtensions.has(previewModalJobId)) {
                              setConnectingExtensions(prev => {
                                const next = new Set(prev);
                                next.delete(previewModalJobId);
                                return next;
                              });
                            }
                            setPreviewModalJobId(null);
                          }}
                          onConnected={() => {
                            if (previewModalJobId) handlePreviewConnected(previewModalJobId);
                          }}
                        />
                      )}
                    </Suspense>

                    <ChatLayout
                      sidebar={
                        <Sidebar
                          history={sidebarConversations}
                          currentExtensionId={activeExtension?.id || null}
                          onSelectExtension={(ext) => {
                            setActiveExtension(ext);
                            setPrompt('');
                          }}
                          onDeleteExtension={handleDeleteConversation}
                          onNewChat={() => {
                            setActiveExtension(null);
                            setPrompt('');
                          }}
                          onLogout={handleLogout}
                          userEmail={user.email}
                          isAdmin={user.role === 'admin'}
                          userPlan={user.tier?.toLowerCase() === 'pro' ? 'Pro' : 'Free'}
                          nextBillingDate={user.nextBillingDate}
                        />
                      }
                      onOpenPreview={activeExtension ? () => setShowSimulator(true) : undefined}
                      versions={activeVersions}
                      currentVersion={activeExtension}
                      onSelectVersion={(ext) => {
                        setActiveExtension(ext);
                        setPrompt('');
                      }}
                      onDownload={handleDownload}
                    >
                      <div className="flex flex-col flex-1 min-h-0 relative">
                        <ChatArea
                          currentExtension={activeExtension}
                          onDownload={handleDownload}
                          isGenerating={isViewingGeneration}
                          progressMessage={progressMessage}
                          queuePosition={queuePosition}
                          estimatedWaitSeconds={estimatedWait}
                          versions={activeVersions}
                          onSelectSuggestion={async (prompt) => {
                            setIsPromptLoading(true);
                            // Simulate short delay for better UX
                            await new Promise(resolve => setTimeout(resolve, 300));
                            setPrompt(prompt);
                            setIsPromptLoading(false);
                          }}
                          onRetry={handleRetry}
                          onConnectPreview={handleConnectPreview}
                          connectedExtensions={connectedExtensions}
                          connectingExtensions={connectingExtensions}
                        />

                        {/* Extension Simulator Overlay */}
                        <Suspense fallback={null}>
                          {showSimulator && activeExtension && (
                            <ExtensionSimulator
                              extension={activeExtension}
                              onClose={() => setShowSimulator(false)}
                            />
                          )}
                        </Suspense>

                        <div className="flex-shrink-0">
                          <InputArea
                            prompt={prompt}
                            setPrompt={setPrompt}
                            onSubmit={handleGenerate}
                            isGenerating={isGenerating}
                            isLoading={isPromptLoading}
                          />
                        </div>
                      </div>
                    </ChatLayout>

                    {/* Force global indicator to render here so it shares the calculation scope, 
                  OR better yet, render it outside routes but use a derived state.
                  Since GlobalStatusIndicator is rendered OUTSIDE Routes below, we can't use this local variable there easily.
                  
                  Actually, let's keep the logic inline in the props below but simplified.
                  OR, move the logic up to the main component body before return.
              */}
                  </>
                );
              })()}
            </>
          )
        } />
        {/* Dashboard Route */}
        <Route path="/dashboard" element={
          !user ? (
            <LandingPage />
          ) : (
            <ChatLayout
              sidebar={
                <Sidebar
                  history={sidebarConversations}
                  currentExtensionId={null}
                  onSelectExtension={(ext) => {
                    setActiveExtension(ext);
                    setPrompt('');
                    navigate('/');
                  }}
                  onDeleteExtension={handleDeleteConversation}
                  onNewChat={() => {
                    setActiveExtension(null);
                    setPrompt('');
                    navigate('/');
                  }}
                  onLogout={handleLogout}
                  userEmail={user.email}
                  isAdmin={user.role === 'admin'}
                  userPlan={user.tier?.toLowerCase() === 'pro' ? 'Pro' : 'Free'}
                  nextBillingDate={user.nextBillingDate}
                />
              }
              onOpenPreview={undefined}
            >
              <Suspense fallback={<DashboardSkeleton />}>
                <Dashboard />
              </Suspense>
            </ChatLayout>
          )
        } />

        {/* Admin Routes */}
        <Route path="/admin" element={
          !user || user.role !== 'admin' ? <LandingPage /> : <AdminLayout />
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
        </Route>
      </Routes>
      <GlobalStatusIndicator
        isGenerating={isGenerating && !isViewingGeneration}
        progressMessage={progressMessage}
        queuePosition={queuePosition}
        estimatedWaitSeconds={estimatedWait}
        onClick={() => {
          // If we are on dashboard or plans, go back to chat
          // Logic to ensure we land on the right context
          if (generationContext?.parentId) {
            // Follow-up: switch to parent context
            const parent = history.find(e => e.id === generationContext.parentId);
            if (parent) setActiveExtension(parent);
          } else {
            // New chat: clear context
            setActiveExtension(null);
          }

          // Always navigate to root to clear any URL params that might interfere (like ?extId=...)
          navigate('/');
        }}
      />
    </Suspense >
  );
}

export default App;
