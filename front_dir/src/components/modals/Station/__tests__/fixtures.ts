import type { StationData, StationMetadataServiceData } from "@types";

export const STATION: StationData = {
    api_id: 42,
    network_code: "arg",
    station_code: "cost",
    station_name: "Costa Station",
    date_start: 2020.1,
    date_end: 2024.9,
    auto_x: 2750000.123,
    auto_y: -4478000.456,
    auto_z: -3598000.789,
    harpos_coeff_otl: "OTL COEFFS",
    has_gaps: false,
    has_stationinfo: true,
    lat: -34.60371,
    lon: -58.38156,
    height: 25.123,
    max_dist: 150,
    dome: "41001M001",
    country_code: "ARG",
    marker: 1,
    gaps: [],
    status: "active",
    type: "continuous",
    plate: "SA",
};

export const STATION_META: StationMetadataServiceData = {
    battery_description: "Two 12V batteries",
    communications_description: "4G modem",
    has_battery: true,
    has_communications: false,
    has_gaps: false,
    has_gaps_last_update_datetime: "2024-01-01T00:00:00Z",
    has_gaps_update_needed: false,
    id: "7",
    comments: "<p>Some comment</p>",
    monument_type: "3",
    navigation_actual_file: null,
    navigation_filename: "",
    observations_actual_file: null,
    observations_filename: "",
    remote_access_link: "https://example.org/cost",
    station: "42",
    station_type: "1",
    status: "2",
    station_type_name: "Continuous",
    statusCode: "200",
    distinct_visit_years: [],
};

export const STATION_TYPES = [
    { id: 1, name: "Continuous", image: "", actual_image: "" },
    { id: 9, name: "Campaign", image: "", actual_image: "" },
];

export const STATION_STATUSES = [
    { id: 2, name: "Active", color_name: "green" },
    { id: 5, name: "Inactive", color_name: "red" },
];

export const MONUMENTS = [
    { id: 3, name: "Concrete pillar", photo_file: null },
    { id: 8, name: "Roof mount", photo_file: null },
];

export const PLATES = [
    { code: "AF", name: "Africa" },
    { code: "NA", name: "North America" },
    { code: "SA", name: "South America" },
];

export const STATION_INFO = [
    {
        antenna_code: "TRM59800.00",
        antenna_serial: "1441045678",
        height_code: "DHARP",
        receiver_code: "TRIMBLE NETR9",
        receiver_serial: "5429R48291",
        receiver_vers: "5.37",
        radome_code: "SCIS",
    },
];

export const listResponse = <T>(data: T[]) => ({
    count: data.length,
    total_count: data.length,
    data,
    statusCode: 200,
});
