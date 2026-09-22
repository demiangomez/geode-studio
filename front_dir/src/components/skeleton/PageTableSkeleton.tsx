// Título centrado (text-4xl font-bold) compartido por Campaigns/People/Overview/Sources/
// Networks/Events/Users/Settings
export const PageTitleSkeleton = () => (
    <div className="w-full flex justify-center my-6">
        <div
            className="skeleton h-12 w-80"
            style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
        ></div>
    </div>
);

interface TableCardSkeletonProps {
    contentHeight?: string;
    maxWidth?: string;
}

// Misma forma que TableCard: card clara con header (título + botón) y contenido más gris
export const TableCardSkeleton = ({
    contentHeight = "300px",
    maxWidth,
}: TableCardSkeletonProps) => (
    <div
        className="card bg-base-200 p-4 space-y-4 overflow-hidden w-full"
        style={maxWidth ? { maxWidth } : undefined}
    >
        <div className="flex w-full justify-between items-center flex-wrap gap-2">
            <div
                className="skeleton h-6 w-28"
                style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
            ></div>
            <div
                className="skeleton h-10 w-32"
                style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
            ></div>
        </div>
        <div
            className="skeleton w-full"
            style={{
                backgroundColor: "rgb(107 114 128 / 0.2)",
                height: contentHeight,
            }}
        ></div>
    </div>
);

// Campaigns/People/Networks/Sources/General Events: título + una tabla centrada
const PageTableSkeleton = () => (
    <div className="p-4">
        <PageTitleSkeleton />
        <div className="flex w-full justify-center">
            <TableCardSkeleton contentHeight="420px" maxWidth="1150px" />
        </div>
    </div>
);

export default PageTableSkeleton;
