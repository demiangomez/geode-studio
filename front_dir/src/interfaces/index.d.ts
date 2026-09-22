import { User } from "./index.d";
declare module "@heroicons/*";

export interface GetParams {
    with_people?: boolean;
    without_photo?: boolean;
    without_actual_files?: boolean;
    network_code?: string;
    thumbnail?: boolean;
    country_code?: string;
    station_code?: string;
    antenna_code?: string;
    station_api_id?: string;
    visit_api_id?: string;
    api_id?: string;
    only_metadata?: boolean;
    only_empty_network?: boolean;
    doy?: string;
    event_type?: string;
    event_date_since?: string;
    event_date_until?: string;
    module?: string;
    node?: string;
    stack?: string;
    year?: string;
    description?: string;
    role_type?: "FRONT" | "API";
    solution?: string;
    date_start?: string;
    date_end?: string;
    residuals?: boolean;
    missing_data?: boolean;
    plot_outliers?: boolean;
    plot_auto_jumps?: boolean;
    no_model?: boolean;
    remove_jumps?: boolean;
    remove_polynomial?: boolean;
    observation_doy?: string | number;
    observation_f_year?: string | number;
    observation_s_time_since?: string;
    observation_s_time_until?: string;
    observation_e_time_since?: string;
    observation_e_time_until?: string;
    observation_year?: string | number;
    antenna_dome?: string;
    antenna_offset?: string | number;
    antenna_serial?: string;
    antenna_type?: string;
    receiver_fw?: string;
    receiver_serial?: string;
    receiver_type?: string;
    completion_operator?: string;
    completion?: string | number;
    interval?: string | number;
    offset?: number;
    limit?: number;
    project?: string;
    name?: string;
    monument_id?: number;
    campaign?: number;
    original_quality?: boolean;
}

export interface TokenPayload {
    token_type: string;
    user_id: number;
    role_id: number;
    role_name: string;
    username: string;
    jti: string;
    iat: number;
    exp: number;
}

export interface DropdownState {
    dropdown: boolean;
    type: string | undefined;
}

export interface EarthquakeData {
    api_id: number;
    date: string;
    lat: number;
    lon: number;
    depth: number;
    mag: number;
    strike1: number;
    dip1: number;
    rake1: number;
    strike2: number;
    dip2: number;
    rake2: number;
    id: string;
    location: string;
    // UI toggle states
    ui_toggle_mask?: boolean;
    ui_toggle_vector?: boolean;
}

export interface EarthQuakeParams {
    date_start?: string;
    date_end?: string;
    max_magnitude?: number | undefined;
    min_magnitude?: number | undefined;
    id?: string | undefined;
    max_depth?: number | undefined;
    min_depth?: number | undefined;
}

export interface EarthQuakeFormState {
    date_start: string | undefined;
    date_end: string | undefined;
    max_magnitude: string;
    min_magnitude: string;
    id: string;
    max_depth: string;
    min_depth: string;
    min_latitude: string;
    max_latitude: string;
    min_longitude: string;
    max_longitude: string;
    polygon_coordinates: [number[]];
}

export interface ErrorResponse {
    msg: string;
    response: Errors;
    status: string;
    statusCode: number;
}

export interface FilesErrorResponse {
    msg: string;
    response: FileErrors;
    status: string;
    statusCode: number;
}

// Config del ETM (time-series-config): tipos de solución y opciones de ajuste.
export interface TimeSeriesConfigOption {
    id: number;
    type: string;
}

export interface SolutionTypesServiceData {
    solution_types: TimeSeriesConfigOption[];
}

export interface AdjustmentOptionsServiceData {
    adjustment_models: TimeSeriesConfigOption[];
    covariance_functions: TimeSeriesConfigOption[];
}

// mode_obs del Query de coordenadas (MODEL / OBSERVATION). La description del
// backend se ignora; TimeSeriesConfigOption (id+type) alcanza.
export interface ModeObsTypesServiceData {
    mode_obs_types: TimeSeriesConfigOption[];
}

export interface StationTimeSeriesServiceData {
    etm_params: TimeSeriesParamsData;
    time_series: string;
    download_filename: string;
    debug_output: string;
}

