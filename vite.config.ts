import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
  const autoBase = mode === "production" && repoName ? `/${repoName}/` : "/";

  return {
    base: process.env.VITE_BASE_PATH || autoBase,
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // 分離 vendor 依賴
            if (id.includes("node_modules")) {
              if (id.includes("@supabase")) return "vendor-supabase";
              if (id.includes("@tanstack/react-query")) return "vendor-query";
              if (id.includes("sonner")) return "vendor-sonner";
              if (id.includes("date-fns")) return "vendor-date";
              if (id.includes("@radix-ui")) return "vendor-ui";
              if (id.includes("react-router-dom")) return "vendor-react";
              if (id.includes("react")) return "vendor-react";
            }
            
            // 分離功能模塊
            if (id.includes("useSyncWatch") || id.includes("SyncWatch")) {
              return "module-sync-watch";
            }
            if (id.includes("useHolodex") || id.includes("holodex.ts")) {
              return "module-holodex";
            }
            if (id.includes("components/sync/")) {
              return "module-sync-components";
            }
          },
        },
      },
      chunkSizeWarningLimit: 600, // 提高警告閾值到 600 kB
    },
  };
});
