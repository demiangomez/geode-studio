import { describe, expect, it } from "vitest";

import { GamitProjectData } from "@types";

import { PROCESSING_ENGINES } from "./engines";
import {
    mergeStationCodes,
    removeStationCode,
    sortByStationCode,
} from "@utils";

import {
    buildProjectPayload,
    initialFileFieldsState,
    missingRequiredFields,
    projectToFormValues,
} from "./projectForm";

const gamit = PROCESSING_ENGINES.gamit!;

const project: GamitProjectData = {
    api_id: 7,
    project: "g2na",
    network_type: "global",
    cluster_size: 25,
    ties: 10,
    process_defaults: "set procdir = /data",
    sestbl: null,
    solutions_dir: null,
    experiment_type: "baseline",
    experiment_name: "g2na",
    org: "igs",
    noftp: true,
    eop_type: "usno",
    systems: ["G", "R"],
    overconst_action: null,
    sigma_floor_h: "0.0100",
    sigma_floor_v: "0.0300",
    station_list: ["arg.DYNA", "igs.braz"],
};

describe("projectToFormValues", () => {
    it("en alta precarga los defaults de la DB y deja vacio lo nullable", () => {
        const values = projectToFormValues(gamit, undefined);
        expect(values.network_type).toBe("global");
        expect(values.cluster_size).toBe("25");
        expect(values.noftp).toBe(true);
        expect(values.overconst_action).toBe("");
        expect(values.systems).toEqual([]);
        expect(values.station_list).toEqual([]);
    });

    it("en edicion vuelca el proyecto como strings y copia los arrays", () => {
        const values = projectToFormValues(gamit, project);
        expect(values.ties).toBe("10");
        expect(values.org).toBe("igs");
        expect(values.solutions_dir).toBe("");
        expect(values.systems).toEqual(["G", "R"]);
        expect(values.systems).not.toBe(project.systems);
        expect(values.process_defaults).toBe("set procdir = /data");
        expect(values.sestbl).toBe("");
        expect(values.station_list).toEqual(["arg.DYNA", "igs.braz"]);
    });
});

describe("buildProjectPayload", () => {
    it("manda las columnas por JSON con null en los opcionales vacios y sin archivos", () => {
        const values = projectToFormValues(gamit, project);
        const { fields, files } = buildProjectPayload(
            gamit,
            values,
            initialFileFieldsState(gamit, values),
        );
        expect(files).toBeUndefined();
        expect(fields).toMatchObject({
            project: "g2na",
            cluster_size: "25",
            overconst_action: null,
            solutions_dir: null,
            noftp: true,
            systems: ["G", "R"],
            station_list: ["arg.DYNA", "igs.braz"],
            process_defaults: "set procdir = /data",
            sestbl: "",
        });
    });

    it("con archivo separa el multipart y mantiene las listas vacias en el JSON", () => {
        const values = {
            ...projectToFormValues(gamit, project),
            systems: [],
            station_list: [],
        };
        const file = new File(["Session Table"], "sestbl.");
        const { fields, files } = buildProjectPayload(gamit, values, {
            process_defaults: { mode: "manual" },
            sestbl: { mode: "by file", file },
        });
        expect(fields.systems).toEqual([]);
        expect(fields.station_list).toEqual([]);
        expect(fields.process_defaults).toBe("set procdir = /data");
        expect("sestbl" in fields).toBe(false);
        expect(files).toBeInstanceOf(FormData);
        expect(files!.get("sestbl_by_file")).toBe(file);
        expect([...files!.keys()]).toEqual(["sestbl_by_file"]);
    });

    it("en modo by file sin archivo no manda el campo ni multipart", () => {
        const values = projectToFormValues(gamit, project);
        const { fields, files } = buildProjectPayload(gamit, values, {
            process_defaults: { mode: "by file" },
            sestbl: {},
        });
        expect(files).toBeUndefined();
        expect("process_defaults" in fields).toBe(false);
        expect(fields.sestbl).toBe("");
    });
});

describe("initialFileFieldsState", () => {
    it("arranca en Manual solo los archivos con contenido", () => {
        const state = initialFileFieldsState(
            gamit,
            projectToFormValues(gamit, project),
        );
        expect(state.process_defaults.mode).toBe("manual");
        expect(state.sestbl.mode).toBeUndefined();
    });
});

describe("missingRequiredFields", () => {
    it("detecta los NOT NULL vaciados por el usuario", () => {
        const values = { ...projectToFormValues(gamit, project), ties: " " };
        expect(missingRequiredFields(gamit, values).map((f) => f.name)).toEqual(
            ["ties"],
        );
    });
});

describe("mergeStationCodes", () => {
    it("deduplica sin distinguir mayusculas y conserva el case original", () => {
        const { merged, added } = mergeStationCodes(
            ["arg.DYNA"],
            ["ARG.dyna", "igs.braz", " igs.BRAZ ", ""],
        );
        expect(merged).toEqual(["arg.DYNA", "igs.braz"]);
        expect(added).toBe(1);
    });

    it("removeStationCode saca el codigo sin distinguir mayusculas", () => {
        expect(removeStationCode(["arg.DYNA", "igs.braz"], "ARG.DYNA")).toEqual(
            ["igs.braz"],
        );
    });

    it("sortByStationCode ordena por station code y luego por red, sin mutar", () => {
        const list = ["igs.braz", "arg.DYNA", "rms.dyna", "arg.abcd"];
        expect(sortByStationCode(list)).toEqual([
            "arg.abcd",
            "igs.braz",
            "arg.DYNA",
            "rms.dyna",
        ]);
        expect(list[0]).toBe("igs.braz");
    });
});