export interface StationCoordinatesData {
    xyz: { x: number; y: number; z: number };
    lla: { lat: number; lon: number; height: number };
    source: string;
    sigmas: { x: number; y: number; z: number };
}

export interface BulkDownloadStation {
    network_code: string;
    station_code: string;
}

export interface FileDownloadResult {
    blob?: Blob;
    filename?: string;
    statusCode: number;
    errorDetail?: string;
}

export interface PatchDescriptionImageResponse {
    actual_image: string;
    description: string;
    id: number;
    name: string;
    station: number;
    statusCode: number;
}

export interface PatchDescriptionVisitImageResponse {
    actual_image: string;
    description: string;
    id: number;
    name: string;
    statusCode: number;
    visit: number;
}

export interface RinexAddFile {
    msg: string;
    response: RinexFileResponse;
    status: string;
    statusCode: number;
}

export interface ExtendedErrors extends Errors {
    statusCode: number;
}

export interface Errors {
    errors: [{ code: string; detail: string; attr: string }];
    type: string;
    // Solo GET api/time-series: log del ETM si alcanzó a correr antes de fallar
    debug_output?: string;
}

// Mensaje del <Alert> de modales y paneles: status HTTP, titulo y errores del API
export interface AlertMsg {
    status: number;
    msg: string;
    errors?: Errors;
}

export interface FileErrors {
    error_message: [{ [key: string]: string[] }];
}

export interface KmzFile {
    kmz: string;
    statusCode: number;
}

export interface StationServiceData {
    count: number;
    total_count: number;
    data: StationData[];
    statusCode: number;
}

export interface StationsAffectedServiceData {
    affected_stations_including_postseismic: StationAffectedInfo[];
    affected_stations_without_postseismic: StationAffectedInfo[];
    csv_including_postseismic: string;
    csv_without_postseismic: string;
    kml_including_postseismic: string;
    kml_without_postseismic: string;
    coseismic_displacements: CoseismicDisplacement[];
    /** Optional lists for multi-earthquake selection */
    kml_list_including_postseismic?: { id: number; data: string }[];
    kml_list_without_postseismic?: { id: number; data: string }[];
    /** Final active KML list after merging individual toggles */
    active_kml_list?: { id: number; data: string }[];
    /** Final active affected stations info after merging individual toggles */
    active_affected_stations?: StationAffectedInfo[];
    /** Original data for each individual earthquake mapped by api_id */
    individual_data?: Record<string, StationsAffectedServiceData>;
}

export interface CoseismicDisplacement {
    NetworkCode: string;
    StationCode: string;
    n: number;
    e: number;
    u: number;
}

export interface StationAffectedInfo {
    network_code: string;
    station_code: string;
}

export interface FilterState {
    typeOption: string[];
    statusOption: string[];
}

export interface TemporalFilterState {
    enabled: boolean;
    dateStart: number | null;
    dateEnd: number | null;
    hiddenPoints: boolean;
    exactDate: boolean;
}

export interface ExtendedStationInfoData extends StationInfoData {
    statusCode: number;
}

export interface StationMetadataServiceData {
    battery_description: string;
    communications_description: string;
    has_battery: boolean;
    has_communications: boolean;
    has_gaps: boolean;
    has_gaps_last_update_datetime: string;
    has_gaps_update_needed: boolean;
    id: string;
    comments: string;
    monument_type: string;
    navigation_actual_file: string | null;
    navigation_filename: string;
    observations_actual_file: string | null;
    observations_filename: string;
    remote_access_link: string;
    station: string;
    station_type: string | null;
    status: string;
    station_type_name: string | null;
    station_status_name?: string | null;
    statusCode: string;
    station_name?: string;
    rinex_count?: number;
    distinct_visit_years: string[];
}

export interface StationInfoServiceData {
    count: number;
    data: StationInfoData[];
    total_count: number;
    statusCode: number;
}

export interface StationStatusServiceData {
    count: number;
    total_count: number;
    data: StationStatusData[];
    statusCode: number;
}

