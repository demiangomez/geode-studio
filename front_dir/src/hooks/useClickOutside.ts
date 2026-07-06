import { RefObject, useEffect, useRef } from "react";

type Target = RefObject<HTMLElement | null>;

const useClickOutside = (
    refs: Target | Target[],
    onOutside: () => void,
    enabled = true,
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
        document.addEventListener("mousedown", listener);
        return () => document.removeEventListener("mousedown", listener);
    }, [enabled]);
};

export default useClickOutside;
