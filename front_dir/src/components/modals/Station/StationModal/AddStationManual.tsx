import { useEffect, useRef, useState } from "react";

import { Alert, Menu, MenuButton, MenuContent } from "@componentsReact";
import MapModal from "@components/map/MapModalOL";

import { METADATA_STATE } from "@utils/reducerFormStates";

import { FormReducerAction } from "@hooks/useFormReducer";

import { useApi, useAuth, useClickOutside } from "@hooks";

import { postCreateStationService } from "@services";

import { Errors } from "@types";

import { ecef2lla, lla2ecef, showModal } from "@utils";
import { useMetadata } from "@hooks/queries";
import { useQueryClient } from "@tanstack/react-query";

interface StationMetadataProps {
    coordinatesType: "ecef" | "latlon" | "map" | undefined;
    currentPage: number;
    dispatch: (value: FormReducerAction) => void;
    formState: typeof METADATA_STATE;
    msg: { status: number; msg: string; errors?: Errors } | undefined;
    setCoordinatesType: React.Dispatch<
        React.SetStateAction<"ecef" | "latlon" | "map" | undefined>
    >;
    setMsg: React.Dispatch<
        React.SetStateAction<
            | {
                  status: number;
                  msg: string;
                  errors?: Errors;
              }
            | undefined
        >
    >;
    showMenu: { type: string; show: boolean } | undefined;
    setShowMenu: React.Dispatch<
        React.SetStateAction<{ type: string; show: boolean } | undefined>
    >;
}