export interface StationEventsData {
    count: number;
    total_count: number;
    data: StationEvents[];
    statusCode: number;
}

export interface StationFilesServiceData {
    count: number;
    total_count: number;
    data: StationFilesData[];
    statusCode: number;
}

export interface StationVisitsServiceData {
    count: number;
    total_count: number;
    data: StationVisitsData[];
    statusCode: number;
}

export interface StationCampaignsServiceData {
    count: number;
    total_count: number;
    data: StationCampaignsData[];
    statusCode: number;
}

export interface StationVisitsFilesServiceData {
    count: number;
    total_count: number;
    data: StationVisitsFilesData[];
    statusCode: number;
}

export interface MonumentTypesServiceData {
    count: number;
    total_count: number;
    data: MonumentTypes[];
    statusCode: number;
}

export interface ReceiversServiceData {
    count: number;
    total_count: number;
    data: ReceiversData[];
    statusCode: number;
}

export interface AntennaServiceData {
    count: number;
    total_count: number;
    data: AntennaData[];
    statusCode: number;
}

export interface GamitHTCServiceData {
    count: number;
    data: GamitHTCData[];
    total_count: number;
    statusCode: number;
}

export interface RadomeData {
    radome_code: string;
}

export interface RadomesServiceData {
    count: number;
    total_count: number;
    data: RadomeData[];
    statusCode: number;
}

export interface NetworkServiceData {
    count: number;
    total_count: number;
    data: NetworkData[];
    statusCode: number;
}

export interface CountriesServiceData {
    count: number;
    total_count: number;
    data: CountriesData[];
    statusCode: number;
}

export interface TectonicPlateProperties {
    LAYER: string;
    Code: string;
    PlateName: string;
}

export interface TectonicPlateFeature {
    type: "Feature";
    properties: TectonicPlateProperties;
    geometry: {
        type: string;
        coordinates: unknown;
    };
}

export interface TectonicPlatesServiceData {
    type: "FeatureCollection";
    features: TectonicPlateFeature[];
}

export interface TectonicPlateName {
    code: string;
    name: string;
}

export interface TectonicPlateNamesServiceData {
    plates: TectonicPlateName[];
    statusCode: number;
}

export interface RinexServiceData {
    count: number;
    total_count: number;
    data: RinexData[];
    statusCode: number;
}

export interface RinexRelatedStationInfo {
    api_id: number;
    date_end: string;
    date_start: string;
}

interface RinexItem {
    rinex: RinexData[];
    related_station_info: RinexRelatedStationInfo[];
}

interface RinexObject {
    related_station_info: RinexRelatedStationInfo[];
    rinex: RinexItem[];
    groupId?: string;
}

export interface RinexFileResponse {
    inserted_station_info: {
        station_code?: string;
        network_code?: string;
        date_start?: string;
    }[];
    error_message?: {
        [key: string]: string[];
    };
    statusCode: 400 | 201;
}

export interface LoginServiceData {
    refresh: string;
    access: string;
}

export interface UsersServiceData {
    count: number;
    total_count: number;
    data: UsersData[];
}

export interface RolesServiceData {
    count: number;
    total_count: number;
    data: Role[];
}

export interface ClusterServiceData {
    count: number;
    total_count: number;
    data: EndpointCluster[];
}

export interface FrontPagesServiceData {
    count: number;
    total_count: number;
    data: FrontPagesData[];
}

export interface RolePersonStationServiceData {
    count: number;
    total_count: number;
    data: RolePersonStationData[];
    statusCode: number;
}

export interface CampaignsServiceData {
    count: number;
    total_count: number;
    data: CampaignsData[];
    statusCode: number;
}

export interface CampaignsData {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    default_people: number[];
    statusCode: number;
    default_people_id?: number;
}

export interface ExtendedUsersData extends UsersData {
    statusCode: number;
}

export interface User {
    first_name: string;
    last_name: string;
    username: string;
    password: string;
    role: number | null;
    email?: string;
    phone?: string;
    address?: string;
    photo?: string | null;
    is_active?: boolean | null;
}
//heredo de User
type UsersData = Omit<User, "role"> & {
    id: number | null;
    clustering_distance?: string | null;
    role: { id: number; name: string };
    person?: People | null;
};

