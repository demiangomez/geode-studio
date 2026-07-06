import axios, { AxiosError, AxiosInstance } from "axios";
import { useMemo } from "react";
import { useUser } from "./user/userInfo.context";
import { Errors } from "@types";

const BASEURL: string = import.meta.env.VITE_API_URL;

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
                                (error.response?.data as Errors).errors[0]
                                    .detail ?? error.message,
                            url: error.config?.url ?? "",
                        });
                    }, 50);
                }
                const requestResponse: XMLHttpRequest = error.request;
                // cambiar a promise.reject
                // esto va a hacer que la respuesta pase x catch y se maneje bien
                // no como ahora..
                return {
                    data: {
                        msg: error.message,
                        response: error.response?.data,
                        status: "error",
                        statusCode: requestResponse.status,
                    },
                };
            },
        );

        return instance;
    }, [token, logout, userDispatch]);

    return axiosInstance;
}
