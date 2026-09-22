import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { visualizer } from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";
import fs from "node:fs";
import path from "node:path";

const CESIUM_SOURCE = "node_modules/cesium/Build/Cesium";
const CESIUM_DIRS = ["Assets", "Workers", "Widgets", "ThirdParty"];

const MIME: Record<string, string> = {
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".json": "application/json",
    ".css": "text/css",
    ".xml": "application/xml",
    ".wasm": "application/wasm",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".ktx2": "image/ktx2",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
};

// Sirve los assets de Cesium desde node_modules en dev y los copia
// dereferenciados al bundle en build (vite-plugin-static-copy fallaba en ambos)
function cesiumAssets(base: string): Plugin {
    let outDir = "dist";
    let isBuild = false;
    return {
        name: "cesium-assets",
        configResolved(config) {
            outDir = config.build.outDir;
            isBuild = config.command === "build";
        },
        configureServer(server) {
            server.middlewares.use(`/${base}`, (req, res, next) => {
                const rel = decodeURIComponent((req.url ?? "").split("?")[0]);
                const file = path.join(CESIUM_SOURCE, rel);
                const resolved = path.resolve(file);
                if (
                    !resolved.startsWith(path.resolve(CESIUM_SOURCE)) ||
                    !fs.existsSync(file) ||
                    !fs.statSync(file).isFile()
                )
                    return next();
                res.setHeader(
                    "Content-Type",
                    MIME[path.extname(file)] ?? "application/octet-stream",
                );
                fs.createReadStream(file).pipe(res);
            });
        },
        closeBundle() {
            if (!isBuild) return;
            for (const dir of CESIUM_DIRS) {
                fs.cpSync(
                    path.join(CESIUM_SOURCE, dir),
                    path.join(outDir, base, dir),
                    { recursive: true, dereference: true },
                );
            }
        },
    };
}

export default defineConfig(({ mode }) => {
    const isProd = mode === "production";
    const cesiumBaseUrl = isProd ? "assets/cesium" : "cesium-assets";

    return {
        define: {
            // CesiumJS localiza sus assets estáticos (Workers, Assets, etc.) con este global
            CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}/`),
        },
        build: {
            sourcemap: "hidden",
            chunkSizeWarningLimit: 2000,
            rollupOptions: {
                output: {
                    // olcs queda sin chunk manual a propósito: importa cesium
                    // estáticamente y debe vivir detrás de su import() dinámico
                    manualChunks(id) {
                        const path = id.replace(/^\0/, "").split("?")[0];
                        // Micro-deps compartidas entre chunks pesados y el resto: al vendor
                        // para que no acoplen chunks (clsx dentro de pdf ataba datepicker→pdf)
                        if (
                            /node_modules\/(rbush|quickselect|tslib|clsx)\//.test(
                                path,
                            )
                        )
                            return "vendor";
                        if (
                            path.includes("node_modules/cesium/") ||
                            path.includes("node_modules/@cesium/")
                        )
                            return "cesium";
                        if (path.includes("node_modules/ol/"))
                            return "openlayers";
                        if (path.includes("node_modules/react-pdf/"))
                            return "pdf";
                        if (
                            /node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run|@tanstack)\//.test(
                                path,
                            )
                        )
                            return "vendor";
                        // Solo virtuales sin paquete (commonjsHelpers, preload-helper): eager
                        // para que ningún lazy los capture. Los ?commonjs-proxy por-paquete
                        // no: pinearlos arrastraba todas las deps CJS al vendor eager
                        if (
                            (id.startsWith("\0") &&
                                !path.includes("node_modules/")) ||
                            id.includes("commonjsHelpers")
                        )
                            return "vendor";
                    },
                },
            },
        },
        plugins: [
            react(),
            tsconfigPaths(),
            cesiumAssets(cesiumBaseUrl),
            // BUNDLE_STATS=1 → stats.html (treemap interactivo); =raw → stats.json programático
            process.env.BUNDLE_STATS
                ? visualizer(
                      process.env.BUNDLE_STATS === "raw"
                          ? { filename: "stats.json", template: "raw-data" }
                          : {
                                filename: "stats.html",
                                template: "treemap",
                                gzipSize: true,
                            },
                  )
                : undefined,
            viteCompression({
                algorithm: "gzip",
                ext: ".gz",
            }),
        ],

        base: "/",
    };
});