export interface Role {
    id: number;
    name: string;
    role_api: boolean;
    is_active: boolean;
    allow_all: boolean;
    endpoints_clusters: number[];
    pages: number[];
    statusCode: number;
}

export interface Cluster {
    id: number;
    name: string;
}

export interface ExtendedMonumentTypes extends MonumentTypes {
    statusCode: number;
}

export interface MonumentTypes {
    id: number;
    name: string;
    photo_file: string | null;
}

export interface ExtendedStationStatus extends StationStatus {
    statusCode: number;
}

export interface StationStatus {
    id: number;
    name: string;
}

export interface StationFilesData {
    id: number;
    station: number;
    filename: string;
    actual_file: string;
    description: string;
    statusCode: number;
}

export interface StationEvents {
    event_id: string | null;
    event_date: string | null;
    event_type: string | null;
    network_code: string | null;
    station_code: string | null;
    year: string | null;
    doy: string | null;
    description: string | null;
    stack: string | null;
    module: string | null;
    node: string | null;
}

export interface VisitFilesData {
    id: number;
    visit: number;
    filename: string;
    description: string;
    statusCode: number;
}

export interface CompletionPlotServiceData {
    completion_plot: string;
    statusCode: number;
}

export interface StationVisitsData {
    [key: string]: string | number;
    campaign: string | null;
    campaign_name?: string | null;
    campaign_people: string | null;
    date: string;
    id: number;
    // api_id added to avoid error on station when redirect visit from campaign
    api_id?: number;
    log_sheet_actual_file: string | null;
    log_sheet_filename: string;
    navigation_actual_file: string | null;
    navigation_filename: string;
    people: string[{ id: number; name: string }];
    planned: boolean;
    station: number;
    station_network_code: string;
    station_station_code: string;
    comments: string;
    observation_file_count: number;
    visit_image_count: number;
    other_file_count: number;
}

export interface VisitTransferOutcome {
    visit: number;
    date: string;
}

export interface VisitTransferRejection extends VisitTransferOutcome {
    error: string;
}

export interface VisitTransferBody {
    visits: number[];
    destination_station: number;
}

export interface VisitTransferServiceData {
    transferred: VisitTransferOutcome[];
    rejected: VisitTransferRejection[];
    statusCode: number;
}

export interface StationPostVisitData {
    campaign: string;
    date: string;
    id: number;
    log_sheet_actual_file: string | null;
    log_sheet_filename: string;
    navigation_actual_file: string | null;
    navigation_filename: string;
    people: number[];
    station: number;
    statusCode: number;
}

export interface StationCampaignsData {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    default_people: number[];
}

export interface StationVisitsFilesData {
    actual_image: string | null;
    actual_file?: string | null;
    filename: string;
    description: string;
    name: string;
    id: number;
    visit: number;
    size?: string;
}

export interface StationImagesData {
    actual_image: string | null;
    filename: string;
    description: string;
    name: string;
    id: number;
    station: number;
}

export interface Photo {
    id: number;
    actual_image: string;
    description: string;
    name: string;
}

export interface StationTypeServiceData {
    count: number;
    total_count: number;
    data: StationTypeData[];
    statusCode: number;
}

export interface StationStatusServiceData {
    count: number;
    total_count: number;
    data: StationStatusData[];
    statusCode: number;
}

export interface ColorData {
    id: number;
    color: string;
}

export interface ColorServiceData {
    count: number;
    data: colorData[];
    total_count: number;
    statusCode: number;
}

export interface StationTypeData {
    actual_image?: string | File;
    image: string | File;
    id: number;
    name: string;
    search_icon_on_assets_folder: boolean;
}

export interface StationStatusData {
    id: number;
    color_name: string;
    name: string;
    color: number;
}

export interface StationImagesServiceData {
    count: number;
    total_count: number;
    data: StationPhotosData[];
    statusCode: number;
}

export interface PeopleServiceData {
    count: number;
    total_count: number;
    data: People[];
}

