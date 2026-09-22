import { PageTitleSkeleton, TableCardSkeleton } from "./PageTableSkeleton";

// Users/Settings: mismo col↔row real (2xl:flex-row), 2 tablas
const PageTablesRowSkeleton = () => (
    <div className="p-4">
        <PageTitleSkeleton />
        <div className="flex flex-col 2xl:flex-row 2xl:items-start items-center gap-4 justify-center">
            <TableCardSkeleton contentHeight="280px" maxWidth="750px" />
            <TableCardSkeleton contentHeight="280px" maxWidth="750px" />
        </div>
    </div>
);

export default PageTablesRowSkeleton;
