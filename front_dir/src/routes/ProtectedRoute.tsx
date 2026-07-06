import { Navigate, Outlet } from "react-router-dom";

import Toast from "@components/Message";
import Layout from "@pages/Layout";

import { useUser, useAuth, usePageTitle } from "@hooks";

import { apiMethods } from "@utils";

export const ProtectedRoute = () => {
    const { token } = useAuth();

    usePageTitle();

    const {
        state: {
            status: userFetchStatus,
            method: userFetchMethod,
            msg: userMsg,
        },
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
            <Outlet />
        </Layout>
    ) : (
        <Navigate to="/auth/login" />
    );
};
export default ProtectedRoute;
