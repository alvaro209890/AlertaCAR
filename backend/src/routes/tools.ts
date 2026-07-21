/**
 * Ferramentas de validação/processamento de geometria SIMCAR/SEMA-MT
 * (Fase 13 do plano do AlertaCAR), portadas do GeoForest-IA.
 *
 * Diferente do GeoForest (uploads grandes/assíncronos com progresso via SSE,
 * pensados para o Projeto Geográfico inteiro do imóvel), o caso de uso aqui é
 * validar um shapefile pequeno que o consultor sobe manualmente — por isso
 * os endpoints abaixo são SÍNCRONOS, sem job/fila/SSE/armazenamento de
 * arquivo do usuário (decisão consciente, ver docs da Fase 13).
 *
 * Prefixo próprio '/api/tools' (não '/api' bare) — hoje há vários routers
 * montados no prefixo bare '/api' com requireAuth irrestrito; usar um
 * prefixo próprio evita qualquer risco de ordenação de middleware.
 */
import { Router, type NextFunction, type Response } from 'express'
import multer from 'multer'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import {
  getZipLayerGroups,
  detectCrs,
  parsePolygonRecords,
  analyzeLayer,
} from '../services/vertices-proximas.js'
import { checkSimcarConformity, recognizeSimcarLayer, normalizeLayerName } from '../services/simcar-rules.js'
import {
  analyzeLayerGeometry,
  detectOverlaps,
  detectGaps,
  detectSimcarContainment,
  detectSimcarForbiddenOverlaps,
  detectAirAtpAreaConsistency,
  type GeometryErrorRow,
  type SimcarRuleLayer,
} from '../services/geometry-errors.js'
import { analyzeContainment } from '../services/containment-analysis.js'
import { generateSimcarDerivedLayers, parsePointRecords, type ProcessarGeoInputLayer } from '../services/processar-geo.js'
import { buildExport, type ExportFeature, type ExportFormat, type ExportLayer } from '../services/gis-export.js'

const router = Router()

router.use(requireAuth)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB — shapefile de consultor, não o Projeto Geográfico inteiro
})

/** Envolve multer.single para responder JSON (em vez do handler de erro padrão do Express) em falhas de upload. */
function uploadSingle(field: string) {
  const middleware = upload.single(field)
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    middleware(req as any, res, (err: any) => {
      if (err) {
        const message =
          err?.code === 'LIMIT_FILE_SIZE' ? 'Arquivo excede o limite de 20 MB.' : err?.message || 'Falha no upload.'
        res.status(400).json({ error: message })
        return
      }
      next()
    })
  }
}

function requireZipBuffer(req: AuthRequest): Buffer {
  const file = req.file
  if (!file || !file.buffer || !file.buffer.length) {
    throw new Error('Envie o shapefile compactado (.zip) no campo "file".')
  }
  return file.buffer
}

const VALID_EXPORT_FORMATS: ExportFormat[] = ['shp', 'csv', 'geojson', 'kml', 'kmz', 'gpkg']

function parseExportFormat(raw: unknown): ExportFormat | null {
  const value = String(raw ?? '').toLowerCase()
  return (VALID_EXPORT_FORMATS as string[]).includes(value) ? (value as ExportFormat) : null
}

