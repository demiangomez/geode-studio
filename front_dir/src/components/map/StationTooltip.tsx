import { forwardRef } from "react";

/** Etiqueta flotante que StationCreateMapOL mueve con el overlay de OL. */
const StationTooltip = forwardRef<HTMLDivElement>((_, ref) => (
    <div
        ref={ref}
        style={{
            display: "none",
            position: "absolute",
            background: "white",
            padding: "4px 8px",
            borderRadius: "4px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            fontSize: "14px",
            fontWeight: "bold",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 2000,
        }}
    />
));

export default StationTooltip;
