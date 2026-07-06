# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`webgps` (package name `gamit`) is the frontend for a GNSS/GPS station-management platform. It visualizes geodetic stations, earthquakes, RINEX data, campaigns, and time series on interactive 2D/3D maps and talks to a separate backend API (the Django-style REST API at `VITE_API_URL`). The UI and the vast majority of comments are in Spanish.

Stack: React 18 + TypeScript + Vite, Tailwind CSS + daisyUI, OpenLayers (2D maps) + Cesium via `olcs` (3D globe), TanStack Query (server state), Zustand (map/UI state), React Router v6.

## Engineering principles (priorities — read first)

These take precedence when making implementation choices in this repo. **Performance, optimization, clean code, sustainable/quality code, and correct use of TanStack Query + Zustand are the primary goals**, above shipping fast:

1. **Performance & optimization first.** This is a data-heavy app (large station/earthquake datasets, OL/Cesium maps, base64 images). Avoid needless re-renders and refetches; memoize expensive work (`useMemo`/`useCallback`/`React.memo`) where it measurably helps; virtualize long lists; keep heavy deps lazy (`lazyRetry`). Consult the `react-performance-optimization`, `react-useeffect`, and `optimize` skills in `.claude/skills/` (symlinked from `.agents/skills/`).
2. **Clean, sustainable, reusable code.** Prefer small, single-responsibility components over copy-paste. **Before adding any new component/hook/util, search for one that already does it.** This codebase has near-duplicate logic that should be *unified, not duplicated* — e.g. date pickers (`GregorianDatePicker` vs `DateTimePicker` vs inline `<input type="date">`), clipboard copy, ECEF↔LLA conversion, base64 download. When the same thing appears in two places, factor out a shared primitive.
3. **TanStack Query & Zustand, used correctly.** Client/UI/map state lives in the Zustand `useMapStore` (or local `useState` for one-off UI); auth/user identity stays in React Context. For **server state**, pick the right TanStack tool deliberately — don't reflexively wrap every call, but don't hand-roll fetching either. The choice is **query-hook vs `useMutation`**, not "TanStack vs a manual effect":
   - **Query hook** (`src/hooks/queries/`, explicit query keys + `staleTime` + `enabled` gating) for **reads that benefit from caching or sharing**: data reused across components/mounts, **static reference catalogs** (fetch-once-cache-for-session — e.g. `useSolutionTypes`/`useAdjustmentOptions`/`useModeObsTypes`, networks, countries; the `useEffect`+`useState` alternative would re-fetch on every mount), anything other mutations must keep fresh via `invalidateQueries`, heavy payloads, or polling/background refresh.
   - **`useMutation`** for **writes** (POST/PUT/PATCH/DELETE) and for **on-demand, user-triggered reads whose result is not shared/cached** (e.g. the ETM JSON export, the coordinates Query) — you get `isPending`/`error`/`mutate()` without creating a cache entry for a one-shot result.
   - **Avoid hand-rolling `useApi`+`useEffect`+`useState` fetching in new code** — that's the no-dedup/no-cache/no-cancellation pattern we're migrating away from (principle 4). If a fetch seems "too basic for TanStack," the answer is usually `useMutation`, not a manual effect.
4. **Incremental TanStack migration (known tech debt).** Newer features use TanStack Query; **a large amount of older code still uses the legacy `useApi`+`useEffect` pattern** (e.g. `TimeSeries.tsx`, `TimeSeriesParams.tsx`, `StationSeriesFiltersModal.tsx`, `Photo.tsx`, the People pages). We want to migrate these over time. When you touch one of these for a feature, migrate it *cleanly* to TanStack rather than half-migrating — never mix both fetching patterns inside a single component.
5. **`useEffect` discipline.** Don't use Effects for derived state, event responses, or values you can compute during render (`react-useeffect` skill). Effects are for synchronizing with external systems only.

## Commands

```bash
npm run dev        # Vite dev server
npm run showcase   # dev server exposed on the network (vite --host)
npm run build      # tsc typecheck + production build (4GB node heap)
npm run lint       # eslint, fails on any warning (--max-warnings 0)
npm run preview    # serve the built dist/
```

There is **no test runner** configured. Lint and `tsc` (run as part of `build`) are the only automated checks. `tsconfig.json` enforces `strict`, `noUnusedLocals`, and `noUnusedParameters`, so unused imports/vars break the build.

Formatting: Prettier with **4-space indentation** (`.prettierrc`). ESLint disables `@typescript-eslint/no-explicit-any` — `any` is used liberally, especially around OL/Cesium objects.

## Path aliases

Imports use aliases defined in `tsconfig.json` and resolved by `vite-tsconfig-paths`. Prefer them over relative paths. Note many are barrel files, not directories:

