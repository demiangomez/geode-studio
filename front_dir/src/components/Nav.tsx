import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
    ArrowRightEndOnRectangleIcon,
    TruckIcon,
    PlusIcon,
    ServerIcon,
    Squares2X2Icon,
    UserCircleIcon,
    UserGroupIcon,
    ServerStackIcon,
    ShareIcon,
    Cog6ToothIcon,
    UsersIcon,
} from "@heroicons/react/24/outline";

import StationModal from "@components/modals/Station/StationModal/StationModal";

import { useApi, useAuth, useClickOutside } from "@hooks";
import { useServerHealth } from "@hooks/queries";
import { jwtDeserializer, showModal } from "@utils";

const Nav = () => {
    const { logout, token, userPhoto } = useAuth();
    const api = useApi(token, logout);

    const tokenDeserialized = jwtDeserializer(token as string);
    const userName = tokenDeserialized?.username;

    const { status: healthStatus, title: healthTitle } = useServerHealth(api);

    const [modals, setModals] = useState<
        | { show: boolean; title: string; type: "add" | "edit" | "none" }
        | undefined
    >(undefined);

    const [isDroped, setIsDroped] = useState<boolean>(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const createStation = () => {
        setModals({
            show: true,
            title: "station",
            type: "add",
        });
    };

    useClickOutside(dropdownRef, () => setIsDroped(false), isDroped);

    useEffect(() => {
        modals?.show && showModal(modals.title);
    }, [modals]);

    return (
        <>
            <div
                className="navbar bg-gray-800 text-white"
                style={{ maxHeight: "none", minHeight: "8vh" }}
            >
                <div className="navbar-start">
                    <div className="indicator ml-4" title={healthTitle}>
                        <ServerIcon
                            fill="none"
                            className="size-7"
                            strokeWidth={2}
                        />
                        <span
                            className={`badge badge-xs badge-${healthStatus} indicator-item`}
                        ></span>
                    </div>
                </div>
                <div className="navbar-center font-montserrat">
                    <Link
                        to={"/"}
                        className="text-2xl font-semibold tracking-tight"
                    >
                        GeoDE
                    </Link>
                </div>
                <div className="navbar-end flex flex-row items-center justify-center gap-2">
                    <div
                        className="btn btn-ghost btn-circle"
                        title="Create Station"
                    >
                        <PlusIcon className="size-8" onClick={createStation} />
                    </div>
                    <Link
                        className="btn btn-ghost btn-circle"
                        to={"/campaigns"}
                        title="Campaigns"
                    >
                        <TruckIcon className="size-8" />
                    </Link>
                    <Link
                        className="btn btn-ghost btn-circle"
                        to={"/people"}
                        title="People"
                    >
                        <UsersIcon className="size-8" />
                    </Link>
                    <Link
                        className="btn btn-ghost btn-circle"
                        to={"/overview"}
                        title="Overview"
                    >
                        <Squares2X2Icon className="size-8" />
                    </Link>
                    <Link
                        className="btn btn-ghost btn-circle"
                        to={"/sources"}
                        title="Sources Servers"
                    >
                        <ServerStackIcon className="size-8" />
                    </Link>
                    <Link
                        className="btn btn-ghost btn-circle"
                        to={"/networks"}
                        title="Networks"
                    >
                        <ShareIcon className="size-8" />
                    </Link>
                    <div className="" ref={dropdownRef}>
                        <div
                            tabIndex={0}
                            role="button"
                            className="btn btn-ghost btn-circle avatar"
                            title="User"
                            onClick={() => setIsDroped((prev) => !prev)}
                        >
                            {!userPhoto ? (
                                <UserCircleIcon className="size-8" />
                            ) : (
                                <img
                                    alt="User"
                                    className="rounded-full w-6 h-6"
                                    src={`data:image/*;base64,${userPhoto}`}
                                />
                            )}
                        </div>

                        {isDroped && (
                            <ul
                                tabIndex={0}
                                className="menu menu-sm mt-3 absolute right-1 top-[70px] z-[10000000000000000] space-y-1 p-2 shadow bg-gray-800 border-[1px] border-gray-600 rounded-box w-52"
                            >
                                <div className=" border-b-[1px] border-gray-600 flex justify-center">
                                    <span className="mb-2">
                                        <strong>
                                            {userName?.toUpperCase()}
                                        </strong>
                                    </span>
                                </div>
                                <li className="">
                                    <Link
                                        className="hover:bg-slate-600 flex justify-start focus:text-primary"
                                        to={"/users"}
                                        onClick={() =>
                                            setIsDroped((prev) => !prev)
                                        }
                                    >
                                        <UserGroupIcon className="size-6" />
                                        <span className="ml-[40px]">Users</span>
                                    </Link>
                                </li>
                                <li className="">
                                    <Link
                                        className="hover:bg-slate-600 flex justify-start focus:text-primary"
                                        to={"/settings"}
                                        onClick={() =>
                                            setIsDroped((prev) => !prev)
                                        }
                                    >
                                        <Cog6ToothIcon className="size-6" />
                                        <span className="ml-[40px]">
                                            Settings
                                        </span>
                                    </Link>
                                </li>
                                <li className="">
                                    <a
                                        className="hover:bg-slate-600 flex w-full justify-start"
                                        onClick={() => {
                                            logout();
                                        }}
                                    >
                                        <ArrowRightEndOnRectangleIcon className="size-6" />
                                        <span className="ml-[40px]">
                                            Logout
                                        </span>
                                    </a>
                                </li>
                            </ul>
                        )}
                    </div>
                </div>
            </div>
            {modals && modals.show && modals.title === "station" && (
                <StationModal
                    handleCloseModal={() => {
                        setModals(undefined);
                        window.location.href = "/";
                    }}
                    setModals={setModals}
                />
            )}
        </>
    );
};

export default Nav;
