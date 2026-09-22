import { useEffect, useState, useMemo, useRef } from "react";

import MapOL from "@components/map/ol/MapOL";
import Spinner from "@components/Spinner";
import MapSkeleton from "@components/skeleton/MapSkeleton";
import SearchInput from "@components/station/SearchInput";
import Sidebar from "@components/Sidebar";
import MainScroller from "@components/map/MainScroller";
import StationMetadataLegend from "@components/map/StationMetadataLegend";
import EarthQuakeFormModal from "@components/modals/EarthQuakeFormModal";
import EarthQuakeScroller from "@components/map/EarthQuakeScroller";
import DownloadAffectedStationsModal from "@components/modals/DownloadAffectedStationsModal";
import DropLeft from "@components/DropLeft";
import TemporalBar from "@components/map/TemporalBar";

import {
    ArchiveBoxArrowDownIcon,
    BookmarkIcon,
} from "@heroicons/react/24/outline";

import { useAuth, useApi, useEscape } from "@hooks";
import {
    useStations,
    useEarthquakes,
    useStationRinexOnDate,
    affectedStationsQueryOptions,
} from "@hooks/queries";

import { useQueries } from "@tanstack/react-query";

import { useMapStore } from "@store";

import {
    dateToFractionalYear,
    fractionalYearToDate,
    getTemporalBounds,
    handleEarthquakeLimits,
    isStationFiltered,
    isStationInTemporalWindow,
    showModal,
} from "@utils";

import {
    StationData,
    StationsAffectedServiceData,
    EarthquakeData,
    EarthQuakeFormState,
} from "@types";

const EMPTY_EARTHQUAKES: EarthquakeData[] = [];

const Legend = ({
    stationLegend,
    setStationLegend,
}: {
    stationLegend: boolean;
    setStationLegend: (value: boolean) => void;
}) => {
    return (
        <button
            className="btn btn-rounded btn-sm z-[100002] absolute top-12 right-2"
            style={{ backgroundColor: "white" }}
            onClick={() => setStationLegend(!stationLegend)}
        >
            <BookmarkIcon className="size-6" />
        </button>
    );
};

