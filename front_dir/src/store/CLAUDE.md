# Store (Zustand)

`useMapStore.ts` is the **single Zustand store** for map and map-related UI state — a large store with 40+ slices. Imported as `@store`. Setters accept either a value or an updater function. Much of the state is persisted to `localStorage`.

**This holds client/UI/map state only.** Server state belongs in TanStack Query (`src/hooks/queries/`); auth/user identity belongs in React Context (`useAuth`, the user reducer in `src/hooks/user/`) — **not** here.

## Slice patterns

- **Modal slices** use the shape `{ show: boolean, title: string, type: 'add' | 'edit' | 'none' }`. `earthquakeModal` (+ its setter) is the template. New reusable modals should mirror it. There is no dedicated central modal-manager; modals are also opened imperatively via `showModal(id)` (`@utils`).
- **Filter state** is split across several slices (`filterState`, `filters`, `params`, `earthQuakeParams`, `earthquakeFilterFormState`, `temporalFilter`), each persisted to `localStorage`. Reuse the existing earthquake filter shape (`EarthQuakeFormState` in `@types`: date range, magnitude/depth/lat/lon bounds, `polygon_coordinates`) when building new filter UIs.
- Other slices cover layer/projection toggles, scrollers, the globe-loading flag, vector magnitude, etc.

## Conventions

- Keep additions consistent with the `{show,title,type}` modal shape and the value-or-updater setter style.
- If a new slice needs persistence, follow the existing `localStorage` pattern already used by the filter slices.
- Map drawing/geometry (OpenLayers `Draw`/`Modify`, polygon → `findLimits` bounds in `@utils`) is reused from `MapModalOL`/`EarthQuakeFormModal` — coordinates are `[lon, lat]` in OL, converted for display/storage.
