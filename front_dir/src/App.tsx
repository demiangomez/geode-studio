import { Suspense } from "react";
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

// Loading fallback component
const LoadingFallback = () => (
    <div className="flex items-center justify-center h-screen w-screen bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
    </div>
);

const router = createBrowserRouter(
    createRoutesFromElements(
        <>
            <Route path="/auth" element={<UnprotectedRoute />}>
                <Route path="login" element={<Login />} />
                <Route path="*" element={<Error />} />
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
                    element={<Main />}
                    handle={{ title: "Mapview" }}
                />
                <Route
                    path="campaigns"
                    element={<Campaigns />}
                    handle={{
                        crumb: () => {
                            return "campaigns";
                        },
                        title: "Campaigns",
                    }}
                />
                <Route
                    path="sources"
                    element={<SourcesServers />}
                    handle={{
                        crumb: () => {
                            return "sources-servers";
                        },
                        title: "Sources",
                    }}
                />
                <Route
                    path="networks"
                    element={<Networks />}
                    handle={{
                        crumb: () => {
                            return "networks";
                        },
                        title: "Networks",
                    }}
                />
                <Route
                    path="people"
                    element={<PeopleRelations />}
                    handle={{
                        crumb: () => {
                            return "people";
                        },
                        title: "People",
                    }}
                />
                <Route
                    path="overview"
                    element={<Overview />}
                    handle={{
                        crumb: () => {
                            return "overview";
                        },
                        title: "Overview",
                    }}
                />
                <Route
                    path="users"
                    element={<Users />}
                    handle={{
                        crumb: () => {
                            return "Users";
                        },
                        title: "Users",
                    }}
                />
                <Route
                    path="settings"
                    element={<Settings />}
                    handle={{
                        crumb: () => {
                            return "settings";
                        },
                        title: "Settings",
                    }}
                />

                <Route
                    path=":nc/:sc"
                    element={<Station />}
                    handle={{
                        crumb: () => {
                            return "Station";
                        },
                        title: (m: any) =>
                            `${m.params.nc}.${m.params.sc}`.toUpperCase(),
                    }}
                >
                    <Route index element={<StationMain />} />
                    <Route
                        path="rinex"
                        element={<StationRinex />}
                        handle={{
                            crumb: () => {
                                return "Rinex";
                            },
                        }}
                    />
                    <Route
                        path="sources"
                        element={<StationSources />}
                        handle={{
                            crumb: () => {
                                return "Sources";
                            },
                        }}
                    />
                    <Route
                        path="people"
                        element={<StationPeople />}
                        handle={{
                            crumb: () => {
                                return "People";
                            },
                        }}
                    />
                    <Route
                        path="visits"
                        element={<StationVisits />}
                        handle={{
                            crumb: () => {
                                return "Visits";
                            },
                        }}
                    />
                    <Route
                        path="timeseries"
                        element={<StationTimeSeries />}
                        handle={{
                            crumb: () => {
                                return "Time Series";
                            },
                        }}
                    />
                    <Route
                        path="events"
                        element={<StationEvents />}
                        handle={{
                            crumb: () => {
                                return "Events";
                            },
                        }}
                    />
                </Route>
                <Route path="*" element={<Error />} />
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
