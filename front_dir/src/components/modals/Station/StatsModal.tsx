import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import {
    Alert,
    ConfirmDeleteModal,
    DateTimePicker,
    Menu,
    MenuButton,
    MenuContent,
    Modal,
    TraceReceiverModal,
} from "@componentsReact";

import "react-datepicker/dist/react-datepicker.css";

import {
    AntennaData,
    ErrorResponse,
    Errors,
    ExtendedStationInfoData,
    GamitHTCData,
    RadomeData,
    ReceiversData,
    StationInfoData,
} from "@types";

import {
    delStationInfoService,
    postStationInfoService,
    putStationInfoService,
} from "@services";

import {
    useApi,
    useAuth,
    useClickOutside,
    useEscape,
    useFormReducer,
} from "@hooks";
import {
    useAntennas,
    useHeightCodes,
    useRadomes,
    useReceivers,
} from "@hooks/queries";
import { STATION_INFO_STATE } from "@utils/reducerFormStates";
import {
    apiOkStatuses,
    dateFromDay,
    dateToUTC,
    dayFromDate,
    formattedDates,
    showModal,
    validateCatalogFields,
    modalActions,
} from "@utils";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface EditStatsModalProps {
    stationInfo: StationInfoData | undefined;
    modalType: "add" | "edit" | "none";
    typeAddition: "last" | "none-clear" | undefined;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    setStationInfo?: React.Dispatch<
        React.SetStateAction<StationInfoData | undefined>
    >;
    setTypeAddition: React.Dispatch<
        React.SetStateAction<"last" | "none-clear" | undefined>
    >;
    reFetch: () => void;
}

// campos ocultos
const HIDDEN_FIELDS = ["api_id", "network_code", "station_code"];
// campos con DateTimePicker/DOY
const DATE_PICKER_FIELDS = ["date_start", "date_end"];
// campos con MenuButton de búsqueda
const MENU_BUTTON_FIELDS = [
    "receiver_code",
    "antenna_code",
    "radome_code",
    "height_code",
];

// DHARP: height code que por requerimiento siempre debe estar disponible en la lista
const DHARP_HEIGHT_CODE: GamitHTCData = {
    antenna_code: "",
    api_id: 0,
    h_offset: 0,
    height_code: "DHARP",
    v_offset: 0,
};

// layout
const FIELD_LAYOUT: { key: string; label: string }[][] = [
    // L1 – Receptor
    [
        { key: "receiver_code", label: "RECEIVER CODE" },
        { key: "receiver_serial", label: "RECEIVER SERIAL" },
        { key: "receiver_vers", label: "RECEIVER VERS" },
        { key: "receiver_firmware", label: "RECEIVER FIRMWARE" },
    ],
    // L2 – Antena
    [
        { key: "antenna_code", label: "ANTENNA CODE" },
        { key: "radome_code", label: "RADOME" },
        { key: "antenna_serial", label: "ANTENNA SERIAL" },
    ],
    // L3 – Offsets de antena
    [
        { key: "antenna_height", label: "ANTENNA HEIGHT" },
        { key: "antenna_north", label: "ANTENNA NORTH" },
        { key: "antenna_east", label: "ANTENNA EAST" },
    ],
    // L4 – Otros de antena (antenna_azimuth = AntDAZ, ya provisto por el backend)
    [
        { key: "antenna_azimuth", label: "ANTENNA AZIMUTH" },
        { key: "height_code", label: "HEIGHT CODE" },
    ],
    // L5 – Fechas
    [
        { key: "date_start", label: "DATE START" },
        { key: "date_end", label: "DATE END" },
    ],
    // Otros
    [{ key: "comments", label: "COMMENTS" }],
];

