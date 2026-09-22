import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Config propia (no vite.config.ts) a proposito: los tests no necesitan los
// plugins de cesium/compresion, que cuestan varios segundos por corrida.
export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/test/setup.ts"],
        include: ["src/**/*.{test,spec}.{ts,tsx}"],
        css: false,
        clearMocks: true,
    },
});
