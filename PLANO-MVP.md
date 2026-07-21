# Plano MVP — AlertaCAR

> ✅ Testes de integração concluídos. 135 camadas WFS mapeadas. SCCON via API paginada funcional.

## Resumo

| Fase | Descrição | Checklist | Dias |
|------|-----------|-----------|------|
| 1 | Fundação — monorepo, auth local, backend base | 15 itens | 1-2 |
| 2 | CRUD CARs — WFS SEMA, busca polígono, dashboard | 12 itens | 1 |
| 3 | SCCON — alertas desmatamento, cron diário | 10 itens | 1 |
| 4 | SEMA — embargos, infrações, licenciamento | 8 itens | 1 |
| 5 | WhatsApp + Admin + Mapas + UI | 14 itens | 1-2 |
| 6 | Deploy — systemd, túnel, produção | 10 itens | 1 |

**Total: 5-7 dias para MVP com monitoramento multicamada.**

---

## Fase 1 — Fundação

### 1.1 Setup
- [ ] `mkdir -p Banco_de_dados/AlertaCAR/` (fora do repo!)
- [ ] Monorepo: `app/`, `admin/`, `backend/`
- [ ] Vite + React 19 + TS + Tailwind + shadcn/ui (app + admin)
- [ ] Express + TS + esbuild (backend)
- [ ] ESLint + Prettier
- [ ] `.env.example` completo

### 1.2 Auth Local
- [ ] Tabela `users`: email, password_hash (bcrypt), name, whatsapp_number
- [ ] `POST /api/auth/register` — validar email único, bcrypt 12 rounds, retornar JWT
- [ ] `POST /api/auth/login` — verificar senha, retornar JWT
- [ ] `GET /api/auth/me` — dados do usuário logado
- [ ] Middleware `requireAuth` — verificar JWT no header
- [ ] `JWT_SECRET` gerado e salvo no `.env`

### 1.3 Frontend Auth
- [ ] Página de login (email + senha)
- [ ] Página de cadastro (nome, email, senha, **WhatsApp obrigatório**)
- [ ] `AuthContext` com token JWT no localStorage
- [ ] Rota protegida, redirect se não autenticado
- [ ] Dashboard vazio pós-login

---

## Fase 2 — CRUD de CARs

### 2.1 WFS SEMA
- [ ] `wfs-sema.ts`: `fetchCarPolygon(carNumber)`
- [ ] Conversão de formato: nº simplificado → `MTXXXXX/YYYY`
- [ ] Cache polígono: 30 dias, SQLite
- [ ] Retry 3x com backoff
- [ ] Reprojeção SIRGAS 2000 → WGS84

### 2.2 Rotas
- [ ] `POST /api/cars` — body `{carNumber}`, busca WFS, salva
- [ ] `GET /api/cars` — lista CARs (com último alerta e contagem)
- [ ] `GET /api/cars/:id` — detalhes + GeoJSON + área
- [ ] `DELETE /api/cars/:id` — soft delete

### 2.3 Dashboard
- [ ] Card de cada CAR: nº, município, área, status
- [ ] Badge de alertas não lidos
- [ ] Empty state com CTA
- [ ] Formulário "Adicionar CAR" com loading e feedback

---

## Fase 3 — SCCON (Desmatamento)

### 3.1 Serviço SCCON
- [ ] `sccon.ts`: `getPublicToken()` — cache 23h
- [ ] `searchAlertsByCar(carNumber)` — POST `/alerts/search` com `cdCars`
- [ ] Filtrar alertas NOVOS (comparar `source_id` com DB)
- [ ] Salvar em `alerts` com `source='sccon'`

### 3.2 Cron SCCON
- [ ] `node-cron`: `0 6 * * *`
- [ ] Para cada CAR ativo: SCCON search → filtrar novos → salvar → enfileirar WhatsApp
- [ ] Log por CAR (sucesso, alertas, falhas)

### 3.3 Timeline de Alertas
- [ ] Página detalhes do CAR com seção "Alertas SCCON"
- [ ] Timeline vertical: badges coloridos por classe
- [ ] Exibir: classe, data, área, status WhatsApp

---

## Fase 4 — SEMA Multicamada

### 4.1 Embargos
- [ ] `wfs-sema.ts`: `fetchEmbargos(polygon)` — camada `AREAS_EMBARGADAS_SEMA`
- [ ] Detectar NOVOS embargos (BBOX intersect)
- [ ] Salvar como `source='sema_embargo'`

### 4.2 Infrações
- [ ] `fetchInfracoes(polygon)` — `TDAD_FISCALIZACAO_AUTO_DE_INFRACAO`
- [ ] `fetchNotificacoes(polygon)` — `TDAD_FISCALIZACAO_NOTIFICACAO`

### 4.3 Licenciamento
- [ ] `fetchLicenciamento(polygon)` — `SIMLAMGEO_LP/LI/LO_ATIVA`
- [ ] Alertar novas licenças ou vencimento próximo

### 4.4 Fundiário (sobreposições)
- [ ] `fetchSobreposicoes(polygon)` — UC, TI, Assentamentos INCRA
- [ ] Alertar se polígono do CAR sobrepõe área restrita

---

## Fase 5 — WhatsApp + Admin + Mapas + UI

### 5.1 Baileys
- [ ] Sessão persistente SQLite
- [ ] QR Code (base64)
- [ ] Reconexão automática
- [ ] `sendAlert(to, carNumber, alerts)` com template

### 5.2 Painel Admin
- [ ] Dashboard: cards (usuários, CARs, alertas, WhatsApp)
- [ ] WhatsApp Connect: QR Code com polling
- [ ] Tabela de usuários
- [ ] Log de notificações
- [ ] Configurações (horário cron, template)

### 5.3 Mapa
- [ ] Leaflet no detalhe do CAR
- [ ] Polígono do CAR (emerald, fill 15%)
- [ ] Markers dos alertas SCCON (coloridos por classe)
- [ ] Overlays: embargos (red), UC (green), TI (orange)

### 5.4 UI/UX
- [ ] Dark mode padrão, glassmorphism
- [ ] Cards com `backdrop-blur`
- [ ] Botões gradiente `active:scale-[0.97]`
- [ ] Animações: fadeIn, slideIn
- [ ] Responsivo mobile-first

---

## Fase 6 — Deploy

### 6.1 Build
- [ ] `app/`: `pnpm run build` → `dist/`
- [ ] `admin/`: `pnpm run build` → `dist/`
- [ ] `backend/`: esbuild → `dist/index.js`

### 6.2 Banco
- [ ] `mkdir -p "/media/server/HD Backup/Servidores_NAO_MEXA/Banco_de_dados/AlertaCAR/"`
- [ ] Schema criado na primeira execução

### 6.3 Systemd
- [ ] `alertacar-backend.service` (Restart=always, porta 3002)
- [ ] `EnvironmentFile=/home/server/.config/alertacar/backend.env`

### 6.4 Cloudflare
- [ ] 3 domínios → `localhost:3002`
- [ ] Verificar HTTPS

### 6.5 Smoke test
- [ ] Cadastro + login → JWT
- [ ] Adicionar CAR → WFS SEMA
- [ ] Dashboard → cards
- [ ] Cron → alertas SCCON
- [ ] WhatsApp → mensagem enviada
- [ ] Mapa → polígono + markers
