import { useEffect, useState } from "react";

import {
    Alert,
    CopyButton,
    GregorianDatePicker,
    Modal,
} from "@componentsReact";
import { useApi, useAuth } from "@hooks";
import { useModeObsTypes } from "@hooks/queries";
import { useMutation } from "@tanstack/react-query";
import { getStationCoordinatesService } from "@services";
import { dateFromDay } from "@utils";
import { ErrorResponse, Errors, StationCoordinatesData } from "@types";

interface Props {
    stationId: number;
    solution: string;
    stack: string;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
}

// MODEL = posición del ETM ajustado; OBSERVATION = posición observada esa fecha.
const QueryCoordinatesModal = ({
    stationId,
    solution,
    stack,
    setStateModal,
}: Props) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    // mode_obs viene del backend (no hardcodeado). El back acepta id o type → type.
    const { modeObsTypes } = useModeObsTypes(api);
    const [modeObs, setModeObs] = useState("");

    // Al cargar el catálogo, fijar el primero si el actual no es válido.
    useEffect(() => {
        if (modeObsTypes.length > 0 && !modeObsTypes.includes(modeObs)) {
            setModeObs(modeObsTypes[0]);
        }
    }, [modeObsTypes]); // eslint-disable-line react-hooks/exhaustive-deps
    // doyCheck decide el widget de fecha y el date_format que se envía.
    const [doyCheck, setDoyCheck] = useState(true);
    const [year, setYear] = useState("");
    const [doy, setDoy] = useState("");

    const [result, setResult] = useState<StationCoordinatesData | undefined>(
        undefined,
    );
    const [msg, setMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const buildParams = () => {
        const base: Record<string, any> = { solution, mode_obs: modeObs };
        if (solution === "GAMIT" && stack) base.stack = stack;

        if (doyCheck) {
            base.date_format = "doy";
            base.year = year;
            base.doy = doy;
        } else {
            base.date_format = "gregorian";
            const date = dateFromDay(`${year} ${doy}`);
            base.year = date.getUTCFullYear();
            base.month = date.getUTCMonth() + 1;
            base.day = date.getUTCDate();
        }
        return base;
    };

    const coordsMutation = useMutation({
        mutationFn: () =>
            getStationCoordinatesService<
                StationCoordinatesData | ErrorResponse
            >(api, stationId, buildParams()),
        onSuccess: (res) => {
            if (res && "status" in res) {
                setResult(undefined);
                // Igual que el resto: `type` es el título del Alert; el detail lo
                // saca el propio Alert de errors[0].detail (subtítulo).
                setMsg({
                    status: res.statusCode,
                    msg: res.response.type,
                    errors: res.response,
                });
            } else {
                setMsg(undefined);
                setResult(res);
            }
        },
        onError: () => {
            setResult(undefined);
            setMsg({ status: 500, msg: "Error fetching coordinates" });
        },
    });

    const handleQuery = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        coordsMutation.mutate();
    };

    const dateReady = year !== "" && doy !== "" && modeObs !== "";

    const xyzText = result
        ? `${result.xyz.x}, ${result.xyz.y}, ${result.xyz.z}`
        : "";
    const llaText = result
        ? `${result.lla.lat}, ${result.lla.lon}, ${result.lla.height}`
        : "";

    return (
        <Modal
            close={true}
            modalId={"QueryCoordinates"}
            size={"smPlus"}
            setModalState={setStateModal}
        >
            <h3 className="font-bold text-center text-2xl my-2 w-full">
                Query Coordinates
            </h3>

            <form className="form-control space-y-4" onSubmit={handleQuery}>
                <div className="flex flex-col w-full">
                    <span className="font-bold text-xs px-1 mb-1">MODE</span>
                    <select
                        className="select select-bordered w-full"
                        value={modeObs}
                        disabled={modeObsTypes.length === 0}
                        onChange={(e) => setModeObs(e.target.value)}
                    >
                        {modeObsTypes.map((m) => (
                            <option key={m} value={m}>
                                {m}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex w-full items-start gap-2">
                    <div className="grow min-w-0">
                        {doyCheck ? (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col">
                                    <span className="font-bold text-xs px-1 mb-1">
                                        YEAR
                                    </span>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        value={year}
                                        onChange={(e) =>
                                            setYear(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-bold text-xs px-1 mb-1">
                                        DOY
                                    </span>
                                    <input
                                        type="number"
                                        className="input input-bordered w-full"
                                        value={doy}
                                        onChange={(e) => setDoy(e.target.value)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <GregorianDatePicker
                                portalId="QueryCoordinates-dp-portal"
                                labelAbove
                                year={year}
                                doy={doy}
                                onChange={(newYear, newDoy) => {
                                    setYear(newYear);
                                    setDoy(newDoy);
                                }}
                            />
                        )}
                    </div>
                    <div className="flex flex-col shrink-0">
                        <span
                            aria-hidden="true"
                            className="font-bold text-xs px-1 mb-1 opacity-0 select-none"
                        >
                            DOY
                        </span>
                        <label className="label cursor-pointer gap-1 p-0 shrink-0 mb-2">
                            <span className="label-text text-xs font-semibold">
                                DOY
                            </span>
                            <input
                                type="checkbox"
                                checked={doyCheck}
                                onChange={() => setDoyCheck((prev) => !prev)}
                                className="checkbox"
                            />
                        </label>
                    </div>
                </div>

                {msg && <Alert msg={msg} />}

                <button
                    type="submit"
                    className="btn btn-success self-center w-4/12"
                    disabled={!dateReady || coordsMutation.isPending}
                >
                    {coordsMutation.isPending && (
                        <span className="loading loading-spinner loading-sm"></span>
                    )}
                    Query
                </button>
            </form>

            {result && (
                <div className="mt-4 space-y-3">
                    <div className="card bg-base-200">
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between">
                                <span className="font-bold">XYZ (m)</span>
                                <CopyButton
                                    text={xyzText}
                                    iconClassName="size-5"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>X: {result.xyz.x}</div>
                                <div>Y: {result.xyz.y}</div>
                                <div>Z: {result.xyz.z}</div>
                                <div className="text-gray-500">
                                    σ {result.sigmas.x}
                                </div>
                                <div className="text-gray-500">
                                    σ {result.sigmas.y}
                                </div>
                                <div className="text-gray-500">
                                    σ {result.sigmas.z}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card bg-base-200">
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between">
                                <span className="font-bold">
                                    Lat / Lon / Height
                                </span>
                                <CopyButton
                                    text={llaText}
                                    iconClassName="size-5"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>Lat: {result.lla.lat}°</div>
                                <div>Lon: {result.lla.lon}°</div>
                                <div>Height: {result.lla.height} m</div>
                            </div>
                        </div>
                    </div>

                    <div className="text-sm text-gray-500 px-1">
                        Source: {result.source}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default QueryCoordinatesModal;
