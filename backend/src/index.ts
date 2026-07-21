import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from './lib/config.js'
import { initializeSchema } from './db/connection.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import carsRoutes from './routes/cars.js'
import scconRoutes from './routes/sccon.js'
import semaMonitorRoutes from './routes/sema-monitor.js'
import alertsRoutes from './routes/alerts.js'
import satelliteRoutes from './routes/satellite.js'
import aiRoutes from './routes/ai.js'
import portfolioRoutes from './routes/portfolio.js'
import exportRoutes from './routes/export.js'
import interopRoutes from './routes/interop.js'
import reportsRoutes from './routes/reports.js'
import publicReportsRoutes from './routes/public-reports.js'
import toolsRoutes from './routes/tools.js'
import { startCronMonitor } from './cron/monitor.js'
import { startReportSchedulesCron } from './cron/reports.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Inicializar banco
initializeSchema()
console.log('[db] Schema inicializado em', config.databasePath)

const app = express()

// Middleware
app.use(cors())
app.use(express.json())

// Healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() })
})

// API Routes
// ⚠️ /api/public precisa vir ANTES de qualquer router montado no prefixo bare '/api'
// (alerts/satellite/ai/export/interop/reports) — esses aplicam requireAuth sem filtro de
// path e responderiam 401 antes da rota pública ser alcançada, já que Express tenta os
// mounts na ordem de registro, não por especificidade.
app.use('/api/public', publicReportsRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/cars', carsRoutes)
app.use('/api/sccon', scconRoutes)
app.use('/api/sema-monitor', semaMonitorRoutes)
app.use('/api', alertsRoutes)
app.use('/api', satelliteRoutes)
app.use('/api', aiRoutes)
app.use('/api/portfolio', portfolioRoutes)
app.use('/api', exportRoutes)
app.use('/api', interopRoutes)
app.use('/api', reportsRoutes)
app.use('/api/tools', toolsRoutes)

// Servir frontends em produção
if (config.nodeEnv === 'production') {
  // Deploy com 3 domínios (Fase 12.3): alertacar-admin.cursar.space serve o painel na RAIZ,
  // não em /admin — reescreve a URL internamente pra reaproveitar o mesmo static+fallback de
  // baixo (que já serve o admin via prefixo /admin). Mantém /admin funcionando no domínio
  // principal também (alertacar.cursar.space/admin).
  app.use((req, _res, next) => {
    if (req.hostname === config.adminHostname && !req.path.startsWith('/api') && !req.path.startsWith('/admin')) {
      req.url = `/admin${req.url}`
    }
    next()
  })

  app.use('/', express.static(path.join(__dirname, '../../app/dist')))
  app.use('/admin', express.static(path.join(__dirname, '../../admin/dist')))

  // SPA fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/admin')) {
      res.sendFile(path.join(__dirname, '../../admin/dist/index.html'))
    } else if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../../app/dist/index.html'))
    }
  })
}

// Start
app.listen(config.port, () => {
  console.log(`[server] AlertaCAR rodando na porta ${config.port}`)
  console.log(`[server] Ambiente: ${config.nodeEnv}`)
  
  // Iniciar cron de monitoramento (só em produção ou se EXPLICITAMENTE ativado)
  if (config.nodeEnv === 'production' || process.env.ENABLE_CRON === 'true') {
    startCronMonitor()
    startReportSchedulesCron()
  } else {
    console.log('[cron] Monitoramento NÃO iniciado (dev mode). Use ENABLE_CRON=true para ativar.')
  }
})

export default app
