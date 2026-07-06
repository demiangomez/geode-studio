import { ReactNode } from "react";

interface MenuProps {

    children: ReactNode;
}

const Menu = ({ children, }: MenuProps) => {
    return (
        <ul
            tabIndex={0}
            className={`menu overflow-x-hidden items-center max-h-64 mt-2
             bg-neutral-content rounded-box overflow-y-auto divide-y-2 divide-base-100`}
            style={{ flexWrap: "nowrap" }}
        >
            {children}
        </ul>
    );
};

export default Menu;
