interface PhotoSkeletonProps {
    count?: number;
}

// Replica la grilla real de fotos para evitar salto de layout (CLS).
const PhotoSkeleton = ({ count = 4 }: PhotoSkeletonProps) => {
    return (
        <div className="grid grid-cols-2 w-full gap-6 overflow-auto pr-2">
            {Array.from({ length: count }).map((_, idx) => (
                <div
                    key={"photo-skeleton-" + String(idx)}
                    className="skeleton h-80 rounded-md"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.2)" }}
                ></div>
            ))}
        </div>
    );
};

export default PhotoSkeleton;
