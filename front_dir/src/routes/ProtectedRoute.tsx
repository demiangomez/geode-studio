import { Navigate, Outlet } from "react-router-dom";

import Toast from "@components/Message";
import Layout from "@pages/Layout";

import { useAuth } from "@hooks/useAuth";
import { useUser } from "@hooks/user/userInfo.context";
import { usePageTitle } from "@hooks/usePageTitle";

import { apiMethods } from "@utils";

const ProtectedRoute = () => {
    const { token } = useAuth();

    usePageTitle();

    const {
        state: {
            status: userFetchStatus,
            method: userFetchMethod,
            msg: userMsg,
            serverError,
        },
        dispatch: userDispatch,
    } = useUser();

    let msg = null;

    if (
        userFetchStatus === "unAuthorized" &&
        apiMethods.includes(userFetchMethod)
    ) {
        msg = <Toast error={true} msg={userMsg} />;
    }
    return token ? (
        <Layout>
            {userFetchStatus === "unAuthorized" && msg}
            {serverError && (
                <Toast
                    error={true}
                    msg={serverError.msg}
                    duration={6000}
                    onClose={() => userDispatch({ type: "CLEAR_SERVER_ERROR" })}
                />
            )}
            <Outlet />
        </Layout>
    ) : (
        <Navigate to="/auth/login" />
    );
};
export default ProtectedRoute;
