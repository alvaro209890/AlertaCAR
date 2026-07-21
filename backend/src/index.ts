import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import config from './lib/config.js'
import { initializeSchema } from './db/connection.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import carsRoutes from './routes/cars.js'

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
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/cars', carsRoutes)

// Servir frontends em produção
if (config.nodeEnv === 'production') {
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
})

export default app
