/* eslint-disable @typescript-eslint/no-explicit-any */

// CesiumJS global type declarations for ol-cesium integration
declare global {
    interface Window {
        Cesium: any;
    }
}

// Vite define — set in vite.config.ts
declare const CESIUM_BASE_URL: string;

export {};