const MainPage = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    // Local state for sidebar
    const [station, setStation] = useState<StationData | undefined>(undefined);

    // State for station status, types legend.
    const [stationLegend, setStationLegend] = useState<boolean>(false);

    // .zip Download modal.
    const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);

    // Zustand store selectors
    const mapState = useMapStore((s) => s.mapState);
    const setMapState = useMapStore((s) => s.setMapState);

    const params = useMapStore((s) => s.params);
    const setParams = useMapStore((s) => s.setParams);

    const earthQuakeParams = useMapStore((s) => s.earthQuakeParams);
    const setEarthQuakeParams = useMapStore((s) => s.setEarthQuakeParams);

    const chosenEarthquake = useMapStore((s) => s.chosenEarthquake);
    const setChosenEarthquake = useMapStore((s) => s.setChosenEarthquake);

    const earthquakeFilterFormState = useMapStore(
        (s) => s.earthquakeFilterFormState,
    );
    const setEarthquakeFilterFormState = useMapStore(
        (s) => s.setEarthquakeFilterFormState,
    );

    const posToFly = useMapStore((s) => s.posToFly);
    const setPosToFly = useMapStore((s) => s.setPosToFly);

    const earthquakeModal = useMapStore((s) => s.earthquakeModal);
    const setEarthquakeModal = useMapStore((s) => s.setEarthquakeModal);

    const showEarthQuakesList = useMapStore((s) => s.showEarthQuakesList);
    const setShowEarthQuakesList = useMapStore((s) => s.setShowEarthQuakesList);

    const filterState = useMapStore((s) => s.filterState);
    const filters = useMapStore((s) => s.filters);

    const temporalFilter = useMapStore((s) => s.temporalFilter);
    const setTemporalFilter = useMapStore((s) => s.setTemporalFilter);

    const multiSelectMode = useMapStore((s) => s.multiSelectMode);
    const setMultiSelectMode = useMapStore((s) => s.setMultiSelectMode);

    const selectedEarthquakes = useMapStore((s) => s.selectedEarthquakes);
    const setSelectedEarthquakes = useMapStore((s) => s.setSelectedEarthquakes);

    const setToggleEarthquakeMask = useMapStore(
        (s) => s.setToggleEarthquakeMask,
    );
    const isPopulated = useMapStore((s) => s.isPopulated);

    const isGlobeLoading = useMapStore((s) => s.isGlobeLoading);

    const rangeRef = useRef<{ minYear: number; maxYear: number } | null>(null);

    const prevSelectionKey = useRef<string>(
        (() => {
            const stored = localStorage.getItem("selectedEarthquakes");
            if (!stored) return "";
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    return parsed
                        .map((e: any) => e.api_id)
                        .sort()
                        .join(",");
                }
            } catch (e) {
                return "";
            }
            return "";
        })(),
    );

    // React Query Hooks

    const { data: stationsResult, isLoading } = useStations(
        api,
        {
            ...params,
            // only_metadata: sin harposs_coef_otl
            only_metadata: true,
            station_code:
                selectedEarthquakes.length > 0 ? "" : params.station_code,
            network_code:
                selectedEarthquakes.length > 0 ? "" : params.network_code,
            country_code:
                selectedEarthquakes.length > 0 ? "" : params.country_code,
        },
        {
            enabled: true,
        },
    );

    const { minYear, maxYear } = useMemo(() => {
        const bounds = getTemporalBounds(stationsResult?.data);

        // la primera vez inicializo los datos en memoria
        if (!rangeRef.current) {
            rangeRef.current = bounds;
        } else {
            // Mantenemos siempre el mínimo y máximo histórico que hayamos visto durante la sesión.
            rangeRef.current = {
                minYear: Math.min(rangeRef.current.minYear, bounds.minYear),
                maxYear: Math.max(rangeRef.current.maxYear, bounds.maxYear),
            };
        }

        return rangeRef.current;
    }, [stationsResult?.data]);

    const dateStartObj = temporalFilter.dateStart
        ? fractionalYearToDate(temporalFilter.dateStart)
        : null;
    const dateEndObj = temporalFilter.dateEnd
        ? fractionalYearToDate(temporalFilter.dateEnd)
        : null;
    const fromDateStr = dateStartObj
        ? dateStartObj.toISOString().split("T")[0]
        : null;
    const toDateStr = dateEndObj
        ? dateEndObj.toISOString().split("T")[0]
        : null;
    const absoluteDateStart = rangeRef.current?.minYear
        ? fractionalYearToDate(rangeRef.current.minYear)
              .toISOString()
              .split("T")[0]
        : null;

    const { data: rinexOnDateResult, isFetching: rinexOnDateLoading } =
        useStationRinexOnDate(
            api,
            fromDateStr ?? absoluteDateStart,
            temporalFilter.exactDate
                ? (fromDateStr ?? absoluteDateStart)
                : toDateStr,
            // se hace el fetch solo cuando exactDate esta habilitado
            { enabled: temporalFilter.exactDate },
        );

    const setStationRinexOnDate = useMapStore((s) => s.setStationRinexOnDate);
    const stationRinexOnDate = useMapStore((s) => s.stationRinexOnDate);

    useEffect(() => {
        if (!temporalFilter.exactDate) {
            setStationRinexOnDate((prev) => (prev.length === 0 ? prev : []));
            return;
        }

        if (rinexOnDateResult) {
            setStationRinexOnDate((prev) => {
                if (JSON.stringify(prev) === JSON.stringify(rinexOnDateResult))
                    return prev;
                return rinexOnDateResult;
            });
        }
    }, [rinexOnDateResult, temporalFilter.exactDate, setStationRinexOnDate]);

    const { data: earthquakesResult, isFetching: earthquakesFetching } =
        useEarthquakes(api, earthQuakeParams, mapState && !!earthQuakeParams);

    const affectedQueries = useQueries({
        queries: selectedEarthquakes.map((eq) =>
            affectedStationsQueryOptions(api, eq.api_id),
        ),
    });

    const affectedStationsFetching = affectedQueries.some((q) => q.isFetching);

    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        if (isPopulated && !isLoading) {
            setIsInitialLoad(false);
        }
    }, [isPopulated, isLoading]);

    const showSkeleton = !mapState && isInitialLoad;

    const showSpinner =
        (!mapState && !isInitialLoad && (!isPopulated || isLoading)) ||
        isGlobeLoading ||
        rinexOnDateLoading;

    // if toggleStateEarthquakeMask is true, then use affectedStationList instead of stationsResult?.data

    const toggleStateEarthquakeMask = useMapStore(
        (s) => s.toggleStateEarthquakeMask,
    );

    // Merge affected data from all selected earthquakes
    const mergedAffectedData = useMemo<
        StationsAffectedServiceData | undefined
    >(() => {
        if (selectedEarthquakes.length === 0) return undefined;

        const merged: StationsAffectedServiceData = {
            affected_stations_including_postseismic: [],
            affected_stations_without_postseismic: [],
            active_affected_stations: [],
            coseismic_displacements: [],
            csv_including_postseismic: "",
            csv_without_postseismic: "",
            kml_including_postseismic: "",
            kml_without_postseismic: "",
            kml_list_including_postseismic: [],
            kml_list_without_postseismic: [],
            active_kml_list: [],
            individual_data: {},
        };

        const seenActive = new Set<string>();
        const seenDisp = new Set<string>();

        affectedQueries.forEach((query, index) => {
            if (query.data) {
                const eq = selectedEarthquakes[index];
                const useIncluding = eq.ui_toggle_mask ?? true;

                if (merged.individual_data) {
                    merged.individual_data[eq.api_id.toString()] = query.data;
                }

                // Collect Active KML
                const activeKmlData = useIncluding
                    ? query.data.kml_including_postseismic
                    : query.data.kml_without_postseismic;

                if (activeKmlData) {
                    merged.active_kml_list?.push({
                        id: eq.api_id,
                        data: activeKmlData,
                    });
                }

                // Merge active stations
                const activeStations = useIncluding
                    ? query.data.affected_stations_including_postseismic
                    : query.data.affected_stations_without_postseismic;

                activeStations?.forEach((s) => {
                    const key = `${s.network_code}_${s.station_code}`;
                    if (!seenActive.has(key)) {
                        seenActive.add(key);
                        merged.active_affected_stations?.push(s);
                    }
                });
                // Merge displacements only if toggled on for this specific earthquake
                if (eq.ui_toggle_vector) {
                    query.data.coseismic_displacements?.forEach((d) => {
                        const key = `${d.NetworkCode}_${d.StationCode}_${eq.api_id}`;
                        if (!seenDisp.has(key)) {
                            seenDisp.add(key);
                            merged.coseismic_displacements.push(d);
                        }
                    });
                }
            }
        });

        return merged;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [affectedQueries, selectedEarthquakes, toggleStateEarthquakeMask]);

    const affectedStationList = useMemo(() => {
        if (!mergedAffectedData) return [];

        const list = mergedAffectedData.active_affected_stations || [];

        return list.flatMap((afs) => {
            const station = stationsResult?.data?.find(
                (s) =>
                    s.station_code === afs.station_code &&
                    s.network_code === afs.network_code,
            );

            return station ? [station] : [];
        });
    }, [mergedAffectedData, stationsResult?.data]);

    const downloadableAffectedStations = useMemo(() => {
        let list = affectedStationList;

        const cc = params.country_code?.toLowerCase();
        const nc = params.network_code?.toLowerCase();
        const sc = params.station_code?.toLowerCase();

        if (cc) list = list.filter((s) => s.country_code?.toLowerCase() === cc);
        if (nc) list = list.filter((s) => s.network_code?.toLowerCase() === nc);
        if (sc)
            list = list.filter((s) =>
                s.station_code?.toLowerCase().includes(sc),
            );

        const { dateStart, dateEnd, exactDate } = temporalFilter;
        if (dateStart !== null || dateEnd !== null) {
            list = list.filter((s) =>
                exactDate
                    ? s.api_id !== undefined &&
                      stationRinexOnDate.includes(s.api_id)
                    : isStationInTemporalWindow(s, dateStart, dateEnd),
            );
        }

        return list;
    }, [
        affectedStationList,
        params.country_code,
        params.network_code,
        params.station_code,
        temporalFilter,
        stationRinexOnDate,
    ]);

    // Derived filtered earthquakes
    const isEmpty = (s: string | undefined) => {
        return s === "" || s === null || s === undefined;
    };

    const isEarthquakeFiltered = (earthquake: EarthquakeData | undefined) => {
        if (earthquake) {
            if (earthquakeFilterFormState) {
                if (
                    earthquakeFilterFormState.max_latitude ||
                    earthquakeFilterFormState.min_latitude ||
                    earthquakeFilterFormState.max_longitude ||
                    earthquakeFilterFormState.min_longitude
                ) {
                    return handleEarthquakeLimits(
                        earthquake,
                        earthquakeFilterFormState,
                    );
                }
            } else {
                return false;
            }
        }
        return true;
    };

    const filteredEarthquakes =
        (Array.isArray(earthquakeFilterFormState?.polygon_coordinates) &&
            earthquakeFilterFormState.polygon_coordinates[0].length > 0) ||
        !isEmpty(earthquakeFilterFormState?.max_latitude) ||
        !isEmpty(earthquakeFilterFormState?.min_latitude) ||
        !isEmpty(earthquakeFilterFormState?.max_longitude) ||
        !isEmpty(earthquakeFilterFormState?.min_longitude)
            ? earthquakesResult?.data?.filter((s: EarthquakeData) =>
                  isEarthquakeFiltered(s),
              )
            : earthquakesResult?.data;

    const handleEarthQuakeParams = (formstate: EarthQuakeFormState) => {
        setEarthQuakeParams({
            date_start: formstate.date_start ? formstate.date_start : undefined,
            date_end: formstate.date_end ? formstate.date_end : undefined,
            max_magnitude: formstate.max_magnitude
                ? parseFloat(formstate.max_magnitude)
                : undefined,
            min_magnitude: formstate.min_magnitude
                ? parseFloat(formstate.min_magnitude)
                : undefined,
            id: formstate.id ? formstate.id : undefined,
            max_depth: formstate.max_depth
                ? parseFloat(formstate.max_depth)
                : undefined,
            min_depth: formstate.min_depth
                ? parseFloat(formstate.min_depth)
                : undefined,
        });
    };

    const handleEarthquakes = (formstate?: EarthQuakeFormState) => {
        setChosenEarthquake(undefined);
        setSelectedEarthquakes([]);
        handleEarthQuakeParams(formstate ?? earthquakeFilterFormState);
        setMapState(true);
    };

    const handleEarthquakeState = (
        earthquake: EarthquakeData,
        isMulti: boolean = false,
    ) => {
        const isSelected = selectedEarthquakes.some(
            (eq) => eq.api_id === earthquake.api_id,
        );

        if (isMulti) {
            // Multi-selection logic
            if (isSelected) {
                // Remove from selection
                const newList = selectedEarthquakes.filter(
                    (eq) => eq.api_id !== earthquake.api_id,
                );
                setSelectedEarthquakes(newList);
                if (newList.length === 0) {
                    setChosenEarthquake(undefined);
                    setToggleEarthquakeMask(false);
                } else {
                    const lastEq = newList[newList.length - 1];
                    setChosenEarthquake(lastEq);
                }
            } else {
                // Add to selection
                setSelectedEarthquakes((prev) => [
                    ...prev,
                    { ...earthquake, ui_toggle_mask: true },
                ]);
                setChosenEarthquake(earthquake);
                setToggleEarthquakeMask(true);
                setPosToFly([earthquake.lat, earthquake.lon]);
            }
        } else {
            // Single selection logic (original behavior)
            if (isSelected && selectedEarthquakes.length === 1) {
                // Unselect
                setSelectedEarthquakes([]);
                setChosenEarthquake(undefined);
                setToggleEarthquakeMask(false);
            } else {
                // Set as single selection
                setSelectedEarthquakes([
                    { ...earthquake, ui_toggle_mask: true },
                ]);
                setChosenEarthquake(earthquake);
                setToggleEarthquakeMask(true);
                setPosToFly([earthquake.lat, earthquake.lon]);
            }
        }
    };

    useEffect(() => {
        if (selectedEarthquakes.length > 1 && !multiSelectMode) {
            setMultiSelectMode(true);
        }
    }, [selectedEarthquakes.length, multiSelectMode, setMultiSelectMode]);

    // Centralized Temporal Filter Synchronization
    useEffect(() => {
        const currentKey = selectedEarthquakes
            .map((e) => e.api_id)
            .sort()
            .join(",");
        const selectionChanged = currentKey !== prevSelectionKey.current;

        if (selectedEarthquakes.length === 1) {
            const eq = selectedEarthquakes[0];
            const eqDate = new Date(eq.date);
            const sliderStartDate = new Date(eqDate);
            sliderStartDate.setDate(eqDate.getDate() - 5);
            const sliderEndDate = new Date(eqDate);
            sliderEndDate.setDate(eqDate.getDate() + 5);

            const eqFractional = dateToFractionalYear(eqDate);
            const isOutOfBounds =
                eqFractional < minYear || eqFractional > maxYear;

            // Update filter if selection changed OR if it was previously null and now it can be in-bounds
            const shouldUpdate =
                selectionChanged ||
                (temporalFilter.dateStart === null && !isOutOfBounds);

            if (shouldUpdate) {
                if (!isOutOfBounds) {
                    setTemporalFilter((prev) => ({
                        ...prev,
                        enabled: true,
                        dateStart: dateToFractionalYear(sliderStartDate),
                        dateEnd: dateToFractionalYear(sliderEndDate),
                        hiddenPoints: false,
                        exactDate: false,
                    }));
                } else {
                    setTemporalFilter((prev) => ({
                        ...prev,
                        dateStart: null,
                        dateEnd: null,
                    }));
                }
            }
        } else if (selectionChanged) {
            if (
                selectedEarthquakes.length > 1 &&
                prevSelectionKey.current.split(",").filter(Boolean).length === 1
            ) {
                // Transitioned from 1 to 2 earthquakes
                setTemporalFilter((prev) => ({
                    ...prev,
                    dateStart: null,
                    dateEnd: null,
                }));
            }
            // reset de timeline innecesario?
            // else if (selectedEarthquakes.length === 0) {
            //     // Selection cleared: reset filter dates
            //     setTemporalFilter((prev) => ({
            //         ...prev,
            //         dateStart: null,
            //         dateEnd: null,
            //     }));
            // }
        }

        prevSelectionKey.current = currentKey;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        selectedEarthquakes,
        setTemporalFilter,
        stationsResult?.data,
        temporalFilter.dateStart,
    ]);

    const stationsByFilters = (stations: StationData[]) => {
        const filteredStations =
            filters?.stationWithProblems ||
            filters?.stationWithoutProblems ||
            (Array.isArray(filterState?.statusOption) &&
                filterState?.statusOption.length > 0) ||
            (Array.isArray(filterState?.typeOption) &&
                filterState?.typeOption.length > 0)
                ? stations?.filter((s) =>
                      isStationFiltered(s, filterState, filters),
                  )
                : stations;

        return filteredStations;
    };

    const resetTemporalFilter = () =>
        setTemporalFilter({
            enabled: false,
            dateStart: null,
            dateEnd: null,
            hiddenPoints: false,
            exactDate: false,
        });

    const exitEarthquakes = () => {
        if (mapState) {
            setMapState(false);
            setShowEarthQuakesList(false);
            setEarthQuakeParams(undefined);
            setChosenEarthquake(undefined);
            setSelectedEarthquakes([]);
            resetTemporalFilter();
        }
    };

    const handleEarthquakeClose = () => {
        setChosenEarthquake(undefined);
        setSelectedEarthquakes([]);
        setMapState(false);
        setShowEarthQuakesList(false);
        resetTemporalFilter();
    };

    // on exit, cleans posToFly to avoid jumping to previous earthquake
    // when returning from station page
    useEffect(() => {
        return () => {
            setPosToFly(undefined);
        };
    }, [setPosToFly]);

    useEffect(() => {
        earthquakeModal?.show && showModal(earthquakeModal.title);
    }, [earthquakeModal]);

    useEffect(() => {
        const earthquake: EarthquakeData | undefined = filteredEarthquakes
            ? filteredEarthquakes[0]
            : undefined;

        if (
            earthquake &&
            filteredEarthquakes?.length === 1 &&
            chosenEarthquake === undefined
        ) {
            setPosToFly([earthquake.lat, earthquake.lon]);
        }
    }, [filteredEarthquakes, chosenEarthquake, setPosToFly]);

    useEscape(exitEarthquakes);

    return (
        <div
            className={
                "my-auto flex flex-1 transition-all duration-200 relative "
            }
        >
            {showSkeleton && (
                <MapSkeleton
                    styles={{
                        backgroundColor: "rgb(202, 202, 202)",
                        zIndex: 1000000000000000,
                        width: "100vw",
                        position: "absolute",
                        height: "92vh",
                    }}
                />
            )}

            {showSpinner && (
                <div className="absolute inset-0 z-[1000000000] flex items-center justify-center bg-base-100/30 backdrop-blur-sm transition-all duration-500">
                    <div className="flex flex-col items-center justify-center gap-4 p-8 rounded-3xl bg-base-100/90 shadow-2xl border border-base-content/10">
                        <div className="text-gray-800/70 scale-150 mb-2">
                            <Spinner size="lg" />
                        </div>
                        <span className="text-xs font-bold tracking-[0.2em] text-base-content/70 animate-pulse uppercase">
                            Loading Map...
                        </span>
                    </div>
                </div>
            )}

            {stationLegend && (
                <StationMetadataLegend close={() => setStationLegend(false)} />
            )}

            <div
                className={`flex flex-1 w-full transition-all duration-500 ${
                    showSkeleton ? "opacity-0 pointer-events-none" : ""
                } ${showSpinner ? "pointer-events-none" : ""}`}
            >
                <MainScroller
                    altData={{
                        dataFiltered: stationsByFilters(
                            stationsResult?.data || [],
                        ),
                        originalDataCount: stationsResult?.data?.length,
                        hasEarthquakes: showEarthQuakesList,
                    }}
                    fromMain={true}
                />

                <Legend
                    stationLegend={stationLegend}
                    setStationLegend={setStationLegend}
                />

                <EarthQuakeScroller
                    spinner={earthquakesFetching || affectedStationsFetching}
                    scrollerCondition={showEarthQuakesList}
                    earthquakes={filteredEarthquakes ?? EMPTY_EARTHQUAKES}
                    earthquakeChosen={chosenEarthquake}
                    handleEarthquakeState={handleEarthquakeState}
                    handleEarthquakeClose={handleEarthquakeClose}
                    earthquakeAffectedStations={mergedAffectedData}
                />
                {earthquakeModal && earthquakeModal.title === "earthquake" && (
                    <EarthQuakeFormModal
                        formstate={earthquakeFilterFormState}
                        handleEarthquakes={handleEarthquakes}
                        setShowEarthquakeModal={setEarthquakeModal}
                        setFormState={setEarthquakeFilterFormState}
                        setShowEarthQuakesList={setShowEarthQuakesList}
                        setPosToFly={setPosToFly}
                    />
                )}
                {!mapState ? <Sidebar station={station} /> : null}
                <div className={"self-center w-full flex flex-col flex-wrap"}>
                    <div
                        id="search-input"
                        className="flex justify-center flex-wrap items-center absolute z-[100000] top-8 left-1/2 -translate-x-1/2 w-full lg:max-w-[600px] lg:pl-4 max-w-[785px]"
                    >
                        <SearchInput
                            params={params}
                            stations={
                                selectedEarthquakes.length > 0
                                    ? affectedStationList
                                    : stationsResult?.data
                            }
                            setParams={setParams}
                            setStation={setStation}
                            setPosToFly={setPosToFly}
                        />
                    </div>
                    {mapState && (
                        <DropLeft
                            mapState={showEarthQuakesList}
                            setShowEarthquakeList={setShowEarthQuakesList}
                        />
                    )}
                    <MapOL
                        posToFly={posToFly}
                        handleEarthquakeState={handleEarthquakeState}
                        mapState={mapState}
                        mainParams={params}
                        earthQuakeChosen={chosenEarthquake}
                        earthquakesFiltered={
                            filteredEarthquakes ?? EMPTY_EARTHQUAKES
                        }
                        earthquakeAffectedStations={mergedAffectedData}
                        stations={stationsResult?.data}
                        showEarthquakeList={showEarthQuakesList}
                    />
                    <TemporalBar
                        stations={stationsResult?.data}
                        loading={isLoading}
                    />

                    {selectedEarthquakes.length > 0 && (
                        <div className="absolute right-16 top-12 z-[100002]">
                            <button
                                aria-label="Download affected stations data"
                                disabled={
                                    downloadableAffectedStations.length === 0
                                }
                                data-tip="No stations within the current time window / filters"
                                onClick={() => setShowDownloadModal(true)}
                                className={`btn btn-rounded btn-sm flex-nowrap gap-1 ${
                                    downloadableAffectedStations.length === 0
                                        ? " cursor-not-allowed opacity-60"
                                        : ""
                                }`}
                                style={{ backgroundColor: "white" }}
                            >
                                <ArchiveBoxArrowDownIcon className="size-6" />
                                <span className="badge badge-neutral badge-sm">
                                    {downloadableAffectedStations.length}
                                </span>
                            </button>
                        </div>
                    )}
                    {showDownloadModal && (
                        <DownloadAffectedStationsModal
                            stations={downloadableAffectedStations}
                            earthquakeCount={selectedEarthquakes.length}
                            onClose={() => setShowDownloadModal(false)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MainPage;
