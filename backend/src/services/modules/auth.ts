
export const AuthHooks = `import { useState, useEffect, createContext, useContext } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase URL and Key
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    // Example: Google Login
    // For Chrome Extensions, we often use chrome.identity or a popup flow
    // formatting details omitted for brevity
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: chrome.identity.getRedirectURL(),
      },
    });
    if (error) console.error('Login failed:', error);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
`;

export const AuthLoginComponent = `import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const LoginButton = () => {
  const { user, signIn, signOut, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (user) {
    return (
      <div className="p-4 border rounded bg-green-50">
        <p className="text-sm text-green-800 mb-2">Logged in as {user.email}</p>
        <button 
          onClick={signOut}
          className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signIn}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
    >
      Sign In with Google
    </button>
  );
};
`;

export const AuthFiles = {
    'src/hooks/useAuth.tsx': AuthHooks,
    'src/components/auth/LoginButton.tsx': AuthLoginComponent,
};
