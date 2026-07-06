import { create } from "zustand";
import {
    FilterState,
    EarthQuakeFormState,
    GetParams,
    EarthquakeData,
    EarthQuakeParams,
    TemporalFilterState,
} from "@types";
import { MapLayerState, MapProjectionState } from "@hooks";

interface MapStore {
    // Map states
    mapState: boolean;
    setMapState: (state: boolean | ((prev: boolean) => boolean)) => void;
    mapLayerState: MapLayerState;
    setMapLayerState: (
        state: MapLayerState | ((prev: MapLayerState) => MapLayerState),
    ) => void;
    mapProjectionState: MapProjectionState;
    setMapProjectionState: (
        state:
            | MapProjectionState
            | ((prev: MapProjectionState) => MapProjectionState),
    ) => void;

    // UI states
    showScroller: boolean;
    setShowScroller: (show: boolean | ((prev: boolean) => boolean)) => void;
    showEarthQuakesList: boolean;
    setShowEarthQuakesList: (
        show: boolean | ((prev: boolean) => boolean),
    ) => void;
    earthquakeModal?: {
        show: boolean;
        title: string;
        type: "add" | "edit" | "none";
    };
    setEarthquakeModal: (
        modal:
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
            | ((
                  prev:
                      | {
                            show: boolean;
                            title: string;
                            type: "add" | "edit" | "none";
                        }
                      | undefined,
              ) =>
                  | {
                        show: boolean;
                        title: string;
                        type: "add" | "edit" | "none";
                    }
                  | undefined),
    ) => void;
    forceSyncScrollerMap: number;
    setForceSyncScrollerMap: (val: number | ((prev: number) => number)) => void;
    toggleStateEarthquakeMask: boolean;
    setToggleEarthquakeMask: (
        toggle: boolean | ((prev: boolean) => boolean),
    ) => void;
    toggleCoseismicVector: boolean;
    setToggleCoseismicVector: (
        toggle: boolean | ((prev: boolean) => boolean),
    ) => void;
    vectorMagnitude: number;
    setVectorMagnitude: (mag: number | ((prev: number) => number)) => void;

    stationRinexOnDate: number[];
    setStationRinexOnDate: (
        val: number[] | ((prev: number[]) => number[]),
    ) => void;

    // Filters and Forms
    isGlobeLoading: boolean;
    setIsGlobeLoading: (val: boolean | ((prev: boolean) => boolean)) => void;

    params: GetParams;
    setParams: (params: GetParams | ((prev: GetParams) => GetParams)) => void;
    earthQuakeParams?: EarthQuakeParams;
    setEarthQuakeParams: (
        params:
            | EarthQuakeParams
            | undefined
            | ((
                  prev: EarthQuakeParams | undefined,
              ) => EarthQuakeParams | undefined),
    ) => void;
    filterState: FilterState;
    setFilterState: (
        state: FilterState | ((prev: FilterState) => FilterState),
    ) => void;
    filters: {
        openFilters: boolean;
        stationType: boolean;
        stationWithProblems: boolean;
        stationWithoutProblems: boolean;
        stationStatus: boolean;
    };
    setFilters: (filters: any | ((prev: any) => any)) => void;
    earthquakeFilterFormState: EarthQuakeFormState;
    setEarthquakeFilterFormState: (
        state:
            | EarthQuakeFormState
            | ((prev: EarthQuakeFormState) => EarthQuakeFormState),
    ) => void;

    // Data selection
    chosenEarthquake?: EarthquakeData;
    setChosenEarthquake: (
        eq:
            | EarthquakeData
            | undefined
            | ((
                  prev: EarthquakeData | undefined,
              ) => EarthquakeData | undefined),
    ) => void;
    selectedEarthquakes: EarthquakeData[];
    setSelectedEarthquakes: (
        eqs: EarthquakeData[] | ((prev: EarthquakeData[]) => EarthquakeData[]),
    ) => void;
    multiSelectMode: boolean;
    setMultiSelectMode: (mode: boolean | ((prev: boolean) => boolean)) => void;
    posToFly?: [number, number];
    setPosToFly: (
        pos:
            | [number, number]
            | undefined
            | ((
                  prev: [number, number] | undefined,
              ) => [number, number] | undefined),
    ) => void;
    isPopulated: boolean;
    setIsPopulated: (
        isPopulated: boolean | ((prev: boolean) => boolean),
    ) => void;

