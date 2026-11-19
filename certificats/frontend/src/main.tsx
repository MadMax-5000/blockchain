import "@fontsource-variable/inter";
import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import { wagmiConfig } from "@/lib/wagmi";
import { NetworkProvider } from "@/hooks/use-network";
import { VersionProvider } from "@/hooks/use-version";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <VersionProvider>
            <BrowserRouter>
              <App />
              <Toaster
                theme="dark"
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: "hsl(0 0% 6.5%)",
                    border: "1px solid hsl(0 0% 16%)",
                    color: "hsl(0 0% 96%)",
                    fontSize: "13px",
                  },
                }}
              />
            </BrowserRouter>
          </VersionProvider>
        </NetworkProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
