import {
    GamitProjectData,
    ProcessingEngine,
    ProcessingProjectBase,
} from "@types";

export type ProjectFieldKind = "text" | "integer" | "decimal" | "select";

export interface ProjectFieldDef {
    name: string;
    label: string;
    kind: ProjectFieldKind;
    options?: readonly string[];
    nullable?: boolean;
    required?: boolean;
    maxLength?: number;
    step?: string;
}

export interface ProjectFlagDef {
    name: string;
    label: string;
}

export interface ProjectMultiChoiceDef {
    name: string;
    label: string;
    options: readonly { value: string; label: string }[];
}

export interface ProjectFileFieldDef {
    name: string;
    label: string;
    fileName: string;
}

export interface ProjectTableColumn<T extends ProcessingProjectBase> {
    title: string;
    render: (project: T) => string | number;
}

export type ProjectFormValue = string | boolean | string[];
export type ProjectFormValues = Record<string, ProjectFormValue>;

export interface ProcessingEngineConfig<
    T extends ProcessingProjectBase = ProcessingProjectBase,
> {
    key: ProcessingEngine;
    label: string;
    endpoint: string;
    route: string;
    fields: ProjectFieldDef[];
    flags: ProjectFlagDef[];
    multiChoices: ProjectMultiChoiceDef[];
    fileFields: ProjectFileFieldDef[];
    columns: ProjectTableColumn<T>[];
    defaults: ProjectFormValues;
    cascadeTables: string[];
}

const GNSS_SYSTEMS = [
    { value: "G", label: "GPS" },
    { value: "R", label: "GLONASS" },
    { value: "E", label: "Galileo" },
    { value: "C", label: "BeiDou" },
] as const;

const gamit: ProcessingEngineConfig<GamitProjectData> = {
    key: "gamit",
    label: "GAMIT",
    endpoint: "api/gamit-projects",
    route: "/processing-projects/gamit",
    fields: [
        {
            name: "project",
            label: "project",
            kind: "text",
            required: true,
            maxLength: 20,
        },
        {
            name: "network_type",
            label: "network_type",
            required: true,
            kind: "select",
            options: ["global", "regional"],
        },
        {
            name: "experiment_type",
            label: "experiment_type",
            required: true,
            kind: "select",
            options: ["baseline", "relax", "orbit"],
        },
        {
            name: "overconst_action",
            label: "overconst_action",
            kind: "select",
            options: ["inflate", "relax", "remove", "delete"],
            nullable: true,
        },
        {
            name: "experiment_name",
            label: "experiment_name",
            kind: "text",
            nullable: true,
            maxLength: 4,
        },
        {
            name: "org",
            label: "org",
            kind: "text",
            nullable: true,
            maxLength: 3,
        },
        {
            name: "eop_type",
            label: "eop_type",
            required: true,
            kind: "text",
            maxLength: 10,
        },
        {
            name: "solutions_dir",
            label: "solutions_dir",
            kind: "text",
            nullable: true,
        },
        {
            name: "cluster_size",
            label: "cluster_size",
            required: true,
            kind: "integer",
        },
        { name: "ties", label: "ties", required: true, kind: "integer" },
        {
            name: "sigma_floor_h",
            label: "sigma_floor_h",
            required: true,
            kind: "decimal",
            step: "0.0001",
        },
        {
            name: "sigma_floor_v",
            label: "sigma_floor_v",
            required: true,
            kind: "decimal",
            step: "0.0001",
        },
    ],
    flags: [{ name: "noftp", label: "noftp" }],
    multiChoices: [
        { name: "systems", label: "systems", options: GNSS_SYSTEMS },
    ],
    fileFields: [
        {
            name: "process_defaults",
            label: "process_defaults",
            fileName: "process.defaults",
        },
        { name: "sestbl", label: "sestbl", fileName: "sestbl." },
    ],
    columns: [
        { title: "project", render: (p) => p.project },
        { title: "network_type", render: (p) => p.network_type },
        { title: "experiment_type", render: (p) => p.experiment_type },
        { title: "experiment_name", render: (p) => p.experiment_name ?? "" },
        { title: "org", render: (p) => p.org ?? "" },
        { title: "cluster_size", render: (p) => p.cluster_size },
        { title: "ties", render: (p) => p.ties },
        { title: "systems", render: (p) => p.systems?.join(", ") ?? "" },
        { title: "stations", render: (p) => p.station_list?.length ?? 0 },
    ],
    defaults: {
        network_type: "global",
        cluster_size: "25",
        ties: "10",
        experiment_type: "baseline",
        noftp: true,
        eop_type: "usno",
        sigma_floor_h: "0.0100",
        sigma_floor_v: "0.0300",
        systems: [],
        station_list: [],
    },
    cascadeTables: [
        "gamit_soln",
        "gamit_soln_excl",
        "gamit_subnets",
        "gamit_stats",
        "gamit_antenna_residuals",
    ],
};

// Un motor nuevo (pages_projects) es otra entrada aca, no otra pagina ni otro modal
export const PROCESSING_ENGINES: Partial<
    Record<ProcessingEngine, ProcessingEngineConfig<any>>
> = { gamit };

export const getProcessingEngine = (key: string | undefined) =>
    key ? PROCESSING_ENGINES[key as ProcessingEngine] : undefined;
