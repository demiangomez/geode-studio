import { ReactNode, Suspense } from "react";
import { queryClient } from "@queryClient";

import {
    Route,
    createBrowserRouter,
    RouterProvider,
    createRoutesFromElements,
} from "react-router-dom";

import { QueryClientProvider } from "@tanstack/react-query";

import { ProtectedRoute, UnprotectedRoute } from "@routes";

import { AuthProvider } from "@hooks/useAuth";
import { UserContextProvider } from "@hooks/user/userInfo.context";

import MapSkeleton from "@components/skeleton/MapSkeleton";
import StationSkeleton from "@components/skeleton/StationSkeleton";
import StationMapPhotoSkeleton from "@components/skeleton/StationMapPhotoSkeleton";
import StationTabSkeleton from "@components/skeleton/StationTabSkeleton";
import PageTableSkeleton from "@components/skeleton/PageTableSkeleton";
import PageTablesGridSkeleton from "@components/skeleton/PageTablesGridSkeleton";
import PageTablesRowSkeleton from "@components/skeleton/PageTablesRowSkeleton";
import Spinner from "@components/Spinner";

/**
 * Cuando un import falla el navegador vuelve a pedir el archivo en vez de fallar
 * esto es útil para cuando cambia el hash del archivo
 */
import { lazyRetry } from "@utils";

// Lazy load pages
const Error = lazyRetry(() => import("./pages/Error"));
const Login = lazyRetry(() => import("./pages/Login"));
const Main = lazyRetry(() => import("./pages/Main"));
const Users = lazyRetry(() => import("./pages/Users/Users"));
const Station = lazyRetry(() => import("./pages/Station/Station"));
const Overview = lazyRetry(() => import("./pages/Overview/Overview"));
const Networks = lazyRetry(() => import("./pages/Networks/Networks"));
const Campaigns = lazyRetry(() => import("./pages/Campaigns/Campaigns"));
const Settings = lazyRetry(() => import("./pages/User/Settings"));
const PeopleRelations = lazyRetry(() => import("./pages/People/People"));
const GeneralEvents = lazyRetry(() => import("./pages/Events/Events"));

// Lazy load components
const StationEvents = lazyRetry(() => import("./pages/Station/Events/Events"));
const StationMain = lazyRetry(() => import("./components/station/StationMain"));
const StationPeople = lazyRetry(() => import("./pages/Station/People"));
const StationRinex = lazyRetry(() => import("./pages/Station/Rinex/Rinex"));
const StationTimeSeries = lazyRetry(() => import("./pages/Station/TimeSeries"));
const StationVisits = lazyRetry(() => import("./pages/Station/Visits"));
const StationSources = lazyRetry(() => import("./pages/Station/Sources"));
const SourcesServers = lazyRetry(
    () => import("./pages/SourcesServers/Sources"),
);
const ReferenceFrames = lazyRetry(
    () => import("./pages/Processing/ReferenceFrames"),
);
const ProcessingProjects = lazyRetry(
    () => import("./pages/Processing/Projects/ProcessingProjects"),
);
const CampaignPlans = lazyRetry(
    () => import("./pages/Campaigns/Planner/CampaignPlans"),
);
const CampaignPlanner = lazyRetry(
    () => import("./pages/Campaigns/Planner/CampaignPlanner"),
);

// Red de seguridad del Suspense raíz (login y casos borde, sin Layout montado)
const LoadingFallback = () => (
    <div className="flex items-center justify-center h-screen w-screen bg-base-200">
        <Spinner size="lg" />
    </div>
);

const PageFallback = () => (
    <div className="flex flex-1 items-center justify-center min-h-[92vh]">
        <Spinner size="lg" />
    </div>
);

const MapFallback = () => (
    <div className="my-auto flex flex-1 transition-all duration-200 relative">
        <MapSkeleton
            styles={{
                backgroundColor: "rgb(202, 202, 202)",
                zIndex: 1000000000000000,
                width: "100vw",
                position: "absolute",
                height: "92vh",
            }}
        />
    </div>
);

// Misma forma que Station muestra mientras carga sus datos (Sidebar/título reales, no genérico)
const StationFallback = () => (
    <div className="max-h-[92vh] transition-all duration-200">
        <StationSkeleton />
    </div>
);

