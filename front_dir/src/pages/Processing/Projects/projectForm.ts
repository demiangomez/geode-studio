import { ProcessingProjectBase } from "@types";

import { ProcessingEngineConfig, ProjectFormValues } from "./engines";

export type FileFieldMode = "manual" | "by file";

export interface FileFieldState {
    mode?: FileFieldMode;
    file?: File;
}

export type FileFieldsState = Record<string, FileFieldState>;

export const projectToFormValues = <T extends ProcessingProjectBase>(
    engine: ProcessingEngineConfig<T>,
    project: T | undefined,
): ProjectFormValues => {
    const values: ProjectFormValues = { ...engine.defaults, station_list: [] };
    const source = project as Record<string, unknown> | undefined;

    for (const field of engine.fields) {
        const raw = source?.[field.name];
        if (raw !== undefined && raw !== null) values[field.name] = String(raw);
        else if (project) values[field.name] = "";
        else values[field.name] ??= "";
    }
    for (const flag of engine.flags) {
        const raw = source?.[flag.name];
        if (typeof raw === "boolean") values[flag.name] = raw;
        else values[flag.name] ??= false;
    }
    for (const multi of engine.multiChoices) {
        const raw = source?.[multi.name];
        values[multi.name] = Array.isArray(raw) ? [...raw] : [];
    }
    for (const file of engine.fileFields) {
        const raw = source?.[file.name];
        values[file.name] = typeof raw === "string" ? raw : "";
    }

    values.station_list = [...(project?.station_list ?? [])];
    return values;
};

// Con contenido cargado arranca en Manual, para que se note que hay algo
export const initialFileFieldsState = <T extends ProcessingProjectBase>(
    engine: ProcessingEngineConfig<T>,
    values: ProjectFormValues,
): FileFieldsState =>
    Object.fromEntries(
        engine.fileFields.map((f) => [
            f.name,
            values[f.name] ? { mode: "manual" as const } : {},
        ]),
    );

export interface ProjectPayload {
    fields: Record<string, unknown>;
    files?: FormData;
}

// JSON y multipart van separados: multipart no expresa `null` ni una lista vacia,
// y un "" en overconst_action rompe el CHECK de la DB (IS NULL OR IN (...))
export const buildProjectPayload = <T extends ProcessingProjectBase>(
    engine: ProcessingEngineConfig<T>,
    values: ProjectFormValues,
    fileFields: FileFieldsState,
): ProjectPayload => {
    const fields: Record<string, unknown> = {};

    for (const field of engine.fields) {
        const text = String(values[field.name] ?? "").trim();
        if (text === "") {
            if (field.nullable) fields[field.name] = null;
            continue;
        }
        fields[field.name] = text;
    }
    for (const flag of engine.flags) {
        fields[flag.name] = Boolean(values[flag.name]);
    }
    for (const multi of engine.multiChoices) {
        const list = values[multi.name];
        fields[multi.name] = Array.isArray(list) ? list : [];
    }
    const stationList = values.station_list;
    fields.station_list = Array.isArray(stationList) ? stationList : [];

    let files: FormData | undefined;
    for (const file of engine.fileFields) {
        const state = fileFields[file.name];
        if (state?.mode === "by file") {
            if (state.file) {
                files ??= new FormData();
                files.append(`${file.name}_by_file`, state.file);
            }
        } else {
            fields[file.name] = String(values[file.name] ?? "");
        }
    }

    return { fields, files };
};

export const missingRequiredFields = <T extends ProcessingProjectBase>(
    engine: ProcessingEngineConfig<T>,
    values: ProjectFormValues,
) =>
    engine.fields.filter(
        (f) => f.required && String(values[f.name] ?? "").trim() === "",
    );