function sendExport(res: Response, result: { buffer: Buffer; filename: string; contentType: string }) {
  res.setHeader('Content-Type', result.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  res.send(result.buffer)
}

type ZipLayerGroups = ReturnType<typeof getZipLayerGroups>

function buildRuleLayers(groups: ZipLayerGroups): SimcarRuleLayer[] {
  return groups
    .filter((group) => group.shp)
    .map((group) => ({
      name: group.name,
      records: parsePolygonRecords(group.shp!.data),
      crs: detectCrs(group.prj?.data.toString('utf8')),
      dbf: group.dbf?.data,
    }))
}

/**
 * Limites empíricos de complexidade — descobertos testando com Projetos Geográficos REAIS
 * (fixtures do GeoForest: CAR Santa Clara, ~28 camadas). `detectGaps`/`detectOverlaps` fazem
 * comparação par-a-par de feições/vértices e explodem em camadas densas: uma camada de 88
 * feições / 9.899 vértices levou 35s SÓ no detectGaps; o Projeto inteiro (com ARL/AVN de 242
 * feições cada) nunca terminou em 5 minutos. Como o backend é single-thread (Node), isso
 * travaria a API inteira pra todos os usuários durante o processamento — inaceitável pra um
 * endpoint síncrono. Sem infra de fila assíncrona (decisão consciente da Fase 13, ver topo do
 * arquivo), a mitigação é pular os checks pare-a-par em camadas grandes demais, com aviso claro,
 * mantendo os checks O(vértices) de cada feição (rápidos e sempre executados).
 */
const MAX_LAYER_FEATURES_FOR_PAIRWISE_CHECKS = 50
const MAX_LAYER_VERTICES_FOR_PAIRWISE_CHECKS = 3000
const MAX_TOTAL_FEATURES_FOR_CROSS_LAYER_CHECKS = 300
const MAX_TOTAL_VERTICES_FOR_CROSS_LAYER_CHECKS = 15000

function countVertices(records: Array<{ rings: number[][][] }>): number {
  return records.reduce((sum, r) => sum + r.rings.reduce((s, ring) => s + ring.length, 0), 0)
}

/**
 * Núcleo da Fase 13.1: roda a conformidade SIMCAR (nomenclatura/CRS/2D/
 * primitiva/ATP única/atributos obrigatórios), as regras do Anexo 01
 * (contenção + sobreposições proibidas + soma AIR×ATP) e, por camada,
 * auto-interseção/vértices duplicados/sobreposição/vazios — mesma
 * orquestração do antigo runGeometryJob do GeoForest, só que síncrona
 * (sem progress/SSE/storage), com guarda de complexidade (ver constantes acima).
 */
function runGeometryValidation(zipBuffer: Buffer): {
  errors: GeometryErrorRow[]
  camadas: Array<{ name: string; featureCount: number; crsLabel: string; errors: number }>
  warnings: string[]
} {
  const groups = getZipLayerGroups(zipBuffer)
  const shpGroups = groups.filter((group) => group.shp)
  if (!shpGroups.length) {
    throw new Error('ZIP sem nenhum shapefile (.shp) reconhecível.')
  }

  const allRows: GeometryErrorRow[] = []
  const warnings: string[] = []

  allRows.push(
    ...checkSimcarConformity(
      shpGroups.map((group) => ({
        name: group.name,
        shp: group.shp!.data,
        prjText: group.prj?.data.toString('utf8'),
        dbf: group.dbf?.data,
      })),
    ),
  )

  const ruleLayers = buildRuleLayers(groups)
  const totalFeatures = ruleLayers.reduce((s, l) => s + l.records.length, 0)
  const totalVertices = ruleLayers.reduce((s, l) => s + countVertices(l.records), 0)

  if (totalFeatures > MAX_TOTAL_FEATURES_FOR_CROSS_LAYER_CHECKS || totalVertices > MAX_TOTAL_VERTICES_FOR_CROSS_LAYER_CHECKS) {
    warnings.push(
      `Projeto com ${totalFeatures} feições / ${totalVertices} vértices no total — acima do limite seguro para ` +
        `validação síncrona de contenção/sobreposição entre camadas (Anexo 01) nesta versão. Essas checagens foram ` +
        `PULADAS (não confunda com "aprovado"). Valide um subconjunto menor de camadas por vez, ou aguarde suporte ` +
        `a processamento assíncrono.`,
    )
  } else {
    const containment = detectSimcarContainment({ layers: ruleLayers })
    const crossOverlaps = detectSimcarForbiddenOverlaps({ layers: ruleLayers })
    const airAtp = detectAirAtpAreaConsistency({ layers: ruleLayers })
    allRows.push(...containment.rows, ...crossOverlaps.rows, ...airAtp.rows)
    warnings.push(...containment.warnings, ...crossOverlaps.warnings, ...airAtp.warnings)
  }

  const camadas: Array<{ name: string; featureCount: number; crsLabel: string; errors: number }> = []
  for (const group of shpGroups) {
    try {
      const records = parsePolygonRecords(group.shp!.data)
      const crs = detectCrs(group.prj?.data.toString('utf8'))
      const rows = analyzeLayerGeometry({ layerName: group.name, records, checks: {} })

      const vertices = countVertices(records)
      if (records.length > MAX_LAYER_FEATURES_FOR_PAIRWISE_CHECKS || vertices > MAX_LAYER_VERTICES_FOR_PAIRWISE_CHECKS) {
        warnings.push(
          `Camada ${group.name}: ${records.length} feições / ${vertices} vértices — acima do limite seguro para ` +
            `checagem síncrona de sobreposição/vazios dentro da camada; PULADA nesta versão (auto-interseção e ` +
            `vértices duplicados continuam verificados normalmente).`,
        )
      } else {
        const overlapResult = detectOverlaps({ layerName: group.name, records, crs })
        const gapResult = detectGaps({ layerName: group.name, records, crs })
        rows.push(...overlapResult.rows, ...gapResult.rows)
        warnings.push(...overlapResult.warnings, ...gapResult.warnings)
      }

      allRows.push(...rows)
      camadas.push({ name: group.name, featureCount: records.length, crsLabel: crs.label, errors: rows.length })
    } catch (error: any) {
      warnings.push(`${group.name}: ${error?.message || 'erro ao processar camada'}`)
      camadas.push({ name: group.name, featureCount: 0, crsLabel: 'erro', errors: 0 })
    }
  }

  return { errors: allRows, camadas, warnings }
}

/** Acha um grupo do ZIP por nome exato (normalizado) ou pelo código SIMCAR reconhecido. */
function findGroupByName(groups: ZipLayerGroups, name: string) {
  const norm = normalizeLayerName(name)
  const code = recognizeSimcarLayer(name)
  return groups.find(
    (group) => group.shp && (normalizeLayerName(group.name) === norm || (code && recognizeSimcarLayer(group.name) === code)),
  )
}

function parseNameList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v).trim()).filter(Boolean)
  if (typeof raw !== 'string') return []
  const trimmed = raw.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
    } catch {
      // segue para o parse por vírgula
    }
  }
  return trimmed
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

