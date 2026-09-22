import { PageTitleSkeleton, TableCardSkeleton } from "./PageTableSkeleton";

// Overview: mismo grid/col-switch real (4 tablas), con 2 alcanza para el fallback
const PageTablesGridSkeleton = () => (
    <div className="p-4">
        <PageTitleSkeleton />
        <div className="w-full grid grid-cols-2 grid-flow-dense gap-4 my-6 xl:grid-cols-1">
            <div className="flex flex-col space-y-4 items-end xl:items-center">
                <TableCardSkeleton contentHeight="260px" maxWidth="800px" />
            </div>
            <div className="flex flex-col items-start space-y-4 xl:items-center">
                <TableCardSkeleton contentHeight="260px" maxWidth="800px" />
            </div>
        </div>
    </div>
);

export default PageTablesGridSkeleton;
