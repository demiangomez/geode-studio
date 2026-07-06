import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
    CardContainer,
    EtmSolutionSelect,
    FormControlSelect,
    QueryCoordinatesModal,
    Spinner,
    StationSeriesFiltersModal,
    StationTimeSeriesDetailModal,
    TimeSeriesParams,
} from "@componentsReact";

import { DocumentChartBarIcon, BookmarkIcon, Cog8ToothIcon, MapPinIcon } from "@heroicons/react/24/outline";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getStationTimeSeriesService } from "@services";
import {
    buildTimeSeriesParams,
    useSolutionTypes,
    useStackNames,
    useStationTimeSeries,
} from "@hooks/queries";
import { useAuth, useApi } from "@hooks";
import { showModal } from "@utils";

import { SERIES_FILTERS_STATE } from "@utils/reducerFormStates";

import {
    ErrorResponse,
    StationData,
    StationMetadataServiceData,
    StationTimeSeriesServiceData,
} from "@types";

interface OutletContext {
    station: StationData;
    reStation: StationData;
    stationMeta: StationMetadataServiceData;
}

type SeriesParams = Record<
    keyof typeof SERIES_FILTERS_STATE,
    string | boolean | number[]
>;

const TimeSeries = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);
    const queryClient = useQueryClient();

    const { station } = useOutletContext<OutletContext>();
    const stationId = station?.api_id ?? 0;

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [jsonMsg, setJsonMsg] = useState<
        { status: number; msg: string; errors?: any } | undefined
    >(undefined);

    const [solutionSelected, setSolutionSelected] = useState<string>("PPP");
    const [stackSelected, setStackSelected] = useState<string>("");

    // `params` = filtros de trabajo (los muta el modal en vivo).
    // `appliedParams` = snapshot que realmente dispara el fetch del plot.
    const [params, setParams] = useState<SeriesParams>({
        ...SERIES_FILTERS_STATE,
    });
    const [appliedParams, setAppliedParams] = useState<SeriesParams>({
        ...SERIES_FILTERS_STATE,
    });

    const { solutionTypes: solutions } = useSolutionTypes(api);

    const { stacks, isLoading: stacksLoading } = useStackNames(api, stationId);

    const isGamit = solutionSelected === "GAMIT";

    const gamitUnavailable =
        !stacksLoading && (!stacks || stacks.length === 0);

    const tsEnabled =
        (appliedParams.solution === "GAMIT" && !!appliedParams.stack) ||
        (appliedParams.solution !== "GAMIT" && !appliedParams.stack);

    const tsQuery = useStationTimeSeries(api, stationId, appliedParams, {
        enabled: !!station && tsEnabled,
    });

    const tsData =
        tsQuery.data && !("status" in tsQuery.data) ? tsQuery.data : undefined;
    const timeSeries = tsData?.time_series;
    const polynomialData = tsData?.etm_params?.polynomial;
    const periodicData = tsData?.etm_params?.periodic;
    const jumpsData = tsData?.etm_params?.jumps;
    const copyParams = tsData?.etm_params?.copy_params;
    const loading = tsQuery.isFetching;

    const plotMsg = useMemo(() => {
        if (tsQuery.data && "status" in tsQuery.data) {
            const err = tsQuery.data as ErrorResponse;
            return {
                status: err.statusCode,
                msg: err.response.errors[0].detail,
                errors: err.response,
            };
        }
        if (tsQuery.isError) {
            return { status: 500, msg: "Error fetching time series" };
        }
        return undefined;
    }, [tsQuery.data, tsQuery.isError]);

    const msg = plotMsg ?? jsonMsg;


    const jsonMutation = useMutation({
        mutationFn: () =>
            getStationTimeSeriesService<
                StationTimeSeriesServiceData | ErrorResponse
            >(api, stationId, buildTimeSeriesParams(appliedParams), true),
        onSuccess: (res) => {
            if ("status" in res) {
                setJsonMsg({
                    status: res.statusCode,
                    msg: res.response.errors[0].detail,
                    errors: res.response,
                });
                return;
            }
            setJsonMsg(undefined);
            const jsonData = JSON.stringify(res.time_series, null, 2);
            const blob = new Blob([jsonData], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            const stationName =
                station.network_code + "." + station.station_code;
            const baseName =
                res.download_filename ||
                `timeseries_${stationName}_${appliedParams.stack ? appliedParams.stack : appliedParams.solution}`;
            // El backend no siempre incluye la extensión: garantizar el .json final
            const filename = baseName.endsWith(".json")
                ? baseName
                : `${baseName}.json`;
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        },
        onError: () =>
            setJsonMsg({ status: 500, msg: "Error fetching time series" }),
    });

    const handleSolutionChange = (option: string) => {
        const newStack = option === "GAMIT" ? (stacks?.[0] ?? "") : "";
        setSolutionSelected(option);
        setStackSelected(newStack);
        // Cambiar de solution no debe resetear los plot parameters: solo se
        // ajustan solution y stack, el resto se conserva.
        const next: SeriesParams = {
            ...params,
            solution: option,
            stack: newStack,
        };
        setParams(next);
        setAppliedParams(next);
    };

    const handleStackChange = (option: string) => {
        setStackSelected(option);
        const next: SeriesParams = { ...params, stack: option };
        setParams(next);
        setAppliedParams(next);
    };

    const handleShowReference = () => {
        setModals({
            show: true,
            title: "station-time-series-detail-modal",
            type: "none",
        });
    };

    // Si la solución elegida deja de ser válida cuando llega el catálogo, caer
    // a PPP (o la primera disponible).
    useEffect(() => {
        if (solutions.length > 0 && !solutions.includes(solutionSelected)) {
            handleSolutionChange(solutions.includes("PPP") ? "PPP" : solutions[0]);
        }
    }, [solutions]); // eslint-disable-line react-hooks/exhaustive-deps

    // GAMIT seleccionado antes de que carguen los stacks: fijar el primero al llegar.
    useEffect(() => {
        if (isGamit && stacks && stacks.length > 0 && !stackSelected) {
            const s = stacks[0];
            setStackSelected(s);
            setParams((prev) => ({ ...prev, stack: s }));
            setAppliedParams((prev) => ({ ...prev, stack: s }));
        }
    }, [stacks, isGamit, stackSelected]);

    useEffect(() => {
        if (modals?.show) {
            showModal(modals.title);
        }
    }, [modals]);

    return (
        <div className="">
            <h1 className="text-2xl font-base text-center">{station ? "TIME SERIES" : "TIME SERIES NOT FOUND"}</h1>
            {station &&
                <div className="flex flex-grow w-full justify-center pr-2 space-x-2 px-2 pb-4">

                    <CardContainer title={""} height={false} addButton={false} >
                        <div className="flex flex-col space-y-4 items-center w-[100%]">
                            <div className="flex flex-col space-y-2 items-center w-full">
                                <div className="w-full flex flex-row">
                                    <BookmarkIcon className="size-6 cursor-pointer"
                                        onClick={handleShowReference}
                                    />
                                    <div className="w-full flex space-x-4 justify-center items-end flex-wrap gap-y-2">
                                        <EtmSolutionSelect
                                            solutions={solutions}
                                            selected={solutionSelected}
                                            disabled={solutions.length === 0}
                                            optionDisabled={
                                                gamitUnavailable ? "GAMIT" : ""
                                            }
                                            onChange={handleSolutionChange}
                                        />
                                        {isGamit &&
                                            stacks &&
                                            stacks.length > 0 && (
                                                <FormControlSelect
                                                    title={"Stack"}
                                                    options={stacks ?? []}
                                                    optionSelected={stackSelected}
                                                    selectFunction={handleStackChange}
                                                />
                                            )}

                                        <button className="btn self-end"
                                            onClick={() => {
                                                setModals({
                                                    show: true,
                                                    title: "SeriesFilters",
                                                    type: "none",
                                                })
                                            }}
                                        >
                                            Config
                                            <Cog8ToothIcon className="size-6" />
                                        </button>

                                        <button
                                            className="btn self-end"
                                            onClick={() => jsonMutation.mutate()}
                                        >
                                            Json
                                            {jsonMutation.isPending ? (
                                                <Spinner size="md" />
                                            ) : (
                                                <DocumentChartBarIcon className="size-6" />
                                            )}
                                        </button>

                                        <button
                                            className="btn self-end"
                                            disabled={!tsData || loading}
                                            onClick={() => {
                                                setModals({
                                                    show: true,
                                                    title: "QueryCoordinates",
                                                    type: "none",
                                                })
                                            }}
                                        >
                                            Query
                                            <MapPinIcon className="size-6" />
                                        </button>
                                    </div>
                                </div>
                                {loading && (
                                    <div className="py-24">
                                        <Spinner size="lg" />
                                    </div>
                                )}
                                {msg && !loading && (
                                    <div className="font-bold text-xl p-4 flex relative items-center justify-center h-32">
                                        <span className="text-gray-300 text-base absolute right-3 self-end">
                                            {msg.errors?.errors[0].code.toUpperCase()}
                                        </span>
                                        <span className="text-neutral text-2xl">
                                            {msg.msg.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                                {timeSeries && !loading && (
                                    <img
                                        src={`data:image/png;base64,${timeSeries}`}
                                        alt="Time Series"
                                        className="w-[95%] pt-6"
                                    />
                                )}
                            </div>
                            {!loading &&
                                <div className="w-[95%]">
                                    <TimeSeriesParams
                                        stationId={station.api_id ? station.api_id : 0}
                                        refetch={() => {
                                            tsQuery.refetch();
                                        }}
                                        solution={solutionSelected}
                                        jumpsData={jumpsData}
                                        periodicData={periodicData}
                                        polynomialData={polynomialData}
                                        copyParams={copyParams}
                                        onCopyParamsSynced={() => {
                                            // copy_params=true copia los params de
                                            // esta solución a las otras en la DB →
                                            // invalidar el cache de todas las
                                            // soluciones de esta estación.
                                            queryClient.invalidateQueries({
                                                queryKey: [
                                                    "stationTimeSeries",
                                                    stationId,
                                                ],
                                            });
                                        }}
                                    />
                                </div>
                            }
                        </div>
                    </CardContainer>


                    {modals?.show && modals?.title === "SeriesFilters" && (
                        <StationSeriesFiltersModal
                            filters={params}
                            setFilters={setParams}
                            setStateModal={setModals}
                            handleSubmit={() => {
                                setAppliedParams(params);
                                setModals(undefined);
                            }}
                            handleCleanFilters={() => {
                                setParams({
                                    ...SERIES_FILTERS_STATE,
                                    solution: solutionSelected,
                                    stack: stackSelected,
                                });
                            }}
                        />
                    )}
                    {modals?.show && modals?.title === "station-time-series-detail-modal" &&
                        <StationTimeSeriesDetailModal />
                    }
                    {modals?.show && modals?.title === "QueryCoordinates" && (
                        <QueryCoordinatesModal
                            stationId={stationId}
                            solution={solutionSelected}
                            stack={stackSelected}
                            setStateModal={setModals}
                        />
                    )}
                </div>
            }
        </div>
    );
};

export default TimeSeries;