- `@types` → `src/interfaces/index.d.ts` (single ~1000-line ambient declaration file — all shared types live here)
- `@services` → `src/services/index.ts` (all API call functions)
- `@hooks`, `@store`, `@utils`, `@components`/`@componentsReact`, `@pages`/`@pagesReact`, `@routes`, `@queryClient`
- `@olUtils` → `src/components/map/ol/utils/index.ts`

## Architecture

### App composition (`src/App.tsx`)
Provider order: `QueryClientProvider` → `UserContextProvider` → `AuthProvider` → `Suspense` → `RouterProvider`. All pages/components are code-split with `lazyRetry` (see below). The router uses React Router v7 future flags. Routes split into `/auth/*` (wrapped by `UnprotectedRoute`) and `/*` (wrapped by `ProtectedRoute`). Station detail lives at `/:nc/:sc` (network code / station code) with nested tabs: rinex, sources, people, visits, timeseries, events.

### Authentication & API layer
- **JWT auth** lives in `useAuth` (`src/hooks/useAuth.tsx`), an `AuthContext`. Tokens are persisted to `localStorage` under `gpsToken` / `gpsRefresh` / `gpsRole` via the `useLocalStorage` hook. On login it clears the previous user's React Query cache and user context.
- **`useApi`** (`src/hooks/useApi.tsx`) builds a memoized Axios instance with the bearer token and a response interceptor: 401 → `logout()`; 403 → dispatches `UNAUTHORIZE` into the user context (permission tracking). The interceptor **swallows errors and returns a fake success-shaped object** with `status: "error"` instead of rejecting — callers must check `statusCode`/`status` on the resolved value rather than relying on try/catch. (A code comment notes this should eventually be changed to `Promise.reject`.)
  - **TanStack consequence (critical — silent-failure trap):** because failed requests still *resolve*, `useQuery`/`useMutation` never notice a failure on their own — `isError` stays `false`, `retry` never runs, `onError` never fires, and `useQuery` caches the fake error object as valid data for the whole `staleTime`. **Every `queryFn`/`mutationFn` must check the resolved `statusCode` (or `'status' in res`) and `throw` on failure** — never return the raw service result unchecked. Pattern: `useStationPdf` in `src/hooks/queries/useStations.ts`.
- **Service functions** in `src/services/index.ts` are plain async functions that take an `AxiosInstance` as their first argument (except the unauthenticated `loginService`/`refreshTokenService`, which use `axiosInstanceUnauth`). Query params are serialized via `transformParams`/`transformParamsForFilter` from utils.
- **`queryClient`** (`src/queryClient.ts`): 5-minute staleTime, `refetchOnWindowFocus: false`, `retry: 1`.

### Data fetching
Reusable query hooks wrapping the service functions live in `src/hooks/queries/` (`useStations`, `useEarthquakes`, `useAffectedStations`, `useMetadata`). User identity/permissions use a reducer-backed context in `src/hooks/user/`.

### State management
- **Zustand** `useMapStore` (`src/store/useMapStore.ts`) is the central store for map and map-related UI state: layer/projection toggles, scrollers, earthquake/temporal filters, modals, globe-loading flag, etc.
- Auth and user info are in **React Context**, not Zustand.

