// client/src/hooks/useAuth.ts

import { useCallback, useEffect, useState } from "react";
import api, { tokenStore, userStore, errMsg } from "../api";
import { disconnectSocket } from "../socket";
import type { User } from "../types";

/**
 * 全局登录态 Hook：读取 localStorage 中的用户信息，
 * 可选启动时向 /auth/me 校验 token 是否仍有效
 */
export function useAuth(validateOnMount = false) {
  const [user, setUser] = useState<User | null>(userStore.get());
  const [loading, setLoading] = useState(validateOnMount);

  useEffect(() => {
    if (!validateOnMount) return;
    const token = tokenStore.get();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    api
      .me()
      .then((u) => {
        setUser(u);
        userStore.set(u);
      })
      .catch(() => {
        // 401 时拦截器已清理 token
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [validateOnMount]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await api.login(username, password);
    tokenStore.set(data.token);
    userStore.set(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const data = await api.register(username, password);
    tokenStore.set(data.token);
    userStore.set(data.user);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    userStore.clear();
    disconnectSocket();
    setUser(null);
  }, []);

  /** 从服务器刷新当前用户（结算后积分/段位变化时调用） */
  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const u = await api.me();
      userStore.set(u);
      setUser(u);
      return u;
    } catch {
      return null;
    }
  }, []);

  const isAdmin = !!user && (user.role === "admin" || user.role === "super_admin");
  const isSuperAdmin = user?.role === "super_admin";

  return { user, loading, login, register, logout, refreshUser, isAdmin, isSuperAdmin, errMsg };
}

export default useAuth;
