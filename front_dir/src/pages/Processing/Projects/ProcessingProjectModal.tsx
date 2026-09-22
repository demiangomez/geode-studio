import { useCallback, useEffect, useMemo, useState } from "react";

import {
    Alert,
    ConfirmDeleteModal,
    FileOrTextField,
    Modal,
} from "@componentsReact";

import { useApi, useAuth, useFormReducer } from "@hooks";
import {
    useDeleteProcessingProject,
    useSaveProcessingProject,
} from "@hooks/queries";

import { AlertMsg, ProcessingProjectBase } from "@types";

import { modalActions, showModal, toAlertMsg } from "@utils";

import ProcessingStationsPanel from "./ProcessingStationsPanel";
import {
    ProcessingEngineConfig,
    ProjectFieldDef,
    ProjectFormValue,
} from "./engines";
import {
    FileFieldMode,
    buildProjectPayload,
    initialFileFieldsState,
    missingRequiredFields,
    projectToFormValues,
} from "./projectForm";

interface Props<T extends ProcessingProjectBase> {
    modalId: string;
    engine: ProcessingEngineConfig<T>;
    project: T | undefined;
    setStateModal: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    reFetch: () => void;
}

type FieldError = { code: string; detail: string };

const inputTypeOf = (field: ProjectFieldDef) =>
    field.kind === "integer" || field.kind === "decimal" ? "number" : "text";