// POST /api/tools/validate-geometry — Fase 13.1
router.post('/validate-geometry', uploadSingle('file'), async (req: AuthRequest, res) => {
  try {
    const zipBuffer = requireZipBuffer(req)
    const result = runGeometryValidation(zipBuffer)

    const format = parseExportFormat(req.query.format)
    if (format) {
      const features: ExportFeature[] = result.errors.map(
        (row): ExportFeature => ({
          geometry: { type: 'Point', coordinates: [row.x, row.y] },
          properties: {
            camada: row.camada,
            tipo: row.tipo,
            feicao: row.feicao,
            parte: row.parte,
            anel: row.anel,
            detalhe: row.detalhe,
          },
        }),
      )
      if (!features.length) {
        res.status(404).json({ error: 'Nenhum erro de geometria encontrado para exportar.' })
        return
      }
      const exported = await buildExport(format, [{ key: 'erros_geometria', label: 'Erros de Geometria', features }], 'erros_geometria')
      sendExport(res, exported)
      return
    }

    res.json({ ok: result.errors.length === 0, errors: result.errors, camadas: result.camadas, warnings: result.warnings })
  } catch (err: any) {
    console.error('[tools] validate-geometry error:', err)
    res.status(400).json({ error: err?.message || 'Falha ao validar geometria.' })
  }
})

