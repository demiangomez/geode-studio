const TemporalBarSkeleton = () => {
    return (
        <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[100002] bg-[#2D3748] rounded-xl px-8 pb-6 pt-4 w-[800px] max-w-[95vw] shadow-2xl"
            style={{
                boxShadow:
                    "0 10px 25px -5px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
        >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#2D3748] rounded-t-lg px-6 py-1">
                <div
                    className="skeleton w-4 h-4 rounded-full"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
                />
            </div>

            <div
                className="skeleton w-full h-1.5 rounded-full my-4"
                style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
            />

            <div className="flex justify-between mt-1 mb-4">
                <div
                    className="skeleton w-8 h-3 rounded"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
                />
                <div
                    className="skeleton w-8 h-3 rounded"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
                />
            </div>

            <div className="flex items-center justify-center gap-4">
                <div
                    className="skeleton w-32 h-8 rounded-lg"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
                />
                <div
                    className="skeleton w-32 h-8 rounded-lg"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
                />

                <div
                    className="skeleton flex gap-3 rounded-lg px-4 py-1.5 w-64 h-8"
                    style={{ backgroundColor: "rgb(107 114 128 / 0.3)" }}
                />
            </div>
        </div>
    );
};

export default TemporalBarSkeleton;