const ProcessingProjectModal = <T extends ProcessingProjectBase>({
    modalId,
    engine,
    project,
    setStateModal,
    reFetch,
}: Props<T>) => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { formState, dispatch } = useFormReducer(
        projectToFormValues(engine, project),
    );
    const [fileFields, setFileFields] = useState(() =>
        initialFileFieldsState(engine, formState),
    );

    const [msg, setMsg] = useState<AlertMsg | undefined>(undefined);
    const [success, setSuccess] = useState(false);
    const [localErrors, setLocalErrors] = useState<Map<string, FieldError>>(
        () => new Map(),
    );
    const [confirmDelete, setConfirmDelete] = useState(false);
    // Si el JSON se guardo y fallo el archivo, reintentar edita en vez de crear otro
    const [savedProject, setSavedProject] = useState<T | undefined>();
    const current = savedProject ?? project;
    const isEdit = current !== undefined;

    const setValue = useCallback(
        (name: string, value: ProjectFormValue) =>
            dispatch({
                type: "change_value",
                payload: { inputName: name, inputValue: value },
            }),
        [dispatch],
    );

    const setStationList = useCallback(
        (list: string[]) => setValue("station_list", list),
        [setValue],
    );

    const onWriteError = (error: unknown) => setMsg(toAlertMsg(error));

    const onWriteSuccess = (action: string) => {
        setMsg({ status: 200, msg: `Project ${action}` });
        setSuccess(true);
        setConfirmDelete(false);
        // aca y no al cerrar: cerrar con la mutacion en vuelo perdia el refetch
        reFetch();
    };

    const saveMutation = useSaveProcessingProject<T>(api, engine);
    const deleteMutation = useDeleteProcessingProject(api, engine);

    const loading = saveMutation.isPending || deleteMutation.isPending;

    const handleSubmit = () => {
        const missing = missingRequiredFields(engine, formState);
        if (missing.length > 0) {
            setLocalErrors(
                new Map(
                    missing.map((f) => [
                        f.name,
                        { code: "required", detail: `${f.label} is required` },
                    ]),
                ),
            );
            return;
        }
        setLocalErrors(new Map());
        setMsg(undefined);

        const { fields, files } = buildProjectPayload(
            engine,
            formState,
            fileFields,
        );
        saveMutation.mutate(
            { id: current?.api_id, fields, files },
            {
                onSuccess: ({ project: saved, fileError }) => {
                    setSavedProject(saved);
                    if (fileError) {
                        reFetch();
                        onWriteError(fileError);
                        return;
                    }
                    onWriteSuccess(isEdit ? "updated" : "created");
                },
                onError: onWriteError,
            },
        );
    };

    const handleDelete = () => {
        if (!current) return;
        deleteMutation.mutate(current.api_id, {
            onSuccess: () => onWriteSuccess("removed"),
            onError: (error) => {
                onWriteError(error);
                setConfirmDelete(false);
            },
        });
    };

    useEffect(() => {
        confirmDelete && showModal("ConfirmDelete");
    }, [confirmDelete]);

    const fieldErrors = useMemo(() => {
        const map = new Map<string, FieldError>();
        for (const e of msg?.errors?.errors ?? []) {
            if (!e.attr) continue;
            const key = e.attr.split(".")[0];
            if (!map.has(key)) map.set(key, { code: e.code, detail: e.detail });
        }
        return map;
    }, [msg]);
    const errorOf = (name: string) =>
        localErrors.get(name) ?? fieldErrors.get(name);

    const renamed =
        current !== undefined &&
        String(formState.project ?? "").trim() !== current.project;

    const stationList = formState.station_list as string[];

    return (
        <Modal
            close={false}
            modalId={modalId}
            size="lg"
            handleCloseModal={() => setStateModal(undefined)}
            setModalState={setStateModal}
        >
            <div className="flex flex-col gap-4">
                <h3 className="font-bold text-center text-2xl my-2">
                    {isEdit ? "Edit" : "Create"} {engine.label} project
                </h3>

                <div className="grid grid-cols-4 lg:grid-cols-2 gap-3">
                    {engine.fields.map((field) => {
                        const error = errorOf(field.name);
                        const value = String(formState[field.name] ?? "");
                        return (
                            <label
                                key={field.name}
                                className="form-control"
                                title={error?.detail}
                            >
                                <span className="label-text font-bold">
                                    {field.label}
                                    {field.required && " *"}
                                </span>
                                <div className="relative">
                                    {field.kind === "select" ? (
                                        <select
                                            className={`select select-bordered w-full ${error ? "select-error" : ""}`}
                                            value={value}
                                            onChange={(e) =>
                                                setValue(
                                                    field.name,
                                                    e.target.value,
                                                )
                                            }
                                        >
                                            {field.nullable && (
                                                <option value="">—</option>
                                            )}
                                            {field.options?.map((o) => (
                                                <option key={o} value={o}>
                                                    {o}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={inputTypeOf(field)}
                                            step={field.step}
                                            maxLength={field.maxLength}
                                            className={`input input-bordered w-full ${error ? "input-error" : ""}`}
                                            value={value}
                                            autoComplete="off"
                                            onChange={(e) =>
                                                setValue(
                                                    field.name,
                                                    e.target.value,
                                                )
                                            }
                                        />
                                    )}
                                    {error && (
                                        <span className="badge badge-error absolute right-2 -top-2 z-[1]">
                                            {error.code.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            </label>
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-8 items-center">
                    {engine.multiChoices.map((multi) => {
                        const selected =
                            (formState[multi.name] as string[]) ?? [];
                        const error = errorOf(multi.name);
                        return (
                            <div
                                key={multi.name}
                                className="flex items-center gap-4 flex-wrap"
                            >
                                <span className="font-bold">{multi.label}</span>
                                {multi.options.map((o) => (
                                    <label
                                        key={o.value}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            className="checkbox"
                                            checked={selected.includes(o.value)}
                                            onChange={(e) =>
                                                setValue(
                                                    multi.name,
                                                    e.target.checked
                                                        ? [...selected, o.value]
                                                        : selected.filter(
                                                              (v) =>
                                                                  v !== o.value,
                                                          ),
                                                )
                                            }
                                        />
                                        <span>
                                            {o.value} {o.label}
                                        </span>
                                    </label>
                                ))}
                                {error && (
                                    <span
                                        className="badge badge-error"
                                        title={error.detail}
                                    >
                                        {error.code.toUpperCase()}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                    {engine.flags.map((flag) => (
                        <label
                            key={flag.name}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                className="checkbox"
                                checked={Boolean(formState[flag.name])}
                                onChange={(e) =>
                                    setValue(flag.name, e.target.checked)
                                }
                            />
                            <span className="font-bold">{flag.label}</span>
                        </label>
                    ))}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                    {engine.fileFields.map((file) => (
                        <FileOrTextField
                            key={file.name}
                            title={file.label}
                            value={String(formState[file.name] ?? "")}
                            onChange={(text) => setValue(file.name, text)}
                            mode={fileFields[file.name].mode}
                            onModeChange={(mode: FileFieldMode) =>
                                setFileFields((prev) => ({
                                    ...prev,
                                    [file.name]: { ...prev[file.name], mode },
                                }))
                            }
                            file={fileFields[file.name].file}
                            setFile={(f) =>
                                setFileFields((prev) => ({
                                    ...prev,
                                    [file.name]: {
                                        ...prev[file.name],
                                        file: f,
                                    },
                                }))
                            }
                            hint={`Drag 'n' drop ${file.fileName} file, or click to select file`}
                            error={
                                (
                                    errorOf(file.name) ??
                                    errorOf(`${file.name}_by_file`)
                                )?.code
                            }
                            emptyText={`No ${file.label}`}
                            height="h-[32rem]"
                            manualOnFileLoad
                        />
                    ))}
                </div>

                <ProcessingStationsPanel
                    api={api}
                    stationList={stationList}
                    onChange={setStationList}
                    error={errorOf("station_list")?.code}
                />

                {renamed && (
                    <div role="alert" className="alert alert-warning text-sm">
                        Renaming the project cascades to{" "}
                        {engine.cascadeTables.join(", ")}.
                    </div>
                )}

                <Alert msg={msg} />

                <div className={modalActions.container}>
                    {isEdit && (
                        <button
                            type="button"
                            className={modalActions.destructive}
                            disabled={loading || success}
                            onClick={() => setConfirmDelete(true)}
                        >
                            Remove
                        </button>
                    )}
                    <button
                        type="button"
                        className={modalActions.primary}
                        disabled={loading || success}
                        onClick={handleSubmit}
                    >
                        {isEdit ? "Update" : "Create"}
                        {loading && (
                            <span className="loading loading-spinner loading-md"></span>
                        )}
                    </button>
                </div>
            </div>

            {confirmDelete && current && (
                <ConfirmDeleteModal
                    mainMsg={`Are you sure you want to delete the project "${current.project}"?`}
                    alterMsg={`All ${engine.label} solutions of this project are deleted with it (${engine.cascadeTables.join(", ")}). This cannot be undone.`}
                    loading={deleteMutation.isPending}
                    confirmRemove={handleDelete}
                    closeModal={() => setConfirmDelete(false)}
                />
            )}
        </Modal>
    );
};

export default ProcessingProjectModal;
