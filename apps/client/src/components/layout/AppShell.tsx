import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-brand-black text-text-primary lg:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Header />
        <main className="w-full px-3 py-4 sm:px-6 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
