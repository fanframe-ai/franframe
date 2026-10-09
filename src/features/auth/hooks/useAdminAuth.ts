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
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setState(prev => ({
            ...prev,
            isAuthenticated: true,
            user: session.user,
          }));
          
          // Defer admin check with setTimeout to avoid deadlock
          setTimeout(() => {
            checkAdminRole(session.user.id);
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

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          user: session.user,
        }));
        checkAdminRole(session.user.id);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "super_admin"])
        .maybeSingle();

      if (error) {
        reportError('admin_role_read_failed', error);
        setState(prev => ({
          ...prev,
          isAdmin: false,
          isLoading: false,
          error: "Erro ao verificar permissões",
        }));
        return;
      }

      setState(prev => ({
        ...prev,
        isAdmin: !!data,
        isLoading: false,
        error: data ? null : "Acesso negado. Você não é administrador.",
      }));
    } catch (err) {
      reportError('admin_role_failed', err);
      setState(prev => ({
        ...prev,
        isAdmin: false,
        isLoading: false,
        error: "Erro ao verificar permissões",
      }));
    }
  };

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
