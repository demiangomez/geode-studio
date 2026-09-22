import { Children, ReactNode } from "react";

interface MenuProps {
    emptyText?: string;
    children: ReactNode;
}

const Menu = ({ emptyText = "No options", children }: MenuProps) => {
    const hasItems = Children.toArray(children).length > 0;

    return (
        <ul
            tabIndex={0}
            className={`menu overflow-x-hidden items-center max-h-64 mt-2
             bg-neutral-content rounded-box overflow-y-auto divide-y-2 divide-base-100`}
            style={{ flexWrap: "nowrap" }}
        >
            {hasItems ? (
                children
            ) : (
                <li className="disabled py-2 px-4 w-full">
                    <span className="text-base-content/60">{emptyText}</span>
                </li>
            )}
        </ul>
    );
};

export default Menu;