export interface ExtendedPeople extends People {
    statusCode: number;
}

export interface People {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    address: string;
    photo_actual_file: string;
    user?: number | string | null;
    institution?: string;
    position?: string;
    user_name: string;
}

export type PeopleSelectedData =
    | undefined
    | [
          number,
          string,
          string,
          string,
          string,
          string,
          number | string,
          string,
          string,
          string,
      ];

export interface EndpointCluster {
    [key: string]: [
        {
            id: number;
            resource: string;
            description: string;
            cluster_type: Cluster;
            endpoints: [number];
        },
    ];
}

export interface FrontPagesData {
    [key: string]: [
        {
            description: string;
            endpoint_clusters: [number];
            id: number;
            url: string;
        },
    ];
}

export interface NetworkData {
    api_id: number;
    network_code: string;
    network_name: string;
}

export interface ExtendedNetworkData extends NetworkData {
    statusCode: number;
}

export interface CountriesData {
    id: number;
    name: string;
    three_digits_code: string;
    two_digits_code: string;
}

export interface RinexData {
    network_code: string;
    station_code: string;
    filtered: boolean;
    observation_year: number;
    observation_month: number;
    observation_day: number;
    observation_doy: number;
    observation_f_year: number;
    observation_s_time: string;
    observation_e_time: string;
    receiver_type: string;
    receiver_serial: string;
    receiver_fw: string;
    antenna_type: string;
    antenna_serial: string;
    antenna_dome: string;
    filename: string;
    interval: number;
    antenna_offset: number;
    completion: number;
    api_id: number;
    has_station_info: boolean;
    has_multiple_station_info_gap: boolean;
    metadata_mismatch: string[];
    gap_type: string | null;
}

export interface ExtendedStationData extends StationData {
    statusCode: number;
}

export interface GapData {
    record_end_date_end: string | null;
    record_end_date_start: string | null;
    record_start_date_end: string | null;
    record_start_date_start: string | null;
    rinex_count: number;
    station_meta: number;
}

/**
 * Los campos opcionales son los que `only_metadata=true` NO devuelve. Los
 * consumidores de listas (mapa y selectores de estacion) piden esa forma
 * reducida; el detalle de una estacion (`useStation`, `Station.tsx`) pide la
 * completa. Marcarlos opcionales hace que TS avise si una vista de lista
 * intenta leerlos.
 */
export interface StationData {
    api_id?: number;
    visitDetail?: any;
    network_code: string;
    station_code: string;
    station_name: string;
    date_start: number;
    date_end: number;
    auto_x?: number;
    auto_y?: number;
    auto_z?: number;
    harpos_coeff_otl?: string;
    has_gaps: boolean;
    has_stationinfo: boolean;
    lat: number;
    lon: number;
    height?: number;
    max_dist?: number;
    dome?: string;
    country_code: string;
    marker?: number;
    gaps: GapData[];
    mainParams?: GetParams;
    status: string;
    type: string | null;
    plate?: string | null;
}

export interface StationInfoData {
    antenna_code: string;
    antenna_east: string;
    antenna_height: string;
    antenna_north: string;
    antenna_serial: string;
    antenna_azimuth?: string;
    api_id: number;
    comments: null | string;
    date_end: string;
    date_start: string;
    height_code: string;
    network_code: string;
    radome_code: string;
    receiver_code: string;
    receiver_firmware: string;
    receiver_serial: string;
    receiver_vers: string;
    station_code: string;
}

export interface ReceiversData {
    api_id: number;
    receiver_code: string;
    receiver_description: string | null;
}

export interface AntennaData {
    api_id: number;
    antenna_code: string;
    antenna_description: string | null;
}

export interface GamitHTCData {
    antenna_code: string;
    api_id: number;
    h_offset: number;
    height_code: string;
    v_offset: number;
}

export interface RolePersonStationData {
    id: number;
    role: number;
    person: number;
    station: number;
}

export interface ExtendedRolePersonStationData extends RolePersonStationData {
    statusCode: number;
}

