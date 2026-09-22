import { memo, useEffect, useMemo, useRef, useState } from "react";
import { AxiosInstance } from "axios";

import { BookmarkIcon } from "@heroicons/react/24/outline";

import { MapSkeleton, Modal } from "@componentsReact";
import StationCreateMapOL from "@components/map/StationCreateMapOL";
import StationLegendContent from "@components/map/StationLegendContent";
import StationTooltip from "@components/map/StationTooltip";

import { useMapInit } from "@hooks/ol/useMapInit";
import { useMetadata, useStationCatalog } from "@hooks/queries";

import { getLastCenterLonLat, getLastZoom, worldExtentOf } from "@olUtils";

import "ol/ol.css";

interface Props {
    api: AxiosInstance;
    highlightedApiIds: ReadonlySet<number>;
    setShowMapModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    title?: string;
}

const FIT_PADDING = [40, 40, 40, 40];
const FIT_MAX_ZOOM = 8;

const StationListMapModal = ({
    api,
    highlightedApiIds,
    setShowMapModal,
    title = "Stations on map",
}: Props) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const { data: catalog, isLoading } = useStationCatalog(api);
    const { types, statuses } = useMetadata(api, {
        only: ["types", "statuses"],
    });

    const initialCenter = useMemo<[number, number]>(
        () => getLastCenterLonLat() ?? [0, 0],
        [],
    );
    const initialZoom = useMemo(() => getLastZoom(4), []);
    const { mapInstance, isMapReady } = useMapInit({
        center: initialCenter,
        zoom: initialZoom,
        mapRef,
        enableZoomControl: true,
    });

    const [showLegend, setShowLegend] = useState(false);

    const highlighted = useMemo(
        () =>
            (catalog?.data ?? []).filter(
                (s) =>
                    s.api_id !== undefined && highlightedApiIds.has(s.api_id),
            ),
        [catalog, highlightedApiIds],
    );
    const withCoords = useMemo(
        () => highlighted.filter((s) => s.lat && s.lon),
        [highlighted],
    );
    const extent = useMemo(
        () =>
            withCoords.length
                ? worldExtentOf(withCoords.map((s) => [s.lon, s.lat]))
                : undefined,
        [withCoords],
    );

    // El <dialog> se abre despues del mount, asi que el contenedor arranca en
    // 0x0: el primer resize con tamano real es el momento de encuadrar la lista
    useEffect(() => {
        const map = mapInstance.current;
        const container = mapRef.current;
        if (!isMapReady || !map || !container) return;
        let fitted = false;
        const observer = new ResizeObserver(() => {
            map.updateSize();
            if (fitted || !extent || container.clientWidth === 0) return;
            fitted = true;
            map.getView().fit(extent, {
                padding: FIT_PADDING,
                maxZoom: FIT_MAX_ZOOM,
            });
        });
        observer.observe(container);
        return () => observer.disconnect();
    }, [isMapReady, mapInstance, extent]);

    const noCoords = highlighted.length - withCoords.length;

    return (
        <Modal
            close={true}
            modalId="stations-map"
            size="md"
            setModalState={setShowMapModal}
        >
            <div className="flex flex-col items-center gap-y-4">
                <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
                <span className="text-sm opacity-80">
                    {withCoords.length} selected stations
                    {noCoords > 0 && ` · ${noCoords} without coordinates`}
                </span>
                <div className="relative w-full">
                    {isLoading && (
                        <div className="absolute inset-0 z-[1000] bg-base-100">
                            <MapSkeleton styles={{ height: "100%" }} />
                        </div>
                    )}
                    <div ref={mapRef} className="h-[60vh]" />
                    {isMapReady && (
                        <StationCreateMapOL
                            mapInstance={mapInstance}
                            stations={catalog?.data}
                            types={types}
                            statuses={statuses}
                            rangeValue={0}
                            currentMarker={null}
                            showAll={true}
                            highlightedApiIds={highlightedApiIds}
                            tooltipRef={tooltipRef}
                        />
                    )}
                    <StationTooltip ref={tooltipRef} />

                    <button
                        type="button"
                        className="btn btn-sm bg-white z-[999] absolute top-2 right-2"
                        title="Legend"
                        aria-pressed={showLegend}
                        onClick={() => setShowLegend((v) => !v)}
                    >
                        <BookmarkIcon className="size-5" />
                    </button>

                    {showLegend && (
                        <div className="z-[999] absolute top-12 right-2 w-56 max-h-[calc(60vh-3.5rem)] overflow-y-auto bg-white/95 rounded-md shadow-md p-3 flex flex-col gap-3">
                            <StationLegendContent
                                types={types}
                                statuses={statuses}
                                compact
                            />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// memo: el panel se rerenderiza con cada tecla del formulario y las props son estables
export default memo(StationListMapModal);
