import { AlertMsg, ErrorResponse, Errors } from "@types";

// aca y no en utils/index.ts: evita el import circular con el barrel
export const apiOkStatuses = [200, 201, 204];

/**
 * useApi resuelve los errores en vez de rechazarlos (ver services/CLAUDE.md),
 * asi que cada mutationFn/queryFn tiene que chequear el shape y throwear esto
 * para que TanStack los trate como falla real (isError, retry, onError).
 * Carga el statusCode y el payload de errores estructurado (Errors.errors[],
 * con `attr` por campo) para poder pintar badges de error por campo, algo
 * que un Error a secas no puede transportar.
 */
export class ApiError extends Error {
    readonly statusCode: number;
    readonly response?: Errors;

    constructor(res: ErrorResponse) {
        super(res.response?.errors?.[0]?.detail ?? res.msg ?? "Request failed");
        this.name = "ApiError";
        this.statusCode = res.statusCode;
        this.response = res.response;
    }
}

// El interceptor sintetiza statusCode solo para 200/201/204; cualquier otro
// codigo llega por la rama de error, siempre con status: "error".

export const isApiErrorResponse = (res: unknown): res is ErrorResponse => {
    if (typeof res !== "object" || res === null) return false;
    const candidate = res as Partial<ErrorResponse>;
    return (
        candidate.status === "error" ||
        (typeof candidate.statusCode === "number" &&
            !apiOkStatuses.includes(candidate.statusCode))
    );
};

/**
 * Chequeo obligatorio de todo queryFn/mutationFn: useApi resuelve los errores
 * en vez de rechazarlos, asi que sin esto TanStack cachea el objeto de error
 * como data valida, isError nunca se prende y retry nunca corre.
 * Unico caso que no debe usarlo: useServerHealth, que inspecciona el
 * statusCode a proposito para pintar el semaforo del servidor.
 */
export function unwrapApiResponse<T>(res: T | ErrorResponse): T {
    if (isApiErrorResponse(res)) throw new ApiError(res);
    return res as T;
}

// Mensaje para <Alert> a partir del error de cualquier mutation o query
export const toAlertMsg = (error: unknown): AlertMsg =>
    error instanceof ApiError
        ? {
              status: error.statusCode,
              msg: error.response?.type ?? error.message,
              errors: error.response,
          }
        : {
              status: 500,
              msg:
                  error instanceof Error && error.message
                      ? error.message
                      : "Request failed",
          };