### Maps (the core feature, `src/components/map/`)
- 2D rendering is **OpenLayers**. The map and its layers are constructed imperatively through hooks in `src/hooks/ol/`: `useMapInit` (creates the `ol/Map`, overlays, base tile layers), `useStationLayer`, `useClusterLayer`, `useKmlLayer`, `usePopup`, `useTooltip`.
- 3D is **Cesium**, integrated via `olcs` in `useCesiumGlobe`. Cesium is dynamically imported only when the globe is enabled (it's a large dependency). The globe shares the OL map instance.
- OL helper utilities (icons, styles, vectors, KML, spiderfy, coordinates) are in `src/components/map/ol/utils/`, re-exported through `@olUtils`.
- `MapOL.tsx` / `MapStationOL.tsx` / `MapVisitOL.tsx` are the three map variants.

### Cesium asset handling (important for build/deploy)
Cesium needs its static assets (Workers, Assets, Widgets, ThirdParty) served at a known path. `vite.config.ts` defines `CESIUM_BASE_URL` and uses `vite-plugin-static-copy` to copy them — to `cesium-assets/` in dev, `assets/cesium/` in prod. The `Dockerfile` additionally re-copies them with `cp -rL` after the build (dereferencing symlinks) because the symlinked copies don't survive into the nginx image. If the globe fails to load assets, this pipeline is the place to look.

### Code splitting & lazy loading
`lazyRetry` / `dynamicImportRetry` (`src/utils/lazyRetry.ts`) wrap `React.lazy`/dynamic imports so that when a chunk fails to load (typically because a deploy changed the file hash), the browser reloads the asset instead of hard-failing. Use these wrappers for new lazy imports, not bare `React.lazy`. `vite.config.ts` manually chunks `cesium` (cesium + @cesium), `openlayers` (`ol` **only**), `pdf` (the react-pdf viewer), and `vendor` — via a `manualChunks` **function** with deliberate rules: **`olcs` must never be pinned to an eager chunk** (it's dynamically imported by `useCesiumGlobe` and statically imports cesium — pinning it preloads the 4.8MB cesium chunk at startup), and shared micro-deps (`rbush`/`quickselect`/`tslib`) plus rollup's virtual helper modules are pinned to `vendor` so they can't land inside the cesium chunk and drag it into the entry's `modulepreload` graph (see the comments in `vite.config.ts`). To audit chunk composition run `BUNDLE_STATS=1 npm run build`, which emits `stats.json` (rollup-plugin-visualizer raw-data).

## Deployment
Production is a multi-stage Docker build (`Dockerfile`): Node builds `dist/`, then it's served by nginx. nginx config is templated — `srv/nginx.conf.template` is rendered with `envsubst` using `NGINX_PORT` and `SERVER_NAME` at container start. `srv/nginxdev.conf` is a reference dev config that proxies `/api/` to the backend. `docker-compose.yml` mounts `.env` and maps `APP_PORT`. Env vars: `VITE_API_URL` (build-time, baked into the bundle), plus `SERVER_NAME`/`NGINX_PORT`/`APP_PORT` for nginx.

## Conventions
- New shared types go in `src/interfaces/index.d.ts` (imported as `@types`).
- New API calls go in `src/services/index.ts` as `<verb><Noun>Service<T>(api, ...)` functions; wrap them in a `src/hooks/queries/` hook if used as query state.
- **All UI text must be in English.** This includes labels, modal titles, buttons, placeholders, tooltips, and any user-visible string. Code comments may be in Spanish.
- **Reuse before adding** (see principle 2): a shared component goes in `src/components/` and is re-exported from the `src/components/index.tsx` barrel; a shared hook in `src/hooks/`; a shared util in `src/utils/`.
- **Minimal comments.** Only comment genuinely complex/non-obvious logic (tricky algorithms, workarounds, non-evident "why"). Do NOT add comments that restate what the code already says (e.g. labeling a conditional, narrating an obvious assignment) — the code is the documentation.

## Tailwind breakpoints (non-standard — read before writing responsive classes)

This project overrides Tailwind's default screens in `tailwind.config.js` with **range-based** breakpoints (both `min` and `max`). This breaks the standard mobile-first assumption:

| Prefix | Range |
|--------|-------|
| `xs`   | 375px – 639px |
| `sm`   | 640px – 767px |
| `md`   | 768px – 1023px |
| `lg`   | 375px – 1279px |
| `xl`   | 375px – 1535px |
| `2xl`  | 1536px+ |
| `3xl`  | 1920px+ |

**Critical:** `xl:` only applies **up to 1535px**, not above. A 24"+ monitor (≥1536px) is `2xl`. So for "side by side on large monitors, stacked on small": use `flex flex-col 2xl:flex-row`, **not** `xl:flex-row`.

## Skills

`.claude/skills/` (symlinked to `.agents/skills/`) holds project skills: `react-performance-optimization`, `react-useeffect`, and `optimize`. Use them for rendering/perf, Effect, and UI-performance work respectively.

## Codegraph

This project has `.codegraph/` initialized and indexed (203 files, ~2000 nodes). **Use the `codegraph_*` MCP tools before reading/grepping when the question is about symbols, dependencies, or call flows.** Tool selection guide:

- "What is X / where is it defined?" → `codegraph_search`
- "How does this feature work / what calls what?" → `codegraph_context` first, then `codegraph_explore` for source
- "Trace the flow from A to B" → `codegraph_trace` (handles callbacks and JSX children grep can't follow)
- "What would changing X break?" → `codegraph_impact`
- "What calls this function?" → `codegraph_callers`
- "What does this function call?" → `codegraph_callees`
- "Survey an area / read several symbols at once" → `codegraph_explore`

Use `grep`/`Read` via Bash only for what codegraph can't cover: raw string patterns in JSX/CSS (e.g. Tailwind classes, z-index values, hardcoded strings), file-level content past the index, or confirming a specific detail codegraph didn't surface.

## Sub-directory guides

Several directories carry their own `CLAUDE.md` with local conventions — read the relevant one before working there:

- `src/pages/Station/CLAUDE.md` — station detail tabs (time series/ETM, rinex, people, visits, events); the ETM/time-series quirks live here.
- `src/components/CLAUDE.md` — the 150+ component barrel and the shared-primitive landscape (modals, date pickers, clipboard, tables, forms).
- `src/services/CLAUDE.md` — the service-layer contract, the error-swallowing convention, and the endpoint catalogue.
- `src/store/CLAUDE.md` — the `useMapStore` Zustand store and its modal/filter slice patterns.
