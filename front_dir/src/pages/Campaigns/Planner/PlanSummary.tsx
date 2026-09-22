import { CampaignPlanResult } from "@types";

import { formattedDates } from "@utils";

import { dayColor, formatDriveMinutes } from "./plannerForm";

const STOP_TYPE_LABEL: Record<string, string> = {
    origin: "Origin",
    station: "Station",
    new_site: "New site",
    intermediate: "Overnight",
    destination: "Destination",
};

const PlanSummary = ({ plan }: { plan: CampaignPlanResult }) => {
    const { summary } = plan;
    // Los costos en 0 no se muestran, como en el HTML del plan
    const showFuel = summary.total_fuel_cost > 0;
    const tiles = [
        ["Total distance", `${summary.total_km.toFixed(1)} km`],
        ["Drive time", formatDriveMinutes(summary.total_drive_minutes)],
        showFuel && ["Fuel", `$${summary.total_fuel_cost.toFixed(2)}`],
        summary.total_lodging_cost > 0 && [
            "Lodging",
            `$${summary.total_lodging_cost.toFixed(2)}`,
        ],
        summary.total_per_diem_cost > 0 && [
            "Per diem",
            `$${summary.total_per_diem_cost.toFixed(2)}`,
        ],
        [
            "Days · Stops · People",
            `${summary.total_days} · ${summary.total_stations} · ${summary.num_participants}`,
        ],
    ].filter(Boolean) as [string, string][];

    return (
        <div className="card bg-base-200 shadow-xl">
            <h2 className="card-title border-b-2 border-base-300 p-2 justify-between">
                <span>Plan</span>
                <span className="text-sm font-normal opacity-70">
                    Opened in a new tab · print it to PDF from there
                </span>
            </h2>
            <div className="flex flex-col gap-3 p-3">
                <div className="grid grid-cols-3 2xl:grid-cols-6 gap-2">
                    {tiles.map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-md bg-neutral-content p-3 flex flex-col"
                        >
                            <span className="text-xs uppercase opacity-70">
                                {label}
                            </span>
                            <span className="text-xl font-bold">{value}</span>
                        </div>
                    ))}
                </div>

                {plan.days.map((day) => (
                    <div
                        key={day.day_number}
                        className="rounded-md bg-neutral-content overflow-x-auto"
                    >
                        <div className="flex items-center gap-2 p-2 font-bold">
                            <span
                                className="inline-block size-3 rounded-full"
                                style={{ background: dayColor(day.day_number) }}
                            />
                            Day {day.day_number} —{" "}
                            {formattedDates(day.date, true)}
                            <span className="ml-auto font-normal opacity-70 whitespace-nowrap">
                                {day.day_total_km.toFixed(1)} km ·{" "}
                                {formatDriveMinutes(
                                    day.day_total_drive_minutes,
                                )}
                                {showFuel &&
                                    ` · $${day.day_total_fuel_cost.toFixed(2)}`}
                            </span>
                        </div>
                        <table className="table table-sm">
                            <thead>
                                <tr>
                                    <th>Stop</th>
                                    <th>Type</th>
                                    <th>Arrival</th>
                                    <th>Departure</th>
                                    <th className="text-right">Leg km</th>
                                    <th className="text-right">Drive</th>
                                    {showFuel && (
                                        <th className="text-right">Fuel</th>
                                    )}
                                    <th>Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {day.stops.map((stop, index) => (
                                    <tr key={`${day.day_number}-${index}`}>
                                        <td>
                                            {stop.type === "station" &&
                                            stop.code
                                                ? `${stop.code.toUpperCase()} · ${stop.name}`
                                                : stop.name}
                                        </td>
                                        <td>
                                            {STOP_TYPE_LABEL[stop.type] ??
                                                stop.type}
                                        </td>
                                        <td>{stop.arrival ?? "—"}</td>
                                        <td>{stop.departure ?? "—"}</td>
                                        <td className="text-right">
                                            {stop.leg_km.toFixed(1)}
                                        </td>
                                        <td className="text-right">
                                            {formatDriveMinutes(
                                                stop.leg_drive_minutes,
                                            )}
                                        </td>
                                        {showFuel && (
                                            <td className="text-right">
                                                {stop.leg_fuel_cost.toFixed(2)}
                                            </td>
                                        )}
                                        <td className="opacity-70">
                                            {stop.warning ?? ""}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlanSummary;
