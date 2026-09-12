import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import DebateList from "./pages/DebateList";
import ErrorBoundary from "./components/common/ErrorBoundary";
import useAuth from "./hooks/useAuth";
import { tokenStore } from "./api";
import Loading from "./components/common/Loading";

// 非首屏页面按路由懒加载（代码分割，降低首屏体积）
const DebateRoom = lazy(() => import("./pages/DebateRoom"));
const CreateDebate = lazy(() => import("./pages/CreateDebate"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Profile = lazy(() => import("./pages/Profile"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const Topics = lazy(() => import("./pages/Topics"));
const DebateChain = lazy(() => import("./pages/DebateChain"));

function PageLoading() {
  return (
    <div className="min-h-screen app-bg flex items-center justify-center">
      <Loading text="加载中..." />
    </div>
  );
}

/** 登录守卫 */
function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, loading } = useAuth(true);
  const location = useLocation();
  if (loading) {
    return <PageLoading />;
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

      {/* ---------- 公开页面（游客可浏览，互动时引导登录） ---------- */}
      <Route path="/debates" element={<DebateList />} />
      <Route path="/debate/:id" element={<DebateRoom />} />
      <Route path="/u/:id" element={<PublicProfile />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/topics" element={<Topics />} />
      <Route path="/chain/:id" element={<DebateChain />} />

      {/* ---------- 需登录 ---------- */}
      <Route
        path="/create"
        element={
          <RequireAuth>
            <CreateDebate />
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
        <Suspense fallback={<PageLoading />}>
          <AppRoutes />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
