import config from '../lib/config.js'
import db from '../db/connection.js'
import { v4 as uuid } from 'uuid'

/* ─── Constantes SCCON ─── */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const TOKEN_URL = 'https://plataforma.sccon.com.br/gama-api/auth/token-public-layer'
const SEARCH_URL = 'https://deforestation-data-mt.sccon.com.br/api-v2/alerts/search'

const DEFAULT_CLASSES = [
  'CUT',
  'SELECTIVE_EXTRACTION',
  'DEGRADATION_SELECTIVE_CUT',
  'BURN_SCAR',
  'FOCUS_OF_BURN',
  'MINERAL_EXTRACTION',
  'AIRSTRIP_OPENING',
  'ACCESS',
]

interface ScconAlert {
  id: number
  sourceId: string
  classType: string
  detectedDate: string
  areaHa: number
  geometry: any
  carCode: string
}

interface ScconSearchResponse {
  content: Array<{
    id: number
    alertDetectedDate: string
    classType: string
    area: number
    geometry?: any
    cdCar?: string
  }>
  totalElements: number
  totalPages: number
  number: number
}

// Cache de token em memória (válido por ~24h)
let cachedToken: { token: string; expiresAt: number } | null = null

/* ─── Token Público ─── */

export async function getPublicToken(): Promise<string> {
  // Cache hit?
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token
  }

  const url = `${TOKEN_URL}?organizationUUID=${config.sccon.orgUuid}`
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': UA,
      'Origin': 'https://alertas.sccon.com.br',
      'Referer': 'https://alertas.sccon.com.br/matogrosso/',
    },
  })

  if (!res.ok) {
    throw new Error(`SCCON token error: HTTP ${res.status}`)
  }

  const data = await res.json() as any
  const token = data.token || data.access_token || data

  if (typeof token !== 'string') {
    throw new Error(`SCCON token: unexpected response ${JSON.stringify(data).slice(0, 100)}`)
  }

  // Cache por 23 horas
  cachedToken = {
    token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  }

  console.log('[sccon] Token público obtido com sucesso')
  return token
}

/* ─── Busca de Alertas por CAR ─── */

export async function searchAlertsByCar(
  carNumberWfs: string,
  startDate?: string,
): Promise<ScconAlert[]> {
  const token = await getPublicToken()
  
  // Converte "MTXXXXX/YYYY" para formato que a SCCON espera
  // A SCCON usa o formato "XXXXX/YYYY" (sem o "MT")
  const carCode = carNumberWfs.replace(/^MT/i, '')
  
  const body = {
    classTypes: DEFAULT_CLASSES,
    selectedFilters: [{
      localType: 'STATE',
      localIds: null,
      parentLocalIds: [],
    }],
    rangeDate: [{
      start: startDate || config.sccon.startDate,
      end: new Date().toISOString().split('T')[0],
    }],
    organizationUUID: config.sccon.orgUuid,
    cdCars: [carCode],
    page: 0,
    pageSize: 50,
  }

  console.log(`[sccon] Buscando alertas para CAR ${carCode}...`)

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': UA,
      'Origin': 'https://alertas.sccon.com.br',
      'Referer': 'https://alertas.sccon.com.br/matogrosso/',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`SCCON search error: HTTP ${res.status} — ${text.slice(0, 200)}`)
  }

  const data = await res.json() as ScconSearchResponse
  
  if (!data.content || !Array.isArray(data.content)) {
    console.log('[sccon] Resposta sem content:', JSON.stringify(data).slice(0, 200))
    return []
  }

  const alerts: ScconAlert[] = data.content.map(item => ({
    id: item.id,
    sourceId: String(item.id),
    classType: item.classType,
    detectedDate: item.alertDetectedDate,
    areaHa: item.area || 0,
    geometry: item.geometry || null,
    carCode: item.cdCar || carCode,
  }))

  console.log(`[sccon] ${alerts.length} alertas encontrados (total: ${data.totalElements})`)
  return alerts
}

/* ─── Filtrar e Salvar Alertas Novos ─── */

