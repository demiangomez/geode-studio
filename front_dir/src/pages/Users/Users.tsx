import { RolesTable, UsersTable } from "@componentsReact";

const Users = () => {
    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <span className="text-4xl font-bold">Users</span>
            </div>
            <div className="flex flex-col 2xl:flex-row 2xl:items-start items-center gap-4 justify-center">
                <UsersTable />
                <RolesTable />
            </div>
        </div>
    );
};

export default Users;
