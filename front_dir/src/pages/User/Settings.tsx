import { useEffect } from "react";

import {
    PeopleSettingsForm,
    SquareSkeleton,
    UserSettingsForm,
} from "@componentsReact";

import { useAuth } from "@hooks";

const Settings = () => {
    const { user, getUserData } = useAuth();

    useEffect(() => {
        getUserData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="p-4">
            <div className="w-full text-center my-6">
                <h3 className="text-4xl font-bold">Settings</h3>
            </div>
            {user ? (
                <div className="flex flex-col 2xl:flex-row 2xl:items-start items-center gap-4 justify-center">
                    <div className="flex-1 w-full">
                        <UserSettingsForm
                            userData={user}
                            getData={getUserData}
                        />
                    </div>
                    <div className="flex-1 w-full min-w-0">
                        <PeopleSettingsForm
                            person={user.person ?? null}
                            getData={getUserData}
                        />
                    </div>
                </div>
            ) : (
                <div className="w-full h-full grid grid-cols-2 mt-20">
                    <SquareSkeleton mainSize="500px" />
                    <SquareSkeleton mainSize="500px" />
                </div>
            )}
        </div>
    );
};

export default Settings;
