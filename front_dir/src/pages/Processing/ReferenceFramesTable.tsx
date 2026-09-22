import { useMemo, useState } from "react";

import { Table, TableCard } from "@componentsReact";

import { useApi, useAuth } from "@hooks";
import { useReferenceFrames } from "@hooks/queries";

const TITLES = [
    "frame_name",
    "engine",
    "project",
    "fixed_plate",
    "constraints_id",
    "position_wrms",
    "velocity_wrms",
    "periodic_wrms",
    "euler_pole",
    "euler_pole_stations",
    "first_epoch",
    "last_epoch",
    "stacks_count",
    "created",
    "modified",
];

const listToText = (items: (number | string)[] | null) =>
    items?.join(", ") ?? "";

const ReferenceFramesTable = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const [filters, setFilters] = useState<Record<string, string>>({
        search: "",
    });

    // isLoading: con isFetching la tabla se vacia en cada refetch
    const { data: frames, isLoading } = useReferenceFrames(api);

    const filteredFrames = useMemo(() => {
        const term = filters.search.toLowerCase().trim();
        const list = frames ?? [];
        if (!term) return list;
        return list.filter((f) =>
            [
                f.frame_name,
                f.engine,
                f.project,
                f.fixed_plate,
                f.constraints_id,
            ].some((value) => value?.toLowerCase().includes(term)),
        );
    }, [frames, filters.search]);

    const body = useMemo(
        () =>
            filteredFrames.map((f) => [
                f.frame_name,
                f.engine,
                f.project,
                f.fixed_plate ?? "",
                f.constraints_id ?? "",
                f.position_wrms ?? "",
                f.velocity_wrms ?? "",
                listToText(f.periodic_wrms),
                listToText(f.euler_pole),
                listToText(f.euler_pole_stations),
                f.first_epoch ?? "",
                f.last_epoch ?? "",
                f.stacks_count,
                f.created,
                f.modified,
            ]),
        [filteredFrames],
    );

    return (
        <TableCard
            title="Reference Frames"
            size="100%"
            filters={filters}
            setFilters={setFilters}
            showSearch={true}
            searchPlaceholder="Search by name, engine, project..."
        >
            <Table
                table="Reference Frame"
                titles={body.length > 0 ? TITLES : []}
                body={body}
                loading={isLoading}
                dataOnly={true}
                onClickFunction={() => {}}
                dataFetchUrl="api/reference-frames"
            />
        </TableCard>
    );
};

export default ReferenceFramesTable;
