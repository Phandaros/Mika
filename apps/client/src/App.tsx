import { useEffect, useState } from "react";
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LoadingSpinner } from "./components/shared/LoadingSpinner";
import { useAuth } from "./hooks/useAuth";
import { AdminCalendarPage } from "./pages/AdminCalendarPage";
import { GlobalWorkloadPage } from "./pages/GlobalWorkloadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SprintBoardPage } from "./pages/SprintBoardPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { UsersPage } from "./pages/UsersPage";
import { Role } from "shared";

const AUTH_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function PrivateRoute() {
  const { user, refreshSession } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!user) {
        await refreshSession();
      }

      if (mounted) {
        setChecked(true);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [refreshSession, user]);

  if (!checked) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function CoordinatorRoute() {
  const { user } = useAuth();
  const allowed = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;

  return allowed ? <Outlet /> : <Navigate to="/" replace />;
}

function AdminPermissionRoute() {
  const { user } = useAuth();
  const allowed = user?.role === Role.ADMIN || user?.role === Role.COORDINATOR;

  return allowed ? <Outlet /> : <Navigate to="/" replace />;
}

export function App() {
  const Router = window.mkProjetos?.isDesktop === true ? HashRouter : BrowserRouter;
  const { user, refreshSession } = useAuth();

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshSession({ silent: true });
    }, AUTH_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshSession, user]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/workloads/geral" element={<GlobalWorkloadPage scope="general" />} />
            <Route path="/workloads/civil" element={<GlobalWorkloadPage scope="civil" />} />
            <Route path="/workloads/eletrico" element={<GlobalWorkloadPage scope="electrical" />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route element={<CoordinatorRoute />}>
              <Route path="/sprint/civil" element={<SprintBoardPage scope="civil" />} />
              <Route path="/sprint/eletrico" element={<SprintBoardPage scope="electrical" />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route element={<AdminPermissionRoute />}>
              <Route path="/admin/calendar" element={<AdminCalendarPage />} />
            </Route>
            <Route path="/users/:userId" element={<UserProfilePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}