export interface ConfigJumpData {
    Year: number;
    DOY: number;
    action: string;
    fit: boolean;
    type: number;
    type_name: string;
    metadata: string;
    relaxation: number[];
    type: string;
}

export interface JumpType {
    id: number;
    type: string;
}

export interface ConfigPolynomialData {
    DOY: number;
    Year: number;
    terms: number;
}

export interface TimeSeriesParamsData {
    jumps: ConfigJumpData[];
    periodic: any;
    polynomial: ConfigPolynomialData;
    copy_params?: boolean;
}

export interface TimeSeriesParamsServiceData {
    current_config: TimeSeriesParamsData;
    statusCode: number;
}

export interface SourcesServerServiceData {
    count: number;
    data: SourcesServerData[];
    statusCode: number;
    total_count: number;
}

export interface SourcesServerData {
    format: string;
    fqdn: string;
    password: string;
    path: string | null;
    protocol: string;
    server_id: number;
    username: string;
    metadata_source_id: number | null;
}

export interface SourcesMetadataServiceData {
    count: number;
    data: SourcesMetadataData[];
    statusCode: number;
    total_count: number;
}

export interface SourcesMetadataData {
    id: number;
    protocol: string;
    fqdn: string;
    username: string | null;
    password: string | null;
    path: string | null;
    format: string | null;
}

export interface SourcesFormatServiceData {
    count: number;
    data: SourcesFormatData[];
    statusCode: number;
    total_count: number;
}

export interface SourcesFormatData {
    api_id: number;
    format: string;
}

export interface SourcesStationsServiceData {
    count: number;
    data: SourcesStationsData[];
    statusCode: number;
    total_count: number;
}

export interface SourcesStationsData {
    api_id: number;
    network_code: string;
    station_code: string;
    try_order: number;
    path: string | null;
    server_id: number;
    format: string;
}

export type ProcessingEngine = "gamit" | "pages";
export type ReferenceFrameEngine = ProcessingEngine;

export interface ReferenceFrameData {
    api_id: number;
    frame_name: string;
    engine: ReferenceFrameEngine;
    project: string;
    fixed_plate: string | null;
    constraints_id: string | null;
    position_wrms: number | null;
    velocity_wrms: number | null;
    periodic_wrms: number[] | null;
    euler_pole: number[] | null;
    euler_pole_stations: string[] | null;
    first_epoch: string | null;
    last_epoch: string | null;
    created: string;
    modified: string;
    /** Filas de `stacks` con este frame_name (calculado por el backend). */
    stacks_count: number;
}

export interface ReferenceFramesServiceData {
    count: number;
    data: ReferenceFrameData[];
    statusCode: number;
    total_count: number;
}

export type GamitNetworkType = "regional" | "global";
export type GamitExperimentType = "baseline" | "relax" | "orbit";
export type GamitOverconstAction = "inflate" | "relax" | "remove" | "delete";
export type GnssSystem = "G" | "R" | "E" | "C";

export interface ProcessingProjectBase {
    api_id: number;
    project: string;
    station_list: string[] | null;
}

export interface GamitProjectData extends ProcessingProjectBase {
    network_type: GamitNetworkType;
    cluster_size: number;
    ties: number;
    process_defaults: string | null;
    sestbl: string | null;
    solutions_dir: string | null;
    experiment_type: GamitExperimentType;
    experiment_name: string | null;
    org: string | null;
    noftp: boolean;
    eop_type: string;
    systems: GnssSystem[] | null;
    overconst_action: GamitOverconstAction | null;
    sigma_floor_h: string;
    sigma_floor_v: string;
}

export interface ProcessingProjectsServiceData<
    T extends ProcessingProjectBase = ProcessingProjectBase,
> {
    count: number;
    data: T[];
    statusCode: number;
    total_count: number;
}

export interface ProcessingStationListParams {
    station_type?: number;
    country_code?: string[];
    lat?: number;
    lon?: number;
    distance_km?: number;
    polygon?: { lat: number; lon: number }[];
}

export interface ProcessingStationListData {
    count: number;
    station_list: string[];
    stations: StationData[];
    statusCode: number;
}

