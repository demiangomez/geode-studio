import Message from "@components/Message";

import useApi from "@hooks/useApi";
import { useAuth } from "@hooks/useAuth";
import { useServerHealth } from "@hooks/queries/useServerHealth";

const ServerStatusToast = () => {
    const { token, logout } = useAuth();
    const api = useApi(token, logout);

    const { isDown, title } = useServerHealth(api);

    if (!isDown) return null;

    return (
        <Message
            error={true}
            msg={`${title || "Server is unreachable"}. Some data may not load.`}
            duration={6000}
        />
    );
};

export default ServerStatusToast;
