import { useEffect } from "react";
import { Scroller, Spinner } from "@componentsReact";

import { useAuth, useApi, useLocalStorage } from "@hooks";
import type { MapLayerState, MapProjectionState } from "@hooks";

interface MainScrollerProps {
    altData?: {
        dataFiltered: any[];
        originalDataCount: any;
        hasEarthquakes?: boolean;
    };
    fromMain: boolean;
}

import { useMapStore } from "@store";
import { useMetadata } from "@hooks/queries";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

const MainScroller = ({ altData, fromMain }: MainScrollerProps) => {
    const mapState = useMapStore((s) => s.mapState);
    const filters = useMapStore((s) => s.filters);
    const filterState = useMapStore((s) => s.filterState);
    const mapLayerState = useMapStore((s) => s.mapLayerState);
    const mapProjectionState = useMapStore((s) => s.mapProjectionState);
    const showScroller = useMapStore((s) => s.showScroller);

    const setFilters = useMapStore((s) => s.setFilters);

    const setFilterState = useMapStore((s) => s.setFilterState);
    const setMapLayerState = useMapStore((s) => s.setMapLayerState);
    const setMapProjectionState = useMapStore((s) => s.setMapProjectionState);
    const setShowScroller = useMapStore((s) => s.setShowScroller);
    const setShowEarthquakeModal = useMapStore((s) => s.setEarthquakeModal);

    //------------------------------------------------UseAuth----------------------------------------------
    const { token, logout } = useAuth();

    //------------------------------------------------UseApi----------------------------------------------
    const api = useApi(token, logout);

    //------------------------------------------------UseLocalStorage----------------------------------------------
    const [mapFilters, setMapFilters] = useLocalStorage(
        "mapFilters",
        JSON.stringify({}),
    );

    //------------------------------------------------Functions----------------------------------------------
    const handleLocalStorage = (key: string, value: string) => {
        setMapFilters(
            JSON.stringify({
                ...JSON.parse(mapFilters ?? "{}"),
                [key]: value,
            }),
        );
    };

    const {
        statuses: stationStatus,
        types: stationType,
        isLoading: loading,
    } = useMetadata(api, {
        enabled: !mapState,
        only: ["types", "statuses"],
    });

    const hasFilters = () => {
        return (
            filters.stationWithProblems ||
            filters.stationWithoutProblems ||
            filterState.typeOption?.length ||
            filterState.statusOption?.length
        );
    };

    const hasFilteredData =
        hasFilters() && altData?.dataFiltered && !altData.hasEarthquakes;

    const handleProjectionToggle = (
        projection: keyof MapProjectionState,
        checked: boolean,
    ) => {
        const newState: MapProjectionState = { [projection]: checked };

        setMapFilters(
            JSON.stringify({
                ...JSON.parse(mapFilters ?? "{}"),
                [`${projection.charAt(0).toUpperCase() + projection.slice(1)}ProjectionMapState`]:
                    checked.toString(),
            }),
        );
        setMapProjectionState(newState);
    };

    const handleLayerToggle = (
        layer: keyof MapLayerState,
        checked: boolean,
    ) => {
        // tectonicPlates is an overlay: independent from the topo/satellite
        // mutual exclusion below (activating one base layer deactivates the other)
        const newState: MapLayerState =
            layer === "tectonicPlates"
                ? { ...mapLayerState, tectonicPlates: checked }
                : layer === "topo"
                  ? {
                        ...mapLayerState,
                        topo: checked,
                        satellite: checked ? false : mapLayerState.satellite,
                    }
                  : {
                        ...mapLayerState,
                        topo: checked ? false : mapLayerState.topo,
                        satellite: checked,
                    };

        // Batch all keys in a single localStorage write to avoid stale closure
        setMapFilters(
            JSON.stringify({
                ...JSON.parse(mapFilters ?? "{}"),
                topoMapState: newState.topo.toString(),
                satelliteMapState: newState.satellite.toString(),
                tectonicPlatesMapState: newState.tectonicPlates.toString(),
            }),
        );
        setMapLayerState(newState);
    };

    //------------------------------------------------UseEffect----------------------------------------------

    // Restore mapLayerState from localStorage on initial mount only
    useEffect(() => {
        if (mapFilters) {
            const localStorageFilters = JSON.parse(mapFilters);
            const f = Object.entries(localStorageFilters).reduce(
                (acc, [key, value]) => {
                    return {
                        ...acc,
                        [key]: JSON.parse(value as string),
                    };
                },
                {},
            ) as any;

            setMapLayerState({
                topo: f.topoMapState ?? false,
                satellite: f.satelliteMapState ?? false,
                tectonicPlates: f.tectonicPlatesMapState ?? false,
            });
            setMapProjectionState({
                globe: f.GlobeProjectionMapState ?? false,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Restore filters from localStorage reactively
    useEffect(() => {
        if (mapFilters) {
            const localStorageFilters = JSON.parse(mapFilters);

            const f = Object.entries(localStorageFilters).reduce(
                (acc, [key, value]) => {
                    return {
                        ...acc,
                        [key]: JSON.parse(value as string),
                    };
                },
                {},
            ) as any;

            setFilters((prev: any) => ({
                ...prev,
                stationWithProblems: f.stationWithProblems,
                stationWithoutProblems: f.stationWithoutProblems,
            }));

            setFilterState((prev: any) => ({
                ...prev,
                typeOption: f.stationType ?? [],
                statusOption: f.stationStatus ?? [],
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapFilters]);

    //------------------------------------------------Return----------------------------------------------

    return (
        <>
            <Scroller
                fromMain
                hasFilteredData={hasFilteredData && !mapState ? true : false}
                buttonCondition
                scrollerCondition={fromMain && showScroller}
                scrollerName={
                    !mapState && hasFilteredData && altData?.originalDataCount
                        ? "Filtered " +
                          altData?.dataFiltered.length.toString() +
                          " from " +
                          altData?.originalDataCount
                        : "Options"
                }
                showScroller={showScroller}
                setShowScroller={setShowScroller}
            >
                {loading ? (
                    <div className="w-full flex justify-center py-4">
                        <Spinner size="lg" />
                    </div>
                ) : (
                    <ul className="menu rounded-box w-auto">
                        {/* a. Find earthquake */}
                        <li>
                            <a
                                className="flex justify-between items-center font-bold"
                                style={{ paddingRight: "10px" }}
                                onClick={() => {
                                    setShowEarthquakeModal({
                                        show: true,
                                        title: "earthquake",
                                        type: "none",
                                    });
                                }}
                            >
                                <span>Find Earthquake</span>
                                <MagnifyingGlassIcon className="size-5" />
                            </a>
                        </li>
                        {/* b. Layers & Projection */}
                        <li>
                            <details>
                                <summary>Layers & Projection</summary>
                                <ul>
                                    {/* 1. Globe Projection */}
                                    <li>
                                        <div className="form-control p-0">
                                            <label className="label cursor-pointer truncate w-[248px]">
                                                <span className="font-bold mr-4">
                                                    Globe Projection
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={
                                                        mapProjectionState.globe
                                                    }
                                                    onChange={(e) => {
                                                        handleProjectionToggle(
                                                            "globe",
                                                            e.target.checked,
                                                        );
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </li>
                                    {/* 2. Topo layer */}
                                    <li>
                                        <div className="form-control p-0">
                                            <label className="label cursor-pointer truncate w-[248px]">
                                                <span className="font-bold mr-4">
                                                    Topo Layer
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={mapLayerState.topo}
                                                    onChange={(e) => {
                                                        handleLayerToggle(
                                                            "topo",
                                                            e.target.checked,
                                                        );
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </li>
                                    {/* 3. Satellite layer */}
                                    <li>
                                        <div className="form-control p-0">
                                            <label className="label cursor-pointer truncate w-[248px]">
                                                <span className="font-bold mr-4">
                                                    Satellite Layer
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={
                                                        mapLayerState.satellite
                                                    }
                                                    onChange={(e) => {
                                                        handleLayerToggle(
                                                            "satellite",
                                                            e.target.checked,
                                                        );
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </li>
                                    {/* 4. Tectonic plates layer */}
                                    <li>
                                        <div className="form-control p-0">
                                            <label className="label cursor-pointer truncate w-[248px]">
                                                <span className="font-bold mr-4">
                                                    Tectonic Plates
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={
                                                        mapLayerState.tectonicPlates
                                                    }
                                                    onChange={(e) => {
                                                        handleLayerToggle(
                                                            "tectonicPlates",
                                                            e.target.checked,
                                                        );
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </li>
                                </ul>
                            </details>
                        </li>
                        {/* c. Filter stations */}
                        {!mapState && (
                            <li>
                                <details>
                                    <summary
                                        onClick={() => {
                                            setFilters((prev: any) => {
                                                return {
                                                    ...prev,
                                                    openFilters:
                                                        !prev.openFilters,
                                                };
                                            });
                                        }}
                                    >
                                        Filter Stations
                                    </summary>
                                    <ul>
                                        {/* 1. Stations with problems */}
                                        <li>
                                            <div className="form-control">
                                                <label className="label cursor-pointer truncate w-[248px]">
                                                    <span className="font-bold mr-4 ">
                                                        Station With Problems
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-sm"
                                                        defaultChecked={
                                                            filters.stationWithProblems
                                                        }
                                                        onClick={() => {
                                                            handleLocalStorage(
                                                                "stationWithProblems",
                                                                (!filters.stationWithProblems).toString(),
                                                            );
                                                            setFilters(
                                                                (prev: any) => {
                                                                    return {
                                                                        ...prev,
                                                                        stationWithProblems:
                                                                            !prev.stationWithProblems,
                                                                    };
                                                                },
                                                            );
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </li>
                                        {/* 2. Stations without problems */}
                                        <li>
                                            <div className="form-control">
                                                <label className="label cursor-pointer truncate w-[248px]">
                                                    <span className="font-bold mr-4 ">
                                                        Station Without Problems
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox checkbox-sm"
                                                        defaultChecked={
                                                            filters.stationWithoutProblems
                                                        }
                                                        onClick={() => {
                                                            handleLocalStorage(
                                                                "stationWithoutProblems",
                                                                (!filters.stationWithoutProblems).toString(),
                                                            );
                                                            setFilters(
                                                                (prev: any) => {
                                                                    return {
                                                                        ...prev,
                                                                        stationWithoutProblems:
                                                                            !prev.stationWithoutProblems,
                                                                    };
                                                                },
                                                            );
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        </li>
                                        {/* 3. Station type */}
                                        <li>
                                            <details>
                                                <summary
                                                    onClick={() => {
                                                        setFilters(
                                                            (prev: any) => {
                                                                return {
                                                                    ...prev,
                                                                    stationType:
                                                                        !prev.stationType,
                                                                };
                                                            },
                                                        );
                                                    }}
                                                >
                                                    Station type
                                                </summary>
                                                <ul>
                                                    {stationType?.map(
                                                        (typeOption) => (
                                                            <li
                                                                key={
                                                                    typeOption.id
                                                                }
                                                            >
                                                                <div className="form-control">
                                                                    <label className="label cursor-pointer truncate w-[225px]">
                                                                        <span className="font-bold mr-4">
                                                                            {
                                                                                typeOption.name
                                                                            }
                                                                        </span>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="checkbox checkbox-sm"
                                                                            defaultChecked={
                                                                                Array.isArray(
                                                                                    filterState.typeOption,
                                                                                ) &&
                                                                                filterState.typeOption.includes(
                                                                                    typeOption.name,
                                                                                )
                                                                            }
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                const target =
                                                                                    e.target as HTMLInputElement;

                                                                                handleLocalStorage(
                                                                                    "stationType",
                                                                                    filters.stationType.toString(),
                                                                                );

                                                                                target.checked
                                                                                    ? (handleLocalStorage(
                                                                                          "stationType",
                                                                                          JSON.stringify(
                                                                                              [
                                                                                                  ...(filterState.typeOption ||
                                                                                                      []),
                                                                                                  typeOption.name,
                                                                                              ],
                                                                                          ),
                                                                                      ),
                                                                                      setFilterState(
                                                                                          (
                                                                                              prev,
                                                                                          ) => ({
                                                                                              ...prev,
                                                                                              typeOption:
                                                                                                  [
                                                                                                      ...(prev.typeOption ||
                                                                                                          []),
                                                                                                      typeOption.name,
                                                                                                  ],
                                                                                          }),
                                                                                      ))
                                                                                    : (handleLocalStorage(
                                                                                          "stationType",
                                                                                          JSON.stringify(
                                                                                              filterState.typeOption?.filter(
                                                                                                  (
                                                                                                      option,
                                                                                                  ) =>
                                                                                                      option !==
                                                                                                      typeOption.name,
                                                                                              ),
                                                                                          ),
                                                                                      ),
                                                                                      setFilterState(
                                                                                          (
                                                                                              prev,
                                                                                          ) => ({
                                                                                              ...prev,
                                                                                              typeOption:
                                                                                                  prev.typeOption?.filter(
                                                                                                      (
                                                                                                          option,
                                                                                                      ) =>
                                                                                                          option !==
                                                                                                          typeOption.name,
                                                                                                  ),
                                                                                          }),
                                                                                      ));
                                                                            }}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </details>
                                        </li>
                                        {/* 4. Station status */}
                                        <li>
                                            <details>
                                                <summary
                                                    onClick={() => {
                                                        setFilters(
                                                            (prev: any) => {
                                                                return {
                                                                    ...prev,
                                                                    stationStatus:
                                                                        !prev.stationStatus,
                                                                };
                                                            },
                                                        );
                                                    }}
                                                >
                                                    Station Status
                                                </summary>
                                                <ul>
                                                    {stationStatus?.map(
                                                        (statusOption) => (
                                                            <li
                                                                key={
                                                                    statusOption.id
                                                                }
                                                            >
                                                                <div className="form-control">
                                                                    <label className="label cursor-pointer truncate w-[225px]">
                                                                        <span className="font-bold mr-4">
                                                                            {
                                                                                statusOption.name
                                                                            }
                                                                        </span>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="checkbox checkbox-sm"
                                                                            defaultChecked={
                                                                                Array.isArray(
                                                                                    filterState.statusOption,
                                                                                ) &&
                                                                                filterState.statusOption.includes(
                                                                                    statusOption.name,
                                                                                )
                                                                            }
                                                                            onClick={(
                                                                                e,
                                                                            ) => {
                                                                                const target =
                                                                                    e.target as HTMLInputElement;

                                                                                handleLocalStorage(
                                                                                    "stationStatus",
                                                                                    filterState?.statusOption?.toString(),
                                                                                );

                                                                                target.checked
                                                                                    ? (handleLocalStorage(
                                                                                          "stationStatus",
                                                                                          JSON.stringify(
                                                                                              [
                                                                                                  ...(filterState.statusOption ||
                                                                                                      []),
                                                                                                  statusOption.name,
                                                                                              ],
                                                                                          ),
                                                                                      ),
                                                                                      setFilterState(
                                                                                          (
                                                                                              prev,
                                                                                          ) => ({
                                                                                              ...prev,
                                                                                              statusOption:
                                                                                                  [
                                                                                                      ...(prev.statusOption ||
                                                                                                          []),
                                                                                                      statusOption.name,
                                                                                                  ],
                                                                                          }),
                                                                                      ))
                                                                                    : (handleLocalStorage(
                                                                                          "stationStatus",
                                                                                          JSON.stringify(
                                                                                              filterState.statusOption?.filter(
                                                                                                  (
                                                                                                      option,
                                                                                                  ) =>
                                                                                                      option !==
                                                                                                      statusOption.name,
                                                                                              ),
                                                                                          ),
                                                                                      ),
                                                                                      setFilterState(
                                                                                          (
                                                                                              prev,
                                                                                          ) => ({
                                                                                              ...prev,
                                                                                              statusOption:
                                                                                                  prev.statusOption?.filter(
                                                                                                      (
                                                                                                          option,
                                                                                                      ) =>
                                                                                                          option !==
                                                                                                          statusOption.name,
                                                                                                  ),
                                                                                          }),
                                                                                      ));
                                                                            }}
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            </details>
                                        </li>
                                    </ul>
                                </details>
                            </li>
                        )}
                    </ul>
                )}
            </Scroller>
        </>
    );
};

export default MainScroller;
