import { useEffect, useState } from "react";
import { Alert, Modal } from "@componentsReact";
import { postNetworkService, putNetworkService } from "@services";
import { useApi, useAuth, useFormReducer } from "@hooks";
import { apiOkStatuses } from "@utils";
import { Errors, ErrorResponse, ExtendedNetworkData, NetworkData } from "@types";

interface NetworksModalProps {
    network: NetworkData | undefined;
    modalType: string;
    reFetch: () => void;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    setNetwork: React.Dispatch<
        React.SetStateAction<NetworkData | undefined>
    >;
}

const NetworksModal = ({
    network,
    modalType,
    reFetch,
    setStateModal,
    setNetwork,
}: NetworksModalProps) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [loading, setLoading] = useState<boolean>(false);
    const [msg, setMsg] = useState<
        | { status: number; msg: string; errors?: Errors }
        | undefined
    >(undefined);

    const isSuccess = apiOkStatuses.includes(Number(msg?.status));

    const { formState, dispatch } = useFormReducer({
        api_id: "",
        network_code: "",
        network_name: "",
    });

    useEffect(() => {
        // En 'add' el formulario arranca vacío; sólo precargamos al editar.
        if (network && modalType === "edit") {
            dispatch({ type: "set", payload: network });
        }
    }, [network, modalType]); // eslint-disable-line

    const postNetwork = async () => {
        try {
            setLoading(true);
            const res = await postNetworkService<
                ExtendedNetworkData | ErrorResponse
            >(api, {
                network_code: formState.network_code,
                network_name: formState.network_name,
            });
            if ("status" in res) {
                setMsg({
                    status: res.statusCode,
                    msg: res.response.type,
                    errors: res.response,
                });
            } else {
                setMsg({
                    status: res.statusCode,
                    msg: "Network added successfully",
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const patchNetwork = async () => {
        try {
            setLoading(true);
            const res = await putNetworkService<ExtendedNetworkData | ErrorResponse>(
                api,
                Number(network?.api_id),
                {
                    network_code: formState.network_code,
                    network_name: formState.network_name,
                },
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
                    msg: "Network updated successfully",
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCloseModal = () => {
        setNetwork(undefined);
        reFetch();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        dispatch({
            type: "change_value",
            payload: { inputName: name, inputValue: value },
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (modalType === "edit") patchNetwork();
        else if (modalType === "add") postNetwork();
    };

    // api_id lo asigna el backend: oculto al crear, sólo visible (disabled) al editar.
    const fields = Object.keys(formState).filter(
        (key) => !(modalType === "add" && key === "api_id"),
    );

    // network_code es editable sólo al crear; al editar queda fijo.
    const disabledFields =
        modalType === "add" ? ["api_id"] : ["api_id", "network_code"];

    return (
        <Modal
            close={false}
            modalId={"EditNetwork"}
            size={"fit"}
            handleCloseModal={handleCloseModal}
            setModalState={setStateModal}
        >
            <div className="w-full flex grow mb-2">
                <h3 className="font-bold text-center text-2xl my-2 w-full self-center">
                    {modalType?.charAt(0).toUpperCase() + modalType?.slice(1)}{" "}
                    Network
                </h3>
            </div>
            <form className="form-control space-y-4" onSubmit={handleSubmit}>
                <div className="form-control space-y-2 w-full px-4">
                    {fields.map((key, index) => {
                        const isDisabled = disabledFields.includes(key);
                        const errorBadge = msg?.errors?.errors?.find(
                            (error) => error.attr === key,
                        );
                        return (
                            <label
                                key={key + index}
                                className={`w-full input input-bordered flex items-center gap-2 ${
                                    errorBadge ? "input-error" : ""
                                } ${isDisabled ? "opacity-50" : ""}`}
                                title={errorBadge ? errorBadge.detail : ""}
                            >
                                <div className="label">
                                    <span className="font-bold">
                                        {key
                                            .toUpperCase()
                                            .replace(/_/g, " ")}
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    name={key}
                                    value={
                                        formState[
                                            key as keyof typeof formState
                                        ] ?? ""
                                    }
                                    onChange={handleChange}
                                    className="grow"
                                    autoComplete="off"
                                    disabled={isDisabled}
                                />
                                {errorBadge && (
                                    <span className="badge badge-error">
                                        {errorBadge.code}
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>
                <div className="px-4">
                    <Alert msg={msg} />
                </div>
                {loading && (
                    <div className="w-full text-center">
                        <span className="loading loading-spinner loading-lg self-center"></span>
                    </div>
                )}
                <div className="flex w-full justify-center">
                    <button
                        type="submit"
                        className="btn btn-success w-5/12"
                        disabled={isSuccess || loading}
                    >
                        Save
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default NetworksModal;
