import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { buildCarContext, buildPortfolioContext, hashAiContext, type CarAiContext } from '../services/ai-context.js'
import { AiUnavailableError, completeAi, isAiConfigured, type AiMessage } from '../services/ai.js'
import { calculateRiskScore, deterministicRiskExplanation } from '../services/risk-score.js'

const router = Router()
const DISCLAIMER = 'Análise preliminar de apoio à decisão. Consulte o Responsável Técnico antes de agir.'
const requestTimes = new Map<string, number[]>()

router.use(requireAuth)

router.get('/ai/status', (_req, res) => {
  res.json({ configured: isAiConfigured(), disclaimer: DISCLAIMER })
})

// GET /api/cars/:id/risk-score — score é determinístico; a IA apenas explica os fatores calculados.
router.get('/cars/:carId/risk-score', async (req: AuthRequest, res) => {
  try {
    const context = buildCarContext(req.params.carId, req.user!.id)
    if (!context) return void res.status(404).json({ error: 'CAR não encontrado' })
    const contextHash = hashAiContext(context)
    const cached = db.prepare('SELECT * FROM risk_scores WHERE car_id = ? AND context_hash = ?').get(req.params.carId, contextHash) as any
    if (cached) return void res.json(formatRisk(cached, true))

    const risk = calculateRiskScore(context)
    let explanation = deterministicRiskExplanation(risk)
    let generatedByAi = false
    if (isAiConfigured()) {
      try {
        const result = await askAi(req.user!.id, 'risk-score', contextHash, [
          { role: 'system', content: systemPrompt('Explique apenas fatores já calculados; não altere o score e não dê aconselhamento jurídico conclusivo.') },
          { role: 'user', content: `Score determinístico: ${JSON.stringify(risk)}\nContexto ambiental: ${JSON.stringify(context)}\nExplique em até 3 frases objetivas.` },
        ], 260)
        explanation = result.content
        generatedByAi = true
      } catch (error) {
        console.warn('[ai] risk explanation unavailable:', safeError(error))
      }
    }
    const row = { id: uuid(), carId: req.params.carId, score: risk.score, band: risk.band, components: JSON.stringify(risk.components), explanation, contextHash }
    db.prepare(`INSERT INTO risk_scores (id, car_id, score, band, components_json, explanation, context_hash)
      VALUES (@id, @carId, @score, @band, @components, @explanation, @contextHash)`).run(row)
    res.json({ score: risk.score, band: risk.band, components: risk.components, explanation: withDisclaimer(explanation), cached: false, generatedByAi })
  } catch (error) {
    handleError(res, error)
  }
})

router.post('/cars/:carId/ai/summary', async (req: AuthRequest, res) => {
  const context = buildCarContext(req.params.carId, req.user!.id)
  if (!context) return void res.status(404).json({ error: 'CAR não encontrado' })
  try {
    const result = await generateForCar(req.user!.id, 'summary', context, 'Resuma os alertas e pendências do imóvel em até 5 bullets. Diferencie fatos dos dados e pontos que precisam de validação.', 500)
    res.json({ summary: withDisclaimer(result.content), cached: result.cached })
  } catch (error) { handleError(res, error) }
})

router.post('/cars/:carId/ai/recomendacoes', async (req: AuthRequest, res) => {
  const context = buildCarContext(req.params.carId, req.user!.id)
  if (!context) return void res.status(404).json({ error: 'CAR não encontrado' })
  try {
    const result = await generateForCar(req.user!.id, 'recommendations', context, 'Liste próximos passos práticos e priorizados. Não invente prazos legais nem afirme regularidade; indique quando confirmar em órgão competente.', 500)
    res.json({ recommendations: withDisclaimer(result.content), cached: result.cached })
  } catch (error) { handleError(res, error) }
})

router.post('/cars/:carId/ai/ndvi-analysis', async (req: AuthRequest, res) => {
  const context = buildCarContext(req.params.carId, req.user!.id)
  if (!context) return void res.status(404).json({ error: 'CAR não encontrado' })
  try {
    const result = await generateForCar(req.user!.id, 'ndvi-analysis', context, 'Interprete exclusivamente a série de NDVI disponível. Indique tendência, limitações da amostragem e necessidade de inspeção quando houver queda.', 450)
    res.json({ analysis: withDisclaimer(result.content), cached: result.cached })
  } catch (error) { handleError(res, error) }
})

