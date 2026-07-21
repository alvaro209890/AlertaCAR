# Plano MVP — AlertaCAR

> ✅ Integrações testadas (SCCON + WFS SEMA). Apenas código da aplicação pendente.

## Resumo

| Fase | Dias | Entregável |
|------|------|-----------|
| 1 - Fundação | 1-2 | Auth + monorepo + backend base |
| 2 - CRUD CARs | 1 | WFS SEMA funcional + dashboard de CARs |
| 3 - SCCON | 1-2 | Cron diário + timeline de alertas |
| 4 - WhatsApp | 1 | Baileys + notificações |
| 5 - Admin + Mapas | 1 | Painel admin + mapa Leaflet |
| 6 - Deploy | 1 | Túnel + systemd + produção |

**Total: 5-6 dias para MVP funcional.**

---

## Fase 1 — Fundação (Dia 1-2)

### 1.1 Setup do projeto
- [ ] Inicializar monorepo com pastas `app/`, `admin/`, `backend/`
- [ ] `app/`: Vite + React 19 + TypeScript + Tailwind + shadcn/ui
- [ ] `admin/`: Vite + React 19 + TypeScript + Tailwind + shadcn/ui
- [ ] `backend/`: Express + TypeScript + esbuild (padrão GeoForest)
- [ ] ESLint + Prettier configurado
- [ ] `.env.example` completo (ver checklist de variáveis)
- [ ] `.gitignore`: `node_modules/`, `dist/`, `data/`, `.env`

### 1.2 Firebase
- [ ] Projeto Firebase existente ou novo
- [ ] Firebase Auth habilitado (email/senha)
- [ ] Firebase Admin SDK JSON no lugar
- [ ] `VITE_FIREBASE_*` configuradas no `.env`

### 1.3 Backend base
- [ ] Express na porta 3002
- [ ] Middleware CORS
- [ ] Middleware de auth (verificar token Firebase no header `Authorization`)
- [ ] SQLite setup com `better-sqlite3`
- [ ] Schema inicial: `users`, `cars`, `alerts`, `whatsapp_sessions`
- [ ] Endpoint `GET /api/health`
- [ ] Testar com curl

### 1.4 Frontend App — Auth
- [ ] Firebase Auth UI: login + cadastro
- [ ] Cadastro exige: nome, email, senha, **número WhatsApp** (+55 obrigatório)
- [ ] Contexto `AuthContext` com `user`, `loading`, `logout`
- [ ] Rota protegida: redireciona para `/login` se não autenticado
- [ ] Dashboard vazio com header "Bem-vindo, {nome}"
- [ ] Botão "Adicionar CAR" desabilitado (placeholder)

### 1.5 Frontend Admin — Auth
- [ ] Login (mesmo Firebase Auth)
- [ ] Verificação de admin no backend (whitelist de UIDs)
- [ ] Redirect: se não admin → mensagem "Acesso restrito"
- [ ] Dashboard admin vazio

### Checklist de variáveis de ambiente
```
# App
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_API_URL=https://alertacar-api.cursar.space

# Backend
PORT=3002
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT_PATH=
DATABASE_PATH=./data/alertacar.db
SCCON_ORG_UUID=597953b9-ee78-4113-80f9-803dbbaa60a0
SCCON_START_DATE=2019-07-22
WFS_BASE_URL=https://geo.sema.mt.gov.br/geoserver/ows
WFS_AUTHKEY=541085de-9a2e-454e-bdba-eb3d57a2f492
ADMIN_UIDS=uid1,uid2
```

---

## Fase 2 — CRUD de CARs (Dia 2-3)

### 2.1 Backend — WFS SEMA
- [ ] Serviço `wfs-sema.ts`: buscar polígono por nº CAR
- [ ] Função `fetchCarByNumber(carNumber)`: tenta formatos `MTXXXXX/YYYY`
- [ ] Cache SQLite: 30 dias, não invalida em falha
- [ ] Retry 3x com backoff (timeout 30s)
- [ ] Converter EPSG:4674 → EPSG:4326 via proj4js
- [ ] Testar com CAR de teste: `MT27827/2017`

### 2.2 Backend — Rotas
- [ ] `POST /api/cars` — body `{carNumber}`, busca polígono, salva
- [ ] `GET /api/cars` — lista CARs do usuário (com último alerta)
- [ ] `GET /api/cars/:id` — detalhes + polígono GeoJSON + área
- [ ] `DELETE /api/cars/:id` — soft delete (active=0)
- [ ] `POST /api/cars/:id/check` — força consulta agora

### 2.3 Frontend App — Dashboard de CARs
- [ ] Formulário "Adicionar CAR": input, validação, loading
- [ ] Card de cada CAR com:
  - Nº CAR em destaque
  - Status (ativo ✓)
  - Área em hectares
  - Município
  - "Último check: há X horas"
  - Badge com contagem de alertas não lidos
- [ ] Empty state: ilustração + "Você ainda não monitora nenhum CAR"
- [ ] Loading: skeleton cards com shimmer
- [ ] Erro: toast com mensagem + retry

---

## Fase 3 — Integração SCCON (Dia 3-4)

### 3.1 Backend — Serviço SCCON
- [ ] `sccon.ts`: implementar `fetchScconAlerts(geometry)`
- [ ] Função `getPublicToken()` — cache em memória (24h)
- [ ] Função `getUserId(token)` — cache
- [ ] Função `fetchWfsAlertIds(bbox, classes, token, userId)`
- [ ] Função `fetchAlertDetails(ids, token)` — paralelo (12 workers)
- [ ] Detectar alertas NOVOS: comparar `idt_local_alert` com DB

