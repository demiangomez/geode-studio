import { Suspense, useState } from "react";
import { Link } from "react-router-dom";

import {
    ArrowRightEndOnRectangleIcon,
    MapIcon,
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
    ClipboardDocumentListIcon,
    GlobeAltIcon,
    RectangleStackIcon,
    Square3Stack3DIcon,
} from "@heroicons/react/24/outline";

import NavDropdown, { NavDropdownLink } from "@components/NavDropdown";
import useApi from "@hooks/useApi";
import { useAuth } from "@hooks/useAuth";
import { useServerHealth } from "@hooks/queries/useServerHealth";
import { jwtDeserializer, lazyRetry } from "@utils";

// Lazy: su subárbol (metadata, dropzone, pako, mapa) no debe entrar al chunk eager
const StationModal = lazyRetry(
    () => import("@components/modals/Station/StationModal/StationModal"),
);

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

    const createStation = () => {
        setModals({
            show: true,
            title: "station",
            type: "add",
        });
    };

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
                    <NavDropdown
                        title="Campaigns"
                        trigger={<TruckIcon className="size-8" />}
                    >
                        {(close) => (
                            <>
                                <NavDropdownLink
                                    to="/campaigns"
                                    icon={<TruckIcon className="size-6" />}
                                    label="Campaigns"
                                    onClick={close}
                                />
                                <NavDropdownLink
                                    to="/campaign-plans"
                                    icon={<MapIcon className="size-6" />}
                                    label="Plans"
                                    onClick={close}
                                />
                            </>
                        )}
                    </NavDropdown>
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
                    <Link
                        className="btn btn-ghost btn-circle"
                        to={"/events"}
                        title="General Events"
                    >
                        <ClipboardDocumentListIcon className="size-8" />
                    </Link>
                    <NavDropdown
                        title="Processing and Frames"
                        trigger={<Square3Stack3DIcon className="size-8" />}
                    >
                        {(close) => (
                            <>
                                <NavDropdownLink
                                    to="/processing-projects/gamit"
                                    icon={
                                        <RectangleStackIcon className="size-6" />
                                    }
                                    label="GAMIT Projects"
                                    onClick={close}
                                />
                                <NavDropdownLink
                                    to="/reference-frames"
                                    icon={<GlobeAltIcon className="size-6" />}
                                    label="Reference Frames"
                                    onClick={close}
                                />
                            </>
                        )}
                    </NavDropdown>
                    <NavDropdown
                        title="User"
                        trigger={
                            !userPhoto ? (
                                <UserCircleIcon className="size-8" />
                            ) : (
                                <img
                                    alt="User"
                                    className="rounded-full w-6 h-6"
                                    src={`data:image/*;base64,${userPhoto}`}
                                />
                            )
                        }
                        header={
                            <div className="border-b-[1px] border-gray-600 flex justify-center">
                                <span className="mb-2">
                                    <strong>{userName?.toUpperCase()}</strong>
                                </span>
                            </div>
                        }
                    >
                        {(close) => (
                            <>
                                <NavDropdownLink
                                    to="/users"
                                    icon={<UserGroupIcon className="size-6" />}
                                    label="Users"
                                    onClick={close}
                                />
                                <NavDropdownLink
                                    to="/settings"
                                    icon={<Cog6ToothIcon className="size-6" />}
                                    label="Settings"
                                    onClick={close}
                                />
                                <NavDropdownLink
                                    icon={
                                        <ArrowRightEndOnRectangleIcon className="size-6" />
                                    }
                                    label="Logout"
                                    onClick={logout}
                                />
                            </>
                        )}
                    </NavDropdown>
                </div>
            </div>
            {modals && modals.show && modals.title === "station" && (
                <Suspense fallback={null}>
                    <StationModal
                        handleCloseModal={() => {
                            setModals(undefined);
                            window.location.href = "/";
                        }}
                        setModals={setModals}
                    />
                </Suspense>
            )}
        </>
    );
};

export default Nav;