router.post('/cars/:carId/ai/laudo', async (req: AuthRequest, res) => {
  const context = buildCarContext(req.params.carId, req.user!.id)
  if (!context) return void res.status(404).json({ error: 'CAR não encontrado' })
  try {
    const result = await generateForCar(req.user!.id, 'laudo', context, 'Gere uma minuta em Markdown com as seções: Identificação do imóvel, Dados analisados, Alertas, NDVI, Conformidade, Conclusão e Recomendações. Declare explicitamente as limitações e não faça conclusão jurídica.', 1_400)
    const laudoId = uuid()
    db.prepare(`INSERT INTO ai_laudos (id, car_id, user_id, content_md, context_hash) VALUES (?, ?, ?, ?, ?)`).run(laudoId, req.params.carId, req.user!.id, withDisclaimer(result.content), hashAiContext(context))
    res.status(201).json({ laudo: { id: laudoId, contentMd: withDisclaimer(result.content), status: 'rascunho' }, cached: result.cached })
  } catch (error) { handleError(res, error) }
})

router.post('/ai/triage', async (req: AuthRequest, res) => {
  const alertId = String(req.body?.alertId || '')
  const alert = db.prepare('SELECT * FROM alerts WHERE id = ? AND user_id = ?').get(alertId, req.user!.id) as any
  if (!alert) return void res.status(404).json({ error: 'Alerta não encontrado' })
  const context = buildCarContext(alert.car_id, req.user!.id)
  if (!context) return void res.status(404).json({ error: 'CAR não encontrado' })
  try {
    const result = await generateForCar(req.user!.id, `triage:${alertId}`, context, `Faça triagem do alerta ${JSON.stringify({ id: alert.id, title: alert.title, classType: alert.class_type, areaHa: alert.area_ha, detectedDate: alert.detected_date, status: alert.status })}. Responda com uma sugestão entre "verdadeiro", "falso positivo" ou "provável legal", seguida de justificativa curta. É apenas sugestão; não altere dados.`, 380)
    res.json({ suggestion: withDisclaimer(result.content), cached: result.cached })
  } catch (error) { handleError(res, error) }
})

