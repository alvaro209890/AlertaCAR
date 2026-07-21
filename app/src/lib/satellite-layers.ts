// Fase 6 — nomes de camada WMS por satélite/ano, espelhando backend/src/services/satellite.ts
// (SATELLITE_CATALOG). Mantido em espelho simples pelo mesmo motivo de ../lib/sema-layers.ts:
// o navegador renderiza o WMSTileLayer direto da SEMA, sem proxy — só precisa do nome da camada.

export function layerNameForSatellite(satId: string, year: number): string {
  switch (satId) {
    case 'landsat5':
      return `Mosaicos:LANDSAT_5_${year}`
    case 'landsat7':
      return 'Mosaicos:LANDSAT_7_2002'
    case 'landsat8':
      return `Mosaicos:LANDSAT_8_${year}`
    case 'sentinel2':
      return `Mosaicos:SENTINEL_2_${year}`
    case 'resourcesat':
      return 'Mosaicos:RESOURCESAT_2012'
    case 'spot':
      return 'Mosaicos:MOSAICO_SPOT_SEPLAN'
    default:
      return `Mosaicos:SENTINEL_2_${year}`
  }
}
