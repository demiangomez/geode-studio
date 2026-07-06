import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@hooks/useAuth";

import Layout from "@pages/Layout";

const UnprotectedRoute = () => {
    const { token } = useAuth();
    return token ? (
        <Navigate to="/" />
    ) : (
        <Layout>
            {" "}
            <Outlet />{" "}
        </Layout>
    );
};

export default UnprotectedRoute;
