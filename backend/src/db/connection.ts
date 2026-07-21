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

    CREATE INDEX IF NOT EXISTS idx_cars_user ON cars(user_id, active);
    CREATE INDEX IF NOT EXISTS idx_alerts_car ON alerts(car_id, detected_date);
    CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_source_id ON alerts(source, source_id);
    CREATE INDEX IF NOT EXISTS idx_car_layers_car ON car_layers(car_id);
    CREATE INDEX IF NOT EXISTS idx_car_licenses_car ON car_licenses(car_id);
    CREATE INDEX IF NOT EXISTS idx_car_sobreposicoes_car ON car_sobreposicoes(car_id);
  `)

  addColumnIfMissing('cars', 'bioma', 'TEXT')
  addColumnIfMissing('cars', 'arl_exigida_percent', 'REAL')
  addColumnIfMissing('cars', 'arl_exigida_ha', 'REAL')
  addColumnIfMissing('cars', 'arl_declarada_ha', 'REAL')
  addColumnIfMissing('cars', 'deficit_arl_ha', 'REAL')
  addColumnIfMissing('cars', 'layers_updated_at', 'TEXT')
  addColumnIfMissing('cars', 'nickname', 'TEXT')

  // Fase 5: workflow profissional de alertas (status/notas)
  addColumnIfMissing('alerts', 'status', "TEXT DEFAULT 'novo'")
  addColumnIfMissing('alerts', 'notes', 'TEXT')
}

/** ALTER TABLE ADD COLUMN idempotente (SQLite não suporta "IF NOT EXISTS" em colunas). */
function addColumnIfMissing(table: string, column: string, type: string): void {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (existing.some((c) => c.name === column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`)
}

export default db
