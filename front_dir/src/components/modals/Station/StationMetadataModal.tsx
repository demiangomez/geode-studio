import { Suspense, useEffect, useMemo, useState } from "react";

import {
    Alert,
    ConfirmDeleteModal,
    CopyButton,
    LargeSkeleton,
    Modal,
    StationAddFileModal,
    FileOrTextField,
} from "@componentsReact";
import QuillText from "@components/map/QuillText";

import { useApi, useAuth, useFormReducer, useWaitCursor } from "@hooks";

import {
    ArrowDownTrayIcon,
    BookOpenIcon,
    PencilSquareIcon,
    PlusCircleIcon,
    TrashIcon,
} from "@heroicons/react/24/outline";

import defPhoto from "@assets/images/placeholder.png";

import {
    delStationsFilesAttachedService,
    getStationFileByIdAttachedService,
    patchStationMetaService,
} from "@services";

import {
    useMetadata,
    useMonumentPhoto,
    useStation,
    useStationFiles,
    useStationInfoLast,
    useStationMeta,
    useStationRinexBounds,
    useTectonicPlateNames,
    useUpdateStation,
    useUpdateStationMeta,
} from "@hooks/queries";

import {
    ApiError,
    classHtml,
    decimalToDMS,
    ecef2lla,
    formattedDates,
    isPreviewableFile,
    lazyRetry,
    lla2ecef,
    showModal,
} from "@utils";

// Lazy: pdf.js (~110KB gz) solo baja al abrir un preview de archivo
const RenderFileModal = lazyRetry(
    () => import("@components/modals/RenderFileModal"),
);

import {
    ErrorResponse,
    Errors,
    StationData,
    StationFilesData,
    StationMetadataServiceData,
} from "@types";

type FieldMsg = { status: number; msg: string; errors?: Errors } | undefined;

const mutationMsg = (
    mutation: { isError: boolean; isSuccess: boolean; error: unknown },
    successMsg: string,
): FieldMsg => {
    if (mutation.isError) {
        const err = mutation.error;
        return err instanceof ApiError
            ? { status: err.statusCode, msg: err.message, errors: err.response }
            : { status: 400, msg: "Request failed" };
    }
    if (mutation.isSuccess) {
        return { status: 200, msg: successMsg };
    }
    return undefined;
};

// espera a que los dos mensajes esten definidos: si uno todavia esta en
// vuelo (undefined), no hay veredicto que combinar todavia
const combineUpdateMessages = (
    metaMsg: FieldMsg,
    stationMsg: FieldMsg,
): FieldMsg => {
    if (!metaMsg || !stationMsg) return undefined;

    const metaOk = metaMsg.status === 200;
    const stationOk = stationMsg.status === 200;

    if (metaOk && stationOk) {
        return {
            status: 200,
            msg: "Metadata and station updated successfully",
        };
    }

    if (metaOk || stationOk) {
        const failed = metaOk ? stationMsg : metaMsg;
        return {
            status: failed.status,
            msg: `${metaOk ? "Station" : "Metadata"} update failed (the other half was saved): ${failed.msg}`,
            errors: failed.errors,
        };
    }

    return {
        status: metaMsg.status,
        msg: [metaMsg.msg, stationMsg.msg].filter(Boolean).join(" / "),
        errors: metaMsg.errors ?? stationMsg.errors,
    };
};

interface GeneralFieldDescriptor {
    key: string;
    slice: "meta" | "station";
    label: string;
    kind?: "select" | "link";
    emptyText?: string;
}

// harpos_coeff_otl vive en formState.station pero tiene su propia card
// (Ocean Tide Loading Model) y no se lista aca
const GENERAL_FIELDS: GeneralFieldDescriptor[] = [
    {
        key: "station_type",
        slice: "meta",
        label: "Station Type",
        kind: "select",
    },
    {
        key: "monument_type",
        slice: "meta",
        label: "Monument",
        kind: "select",
    },
    { key: "status", slice: "meta", label: "Status", kind: "select" },
    {
        key: "remote_access_link",
        slice: "meta",
        label: "Remote Access Link",
        kind: "link",
    },
    { key: "station_name", slice: "station", label: "Station Name" },
    { key: "dome", slice: "station", label: "Domes Number" },
    { key: "max_dist", slice: "station", label: "Max distance" },
    {
        key: "plate",
        slice: "station",
        label: "Tectonic Plate",
        kind: "select",
        emptyText: "Auto-detected from coordinates",
    },
];

interface BooleanFieldDescriptor {
    key: "has_battery" | "has_communications";
    descKey: "battery_description" | "communications_description";
    label: string;
}

const BOOLEAN_FIELDS: BooleanFieldDescriptor[] = [
    { key: "has_battery", descKey: "battery_description", label: "Battery" },
    {
        key: "has_communications",
        descKey: "communications_description",
        label: "Communications",
    },
];

interface StationMetadataProps {
    close: boolean;
    size?: "sm" | "md" | "lg" | "xl" | "fit";
    station?: StationData | undefined;
    setModalState: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    // refresca Station.tsx; pasarle los datos ya frescos evita que el padre
    // los vuelva a pedir por su cuenta
    refetch: (
        freshStation?: StationData,
        freshStationMeta?: StationMetadataServiceData,
    ) => void;
}

