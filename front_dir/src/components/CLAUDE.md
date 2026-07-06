# Components

150+ components re-exported from the **`index.tsx` barrel**. Any new shared component must be added to the barrel and imported via `@components` / `@componentsReact`. Map components live under `map/`, modals under `modals/`, tables under `table/`, skeletons under `skeleton/`, station-specific under `station/`, menu under `menu/`.

**Before adding a component, check this directory first** — several capabilities already exist and are fragmented (root principle 2). Unify, don't duplicate.

## Shared-primitive landscape (reuse these)

- **Modals**: `modals/Modal.tsx` — daisyUI `<dialog>` opened by `showModal(id)` from `@utils`. Props include `modalId`, `close`, `size` (`sm`/`smPlus`/`md`/`lg`/`xl`/`fit`), `handleCloseModal`. `modals/ConfirmDeleteModal.tsx` is the **generic confirm dialog** — despite its name it is not delete-only: it takes `variant`, `mainMsg`/`alterMsg`, `confirmRemove`/`closeModal`, and a `type` that switches the action button (`"reset"`/`"deactivate"`/`"activate"`/`"copy_sync"` → Sync, else Remove). Reuse it for any confirm (e.g. the ETM trajectory-params sync uses `type="copy_sync"`); **do NOT add a parallel `ConfirmDialog`**.
  - Modal-open state is inconsistent: some components use local `useState({show,title,type})`, others use the Zustand `earthquakeModal` slice. Prefer the Zustand `{show,title,type}` pattern for reusable modals.
- **Date pickers**: `GregorianDatePicker.tsx` (Gregorian ↔ Year/DOY via `dateFromDay`/`dayFromDate`), `DateRangePicker.tsx` (**the shared from/to range primitive**, with optional DOY mode), `DateTimePicker.tsx` (raw date+time, coupled to `useFormReducer` dispatch). New date UI builds on these — don't add inline `<input type="date">` (a few stray ones remain in `StationSeriesFiltersModal`; migrate when touched).
- **Clipboard**: `useClipboard` (`@hooks`) + `CopyButton` (`@components`) are the shared primitives — never hand-roll `navigator.clipboard.writeText`.
- **Photo**: `ImageUploadCircle.tsx` renders a circular base64 photo with `UserIcon` fallback (`data:image/jpeg;base64,` prefix). `Photo.tsx` is the station-images grid (legacy fetch). File/image downloads go through the shared `downloadFromBase64` / `downloadBlob` utils (`@utils`) — don't re-implement the anchor-`download` pattern.
- **Selects/dropdowns**: `FormControlSelect.tsx` (thin daisyUI select for string-array options), `Dropdown.tsx` (searchable country/network selector — extend, don't clone), `EtmSolutionSelect.tsx` (solution/stack selector for ETM views).
- **Feedback**: `Alert.tsx` (inline error/success with error detail), `Message.tsx` (a.k.a. Toast — fixed top-right singleton, no queue). `Pagination.tsx` for tables. `table/Table.tsx` + `table/TableCard.tsx` are the generic table (delete/alter/view/visits/multiselect buttons, `viewRegister`).

## Forms & error handling

- Form state: **`useFormReducer`** (`@hooks`) — actions `set` / `change_value` / `change_array_value` / `list_to_clear` / `clear`. Reducer initial-state templates live in `src/utils/reducerFormStates.tsx`. Some components (`Photo`, `TimeSeriesParams`) use local `useState` instead — divergent, prefer the reducer.
- Services swallow errors via `useApi` and return a fake `{status:'error', statusCode, response}`; **callers check `statusCode`, they don't try/catch.** Surface results through `Alert`. **In TanStack hooks the check goes *inside* the `queryFn`/`mutationFn` and must `throw` on failure** — otherwise `isError` never fires and `useQuery` caches the error object as data (pattern: `useStationPdf`).

## Conventions

- daisyUI + Tailwind, **4-space indent**. Icons from `@heroicons/react/24/outline`. daisyUI `tooltip`/`tooltip-right`/`tooltip-bottom` classes (+ `data-tip`) are the tooltip mechanism (the fixed sidebar relies on them). Spanish comments/UI; English field names.
