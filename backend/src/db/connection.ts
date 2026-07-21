import Database from 'better-sqlite3'
import path from 'node:path'
import config from '../lib/config.js'

const dbPath = config.databasePath
const dbDir = path.dirname(dbPath)

import { mkdirSync } from 'node:fs'
mkdirSync(dbDir, { recursive: true })

const db = new Database(dbPath)

// WAL mode para melhor performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      whatsapp_number TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cars (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      car_number TEXT NOT NULL,
      car_number_wfs TEXT,
      polygon_json TEXT,
      area_ha REAL,
      municipality TEXT,
      last_polygon_fetch TEXT,
      last_check_at TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, car_number)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      source TEXT NOT NULL,
      source_id TEXT,
      class_type TEXT,
      title TEXT NOT NULL,
      description TEXT,
      detected_date TEXT NOT NULL,
      area_ha REAL,
      geometry_json TEXT,
      sent_to_whatsapp INTEGER DEFAULT 0,
      sent_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS whatsapp_sessions (
      id TEXT PRIMARY KEY DEFAULT 'default',
      creds_json TEXT,
      connected INTEGER DEFAULT 0,
      phone_number TEXT,
      last_connected TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cron_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      cars_processed INTEGER DEFAULT 0,
      alerts_found INTEGER DEFAULT 0,
      alerts_sent INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      sources_json TEXT
    );

    -- Fase 4: camadas do próprio CAR (ARL/APP/AVN/AUAS/...) — área por camada
    CREATE TABLE IF NOT EXISTS car_layers (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      layer_key TEXT NOT NULL,
      label TEXT NOT NULL,
      area_ha REAL NOT NULL DEFAULT 0,
      feature_count INTEGER NOT NULL DEFAULT 0,
      extra_json TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(car_id, layer_key)
    );

    -- Fase 4: licenças ambientais ativas (LP/LI/LO/LOP) com vencimento
    CREATE TABLE IF NOT EXISTS car_licenses (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      tipo TEXT NOT NULL,
      numero_titulo TEXT,
      razao_social TEXT,
      data_aprovacao TEXT,
      data_vencimento TEXT,
      urgencia TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(car_id, tipo, numero_titulo)
    );

    -- Fase 4: sobreposições fundiárias (TI/UC/Assentamentos/Corredores)
    CREATE TABLE IF NOT EXISTS car_sobreposicoes (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      tipo TEXT NOT NULL,
      nome TEXT NOT NULL,
      intersection_ha REAL NOT NULL DEFAULT 0,
      coverage_percent REAL NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(car_id, tipo, nome)
    );

    -- Fase 6: NDVI amostrado por ano via GetFeatureInfo (cache — evita reamostrar toda hora)
    CREATE TABLE IF NOT EXISTS car_ndvi (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      year INTEGER NOT NULL,
      mean_ndvi REAL,
      min_ndvi REAL,
      max_ndvi REAL,
      pct_vegetacao REAL,
      sampled_points INTEGER NOT NULL DEFAULT 0,
      attempted_points INTEGER NOT NULL DEFAULT 0,
      computed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(car_id, year)
    );

    -- Fase 7: conversas, respostas e análises de IA. Nenhum dado pessoal do cliente é enviado ao modelo.
    CREATE TABLE IF NOT EXISTS ai_threads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      scope TEXT NOT NULL CHECK(scope IN ('car', 'portfolio')),
      car_id TEXT REFERENCES cars(id),
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES ai_threads(id),
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      tokens_in INTEGER,
      tokens_out INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS risk_scores (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      score INTEGER NOT NULL,
      band TEXT NOT NULL CHECK(band IN ('baixo', 'medio', 'alto', 'critico')),
      components_json TEXT NOT NULL,
      explanation TEXT,
      context_hash TEXT NOT NULL,
      computed_at TEXT DEFAULT (datetime('now')),
      UNIQUE(car_id, context_hash)
    );

    CREATE TABLE IF NOT EXISTS ai_laudos (
      id TEXT PRIMARY KEY,
      car_id TEXT NOT NULL REFERENCES cars(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      content_md TEXT NOT NULL,
      context_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'rascunho' CHECK(status IN ('rascunho', 'final')),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      cache_key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      tokens_in INTEGER,
      tokens_out INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Fase 8: organização da carteira por cliente e tags reutilizáveis.
    CREATE TABLE IF NOT EXISTS portfolio_clients (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#10b981',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS portfolio_tags (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#64748b',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, name)
    );

    CREATE TABLE IF NOT EXISTS car_tag_links (
      car_id TEXT NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES portfolio_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (car_id, tag_id)
    );

    -- Fase 9.3: API Key por usuário (acesso programático — QGIS/ArcGIS/scripts) e Webhooks.
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      label TEXT NOT NULL,
      last_used_at TEXT,
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      url TEXT NOT NULL,
      secret TEXT NOT NULL,
      events_json TEXT NOT NULL DEFAULT '["alert.created"]',
      active INTEGER DEFAULT 1,
      last_status INTEGER,
      last_triggered_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Fase 9.1: link temporário de compartilhamento de relatórios (expira em 24-72h).
    CREATE TABLE IF NOT EXISTS report_shares (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL REFERENCES users(id),
      report_type TEXT NOT NULL CHECK(report_type IN ('laudo', 'portfolio', 'historico')),
      car_id TEXT REFERENCES cars(id),
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Fase 9.1: agendamento de geração de relatórios (entrega por Email/WhatsApp é da Fase 10).
    CREATE TABLE IF NOT EXISTS report_schedules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      scope TEXT NOT NULL CHECK(scope IN ('portfolio', 'car')),
      car_id TEXT REFERENCES cars(id),
      frequency TEXT NOT NULL CHECK(frequency IN ('weekly', 'monthly')),
      active INTEGER DEFAULT 1,
      last_run_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Relatórios gerados por agendamento, prontos para download (sem envio automático ainda).
    CREATE TABLE IF NOT EXISTS report_files (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL REFERENCES report_schedules(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      report_type TEXT NOT NULL,
      car_id TEXT REFERENCES cars(id),
      share_token TEXT,
      generated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_report_shares_token ON report_shares(token);
    CREATE INDEX IF NOT EXISTS idx_report_schedules_user ON report_schedules(user_id, active);
    CREATE INDEX IF NOT EXISTS idx_report_files_schedule ON report_files(schedule_id, generated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id, active);

    CREATE INDEX IF NOT EXISTS idx_cars_user ON cars(user_id, active);
    CREATE INDEX IF NOT EXISTS idx_alerts_car ON alerts(car_id, detected_date);
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_source_id ON alerts(source, source_id);
    CREATE INDEX IF NOT EXISTS idx_car_layers_car ON car_layers(car_id);
    CREATE INDEX IF NOT EXISTS idx_car_licenses_car ON car_licenses(car_id);
    CREATE INDEX IF NOT EXISTS idx_car_sobreposicoes_car ON car_sobreposicoes(car_id);
    CREATE INDEX IF NOT EXISTS idx_car_ndvi_car ON car_ndvi(car_id, year);
    CREATE INDEX IF NOT EXISTS idx_ai_threads_user ON ai_threads(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_thread ON ai_messages(thread_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_risk_scores_car ON risk_scores(car_id, computed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_portfolio_clients_user ON portfolio_clients(user_id, name);
    CREATE INDEX IF NOT EXISTS idx_portfolio_tags_user ON portfolio_tags(user_id, name);
    CREATE INDEX IF NOT EXISTS idx_car_tag_links_tag ON car_tag_links(tag_id, car_id);
  `)

  addColumnIfMissing('cars', 'bioma', 'TEXT')
  addColumnIfMissing('cars', 'arl_exigida_percent', 'REAL')
  addColumnIfMissing('cars', 'arl_exigida_ha', 'REAL')
  addColumnIfMissing('cars', 'arl_declarada_ha', 'REAL')
  addColumnIfMissing('cars', 'deficit_arl_ha', 'REAL')
  addColumnIfMissing('cars', 'layers_updated_at', 'TEXT')
  addColumnIfMissing('cars', 'nickname', 'TEXT')
  addColumnIfMissing('cars', 'client_id', 'TEXT REFERENCES portfolio_clients(id)')

  // Fase 5: workflow profissional de alertas (status/notas)
  addColumnIfMissing('alerts', 'status', "TEXT DEFAULT 'novo'")
  addColumnIfMissing('alerts', 'notes', 'TEXT')

  // Fase 9.1: marca própria do consultor nos relatórios PDF (logo/rodapé)
  addColumnIfMissing('users', 'report_logo_base64', 'TEXT')
  addColumnIfMissing('users', 'report_footer_text', 'TEXT')
}

/** ALTER TABLE ADD COLUMN idempotente (SQLite não suporta "IF NOT EXISTS" em colunas). */
function addColumnIfMissing(table: string, column: string, type: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (existing.some((c) => c.name === column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
}

export default db
