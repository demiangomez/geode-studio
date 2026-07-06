import { NetworksTable } from "@componentsReact";

const Networks = () => {
    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <span className="text-4xl font-bold"> Networks </span>
            </div>
            <div className="flex w-full justify-center">
                <NetworksTable />
            </div>
        </div>
    );
};

export default Networks;
