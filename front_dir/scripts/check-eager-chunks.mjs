// Si openlayers/pdf/cesium aparecen en dist/index.html o en el closure estático
// de una página que no los usa, un import los arrastró (ver CLAUDE.md, "Eager-graph hygiene")
import { readFileSync, readdirSync } from "node:fs";

const html = readFileSync("dist/index.html", "utf8");
const eager = [
    ...new Set(
        [...html.matchAll(/\/assets\/(?:openlayers|pdf|cesium)-[^"']*/g)].map(
            (m) => m[0],
        ),
    ),
];
if (eager.length) {
    console.error("Heavy chunks in the eager graph (dist/index.html):");
    for (const o of eager) console.error(`  ${o}`);
    process.exit(1);
}

// Closure estático por chunk de página: qué termina descargando cada una
const files = readdirSync("dist/assets").filter((f) => f.endsWith(".js"));
const depsMap = {};
for (const f of files) {
    const code = readFileSync("dist/assets/" + f, "utf8");
    depsMap[f] = [
        ...new Set(
            [...code.matchAll(/(?:from|import)"\.\/([^"]+\.js)"/g)].map(
                (m) => m[1],
            ),
        ),
    ];
}
const closure = (start) => {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
        const f = queue.shift();
        for (const d of depsMap[f] ?? [])
            if (!seen.has(d)) {
                seen.add(d);
                queue.push(d);
            }
    }
    return [...seen];
};

// Chunks que legítimamente incluyen cada librería, por nombre exacto (con ancla:
// sin ella "Maintenance-x.js" pasaría como "Main"). Uno nuevo se agrega acá.
const nameBoundary = (names) => new RegExp(`^(?:${names.join("|")})(?:[-.]|$)`);

const ALLOWED = {
    openlayers: nameBoundary([
        "Main",
        "Station",
        "StationMain",
        "StationModal",
        "StationCreateMapOL",
        "Visits",
        "VisitThumbNail",
        "MapOL",
        "MapStationOL",
        "MapVisitOL",
        "MapModalOL",
        "Popup",
        "PopupChildren",
        "EarthQuakeScroller",
        "EarthQuakeFormModal",
        "ProcessingProjects",
        "CampaignPlanner",
        "olcs",
        "useCluster",
        "useMapInit",
    ]),
    pdf: nameBoundary(["RenderFileModal"]),
    cesium: /$^/,
};

const violations = [];
for (const page of files.filter((f) => /^[A-Z]/.test(f))) {
    const heavies = closure(page).filter((f) =>
        /^(openlayers|pdf|cesium)-/.test(f),
    );
    for (const h of heavies) {
        const lib = h.split("-")[0];
        if (!ALLOWED[lib].test(page)) violations.push(`${page} → ${h}`);
    }
}
if (violations.length) {
    console.error("Pages statically pulling heavy chunks they must not:");
    for (const v of [...new Set(violations)]) console.error(`  ${v}`);
    console.error("Fix the import chain or extend ALLOWED if the use is real.");
    process.exit(1);
}
console.log(
    "check-eager-chunks: OK — entry limpio y openlayers/pdf/cesium solo en sus páginas",
);