### 3.2 Backend — Cron Diário
- [ ] `node-cron` schedule: `0 6 * * *` (06:00 BRT)
- [ ] Fluxo: buscar CARs ativos → para cada → polígono cache → WFS SCCON → detalhes → spatial join → salvar novos → enfileirar WhatsApp
- [ ] Log de execução: timestamp, CARs processados, alertas encontrados, falhas
- [ ] Endpoint `GET /api/admin/cron/status` para ver última execução

### 3.3 Frontend App — Timeline de Alertas
- [ ] Página de detalhes do CAR com seção "Alertas"
- [ ] Timeline vertical, ordenada por data (mais recente no topo)
- [ ] Cada alerta mostra:
  - Badge colorido: 🔴 Desmatamento / 🟠 Degradação / 🟡 Queimada
  - Data formatada: "27/12/2019"
  - Área: "12.5 ha"
  - Status: "Enviado via WhatsApp ✅"
- [ ] Loading state, empty state ("Nenhum alerta detectado — ótimo sinal! 🌿")

---

## Fase 4 — WhatsApp (Dia 4-5)

### 4.1 Backend — Baileys
- [ ] `whatsapp.ts`: setup do baileys com auth state em SQLite
- [ ] Geração de QR Code (base64 PNG)
- [ ] Handler de conexão: `connection.update`
- [ ] Reconexão automática em desconexão
- [ ] Endpoints:
  - `GET /api/admin/whatsapp/status` → `{connected: true/false}`
  - `GET /api/admin/whatsapp/qr` → `{qr: "base64..."}` (admin only)
  - `POST /api/admin/whatsapp/reconnect` → força reconexão
  - `POST /api/admin/whatsapp/disconnect` → logout

### 4.2 Backend — Fila de Notificações
- [ ] `notification.ts`: fila em memória + persistência SQLite
- [ ] Template de mensagem formatado
- [ ] Rate limiting: 1 por CAR/hora, 10 por usuário/dia
- [ ] Retry 3x em falha, com backoff
- [ ] Registrar em `alerts` com `sent_to_whatsapp=1`

### 4.3 Frontend Admin — WhatsApp Connect
- [ ] Página dedicada no admin
- [ ] Estado desconectado: botão "Conectar WhatsApp" → mostra QR Code
- [ ] QR Code com polling automático (3s)
- [ ] Estado conectado: indicador verde ●, número, uptime
- [ ] Botão "Desconectar" com confirmação
- [ ] Instruções visuais (ícones) de como escanear

---

## Fase 5 — Admin + Mapas + UI Polida (Dia 5)

### 5.1 Painel Admin
- [ ] Dashboard com cards: usuários, CARs ativos, alertas/24h, WhatsApp status
- [ ] Tabela de usuários: nome, email, WhatsApp, CARs, status, ações
- [ ] Log de notificações: data, usuário, CAR, tipo, status
- [ ] Configurações: alterar horário do cron, templates de mensagem

### 5.2 Mapa Interativo (App Usuário)
- [ ] Leaflet + react-leaflet no detalhe do CAR
- [ ] Tile layer: OpenStreetMap
- [ ] Overlay: polígono do CAR (GeoJSON, borda emerald, fill transparente 20%)
- [ ] Overlay: alertas SCCON (pontos/markers nos centróides, coloridos por classe)
- [ ] Popup nos alertas: classe, data, área
- [ ] Fit bounds ao carregar (zoom no polígono)

### 5.3 UI/UX Polida
- [ ] Tema: escuro por padrão (dark mode) com glassmorphism
- [ ] Paleta: emerald/teal para elementos positivos, amber/red para alertas
- [ ] Cards com `backdrop-blur` e borda sutil
- [ ] Botões com gradiente e `active:scale-[0.97]`
- [ ] Animações sutis: fadeIn nos cards, slideIn na timeline
- [ ] Responsivo: mobile-first, sidebar colapsa em telas pequenas
- [ ] Toast notifications (sonner): sucesso ao adicionar CAR, erro ao buscar

---

## Fase 6 — Deploy (Dia 5-6)

### 6.1 Build de Produção
- [ ] Build app: `cd app && pnpm run build` → `app/dist/`
- [ ] Build admin: `cd admin && pnpm run build` → `admin/dist/`
- [ ] Build backend: `esbuild src/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`

### 6.2 Systemd
- [ ] Criar `/home/server/.config/systemd/user/alertacar-backend.service`
- [ ] `Restart=always`, `RestartSec=5`
- [ ] `Environment=PORT=3002`
- [ ] `EnvironmentFile=/home/server/.config/alertacar/backend.env`
- [ ] `systemctl --user enable alertacar-backend.service`
- [ ] `systemctl --user start alertacar-backend.service`

### 6.3 Cloudflare Tunnel
- [ ] Criar túnel ou adicionar rotas ao existente
- [ ] `alertacar.cursar.space` → `localhost:3002`
- [ ] `alertacar-admin.cursar.space` → `localhost:3002`
- [ ] `alertacar-api.cursar.space` → `localhost:3002`
- [ ] Verificar HTTPS + certificado

### 6.4 Teste End-to-End
- [ ] Cadastrar usuário (Firebase + WhatsApp)
- [ ] Adicionar CAR (WFS SEMA funciona)
- [ ] Dashboard mostra CAR
- [ ] Cron roda e detecta alertas (ou simular)
- [ ] WhatsApp conectado e envia mensagem
- [ ] Admin mostra métricas corretas
- [ ] Mapa carrega com polígono

---

## 📊 KPIs do MVP

| Métrica | Alvo MVP |
|---------|----------|
| Tempo de cadastro | < 30s |
| Tempo busca WFS SEMA | < 15s |
| Tempo consulta SCCON | < 5s por CAR |
| Entrega WhatsApp | < 10s após detecção |
| CARs simultâneos | 50+ |
| Uptime | 99% |