// POST /api/tools/vertices-proximas — Fase 13.2
router.post('/vertices-proximas', uploadSingle('file'), async (req: AuthRequest, res) => {
  try {
    const zipBuffer = requireZipBuffer(req)
    const groups = getZipLayerGroups(zipBuffer)
    const polygonGroups = groups.filter((group) => group.shp)
    if (!polygonGroups.length) {
      res.status(400).json({ error: 'ZIP sem shapefile poligonal.' })
      return
    }

    const pointCount = Math.max(1, Math.floor(Number(req.body?.pointCount) || 6))
    const toleranceRaw = req.body?.toleranceMm
    const toleranceMm = toleranceRaw === undefined || toleranceRaw === '' ? null : Number(toleranceRaw)

    const warnings: string[] = []
    const camadas: Array<{ name: string; found: number; requested: number; crsLabel: string }> = []
    const pairs: Array<{
      camada: string
      ranking: number
      feicao: number
      parte: number
      anel: number
      verticeA: number
      verticeB: number
      distM: number
      aOriginal: [number, number]
      bOriginal: [number, number]
      midOriginal: [number, number]
    }> = []

    for (const group of polygonGroups) {
      try {
        const preCheckRecords = parsePolygonRecords(group.shp!.data)
        const vertices = countVertices(preCheckRecords)
        if (preCheckRecords.length > MAX_LAYER_FEATURES_FOR_PAIRWISE_CHECKS || vertices > MAX_LAYER_VERTICES_FOR_PAIRWISE_CHECKS) {
          warnings.push(
            `Camada ${group.name}: ${preCheckRecords.length} feições / ${vertices} vértices — acima do limite ` +
              `seguro para busca síncrona de vértices próximos nesta versão; PULADA.`,
          )
          camadas.push({ name: group.name, found: 0, requested: pointCount, crsLabel: 'pulado (complexidade)' })
          continue
        }

        const result = analyzeLayer({
          layerId: group.id,
          layerName: group.name,
          shpBuffer: group.shp!.data,
          prjText: group.prj?.data.toString('utf8'),
          selection: { id: group.id, pointCount, toleranceMm },
          settings: {},
        })
        warnings.push(...result.warnings)
        camadas.push({ name: group.name, found: result.pairs.length, requested: pointCount, crsLabel: result.crs.label })
        for (const pair of result.pairs) {
          pairs.push({
            camada: pair.layerName,
            ranking: pair.ranking,
            feicao: pair.feature,
            parte: pair.part,
            anel: pair.ring,
            verticeA: pair.vertexA,
            verticeB: pair.vertexB,
            distM: pair.distM,
            aOriginal: pair.aOriginal,
            bOriginal: pair.bOriginal,
            midOriginal: pair.midOriginal,
          })
        }
      } catch (error: any) {
        warnings.push(`${group.name}: ${error?.message || 'erro ao processar camada'}`)
      }
    }

    const format = parseExportFormat(req.query.format)
    if (format) {
      const features: ExportFeature[] = pairs.map(
        (pair): ExportFeature => ({
          geometry: { type: 'Point', coordinates: pair.midOriginal },
          properties: {
            camada: pair.camada,
            ranking: pair.ranking,
            feicao: pair.feicao,
            parte: pair.parte,
            anel: pair.anel,
            vertice_a: pair.verticeA,
            vertice_b: pair.verticeB,
            dist_m: pair.distM,
          },
        }),
      )
      if (!features.length) {
        res.status(404).json({ error: 'Nenhum par de vértices próximos encontrado.' })
        return
      }
      const exported = await buildExport(format, [{ key: 'vertices_proximas', label: 'Vértices Próximas', features }], 'vertices_proximas')
      sendExport(res, exported)
      return
    }

    res.json({ ok: true, pairs, camadas, warnings })
  } catch (err: any) {
    console.error('[tools] vertices-proximas error:', err)
    res.status(400).json({ error: err?.message || 'Falha ao analisar vértices próximos.' })
  }
})

