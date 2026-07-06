import { useMemo } from "react";
import { Spinner, CopyButton } from "@componentsReact";

import { formatValue, isValidDate } from "@utils";

import { StationEvents } from "@types";

interface Props {
    loading: boolean;
    body: any[][] | undefined;
    titles: string[];
    events: StationEvents[] | undefined;
    onClickFunction: (event: any) => void;
}

const EventsTable = ({
    loading,
    body,
    titles,
    events,
    onClickFunction,
}: Props) => {
    const memoizedBody = useMemo(() => {
        return body?.map(
            (row) => row.slice(1).map((data) => formatValue(data)), // Remove the first element of the row bcs it's the id
        );
    }, [body]);

    return (
        <div>
            <table className="w-full table z-10 table-zebra bg-neutral-content">
                <thead className="">
                    <tr>
                        {titles.length === 0 && !loading && (
                            <th className="text-center text-neutral text-2xl">
                                There are no Events to show
                            </th>
                        )}

                        {titles.map((title, index) => (
                            <th
                                className="text-center text-neutral max-w-[200px]"
                                key={index}
                            >
                                {title.toUpperCase()}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="">
                    {loading ? (
                        <tr>
                            <td
                                colSpan={titles.length + 1}
                                className="relative h-[200px]"
                            >
                                <div className="absolute inset-0 flex justify-center items-center">
                                    <Spinner size="lg" />
                                </div>
                            </td>
                        </tr>
                    ) : (
                        memoizedBody?.map((row, rowIndex) => (
                            <tr
                                key={rowIndex + 1}
                                className={"cursor-pointer hover"}
                            >
                                {row.map((data, dataIndex) => {
                                    const isDescription =
                                        titles[dataIndex] === "description";

                                    const valueUnformatted =
                                        body?.[rowIndex]?.slice(1)?.[dataIndex]; // slice bcs the first element is the id

                                    const event = events?.filter(
                                        (e) =>
                                            e.event_id ===
                                            body?.[rowIndex]?.[0],
                                    )[0];

                                    return (
                                        <td
                                            key={dataIndex}
                                            className={`text-center z-10 ${isDescription ? " flex items-center justify-center mx-auto relative" : "w-fit"}`}
                                            onClick={() => {
                                                onClickFunction(event);
                                            }}
                                            title={
                                                isValidDate(data)
                                                    ? formatValue(
                                                          valueUnformatted,
                                                      )
                                                    : valueUnformatted
                                            }
                                        >
                                            <span
                                                className={`${isDescription ? "w-[115px]" : ""}`}
                                            >
                                                {data}{" "}
                                            </span>
                                            {isDescription && (
                                                <span onClick={(e) => e.stopPropagation()} className="ml-3">
                                                    <CopyButton
                                                        text={event?.description ?? ""}
                                                        iconClassName="size-6"
                                                    />
                                                </span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default EventsTable;
