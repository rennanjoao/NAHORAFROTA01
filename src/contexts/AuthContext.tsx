import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

type AppRole = "admin" | "fleet_manager" | "dispatcher" | "viewer";

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface AuthCache {
  userId: string;
  profile: Profile | null;
  roles: AppRole[];
  isDriverUser: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  rolesLoading: boolean; // New: separate loading state for roles
  isDriverUser: boolean; // New: immediate driver detection
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_CACHE_KEY = "nahora-frota-auth-cache";

const readAuthCache = (): AuthCache | null => {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthCache) : null;
  } catch {
    return null;
  }
};

const writeAuthCache = (cache: AuthCache) => {
  localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
};

const clearAuthCache = () => {
  localStorage.removeItem(AUTH_CACHE_KEY);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const cachedAuthRef = useRef<AuthCache | null>(readAuthCache());
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(cachedAuthRef.current?.profile ?? null);
  const [roles, setRoles] = useState<AppRole[]>(cachedAuthRef.current?.roles ?? []);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(!cachedAuthRef.current);
  const [isDriverUser, setIsDriverUser] = useState(cachedAuthRef.current?.isDriverUser ?? false);
  const loadedUserIdRef = useRef<string | null>(null);

  // Check if user is a driver by querying the database
  const checkDriverStatus = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('drivers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      const isDriver = !!data;
      setIsDriverUser(isDriver);
      return isDriver;
    } catch (error) {
      console.error('Error checking driver status:', error);
      setIsDriverUser(false);
      return false;
    }
  }, []);

  // Fetch user profile from database
  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!error && data) {
      const nextProfile = data as Profile;
      setProfile(nextProfile);
      return nextProfile;
    }

    return null;
  }, []);

  // Fetch user roles from database
  const fetchRoles = useCallback(async (userId: string, showLoading = true) => {
    if (showLoading) setRolesLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (!error && data) {
        const nextRoles = data.map((r) => r.role as AppRole);
        setRoles(nextRoles);
        return nextRoles;
      }

      return [];
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const loadUserData = useCallback(async (userId: string, force = false) => {
    if (!force && loadedUserIdRef.current === userId) return;

    const hasUsableCache = cachedAuthRef.current?.userId === userId && cachedAuthRef.current.roles.length > 0;
    loadedUserIdRef.current = userId;

    if (hasUsableCache) {
      setProfile(cachedAuthRef.current.profile);
      setRoles(cachedAuthRef.current.roles);
      setIsDriverUser(cachedAuthRef.current.isDriverUser);
      setRolesLoading(false);
    } else {
      setProfile(null);
      setRoles([]);
      setIsDriverUser(false);
      setRolesLoading(true);
    }

    const [nextProfile, nextRoles, nextIsDriverUser] = await Promise.all([
      fetchProfile(userId),
      fetchRoles(userId, false),
      checkDriverStatus(userId),
    ]);

    const nextCache = {
      userId,
      profile: nextProfile,
      roles: nextRoles,
      isDriverUser: nextIsDriverUser,
    };

    cachedAuthRef.current = nextCache;
    writeAuthCache(nextCache);
    setRolesLoading(false);
  }, [checkDriverStatus, fetchProfile, fetchRoles]);

  const clearUserData = useCallback(() => {
    loadedUserIdRef.current = null;
    cachedAuthRef.current = null;
    setProfile(null);
    setRoles([]);
    setRolesLoading(false);
    setIsDriverUser(false);
    clearAuthCache();
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Token refresh happens silently. Do not reload roles or show a loading
          // screen, otherwise active pages/forms are unmounted and lose progress.
          if (event === "TOKEN_REFRESHED" && loadedUserIdRef.current === session.user.id) {
            setLoading(false);
            return;
          }

          const shouldForceReload = event === "SIGNED_IN" || event === "USER_UPDATED";

          // Defer Supabase calls to avoid auth callback deadlocks.
          setTimeout(() => {
            loadUserData(session.user.id, shouldForceReload);
          }, 0);
        } else {
          clearUserData();
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        clearUserData();
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [clearUserData, loadUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });
    return { error };
  };

  const signOut = async () => {
    // Clear all state FIRST to prevent stale data flash
    setUser(null);
    setSession(null);
    clearUserData();
    await supabase.auth.signOut();
  };

  const hasRole = (role: AppRole): boolean => {
    return roles.includes(role);
  };

  const isAdmin = (): boolean => {
    return hasRole("admin");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        rolesLoading,
        isDriverUser,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Default values for when context is not available (e.g., during HMR)
const defaultAuthContext: AuthContextType = {
  user: null,
  session: null,
  profile: null,
  roles: [],
  loading: true,
  rolesLoading: true,
  isDriverUser: false,
  signIn: async () => ({ error: new Error("Auth not initialized") }),
  signUp: async () => ({ error: new Error("Auth not initialized") }),
  signOut: async () => {},
  hasRole: () => false,
  isAdmin: () => false,
};

export function useAuth() {
  const context = useContext(AuthContext);
  // Return default context during HMR or before provider mounts
  if (context === undefined) {
    console.warn("useAuth: AuthContext not available, using defaults");
    return defaultAuthContext;
  }
  return context;
}
