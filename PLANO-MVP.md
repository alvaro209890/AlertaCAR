# Plano MVP — AlertaCAR

## Fases

### Fase 1 — Fundação (Dia 1-2)

**Setup do projeto**
- [ ] Inicializar monorepo: `app/`, `admin/`, `backend/`
- [ ] Configurar Vite + React + TypeScript + Tailwind + shadcn/ui nos 2 frontends
- [ ] Configurar Express + TypeScript no backend
- [ ] Configurar ESLint + Prettier
- [ ] `.env.example` com todas variáveis necessárias
- [ ] Firebase project (reutilizar existente ou criar novo)

**Backend — API base**
- [ ] Servidor Express na porta 3002
- [ ] Middleware de auth (Firebase Admin SDK, verificar token)
- [ ] SQLite setup (better-sqlite3) com schema inicial
- [ ] Healthcheck endpoint `GET /api/health`

**Frontend App — Auth**
- [ ] Firebase Auth UI (login/cadastro com email/senha)
- [ ] Contexto de autenticação
- [ ] Rota protegida (dashboard vazio)
- [ ] Página de cadastro com campo obrigatório de WhatsApp (`+55XXXXXXXXXXX`)

**Frontend Admin — Auth**
- [ ] Login (mesmo Firebase Auth, mas verifica se é admin)
- [ ] Dashboard admin vazio

---

### Fase 2 — CRUD de CARs (Dia 2-3)

**Backend — Rotas de CAR**
- [ ] `POST /api/cars` — Adicionar CAR (nº CAR → buscar polígono via WFS SEMA)
- [ ] `GET /api/cars` — Listar CARs do usuário
- [ ] `DELETE /api/cars/:id` — Remover CAR do monitoramento
- [ ] `GET /api/cars/:id` — Detalhes do CAR + polígono

**Backend — Serviço WFS SEMA**
- [ ] `wfs-sema.ts`: Buscar polígono por número de CAR
- [ ] Cache de polígono (30 dias, SQLite)
- [ ] BBOX como método primário (INTERSECTS não confiável)
- [ ] Fallback e tratamento de timeout (GeoServer SEMA é lento)

**Frontend App — Dashboard de CARs**
- [ ] Formulário de adicionar CAR (input nº CAR)
- [ ] Cards dos CARs monitorados (status, área, último check)
- [ ] Botão de remover
- [ ] Loading states e feedback visual

---

### Fase 3 — Integração SCCON (Dia 3-4)

**Backend — Serviço SCCON**
- [ ] `sccon.ts`: Consultar alertas por polígono
- [ ] Extrair dados relevantes: data, tipo (desmatamento/degradacao), área
- [ ] Detectar alertas NOVOS (não notificar alertas já vistos)
- [ ] Salvar no banco (`alerts`)

**Backend — Cron de monitoramento**
- [ ] `node-cron` ou `setInterval`: executar diariamente às 06:00
- [ ] Para cada CAR ativo:
  - Buscar polígono (cache se < 30 dias)
  - Consultar SCCON
  - Se novos alertas → criar registros `alerts` + enfileirar WhatsApp
- [ ] Log de execução (última execução, CARs processados, alertas encontrados)

**Frontend App — Timeline de alertas**
- [ ] Página de detalhes do CAR com timeline de alertas
- [ ] Card de alerta: tipo, data, descrição
- [ ] Status: "enviado WhatsApp" / "pendente"

---

### Fase 4 — WhatsApp (Dia 4-5)

**Backend — Baileys**
- [ ] Setup do baileys (WebSocket, auth state em SQLite)
- [ ] Endpoint admin para gerar QR Code de conexão
- [ ] Reconexão automática
- [ ] Fila de mensagens (`whatsapp_queue` ou array em memória + DB)

**Painel Admin — WhatsApp Connect**
- [ ] Página "Conectar WhatsApp"
- [ ] Exibir QR Code (SSE ou polling)
- [ ] Status da conexão (conectado/desconectado)
- [ ] Botão "Reconectar" / "Desconectar"

**Envio de notificações**
- [ ] Template de mensagem: título + descrição + link
- [ ] Rate limiting (máx X mensagens por hora)
- [ ] Retry em falha

---

### Fase 5 — Painel Admin Completo (Dia 5)

**Painel Admin — Funcionalidades**
- [ ] Dashboard com estatísticas (total usuários, CARs ativos, alertas enviados)
- [ ] Lista de usuários (busca, filtrar por ativo/inativo)
- [ ] Logs de notificações (quem recebeu, quando, status)
- [ ] Configurações: horário do cron, templates de mensagem

---

### Fase 6 — Deploy e Polimento (Dia 5-6)

**Deploy**
- [ ] Build de produção (app + admin)
- [ ] Backend servir estáticos (`express.static`)
- [ ] Systemd service (`alertacar-backend.service`)
- [ ] Cloudflare Tunnel: 3 rotas → mesmo túnel
- [ ] Teste end-to-end: cadastro → adicionar CAR → receber alerta WhatsApp

**Polimento**
- [ ] UI responsiva
- [ ] Tratamento de erro (WFS offline, SCCON fora do ar)
- [ ] Loading states e skeletons
- [ ] README e documentação final

---

## Resumo de esforço

| Fase | Dias | Entregável |
|------|------|-----------|
| 1 - Fundação | 1-2 | Auth + projeto rodando |
| 2 - CRUD CARs | 1 | WFS SEMA funcionando |
| 3 - SCCON | 1-2 | Cron + alertas |
| 4 - WhatsApp | 1 | Baileys + notificações |
| 5 - Admin | 1 | Painel admin completo |
| 6 - Deploy | 1 | No ar |

**Total estimado: 5-6 dias para MVP funcional.**
