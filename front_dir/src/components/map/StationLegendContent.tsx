interface StationLegendContentProps {
    types: { id: number; name: string; image: string }[];
    statuses: { id: number; name: string; color: string }[];
    /** Version chica para superponer sobre un mapa: icono de 24px y una columna. */
    compact?: boolean;
}

const BASE64_PNG = "data:image/png;base64,";

const StationLegendContent = ({
    types,
    statuses,
    compact = false,
}: StationLegendContentProps) => {
    const section = compact
        ? "flex flex-col"
        : "card border-[1px] border-neutral-200 bg-base-200/30 flex flex-col h-fit";
    const body = compact ? "" : "p-4";
    const heading = compact
        ? "text-xs font-bold uppercase tracking-wide opacity-70 mb-1"
        : "text-lg font-bold mb-3 border-b pb-1 border-neutral-300";
    const list = compact
        ? "grid grid-cols-1 gap-y-1"
        : "grid grid-cols-2 gap-x-2 gap-y-3";
    const item = compact
        ? "flex items-center gap-2"
        : "flex items-center space-x-4";
    const label = compact ? "text-xs" : "font-medium text-sm";
    const iconPx = compact ? 24 : 40;

    return (
        <>
            <div className={section}>
                <div className={body}>
                    <h3 className={heading}>Types</h3>
                    <ul className={list}>
                        {types.map((t) => (
                            <li key={t.id} className={item}>
                                <img
                                    src={BASE64_PNG + t.image}
                                    alt={t.name}
                                    style={{ width: iconPx, height: iconPx }}
                                    className="object-contain pointer-events-none shrink-0"
                                />
                                <span className={label}>{t.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
            <div className={section}>
                <div className={body}>
                    <h3 className={heading}>Statuses</h3>
                    <ul className={list}>
                        {statuses.map((s) => (
                            <li key={s.id} className={item}>
                                <div
                                    style={{
                                        width: iconPx,
                                        height: iconPx,
                                        backgroundColor: "#000",
                                        borderRadius: "50%",
                                    }}
                                    className={`shrink-0 ${s.color}`}
                                ></div>
                                <span className={label}>{s.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
};

export default StationLegendContent;