    // Temporal filter
    temporalFilter: TemporalFilterState;
    setTemporalFilter: (
        filter:
            | TemporalFilterState
            | ((prev: TemporalFilterState) => TemporalFilterState),
    ) => void;
}

export const useMapStore = create<MapStore>()((set) => ({
    mapState: localStorage.getItem("mapState") === "true",
    setMapState: (state) =>
        set((prev) => {
            const next =
                typeof state === "function" ? state(prev.mapState) : state;
            localStorage.setItem("mapState", next.toString());
            return { mapState: next };
        }),
    mapLayerState: { topo: false, satellite: false },
    setMapLayerState: (state) =>
        set((prev) => ({
            mapLayerState:
                typeof state === "function" ? state(prev.mapLayerState) : state,
        })),
    mapProjectionState: { globe: false },
    setMapProjectionState: (state) =>
        set((prev) => ({
            mapProjectionState:
                typeof state === "function"
                    ? state(prev.mapProjectionState)
                    : state,
        })),
    showScroller: false,
    setShowScroller: (show) =>
        set((prev) => ({
            showScroller:
                typeof show === "function" ? show(prev.showScroller) : show,
        })),
    showEarthQuakesList: localStorage.getItem("mapState") === "true",
    setShowEarthQuakesList: (show) =>
        set((prev) => ({
            showEarthQuakesList:
                typeof show === "function"
                    ? show(prev.showEarthQuakesList)
                    : show,
        })),
    earthquakeModal: undefined,
    setEarthquakeModal: (modal) =>
        set((prev) => ({
            earthquakeModal:
                typeof modal === "function"
                    ? modal(prev.earthquakeModal)
                    : modal,
        })),
    forceSyncScrollerMap: 0,
    setForceSyncScrollerMap: (val) =>
        set((prev) => ({
            forceSyncScrollerMap:
                typeof val === "function"
                    ? val(prev.forceSyncScrollerMap)
                    : val,
        })),
    toggleStateEarthquakeMask: true,
    setToggleEarthquakeMask: (toggle) =>
        set((prev) => ({
            toggleStateEarthquakeMask:
                typeof toggle === "function"
                    ? toggle(prev.toggleStateEarthquakeMask)
                    : toggle,
        })),
    toggleCoseismicVector: false,
    setToggleCoseismicVector: (toggle) =>
        set((prev) => ({
            toggleCoseismicVector:
                typeof toggle === "function"
                    ? toggle(prev.toggleCoseismicVector)
                    : toggle,
        })),
    vectorMagnitude: 1,
    setVectorMagnitude: (mag) =>
        set((prev) => ({
            vectorMagnitude:
                typeof mag === "function" ? mag(prev.vectorMagnitude) : mag,
        })),
    params: {
        country_code: "",
        network_code: "",
        station_code: "",
        limit: 0,
        offset: 0,
    },
    setParams: (params) =>
        set((prev) => ({
            params: typeof params === "function" ? params(prev.params) : params,
        })),
    earthQuakeParams: (() => {
        const stored = localStorage.getItem("earthQuakeFilters");
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return {
                    date_start: parsed.date_start
                        ? parsed.date_start
                        : undefined,
                    date_end: parsed.date_end ? parsed.date_end : undefined,
                    max_magnitude: parsed.max_magnitude
                        ? parseFloat(parsed.max_magnitude)
                        : undefined,
                    min_magnitude: parsed.min_magnitude
                        ? parseFloat(parsed.min_magnitude)
                        : undefined,
                    id: parsed.id ? parsed.id : undefined,
                    max_depth: parsed.max_depth
                        ? parseFloat(parsed.max_depth)
                        : undefined,
                    min_depth: parsed.min_depth
                        ? parseFloat(parsed.min_depth)
                        : undefined,
                };
            } catch (e) {}
        }
        return undefined;
    })(),
    setEarthQuakeParams: (params) =>
        set((prev) => ({
            earthQuakeParams:
                typeof params === "function"
                    ? params(prev.earthQuakeParams)
                    : params,
        })),
    filterState: { statusOption: [], typeOption: [] },
    setFilterState: (state) =>
        set((prev) => ({
            filterState:
                typeof state === "function" ? state(prev.filterState) : state,
        })),
    filters: {
        openFilters: false,
        stationType: false,
        stationWithProblems: false,
        stationWithoutProblems: false,
        stationStatus: false,
    },
    setFilters: (filters) =>
        set((prev) => ({
            filters:
                typeof filters === "function" ? filters(prev.filters) : filters,
        })),
    earthquakeFilterFormState: (() => {
        const stored = localStorage.getItem("earthQuakeFilters");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {}
        }
        return {
            date_start: undefined,
            date_end: undefined,
            max_magnitude: "",
            min_magnitude: "",
            id: "",
            max_depth: "",
            min_depth: "",
            min_latitude: "",
            max_latitude: "",
            min_longitude: "",
            max_longitude: "",
            polygon_coordinates: [[]],
        };
    })(),
    setEarthquakeFilterFormState: (state) =>
        set((prev) => {
            const next =
                typeof state === "function"
                    ? state(prev.earthquakeFilterFormState)
                    : state;
            localStorage.setItem("earthQuakeFilters", JSON.stringify(next));
            return { earthquakeFilterFormState: next };
        }),
    chosenEarthquake: (() => {
        const stored = localStorage.getItem("earthquakeChosen");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {}
        }
        return undefined;
    })(),
    setChosenEarthquake: (eq) =>
        set((prev) => {
            const next =
                typeof eq === "function" ? eq(prev.chosenEarthquake) : eq;
            if (next) {
                localStorage.setItem("earthquakeChosen", JSON.stringify(next));
            } else {
                localStorage.removeItem("earthquakeChosen");
            }
            return { chosenEarthquake: next };
        }),
    selectedEarthquakes: (() => {
        const stored = localStorage.getItem("selectedEarthquakes");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {}
        }
        return [];
    })(),
    setSelectedEarthquakes: (eqs) =>
        set((prev) => {
            const next =
                typeof eqs === "function" ? eqs(prev.selectedEarthquakes) : eqs;
            localStorage.setItem("selectedEarthquakes", JSON.stringify(next));
            return { selectedEarthquakes: next };
        }),
    multiSelectMode: false,
    setMultiSelectMode: (mode) =>
        set((prev) => ({
            multiSelectMode:
                typeof mode === "function" ? mode(prev.multiSelectMode) : mode,
        })),
    posToFly: undefined,
    setPosToFly: (pos) =>
        set((prev) => ({
            posToFly: typeof pos === "function" ? pos(prev.posToFly) : pos,
        })),
    isPopulated: false,
    setIsPopulated: (isPopulated) =>
        set((prev) => ({
            isPopulated:
                typeof isPopulated === "function"
                    ? isPopulated(prev.isPopulated)
                    : isPopulated,
        })),
    temporalFilter: (() => {
        const stored = localStorage.getItem("temporalFilter");
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse temporalFilter from storage", e);
            }
        }
        return {
            enabled: false,
            dateStart: null,
            dateEnd: null,
            hiddenPoints: false,
            exactDate: false,
        };
    })(),
    setTemporalFilter: (filter) =>
        set((prev) => {
            const next =
                typeof filter === "function"
                    ? filter(prev.temporalFilter)
                    : filter;
            if (next.enabled || next.dateStart !== null) {
                localStorage.setItem("temporalFilter", JSON.stringify(next));
            } else {
                localStorage.removeItem("temporalFilter");
            }
            return { temporalFilter: next };
        }),
    isGlobeLoading: false,
    setIsGlobeLoading: (val) =>
        set((prev) => ({
            isGlobeLoading:
                typeof val === "function" ? val(prev.isGlobeLoading) : val,
        })),
    stationRinexOnDate: [],
    setStationRinexOnDate: (val) =>
        set((prev) => ({
            stationRinexOnDate:
                typeof val === "function" ? val(prev.stationRinexOnDate) : val,
        })),
}));
