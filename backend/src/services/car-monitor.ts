import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'
import type { SupportedPolygonGeometry } from './wfs-intersection.js'
import {
  fetchAllCarLayers,
  detectBioma,
  calcularConformidade,
} from './wfs-car-layers.js'
import {
  fetchEmbargos,
  fetchDesembargos,
  fetchInfracoes,
  fetchNotificacoes,
  fetchAutorizacoes,
  fetchSobreposicoes,
  fetchLicenciamento,
  type SemaFinding,
} from './wfs-sema-monitor.js'

// Orquestra a Fase 4 (fontes expandidas) para um único CAR: fiscalização,
// licenciamento, autorizações, sobreposições fundiárias e camadas do próprio
// imóvel (com cálculo de conformidade de Reserva Legal). Cada fonte é
// independente — falha em uma não bloqueia as outras (mesmo princípio do SCCON).

export type SemaAlertSource =
  | 'sema_embargo'
  | 'sema_desembargo'
  | 'sema_infracao'
  | 'sema_notificacao'
  | 'sema_autorizacao'
  | 'sema_licenca'
  | 'fundiario'

export interface SourceRunResult {
  source: SemaAlertSource | 'car_layers'
  found: number
  saved: number
  error?: string
}

export interface CarMonitorResult {
  carId: string
  carNumber: string
  sources: SourceRunResult[]
  totalNewAlerts: number
}

