import { Navigate, useParams } from "react-router-dom";

import ProcessingProjectsTable from "./ProcessingProjectsTable";
import { getProcessingEngine } from "./engines";

const ProcessingProjects = () => {
    const { engine: engineKey } = useParams();
    const engine = getProcessingEngine(engineKey);

    if (!engine) return <Navigate to="/reference-frames" replace />;

    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <span className="text-4xl font-bold">
                    {engine.label} Projects
                </span>
            </div>
            <div className="flex w-full justify-center">
                <ProcessingProjectsTable key={engine.key} engine={engine} />
            </div>
        </div>
    );
};

export default ProcessingProjects;
