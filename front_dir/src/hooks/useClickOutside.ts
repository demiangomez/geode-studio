import { RefObject, useEffect, useRef } from "react";

type Target = RefObject<HTMLElement | null>;

/**
 * `eventType`: por defecto `mousedown`, que cierra antes de que el click se
 * complete. Si al cerrarse el layout se acorta (p.ej. un desplegable que vive
 * en el flujo), el boton que estabas apretando se mueve y el click nunca le
 * llega: ahi hay que usar `click`, que resuelve el target antes de cerrar.
 */
const useClickOutside = (
    refs: Target | Target[],
    onOutside: () => void,
    enabled = true,
    eventType: "mousedown" | "click" = "mousedown",
) => {
    const handlerRef = useRef(onOutside);
    handlerRef.current = onOutside;
    const refsRef = useRef(refs);
    refsRef.current = refs;

    useEffect(() => {
        if (!enabled) return;
        const listener = (e: MouseEvent) => {
            const list = Array.isArray(refsRef.current)
                ? refsRef.current
                : [refsRef.current];
            const attached = list.filter((r) => r.current);
            if (
                attached.length > 0 &&
                !attached.some((r) => r.current?.contains(e.target as Node))
            ) {
                handlerRef.current();
            }
        };
        document.addEventListener(eventType, listener);
        return () => document.removeEventListener(eventType, listener);
    }, [enabled, eventType]);
};

export default useClickOutside;
