import { Modal, Alert, GregorianDatePicker } from "components";
import {
    postTimeSeriesPolynomialService,
    postTimeSeriesPeriodicService,
    postTimeSeriesJumpService,
    putTimeSeriesJumpService,
} from "@services";
import React, { useState, useEffect } from "react";
import { useFormReducer, useApi, useAuth } from "@hooks";
import {
    SERIES_JUMP_DATA,
    SERIES_POLYNOMIAL_DATA,
    SERIES_PERIODIC_DATA,
} from "@utils/reducerFormStates";
import { apiOkStatuses } from "@utils";
import { Errors, JumpType } from "@types";

interface TimeSeriesConfigModalProps {
    type: { table: string; type: string } | undefined;
    valueToModify: any;
    data: any;
    stationId: number;
    refetch: () => void;
    success: boolean;
    setSuccess: (value: boolean) => void;
    jumpTypes?: JumpType[];
    solution: string;
}

const TimeSeriesConfigModal = ({
    type,
    valueToModify,
    data,
    stationId,
    refetch,
    success,
    setSuccess,
    jumpTypes,
    solution,
}: TimeSeriesConfigModalProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);
    const { formState, dispatch } = useFormReducer<Record<string, any>>({});

    const [loading, setLoading] = useState(false);

    const [msg, setMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const [doyCheck, setDoyCheck] = useState(true);

    const notAllowedKeys = ["fit", "metadata"];
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSuccess(true);
        if (type?.type === "add" || type?.type === "edit") {
            postData();
        } else if (type?.type === "activate") {
            activateRow();
        }
    };

    const getType = () => {
        if (type?.table === "jumps" && jumpTypes) {
            const jumpType = formState.jump_type;
            const type = jumpTypes.find((j: JumpType) => j.type === jumpType);
            if (!type) {
                return -1;
            }
            return type.id;
        } else {
            return -1;
        }
    };

    // Resuelve el `type` string del catálogo (available-jump-types) de una fila
    // de jump, para preseleccionar el <select> (que matchea por jumpType.type).
    // La fila identifica su tipo por `type` (número pyETM, a veces string) y
    // `type_name`; probamos por id (coerción num/string) y luego por nombre.
    // jumpType.type del catálogo es la raíz del type_name de la fila
    // ("POSTSEISMIC" ⊂ "POSTSEISMIC ONLY"): match por prefijo, el más largo gana.
    const resolveJumpType = (row: any): string => {
        if (!row || !jumpTypes) return "";
        const norm = (s: any) =>
            String(s ?? "")
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "");
        const target = norm(row.type_name);
        const match = jumpTypes
            .filter((j) => target.startsWith(norm(j.type)))
            .sort((a, b) => norm(b.type).length - norm(a.type).length)[0];
        return match?.type ?? "";
    };

    const activateRow = async () => {
        if (valueToModify) {
            if (type?.table === "jumps") {
                let relaxation;
                if (getType() >= 1 && Array.isArray(formState.relaxation)) {
                    relaxation = formState.relaxation;
                } else {
                    relaxation = [];
                }
                const params = {
                    Year: valueToModify.Year,
                    DOY: valueToModify.DOY,
                    action: "+",
                    jump_type: Number(getType()),
                    relaxation: relaxation,
                };

                try {
                    setLoading(true);
                    const res = await postTimeSeriesJumpService<any>(
                        api,
                        stationId,
                        solution,
                        params,
                    );
                    if ("status" in res) {
                        setMsg({
                            status: res.statusCode,
                            msg: res.response.type,
                            errors: res.response,
                        });
                    } else {
                        setMsg({
                            status: res.statusCode,
                            msg: res.message ?? res.msg ?? "Jump row activated successfully",
                        });
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            }
        }
    };

    const postData = async () => {
        try {
            setLoading(true);
            let service, chosenMsg, params;
            if (
                type?.table === "jumps" ||
                type?.table === "periodic" ||
                type?.table === "polynomial"
            ) {
                if (type?.table === "jumps") {
                    let relaxation;
                    if (getType() >= 1 && Array.isArray(formState.relaxation)) {
                        relaxation = formState.relaxation;
                    } else {
                        relaxation = [];
                    }

                    params = Object.entries(formState).reduce(
                        (acc, [key, value]) => {
                            if (
                                key !== "relaxation" &&
                                key !== "action" &&
                                key !== "jump_type"
                            ) {
                                return {
                                    ...acc,
                                    [key]: Number(value as string),
                                };
                            } else if (key === "jump_type") {
                                return {
                                    ...acc,
                                    [key]: getType() as number,
                                };
                            } else if (key === "relaxation") {
                                return {
                                    ...acc,
                                    [key]: relaxation,
                                };
                            } else {
                                return {
                                    ...acc,
                                    [key]: value as string,
                                };
                            }
                        },
                        {},
                    ) as any;

                    if (type?.type === "edit") {
                        params = {
                            ...params,
                            old_Year: Number(valueToModify.Year),
                            old_DOY: Number(valueToModify.DOY),
                        };
                        service = putTimeSeriesJumpService;
                        chosenMsg = "Jump row edited successfully";
                    } else {
                        service = postTimeSeriesJumpService;
                        chosenMsg = "Jump row added successfully";
                    }
                } else if (type?.table === "periodic") {
                    service = postTimeSeriesPeriodicService;
                    params = { frequencies: [...formState.frequence, ...data] };
                    chosenMsg = "Periodic row added successfully";
                } else {
                    service = postTimeSeriesPolynomialService;
                    params = formState;
                    chosenMsg = "Polynomial row edited successfully";
                }

                const res = await service<any>(
                    api,
                    stationId,
                    solution,
                    params,
                );
                if ("status" in res) {
                    setMsg({
                        status: res.statusCode,
                        msg: res.response.type,
                        errors: res.response,
                    });
                } else {
                    setMsg({
                        status: res.statusCode,
                        msg: res.message ?? res.msg ?? chosenMsg,
                    });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (success) {
            refetch();
        }
        setMsg(undefined);
        setDoyCheck(true);
    };

    useEffect(() => {
        setDoyCheck(true);
        if (type?.table && type.type) {
            if (type.type === "add") {
                switch (type.table) {
                    case "polynomial":
                        dispatch({
                            type: "set",
                            payload: SERIES_POLYNOMIAL_DATA,
                        });
                        break;
                    case "periodic":
                        dispatch({
                            type: "set",
                            payload: SERIES_PERIODIC_DATA,
                        });
                        break;
                    case "jumps":
                        dispatch({
                            type: "set",
                            payload: SERIES_JUMP_DATA,
                        });
                        break;
                }
                dispatch({
                    type: "change_value",
                    payload: {
                        inputName: "action",
                        inputValue: "+",
                    },
                });
            } else if (type.type === "edit") {
                if (type.table === "jumps") {
                    dispatch({
                        type: "set",
                        payload: {
                            Year: String(valueToModify.Year ?? ""),
                            DOY: String(valueToModify.DOY ?? ""),
                            action: "+",
                            jump_type: resolveJumpType(valueToModify),
                            relaxation: Array.isArray(valueToModify.relaxation)
                                ? valueToModify.relaxation
                                : [],
                        },
                    });
                } else {
                    dispatch({
                        type: "set",
                        payload: {
                            ...Object.keys(valueToModify).reduce<
                                Record<string, any>
                            >((acc, key) => {
                                if (!notAllowedKeys.includes(key)) {
                                    acc[key] = String(valueToModify[key]);
                                }
                                return acc;
                            }, {}),
                        },
                    });
                }
            } else if (type.type === "activate") {
                dispatch({
                    type: "set",
                    payload: {
                        jump_type: resolveJumpType(valueToModify),
                        relaxation: Array.isArray(valueToModify.relaxation)
                            ? valueToModify.relaxation
                            : [],
                    },
                });
            }
        }
    }, [type, jumpTypes]); // eslint-disable-line react-hooks/exhaustive-deps

    const isEditJump = type?.type === "edit" && type?.table === "jumps";

    const simpleFieldKeys = Object.keys(formState).filter(
        (k) =>
            ![
                "fit",
                "metadata",
                "action",
                "frequence",
                "relaxation",
                "jump_type",
                "Year",
                "DOY",
            ].includes(k),
    );

    const renderField = (key: string, label: string, index: number, disabled = false) => {
        const errorBadge = msg?.errors?.errors?.find(
            (error) => error.attr === key,
        );

        return (
            <div
                className="flex flex-col w-full min-w-0"
                key={`${key}-${index}`}
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
                <label
                    className={`input input-bordered flex items-center gap-2 grow min-w-0 ${errorBadge ? "input-error" : ""} ${disabled ? "input-disabled" : ""}`}
                    title={errorBadge ? errorBadge.detail : ""}
                >
                    <input
                        type="text"
                        value={formState[key] || ""}
                        className="grow w-full min-w-0 text-left"
                        disabled={disabled}
                        onChange={(e) => {
                            dispatch({
                                type: "change_value",
                                payload: {
                                    inputName: key,
                                    inputValue: e.target.value,
                                },
                            });
                        }}
                    />
                </label>
            </div>
        );
    };

    return (
        <Modal
            modalId="TimeSeriesConfigModal"
            close={false}
            size="smPlus"
            handleCloseModal={handleClose}
        >
            <div className="w-full flex grow mb-2">
                <h3 className="font-bold text-center text-2xl my-2 w-full self-center">
                    {type?.type === "edit"
                        ? "Edit"
                        : type?.type === "activate"
                            ? "Activate"
                            : "Add"}
                </h3>
            </div>
            <form className="form-control space-y-4" onSubmit={handleSubmit}>
                <div className="form-control space-y-4">
                    {(type?.table === "jumps" ||
                        type?.table === "polynomial") &&
                        "Year" in formState &&
                        "DOY" in formState && (
                            <div className="flex w-full items-end gap-2">
                                <div className="grow min-w-0">
                                    {doyCheck || isEditJump ? (
                                        <div className="grid grid-cols-2 gap-2">
                                            {renderField("Year", "YEAR", 0, isEditJump)}
                                            {renderField("DOY", "DOY", 1, isEditJump)}
                                        </div>
                                    ) : (
                                        <GregorianDatePicker
                                            portalId="TimeSeriesConfigModal-dp-portal"
                                            labelAbove
                                            year={formState.Year}
                                            doy={formState.DOY}
                                            onChange={(newYear, newDoy) => {
                                                dispatch({
                                                    type: "change_value",
                                                    payload: {
                                                        inputName: "Year",
                                                        inputValue: newYear,
                                                    },
                                                });
                                                dispatch({
                                                    type: "change_value",
                                                    payload: {
                                                        inputName: "DOY",
                                                        inputValue: newDoy,
                                                    },
                                                });
                                            }}
                                        />
                                    )}
                                </div>
                                {!isEditJump && (
                                    <label className="label cursor-pointer gap-1 p-0 shrink-0 mb-2">
                                        <span className="label-text text-xs font-semibold">
                                            DOY
                                        </span>
                                        <input
                                            type="checkbox"
                                            checked={doyCheck}
                                            onChange={() =>
                                                setDoyCheck((prev) => !prev)
                                            }
                                            className="checkbox"
                                        />
                                    </label>
                                )}
                            </div>
                        )}
                    {/* simple field texts */}
                    {simpleFieldKeys.length > 0 && (
                        <div
                            className={`grid gap-2 ${simpleFieldKeys.length >= 3
                                ? "grid-cols-3"
                                : simpleFieldKeys.length === 2
                                    ? "grid-cols-2"
                                    : "grid-cols-1"
                                }`}
                        >
                            {simpleFieldKeys.map((key, idx) =>
                                renderField(
                                    key,
                                    key.toUpperCase().split("_").join(" "),
                                    idx,
                                ),
                            )}
                        </div>
                    )}

                    {/* tipos de saltos */}
                    {type?.table === "jumps" && "jump_type" in formState && (
                        <div className="flex flex-col w-full min-w-0">
                            <div className="flex items-end px-1 min-h-[1.25rem]">
                                <span className="font-bold text-xs">
                                    JUMP TYPE
                                </span>
                            </div>
                            <select
                                className="select select-bordered w-full"
                                value={formState.jump_type || ""}
                                onChange={(e) => {
                                    dispatch({
                                        type: "change_value",
                                        payload: {
                                            inputName: "jump_type",
                                            inputValue: e.target.value,
                                        },
                                    });
                                }}
                            >
                                <option value="">Select jump type</option>
                                {jumpTypes?.map((jumpType) => (
                                    <option
                                        key={jumpType.id}
                                        value={jumpType.type}
                                    >
                                        {jumpType.type}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* frecuency (periodic) / years relaxation (jumps) */}
                    {((type?.table === "periodic" &&
                        "frequence" in formState) ||
                        (type?.table === "jumps" && getType() >= 1)) && (
                            <div className="space-y-4 flex flex-col items-center justify-center">
                                <div className="flex items-center justify-center gap-2 w-full">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder={
                                            type?.table === "periodic"
                                                ? "Enter frequency value"
                                                : "Enter relaxation value"
                                        }
                                        className="input input-bordered grow text-left"
                                        id="frequencyInput"
                                    />
                                    <button
                                        type="button"
                                        className="btn"
                                        onClick={() => {
                                            const input = document.getElementById(
                                                "frequencyInput",
                                            ) as HTMLInputElement;
                                            const value = parseFloat(input.value);
                                            if (!isNaN(value)) {
                                                if (type?.table === "periodic") {
                                                    const currentFrequences =
                                                        Array.isArray(
                                                            formState.frequence,
                                                        )
                                                            ? formState.frequence
                                                            : [];
                                                    dispatch({
                                                        type: "change_value",
                                                        payload: {
                                                            inputName: "frequence",
                                                            inputValue: [
                                                                ...currentFrequences,
                                                                value,
                                                            ],
                                                        },
                                                    });
                                                    input.value = "";
                                                } else if (type?.table === "jumps") {
                                                    const currentFrequences =
                                                        Array.isArray(
                                                            formState.relaxation,
                                                        )
                                                            ? formState.relaxation
                                                            : [];
                                                    dispatch({
                                                        type: "change_value",
                                                        payload: {
                                                            inputName: "relaxation",
                                                            inputValue: [
                                                                ...currentFrequences,
                                                                value,
                                                            ],
                                                        },
                                                    });
                                                    input.value = "";
                                                }
                                            }
                                        }}
                                    >
                                        {type?.table === "periodic"
                                            ? "Add Frequency"
                                            : "Add Relaxation Years"}
                                    </button>
                                </div>
                                <div className="max-h-44 flex flex-wrap gap-3 justify-start items-center overflow-y-auto w-full p-2">
                                    {Array.isArray(formState.relaxation) && (
                                        <label className="font-bold text-lg">
                                            Years:
                                        </label>
                                    )}
                                    {Array.isArray(formState.frequence) &&
                                        formState.frequence.map(
                                            (freq: number, i: number) => (
                                                <div
                                                    key={i}
                                                    className="flex flex-row justify-between items-center badge badge-primary gap-2 p-4"
                                                >
                                                    {freq}
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-ghost"
                                                        onClick={() => {
                                                            const newFrequences =
                                                                formState.frequence.filter(
                                                                    (
                                                                        _: number,
                                                                        index: number,
                                                                    ) => index !== i,
                                                                );
                                                            dispatch({
                                                                type: "change_value",
                                                                payload: {
                                                                    inputName:
                                                                        "frequence",
                                                                    inputValue:
                                                                        newFrequences,
                                                                },
                                                            });
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ),
                                        )}
                                    {Array.isArray(formState.relaxation) &&
                                        formState.relaxation.map(
                                            (freq: number, i: number) => (
                                                <div
                                                    key={i}
                                                    className="flex flex-row justify-between items-center badge badge-primary gap-2 m-1 p-4"
                                                >
                                                    {freq}
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-ghost"
                                                        onClick={() => {
                                                            const newFrequences =
                                                                formState.relaxation.filter(
                                                                    (
                                                                        _: number,
                                                                        index: number,
                                                                    ) => index !== i,
                                                                );
                                                            dispatch({
                                                                type: "change_value",
                                                                payload: {
                                                                    inputName:
                                                                        "relaxation",
                                                                    inputValue:
                                                                        newFrequences,
                                                                },
                                                            });
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ),
                                        )}
                                </div>
                            </div>
                        )}
                </div>

                <button
                    className="btn btn-success self-center w-3/12"
                    disabled={apiOkStatuses.includes(Number(msg?.status))}
                    type="submit"
                >
                    {loading && (
                        <span className="loading loading-spinner loading-sm self-center"></span>
                    )}{" "}
                    Save{" "}
                </button>
                {
                    msg && <Alert msg={msg} />
                }
            </form>
        </Modal>
    );
};

export default TimeSeriesConfigModal;
