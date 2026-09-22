import axios, { AxiosError, AxiosInstance } from "axios";
import { useMemo } from "react";
import { useUser } from "./user/userInfo.context";
import { Errors } from "@types";

const BASEURL: string = import.meta.env.VITE_API_URL;

// El health-check se repolla cada 30s y ya tiene su propio semaforo: si
// toasteara, un servidor caido dispararia un toast cada medio minuto.
const SILENT_ENDPOINTS = ["api/health-check"];

export default function useApi(
    token: string | null,
    logout: () => void,
): AxiosInstance {
    const { dispatch: userDispatch } = useUser();

    const axiosInstance = useMemo(() => {
        const instance = axios.create({
            baseURL: BASEURL,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token ?? ""}`,
            },
        });

        instance.interceptors.response.use(
            (response) => {
                if (response.status === 200) {
                    response.data.statusCode = response.status;
                }
                if (response.status === 201) {
                    response.data.statusCode = response.status;
                }
                if (response.status === 204) {
                    response.data = {
                        msg: "Deleted Succesfully",
                        response: "",
                        status: "success",
                        statusCode: response.status,
                    };
                }
                return response;
            },

            (error: AxiosError) => {
                // Abort del cliente, asi no cae al toast global
                if (error.code === AxiosError.ERR_CANCELED) {
                    return Promise.reject(error);
                }

                const status = error.response ? error.response.status : null;
                if (error && status === 401) {
                    logout();
                }
                if (error && status === 403 && error.config) {
                    userDispatch({
                        type: "INIT",
                        method: error.config.method ?? "",
                        url: error.config.url ?? "",
                    });
                    setTimeout(() => {
                        userDispatch({
                            type: "UNAUTHORIZE",
                            method: error.config
                                ? (error.config.method ?? "")
                                : "",
                            msg:
                                (error.response?.data as Errors | undefined)
                                    ?.errors?.[0]?.detail ?? error.message,
                            url: error.config?.url ?? "",
                        });
                    }, 50);
                }
                // Sin respuesta (red caida, timeout, CORS) o 5xx: no es algo
                // que el usuario pueda resolver en el formulario, y a menudo
                // rompe varias requests a la vez, asi que lo levanta el toast
                // global agregado. El 401 (logout) y el 403 (arriba) quedan
                // afuera, igual que los 4xx que cada pantalla ya muestra inline.
                const isSilent = SILENT_ENDPOINTS.some((endpoint) =>
                    error.config?.url?.includes(endpoint),
                );
                if (!isSilent && (status === null || status >= 500)) {
                    userDispatch({
                        type: "SERVER_ERROR",
                        msg:
                            status === null
                                ? "Could not reach the server. Some data may not be available."
                                : "The server returned an error. Some data may not be available.",
                    });
                }

                // error.request puede no existir (fallo de configuracion de
                // axios, no de red), y ahi leerle .status tiraba un TypeError
                // adentro del propio interceptor.
                const requestResponse: XMLHttpRequest | undefined =
                    error.request;
                // cambiar a promise.reject
                // esto va a hacer que la respuesta pase x catch y se maneje bien
                // no como ahora..
                return {
                    data: {
                        msg: error.message,
                        response: error.response?.data,
                        status: "error",
                        statusCode: status ?? requestResponse?.status ?? 0,
                    },
                };
            },
        );

        return instance;
    }, [token, logout, userDispatch]);

    return axiosInstance;
}