/** Insere achados como alertas, ignorando duplicados por (car_id, source, source_id). */
function saveFindingsAsAlerts(
  carId: string,
  userId: string,
  source: SemaAlertSource,
  findings: SemaFinding[],
): { saved: number; skipped: number } {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO alerts (id, car_id, user_id, source, source_id, class_type, title, description, detected_date, area_ha, geometry_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  let saved = 0
  let skipped = 0
  for (const finding of findings) {
    if (!finding.sourceId) {
      skipped++
      continue
    }
    const existing = db
      .prepare('SELECT id FROM alerts WHERE source_id = ? AND car_id = ? AND source = ?')
      .get(finding.sourceId, carId, source)
    if (existing) {
      skipped++
      continue
    }
    insert.run(
      uuid(),
      carId,
      userId,
      source,
      finding.sourceId,
      finding.classType,
      finding.title,
      finding.description || null,
      finding.detectedDate || new Date().toISOString().split('T')[0],
      finding.areaHa || 0,
      finding.geometry ? JSON.stringify(finding.geometry) : null,
    )
    saved++
  }
  return { saved, skipped }
}

function saveSobreposicoesAsAlertsIfNew(
  carId: string,
  userId: string,
  sobreposicoes: Array<{ tipo: string; nome: string; intersectionHa: number; coveragePercentOfPolygon: number }>,
): number {
  const existing = new Set(
    (db.prepare('SELECT tipo, nome FROM car_sobreposicoes WHERE car_id = ?').all(carId) as Array<{
      tipo: string
      nome: string
    }>).map((r) => `${r.tipo}::${r.nome}`),
  )

  const insertAlert = db.prepare(`
    INSERT OR IGNORE INTO alerts (id, car_id, user_id, source, source_id, class_type, title, description, detected_date, area_ha, geometry_json)
    VALUES (?, ?, ?, 'fundiario', ?, ?, ?, ?, ?, ?, NULL)
  `)
  let newCount = 0
  const today = new Date().toISOString().split('T')[0]
  for (const s of sobreposicoes) {
    const key = `${s.tipo}::${s.nome}`
    if (existing.has(key)) continue
    newCount++
    insertAlert.run(
      uuid(),
      carId,
      userId,
      `${s.tipo}::${s.nome}`,
      s.tipo,
      `Sobreposição — ${s.nome}`,
      `${s.coveragePercentOfPolygon.toFixed(2)}% do imóvel (${s.intersectionHa.toFixed(2)} ha) sobreposto a ${s.nome}`,
      today,
      s.intersectionHa,
    )
  }

  const upsert = db.prepare(`
    INSERT INTO car_sobreposicoes (id, car_id, tipo, nome, intersection_ha, coverage_percent, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(car_id, tipo, nome) DO UPDATE SET
      intersection_ha = excluded.intersection_ha,
      coverage_percent = excluded.coverage_percent,
      updated_at = datetime('now')
  `)
  for (const s of sobreposicoes) {
    upsert.run(uuid(), carId, s.tipo, s.nome, s.intersectionHa, s.coveragePercentOfPolygon)
  }
  return newCount
}

function saveLicencas(
  carId: string,
  licencas: Awaited<ReturnType<typeof fetchLicenciamento>>,
): { saved: number } {
  const upsert = db.prepare(`
    INSERT INTO car_licenses (id, car_id, tipo, numero_titulo, razao_social, data_aprovacao, data_vencimento, urgencia, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(car_id, tipo, numero_titulo) DO UPDATE SET
      razao_social = excluded.razao_social,
      data_aprovacao = excluded.data_aprovacao,
      data_vencimento = excluded.data_vencimento,
      urgencia = excluded.urgencia,
      updated_at = datetime('now')
  `)
  for (const l of licencas) {
    upsert.run(uuid(), carId, l.tipo, l.sourceId, l.description || null, l.detectedDate, l.dataVencimento, l.urgencia)
  }
  return { saved: licencas.length }
}

/** Licenças cuja urgência requer alerta (vencida ou dentro de 90 dias). */
function licencasParaAlertar(licencas: Awaited<ReturnType<typeof fetchLicenciamento>>): SemaFinding[] {
  return licencas
    .filter((l) => l.urgencia !== 'ok')
    .map((l) => ({
      sourceId: `${l.tipo}::${l.sourceId}::${l.urgencia}`,
      classType: l.classType,
      title: `${l.title} — ${l.urgencia === 'vencida' ? 'VENCIDA' : `vence em breve (${l.urgencia})`}`,
      description: l.description,
      detectedDate: new Date().toISOString().split('T')[0],
      areaHa: 0,
      geometry: null,
    }))
}

async function refreshCarLayersAndConformity(
  carId: string,
  carNumberWfs: string,
  polygon: SupportedPolygonGeometry,
  areaTotalHa: number,
): Promise<number> {
  const layers = await fetchAllCarLayers(carNumberWfs)

  const upsertLayer = db.prepare(`
    INSERT INTO car_layers (id, car_id, layer_key, label, area_ha, feature_count, extra_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(car_id, layer_key) DO UPDATE SET
      area_ha = excluded.area_ha,
      feature_count = excluded.feature_count,
      extra_json = excluded.extra_json,
      updated_at = datetime('now')
  `)
  for (const layer of layers) {
    upsertLayer.run(
      uuid(),
      carId,
      layer.key,
      layer.label,
      layer.areaHa,
      layer.featureCount,
      layer.maisRecenteAberturaAno !== undefined ? JSON.stringify({ maisRecenteAberturaAno: layer.maisRecenteAberturaAno }) : null,
    )
  }

  const arlLayer = layers.find((l) => l.key === 'ARL')
  const bioma = await detectBioma(polygon).catch((err) => {
    console.error(`[car-monitor] Erro ao detectar bioma para ${carNumberWfs}:`, err?.message || err)
    return null
  })
  const conformidade = calcularConformidade({
    areaTotalHa,
    arlDeclaradaHa: arlLayer?.areaHa || 0,
    bioma,
  })

  db.prepare(`
    UPDATE cars SET
      bioma = ?,
      arl_exigida_percent = ?,
      arl_exigida_ha = ?,
      arl_declarada_ha = ?,
      deficit_arl_ha = ?,
      layers_updated_at = datetime('now')
    WHERE id = ?
  `).run(
    conformidade.bioma,
    conformidade.arlExigidaPercent,
    conformidade.arlExigidaHa,
    conformidade.arlDeclaradaHa,
    conformidade.deficitArlHa,
    carId,
  )

  return layers.length
}

/** Roda todas as fontes SEMA expandidas (Fase 4) para um único CAR. */
export async function monitorCarMultilayer(carId: string): Promise<CarMonitorResult> {
  const car = db.prepare('SELECT * FROM cars WHERE id = ? AND active = 1').get(carId) as any
  if (!car) throw new Error(`CAR ${carId} não encontrado`)

  const result: CarMonitorResult = { carId, carNumber: car.car_number, sources: [], totalNewAlerts: 0 }

  if (!car.polygon_json) {
    result.sources.push({ source: 'car_layers', found: 0, saved: 0, error: 'Sem polígono — WFS não retornou geometria' })
    return result
  }

  const polygon: SupportedPolygonGeometry = JSON.parse(car.polygon_json)
  const carNumberWfs: string = car.car_number_wfs || car.car_number

  const runs: Array<[SemaAlertSource, () => Promise<SemaFinding[]>]> = [
    ['sema_embargo', () => fetchEmbargos(polygon)],
    ['sema_desembargo', () => fetchDesembargos(polygon)],
    ['sema_infracao', () => fetchInfracoes(polygon)],
    ['sema_notificacao', () => fetchNotificacoes(polygon)],
    ['sema_autorizacao', () => fetchAutorizacoes(polygon)],
  ]

  for (const [source, run] of runs) {
    try {
      const findings = await run()
      const { saved } = saveFindingsAsAlerts(carId, car.user_id, source, findings)
      result.sources.push({ source, found: findings.length, saved })
      result.totalNewAlerts += saved
    } catch (err: any) {
      result.sources.push({ source, found: 0, saved: 0, error: err?.message || String(err) })
    }
  }

  try {
    const sobreposicoes = await fetchSobreposicoes(polygon)
    const newCount = saveSobreposicoesAsAlertsIfNew(carId, car.user_id, sobreposicoes)
    result.sources.push({ source: 'fundiario', found: sobreposicoes.length, saved: newCount })
    result.totalNewAlerts += newCount
  } catch (err: any) {
    result.sources.push({ source: 'fundiario', found: 0, saved: 0, error: err?.message || String(err) })
  }

  try {
    const licencas = await fetchLicenciamento(polygon)
    saveLicencas(carId, licencas)
    const toAlert = licencasParaAlertar(licencas)
    const { saved } = saveFindingsAsAlerts(carId, car.user_id, 'sema_licenca', toAlert)
    result.sources.push({ source: 'sema_licenca', found: licencas.length, saved })
    result.totalNewAlerts += saved
  } catch (err: any) {
    result.sources.push({ source: 'sema_licenca', found: 0, saved: 0, error: err?.message || String(err) })
  }

  try {
    const count = await refreshCarLayersAndConformity(carId, carNumberWfs, polygon, car.area_ha || 0)
    result.sources.push({ source: 'car_layers', found: count, saved: count })
  } catch (err: any) {
    result.sources.push({ source: 'car_layers', found: 0, saved: 0, error: err?.message || String(err) })
  }

  return result
}

/** Roda a Fase 4 para todos os CARs ativos (uso pelo cron). */
export async function monitorAllCarsMultilayer(): Promise<{
  total: number
  results: CarMonitorResult[]
  totalNewAlerts: number
  errors: number
}> {
  const cars = db.prepare('SELECT id FROM cars WHERE active = 1').all() as Array<{ id: string }>
  const results: CarMonitorResult[] = []
  let totalNewAlerts = 0
  let errors = 0

  for (const car of cars) {
    try {
      const result = await monitorCarMultilayer(car.id)
      results.push(result)
      totalNewAlerts += result.totalNewAlerts
      if (result.sources.some((s) => s.error)) errors++
      await new Promise((r) => setTimeout(r, 500))
    } catch (err: any) {
      console.error(`[car-monitor] Falha crítica no CAR ${car.id}:`, err?.message)
      errors++
    }
  }

  return { total: cars.length, results, totalNewAlerts, errors }
}
