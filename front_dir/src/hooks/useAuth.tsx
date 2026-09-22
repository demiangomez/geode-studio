import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useLocalStorage } from "./useLocalStorage";
import useApi from "./useApi";
import { useUser } from "./user/userInfo.context";
import { queryClient } from "@queryClient";
import { useMapStore } from "@store";

import { jwtDeserializer } from "@utils";
import { getUserPhotoService, getUserService } from "@services";
import { GetParams, UsersData } from "@types";

interface AuthContextProps {
    token: string | null;
    role: string | null;
    refreshToken: string | null;
    refresh: boolean | null;
    userPhoto: string | null;
    user: UsersData | null;
    clusteringDistance: number | undefined;
    login: (token: string | null, nav?: boolean, lastPath?: string) => void;
    logout: () => void;
    getRole: (role: string) => void;
    getUserPhoto: () => void;
    loginRefresh: (token: string | null) => void;
    setRefresh: (refresh: boolean | null) => void;
    setRefreshToken: (token: string | null) => void;
    setUserPhoto: (photo: string | null) => void;
    getUserData: () => void;
}

interface AuthProviderProps {
    children: ReactNode;
}

const AuthContext = createContext<AuthContextProps>({
    token: null,
    role: null,
    refresh: null,
    refreshToken: null,
    user: null,
    userPhoto: null,
    clusteringDistance: undefined,
    login: () => {},
    logout: () => {},
    getRole: () => {},
    loginRefresh: () => {},
    getUserData: () => {},
    getUserPhoto: () => {},
    setRefresh: () => {},
    setRefreshToken: () => {},
    setUserPhoto: () => {},
});

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const { dispatch: userDispatch } = useUser();
    const [token, setToken] = useLocalStorage("gpsToken", null);
    const [refreshToken, setRefreshToken] = useLocalStorage("gpsRefresh", null);
    const [role, setRole] = useLocalStorage("gpsRole", null);

    const [userPhoto, setUserPhoto] = useState<string | null>(null);
    const [user, setUser] = useState<UsersData | null>(null);

    const [refresh, setRefresh] = useState<boolean | null>(null);

    const login = (token: string | null, nav?: boolean) => {
        if (token) {
            // Limpiar estado del usuario anterior
            userDispatch({ type: "CLEAR_ALL" });
            // Limpiar cache de React Query del usuario anterior
            queryClient.clear();
            // Limpiar datos de usuario anterior
            setUser(null);
            setUserPhoto(null);

            // Los filtros de país/red del SearchInput no se arrastran entre
            // sesiones: resetearlos al (re)loguear —incluido el re-login por
            // refresh token— manteniendo el resto del estado del mapa.
            useMapStore.getState().setParams((p) => ({
                ...p,
                country_code: "",
                network_code: "",
            }));

            setToken(token);
            setRefresh(null);
        }
        if (token && nav) {
            setToken(token);
            setRefresh(null);
            window.history.back();
        }
    };

    const loginRefresh = (token: string | null) => {
        if (token) {
            setRefreshToken(token);
        }
    };

    // estable: es dependencia del useMemo de useApi
    const logout = useCallback(() => {
        setToken(null);
        setRefreshToken(null);
        setRefresh(null);
        setRole(null);
        setUserPhoto(null);
        setUser(null);
        // Limpiar permisos del usuario anterior para evitar bugs de roels
        userDispatch({ type: "CLEAR_ALL" });
        // Limpiar cache de React Query
        queryClient.clear();

        // La navegación a /auth/login la maneja ProtectedRoute
        // al detectar token === null
    }, [setToken, setRefreshToken, setRole, userDispatch]);

    const getRole = (role: string) => {
        setRole(role);
    };

    const api = useApi(token, logout);

    const getUserData = async () => {
        const idUser = jwtDeserializer(token ?? "")?.user_id ?? 0;
        try {
            const bParams: GetParams = { with_people: true };

            const res = await getUserService<UsersData>(api, idUser, bParams);
            // Obtener la foto y usar su valor directamente
            let photoData = null;
            try {
                const photoRes = await getUserPhotoService<any>(api, idUser);
                if (photoRes.statusCode === 200) {
                    photoData = photoRes.photo;
                    setUserPhoto(photoData); // Actualizar el state también
                }
            } catch (photoErr) {
                console.error("Error getting photo:", photoErr);
            }

            const extendedUser = {
                id: res.id,
                username: res.username,
                password: res.password ?? "",
                role: res.role,
                is_active: res.is_active !== undefined ? res.is_active : null,
                first_name: res.first_name,
                last_name: res.last_name,
                email: res.email,
                phone: res.phone,
                address: res.address,
                photo: photoData ? "data:image/*;base64," + photoData : null, // ← Usar photoData directamente
                clustering_distance: res.clustering_distance,
                person: res.person,
            };

            if (extendedUser !== undefined) setUser(extendedUser);
        } catch (err) {
            console.error(err);
        }
    };

    const getUserPhoto = async () => {
        try {
            const token = localStorage.getItem("gpsToken");
            const tokenDeserialized = jwtDeserializer(token as string);
            if (token) {
                const res = await getUserPhotoService<any>(
                    api,
                    Number(tokenDeserialized?.user_id),
                );
                if (res.statusCode === 200) {
                    setUserPhoto(res.photo);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    const parsedDistance = user?.clustering_distance
        ? Number(user.clustering_distance)
        : undefined;

    useEffect(() => {
        const interval = setInterval(() => {
            const tokenTest = localStorage.getItem("gpsToken");
            const refreshTest = localStorage.getItem("gpsRefresh");
            const tokenDeserialized = jwtDeserializer(tokenTest as string);
            if (tokenDeserialized) {
                getRole(tokenDeserialized.role_id.toString());
                const currentTime = Date.now() / 1000;
                // 1716307200
                // tokenDeserialized.exp
                if (tokenDeserialized.exp < currentTime) {
                    setRefresh(true);
                    setToken(null);
                }
            }
            if (tokenTest === null && refreshTest === null) {
                logout();
            }
            if (tokenTest !== null && refreshTest === null) {
                setRefresh(false);
            }
            if (tokenTest === null && refreshTest !== null) {
                setRefresh(true);
            }
        }, 500);

        return () => {
            clearInterval(interval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (token) {
            // getUserData ya trae la foto y hace setUserPhoto; llamar tambien a
            // getUserPhoto() duplicaba el GET a users/{id}/photo en cada carga.
            // La funcion sigue expuesta para refrescar tras subir una nueva
            // (UsersModal).
            getUserData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const value = useMemo(
        () => ({
            token,
            role,
            refresh,
            login,
            logout,
            user,
            clusteringDistance: parsedDistance,
            userPhoto,
            refreshToken,
            loginRefresh,
            getRole,
            getUserPhoto,
            setRefresh,
            setRefreshToken,
            setUserPhoto,
            getUserData,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [token, refresh, role, userPhoto, user],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
