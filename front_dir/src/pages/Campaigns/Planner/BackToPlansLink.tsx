import { Link } from "react-router-dom";

import { ArrowLeftIcon } from "@heroicons/react/24/outline";

// Vuelta a la lista desde cualquier estado del detalle (formulario, carga, error)
const BackToPlansLink = () => (
    <Link
        to="/campaign-plans"
        className="btn btn-ghost btn-sm"
        title="Back to the saved plans"
    >
        <ArrowLeftIcon className="size-5" />
        Plans
    </Link>
);

export default BackToPlansLink;