// POST /api/tools/containment — Fase 13.3
router.post('/containment', uploadSingle('file'), async (req: AuthRequest, res) => {
  try {
    const zipBuffer = requireZipBuffer(req)
    const groups = getZipLayerGroups(zipBuffer)

    const alvoRaw = String(req.body?.alvo || '').trim()
    if (!alvoRaw) {
      res.status(400).json({ error: '"alvo" (nome da camada que deve estar contida) é obrigatório.' })
      return
    }
    const continentesNames = parseNameList(req.body?.continentes)
    if (!continentesNames.length) {
      res.status(400).json({ error: '"continentes" (nome(s) da(s) camada(s) que devem conter o alvo) é obrigatório.' })
      return
    }

    const target = findGroupByName(groups, alvoRaw)
    if (!target?.shp) {
      res.status(404).json({ error: `Camada-alvo "${alvoRaw}" não encontrada (ou sem .shp) no ZIP.` })
      return
    }
    const containerGroups = continentesNames.map((name) => ({ name, group: findGroupByName(groups, name) }))
    const missing = containerGroups.filter((c) => !c.group?.shp).map((c) => c.name)
    if (missing.length) {
      res.status(404).json({ error: `Camada(s)-continente não encontrada(s) no ZIP: ${missing.join(', ')}` })
      return
    }

    const allInvolvedGroups = [target, ...containerGroups.map((c) => c.group!)]
    const involvedFeatures = allInvolvedGroups.reduce((s, g) => s + parsePolygonRecords(g.shp!.data).length, 0)
    const involvedVertices = allInvolvedGroups.reduce((s, g) => s + countVertices(parsePolygonRecords(g.shp!.data)), 0)
    if (involvedFeatures > MAX_TOTAL_FEATURES_FOR_CROSS_LAYER_CHECKS || involvedVertices > MAX_TOTAL_VERTICES_FOR_CROSS_LAYER_CHECKS) {
      res.status(413).json({
        error:
          `Camadas envolvidas (alvo + continentes) somam ${involvedFeatures} feições / ${involvedVertices} vértices — ` +
          `acima do limite seguro para validação síncrona de containment nesta versão (a união de continentes densos ` +
          `é uma operação geométrica cara). Tente com camadas menores ou aguarde suporte a processamento assíncrono.`,
      })
      return
    }

    const minAreaM2 = req.body?.minAreaM2 !== undefined ? Number(req.body.minAreaM2) : undefined
    const result = analyzeContainment({
      targetName: target.name,
      targetShp: target.shp!.data,
      targetPrj: target.prj?.data.toString('utf8'),
      containers: containerGroups.map((c) => ({
        name: c.group!.name,
        shp: c.group!.shp!.data,
        prj: c.group!.prj?.data.toString('utf8'),
      })),
      minAreaM2: Number.isFinite(minAreaM2) ? minAreaM2 : undefined,
    })

    const format = parseExportFormat(req.query.format)
    if (format) {
      const features: ExportFeature[] = result.rows.map(
        (row): ExportFeature => ({
          geometry: { type: 'Polygon', coordinates: row.coordinates },
          properties: {
            alvo: row.alvo,
            feicao: row.feicao,
            parte: row.parte,
            area_ha: row.areaHa,
            area_m2: row.areaM2,
            contido_em: row.contidoEm,
          },
        }),
      )
      if (!features.length) {
        res.status(404).json({ error: 'Nenhuma área não contida encontrada (camada-alvo totalmente contida).' })
        return
      }
      const exported = await buildExport(format, [{ key: 'areas_nao_contidas', label: 'Áreas Não Contidas', features }], 'areas_nao_contidas')
      sendExport(res, exported)
      return
    }

    res.json({
      ok: result.rows.length === 0,
      alvo: target.name,
      continentes: containerGroups.map((c) => c.group!.name),
      totalTargetFeatures: result.totalTargetFeatures,
      featuresWithGap: result.featuresWithGap,
      metricLabel: result.metricLabel,
      crsLabel: result.crs.label,
      warnings: result.warnings,
      areas: result.rows.map((row) => ({
        feicao: row.feicao,
        parte: row.parte,
        areaHa: row.areaHa,
        areaM2: row.areaM2,
        x: row.x,
        y: row.y,
      })),
    })
  } catch (err: any) {
    console.error('[tools] containment error:', err)
    res.status(400).json({ error: err?.message || 'Falha ao analisar containment.' })
  }
})

