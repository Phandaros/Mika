import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { LoadingSpinner } from "./components/shared/LoadingSpinner";
import { useAuth } from "./hooks/useAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { MyTasksPage } from "./pages/MyTasksPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProjectDetailPage } from "./pages/ProjectDetailPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { UserProfilePage } from "./pages/UserProfilePage";
import { UsersPage } from "./pages/UsersPage";
import { Role } from "shared";

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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<PrivateRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route element={<CoordinatorRoute />}>
              <Route path="/users" element={<UsersPage />} />
            </Route>
            <Route path="/users/:userId" element={<UserProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
