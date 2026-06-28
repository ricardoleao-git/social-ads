import { useState, useCallback } from "react";

export interface RealDataState {
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  profile: null;
  posts: unknown[];
  insights: null;
  hashtagAnalytics: unknown[];
}

export function useInstagramRealData() {
  const [state, setState] = useState<RealDataState>({
    isLoading: false,
    isAuthenticated: false,
    error: null,
    profile: null,
    posts: [],
    insights: null,
    hashtagAnalytics: [],
  });

  const authorize = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    // Stub: In production, redirect to Instagram OAuth
    setState((s) => ({ ...s, isLoading: false, error: 'Instagram OAuth não configurado' }));
  }, []);

  const logout = useCallback(() => {
    setState((s) => ({ ...s, isAuthenticated: false, profile: null, posts: [], insights: null }));
  }, []);

  const refresh = useCallback(async () => {
    if (!state.isAuthenticated) return;
    setState((s) => ({ ...s, isLoading: true }));
    setState((s) => ({ ...s, isLoading: false }));
  }, [state.isAuthenticated]);

  return { ...state, authorize, logout, refresh };
}
