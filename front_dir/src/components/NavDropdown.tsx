import { ReactNode, useRef, useState } from "react";
import { Link } from "react-router-dom";

import useClickOutside from "@hooks/useClickOutside";

interface NavDropdownProps {
    title: string;
    trigger: ReactNode;
    header?: ReactNode;
    children: (close: () => void) => ReactNode;
}

const NavDropdown = ({
    title,
    trigger,
    header,
    children,
}: NavDropdownProps) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const close = () => setOpen(false);

    useClickOutside(ref, close, open);

    return (
        <div className="relative" ref={ref}>
            <div
                tabIndex={0}
                role="button"
                className="btn btn-ghost btn-circle"
                title={title}
                onClick={() => setOpen((prev) => !prev)}
            >
                {trigger}
            </div>
            {open && (
                <ul
                    tabIndex={0}
                    className="menu menu-sm absolute right-0 top-full mt-2 z-[10000000000000000] space-y-1 p-2 shadow bg-gray-800 border-[1px] border-gray-600 rounded-box w-52"
                >
                    {header}
                    {children(close)}
                </ul>
            )}
        </div>
    );
};

interface NavDropdownLinkProps {
    to?: string;
    icon: ReactNode;
    label: string;
    onClick: () => void;
}

export const NavDropdownLink = ({
    to,
    icon,
    label,
    onClick,
}: NavDropdownLinkProps) => {
    const className =
        "hover:bg-slate-600 flex w-full justify-start focus:text-primary";
    const content = (
        <>
            {icon}
            <span className="ml-[40px]">{label}</span>
        </>
    );
    return (
        <li>
            {to ? (
                <Link className={className} to={to} onClick={onClick}>
                    {content}
                </Link>
            ) : (
                <a className={className} onClick={onClick}>
                    {content}
                </a>
            )}
        </li>
    );
};

export default NavDropdown;