// POST /api/tools/processar-geo — Fase 13.4 (com gate de importação: só processa se 13.1 passar)
router.post('/processar-geo', uploadSingle('file'), async (req: AuthRequest, res) => {
  try {
    const zipBuffer = requireZipBuffer(req)

    // Gate de importação: replica a regra da SEMA — o ProcessarGeo real só roda
    // sobre um Projeto Geográfico que já passou na validação de geometria.
    const gate = runGeometryValidation(zipBuffer)
    if (gate.errors.length > 0) {
      res.status(422).json({
        error:
          'A geometria não passou na validação (13.1); corrija os erros antes de processar (gate de importação, igual à SEMA).',
        ok: false,
        errors: gate.errors,
        camadas: gate.camadas,
      })
      return
    }
    // Se a validação pulou checagens por complexidade (ver runGeometryValidation), o gate
    // NÃO pode aprovar — "sem erros encontrados" ≠ "totalmente validado" nesse caso.
    const skippedForComplexity = gate.warnings.some((w) => w.includes('acima do limite seguro'))
    if (skippedForComplexity) {
      res.status(422).json({
        error:
          'O Projeto Geográfico é grande demais para validação completa síncrona nesta versão — o gate de ' +
          'importação não pode garantir conformidade sem rodar todas as checagens. Valide um subconjunto menor ou ' +
          'aguarde suporte a processamento assíncrono.',
        ok: false,
        warnings: gate.warnings,
        camadas: gate.camadas,
      })
      return
    }

    const groups = getZipLayerGroups(zipBuffer)
    const layers: ProcessarGeoInputLayer[] = groups
      .filter((group) => group.shp)
      .map((group) => {
        const crs = detectCrs(group.prj?.data.toString('utf8'))
        const code = recognizeSimcarLayer(group.name)
        if (code === 'NASCENTE') {
          return { name: group.name, records: [], crs, points: parsePointRecords(group.shp!.data) }
        }
        return { name: group.name, records: parsePolygonRecords(group.shp!.data), crs }
      })

    const result = generateSimcarDerivedLayers(layers)

    const format = parseExportFormat(req.query.format)
    if (format) {
      const layersOut: ExportLayer[] = result.derived.map((derived) => ({
        key: derived.code.toLowerCase(),
        label: derived.code,
        features: derived.records.map(
          (record): ExportFeature => ({
            geometry: { type: 'Polygon', coordinates: record.rings },
            properties: record.attributes,
          }),
        ),
      }))
      if (!layersOut.some((layer) => layer.features.length)) {
        res.status(404).json({ error: 'Nenhuma camada derivada gerada (sem feições de hidrografia/APP na entrada).' })
        return
      }
      const exported = await buildExport(format, layersOut, 'processar_geo')
      sendExport(res, exported)
      return
    }

    res.json({
      ok: true,
      derived: result.derived.map((derived) => ({
        code: derived.code,
        name: derived.name,
        areaHa: derived.areaHa,
        areaM2: derived.areaM2,
        featureCount: derived.featureCount,
        geojson: {
          type: 'FeatureCollection' as const,
          features: derived.records.map((record) => ({
            type: 'Feature' as const,
            properties: record.attributes,
            geometry: { type: 'Polygon' as const, coordinates: record.rings },
          })),
        },
      })),
      quadroApp: result.quadroApp,
      warnings: result.warnings,
      errorRows: result.errorRows,
    })
  } catch (err: any) {
    console.error('[tools] processar-geo error:', err)
    res.status(400).json({ error: err?.message || 'Falha ao processar geometria.' })
  }
})

export default router