const EditStatsModal = ({
    stationInfo,
    modalType,
    typeAddition,
    setTypeAddition,
    setStateModal,
    setStationInfo,
    reFetch,
}: EditStatsModalProps) => {
    const { nc, sc } = useParams();

    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { formState, dispatch } =
        useFormReducer<Record<string, any>>(STATION_INFO_STATE);

    const [loading, setLoading] = useState<boolean>(false);
    const [msg, setMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);
    const { data: receivers = [] } = useReceivers(api);
    const { data: antennas = [] } = useAntennas(api);

    // height codes solo con una antena concreta, no con texto parcial
    const selectedAntennaCode = antennas.some(
        (ant) => ant.antenna_code === formState.antenna_code,
    )
        ? formState.antenna_code
        : "";
    const { data: heightcodes = [], isFetching: isFetchingHeight } =
        useHeightCodes(api, selectedAntennaCode);
    const { data: radomes = [], isFetching: isFetchingRadome } = useRadomes(
        api,
        selectedAntennaCode,
    );

    // DHARP siempre debe estar en la lista de height codes, aunque el back no lo
    // devuelva para esta antena (requerimiento)
    const heightCodeOptions = heightcodes.some((h) => h.height_code === "DHARP")
        ? heightcodes
        : [DHARP_HEIGHT_CODE, ...heightcodes];

    const prevAntennaCode = useRef<string>(selectedAntennaCode);

    useEffect(() => {
        if (
            prevAntennaCode.current !== selectedAntennaCode &&
            !isFetchingHeight &&
            !isFetchingRadome
        ) {
            // Al cambiar de antena, radome_code y height_code se limpian siempre
            const isInitialLoad = prevAntennaCode.current === "";

            if (!isInitialLoad) {
                if (formState.radome_code !== "") {
                    dispatch({
                        type: "change_value",
                        payload: { inputName: "radome_code", inputValue: "" },
                    });
                }
                if (formState.height_code !== "") {
                    dispatch({
                        type: "change_value",
                        payload: { inputName: "height_code", inputValue: "" },
                    });
                }
            }

            prevAntennaCode.current = selectedAntennaCode;
        }
    }, [
        selectedAntennaCode,
        isFetchingHeight,
        isFetchingRadome,
        formState.radome_code,
        formState.height_code,
        dispatch,
    ]);

    // El Trace Receiver autocompleta antena + radome + height como un conjunto
    // coherente. Al setear la antena sincronizamos prev para que el efecto de
    // cambio de antena no lo interprete como cambio manual y vacíe radome/height.
    const traceDispatch: React.Dispatch<any> = (action) => {
        if (
            action?.type === "change_value" &&
            action.payload?.inputName === "antenna_code"
        ) {
            const nextCode = action.payload.inputValue ?? "";

            prevAntennaCode.current = antennas.some(
                (a) => a.antenna_code === nextCode,
            )
                ? nextCode
                : "";
        }
        dispatch(action); // cambia el formState por ende el selectedAntennaCode
    };

    const [matchingReceivers, setMatchingReceivers] = useState<ReceiversData[]>(
        [],
    );
    const [matchingAntennas, setMatchingAntennas] = useState<AntennaData[]>([]);
    const [matchingRadomes, setMatchingRadomes] = useState<RadomeData[]>([]);
    const [matchingHeightcodes, setMatchingHeightcodes] = useState<
        GamitHTCData[]
    >([]);

    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);

    const [doyCheck, setDoyCheck] = useState<
        { [key: string]: { check: boolean; input: string } } | undefined
    >({
        date_start: { check: true, input: "" },
        date_end: { check: true, input: "" },
    });

    const [showMenu, setShowMenu] = useState<
        { type: string; show: boolean } | undefined
    >(undefined);

    const openMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(
        openMenuRef,
        () => setShowMenu(undefined),
        !!showMenu?.show,
    );

    useEffect(() => {
        if (stationInfo && (modalType === "edit" || modalType === "none")) {
            stationInfo.antenna_east =
                stationInfo.antenna_east !== null
                    ? stationInfo.antenna_east.toString()
                    : "";
            stationInfo.antenna_north =
                stationInfo.antenna_north !== null
                    ? stationInfo.antenna_north.toString()
                    : "";
            stationInfo.antenna_height =
                stationInfo.antenna_height !== null
                    ? stationInfo.antenna_height.toString()
                    : "";
            stationInfo.antenna_azimuth =
                stationInfo.antenna_azimuth !== null &&
                stationInfo.antenna_azimuth !== undefined
                    ? stationInfo.antenna_azimuth.toString()
                    : "";

            dispatch({ type: "set", payload: stationInfo });
        } else {
            dispatch({
                type: "change_value",
                payload: { inputName: "network_code", inputValue: nc },
            });
            dispatch({
                type: "change_value",
                payload: { inputName: "station_code", inputValue: sc },
            });
        }
    }, [stationInfo]); // eslint-disable-line

    const handleChange = (
        e:
            | React.ChangeEvent<HTMLInputElement>
            | React.MouseEvent<HTMLInputElement, MouseEvent>
            | { target: { name: string; value: string } },
    ) => {
        const target =
            (e as React.ChangeEvent<HTMLInputElement>).target ??
            (e as React.MouseEvent<HTMLInputElement>).target ??
            (e as { target: { name: string; value: string } }).target;
        const { value, name } = target as HTMLInputElement;

        if (name === "receiver_code") {
            const match = receivers.filter((receiver) =>
                receiver.receiver_code
                    .toLowerCase()
                    .includes(value.toLowerCase()),
            );
            setMatchingReceivers(match);
        }
        if (name === "antenna_code") {
            const match = antennas.filter((ant) =>
                ant.antenna_code.toLowerCase().includes(value.toLowerCase()),
            );
            setMatchingAntennas(match);
        }
        if (name === "radome_code") {
            const match = radomes.filter((radome) =>
                radome.radome_code.toLowerCase().includes(value.toLowerCase()),
            );
            setMatchingRadomes(match);
        }
        if (name === "height_code") {
            const match = heightCodeOptions.filter((hc) =>
                hc.height_code.toLowerCase().includes(value.toLowerCase()),
            );
            setMatchingHeightcodes(match);
        }

        dispatch({
            type: "change_value",
            payload: { inputName: name, inputValue: value },
        });
    };

    const postStationInfo = async () => {
        try {
            setLoading(true);
            const { date_end, ...rest } = formState;
            const res = await postStationInfoService<
                ExtendedStationInfoData | ErrorResponse
            >(api, date_end.trim() === "" ? rest : formState);

            if (res) {
                if ("status" in res) {
                    setMsg({
                        status: res.statusCode,
                        msg: res.response.type,
                        errors: res.response,
                    });
                } else {
                    setMsg({
                        status: res.statusCode,
                        msg: "Station info added successfully",
                    });
                    reFetch();
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const putStationInfo = async () => {
        try {
            setLoading(true);
            formState.date_end =
                formState.date_end?.trim() === "" || !formState.date_end
                    ? null
                    : formState.date_end;

            const res = await putStationInfoService<
                ExtendedStationInfoData | ErrorResponse
            >(api, Number(formState.api_id), formState);

            if (res) {
                if ("status" in res) {
                    setMsg({
                        status: res.statusCode,
                        msg: res.response.type,
                        errors: res.response,
                    });
                } else {
                    setMsg({
                        status: res.statusCode,
                        msg: "Station info updated successfully",
                    });
                    reFetch();
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const delStationInfo = async () => {
        try {
            setLoading(true);
            const res = await delStationInfoService<ErrorResponse>(
                api,
                Number(formState.api_id),
            );

            if (res) {
                if ("status" in res && res.status === "success") {
                    setMsg({ status: res.statusCode, msg: res.msg });
                    reFetch();
                } else {
                    setMsg({
                        status: res.statusCode,
                        msg: res.response.type,
                        errors: res.response,
                    });
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setMsg(undefined);
        const invalidFields = validateCatalogFields(formState, {
            receiver_code: receivers.map((r) => r.receiver_code),
            antenna_code: antennas.map((a) => a.antenna_code),
            radome_code: radomes.map((r) => r.radome_code),
            height_code: heightCodeOptions.map((h) => h.height_code),
        });
        if (invalidFields.length > 0) {
            setMsg({
                status: 400,
                msg: "Some fields must be selected from their list",
                errors: {
                    type: "validation_error",
                    errors: invalidFields as Errors["errors"],
                },
            });
            return;
        }
        if (modalType === "add" || modalType === "none") {
            postStationInfo();
        } else if (modalType === "edit") {
            putStationInfo();
        }
    };

    useEffect(() => {
        if (formState.date_start && formState.date_start !== null) {
            setStartDate(dateToUTC(formState.date_start));
        }
    }, [formState.date_start]);

    useEffect(() => {
        if (formState.date_end && formState.date_end !== null) {
            setEndDate(dateToUTC(formState.date_end));
        }
    }, [formState.date_end]);

    const closeModal = () => {
        setStationInfo ? setStationInfo(undefined) : null;
        STATION_INFO_STATE.network_code = nc ?? "";
        STATION_INFO_STATE.station_code = sc ?? "";
        setTypeAddition(undefined);
        dispatch({ type: "set", payload: STATION_INFO_STATE });
    };

    const dispatchAndClearDoys = () => {
        dispatch({ type: "clear" });
        setDoyCheck({
            date_start: { check: true, input: "" },
            date_end: { check: true, input: "" },
        });
    };

    const inputRefReceiverCode = useRef<HTMLInputElement>(null);
    const inputRefAntenaCode = useRef<HTMLInputElement>(null);
    const inputRefRadomeCode = useRef<HTMLInputElement>(null);
    const inputRefHeightCode = useRef<HTMLInputElement>(null);

    const selectRef = (key: string) => {
        return key === "receiver_code"
            ? inputRefReceiverCode
            : key === "antenna_code"
              ? inputRefAntenaCode
              : key === "radome_code"
                ? inputRefRadomeCode
                : key === "height_code"
                  ? inputRefHeightCode
                  : null;
    };

    useEffect(() => {
        if (showMenu) {
            const ref = selectRef(showMenu.type);
            if (ref && ref.current) ref.current.focus();
        }
    }, [showMenu]);

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    useEscape(() => {
        closeModal();
        dispatchAndClearDoys();
        setMsg(undefined);
    });

    // Renderiza un campo del formulario
    const renderField = (key: string, label: string, index: number) => {
        const isDatePicker = DATE_PICKER_FIELDS.includes(key);
        const isMenuField = MENU_BUTTON_FIELDS.includes(key);
        const errorBadge = msg?.errors?.errors?.find(
            (error) => error.attr === key,
        );

        return (
            <div
                className={`flex flex-col w-full min-w-0 relative`}
                key={key + index}
                ref={
                    showMenu?.show && showMenu.type === key
                        ? openMenuRef
                        : undefined
                }
            >
                <div className="flex items-end justify-between gap-1 px-1 min-h-[1.25rem]">
                    <span className="font-bold text-xs truncate">{label}</span>
                    {errorBadge && (
                        <span
                            className="badge badge-error badge-sm shrink-0"
                            title={errorBadge.detail}
                        >
                            {errorBadge.code.toUpperCase()}
                        </span>
                    )}
                </div>
                <div className="flex w-full items-center gap-1">
                    <label
                        id={key}
                        className={`input input-bordered flex items-center gap-2 grow min-w-0 ${
                            errorBadge ? "input-error" : ""
                        }`}
                        title={errorBadge ? errorBadge.detail : ""}
                    >
                        <input
                            type="text"
                            ref={selectRef(key)}
                            name={key}
                            value={
                                isDatePicker
                                    ? doyCheck?.[key]?.check
                                        ? doyCheck[key].input.trim() !== ""
                                            ? doyCheck[key].input
                                            : dayFromDate(
                                                    formState?.[key],
                                                )?.trim() !== ""
                                              ? (dayFromDate(
                                                    formState?.[key],
                                                ) ?? "")
                                              : ""
                                        : formState[key] !== "" &&
                                            formState[key] !== null
                                          ? formattedDates(
                                                new Date(formState[key]),
                                            )
                                          : ""
                                    : (formState[key] ?? "")
                            }
                            onChange={(e) => {
                                const inputValue = e.target.value;
                                const hasDoy =
                                    isDatePicker && doyCheck?.[key]?.check;

                                setShowMenu({ type: key, show: true });

                                if (hasDoy) {
                                    setDoyCheck({
                                        ...doyCheck,
                                        [key]: {
                                            check: true,
                                            input: inputValue ?? 0,
                                        },
                                    });
                                    const dateValue = inputValue
                                        ? dateFromDay(inputValue)?.toISOString()
                                        : null;
                                    if (dateValue === null) {
                                        if (key === "date_start") {
                                            setStartDate(null);
                                        } else {
                                            setEndDate(null);
                                        }
                                    }
                                    dispatch({
                                        type: "change_value",
                                        payload: {
                                            inputName: key,
                                            inputValue: dateValue ?? "",
                                        },
                                    });
                                } else {
                                    handleChange(e);
                                }
                            }}
                            className="grow w-full min-w-0"
                            autoComplete="off"
                            readOnly={isDatePicker && !doyCheck?.[key]?.check}
                            placeholder={
                                isDatePicker && doyCheck?.[key]?.check
                                    ? "YYYY DDD HH MM SS"
                                    : ""
                            }
                            onClick={(e) => {
                                if (isMenuField) {
                                    handleChange(e);
                                    setShowMenu({ type: key, show: true });
                                }
                            }}
                        />
                        {isDatePicker && !doyCheck?.[key]?.check && (
                            <DateTimePicker
                                typeKey={key}
                                startDate={startDate}
                                endDate={endDate}
                                setStartDate={setStartDate}
                                setEndDate={setEndDate}
                                dispatch={dispatch}
                            />
                        )}
                        {isMenuField && (
                            <MenuButton
                                setShowMenu={setShowMenu}
                                onMenuClick={() =>
                                    handleChange({
                                        target: {
                                            name: key,
                                            value: formState[key],
                                        },
                                    })
                                }
                                showMenu={showMenu}
                                typeKey={key}
                            />
                        )}
                    </label>
                    {isDatePicker && (
                        <label className="label cursor-pointer gap-1 p-0 shrink-0">
                            <span className="label-text text-xs font-semibold">
                                DOY
                            </span>
                            <input
                                type="checkbox"
                                checked={doyCheck?.[key]?.check}
                                onChange={() => {
                                    setDoyCheck({
                                        ...doyCheck,
                                        [key]: {
                                            check: !doyCheck?.[key]?.check,
                                            input:
                                                dayFromDate(formState?.[key]) ??
                                                "",
                                        },
                                    });
                                }}
                                className="checkbox"
                            />
                        </label>
                    )}
                </div>
                {showMenu?.show && showMenu.type === key && (
                    <div className="absolute left-0 top-full z-[100] w-full">
                        {key === "receiver_code" && (
                            <Menu>
                                {(matchingReceivers.length > 0
                                    ? matchingReceivers
                                    : receivers
                                ).map((receiver) => (
                                    <MenuContent
                                        key={
                                            receiver.api_id +
                                            receiver.receiver_code
                                        }
                                        typeKey={key}
                                        value={receiver.receiver_code}
                                        dispatch={dispatch}
                                        setShowMenu={setShowMenu}
                                    />
                                ))}
                            </Menu>
                        )}
                        {key === "antenna_code" && (
                            <Menu>
                                {(matchingAntennas.length > 0
                                    ? matchingAntennas
                                    : antennas
                                ).map((ant) => (
                                    <MenuContent
                                        key={ant.api_id + ant.antenna_code}
                                        typeKey={key}
                                        value={ant.antenna_code}
                                        dispatch={dispatch}
                                        setShowMenu={setShowMenu}
                                    />
                                ))}
                            </Menu>
                        )}
                        {key === "radome_code" && (
                            <Menu>
                                {(matchingRadomes.length > 0
                                    ? matchingRadomes
                                    : radomes
                                ).map((radome) => (
                                    <MenuContent
                                        key={radome.radome_code}
                                        typeKey={key}
                                        value={radome.radome_code}
                                        dispatch={dispatch}
                                        setShowMenu={setShowMenu}
                                    />
                                ))}
                            </Menu>
                        )}
                        {key === "height_code" && (
                            <Menu>
                                {(matchingHeightcodes.length > 0
                                    ? matchingHeightcodes
                                    : heightCodeOptions
                                ).map((hc) => (
                                    <MenuContent
                                        key={hc.api_id + hc.height_code}
                                        typeKey={key}
                                        value={hc.height_code}
                                        dispatch={dispatch}
                                        setShowMenu={setShowMenu}
                                    />
                                ))}
                            </Menu>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <Modal
            close={true}
            modalId={"EditStats"}
            size={"md"}
            handleCloseModal={closeModal}
            setModalState={setStateModal}
        >
            <div>
                <button
                    className="btn absolute left-6 top-6"
                    onClick={() =>
                        setModals({
                            show: true,
                            title: "TraceReceiverModal",
                            type: "none",
                        })
                    }
                >
                    Trace Receiver <MagnifyingGlassIcon className="size-5" />
                </button>

                <h3 className="font-bold text-center text-2xl my-2 w-full">
                    {modalType === "none"
                        ? "Add"
                        : modalType.charAt(0).toUpperCase() +
                          modalType.slice(1) +
                          (modalType === "edit"
                              ? " " +
                                stationInfo?.network_code.toUpperCase() +
                                "." +
                                stationInfo?.station_code.toUpperCase()
                              : "")}
                </h3>
            </div>
            <form className="form-control space-y-4" onSubmit={handleSubmit}>
                {/* Campos ocultos enviados en el payload */}
                {HIDDEN_FIELDS.map((key) => (
                    <input
                        key={key}
                        type="hidden"
                        name={key}
                        value={formState[key] ?? ""}
                    />
                ))}

                <div className="form-control space-y-3">
                    {FIELD_LAYOUT.map((line, lineIdx) => (
                        <div
                            key={lineIdx}
                            className={`grid gap-2 ${
                                line.length === 4
                                    ? "grid-cols-2"
                                    : line.length === 3
                                      ? "grid-cols-3"
                                      : line.length === 1
                                        ? "grid-cols-1"
                                        : "grid-cols-2"
                            }`}
                        >
                            {line.map(({ key, label }, fieldIdx) =>
                                renderField(
                                    key,
                                    label,
                                    lineIdx * 10 + fieldIdx,
                                ),
                            )}
                        </div>
                    ))}
                </div>

                <Alert msg={msg} />
                <div className={modalActions.container}>
                    {modalType === "edit" && (
                        <button
                            type="button"
                            className={modalActions.destructive}
                            disabled={apiOkStatuses.includes(
                                Number(msg?.status),
                            )}
                            onClick={() =>
                                setModals({
                                    show: true,
                                    title: "ConfirmDelete",
                                    type: "edit",
                                })
                            }
                        >
                            Remove
                        </button>
                    )}

                    <button
                        type="submit"
                        className={modalActions.primary}
                        disabled={
                            apiOkStatuses.includes(Number(msg?.status)) ||
                            loading
                        }
                    >
                        {loading && (
                            <span className="loading loading-spinner loading-md"></span>
                        )}
                        Submit
                    </button>
                    {typeAddition === "last" && (
                        <a
                            className="link link-hover cursor-pointer self-end"
                            style={{ marginTop: "10px", marginLeft: "10px" }}
                            onClick={dispatchAndClearDoys}
                        >
                            Clear
                        </a>
                    )}
                    {modals && modals?.title === "ConfirmDelete" && (
                        <ConfirmDeleteModal
                            msg={msg}
                            loading={loading}
                            confirmRemove={() => delStationInfo()}
                            closeModal={() => {
                                setModals({
                                    show: false,
                                    title: "",
                                    type: "edit",
                                });
                            }}
                        />
                    )}
                </div>
            </form>
            <form>
                {modals && modals?.title === "TraceReceiverModal" && (
                    <TraceReceiverModal
                        parentReceiverType={formState.receiver_code ?? ""}
                        parentReceiverSerial={formState.receiver_serial ?? ""}
                        closeModal={() => {
                            setModals({
                                show: false,
                                title: "",
                                type: "none",
                            });
                        }}
                        parentDispatch={traceDispatch}
                    />
                )}
            </form>
        </Modal>
    );
};

export default EditStatsModal;
