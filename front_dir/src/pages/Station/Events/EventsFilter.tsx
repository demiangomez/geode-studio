import { Modal } from "@componentsReact";
import { useFormReducer } from "@hooks/index";
import { EVENTS_FILTERS_STATE } from "@utils/reducerFormStates";
import { useEffect } from "react";

interface Props {
    filters: Record<keyof typeof EVENTS_FILTERS_STATE, any>;
    setFilters: React.Dispatch<
        React.SetStateAction<Record<keyof typeof EVENTS_FILTERS_STATE, any>>
    >;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    onSubmit: () => void;
    handleCleanFilters: () => void;
    showNetworkStationFilters?: boolean;
    onlyEmptyNetwork?: boolean;
    setOnlyEmptyNetwork?: React.Dispatch<React.SetStateAction<boolean>>;
}

const EventsFilter = ({
    filters,
    setFilters,
    setStateModal,
    onSubmit,
    handleCleanFilters,
    showNetworkStationFilters = false,
    onlyEmptyNetwork = false,
    setOnlyEmptyNetwork,
}: Props) => {
    const { formState, dispatch } = useFormReducer(EVENTS_FILTERS_STATE);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        dispatch({
            type: "change_value",
            payload: {
                inputName: name,
                inputValue: value,
            },
        });

        setFilters({
            ...filters,
            [name]: value,
        });
    };

    const handleNetworkCodeChange = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        handleChange(e);
        if (e.target.value !== "" && onlyEmptyNetwork) {
            setOnlyEmptyNetwork?.(false);
        }
    };

    const handleOnlyEmptyNetworkChange = (checked: boolean) => {
        setOnlyEmptyNetwork?.(checked);
        if (checked) {
            dispatch({
                type: "change_value",
                payload: { inputName: "network_code", inputValue: "" },
            });
            setFilters({ ...filters, network_code: "" });
        }
    };

    const handleSubmitForm = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit();
        setStateModal(undefined);
    };

    useEffect(() => {
        if (showNetworkStationFilters) {
            dispatch({ type: "set", payload: filters });
            return;
        }
        const { station_code, network_code, ...rest } = filters; // eslint-disable-line
        dispatch({
            type: "set",
            payload: rest,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, showNetworkStationFilters]);

    const titlesToIgnore = [
        "event_date_since",
        "event_date_until",
        "year",
        "doy",
        "network_code",
        "station_code",
    ];

    return (
        <Modal
            close={false}
            modalId={"EventsFilter"}
            size={"fit"}
            setModalState={setStateModal}
        >
            <form
                className="flex flex-col w-full space-y-4"
                onSubmit={handleSubmitForm}
            >
                <div className="grid grid-cols-2 grid-flow-dense gap-2">
                    <div className="card bg-base-200 grow shadow-xl">
                        <h2 className="card-title border-b-2 border-base-300 p-2">
                            General
                        </h2>
                        <div className="card-body">
                            <div className="grid grid-cols-1 gap-4">
                                {showNetworkStationFilters && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col text-sm space-y-2 my-2">
                                            <span className="font-bold">
                                                STATION CODE
                                            </span>
                                            <label
                                                htmlFor="station_code"
                                                className="input input-bordered flex items-center w-full"
                                            >
                                                <input
                                                    type="text"
                                                    value={
                                                        formState[
                                                            "station_code" as keyof typeof formState
                                                        ] ?? ""
                                                    }
                                                    name="station_code"
                                                    id="station_code"
                                                    className="w-full"
                                                    onChange={(e) => {
                                                        handleChange(e);
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        <div className="flex flex-col text-sm space-y-2 my-2">
                                            <span className="font-bold">
                                                NETWORK CODE
                                            </span>
                                            <label
                                                htmlFor="network_code"
                                                className="input input-bordered flex items-center w-full"
                                            >
                                                <input
                                                    type="text"
                                                    value={
                                                        formState[
                                                            "network_code" as keyof typeof formState
                                                        ] ?? ""
                                                    }
                                                    name="network_code"
                                                    id="network_code"
                                                    className="w-full"
                                                    onChange={
                                                        handleNetworkCodeChange
                                                    }
                                                />
                                            </label>
                                            <label className="label cursor-pointer justify-start gap-2 px-0">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm"
                                                    checked={onlyEmptyNetwork}
                                                    onChange={(e) =>
                                                        handleOnlyEmptyNetworkChange(
                                                            e.target.checked,
                                                        )
                                                    }
                                                />
                                                <span className="label-text">
                                                    Only stations without an
                                                    assigned network
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                )}
                                {Object.entries(formState).map(
                                    ([key, value]) => {
                                        if (titlesToIgnore.includes(key)) {
                                            return null;
                                        }
                                        return (
                                            <div
                                                key={key}
                                                className="flex flex-col text-sm space-y-2 my-2"
                                            >
                                                <span className="font-bold">
                                                    {key
                                                        .toUpperCase()
                                                        .replace(/_/g, " ")}
                                                </span>
                                                <label
                                                    htmlFor={key}
                                                    className="input input-bordered flex items-center w-full"
                                                >
                                                    <input
                                                        type="text"
                                                        value={value}
                                                        name={key}
                                                        id={key}
                                                        className="w-full"
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
                    <div className="card bg-base-200 grow shadow-xl">
                        <h2 className="card-title border-b-2 border-base-300 p-2">
                            Time Filters
                        </h2>
                        <div className="card-body">
                            <div className="grid grid-cols-1 h-full place-content-center gap-4">
                                <div className="flex flex-col text-sm space-y-2 my-2 overflow-x-auto">
                                    <span className="font-bold">
                                        EVENT DATE
                                    </span>
                                    <div className="join">
                                        <label
                                            htmlFor="event_date_since"
                                            className="input join-item input-bordered flex items-center w-full"
                                        >
                                            <input
                                                type="datetime-local"
                                                value={
                                                    formState[
                                                        "event_date_since" as keyof typeof formState
                                                    ]
                                                }
                                                name="event_date_since"
                                                id="event_date_since"
                                                className="w-full"
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
                                            htmlFor="event_date_until"
                                            className="input join-item input-bordered flex items-center w-full"
                                        >
                                            <input
                                                type="datetime-local"
                                                value={
                                                    formState[
                                                        "event_date_until" as keyof typeof formState
                                                    ]
                                                }
                                                name="event_date_until"
                                                id="event_date_until"
                                                className="w-full"
                                                onChange={(e) => {
                                                    handleChange(e);
                                                }}
                                            />
                                        </label>
                                    </div>
                                </div>

                                <div className="flex flex-col text-sm space-y-2 my-2">
                                    <span className="font-bold">YEAR</span>
                                    <label
                                        htmlFor="year"
                                        className="input input-bordered flex items-center w-full"
                                    >
                                        <input
                                            type="text"
                                            value={
                                                formState[
                                                    "year" as keyof typeof formState
                                                ]
                                            }
                                            name="year"
                                            id="year"
                                            className="w-full"
                                            onChange={(e) => {
                                                handleChange(e);
                                            }}
                                        />
                                    </label>
                                </div>

                                <div className="flex flex-col text-sm space-y-2 my-2">
                                    <span className="font-bold">DOY</span>
                                    <label
                                        htmlFor="doy"
                                        className="input input-bordered flex items-center w-full"
                                    >
                                        <input
                                            type="text"
                                            value={
                                                formState[
                                                    "doy" as keyof typeof formState
                                                ]
                                            }
                                            name="doy"
                                            id="doy"
                                            className="w-full"
                                            onChange={(e) => {
                                                handleChange(e);
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex justify-center">
                    <button className="btn btn-success w-[200px]" type="submit">
                        Apply filters
                    </button>
                    <a
                        className="link link-hover h-full self-end ml-4"
                        type="button"
                        onClick={() => {
                            handleCleanFilters();
                            setStateModal(undefined);
                        }}
                    >
                        Clean filters
                    </a>
                </div>
            </form>
        </Modal>
    );
};

export default EventsFilter;
