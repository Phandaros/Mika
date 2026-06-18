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
import { NotificationsPage } from "./pages/NotificationsPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { ReviewsPage } from "./pages/ReviewsPage";
import { SprintBoardPage } from "./pages/SprintBoardPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { UsersPage } from "./pages/UsersPage";
import { WeeklyReportPage } from "./pages/WeeklyReportPage";
import { TeamBoardPage } from "./pages/TeamBoardPage";
import { WeeklyReportsAdminPage } from "./pages/WeeklyReportsAdminPage";
import { Role } from "shared";

const AUTH_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function PrivateRoute() {
  const { user, refreshSession } = useAuth();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (user) {
      setIsCheckingSession(false);
      return () => {
        mounted = false;
      };
    }

    async function bootstrap() {
      await refreshSession();

      if (mounted) {
        setIsCheckingSession(false);
      }
    }

    setIsCheckingSession(true);
    void bootstrap();

    return () => {
      mounted = false;
    };
  }, [refreshSession, user]);

  if (isCheckingSession) {
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

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    function refreshVisibleSession() {
      if (document.visibilityState === "visible") {
        void refreshSession({ silent: true });
      }
    }

    function refreshOnlineSession() {
      void refreshSession({ silent: true });
    }

    document.addEventListener("visibilitychange", refreshVisibleSession);
    window.addEventListener("online", refreshOnlineSession);

    return () => {
      document.removeEventListener("visibilitychange", refreshVisibleSession);
      window.removeEventListener("online", refreshOnlineSession);
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
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/weekly-reports/mine" element={<WeeklyReportPage />} />
            <Route element={<CoordinatorRoute />}>
              <Route path="/weekly-reports" element={<WeeklyReportsAdminPage />} />
              <Route path="/sprint/civil" element={<SprintBoardPage scope="civil" />} />
              <Route path="/sprint/eletrico" element={<SprintBoardPage scope="electrical" />} />
              <Route path="/reviews" element={<ReviewsPage />} />
              <Route path="/team-board" element={<TeamBoardPage />} />
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
