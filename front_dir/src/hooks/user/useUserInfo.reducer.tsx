export type UserState = {
    status: "unAuthorized" | "init";
    method: string;
    msg?: string;
    url?: string;
    unauthorizedOperations: Record<string, { method: string; msg: string }>; // URL -> {method, msg}
    // Canal aparte del de permisos: Table.tsx lee unauthorizedOperations para
    // pintar "sin permiso" en lugar de la tabla, y un 500 no es eso.
    serverError?: { msg: string };
};

export const initialState: UserState = {
    status: "init",
    method: "get",
    url: "",
    unauthorizedOperations: {},
};

export type Action =
    | {
          type: "UNAUTHORIZE";
          method: string;
          msg: string;
          url: string;
      }
    | {
          type: "INIT";
          method: string;
          url?: string;
      }
    | {
          type: "SERVER_ERROR";
          msg: string;
      }
    | {
          type: "CLEAR_SERVER_ERROR";
      }
    | {
          type: "CLEAR_ALL";
      };

export type Dispatch = (action: Action) => void;

// reducer function
// funciona para manejar la autorizacion de multiples requests
// y guardar los errores de autorizacion por separado

// en table especificamente solo se manejan gets, y spliteo la url
// sin params para identificar la operacion

// para otros metodos que no sean gets, ya se maneja los mensajes,
// quiza lo mejor sea adaptarlos a unauthorizedOperations (como los gets en table).

export const useUserInfo = (state: UserState, action: Action): UserState => {
    const hasUrl = action.type === "INIT" || action.type === "UNAUTHORIZE";
    const actionUrlSplitted =
        hasUrl && action.url ? action.url.split("?")[0] : "";
    const unauthorizedOperationsKey = hasUrl
        ? actionUrlSplitted + "-" + action.method
        : "";

    switch (action.type) {
        case "INIT": {
            return {
                ...state,
                status: "init",
                method: action.method,
                url: action.url,
                unauthorizedOperations: action.url
                    ? ({
                          ...state.unauthorizedOperations,
                          [unauthorizedOperationsKey]: undefined,
                      } as Record<string, { method: string; msg: string }>)
                    : state.unauthorizedOperations,
            };
        }
        case "UNAUTHORIZE": {
            return {
                ...state,
                status: "unAuthorized",
                method: action.method,
                msg: action.msg,
                url: action.url,
                unauthorizedOperations: {
                    ...state.unauthorizedOperations,
                    [unauthorizedOperationsKey]: {
                        method: action.method,
                        msg: action.msg,
                    },
                },
            };
        }
        // Agregado: una sola falla de servidor a la vez. Mientras haya una
        // activa las siguientes se descartan, asi una caida que rompe 20
        // requests en paralelo muestra un unico toast.
        case "SERVER_ERROR": {
            if (state.serverError) return state;
            return { ...state, serverError: { msg: action.msg } };
        }
        case "CLEAR_SERVER_ERROR": {
            if (!state.serverError) return state;
            return { ...state, serverError: undefined };
        }
        case "CLEAR_ALL": {
            return {
                ...initialState,
            };
        }
        default: {
            return state;
        }
    }
};
