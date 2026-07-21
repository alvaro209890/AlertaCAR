export interface Car {
  id: string; carNumber: string; carNumberWfs: string | null; nickname: string | null
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  areaHa: number | null; municipality: string | null
  alertCount: number; unreadAlerts: number
  lastPolygonFetch: string | null; lastCheckAt: string | null; createdAt: string
}

export type AlertStatus = 'novo' | 'em_analise' | 'validado' | 'falso_positivo' | 'resolvido'
export type Severity = 'baixa' | 'media' | 'alta' | 'critica'

export interface Alert {
  id: string; carId: string; source: string; sourceId: string | null
  classType: string; title: string; description: string | null
  detectedDate: string; areaHa: number | null
  geometry: GeoJSON.Geometry | null
  sentToWhatsapp: number; sentAt: string | null
  status: AlertStatus; notes: string | null; severity: Severity
  createdAt: string
}

export interface CarLayer {
  key: string; label: string; areaHa: number; featureCount: number
  extra: { maisRecenteAberturaAno?: number | null } | null
  updatedAt: string
}

export interface CarLicense {
  tipo: string; numeroTitulo: string | null; razaoSocial: string | null
  dataAprovacao: string | null; dataVencimento: string | null
  urgencia: 'ok' | 'atencao_90d' | 'atencao_60d' | 'critica_30d' | 'vencida'
  updatedAt: string
}

export interface CarSobreposicao {
  tipo: string; nome: string; intersectionHa: number; coveragePercent: number; updatedAt: string
}

export interface Conformidade {
  bioma: string | null
  arlExigidaPercent: number | null
  arlExigidaHa: number | null
  arlDeclaradaHa: number | null
  deficitArlHa: number | null
  layersUpdatedAt: string | null
}

export interface CarDetail {
  car: Car
  alerts: Alert[]
  layers: CarLayer[]
  licenses: CarLicense[]
  sobreposicoes: CarSobreposicao[]
  conformidade: Conformidade
}