const AddStationManual = ({
    coordinatesType,
    currentPage,
    dispatch,
    formState,
    msg,
    setCoordinatesType,
    setMsg,
    showMenu,
    setShowMenu,
}: StationMetadataProps) => {
    const { token, logout } = useAuth();

    const api = useApi(token, logout);

    const { networks } = useMetadata(api, { only: ["networks"] });
    const queryClient = useQueryClient();

    const generalFields = [
        "Station Code",
        "Network Code",
        "Domes Number",
        "Max distance",
    ];

    const inputRefNetworkCode = useRef<HTMLInputElement>(null);

    const openMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(
        openMenuRef,
        () => setShowMenu(undefined),
        !!showMenu?.show,
    );

    const [createLoading, setCreateLoading] = useState<boolean>(false);

    const [showMapModal, setShowMapModal] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    // const [currentCoordinates, setCurrentCoordinates] = useState<CoordinatesData | undefined>(undefined)

    const handleDrawPolygon = (e: any) => {
        const layer = e.layer;
        const latlng = layer.getLatLng();
        const latitude = latlng.lat;
        const longitude = latlng.lng;

        dispatch({
            type: "change_value",
            payload: {
                inputName: "station.lat",
                inputValue: parseFloat(latitude.toFixed(8)).toString(),
            },
        });
        dispatch({
            type: "change_value",
            payload: {
                inputName: "station.lon",
                inputValue: parseFloat(longitude.toFixed(8)).toString(),
            },
        });
        dispatch({
            type: "change_value",
            payload: {
                inputName: "station.height",
                inputValue: "0",
            },
        });

        // setShowMapModal(() => ({ type: "edit", show: false, title: "" }));
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const { value, name } = e.target;
        dispatch({
            type: "change_value",
            payload: {
                inputName: name,
                inputValue: value,
            },
        });
    };

    const filtredNC =
        networks?.filter((network) =>
            network.network_code
                .toLowerCase()
                .includes(formState.stationMeta.network_code.toLowerCase()),
        ) || [];

    const createStation = async () => {
        try {
            setCreateLoading(true);
            const params = {
                ...formState.station,
                ...formState.stationMeta,
            };

            if (coordinatesType === "ecef") {
                delete (params as any).lat;
                delete (params as any).lon;
                delete (params as any).height;
            } else if (
                coordinatesType === "latlon" ||
                coordinatesType === "map"
            ) {
                delete (params as any).auto_x;
                delete (params as any).auto_y;
                delete (params as any).auto_z;
                if (formState.station.height === "") {
                    params.height = "0";
                }
            }
            params.network_code =
                formState.stationMeta.network_code.toLowerCase();
            const res = await postCreateStationService<any>(api, params);

            if ("status" in res) {
                setMsg({
                    status: res.statusCode,
                    msg: res.response.type,
                    errors: res.response,
                });
            } else {
                queryClient.invalidateQueries({ queryKey: ["stations"] });
                setMsg({
                    status: res.statusCode,
                    msg: "Station created successfully",
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleSubmit = () => {
        createStation();
    };

    useEffect(() => {
        if (showMenu) {
            const ref = inputRefNetworkCode;
            if (ref && ref.current) {
                ref.current.focus();
            }
        }
    }, [showMenu]);

    useEffect(() => {
        if (
            coordinatesType === "ecef" &&
            formState.station.lat &&
            formState.station.lon
        ) {
            const { x, y, z } = lla2ecef([
                Number(formState.station.lat),
                Number(formState.station.lon),
                Number(formState.station.height ?? 0),
            ]);
            dispatch({
                type: "change_value",
                payload: {
                    inputName: "station.auto_x",
                    inputValue: x.toString(),
                },
            });
            dispatch({
                type: "change_value",
                payload: {
                    inputName: "station.auto_y",
                    inputValue: y.toString(),
                },
            });
            dispatch({
                type: "change_value",
                payload: {
                    inputName: "station.auto_z",
                    inputValue: z.toString(),
                },
            });
        } else if (
            coordinatesType === "latlon" &&
            formState.station.auto_x &&
            formState.station.auto_y
        ) {
            const { lat, lon, alt } = ecef2lla([
                Number(formState.station.auto_x),
                Number(formState.station.auto_y),
                Number(formState.station.auto_z ?? 0),
            ]);
            dispatch({
                type: "change_value",
                payload: {
                    inputName: "station.lat",
                    inputValue: lat.toString(),
                },
            });
            dispatch({
                type: "change_value",
                payload: {
                    inputName: "station.lon",
                    inputValue: lon.toString(),
                },
            });
            dispatch({
                type: "change_value",
                payload: {
                    inputName: "station.height",
                    inputValue: alt.toString(),
                },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coordinatesType]);

    useEffect(() => {
        showMapModal?.show && showModal(showMapModal.title);
    }, [showMapModal]);

    return (
        <div className="w-full">
            <div className="space-y-4">
                <div className={`grid grid-cols-1 space-y-4 grid-flow-dense`}>
                    <div className="card bg-base-200 shadow-xl">
                        <h2 className="card-title border-b-2 border-base-300 p-2 flex flex-row justify-between">
                            General
                        </h2>
                        <div className="card-body">
                            <div className={`grid grid-cols-4 gap-6`}>
                                {currentPage === 1 &&
                                    Object.keys(formState.stationMeta).map(
                                        (key, idx) => {
                                            const keysToNotShow = [
                                                "harpos_coeff_otl",
                                            ];

                                            if (
                                                key &&
                                                !keysToNotShow.includes(key)
                                            ) {
                                                const errorBadge =
                                                    msg?.errors?.errors?.find(
                                                        (error) =>
                                                            error.attr === key,
                                                    );
                                                const maxDistErrorBadge =
                                                    msg?.errors?.errors?.find(
                                                        (error) =>
                                                            error.attr ===
                                                            "max_dist",
                                                    );

                                                return (
                                                    <div key={idx + key}>
                                                        <div
                                                            className="text-sm font-bold flex items-center"
                                                            title={
                                                                generalFields[
                                                                    idx
                                                                ]
                                                            }
                                                        >
                                                            {generalFields[idx]}{" "}
                                                            <div
                                                                className={`size-3  rounded-full ml-3`}
                                                                title={
                                                                    generalFields[
                                                                        idx
                                                                    ]
                                                                }
                                                            ></div>
                                                        </div>
                                                        <div
                                                            className="flex flex-col space-y-1 relative"
                                                            ref={
                                                                showMenu?.show &&
                                                                showMenu.type ===
                                                                    key
                                                                    ? openMenuRef
                                                                    : undefined
                                                            }
                                                        >
                                                            <label
                                                                className={`input input-bordered flex items-center  ${errorBadge || (key === "max_dist" && maxDistErrorBadge) ? "input-error" : ""}  `}
                                                                title={
                                                                    errorBadge
                                                                        ? errorBadge.detail
                                                                        : key ===
                                                                                "max_dist" &&
                                                                            maxDistErrorBadge
                                                                          ? maxDistErrorBadge.detail
                                                                          : ""
                                                                }
                                                            >
                                                                {key ===
                                                                    "network_code" && (
                                                                    <MenuButton
                                                                        setShowMenu={
                                                                            setShowMenu
                                                                        }
                                                                        showMenu={
                                                                            showMenu
                                                                        }
                                                                        typeKey={
                                                                            key
                                                                        }
                                                                    />
                                                                )}
                                                                <input
                                                                    className={
                                                                        "w-full "
                                                                    }
                                                                    autoComplete="off"
                                                                    type="text"
                                                                    ref={
                                                                        key ===
                                                                        "network_code"
                                                                            ? inputRefNetworkCode
                                                                            : null
                                                                    }
                                                                    value={
                                                                        formState
                                                                            .stationMeta[
                                                                            key as keyof typeof formState.stationMeta
                                                                        ] ?? ""
                                                                    }
                                                                    name={
                                                                        "stationMeta." +
                                                                        key
                                                                    }
                                                                    onChange={(
                                                                        e,
                                                                    ) => {
                                                                        handleChange(
                                                                            e,
                                                                        );
                                                                    }}
                                                                    onClick={() => {
                                                                        if (
                                                                            key ===
                                                                            "network_code"
                                                                        ) {
                                                                            setShowMenu(
                                                                                {
                                                                                    type: key,
                                                                                    show: true,
                                                                                },
                                                                            );
                                                                        } else {
                                                                            setShowMenu(
                                                                                undefined,
                                                                            );
                                                                        }
                                                                    }}
                                                                />
                                                                {errorBadge ? (
                                                                    <span className="badge badge-error self-start -mt-2">
                                                                        {
                                                                            errorBadge.code
                                                                        }
                                                                    </span>
                                                                ) : key ===
                                                                      "max_dist" &&
                                                                  maxDistErrorBadge ? (
                                                                    <span className="badge badge-error self-start -mt-2">
                                                                        {
                                                                            maxDistErrorBadge.code
                                                                        }
                                                                    </span>
                                                                ) : null}
                                                            </label>
                                                            {showMenu?.show &&
                                                                showMenu.type ===
                                                                    key &&
                                                                key ===
                                                                    "network_code" && (
                                                                    <div className="absolute w-full z-10 top-full">
                                                                        <Menu>
                                                                            {networks &&
                                                                                (filtredNC.length ===
                                                                                0
                                                                                    ? networks
                                                                                    : filtredNC
                                                                                ).map(
                                                                                    (
                                                                                        mt,
                                                                                    ) => (
                                                                                        <MenuContent
                                                                                            key={
                                                                                                mt.api_id
                                                                                            }
                                                                                            typeKey={
                                                                                                "stationMeta." +
                                                                                                key
                                                                                            }
                                                                                            value={
                                                                                                mt.network_code
                                                                                            }
                                                                                            dispatch={
                                                                                                dispatch
                                                                                            }
                                                                                            setShowMenu={
                                                                                                setShowMenu
                                                                                            }
                                                                                        />
                                                                                    ),
                                                                                )}
                                                                        </Menu>
                                                                    </div>
                                                                )}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        },
                                    )}
                            </div>
                        </div>
                    </div>
                </div>
                {currentPage === 1 && (
                    <div className="grid grid-cols-1 space-x-4 grid-flow-dense">
                        <div className="card bg-base-200 grow shadow-xl">
                            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                                Coordinates
                            </h2>
                            <div className="card-body">
                                <div className="flex gap-2">
                                    <button
                                        className={`btn flex-1 ${coordinatesType === "ecef" ? "btn-primary" : ""}`}
                                        onClick={() =>
                                            setCoordinatesType("ecef")
                                        }
                                    >
                                        ECEF
                                    </button>
                                    <button
                                        className={`btn flex-1 ${coordinatesType === "latlon" ? "btn-primary" : ""}`}
                                        onClick={() =>
                                            setCoordinatesType("latlon")
                                        }
                                    >
                                        Latitude, Longitude, & Height
                                    </button>
                                    <button
                                        className={`btn flex-1 ${coordinatesType === "map" ? "btn-primary" : ""}`}
                                        onClick={() => {
                                            setCoordinatesType("latlon");
                                            setShowMapModal({
                                                show: true,
                                                title: "map",
                                                type: "none",
                                            });
                                        }}
                                    >
                                        Map
                                    </button>
                                </div>
                                {coordinatesType === "ecef" && (
                                    <div className="grid grid-cols-3 gap-4 col-span-2">
                                        {["auto_x", "auto_y", "auto_z"].map(
                                            (key) => (
                                                <div
                                                    key={key}
                                                    className="form-control"
                                                >
                                                    <label className="label">
                                                        <span className="label-text font-medium">
                                                            {key
                                                                .split("_")[1]
                                                                .toUpperCase()}
                                                        </span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        className="input input-bordered w-full"
                                                        value={
                                                            formState.station[
                                                                key as keyof typeof formState.station
                                                            ]
                                                        }
                                                        name={"station." + key}
                                                        onChange={(e) =>
                                                            handleChange(e)
                                                        }
                                                    />
                                                </div>
                                            ),
                                        )}
                                    </div>
                                )}

                                {coordinatesType === "latlon" && (
                                    <div className="grid grid-cols-3 gap-4 col-span-2">
                                        {["lat", "lon", "height"].map((key) => (
                                            <div
                                                key={key}
                                                className="form-control"
                                            >
                                                <label className="label">
                                                    <span className="label-text font-medium">
                                                        {key[0].toUpperCase() +
                                                            key.slice(1)}
                                                    </span>
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.001"
                                                    className="input input-bordered w-full"
                                                    name={"station." + key}
                                                    value={
                                                        formState.station[
                                                            key as keyof typeof formState.station
                                                        ]
                                                    }
                                                    onChange={(e) =>
                                                        handleChange(e)
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="w-full flex flex-col mt-4 items-center justify-center">
                <Alert msg={msg} />
                <div className="flex items-center justify-center space-x-4">
                    <button
                        className="btn btn-success w-[140px] btn-lg mt-4"
                        onClick={handleSubmit}
                        disabled={createLoading || (msg && msg.status === 201)}
                    >
                        <div className="flex items-center justify-center flex-row">
                            {createLoading && (
                                <div
                                    className="inline-block size-6
                                mx-2 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-white motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                    role="status"
                                ></div>
                            )}
                            Create
                        </div>
                    </button>
                </div>
            </div>
            {showMapModal &&
                showMapModal.show &&
                showMapModal.title === "map" && (
                    <MapModal
                        setShowMapModal={setShowMapModal}
                        handleDrawPolygon={handleDrawPolygon}
                        markerType="marker"
                        formState={formState}
                    />
                )}
        </div>
    );
};

export default AddStationManual;
