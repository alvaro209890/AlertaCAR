// Catálogo curado de camadas WMS da SEMA-MT para o mapa (Fase 5.2).
// Nomes confirmados ao vivo em 21/07/2026 — ver ../../CAMADAS-SEMA.md.
// Renderizadas direto no navegador via WMSTileLayer (GetMap), sem proxy no backend.

export const SEMA_WMS_URL = 'https://geo.sema.mt.gov.br/geoserver/ows'
export const SEMA_WFS_AUTHKEY = import.meta.env.VITE_SEMA_WFS_AUTHKEY || '541085de-9a2e-454e-bdba-eb3d57a2f492'

export interface SemaBaseLayer {
  key: string; label: string; layerName: string
}

export interface SemaOverlayLayer {
  key: string; label: string; layerName: string; category: string; defaultOn: boolean
}

/** Camadas base de satélite (a aba Satélite/timelapse completa vem na Fase 6). */
export const SEMA_BASE_LAYERS: SemaBaseLayer[] = [
  { key: 'osm', label: 'OpenStreetMap', layerName: '' },
  { key: 'sentinel2024', label: 'Satélite Sentinel-2 (2024)', layerName: 'Mosaicos:SENTINEL_2_2024' },
  { key: 'landsat2011', label: 'Satélite Landsat 5 (2011)', layerName: 'Mosaicos:LANDSAT_5_2011' },
]

export const SEMA_OVERLAY_LAYERS: SemaOverlayLayer[] = [
  { key: 'embargo', label: 'Áreas embargadas', layerName: 'Geoportal:AREAS_EMBARGADAS_SEMA', category: 'Fiscalização', defaultOn: true },
  { key: 'desembargo', label: 'Áreas desembargadas', layerName: 'Geoportal:AREAS_DESEMBARGADAS_SEMA', category: 'Fiscalização', defaultOn: false },
  { key: 'autorizacao_desmate', label: 'Autorizações de desmate', layerName: 'Geoportal:AUTORIZACAO_DESMATE_SEMA', category: 'Autorizações', defaultOn: false },
  { key: 'autex_pmfs', label: 'Autorizações de exploração (PMFS)', layerName: 'Geoportal:AUTEX_PMFS_SEMA', category: 'Autorizações', defaultOn: false },
  { key: 'terras_indigenas', label: 'Terras Indígenas', layerName: 'Geoportal:TERRAS_INDIGENAS', category: 'Fundiário', defaultOn: true },
  { key: 'unidades_conservacao', label: 'Unidades de Conservação', layerName: 'Geoportal:UNIDADES_CONSERVACAO', category: 'Fundiário', defaultOn: true },
  { key: 'assentamentos_incra', label: 'Assentamentos INCRA', layerName: 'Geoportal:ASSENTAMENTOS_INCRA', category: 'Fundiário', defaultOn: false },
  { key: 'car_arl', label: 'Reserva Legal (ARL)', layerName: 'Geoportal:CAR_ARL', category: 'Camadas do CAR', defaultOn: false },
  { key: 'car_app', label: 'Área de Preservação Permanente (APP)', layerName: 'Geoportal:CAR_APP', category: 'Camadas do CAR', defaultOn: false },
  { key: 'car_avn', label: 'Vegetação Nativa (AVN)', layerName: 'Geoportal:CAR_AVN', category: 'Camadas do CAR', defaultOn: false },
  { key: 'car_auas', label: 'Uso Antrópico (AUAS)', layerName: 'Geoportal:CAR_AUAS', category: 'Camadas do CAR', defaultOn: false },
  { key: 'desmate_2018', label: 'Desmatamento histórico (2018)', layerName: 'Geoportal:DESMATAMENTO_SEMA_2018', category: 'Histórico', defaultOn: false },
]

export function wmsParams(layerName: string) {
  return {
    layers: layerName,
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    authkey: SEMA_WFS_AUTHKEY,
  }
}
