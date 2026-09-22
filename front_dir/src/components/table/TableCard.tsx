import { ReactNode } from "react";

interface TableCardProps {
    title: string;
    size?: string;
    addButton?: boolean;
    addButtonTitle?: string;
    modalTitle?: string;
    setModals?: React.Dispatch<
        React.SetStateAction<
            | { show: boolean; title: string; type: "add" | "edit" | "none" }
            | undefined
        >
    >;
    headerContent?: ReactNode;
    /** Acciones propias de la tabla, a la izquierda de los botones de alta. */
    headerActions?: ReactNode;
    children: ReactNode;
    secondAddButton?: boolean;
    secondAddButtonTitle?: string;
    secondModalTitle?: string;
    filters?: Record<string, string>;
    setFilters?: (filters: Record<string, string>) => void;
    showSearch?: boolean;
    searchPlaceholder?: string;
}

const TableCard = ({
    title,
    size,
    addButton,
    modalTitle,
    addButtonTitle,
    setModals,
    headerContent,
    headerActions,
    children,
    secondAddButton,
    secondAddButtonTitle,
    secondModalTitle,
    filters,
    setFilters,
    showSearch = false,
    searchPlaceholder = "Search...",
}: TableCardProps) => {
    // size es un tope, no un ancho fijo: en pantallas mas angostas el card se
    // encoge y la tabla scrollea adentro en vez de desbordar el body
    const maxWidth = size
        ? title.includes("Station")
            ? Math.max(750, parseInt(size)) + "px"
            : size
        : undefined;

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (setFilters && filters) {
            setFilters({ ...filters, search: e.target.value });
        }
    };

    return (
        <div
            className={`flex flex-col ${size ? "w-full" : "w-fit"}`}
            style={{ maxWidth }}
        >
            <div className="card bg-base-200 p-4 space-y-2 h-full">
                <div className="flex w-full justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="card-title">{title}</h2>
                        {headerContent}
                    </div>
                    <div className="flex flex-row justify-end gap-3 items-center flex-wrap">
                        {headerActions}
                        {showSearch && (
                            <div className="w-64">
                                <input
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    className="input input-bordered w-full"
                                    value={filters?.search || ""}
                                    onChange={handleSearchChange}
                                />
                            </div>
                        )}
                        {secondAddButton ? (
                            <div className="flex justify-end">
                                <button
                                    className="btn btn-neutral self-end no-animation"
                                    onClick={() =>
                                        setModals &&
                                        setModals({
                                            show: true,
                                            title: secondModalTitle ?? "",
                                            type: "add",
                                        })
                                    }
                                >
                                    {secondAddButtonTitle}
                                </button>
                            </div>
                        ) : null}
                        {addButton ? (
                            <div className="flex justify-end">
                                <button
                                    className="btn btn-neutral self-end no-animation"
                                    onClick={() =>
                                        setModals &&
                                        setModals({
                                            show: true,
                                            title: modalTitle ?? "",
                                            type: "add",
                                        })
                                    }
                                >
                                    {addButtonTitle}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
};

export default TableCard;
