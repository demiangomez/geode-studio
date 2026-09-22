import { useRef, useState } from "react";

interface UseCursorZoomOptions {
    min?: number;
    max?: number;
    step?: number;
    wheelStep?: number;
    // aspect ratio real del contenido (ej. naturalWidth/naturalHeight); sin
    // esto se asume que llena la caja entera.
    contentAspectRatio?: number;
}

interface Rect {
    width: number;
    height: number;
}

// con object-contain el <img> mide toda la caja aunque lo pintado sea mas
// chico (letterbox): esto calcula el rectangulo real ocupado.
export const getContentBox = (rect: Rect, aspectRatio: number | undefined) => {
    if (!aspectRatio || !rect.width || !rect.height) {
        return { left: 0, top: 0, width: rect.width, height: rect.height };
    }
    const boxAspectRatio = rect.width / rect.height;
    let width = rect.width;
    let height = rect.height;
    if (aspectRatio > boxAspectRatio) {
        height = rect.width / aspectRatio;
    } else {
        width = rect.height * aspectRatio;
    }
    return {
        left: (rect.width - width) / 2,
        top: (rect.height - height) / 2,
        width,
        height,
    };
};

// si el contenido escalado sigue siendo mas chico que la caja en ese eje,
// ningun pan cubre los dos bordes a la vez: se fija centrado en su lugar.
export const getAxisPanRange = (
    boxSize: number,
    contentPos: number,
    contentSize: number,
    originPx: number,
    zoom: number,
): [number, number] => {
    if (contentSize * zoom <= boxSize) {
        const center = contentPos + contentSize / 2;
        const centered = boxSize / 2 - originPx - zoom * (center - originPx);
        return [centered, centered];
    }
    return [
        boxSize - originPx - (contentPos + contentSize - originPx) * zoom,
        -(originPx + (contentPos - originPx) * zoom),
    ];
};

// Zoom anclado al punto del cursor/click, como el zoom de un mapa: el
// contenedor de referencia (boxRef) nunca cambia de tamaño, solo el
// transform del contenido. El click/wheel llegan en coordenadas de
// pantalla, pero transform-origin se interpreta sobre la caja SIN
// transformar -> hay que invertir el zoom/origen vigentes para encontrar a
// que punto del contenido corresponde el evento (si no, con zoom > 1 el
// punto nuevo queda desalineado del click real).
//
// Ademas soporta pan: mantener apretado y arrastrar mueve el contenido
// (transform: translate(pan) scale(zoom) — el translate se aplica en
// pixeles de pantalla sin importar el zoom, asi el arrastre sigue al mouse
// 1:1). Un click sin arrastre real sigue siendo zoom-in centrado ahi; solo
// mouse (pointer capture), no hay gesto de pinch para mobile.
const DRAG_THRESHOLD_PX = 4;

export default function useCursorZoom({
    min = 1,
    max = 4,
    step = 0.5,
    wheelStep = 0.25,
    contentAspectRatio,
}: UseCursorZoomOptions = {}) {
    const [zoom, setZoom] = useState(1);
    const [origin, setOrigin] = useState({ x: 50, y: 50 });
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);

    const boxRef = useRef<HTMLDivElement>(null);
    const dragState = useRef<{
        startX: number;
        startY: number;
        panX: number;
        panY: number;
        moved: boolean;
    } | null>(null);

    const zoomAtPoint = (
        clientX: number,
        clientY: number,
        nextZoom: number,
    ) => {
        const box = boxRef.current;
        if (box) {
            const rect = box.getBoundingClientRect();
            const content = getContentBox(rect, contentAspectRatio);

            // si el evento cae en la franja invisible del letterbox en un
            // eje, se ancla al centro de ESE eje en vez de zoomear al vacio
            const rawX = content.width
                ? (clientX - rect.left - content.left) / content.width
                : 0.5;
            const rawY = content.height
                ? (clientY - rect.top - content.top) / content.height
                : 0.5;
            const contentFracX = rawX < 0 || rawX > 1 ? 0.5 : rawX;
            const contentFracY = rawY < 0 || rawY > 1 ? 0.5 : rawY;

            // transform-origin es relativo a la caja, no al contenido
            const clickX = content.width
                ? (content.left + contentFracX * content.width) / rect.width
                : 0.5;
            const clickY = content.height
                ? (content.top + contentFracY * content.height) / rect.height
                : 0.5;
            const originX = origin.x / 100;
            const originY = origin.y / 100;
            const pointX = originX + (clickX - originX) / zoom;
            const pointY = originY + (clickY - originY) / zoom;
            setOrigin({
                x: Math.min(100, Math.max(0, pointX * 100)),
                y: Math.min(100, Math.max(0, pointY * 100)),
            });
        }
        setPan({ x: 0, y: 0 });
        setZoom(nextZoom);
    };

    const zoomIn = () => setZoom((z) => Math.min(max, +(z + step).toFixed(2)));
    const zoomOut = () => {
        setPan({ x: 0, y: 0 });
        setZoom((z) => Math.max(min, +(z - step).toFixed(2)));
    };

    const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
        e.preventDefault();
        const next =
            e.deltaY < 0
                ? Math.min(max, +(zoom + wheelStep).toFixed(2))
                : Math.max(min, +(zoom - wheelStep).toFixed(2));
        zoomAtPoint(e.clientX, e.clientY, next);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dragState.current = {
            startX: e.clientX,
            startY: e.clientY,
            panX: pan.x,
            panY: pan.y,
            moved: false,
        };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragState.current;
        // a zoom <= 1 el contenido no excede la caja, no hay nada que
        // desplazar: se ignora el movimiento asi el gesto sigue contando
        // como un click (zoom-in) al soltar, en vez de un pan sin efecto
        if (!drag || zoom <= 1) return;

        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;

        if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            drag.moved = true;
            setIsDragging(true);
        }

        if (drag.moved) {
            const box = boxRef.current;
            if (box) {
                const rect = box.getBoundingClientRect();
                const content = getContentBox(rect, contentAspectRatio);
                // origin.x/y son % de la caja, convertidos aca a pixeles
                const originX = (origin.x / 100) * rect.width;
                const originY = (origin.y / 100) * rect.height;
                const [minPanX, maxPanX] = getAxisPanRange(
                    rect.width,
                    content.left,
                    content.width,
                    originX,
                    zoom,
                );
                const [minPanY, maxPanY] = getAxisPanRange(
                    rect.height,
                    content.top,
                    content.height,
                    originY,
                    zoom,
                );
                setPan({
                    x: Math.min(maxPanX, Math.max(minPanX, drag.panX + dx)),
                    y: Math.min(maxPanY, Math.max(minPanY, drag.panY + dy)),
                });
            }
        }
    };

    // sin arrastre real = fue un click -> zoom in centrado ahi; con
    // arrastre = fue un pan, no dispara zoom
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragState.current;
        if (drag && !drag.moved && zoom < max) {
            zoomAtPoint(
                e.clientX,
                e.clientY,
                Math.min(max, +(zoom + step).toFixed(2)),
            );
        }
        dragState.current = null;
        setIsDragging(false);
    };

    return {
        zoom,
        origin,
        pan,
        isDragging,
        boxRef,
        zoomIn,
        zoomOut,
        handleWheel,
        handlePointerDown,
        handlePointerMove,
        handlePointerUp,
        min,
        max,
    };
}
