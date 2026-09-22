import { useEffect, useRef, useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { AxiosInstance } from "axios";

import {
    Alert,
    ConfirmDeleteModal,
    Menu,
    MenuButton,
    MenuContent,
    Modal,
    Spinner,
} from "@components/index";

import { useClickOutside, useFormReducer } from "@hooks/index";

import { ApiError, showModal, modalActions, unwrapApiResponse } from "@utils";

import { ErrorResponse, Errors } from "@types";

export interface SourcesCatalogField {
    name: string;
    label?: string;
    placeholder?: string;
    options?: string[];
    lookup?: { id: number; label: string }[];
}

interface SourcesCatalogModalProps {
    modalId: string;
    entityName: string;
    fields: SourcesCatalogField[];
    initialState: Record<string, any>;
    idName: string;
    record: Record<string, any> | undefined;
    type: "add" | "edit" | "none" | undefined;
    size?: "sm" | "md";
    api: AxiosInstance;
    create: (api: AxiosInstance, data: any) => Promise<ErrorResponse>;
    update: (
        api: AxiosInstance,
        id: number,
        data: any,
    ) => Promise<ErrorResponse>;
    remove: (api: AxiosInstance, id: number) => Promise<ErrorResponse>;
    handleClose: () => void;
    refetch: () => void;
}

const SourcesCatalogModal = ({
    modalId,
    entityName,
    fields,
    initialState,
    idName,
    record,
    type,
    size = "md",
    api,
    create,
    update,
    remove,
    handleClose,
    refetch,
}: SourcesCatalogModalProps) => {
    const [msg, setMsg] = useState<
        { status: number; msg: string; errors?: Errors } | undefined
    >(undefined);

    const [success, setSuccess] = useState<boolean>(false);

    const [showMenu, setShowMenu] = useState<
        { show: boolean; type: string } | undefined
    >(undefined);

    const openMenuRef = useRef<HTMLDivElement>(null);
    useClickOutside(
        openMenuRef,
        () => setShowMenu(undefined),
        !!showMenu?.show,
    );

    const { formState, dispatch } = useFormReducer(initialState);

    const [deleteModals, setDeleteModals] = useState<
        | {
              show: boolean;
              title: string;
              type: "add" | "edit" | "none";
          }
        | undefined
    >(undefined);

    const errorBadge = msg?.errors?.errors?.map((e) => e.attr);

    const onWriteError = (error: unknown) => {
        if (error instanceof ApiError) {
            setMsg({
                status: error.statusCode,
                msg: error.response?.type ?? error.message,
                errors: error.response,
            });
        } else {
            setMsg({
                status: 500,
                msg: (error as Error)?.message ?? "Request failed",
                errors: undefined,
            });
        }
    };

    const onWriteSuccess = (action: string) => {
        setMsg({ status: 200, msg: `${entityName} ${action}` });
        setSuccess(true);
        setDeleteModals(undefined);
        // aca y no al cerrar: cerrar con la mutacion en vuelo perdia el refetch
        refetch();
    };

    const resolveLookups = (data: Record<string, any>) => {
        const resolved = { ...data };
        fields.forEach((field) => {
            if (!field.lookup) return;
            const match = field.lookup.find(
                (item) => item.label === resolved[field.name],
            );
            resolved[field.name] = match ? match.id : "";
        });
        return resolved;
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const payload = resolveLookups(formState);
            if (type === "add") {
                delete payload[idName];
                return unwrapApiResponse(await create(api, payload));
            }
            return unwrapApiResponse(
                await update(api, Number(formState[idName]), payload),
            );
        },
        onSuccess: () => onWriteSuccess(type === "add" ? "created" : "updated"),
        onError: onWriteError,
    });

    const removeMutation = useMutation({
        mutationFn: async () =>
            unwrapApiResponse(await remove(api, Number(formState[idName]))),
        onSuccess: () => onWriteSuccess("removed"),
        onError: (error) => {
            onWriteError(error);
            setDeleteModals(undefined);
        },
    });

    const loading = saveMutation.isPending || removeMutation.isPending;

    const setFieldValue = (name: string, value: string) =>
        dispatch({
            type: "change_value",
            payload: { inputName: name, inputValue: value },
        });

    useEffect(() => {
        if (record) {
            const payload: Record<string, any> = { ...initialState, ...record };
            fields.forEach((field) => {
                if (!field.lookup) return;
                payload[field.name] =
                    field.lookup.find((item) => item.id === record[field.name])
                        ?.label ?? "";
            });
            dispatch({ type: "set", payload });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record]);

    useEffect(() => {
        deleteModals?.show && showModal(deleteModals.title);
    }, [deleteModals]);

    return (
        <Modal
            modalId={modalId}
            close={false}
            size={size}
            handleCloseModal={() => {
                handleClose();
                setMsg(undefined);
            }}
        >
            <div className="flex flex-col justify-center items-center gap-4">
                <h2 className="text-2xl font-bold">
                    {type === "add"
                        ? `Add ${entityName}`
                        : type === "edit"
                          ? `Edit ${entityName}`
                          : `View ${entityName}`}
                </h2>
                <div className="flex flex-col gap-3 w-full">
                    {fields.map((field) => {
                        const camp = field.name;
                        const hasMenu = !!(field.options || field.lookup);
                        const menuOpen =
                            !!showMenu?.show && showMenu.type === camp;
                        const menuItems: {
                            key: string | number;
                            value: string;
                        }[] = field.lookup
                            ? field.lookup.map((item) => ({
                                  key: item.id,
                                  value: item.label,
                              }))
                            : (field.options ?? []).map((option) => ({
                                  key: option,
                                  value: option,
                              }));
                        const searchTerm = String(
                            formState[camp] ?? "",
                        ).toLowerCase();
                        const searchWords = searchTerm
                            .split(" ")
                            .filter(Boolean);

                        return (
                            <div
                                key={camp}
                                className="w-full"
                                ref={menuOpen ? openMenuRef : undefined}
                            >
                                <label
                                    className={`w-full input input-bordered flex items-center gap-2 ${
                                        errorBadge?.includes(camp)
                                            ? "input-error"
                                            : ""
                                    } `}
                                    title={
                                        errorBadge?.includes(camp)
                                            ? msg?.errors?.errors.find(
                                                  (e) => e.attr === camp,
                                              )?.detail
                                            : String(formState[camp] ?? "")
                                    }
                                >
                                    <div className="label">
                                        <span className="font-bold">
                                            {field.label ??
                                                camp
                                                    .replace(/_/g, " ")
                                                    .toUpperCase()}
                                        </span>
                                    </div>
                                    <input
                                        ref={(input) => {
                                            if (input && menuOpen)
                                                input.focus();
                                        }}
                                        className="grow"
                                        type="text"
                                        placeholder={field.placeholder}
                                        value={formState[camp] ?? ""}
                                        onChange={(e) => {
                                            dispatch({
                                                type: "change_value",
                                                payload: {
                                                    inputName: camp,
                                                    inputValue: e.target.value,
                                                },
                                            });
                                        }}
                                        onClick={() => {
                                            setShowMenu({
                                                show: true,
                                                type: camp,
                                            });
                                        }}
                                    />
                                    {errorBadge?.includes(camp) && (
                                        <span className="badge badge-error absolute right-0 mb-12 mr-2">
                                            {
                                                msg?.errors?.errors.find(
                                                    (e) => e.attr === camp,
                                                )?.code
                                            }
                                        </span>
                                    )}
                                    {hasMenu && (
                                        <MenuButton
                                            setShowMenu={setShowMenu}
                                            showMenu={showMenu}
                                            typeKey={camp}
                                        />
                                    )}
                                </label>
                                {menuOpen && hasMenu && (
                                    <Menu>
                                        {menuItems
                                            .filter((item) =>
                                                searchWords.every((word) =>
                                                    item.value
                                                        .toLowerCase()
                                                        .includes(word),
                                                ),
                                            )
                                            .map((item) => (
                                                <MenuContent
                                                    key={item.key}
                                                    typeKey={camp}
                                                    value={item.value}
                                                    setShowMenu={setShowMenu}
                                                    dispatch={dispatch}
                                                    alterFunctionWithValue={(
                                                        value,
                                                    ) =>
                                                        setFieldValue(
                                                            camp,
                                                            value,
                                                        )
                                                    }
                                                />
                                            ))}
                                    </Menu>
                                )}
                            </div>
                        );
                    })}
                </div>
                <Alert msg={msg} />
                <div className={modalActions.container}>
                    {type === "edit" && (
                        <button
                            type="button"
                            className={modalActions.destructive}
                            onClick={() =>
                                setDeleteModals({
                                    show: true,
                                    title: "ConfirmDelete",
                                    type: "edit",
                                })
                            }
                            disabled={loading || success}
                        >
                            Remove
                        </button>
                    )}
                    <button
                        type="button"
                        className={modalActions.primary}
                        onClick={() => saveMutation.mutate()}
                        disabled={loading || success}
                    >
                        {loading && <Spinner size="md" />}
                        <span className="font-bold">
                            {type === "edit" ? "Update" : "Add"}
                        </span>
                    </button>
                </div>
            </div>
            {deleteModals?.show && deleteModals?.type === "edit" && (
                <ConfirmDeleteModal
                    loading={removeMutation.isPending}
                    confirmRemove={() => removeMutation.mutate()}
                    closeModal={() => setDeleteModals(undefined)}
                />
            )}
        </Modal>
    );
};

export default SourcesCatalogModal;
