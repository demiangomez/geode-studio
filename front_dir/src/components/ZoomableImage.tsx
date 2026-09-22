interface Props {
    src: string;
    alt: string;
    zoom: number;
    origin: { x: number; y: number };
    pan: { x: number; y: number };
    isDragging: boolean;
    boxRef: React.RefObject<HTMLDivElement>;
    handleWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
    handlePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    handlePointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    handlePointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    // aspect ratio real de la imagen cargada, para que el zoom/pan sepan
    // cuanto ocupa dentro de la caja
    onNaturalSize?: (aspectRatio: number) => void;
}

// resta el espacio fijo de toolbar/padding/descripcion para no superar el
// max-height del modal (evita el scroll interno que competia con el zoom)
const BOX_CLASS = "w-full h-[calc(100vh-290px)]";

const ZoomableImage = ({
    src,
    alt,
    zoom,
    origin,
    pan,
    isDragging,
    boxRef,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    onNaturalSize,
}: Props) => {
    return (
        <div
            ref={boxRef}
            className={`${BOX_CLASS} mx-auto overflow-hidden relative rounded flex items-center justify-center touch-none select-none ${
                isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        >
            <img
                src={src}
                alt={alt}
                className="w-full h-full object-contain select-none"
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: `${origin.x}% ${origin.y}%`,
                }}
                draggable={false}
                onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.currentTarget;
                    if (naturalWidth && naturalHeight) {
                        onNaturalSize?.(naturalWidth / naturalHeight);
                    }
                }}
            />
        </div>
    );
};

export default ZoomableImage;
