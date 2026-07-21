import 'dotenv/config'
import path from 'node:path'

const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-sec...n',
  databasePath: process.env.DATABASE_PATH ||
    '/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/alertacar.db',
  sccon: {
    orgUuid: process.env.SCCON_ORG_UUID || '597953b9-ee78-4113-80f9-803dbbaa60a0',
    startDate: process.env.SCCON_START_DATE || '2019-07-22',
  },
  wfs: {
    baseUrl: process.env.WFS_BASE_URL || 'https://geo.sema.mt.gov.br/geoserver/ows',
    authkey: process.env.WFS_AUTHKEY || '541085de-9a2e-454e-bdba-eb3d57a2f492',
  },
  ai: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    timeoutMs: Math.max(1_000, parseInt(process.env.DEEPSEEK_TIMEOUT_MS || '30000', 10) || 30000),
    maxRetries: Math.min(3, Math.max(0, parseInt(process.env.DEEPSEEK_MAX_RETRIES || '1', 10) || 0)),
    knowledgePath: process.env.AI_KNOWLEDGE_PATH || path.resolve(process.cwd(), 'knowledge'),
    knowledgeMaxChars: Math.min(12_000, Math.max(1_000, parseInt(process.env.AI_KNOWLEDGE_MAX_CHARS || '6000', 10) || 6000)),
  },
  bcryptRounds: 12,
  jwtExpiresIn: '7d',
}

export default config
