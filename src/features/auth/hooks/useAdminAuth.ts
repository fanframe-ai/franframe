import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reportError } from '@/lib/diagnostics';

interface AdminAuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  error: string | null;
  user: User | null;
}

export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>({
    isAuthenticated: false,
    isAdmin: false,
    isLoading: true,
    error: null,
    user: null,
  });

  useEffect(() => {
    let disposed = false;
    let revision = 0;
    let roleRequest: AbortController | undefined;
    let deferredCheck: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout>;
    const startDeadline = () => setTimeout(() => {
      revision++;
      roleRequest?.abort();
      reportError('admin_access_timeout', null);
      setState(prev => ({ ...prev, isAdmin: false, isLoading: false, error: "Erro ao verificar permissões" }));
    }, 15_000);
    deadline = startDeadline();

    const checkAdminRole = async (userId: string, checkRevision: number) => {
      const controller = new AbortController();
      roleRequest = controller;
      try {
        const { data, error } = await supabase.from("user_roles").select("role")
          .eq("user_id", userId).in("role", ["admin", "super_admin"]).abortSignal(controller.signal).maybeSingle();
        if (disposed || revision !== checkRevision) return;
        clearTimeout(deadline);
        if (error) throw error;
        setState(prev => ({ ...prev, isAdmin: !!data, isLoading: false,
          error: data ? null : "Acesso negado. Você não é administrador." }));
      } catch (error) {
        if (disposed || revision !== checkRevision) return;
        clearTimeout(deadline);
        reportError('admin_role_read_failed', error);
        setState(prev => ({ ...prev, isAdmin: false, isLoading: false, error: "Erro ao verificar permissões" }));
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (disposed) return;
        const checkRevision = ++revision;
        clearTimeout(deadline);
        clearTimeout(deferredCheck);
        roleRequest?.abort();
        if (session?.user) {
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            isAdmin: false,
            isLoading: true,
            error: null,
            user: session.user,
          }));
          deadline = startDeadline();
          // Supabase auth callbacks run under a session lock; query after release.
          deferredCheck = setTimeout(() => {
            void checkAdminRole(session.user.id, checkRevision);
          }, 0);
        } else {
          setState({
            isAuthenticated: false,
            isAdmin: false,
            isLoading: false,
            error: null,
            user: null,
          });
        }
      }
    );

    return () => {
      disposed = true;
      revision++;
      clearTimeout(deadline);
      clearTimeout(deferredCheck);
      roleRequest?.abort();
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message === "Invalid login credentials" 
            ? "Email ou senha incorretos" 
            : error.message,
        }));
        return false;
      }

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: "Erro ao fazer login",
      }));
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setState({
      isAuthenticated: false,
      isAdmin: false,
      isLoading: false,
      error: null,
      user: null,
    });
  };

  return {
    ...state,
    login,
    logout,
  };
}
