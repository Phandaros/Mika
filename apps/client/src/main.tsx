import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { App } from "./App";
import { queryClient } from "./lib/queryClient";
import { initializeRuntimeConfig } from "./lib/runtimeConfig";
import "./styles/globals.css";

async function bootstrap(): Promise<void> {
  await initializeRuntimeConfig();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster richColors position="top-right" theme="dark" toastOptions={{ classNames: { toast: "border border-border-subtle bg-bg-2" } }} />
      </QueryClientProvider>
    </React.StrictMode>
  );
}

void bootstrap();
