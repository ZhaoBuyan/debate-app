import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import DebateList from "./pages/DebateList";
import DebateRoom from "./pages/DebateRoom";
import CreateDebate from "./pages/CreateDebate";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import DebateChain from "./pages/DebateChain";
import ErrorBoundary from "./components/common/ErrorBoundary";
import useAuth from "./hooks/useAuth";
import { tokenStore } from "./api";
import Loading from "./components/common/Loading";

/** 登录守卫 */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth(true);
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <Loading text="登录校验中..." />
      </div>
    );
  }
  if (!user && !tokenStore.get()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return children;
}

/** 管理员守卫 */
function RequireAdmin({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && user.role !== "super_admin") {
    return <Navigate to="/debates" replace />;
  }
  return children;
}

/** 已登录访问登录页时跳转大厅 */
function GuestOnly({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();
  if (user || tokenStore.get()) return <Navigate to="/debates" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <Login />
          </GuestOnly>
        }
      />
      <Route
        path="/debates"
        element={
          <RequireAuth>
            <DebateList />
          </RequireAuth>
        }
      />
      <Route
        path="/create"
        element={
          <RequireAuth>
            <CreateDebate />
          </RequireAuth>
        }
      />
      <Route
        path="/debate/:id"
        element={
          <RequireAuth>
            <DebateRoom />
          </RequireAuth>
        }
      />
      <Route
        path="/profile"
        element={
          <RequireAuth>
            <Profile />
          </RequireAuth>
        }
      />
      <Route
        path="/chain/:id"
        element={
          <RequireAuth>
            <DebateChain />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route path="/" element={<Navigate to="/debates" replace />} />
      <Route path="*" element={<Navigate to="/debates" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
