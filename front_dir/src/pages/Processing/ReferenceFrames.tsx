import ReferenceFramesTable from "./ReferenceFramesTable";

const ReferenceFrames = () => (
    <div className="p-4">
        <div className="w-full text-center my-6">
            <span className="text-4xl font-bold">Reference Frames</span>
        </div>
        <div className="flex w-full justify-center">
            <ReferenceFramesTable />
        </div>
    </div>
);

export default ReferenceFrames;