export async function saveNewAlerts(
  carId: string,
  userId: string,
  alerts: ScconAlert[],
): Promise<{ saved: number; skipped: number; alerts: any[] }> {
  let saved = 0
  let skipped = 0
  const savedAlerts: any[] = []

  const insert = db.prepare(`
    INSERT OR IGNORE INTO alerts (id, car_id, user_id, source, source_id, class_type, title, description, detected_date, area_ha, geometry_json)
    VALUES (?, ?, ?, 'sccon', ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const alert of alerts) {
    // Verificar se já existe (por source_id + car_id)
    const existing = db.prepare(
      'SELECT id FROM alerts WHERE source_id = ? AND car_id = ? AND source = ?'
    ).get(String(alert.id), carId, 'sccon')

    if (existing) {
      skipped++
      continue
    }

    const title = classLabel(alert.classType)
    const description = `${title} — ${alert.areaHa.toFixed(2)} ha em ${formatDate(alert.detectedDate)}`

    try {
      insert.run(
        uuid(),
        carId,
        userId,
        String(alert.id),
        alert.classType,
        title,
        description,
        alert.detectedDate,
        alert.areaHa || 0,
        alert.geometry ? JSON.stringify(alert.geometry) : null,
      )
      saved++
    } catch (err: any) {
      // IGNORE constraint pode falhar, mas logamos
      if (!err.message?.includes('UNIQUE constraint')) {
        console.error(`[sccon] Erro ao salvar alerta ${alert.id}:`, err.message)
      }
      skipped++
    }
  }

  console.log(`[sccon] Salvos: ${saved}, já existentes: ${skipped}`)
  return { saved, skipped, alerts: savedAlerts }
}

/* ─── Verificação Completa de um CAR ─── */

export interface CheckResult {
  carId: string
  carNumber: string
  alertsFound: number
  alertsNew: number
  alertsSkipped: number
  error?: string
}

export async function checkCar(carId: string): Promise<CheckResult> {
  const car = db.prepare('SELECT * FROM cars WHERE id = ? AND active = 1').get(carId) as any
  if (!car) throw new Error(`CAR ${carId} não encontrado`)

  const result: CheckResult = {
    carId,
    carNumber: car.car_number,
    alertsFound: 0,
    alertsNew: 0,
    alertsSkipped: 0,
  }

  try {
    const carWfs = car.car_number_wfs || car.car_number
    const alerts = await searchAlertsByCar(carWfs)
    result.alertsFound = alerts.length

    const { saved, skipped } = await saveNewAlerts(carId, car.user_id, alerts)
    result.alertsNew = saved
    result.alertsSkipped = skipped

    // Atualizar data da última verificação
    db.prepare('UPDATE cars SET last_check_at = datetime(?) WHERE id = ?')
      .run(new Date().toISOString(), carId)
  } catch (err: any) {
    console.error(`[sccon] Erro ao verificar CAR ${car.car_number}:`, err.message)
    result.error = err.message
  }

  return result
}

/* ─── Verificação de Todos os CARs Ativos (para Cron) ─── */

export async function checkAllActiveCars(): Promise<{
  total: number
  results: CheckResult[]
  totalNewAlerts: number
  errors: number
}> {
  const cars = db.prepare('SELECT id FROM cars WHERE active = 1').all() as any[]
  
  const results: CheckResult[] = []
  let totalNewAlerts = 0
  let errors = 0

  console.log(`[sccon] Iniciando verificação de ${cars.length} CARs ativos...`)

  for (const car of cars) {
    try {
      const result = await checkCar(car.id)
      results.push(result)
      totalNewAlerts += result.alertsNew
      if (result.error) errors++
      
      // Pequeno delay entre CARs para não sobrecarregar
      await new Promise(r => setTimeout(r, 1000))
    } catch (err: any) {
      console.error(`[sccon] Falha crítica no CAR ${car.id}:`, err.message)
      errors++
    }
  }

  console.log(`[sccon] Verificação concluída: ${results.length} CARs, ${totalNewAlerts} novos alertas, ${errors} erros`)
  
  return {
    total: cars.length,
    results,
    totalNewAlerts,
    errors,
  }
}

/* ─── Helpers ─── */

function classLabel(classType: string): string {
  const labels: Record<string, string> = {
    'CUT': 'Desmatamento - Corte Raso',
    'SELECTIVE_EXTRACTION': 'Degradação - Extração Seletiva',
    'DEGRADATION_SELECTIVE_CUT': 'Degradação - Corte Seletivo',
    'BURN_SCAR': 'Cicatriz de Queimada',
    'FOCUS_OF_BURN': 'Foco de Queimada',
    'MINERAL_EXTRACTION': 'Extração Mineral',
    'DEGRADATION_CHEMICAL_AGENT': 'Degradação Química',
    'LANDSLIDES': 'Deslizamentos',
    'BLOW_DOWN': 'Derrubada por Vento',
    'AIRSTRIP_OPENING': 'Abertura de Pista',
    'ACCESS': 'Abertura de Acesso',
  }
  return labels[classType] || classType
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR')
  } catch {
    return dateStr
  }
}

export const ALERT_CLASSES = DEFAULT_CLASSES.map(c => ({
  code: c,
  label: classLabel(c),
}))
