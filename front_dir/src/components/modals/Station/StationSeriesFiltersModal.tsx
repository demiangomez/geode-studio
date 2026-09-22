import { Modal } from "@componentsReact";
import { useApi, useAuth, useFormReducer } from "@hooks";
import { useAdjustmentOptions } from "@hooks/queries";
import { SERIES_FILTERS_STATE } from "@utils/reducerFormStates";
import { useEffect, useState } from "react";

interface Props {
    filters: Record<keyof typeof SERIES_FILTERS_STATE, any>;
    setFilters: React.Dispatch<
        React.SetStateAction<Record<keyof typeof SERIES_FILTERS_STATE, any>>
    >;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    handleSubmit: () => void;
    handleCleanFilters: () => void;
}

// Etiquetas que no se derivan bien del nombre del campo.
const LABEL_OVERRIDES: Record<string, string> = {
    missing_data: "PLOT MISSING DATA",
    remove_stochastic: "REMOVE STOCHASTIC NOISE",
};

// El backend manda el type en SNAKE_UPPER (p.ej. ROBUST_LEAST_SQUARES) → label legible.
const humanize = (type: string) => type.replace(/_/g, " ");

const StationSeriesFiltersModal = ({
    filters,
    setFilters,
    setStateModal,
    handleSubmit,
    handleCleanFilters,
}: Props) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { adjustmentModels, covarianceFunctions } = useAdjustmentOptions(api);

    const { formState, dispatch } = useFormReducer(SERIES_FILTERS_STATE);

    const isRobust =
        formState.least_squares_strategy === "ROBUST_LEAST_SQUARES";

    const [relaxationInput, setRelaxationInput] = useState("");

    const relaxations: number[] = Array.isArray(formState.default_relaxations)
        ? (formState.default_relaxations as number[])
        : [];

    const setRelaxations = (next: number[]) => {
        dispatch({
            type: "change_value",
            payload: { inputName: "default_relaxations", inputValue: next },
        });
        setFilters((prev) => ({ ...prev, default_relaxations: next }));
    };

    const addRelaxation = () => {
        const value = parseFloat(relaxationInput);
        if (isNaN(value)) return;
        setRelaxations([...relaxations, value]);
        setRelaxationInput("");
    };

    const removeRelaxation = (index: number) => {
        setRelaxations(relaxations.filter((_, i) => i !== index));
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => {
        const { value, name } = e.target;
        const type = (e.target as any).type;
        const checked = (e.target as any).checked;

        if (
            name.includes("date") ||
            name === "solution" ||
            name === "least_squares_strategy" ||
            name === "covariance_model" ||
            name === "fit_window_start" ||
            name === "fit_window_end"
        ) {
            dispatch({
                type: "change_value",
                payload: {
                    inputName: name,
                    inputValue: value,
                },
            });

            setFilters((prev) => ({
                ...prev,
                [name]: value,
            }));
            return;
        }

        const inputValue = type === "checkbox" ? checked : value;

        dispatch({
            type: "change_value",
            payload: {
                inputName: name,
                inputValue,
            },
        });

        setFilters((prev) => ({
            ...prev,
            [name]: inputValue,
        }));
    };

    const handleSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleSubmit();
    };

    useEffect(() => {
        if (
            Object.values(filters).some(
                (r) => r !== undefined && r !== null && r !== "",
            )
        ) {
            dispatch({
                type: "set",
                payload: filters,
            });
        }
    }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <Modal
            close={false}
            modalId={"SeriesFilters"}
            size={"xl"}
            setModalState={setStateModal}
        >
            <form
                className="flex flex-col w-full space-y-4"
                onSubmit={handleSubmitForm}
            >
                <div className="grid grid-cols-1 grid-flow-dense gap-2">
                    <div className="card bg-base-200 grow shadow-xl">
                        <h2 className="card-title border-b-2 border-base-300 p-2">
                            Plot Parameters
                        </h2>

                        <div className="card-body">
                            <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4">
                                <div className="flex flex-col col-span-full 2xl:col-span-3 text-sm space-y-2 my-2 overflow-x-auto">
                                    <div className="join">
                                        <label
                                            htmlFor="date_start"
                                            className="input join-item input-bordered flex items-center w-full"
                                        >
                                            <span className="font-bold">
                                                PLOT FROM
                                            </span>
                                            <input
                                                type="date"
                                                value={formState["date_start"]}
                                                name="date_start"
                                                id="date_start"
                                                className="grow pl-2"
                                                onChange={(e) => {
                                                    handleChange(e);
                                                }}
                                            />
                                        </label>
                                        <span
                                            className="join-item px-6 text-lg place-content-center bg-neutral-content border border-neutral-300 
                                "
                                        >
                                            to
                                        </span>
                                        <label
                                            htmlFor="date_end"
                                            className="input join-item input-bordered flex items-center w-full"
                                        >
                                            <input
                                                type="date"
                                                value={formState["date_end"]}
                                                name="date_end"
                                                id="date_end"
                                                className="w-full"
                                                onChange={(e) => {
                                                    handleChange(e);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>
                                {Object.entries(formState).map(
                                    ([key, value]) => {
                                        if (
                                            key === "date_start" ||
                                            key === "date_end" ||
                                            key === "solution" ||
                                            key === "stack" ||
                                            key === "least_squares_strategy" ||
                                            key === "covariance_model" ||
                                            key === "fit_window_start" ||
                                            key === "fit_window_end" ||
                                            key === "default_relaxations"
                                        )
                                            return null;

                                        // PLOT OUTLIERS habilita la selección de MISSING DATA
                                        // Si se selecciona ROBUST LEAST SQUARES deshabilita REMOVE STOCHASTIC NOISE y COVARIANCE
                                        const isDisabled =
                                            (key === "missing_data" &&
                                                !formState.plot_outliers) ||
                                            (key === "remove_stochastic" &&
                                                isRobust);

                                        const normalizedKey =
                                            LABEL_OVERRIDES[key] ??
                                            key
                                                .replace(/_/g, " ")
                                                .toUpperCase();

                                        return (
                                            <div
                                                key={key}
                                                className={`flex flex-col col-span-full ${
                                                    key === "residuals"
                                                        ? "2xl:col-span-1"
                                                        : "2xl:col-span-2"
                                                } text-sm space-y-2 my-2 overflow-x-auto justify-center`}
                                            >
                                                <label
                                                    htmlFor={key}
                                                    className={`input input-bordered flex items-center w-full space-x-4 ${isDisabled ? "opacity-50" : ""}`}
                                                >
                                                    <span className="font-bold">
                                                        {normalizedKey}
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        className="checkbox"
                                                        checked={
                                                            value as boolean
                                                        }
                                                        name={key}
                                                        id={key}
                                                        disabled={isDisabled}
                                                        onChange={(e) => {
                                                            handleChange(e);
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="card bg-base-200 grow shadow-xl mt-4">
                        <h2 className="card-title border-b-2 border-base-300 p-2">
                            Adjustment Parameters
                        </h2>

                        <div className="card-body">
                            <div className="grid grid-cols-1 2xl:grid-cols-4 gap-4">
                                <div className="flex flex-col col-span-full 2xl:col-span-2 text-sm space-y-2 my-2">
                                    <label
                                        htmlFor="least_squares_strategy"
                                        className="input input-bordered flex items-center w-full justify-between"
                                    >
                                        <span className="font-bold">
                                            LEAST SQUARES STRATEGY
                                        </span>
                                        <select
                                            name="least_squares_strategy"
                                            id="least_squares_strategy"
                                            className="select select-ghost select-sm max-w-xs pl-2 font-semibold text-right"
                                            value={
                                                formState[
                                                    "least_squares_strategy"
                                                ]
                                            }
                                            onChange={handleChange}
                                        >
                                            {adjustmentModels.map((m) => (
                                                <option
                                                    key={m.id}
                                                    value={m.type}
                                                >
                                                    {humanize(m.type)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div
                                    className={`flex flex-col col-span-full 2xl:col-span-2 text-sm space-y-2 my-2 ${isRobust ? "opacity-50" : ""}`}
                                >
                                    <label
                                        htmlFor="covariance_model"
                                        className="input input-bordered flex items-center w-full justify-between"
                                    >
                                        <span className="font-bold">
                                            COVARIANCE
                                        </span>
                                        <select
                                            name="covariance_model"
                                            id="covariance_model"
                                            className="select select-ghost select-sm max-w-xs pl-2 font-semibold text-right"
                                            value={
                                                formState["covariance_model"]
                                            }
                                            disabled={isRobust}
                                            onChange={handleChange}
                                        >
                                            {covarianceFunctions.map((c) => (
                                                <option
                                                    key={c.id}
                                                    value={c.type}
                                                >
                                                    {humanize(c.type)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="flex flex-col col-span-full 2xl:col-span-4 text-sm space-y-2 my-2 overflow-x-auto">
                                    <div className="join">
                                        <label
                                            htmlFor="fit_window_start"
                                            className="input join-item input-bordered flex items-center w-full"
                                        >
                                            <span className="font-bold">
                                                FIT WINDOW
                                            </span>
                                            <input
                                                type="date"
                                                value={
                                                    formState[
                                                        "fit_window_start"
                                                    ]
                                                }
                                                name="fit_window_start"
                                                id="fit_window_start"
                                                className="grow pl-2"
                                                onChange={handleChange}
                                            />
                                        </label>
                                        <span className="join-item px-6 text-lg place-content-center bg-neutral-content border border-neutral-300">
                                            to
                                        </span>
                                        <label
                                            htmlFor="fit_window_end"
                                            className="input join-item input-bordered flex items-center w-full"
                                        >
                                            <input
                                                type="date"
                                                value={
                                                    formState["fit_window_end"]
                                                }
                                                name="fit_window_end"
                                                id="fit_window_end"
                                                className="w-full"
                                                onChange={handleChange}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex flex-col col-span-full text-sm space-y-2 my-2">
                                    <label
                                        htmlFor="default_relaxations_input"
                                        className="input input-bordered flex items-center w-full gap-2"
                                    >
                                        <span className="font-bold shrink-0">
                                            DEFAULT RELAXATIONS
                                        </span>
                                        <input
                                            id="default_relaxations_input"
                                            type="number"
                                            step="0.01"
                                            value={relaxationInput}
                                            placeholder="years"
                                            className="grow min-w-0 text-center"
                                            onChange={(e) =>
                                                setRelaxationInput(
                                                    e.target.value,
                                                )
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    addRelaxation();
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-ghost shrink-0"
                                            onClick={addRelaxation}
                                        >
                                            Add
                                        </button>
                                    </label>
                                    {relaxations.length > 0 && (
                                        <div className="flex flex-wrap gap-2 items-center w-full">
                                            {relaxations.map((rlx, i) => (
                                                <div
                                                    key={i}
                                                    className="flex flex-row items-center badge badge-primary gap-2 p-3"
                                                >
                                                    {rlx}
                                                    <button
                                                        type="button"
                                                        className="btn btn-xs btn-ghost"
                                                        onClick={() =>
                                                            removeRelaxation(i)
                                                        }
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex w-full justify-center space-x-4 items-end">
                    <button
                        className="btn btn-success w-[200px] self-center"
                        type="submit"
                    >
                        Apply parameters
                    </button>
                    <a
                        className="link link-hover"
                        onClick={() => handleCleanFilters()}
                    >
                        Clean parameters
                    </a>
                </div>
            </form>
        </Modal>
    );
};

export default StationSeriesFiltersModal;
