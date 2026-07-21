/**
 * Fase 9.3 — Interoperabilidade: API Keys, endpoint estilo WFS (GeoJSON ao vivo p/ QGIS/ArcGIS)
 * e gestão de Webhooks.
 */
import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { createApiKey, listApiKeys, revokeApiKey } from '../services/api-keys.js'
import { createWebhook, deleteWebhook, listWebhooks, setWebhookActive } from '../services/webhooks.js'

const router = Router()

router.use(requireAuth)

/* ─── API Keys ────────────────────────────────────────────────── */

// POST /api/interop/api-keys — cria uma nova API Key (a chave em texto puro só aparece aqui)
router.post('/interop/api-keys', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const label = String(req.body?.label || '').trim()
    if (!label) {
      res.status(400).json({ error: 'Informe um nome para identificar a chave (ex: "QGIS escritório")' })
      return
    }
    const existing = (db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ? AND revoked_at IS NULL').get(userId) as any).count
    if (existing >= 10) {
      res.status(400).json({ error: 'Limite de 10 API Keys ativas por usuário' })
      return
    }
    const result = createApiKey(userId, label)
    res.status(201).json({
      apiKey: result,
      message: 'Guarde esta chave agora — ela não será mostrada novamente.',
    })
  } catch (err: any) {
    console.error('[interop] POST api-keys error:', err)
    res.status(500).json({ error: 'Erro ao criar API Key' })
  }
})

// GET /api/interop/api-keys — lista (nunca retorna o hash/chave em si)
router.get('/interop/api-keys', (req: AuthRequest, res) => {
  try {
    res.json({ apiKeys: listApiKeys(req.user!.id) })
  } catch (err: any) {
    console.error('[interop] GET api-keys error:', err)
    res.status(500).json({ error: 'Erro ao listar API Keys' })
  }
})

// DELETE /api/interop/api-keys/:id — revoga
router.delete('/interop/api-keys/:id', (req: AuthRequest, res) => {
  try {
    const ok = revokeApiKey(req.user!.id, req.params.id)
    if (!ok) {
      res.status(404).json({ error: 'API Key não encontrada' })
      return
    }
    res.json({ message: 'API Key revogada' })
  } catch (err: any) {
    console.error('[interop] DELETE api-keys error:', err)
    res.status(500).json({ error: 'Erro ao revogar API Key' })
  }
})

/* ─── Webhooks ────────────────────────────────────────────────── */

// POST /api/interop/webhooks — cria (o secret HMAC só aparece aqui)
router.post('/interop/webhooks', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const url = String(req.body?.url || '').trim()
    if (!/^https?:\/\//.test(url)) {
      res.status(400).json({ error: 'URL inválida — precisa começar com http:// ou https://' })
      return
    }
    const existing = (db.prepare('SELECT COUNT(*) as count FROM webhooks WHERE user_id = ?').get(userId) as any).count
    if (existing >= 10) {
      res.status(400).json({ error: 'Limite de 10 webhooks por usuário' })
      return
    }
    const result = createWebhook(userId, url, ['alert.created'])
    res.status(201).json({
      webhook: result,
      message: 'Guarde o secret agora — use-o para validar a assinatura HMAC (header X-AlertaCAR-Signature) dos POSTs recebidos.',
    })
  } catch (err: any) {
    console.error('[interop] POST webhooks error:', err)
    res.status(500).json({ error: 'Erro ao criar webhook' })
  }
})

// GET /api/interop/webhooks
router.get('/interop/webhooks', (req: AuthRequest, res) => {
  try {
    res.json({ webhooks: listWebhooks(req.user!.id) })
  } catch (err: any) {
    console.error('[interop] GET webhooks error:', err)
    res.status(500).json({ error: 'Erro ao listar webhooks' })
  }
})

// PATCH /api/interop/webhooks/:id — ativar/desativar
router.patch('/interop/webhooks/:id', (req: AuthRequest, res) => {
  try {
    const { active } = req.body as { active?: boolean }
    if (typeof active !== 'boolean') {
      res.status(400).json({ error: 'Informe "active": true/false' })
      return
    }
    const ok = setWebhookActive(req.user!.id, req.params.id, active)
    if (!ok) {
      res.status(404).json({ error: 'Webhook não encontrado' })
      return
    }
    res.json({ message: active ? 'Webhook ativado' : 'Webhook desativado' })
  } catch (err: any) {
    console.error('[interop] PATCH webhooks error:', err)
    res.status(500).json({ error: 'Erro ao atualizar webhook' })
  }
})

// DELETE /api/interop/webhooks/:id
router.delete('/interop/webhooks/:id', (req: AuthRequest, res) => {
  try {
    const ok = deleteWebhook(req.user!.id, req.params.id)
    if (!ok) {
      res.status(404).json({ error: 'Webhook não encontrado' })
      return
    }
    res.json({ message: 'Webhook removido' })
  } catch (err: any) {
    console.error('[interop] DELETE webhooks error:', err)
    res.status(500).json({ error: 'Erro ao remover webhook' })
  }
})

/* ─── Endpoint estilo WFS: GeoJSON ao vivo p/ QGIS/ArcGIS ("Add Vector Layer" via URL) ── */

// GET /api/gis/cars.geojson — todos os CARs ativos do usuário (autenticado por JWT ou API Key)
router.get('/gis/cars.geojson', (req: AuthRequest, res) => {
  try {
    const rows = db
      .prepare(`SELECT id, car_number, nickname, polygon_json, area_ha, municipality, bioma FROM cars WHERE user_id = ? AND active = 1`)
      .all(req.user!.id) as any[]

    const features = rows
      .filter((r) => r.polygon_json)
      .map((r) => ({
        type: 'Feature',
        geometry: JSON.parse(r.polygon_json),
        properties: {
          id: r.id,
          carNumber: r.car_number,
          nickname: r.nickname,
          areaHa: r.area_ha,
          municipality: r.municipality,
          bioma: r.bioma,
        },
      }))

    res.setHeader('Content-Type', 'application/geo+json')
    res.json({ type: 'FeatureCollection', features })
  } catch (err: any) {
    console.error('[interop] GET gis/cars.geojson error:', err)
    res.status(500).json({ error: 'Erro ao gerar GeoJSON de CARs' })
  }
})

// GET /api/gis/alerts.geojson?carId= (opcional) — alertas com geometria
router.get('/gis/alerts.geojson', (req: AuthRequest, res) => {
  try {
    const carId = req.query.carId ? String(req.query.carId) : null
    const rows = carId
      ? (db.prepare(`SELECT * FROM alerts WHERE user_id = ? AND car_id = ?`).all(req.user!.id, carId) as any[])
      : (db.prepare(`SELECT * FROM alerts WHERE user_id = ?`).all(req.user!.id) as any[])

    const features = rows
      .filter((r) => r.geometry_json)
      .map((r) => ({
        type: 'Feature',
        geometry: JSON.parse(r.geometry_json),
        properties: {
          id: r.id,
          carId: r.car_id,
          source: r.source,
          classType: r.class_type,
          title: r.title,
          detectedDate: r.detected_date,
          areaHa: r.area_ha,
          status: r.status || 'novo',
        },
      }))

    res.setHeader('Content-Type', 'application/geo+json')
    res.json({ type: 'FeatureCollection', features })
  } catch (err: any) {
    console.error('[interop] GET gis/alerts.geojson error:', err)
    res.status(500).json({ error: 'Erro ao gerar GeoJSON de alertas' })
  }
})

export default router