const StationMetadataModal = ({
    close,
    station,
    size,
    refetch,
    setModalState,
}: StationMetadataProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [oceanTideType, setOceanTideType] = useState<
        "by file" | "manual" | undefined
    >(undefined);

    const metaMutation = useUpdateStationMeta(api);
    const stationMutation = useUpdateStation(api);

    // por-recurso: alimentan los badges de error de cada campo (cada uno
    // viaja en un PATCH distinto, ver el mapeo de campos en updateMetadata)
    const metaMsg = mutationMsg(metaMutation, "Metadata updated successfully");
    const stationMsg = mutationMsg(
        stationMutation,
        "Station updated successfully",
    );

    // combinado: lo que ve el usuario en el Alert de arriba
    const updateMsg = combineUpdateMessages(metaMsg, stationMsg);

    const updateLoading = metaMutation.isPending || stationMutation.isPending;

    const [fileMsg, setFileMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);
    const [loadFile, setLoadFile] = useState<boolean>(false);

    const [oceanTideFile, setOceanTideFile] = useState<File | undefined>(
        undefined,
    );

    useWaitCursor(loadFile);

    const [edit, setEdit] = useState<boolean>(false);

    const [fileToEdit, setFileToEdit] = useState<
        StationFilesData | undefined
    >();

    // null = "sin tocar": el Quill sigue el ultimo valor fetcheado de
    // stationMeta.comments; al tipear pasa a "controlado por el usuario"
    const [richTextDraft, setRichTextDraft] = useState<string | null>(null);

    const [fileType, setFileType] = useState<"meta" | "none">("none");

    const [fileToDel, setFileToDel] = useState<number | undefined>(undefined);

    const [fileToShow, setFileToShow] = useState<StationFilesData | undefined>(
        undefined,
    );

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [showAllFiles, setShowAllFiles] = useState<boolean>(false);

    const handleShowMore = () => {
        setShowAllFiles(true);
    };

    const handleShowLess = () => {
        setShowAllFiles(false);
    };

    const {
        data: stationData,
        isLoading: isStationLoading,
        refetch: refetchStation,
    } = useStation(api, {
        network_code: station?.network_code,
        station_code: station?.station_code,
    });

    const {
        data: stationMeta,
        isLoading: isStationMetaLoading,
        refetch: refetchStationMeta,
    } = useStationMeta(api, station?.api_id);

    const { types: stationType, statuses: stationStatus } = useMetadata(api, {
        enabled: !!station?.api_id,
        only: ["types", "statuses"],
    });

    const { monuments: monumentsType } = useMetadata(
        api,
        { enabled: !!station?.api_id, only: ["monuments"] },
        { only_metadata: true },
    );

    const { data: tectonicPlates } = useTectonicPlateNames(api);

    const { data: rinexBounds, isLoading: isRinexLoading } =
        useStationRinexBounds(api, {
            network_code: station?.network_code,
            station_code: station?.station_code,
        });
    const firstRinex = rinexBounds?.firstRinex;
    const lastRinex = rinexBounds?.lastRinex;

    const { data: stationInfo } = useStationInfoLast(api, {
        network_code: station?.network_code,
        station_code: station?.station_code,
    });

    const stationId = stationMeta?.station ?? undefined;

    const { data: files, refetch: refetchFiles } = useStationFiles(
        api,
        stationId,
    );

    const getFileById = async (id: number) => {
        try {
            setLoadFile(true);
            if (stationId) {
                const res =
                    await getStationFileByIdAttachedService<StationFilesData>(
                        api,
                        id,
                    );
                return res;
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadFile(false);
        }
    };

    const delFile = async (id: number | undefined) => {
        try {
            setDeleteLoading(true);
            if (stationId && typeof id === "number") {
                const res =
                    await delStationsFilesAttachedService<ErrorResponse>(
                        api,
                        id,
                    );

                if ("status" in res && res.status !== "success") {
                    setFileMsg({
                        status: res.statusCode,
                        msg: res.response.type,
                        errors: res.response,
                    });
                } else {
                    setFileMsg({
                        status: res.statusCode,
                        msg: "File deleted successfully",
                    });
                    refetchFiles();
                }
            } else {
                setFileMsg({
                    status: 400,
                    msg: "File not found",
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDeleteLoading(false);
        }
    };

    const delFileMeta = async () => {
        try {
            setDeleteLoading(true);
            if (stationId) {
                const formData = new FormData();

                formData.append("navigation_file_delete", "true");
                formData.append("station", String(stationId));

                const res = await patchStationMetaService<
                    StationFilesData | ErrorResponse
                >(api, Number(stationId), formData);
                if (res.statusCode !== 200 && "status" in res) {
                    setFileMsg({
                        status: res.statusCode,
                        msg: res.response.type,
                        errors: res.response,
                    });
                } else if (res.statusCode === 200) {
                    setFileMsg({
                        status: res.statusCode,
                        msg: "File deleted successfully",
                    });
                    refetchStationMeta();
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDeleteLoading(false);
        }
    };

    const loading = isStationLoading || isStationMetaLoading || isRinexLoading;

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    useEffect(() => {
        if (fileToShow !== undefined) {
            setModals({
                show: true,
                title: "FileRender",
                type: "edit",
            });
        }
    }, [fileToShow]);

    const formattedData = useMemo(() => {
        return {
            equipment: {
                antenna_code: stationInfo?.antenna_code ?? "",
                antenna_serial: stationInfo?.antenna_serial ?? "",
                height_code: stationInfo?.height_code ?? "",
                receiver_code: stationInfo?.receiver_code ?? "",
                receiver_serial: stationInfo?.receiver_serial ?? "",
                receiver_version: stationInfo?.receiver_vers ?? "",
                radome_code: stationInfo?.radome_code ?? "",
            },
            rinex: {
                first_rinex: firstRinex?.observation_e_time ?? "",
                last_rinex: lastRinex?.observation_e_time ?? "",
                navigation_file: stationMeta?.navigation_filename ?? "",
            },
            // 1:1 con lo que manda el PATCH de station-meta (updateMetadata)
            meta: {
                station_type:
                    stationType?.find(
                        (st) => st.id === Number(stationMeta?.station_type),
                    )?.name ?? "",
                monument_type:
                    monumentsType?.find(
                        (mt) => mt.id === Number(stationMeta?.monument_type),
                    )?.name ?? "",
                status:
                    stationStatus?.find(
                        (st) => st.id === Number(stationMeta?.status),
                    )?.name ?? "",
                remote_access_link: stationMeta?.remote_access_link ?? "",
                has_battery: stationMeta?.has_battery ?? false,
                has_communications: stationMeta?.has_communications ?? false,
                battery_description: stationMeta?.battery_description ?? "",
                communications_description:
                    stationMeta?.communications_description ?? "",
            },
            // 1:1 con lo que manda el PATCH de station (updateMetadata)
            station: {
                lat: String(Number(stationData?.lat).toFixed(8)) ?? "",
                lon: String(Number(stationData?.lon).toFixed(8)) ?? "",
                height: String(Number(stationData?.height).toFixed(3)) ?? "",
                auto_x: String(Number(stationData?.auto_x).toFixed(3)) ?? "",
                auto_y: String(Number(stationData?.auto_y).toFixed(3)) ?? "",
                auto_z: String(Number(stationData?.auto_z).toFixed(3)) ?? "",
                station_name: stationData?.station_name ?? "",
                dome: stationData?.dome ?? "",
                harpos_coeff_otl: stationData?.harpos_coeff_otl ?? "",
                max_dist: String(stationData?.max_dist ?? ""),
                plate: stationData?.plate ?? "",
            },
        };
    }, [
        stationType,
        monumentsType,
        stationStatus,
        stationData,
        stationMeta,
        firstRinex,
        lastRinex,
        stationInfo,
    ]);

    const { formState, dispatch } = useFormReducer(formattedData);

    // se resetea junto con el resto del form: al montar y despues de cada
    // refetch exitoso (incluido el post-guardado), nunca por el mero
    // toggle de edit (igual que el resto de los campos)
    const comments = stationMeta?.comments ?? "";
    const richText = richTextDraft ?? comments;

    useEffect(() => {
        dispatch({
            type: "set",
            payload: formattedData,
        });
        setRichTextDraft(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formattedData]);

    const selectOptions = useMemo<
        Record<string, { value: string; label: string }[]>
    >(() => {
        const byName = (item: { name: string }) => ({
            value: item.name,
            label: item.name,
        });

        const plateOptions = (tectonicPlates ?? []).map((plate) => ({
            value: plate.code,
            label: `${plate.name} (${plate.code})`,
        }));

        // el código guardado puede no estar en el catálogo todavía (o nunca, si
        // geode cambió de dataset): lo agregamos para no perder el valor actual
        const currentPlate = formState.station.plate;
        if (
            currentPlate &&
            !plateOptions.some((option) => option.value === currentPlate)
        ) {
            plateOptions.unshift({ value: currentPlate, label: currentPlate });
        }

        return {
            station_type: (stationType ?? []).map(byName),
            monument_type: (monumentsType ?? []).map(byName),
            status: (stationStatus ?? []).map(byName),
            plate: plateOptions,
        };
    }, [
        stationType,
        monumentsType,
        stationStatus,
        tectonicPlates,
        formState.station.plate,
    ]);

    // foto del monumento actualmente relevante: el elegido en el form mientras
    // se edita, o el guardado en stationMeta el resto del tiempo
    const activeMonumentTypeId = edit
        ? monumentsType?.find((mt) => mt.name === formState.meta.monument_type)
              ?.id
        : Number(stationMeta?.monument_type) || undefined;

    const { data: chosenMonumentPhoto } = useMonumentPhoto(
        api,
        activeMonumentTypeId,
    );

    const handleChange = (
        e:
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
            | { target: { name: string; value: string } },
    ) => {
        const { value, name } = e.target;
        dispatch({
            type: "change_value",
            payload: {
                inputName: name,
                inputValue: value,
            },
        });

        //Conversion de lat, lon, heigth a x,y,z
        if (
            name === "station.lat" ||
            name === "station.lon" ||
            name === "station.height"
        ) {
            let lat =
                formState.station.lat === ""
                    ? NaN
                    : Number(formState.station.lat);
            let lon =
                formState.station.lon === ""
                    ? NaN
                    : Number(formState.station.lon);
            let height =
                formState.station.height === ""
                    ? NaN
                    : Number(formState.station.height);

            //Si alguno es vacio setealo con Nan
            switch (name) {
                case "station.lat":
                    lat = value !== "" ? Number(value) : NaN;
                    break;
                case "station.lon":
                    lon = value !== "" ? Number(value) : NaN;
                    break;
                case "station.height":
                    height = value !== "" ? Number(value) : NaN;
                    break;
            }

            const { x, y, z } = lla2ecef([lat, lon, height]);
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
        }

        //Conversion de x,y,z a lat, lon, heigth
        if (
            name === "station.auto_x" ||
            name === "station.auto_y" ||
            name === "station.auto_z"
        ) {
            let x =
                formState.station.auto_x === ""
                    ? NaN
                    : Number(formState.station.auto_x);
            let y =
                formState.station.auto_y === ""
                    ? NaN
                    : Number(formState.station.auto_y);
            let z =
                formState.station.auto_z === ""
                    ? NaN
                    : Number(formState.station.auto_z);

            //Si alguno es vacio setealo con Nan
            switch (name) {
                case "station.auto_x":
                    x = value !== "" ? Number(value) : NaN;
                    break;
                case "station.auto_y":
                    y = value !== "" ? Number(value) : NaN;
                    break;
                case "station.auto_z":
                    z = value !== "" ? Number(value) : NaN;
                    break;
            }

            const { lat, lon, alt } = ecef2lla([x, y, z]);
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
    };

    const updateMetadata = async () => {
        if (!station || !stationMeta) return;

        const updatedRichText = classHtml(richText);

        // formState.meta/.station ya tienen la forma de cada PATCH (ver
        // formattedData); solo se pisan los campos que necesitan transformarse
        const meta = {
            ...formState.meta,
            comments: updatedRichText,
            station_type: stationType?.find(
                (st) => st.name === formState.meta.station_type,
            )?.id,
            monument_type: monumentsType?.find(
                (mt) => mt.name === formState.meta.monument_type,
            )?.id,
            status: stationStatus?.find(
                (st) => st.name === formState.meta.status,
            )?.id,
            navigation_file_delete: false,
            station: stationId,
        };

        const stationParams: Record<string, unknown> = {
            ...formState.station,
            harpos_coeff_otl_by_file: oceanTideFile,
        };

        if (oceanTideType === "by file") {
            delete stationParams.harpos_coeff_otl;
        } else if (oceanTideType === "manual") {
            delete stationParams.harpos_coeff_otl_by_file;
        }

        const [metaResult, stationResult] = await Promise.allSettled([
            metaMutation.mutateAsync({
                id: Number(station?.api_id),
                data: meta,
            }),
            stationMutation.mutateAsync({
                id: Number(station?.api_id),
                data: stationParams,
            }),
        ]);

        const metaWritten = metaResult.status === "fulfilled";
        const stationWritten = stationResult.status === "fulfilled";

        const [metaRefetchResult, stationRefetchResult] = await Promise.all([
            metaWritten ? refetchStationMeta() : Promise.resolve(undefined),
            stationWritten ? refetchStation() : Promise.resolve(undefined),
        ]);

        // le paso los datos ya frescos al padre para que no los vuelva a pedir
        if (metaWritten || stationWritten) {
            refetch(stationRefetchResult?.data, metaRefetchResult?.data);
        }

        // se queda en modo edicion: el usuario tiene que poder ver el
        // mensaje de exito/error, no que se lo saquen de encima solo
    };
    const generalFields3 = ["First rinex", "Last rinex", "Navigation File"];
    const equipmentFields = [
        "Antenna Code",
        "Antenna Serial",
        "Height Code",
        "Receiver Code",
        "Receiver Serial",
        "Receiver Version",
        "Radome Code",
    ];

    const renderGeneralField = ({
        key,
        slice,
        label,
        kind,
        emptyText,
    }: GeneralFieldDescriptor) => {
        // meta y station viajan en PATCHs distintos, cada uno con sus propios
        // errores (ver el mapeo de campos en updateMetadata)
        const errorBadge =
            metaMsg?.errors?.errors?.find((error) => error.attr === key) ??
            stationMsg?.errors?.errors?.find((error) => error.attr === key);
        const value = (formState[slice] as Record<string, string>)[key] ?? "";
        const name = `${slice}.${key}`;
        // en modo lectura mostramos el label del catalogo (p.ej. "South
        // America (SA)"), no el valor crudo que viaja en el PATCH ("SA")
        const displayValue =
            kind === "select"
                ? ((selectOptions[key] ?? []).find(
                      (option) => option.value === value,
                  )?.label ?? value)
                : value;

        return (
            <div key={key}>
                <div
                    className="text-sm font-bold flex items-center"
                    title={label}
                >
                    {label}
                </div>
                {edit ? (
                    <div className="flex flex-col space-y-1">
                        <label
                            className={`input input-bordered flex items-center ${errorBadge ? "input-error" : ""}`}
                            title={errorBadge ? errorBadge.detail : ""}
                            style={kind === "select" ? { padding: "0" } : {}}
                        >
                            {kind === "select" ? (
                                <select
                                    className="select select-ghost w-full focus:outline-none focus:border-transparent focus:ring-0 focus:scale-95"
                                    name={name}
                                    value={value}
                                    style={{
                                        fontSize: "16px",
                                        textOverflow: "ellipsis",
                                        overflow: "hidden",
                                        whiteSpace: "nowrap",
                                    }}
                                    onChange={(e) => {
                                        dispatch({
                                            type: "change_value",
                                            payload: {
                                                inputName: e.target.name,
                                                inputValue: e.target.value,
                                            },
                                        });
                                    }}
                                >
                                    {emptyText ? (
                                        <option value="">{emptyText}</option>
                                    ) : (
                                        <option value="" disabled>
                                            Select a {key.replace("_", " ")}
                                        </option>
                                    )}
                                    {(selectOptions[key] ?? []).map(
                                        (option) => (
                                            <option
                                                className="truncate"
                                                key={option.value}
                                                value={option.value}
                                                title={option.label}
                                            >
                                                {option.label.length > 30
                                                    ? option.label.slice(
                                                          0,
                                                          30,
                                                      ) + "..."
                                                    : option.label}
                                            </option>
                                        ),
                                    )}
                                </select>
                            ) : (
                                <input
                                    className="w-full"
                                    autoComplete="off"
                                    type="text"
                                    value={value}
                                    name={name}
                                    onChange={(e) => handleChange(e)}
                                />
                            )}
                            {errorBadge && (
                                <span className="badge badge-error self-start -mt-2">
                                    {errorBadge.code}
                                </span>
                            )}
                        </label>
                    </div>
                ) : kind === "link" ? (
                    value ? (
                        <a
                            target="_blank"
                            className="link link-hover break-words"
                            href={value}
                        >
                            {value}
                        </a>
                    ) : (
                        <span className="text-gray-400">No info</span>
                    )
                ) : (
                    <p className="break-words whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                        {displayValue !== "" ? (
                            displayValue
                        ) : (
                            <span className="text-gray-400">
                                {emptyText ?? "No info"}
                            </span>
                        )}
                    </p>
                )}
            </div>
        );
    };

    const renderBooleanField = ({
        key,
        descKey,
        label,
    }: BooleanFieldDescriptor) => {
        const value = formState.meta[key];
        const errorBadge = metaMsg?.errors?.errors?.find(
            (error) => error.attr === descKey,
        );

        return (
            <div key={key}>
                <div className="text-sm font-bold flex items-center">
                    {label}
                    {edit ? (
                        <input
                            type="checkbox"
                            className="toggle ml-2"
                            style={{
                                borderRadius: "50px",
                                color: value
                                    ? "rgb(21 128 61)"
                                    : "rgb(185 28 28)",
                            }}
                            onChange={(e) => {
                                dispatch({
                                    type: "change_value",
                                    payload: {
                                        inputName: `meta.${key}`,
                                        inputValue: e.target.checked,
                                    },
                                });
                            }}
                            checked={value}
                        />
                    ) : (
                        <div
                            className={`size-3 ${value ? "bg-green-500" : "bg-red-500"} rounded-full ml-3`}
                            title={label}
                        ></div>
                    )}
                </div>

                {edit ? (
                    <div className="flex flex-col space-y-1">
                        <label
                            className={`input input-bordered ${errorBadge ? "input-error" : ""} flex items-center`}
                        >
                            <input
                                className="w-full"
                                autoComplete="off"
                                type="text"
                                value={formState.meta[descKey]}
                                name={`meta.${descKey}`}
                                onChange={(e) => handleChange(e)}
                            />
                        </label>
                        {errorBadge && (
                            <span className="badge badge-error self-end">
                                {errorBadge.code}
                            </span>
                        )}
                    </div>
                ) : (
                    <p className="break-words">
                        {formState.meta[descKey] !== "" ? (
                            formState.meta[descKey]
                        ) : (
                            <span className="text-gray-400">
                                No Description
                            </span>
                        )}
                    </p>
                )}
            </div>
        );
    };

    const handleGetFile = async (file: StationFilesData) => {
        const res = await getFileById(file.id);
        if (res) {
            const link = document.createElement("a");

            link.href = `data:application/octet-stream;base64,${res.actual_file}`;
            link.download = res.filename;
            link.click();
        }
    };

    const setEditFile = (file: StationFilesData) => {
        setModals({ show: true, title: "AddFile", type: "edit" });
        setFileToEdit(file);
    };

    // harpos_coeff_otl viaja en el PATCH de station, no en el de meta
    const otlErrorBadge = stationMsg?.errors?.errors?.find(
        (error) => error.attr === "harpos_coeff_otl",
    );

    return (
        <Modal
            close={close}
            modalId={"Metadata"}
            size={size}
            setModalState={setModalState}
        >
            <div className="w-full inline-flex">
                <h3 className="font-bold text-center text-3xl my-2 grow">
                    Metadata
                </h3>
                <button
                    className="flex items-center btn btn-ghost btn-circle"
                    onClick={() => {
                        setEdit(!edit);
                        // sin esto, el mensaje de exito/error del guardado
                        // anterior reaparecia al volver a entrar en modo
                        // edicion sin haber tocado nada nuevo
                        metaMutation.reset();
                        stationMutation.reset();
                    }}
                >
                    <PencilSquareIcon title="edit" className="size-8" />
                </button>
            </div>
            {loading ? (
                <LargeSkeleton />
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 space-y-4 grid-flow-dense">
                        <div className="card bg-base-200 grow shadow-xl mr-4">
                            <h2 className="card-title border-b-2 border-base-300 p-2">
                                General
                            </h2>

                            <div className="card-body">
                                <div className="grid grid-cols-2 gap-6">
                                    {GENERAL_FIELDS.map(renderGeneralField)}
                                    {BOOLEAN_FIELDS.map(renderBooleanField)}
                                    {Object.entries(formState.rinex).map(
                                        ([key, value], idx) => {
                                            if (key !== "navigation_file") {
                                                return (
                                                    <div key={key}>
                                                        <div className="text-sm font-bold flex items-center">
                                                            {
                                                                generalFields3[
                                                                    idx
                                                                ]
                                                            }
                                                        </div>

                                                        <p className="break-words">
                                                            {value ? (
                                                                formattedDates(
                                                                    new Date(
                                                                        value,
                                                                    ),
                                                                )
                                                            ) : (
                                                                <span className="text-gray-400">
                                                                    No date
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                );
                                            } else {
                                                // TODO: HANDLEAR EL APPLICATION, ESTA PUESTO SOLO PDF. XQ NOSE
                                                return (
                                                    <div key={key}>
                                                        <div className="text-sm font-bold flex items-center justify-between">
                                                            Navigation File
                                                            {edit && (
                                                                <button
                                                                    className="btn btn-ghost btn-circle ml-2 -mt-2"
                                                                    onClick={() => {
                                                                        setModals(
                                                                            {
                                                                                show: true,
                                                                                title: "AddFile",
                                                                                type: "add",
                                                                            },
                                                                        );
                                                                        setFileType(
                                                                            "meta",
                                                                        );
                                                                    }}
                                                                    disabled={
                                                                        formState
                                                                            .rinex
                                                                            .navigation_file !==
                                                                        ""
                                                                    }
                                                                >
                                                                    <PlusCircleIcon
                                                                        strokeWidth={
                                                                            1.5
                                                                        }
                                                                        stroke="currentColor"
                                                                        className="size-6"
                                                                    />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {edit ? (
                                                            <div className="flex flex-col space-y-1">
                                                                <div className="bg-neutral-content p-4 rounded-md flex-grow flex items-center">
                                                                    {formState
                                                                        .rinex[
                                                                        key as keyof typeof formState.rinex
                                                                    ] && (
                                                                        <button
                                                                            className="btn btn-ghost btn-circle mr-4"
                                                                            onClick={() => {
                                                                                setModals(
                                                                                    {
                                                                                        show: true,
                                                                                        title: "ConfirmDelete",
                                                                                        type: "edit",
                                                                                    },
                                                                                );
                                                                                setFileType(
                                                                                    "meta",
                                                                                );
                                                                            }}
                                                                        >
                                                                            <TrashIcon className="size-6 text-red-600" />
                                                                        </button>
                                                                    )}
                                                                    <p className="break-words">
                                                                        {formState
                                                                            .rinex[
                                                                            key as keyof typeof formState.rinex
                                                                        ] ? (
                                                                            formState
                                                                                .rinex[
                                                                                key as keyof typeof formState.rinex
                                                                            ]
                                                                        ) : (
                                                                            <span className="text-gray-400">
                                                                                No
                                                                                info
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    {formState
                                                                        .rinex[
                                                                        key as keyof typeof formState.rinex
                                                                    ] && (
                                                                        <a
                                                                            className="btn-circle btn-ghost flex justify-center w-4/12"
                                                                            download={
                                                                                formState
                                                                                    .rinex
                                                                                    .navigation_file
                                                                            }
                                                                            href={`data:application/octet-stream;base64,${stationMeta?.navigation_actual_file}`}
                                                                        >
                                                                            <ArrowDownTrayIcon className="size-6 self-center" />
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <p className="break-words">
                                                                {formState
                                                                    .rinex[
                                                                    key as keyof typeof formState.rinex
                                                                ] &&
                                                                formState.rinex[
                                                                    key as keyof typeof formState.rinex
                                                                ] !== "" ? (
                                                                    formState
                                                                        .rinex[
                                                                        key as keyof typeof formState.rinex
                                                                    ]
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        No info
                                                                    </span>
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        },
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-center">
                            <h3 className="font-bold text-xl my-2">
                                Monument Photo
                            </h3>
                            <img
                                className="size-96 object-contain"
                                src={
                                    chosenMonumentPhoto
                                        ? "data:image/png;base64," +
                                          chosenMonumentPhoto
                                        : defPhoto
                                }
                                alt={
                                    monumentsType?.find(
                                        (mt) =>
                                            mt.id ===
                                            Number(stationMeta?.monument_type),
                                    )?.name
                                }
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 space-y-4 grid-flow-dense">
                        <div className="card bg-base-200 grow shadow-xl">
                            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                                Comments
                            </h2>
                            <div className="max-h-48 h-auto">
                                {edit ? (
                                    <QuillText
                                        value={richText}
                                        setValue={setRichTextDraft}
                                        clase="h-48 pb-12"
                                    />
                                ) : comments ? (
                                    <div
                                        className="textarea-bordered rounded-md overflow-auto p-4 max-h-48"
                                        dangerouslySetInnerHTML={{
                                            __html: comments,
                                        }}
                                    />
                                ) : (
                                    <div className="text-center text-neutral text-2xl font-bold w-full rounded-md bg-neutral-content p-6">
                                        There are no comments registered
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 space-x-4 grid-flow-dense">
                        <div className="card bg-base-200 grow shadow-xl">
                            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between relative">
                                Attached Files
                                {edit && (
                                    <button
                                        className="btn btn-ghost btn-circle ml-2 absolute right-3"
                                        onClick={() => {
                                            setModals({
                                                show: true,
                                                title: "AddFile",
                                                type: "add",
                                            });
                                        }}
                                    >
                                        <PlusCircleIcon
                                            strokeWidth={1.5}
                                            stroke="currentColor"
                                            className="w-8 h-10"
                                        />
                                    </button>
                                )}
                            </h2>
                            <div
                                className={`card-body ${showAllFiles ? "overflow-y-auto max-h-44 scrollbar-base" : ""}`}
                            >
                                <div
                                    className={`grid ${files && files.length > 0 ? "grid-cols-2 md:grid-cols-2" : "grid-cols-1"} grid-flow-dense gap-2`}
                                >
                                    {files && files.length > 0 ? (
                                        files
                                            .slice(
                                                0,
                                                showAllFiles ? files.length : 2,
                                            )
                                            .map((file) => {
                                                return (
                                                    <div
                                                        className="flex items-center w-full rounded-md bg-neutral-content"
                                                        key={
                                                            file.filename +
                                                            file.id
                                                        }
                                                    >
                                                        <div className="flex-grow overflow-hidden ">
                                                            <div className="p-6 flex w-full justify-between items-center">
                                                                {edit && (
                                                                    <button
                                                                        className="btn btn-ghost btn-circle mr-4"
                                                                        onClick={() => {
                                                                            setModals(
                                                                                {
                                                                                    show: true,
                                                                                    title: "ConfirmDelete",
                                                                                    type: "edit",
                                                                                },
                                                                            );
                                                                            setFileToDel(
                                                                                file.id,
                                                                            );
                                                                        }}
                                                                    >
                                                                        <TrashIcon className="size-8 text-red-600" />
                                                                    </button>
                                                                )}
                                                                <div className="flex flex-col w-8/12 text-wrap truncate max-w-full">
                                                                    <h2
                                                                        className="font-semibold text-xl mb-2 truncate"
                                                                        title={
                                                                            file.filename
                                                                        }
                                                                    >
                                                                        {
                                                                            file.filename
                                                                        }
                                                                    </h2>
                                                                    <p
                                                                        className="truncate"
                                                                        title={
                                                                            file.description
                                                                        }
                                                                    >
                                                                        {
                                                                            file.description
                                                                        }
                                                                    </p>
                                                                </div>
                                                                <a
                                                                    className="btn-circle btn-ghost cursor-pointer flex justify-center w-4/12"
                                                                    onClick={async () => {
                                                                        edit
                                                                            ? setEditFile(
                                                                                  file,
                                                                              )
                                                                            : isPreviewableFile(
                                                                                    file.filename,
                                                                                )
                                                                              ? setFileToShow(
                                                                                    await getFileById(
                                                                                        file.id,
                                                                                    ),
                                                                                )
                                                                              : handleGetFile(
                                                                                    file,
                                                                                );
                                                                    }}
                                                                >
                                                                    {edit ? (
                                                                        <svg
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            fill="none"
                                                                            viewBox="0 0 24 24"
                                                                            strokeWidth={
                                                                                1.5
                                                                            }
                                                                            stroke="currentColor"
                                                                            className="size-6 self-center"
                                                                        >
                                                                            <path
                                                                                strokeLinecap="round"
                                                                                strokeLinejoin="round"
                                                                                d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
                                                                            />
                                                                        </svg>
                                                                    ) : isPreviewableFile(
                                                                          file.filename,
                                                                      ) ? (
                                                                        <BookOpenIcon className="size-6 self-center" />
                                                                    ) : (
                                                                        <ArrowDownTrayIcon className="size-6 self-center" />
                                                                    )}
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    ) : (
                                        <div className="text-center text-neutral text-2xl font-bold w-full rounded-md bg-neutral-content p-6">
                                            There are no files registered
                                        </div>
                                    )}
                                </div>
                            </div>
                            {files && files.length > 2 && (
                                <div className="text-center my-4 font-bold">
                                    {!showAllFiles ? (
                                        <button onClick={handleShowMore}>
                                            Show More
                                        </button>
                                    ) : (
                                        <button onClick={handleShowLess}>
                                            Show Less
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <FileOrTextField
                            title="Ocean Tide Loading Model"
                            value={formState.station.harpos_coeff_otl ?? ""}
                            onChange={(value) =>
                                handleChange({
                                    target: {
                                        name: "station.harpos_coeff_otl",
                                        value,
                                    },
                                })
                            }
                            mode={oceanTideType}
                            onModeChange={setOceanTideType}
                            file={oceanTideFile}
                            setFile={setOceanTideFile}
                            error={otlErrorBadge?.code}
                            readOnly={!edit}
                            emptyText="There is no ocean tide loading model"
                        />
                    </div>
                    <div className="grid grid-cols-2 space-x-4 grid-flow-dense">
                        <div className="card bg-base-200 grow shadow-xl">
                            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                                Geodetic Coordinates
                                <CopyButton
                                    text={`LATITUDE: ${formState.station.lat},LONGITUDE: ${formState.station.lon},HEIGHT: ${formState.station.height}`}
                                    className="mr-2"
                                    iconClassName="size-6"
                                />
                            </h2>
                            <div className="card-body">
                                <div className="grid grid-cols-3 gap-2">
                                    {["lat", "lon", "height"].map(
                                        (key, idx) => {
                                            if (key) {
                                                const latLon = ["lat", "lon"];

                                                const errorBadge =
                                                    stationMsg?.errors?.errors?.find(
                                                        (error) =>
                                                            error.attr === key,
                                                    );

                                                return (
                                                    <div
                                                        key={`geodetic-${key}-${idx}`}
                                                    >
                                                        <div className="text-sm font-bold flex items-center">
                                                            {key === "lat"
                                                                ? "Latitude"
                                                                : key === "lon"
                                                                  ? "Longitude"
                                                                  : "Height"}
                                                        </div>
                                                        {edit ? (
                                                            <div className="flex flex-col space-y-1">
                                                                <label
                                                                    className={`input input-bordered ${errorBadge ? "input-error" : ""} flex items-center`}
                                                                    title={
                                                                        errorBadge
                                                                            ? errorBadge.detail
                                                                            : ""
                                                                    }
                                                                >
                                                                    <input
                                                                        className="w-full"
                                                                        autoComplete="off"
                                                                        type="text"
                                                                        value={
                                                                            formState
                                                                                .station[
                                                                                key as keyof typeof formState.station
                                                                            ] ??
                                                                            ""
                                                                        }
                                                                        title={
                                                                            errorBadge
                                                                                ? errorBadge.detail
                                                                                : ""
                                                                        }
                                                                        name={
                                                                            "station." +
                                                                            key
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            handleChange(
                                                                                e,
                                                                            )
                                                                        }
                                                                    />
                                                                </label>
                                                                {errorBadge && (
                                                                    <span className="badge badge-error self-end">
                                                                        {
                                                                            errorBadge.code
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="break-all">
                                                                {formState
                                                                    .station[
                                                                    key as keyof typeof formState.station
                                                                ] ? (
                                                                    latLon.includes(
                                                                        key,
                                                                    ) ? (
                                                                        decimalToDMS(
                                                                            Number(
                                                                                formState
                                                                                    .station[
                                                                                    key as keyof typeof formState.station
                                                                                ],
                                                                            ),
                                                                            key ===
                                                                                "lat",
                                                                        )
                                                                    ) : (
                                                                        Number(
                                                                            formState
                                                                                .station[
                                                                                key as keyof typeof formState.station
                                                                            ],
                                                                        ) + " m"
                                                                    )
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        No {key}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        },
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="card bg-base-200 grow shadow-xl">
                            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                                Cartesian Coordinates
                                <CopyButton
                                    text={`X: ${formState.station.auto_x},Y: ${formState.station.auto_y},Z: ${formState.station.auto_z}`}
                                    className="mr-2"
                                    iconClassName="size-6"
                                />
                            </h2>
                            <div className="card-body">
                                <div className="grid grid-cols-3 md:grid-cols-2 grid-flow-dense gap-2">
                                    {["auto_x", "auto_y", "auto_z"].map(
                                        (key, idx) => {
                                            if (key) {
                                                const errorBadge =
                                                    stationMsg?.errors?.errors?.find(
                                                        (error) =>
                                                            error.attr === key,
                                                    );

                                                return (
                                                    <div
                                                        key={`cartesian-${key}-${idx}`}
                                                    >
                                                        <div className="text-sm font-bold flex items-center">
                                                            {key === "auto_x"
                                                                ? "X"
                                                                : key ===
                                                                    "auto_y"
                                                                  ? "Y"
                                                                  : "Z"}
                                                        </div>
                                                        {edit ? (
                                                            <div className="flex flex-col space-y-1">
                                                                <label
                                                                    className={`input input-bordered ${errorBadge ? "input-error" : ""} flex items-center`}
                                                                >
                                                                    <input
                                                                        className="w-full"
                                                                        autoComplete="off"
                                                                        type="text"
                                                                        value={
                                                                            formState
                                                                                .station[
                                                                                key as keyof typeof formState.station
                                                                            ] ??
                                                                            ""
                                                                        }
                                                                        title={
                                                                            errorBadge
                                                                                ? errorBadge.detail
                                                                                : ""
                                                                        }
                                                                        name={
                                                                            "station." +
                                                                            key
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            handleChange(
                                                                                e,
                                                                            )
                                                                        }
                                                                    />
                                                                </label>
                                                                {errorBadge && (
                                                                    <span className="badge badge-error self-end">
                                                                        {
                                                                            errorBadge.code
                                                                        }
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <p className="break-words">
                                                                {formState
                                                                    .station[
                                                                    key as keyof typeof formState.station
                                                                ] ? (
                                                                    Number(
                                                                        formState
                                                                            .station[
                                                                            key as keyof typeof formState.station
                                                                        ],
                                                                    ) + " m"
                                                                ) : (
                                                                    <span className="text-gray-400">
                                                                        No {key}
                                                                    </span>
                                                                )}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                        },
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 space-y-4 grid-flow-dense">
                        <div className="card bg-base-200 grow shadow-xl">
                            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                                Equipment
                            </h2>
                            <div className="card-body">
                                <div className="grid grid-cols-4 md:grid-cols-2 grid-flow-dense gap-2">
                                    {Object.entries(formState.equipment).map(
                                        ([key, value], idx) => {
                                            if (key) {
                                                return (
                                                    <div
                                                        key={`equipment-${key}-${idx}`}
                                                    >
                                                        <div className="text-sm font-bold flex items-center">
                                                            {
                                                                equipmentFields[
                                                                    idx
                                                                ]
                                                            }
                                                        </div>

                                                        <p className="break-words">
                                                            {value ? (
                                                                value
                                                            ) : (
                                                                <span className="text-gray-400">
                                                                    No{" "}
                                                                    {key.replace(
                                                                        "_",
                                                                        " ",
                                                                    )}
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                );
                                            }
                                        },
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {edit && (
                <div className="w-full flex flex-col mt-4 items-center justify-center">
                    <Alert msg={updateMsg} />
                    <button
                        className="btn btn-success w-[140px] mt-4"
                        onClick={() => updateMetadata()}
                        disabled={loading || deleteLoading || updateLoading}
                    >
                        {updateLoading && (
                            <div
                                className="inline-block size-6
                                mx-2 animate-spin rounded-full border-4 border-solid border-current border-e-transparent align-[-0.125em] text-white motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                role="status"
                            ></div>
                        )}
                        UPDATE
                    </button>
                </div>
            )}

            {modals && modals?.title === "AddFile" && (
                <StationAddFileModal
                    stationId={stationId}
                    stationMetaId={stationMeta?.station}
                    meta={fileType === "meta"}
                    refetchStationMeta={() => {
                        Promise.all([refetchStationMeta(), refetchStation()]);
                        setFileType("none");
                    }}
                    reFetch={() => {
                        refetchFiles();
                        setFileType("none");
                    }}
                    setStateModal={setModals}
                    type={modals.type}
                    file={edit ? fileToEdit : undefined}
                    setFile={setFileToEdit}
                />
            )}

            {modals && modals.title === "FileRender" && (
                <Suspense fallback={null}>
                    <RenderFileModal
                        file={fileToShow?.actual_file}
                        filename={fileToShow?.filename}
                        closeModal={() => undefined}
                        setStateModal={setModals}
                    />
                </Suspense>
            )}

            {modals && modals?.title === "ConfirmDelete" && (
                <ConfirmDeleteModal
                    msg={fileMsg}
                    loading={deleteLoading}
                    confirmRemove={() =>
                        fileType === "meta"
                            ? delFileMeta()
                            : delFile(fileToDel as number)
                    }
                    closeModal={() => {
                        setModals({
                            show: false,
                            title: "",
                            type: "edit",
                        });
                        setFileType("none");

                        setFileMsg(undefined);
                    }}
                />
            )}
        </Modal>
    );
};

export default StationMetadataModal;