// Campaign planner (api/campaign-planner, api/campaign-plans). Solo se guardan los
// parametros: el plan se regenera con POST /api/campaign-planner cada vez.
export type CampaignNewSite =
    | string
    | { name?: string; lat: number; lon: number }
    | { name?: string; city: string };

export interface CampaignPlanParams {
    start_city: string;
    end_city: string;
    start_date: string;
    stations: string[];
    new_sites: CampaignNewSite[];
    time_on_site_minutes: number;
    station_time_overrides: Record<string, number>;
    fuel_cost_per_km: number;
    lodging_cost_per_night: number;
    per_diem_cost_per_day: number;
    num_participants: number;
    day_start: string;
    hard_stop: string;
}

export interface CampaignPlanData extends CampaignPlanParams {
    id: number;
    name: string;
}

export interface CampaignPlansServiceData {
    count: number;
    total_count: number;
    data: CampaignPlanData[];
    statusCode: number;
}

export interface CampaignPlanStop {
    type: "origin" | "station" | "new_site" | "intermediate" | "destination";
    name: string;
    code: string | null;
    lat: number | null;
    lon: number | null;
    arrival: string | null;
    departure: string | null;
    leg_km: number;
    leg_drive_minutes: number;
    leg_fuel_cost: number;
    time_on_site_minutes?: number;
    warning: string | null;
    // [lon, lat] como GeoJSON
    geometry: [number, number][];
}

export interface CampaignPlanDay {
    day_number: number;
    date: string;
    stops: CampaignPlanStop[];
    day_total_km: number;
    day_total_drive_minutes: number;
    day_total_fuel_cost: number;
}

export interface CampaignPlanSummary {
    total_km: number;
    total_drive_minutes: number;
    total_fuel_cost: number;
    total_lodging_cost: number;
    total_per_diem_cost: number;
    total_days: number;
    total_stations: number;
    num_participants: number;
}

export interface CampaignPlanResult {
    days: CampaignPlanDay[];
    summary: CampaignPlanSummary;
}

export interface CampaignPlannerData {
    html: string;
    plan: CampaignPlanResult;
    statusCode: number;
}

export interface GeocodeCityData {
    name: string;
    lat: number;
    lon: number;
    statusCode: number;
}

export interface Filter {
    type?: string;
    title: string;
    multiple_titles?: { title: string; label: string }[];
    input: string | boolean;
    multiple_inputs?: string[] | { title: string; label: string }[];
    to?: boolean;
    label: string;
}
export interface TraceData {
    api_id: number;
    network_code: string;
    station_code: string;
    observation_year: number;
    observation_month: number;
    observation_day: number;
    observation_doy: number;
    observation_f_year: number;
    observation_s_time: string;
    observation_e_time: string;
    receiver_type: string;
    receiver_serial: string;
    receiver_fw: string;
    antenna_type: string;
    antenna_serial: string;
    antenna_dome: string;
    antenna_height?: float;
    antenna_code?: string;
    radome_code?: string;
    filename: string;
    interval: number;
    antenna_offset: float;
    completion: number;
    antenna_north?: float;
    antenna_east?: float;
    height_code?: string;
    receiver_code?: string;
    date_start?: string;
    date_end?: string;
}

// Tipo para la respuesta de la API
export interface TraceResponse {
    count: number;
    total_count: number;
    data: TraceData[];
}

// Tipo para los filtros/toggles
export interface RinexFilters {
    showHeight: boolean;
    showHeightCode: boolean;
    showAntennaCode: boolean;
    showAntennaSerial: boolean;
    showAntennaRadome: boolean;
    showReceiverCode: boolean;
    showReceiverType: boolean;
    showObservationStartTime: boolean;
    showObservationEndTime: boolean;
}

export interface StationInfoFilters {
    showHeight: boolean;
    showHeightCode: boolean;
    showAntennaCode: boolean;
    showAntennaSerial: boolean;
    showNorth: boolean;
    showEast: boolean;
    showAntennaRadome: boolean;
    showReceiverCode: boolean;
    showReceiverSerial: boolean;
    showDateStart: boolean;
    showDateEnd: boolean;
}
