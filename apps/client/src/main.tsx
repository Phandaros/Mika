import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { App } from "./App";
import { queryClient } from "./lib/queryClient";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#242424",
            color: "#F5F5F5",
            border: "1px solid #3A3A3A"
          }
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
