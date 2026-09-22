import { useEffect, useRef, useState } from "react";
import Map from "ol/Map";
import { toLonLat } from "ol/proj";
import { dynamicImportRetry } from "@utils";
import { createGeodeFeatureConverter } from "./cesium/createGeodeFeatureConverter";

import { useMapStore } from "@store";

import type { MapLayerState } from "./useMapInit";

interface UseCesiumGlobeOptions {
    mapInstance: React.RefObject<Map | null>;
    isMapReady: boolean;
    globeEnabled: boolean;
    mapLayerState?: MapLayerState;
}

interface UseCesiumGlobeReturn {
    ol3dRef: React.RefObject<any>;
    isGlobeActive: boolean;
    isGlobeLoading: boolean;
}

export const useCesiumGlobe = ({
    mapInstance,
    isMapReady,
    globeEnabled,
    mapLayerState,
}: UseCesiumGlobeOptions): UseCesiumGlobeReturn => {
    const ol3dRef = useRef<any>(null);
    const [isGlobeActive, setIsGlobeActive] = useState(false);

    const isGlobeLoading = useMapStore((s) => s.isGlobeLoading);
    const setIsGlobeLoading = useMapStore((s) => s.setIsGlobeLoading);

    // Synchronize with external system (CesiumJS WebGL context)
    useEffect(() => {
        if (!isMapReady || !mapInstance.current) return;

        // ── Enable globe ──
        if (globeEnabled && !ol3dRef.current) {
            let cancelled = false;
            setIsGlobeLoading(true);
            (async () => {
                try {
                    // lazy load with retry
                    const [CesiumModule, OLCesiumModule] =
                        await dynamicImportRetry(
                            () =>
                                Promise.all([
                                    import("cesium"),
                                    import("olcs"),
                                ]) as Promise<[any, any]>,
                        );

                    if (cancelled) return;

                    // ol-cesium reads window.Cesium internally
                    window.Cesium = CesiumModule;

                    // Fix for "renderState.lineWidth is out of range" error
                    // Most WebGL implementations only support a maximum lineWidth of 1.0.
                    // When ol-cesium synchronizes OpenLayers features with thick strokes (e.g., width: 6),
                    // Cesium tries to create a RenderState with that lineWidth, which throws a DeveloperError.
                    // CesiumModule is the same cached ES module namespace on every activation, so guard
                    // against re-wrapping fromCache each time the globe is toggled on.
                    const originalRenderState = CesiumModule.RenderState;
                    if (
                        originalRenderState &&
                        originalRenderState.fromCache &&
                        !originalRenderState.__geodeLineWidthPatched
                    ) {
                        const originalFromCache = originalRenderState.fromCache;
                        originalRenderState.fromCache = function (
                            settings: any,
                        ) {
                            if (
                                settings &&
                                typeof settings.lineWidth === "number" &&
                                settings.lineWidth > 1
                            ) {
                                settings = { ...settings, lineWidth: 1 };
                            }
                            return originalFromCache.call(
                                originalRenderState,
                                settings,
                            );
                        };
                        originalRenderState.__geodeLineWidthPatched = true;
                    }

                    await dynamicImportRetry(
                        () => import("cesium/Build/Cesium/Widgets/widgets.css"),
                    ).catch(() => {
                        console.warn(
                            "Could not load Cesium widgets.css — non-critical",
                        );
                    });

                    if (cancelled || !mapInstance.current) return;

                    const OLCesium = OLCesiumModule.default ?? OLCesiumModule;
                    const {
                        FeatureConverter,
                        RasterSynchronizer,
                        VectorSynchronizer,
                        OverlaySynchronizer,
                    } = OLCesiumModule;
                    const ol3d = new OLCesium({
                        map: mapInstance.current,
                        createSynchronizers: (map: any, scene: any) => [
                            new RasterSynchronizer(map, scene),
                            new VectorSynchronizer(
                                map,
                                scene,
                                createGeodeFeatureConverter(
                                    FeatureConverter,
                                    CesiumModule,
                                    scene,
                                ),
                            ),
                            new OverlaySynchronizer(map, scene),
                        ],
                    });

                    // Configure the Cesium scene
                    const scene = ol3d.getCesiumScene();
                    scene.renderError.addEventListener(
                        (_scene: any, error: unknown) => {
                            console.error("Cesium scene render error:", error);
                        },
                    );
                    scene.globe.enableLighting = false;
                    if (scene.skyAtmosphere) {
                        scene.skyAtmosphere.show = true;
                    }

                    // Use basic ellipsoid terrain (no Cesium Ion token needed)
                    scene.globe.terrainProvider =
                        new CesiumModule.EllipsoidTerrainProvider();

                    ol3d.setEnabled(true);
                    ol3dRef.current = ol3d;
                    setIsGlobeActive(true);
                } catch (err) {
                    console.error("Failed to initialize OL-Cesium:", err);
                } finally {
                    if (!cancelled) {
                        setIsGlobeLoading(false);
                    }
                }
            })();

            return () => {
                cancelled = true;
                if (ol3dRef.current) {
                    try {
                        ol3dRef.current.setEnabled(false);
                    } catch (e) {
                        console.warn("OL-Cesium disable on unmount failed:", e);
                    }
                    ol3dRef.current.destroy();
                    ol3dRef.current = null;
                }
                setIsGlobeActive(false);
                setIsGlobeLoading(false);
            };
        }

        // ── Disable globe ──
        if (!globeEnabled && ol3dRef.current) {
            try {
                ol3dRef.current.setEnabled(false);
            } catch (e) {
                console.warn("OL-Cesium disable failed:", e);
            }
            ol3dRef.current.destroy();
            ol3dRef.current = null;
            setIsGlobeActive(false);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMapReady, globeEnabled]);

    // limit zoom on globe
    useEffect(() => {
        if (!isGlobeActive) return;
        const ol3d = ol3dRef.current;
        const map = mapInstance.current;
        if (!ol3d || !map) return;

        const view = map.getView();

        const applyZoomLimit = () => {
            const center = view.getCenter();
            if (!center) return;
            const latRad =
                (toLonLat(center, view.getProjection())[1] * Math.PI) / 180;
            const minResolution = view.getResolutionForZoom(view.getMaxZoom());
            const distance = ol3d
                .getCamera()
                .calcDistanceForResolution(minResolution, latRad);
            if (Number.isFinite(distance)) {
                ol3d.getCesiumScene().screenSpaceCameraController.minimumZoomDistance =
                    distance;
            }
        };

        applyZoomLimit();
        map.on("moveend", applyZoomLimit);
        return () => map.un("moveend", applyZoomLimit);
        // mapLayerState en deps: al cambiar de capa cambia el maxZoom de la View
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isGlobeActive, mapLayerState?.satellite, mapLayerState?.topo]);

    return { ol3dRef, isGlobeActive, isGlobeLoading };
};
