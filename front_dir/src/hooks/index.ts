export { useUser } from "./user/userInfo.context";

export { useUserInfo } from "./user/useUserInfo.reducer";

export { useAuth } from "./useAuth";

export { default as useApi } from "./useApi";

export { useLocalStorage } from "./useLocalStorage";

export { default as useFormReducer } from "./useFormReducer";

export { default as useFormValidation } from "./useFormValidation";

export { default as useWaitCursor } from "./useWaitCursor";

export { default as useEscape } from "./useEscape";

export { default as useClickOutside } from "./useClickOutside";

export { useClipboard } from "./useClipboard";

export { default as useCursorZoom } from "./useCursorZoom";

// Hooks de OL: solo tipos — los hooks van por import directo (arrastran ol vía @olUtils)

export type { MapLayerState } from "./ol/useMapInit";

export type { MapProjectionState } from "./ol/useMapInit";