router.post('/ai/chat', async (req: AuthRequest, res) => {
  const userId = req.user!.id
  const message = String(req.body?.message || '').trim()
  const scope = req.body?.scope === 'portfolio' ? 'portfolio' : 'car'
  if (message.length < 2 || message.length > 2_000) return void res.status(400).json({ error: 'Mensagem deve ter entre 2 e 2000 caracteres' })
  const carId = scope === 'car' ? String(req.body?.carId || '') : null
  const context = scope === 'car' ? buildCarContext(carId!, userId) : buildPortfolioContext(userId)
  if (!context || (scope === 'car' && !carId)) return void res.status(404).json({ error: 'CAR não encontrado' })

  try {
    const thread = getOrCreateThread(String(req.body?.threadId || ''), userId, scope, carId)
    db.prepare('INSERT INTO ai_messages (id, thread_id, role, content) VALUES (?, ?, ?, ?)').run(uuid(), thread.id, 'user', message)
    const previous = db.prepare('SELECT role, content FROM ai_messages WHERE thread_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 8').all(thread.id) as Array<{ role: 'user' | 'assistant'; content: string }>
    const result = await askAi(userId, `chat:${thread.id}`, hashAiContext({ context, message, previous }), [
      { role: 'system', content: systemPrompt('Responda com objetividade à pergunta do consultor usando apenas o contexto fornecido e deixe claras as incertezas.') },
      { role: 'user', content: `Contexto ambiental:\n${JSON.stringify(context)}\n\nHistórico recente:\n${JSON.stringify(previous.reverse())}\n\nPergunta: ${message}` },
    ], 700)
    const content = withDisclaimer(result.content)
    db.prepare('INSERT INTO ai_messages (id, thread_id, role, content, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), thread.id, 'assistant', content, result.tokensIn, result.tokensOut)
    db.prepare("UPDATE ai_threads SET updated_at = datetime('now'), title = COALESCE(title, ?) WHERE id = ?").run(message.slice(0, 100), thread.id)
    res.status(201).json({ threadId: thread.id, message: { role: 'assistant', content }, cached: result.cached })
  } catch (error) { handleError(res, error) }
})

router.post('/ai/portfolio-digest', async (req: AuthRequest, res) => {
  const context = buildPortfolioContext(req.user!.id)
  try {
    const result = await askAi(req.user!.id, 'portfolio-digest', hashAiContext(context), [
      { role: 'system', content: systemPrompt('Crie um digest semanal conciso, priorizando imóveis com pendências e deixando claro que é uma análise preliminar.') },
      { role: 'user', content: JSON.stringify(context) },
    ], 600)
    res.json({ digest: withDisclaimer(result.content), cached: result.cached })
  } catch (error) { handleError(res, error) }
})

function getOrCreateThread(threadId: string, userId: string, scope: 'car' | 'portfolio', carId: string | null) {
  if (threadId) {
    const existing = db.prepare('SELECT id, scope, car_id FROM ai_threads WHERE id = ? AND user_id = ?').get(threadId, userId) as any
    if (!existing || existing.scope !== scope || existing.car_id !== carId) throw Object.assign(new Error('Thread não encontrada'), { statusCode: 404 })
    return existing
  }
  const id = uuid()
  db.prepare('INSERT INTO ai_threads (id, user_id, scope, car_id) VALUES (?, ?, ?, ?)').run(id, userId, scope, carId)
  return { id, scope, car_id: carId }
}

async function generateForCar(userId: string, kind: string, context: CarAiContext, instruction: string, maxTokens: number) {
  const cacheKey = hashAiContext({ kind, context })
  const result = await askAi(userId, kind, cacheKey, [
    { role: 'system', content: systemPrompt(instruction) },
    { role: 'user', content: `Contexto ambiental do imóvel (dados cadastrais e ambientais, sem dados pessoais):\n${JSON.stringify(context)}` },
  ], maxTokens)
  return result
}

async function askAi(userId: string, kind: string, cacheKey: string, messages: AiMessage[], maxTokens: number) {
  const cached = db.prepare('SELECT content, tokens_in, tokens_out FROM ai_cache WHERE cache_key = ? AND user_id = ?').get(cacheKey, userId) as any
  if (cached) return { content: cached.content, tokensIn: cached.tokens_in, tokensOut: cached.tokens_out, cached: true }
  enforceRateLimit(userId)
  const result = await completeAi(messages, maxTokens)
  db.prepare('INSERT OR REPLACE INTO ai_cache (cache_key, user_id, kind, content, tokens_in, tokens_out) VALUES (?, ?, ?, ?, ?, ?)').run(cacheKey, userId, kind, result.content, result.tokensIn, result.tokensOut)
  return { ...result, cached: false }
}

function enforceRateLimit(userId: string) {
  const now = Date.now()
  const recent = (requestTimes.get(userId) || []).filter((time) => time > now - 60 * 60 * 1000)
  if (recent.length >= 60) throw Object.assign(new Error('Limite de 60 solicitações de IA por hora atingido'), { statusCode: 429 })
  recent.push(now)
  requestTimes.set(userId, recent)
}

function systemPrompt(instruction: string) {
  return `Você é o assistente ambiental do AlertaCAR para consultores e engenheiros florestais no Brasil. ${instruction}\nNunca invente dados, fontes, prazos ou permissões. Não substitua vistoria, análise jurídica ou decisão do Responsável Técnico. ${DISCLAIMER}`
}

function withDisclaimer(content: string) {
  return content.includes(DISCLAIMER) ? content : `${content.trim()}\n\n> ${DISCLAIMER}`
}

function formatRisk(row: any, cached: boolean) {
  return { score: row.score, band: row.band, components: JSON.parse(row.components_json), explanation: withDisclaimer(row.explanation), cached }
}

function safeError(error: unknown) { return error instanceof Error ? error.message : 'erro desconhecido' }

function handleError(res: any, error: unknown) {
  const status = (error as any)?.statusCode || (error instanceof AiUnavailableError ? 503 : 500)
  if (status >= 500) console.error('[ai] request error:', safeError(error))
  res.status(status).json({ error: safeError(error) })
}

export default router
