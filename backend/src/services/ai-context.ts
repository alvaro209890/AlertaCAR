import { createHash } from 'node:crypto'
import db from '../db/connection.js'

export type CarAiContext = {
  cadastro: { numero: string; municipio: string | null; areaHa: number | null; bioma: string | null }
  camadas: Record<string, number>
  conformidade: { arlExigidaHa: number | null; arlDeclaradaHa: number | null; deficitArlHa: number | null }
  alertas: Array<{ id: string; classe: string | null; data: string; areaHa: number | null; fonte: string; status: string; titulo: string }>
  sobreposicoes: Array<{ tipo: string; nome: string; percentual: number }>
  autorizacoes: Array<{ tipo: string; numero: string | null; validade: string | null }>
  ndviTrend: Array<{ ano: number; ndviMedio: number | null }>
}

export function hashAiContext(context: unknown): string {
  return createHash('sha256').update(JSON.stringify(context)).digest('hex')
}

/** Builds environmental-only context; user name, email and WhatsApp are deliberately excluded. */
export function buildCarContext(carId: string, userId: string): CarAiContext | null {
  const car = db.prepare(`SELECT car_number, municipality, area_ha, bioma, arl_exigida_ha, arl_declarada_ha, deficit_arl_ha
    FROM cars WHERE id = ? AND user_id = ? AND active = 1`).get(carId, userId) as any
  if (!car) return null

  const layers = db.prepare('SELECT layer_key, area_ha FROM car_layers WHERE car_id = ?').all(carId) as any[]
  const alerts = db.prepare(`SELECT id, class_type, detected_date, area_ha, source, status, title
    FROM alerts WHERE car_id = ? ORDER BY detected_date DESC LIMIT 30`).all(carId) as any[]
  const overlaps = db.prepare(`SELECT tipo, nome, coverage_percent FROM car_sobreposicoes
    WHERE car_id = ? ORDER BY coverage_percent DESC LIMIT 20`).all(carId) as any[]
  const licenses = db.prepare(`SELECT tipo, numero_titulo, data_vencimento FROM car_licenses
    WHERE car_id = ? ORDER BY data_vencimento LIMIT 20`).all(carId) as any[]
  const ndvi = db.prepare('SELECT year, mean_ndvi FROM car_ndvi WHERE car_id = ? ORDER BY year').all(carId) as any[]

  return {
    cadastro: { numero: car.car_number, municipio: car.municipality, areaHa: car.area_ha, bioma: car.bioma },
    camadas: Object.fromEntries(layers.map((row) => [row.layer_key, row.area_ha])),
    conformidade: { arlExigidaHa: car.arl_exigida_ha, arlDeclaradaHa: car.arl_declarada_ha, deficitArlHa: car.deficit_arl_ha },
    alertas: alerts.map((row) => ({ id: row.id, classe: row.class_type, data: row.detected_date, areaHa: row.area_ha, fonte: row.source, status: row.status || 'novo', titulo: row.title })),
    sobreposicoes: overlaps.map((row) => ({ tipo: row.tipo, nome: row.nome, percentual: row.coverage_percent })),
    autorizacoes: licenses.map((row) => ({ tipo: row.tipo, numero: row.numero_titulo, validade: row.data_vencimento })),
    ndviTrend: ndvi.map((row) => ({ ano: row.year, ndviMedio: row.mean_ndvi })),
  }
}

export function buildPortfolioContext(userId: string) {
  const rows = db.prepare(`SELECT c.id, c.car_number, c.municipality, c.area_ha,
    COUNT(a.id) AS alertas, COALESCE(SUM(CASE WHEN a.status IN ('novo', 'em_analise') THEN 1 ELSE 0 END), 0) AS pendentes,
    MAX(a.detected_date) AS ultimo_alerta
    FROM cars c LEFT JOIN alerts a ON a.car_id = c.id
    WHERE c.user_id = ? AND c.active = 1 GROUP BY c.id ORDER BY pendentes DESC, alertas DESC`).all(userId) as any[]
  return {
    totalImoveis: rows.length,
    imoveis: rows.map((row) => ({ numero: row.car_number, municipio: row.municipality, areaHa: row.area_ha, alertas: row.alertas, pendentes: row.pendentes, ultimoAlerta: row.ultimo_alerta })),
  }
}