const withSuspense = (
    element: ReactNode,
    fallback: ReactNode = <PageFallback />,
) => <Suspense fallback={fallback}>{element}</Suspense>;

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path="/auth" element={<UnprotectedRoute />}>
                <Route path="login" element={withSuspense(<Login />)} />
                <Route path="*" element={withSuspense(<Error />)} />
            </Route>
            <Route
                path="/"
                element={<ProtectedRoute />} // Aquí debe estar la lógica de autorización
                handle={{
                    crumb: () => {
                        return "Home";
                    },
                }}
            >
                <Route
                    index
                    element={withSuspense(<Main />, <MapFallback />)}
                    handle={{ title: "Mapview" }}
                />
                <Route
                    path="campaigns"
                    element={withSuspense(<Campaigns />, <PageTableSkeleton />)}
                    handle={{
                        crumb: () => {
                            return "campaigns";
                        },
                        title: "Campaigns",
                    }}
                />
                {/* Sin element: renderiza el Outlet, y el crumb del padre es el link de vuelta a la lista */}
                <Route
                    path="campaign-plans"
                    handle={{
                        crumb: () => {
                            return "campaign-plans";
                        },
                    }}
                >
                    <Route
                        index
                        element={withSuspense(
                            <CampaignPlans />,
                            <PageTableSkeleton />,
                        )}
                        handle={{ title: "Campaign Plans" }}
                    />
                    <Route
                        path="new"
                        element={withSuspense(
                            <CampaignPlanner />,
                            <PageTableSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "new";
                            },
                            title: "New campaign plan",
                        }}
                    />
                    <Route
                        path=":id"
                        element={withSuspense(
                            <CampaignPlanner />,
                            <PageTableSkeleton />,
                        )}
                        handle={{
                            crumb: (m: any) => `#${m.params.id}`,
                            title: "Campaign plan",
                        }}
                    />
                </Route>
                <Route
                    path="sources"
                    element={withSuspense(
                        <SourcesServers />,
                        <PageTableSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "sources-servers";
                        },
                        title: "Sources",
                    }}
                />
                <Route
                    path="reference-frames"
                    element={withSuspense(
                        <ReferenceFrames />,
                        <PageTableSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "reference-frames";
                        },
                        title: "Reference Frames",
                    }}
                />
                <Route
                    path="processing-projects/:engine"
                    element={withSuspense(
                        <ProcessingProjects />,
                        <PageTableSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "processing-projects";
                        },
                        title: "Processing Projects",
                    }}
                />
                <Route
                    path="networks"
                    element={withSuspense(<Networks />, <PageTableSkeleton />)}
                    handle={{
                        crumb: () => {
                            return "networks";
                        },
                        title: "Networks",
                    }}
                />
                <Route
                    path="people"
                    element={withSuspense(
                        <PeopleRelations />,
                        <PageTableSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "people";
                        },
                        title: "People",
                    }}
                />
                <Route
                    path="overview"
                    element={withSuspense(
                        <Overview />,
                        <PageTablesGridSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "overview";
                        },
                        title: "Overview",
                    }}
                />
                <Route
                    path="events"
                    element={withSuspense(
                        <GeneralEvents />,
                        <PageTableSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "events";
                        },
                        title: "General Events",
                    }}
                />
                <Route
                    path="users"
                    element={withSuspense(<Users />, <PageTablesRowSkeleton />)}
                    handle={{
                        crumb: () => {
                            return "Users";
                        },
                        title: "Users",
                    }}
                />
                <Route
                    path="settings"
                    element={withSuspense(
                        <Settings />,
                        <PageTablesRowSkeleton />,
                    )}
                    handle={{
                        crumb: () => {
                            return "settings";
                        },
                        title: "Settings",
                    }}
                />

                <Route
                    path=":nc/:sc"
                    element={withSuspense(<Station />, <StationFallback />)}
                    handle={{
                        crumb: () => {
                            return "Station";
                        },
                        title: (m: any) =>
                            `${m.params.nc}.${m.params.sc}`.toUpperCase(),
                    }}
                >
                    <Route
                        index
                        element={withSuspense(
                            <StationMain />,
                            <StationMapPhotoSkeleton />,
                        )}
                    />
                    <Route
                        path="rinex"
                        element={withSuspense(
                            <StationRinex />,
                            <StationTabSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "Rinex";
                            },
                        }}
                    />
                    <Route
                        path="sources"
                        element={withSuspense(
                            <StationSources />,
                            <StationTabSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "Sources";
                            },
                        }}
                    />
                    <Route
                        path="people"
                        element={withSuspense(
                            <StationPeople />,
                            <StationTabSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "People";
                            },
                        }}
                    />
                    <Route
                        path="visits"
                        element={withSuspense(
                            <StationVisits />,
                            <StationTabSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "Visits";
                            },
                        }}
                    />
                    <Route
                        path="timeseries"
                        element={withSuspense(
                            <StationTimeSeries />,
                            <StationTabSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "Time Series";
                            },
                        }}
                    />
                    <Route
                        path="events"
                        element={withSuspense(
                            <StationEvents />,
                            <StationTabSkeleton />,
                        )}
                        handle={{
                            crumb: () => {
                                return "Events";
                            },
                        }}
                    />
                </Route>
                <Route path="*" element={withSuspense(<Error />)} />
            </Route>
        </>,
    ),
    {
        future: {
            v7_relativeSplatPath: true,
            v7_fetcherPersist: true,
            v7_normalizeFormMethod: true,
            v7_partialHydration: true,
            v7_skipActionErrorRevalidation: true,
        },
    },
);

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <UserContextProvider>
                <AuthProvider>
                    <Suspense fallback={<LoadingFallback />}>
                        <RouterProvider
                            router={router}
                            future={{ v7_startTransition: true }}
                        />
                    </Suspense>
                </AuthProvider>
            </UserContextProvider>
        </QueryClientProvider>
    );
}

export { router }; //eslint-disable-line
export default App;
