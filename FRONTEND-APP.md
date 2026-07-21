# Frontend — App do Usuário

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS + shadcn/ui
- Firebase Authentication (cliente)
- React Router (wouter, mesmo padrão GeoForest)

## Páginas

### 1. Login / Cadastro (`/login`, `/register`)

- Firebase Auth UI (email + senha)
- Cadastro exige:
  - Nome
  - Email
  - Senha
  - **Número WhatsApp** (`+55XXXXXXXXXXX`) — campo obrigatório
- Após cadastro, redireciona para dashboard

### 2. Dashboard (`/dashboard`)

- Visão geral dos CARs monitorados
- Cada CAR em um card com:
  - Nº do CAR
  - Status (ativo, pendente)
  - Área (ha)
  - Último check ("há X horas")
  - Contador de alertas não lidos (badge vermelho)
- Botão "+" para adicionar novo CAR
- Se nenhum CAR, mostrar empty state com CTA

### 3. Adicionar CAR (`/dashboard/add`)

- Input para número do CAR
- Validação (formato, dígitos)
- Loading enquanto busca polígono via WFS
- Feedback visual da busca (nome do município, área)
- Confirmação → redireciona pro dashboard

### 4. Detalhes do CAR (`/dashboard/cars/:id`)

- Header com nº CAR + status + área
- Timeline de alertas (ordem cronológica, mais recente no topo):
  ```
  ┌─────────────────────────────────────┐
  │ 🔴 Desmatamento — 21/07/2026        │
  │ 12.5 ha detectados                  │
  │ Enviado via WhatsApp ✅             │
  ├─────────────────────────────────────┤
  │ 🟡 Degradação — 15/07/2026          │
  │ 2.3 ha                               │
  │ Enviado via WhatsApp ✅             │
  └─────────────────────────────────────┘
  ```
- Mapa simples com polígono (Leaflet, reutilizar do GeoForest)
- Botão "Forçar verificação agora"
- Botão "Remover monitoramento" (com confirmação)

### 5. Perfil (`/dashboard/profile`)

- Dados do usuário
- Número do WhatsApp (editável)
- Botão "Excluir conta"

## Estados de UI

Todos os componentes devem ter:

| Estado | Comportamento |
|--------|---------------|
| **Loading** | Skeleton ou spinner, nunca tela branca |
| **Empty** | Ilustração + CTA ("Adicione seu primeiro CAR") |
| **Error** | Mensagem amigável + botão "Tentar novamente" |
| **Success** | Dados renderizados |

## Componentes compartilhados

- `CarCard` — Card de CAR no dashboard
- `AlertTimeline` — Timeline de alertas
- `AddCarDialog` — Modal/rota de adicionar CAR
- `LoadingSkeleton` — Skeleton para cards e timeline
- `EmptyState` — Estado vazio com ilustração
- `ErrorBanner` — Banner de erro com retry

## Design

Seguir padrão GeoForest:
- Glassmorphism nos cards
- Gradientes nos botões e badges
- `active:scale-[0.97]` nos botões
- Container com `flex-1 overflow-y-auto custom-scrollbar`
- Paleta: emerald/teal (remete a natureza/ambiental)

## Firebase Config

Reutilizar projeto Firebase existente ou criar dedicado:

```typescript
// lib/firebase.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  // ...
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
```

## API Client

```typescript
// lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'https://alertacar-api.cursar.space'

async function fetchApi(path: string, options?: RequestInit) {
  const token = await auth.currentUser?.getIdToken()
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...options?.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
}
```
