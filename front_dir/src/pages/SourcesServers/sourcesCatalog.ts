import { SourcesMetadataData, SourcesServerData } from "@types";

/**
 * Protocolos aceptados por el CHECK de la DB. FTPA es FTP activo; FTPS **no
 * existe** en el backend (la DB devuelve 400), aunque el modal lo ofrecía.
 */
export const SOURCES_PROTOCOLS = ["FTP", "FTPA", "SFTP", "HTTP", "HTTPS"];

export const metadataSourceLabel = (metadata: SourcesMetadataData) =>
    [metadata.protocol, metadata.fqdn, metadata.path].filter(Boolean).join(" ");

export const rinexServerLabel = (server: SourcesServerData) =>
    `${server.fqdn} ${server.protocol}`;

/**
 * SyncMetadata resuelve el path/format con COALESCE(metadata, server), así que
 * lo heredado del server se muestra con "*" (misma convención que RINEX).
 */
export const inheritedFromServer = (
    metadataValue: string | null,
    serverValue: string | null,
) =>
    metadataValue && metadataValue !== ""
        ? metadataValue
        : "* " + (serverValue ?? "");
