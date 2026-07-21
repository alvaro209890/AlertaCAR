# IA-Assistente — AlertaCAR

> Pilar de inteligência do AlertaCAR. Objetivo: **apoiar a decisão do consultor/engenheiro florestal**,
> não substituí-la. A IA resume, pontua risco, interpreta imagens e **minuta pareceres** — o Responsável
> Técnico revisa, decide e assina.

## Modelo

| Item | Valor |
|------|-------|
| Modelo | Configurável por `DEEPSEEK_MODEL` (padrão: **`deepseek-chat`**) |
| Base URL | `https://api.deepseek.com/v1` |
| Chave | `DEEPSEEK_API_KEY` (env — **nunca commitar**) |
| Raciocínio | médio (Flash) — rápido e barato, ideal para resumos/triagem/chat |
| Fallback | Groq (visão/backup) se DeepSeek indisponível |

> Mesma infraestrutura já usada em outros projetos da casa (Hermes/Atlas). O AlertaCAR só consome a API;
> a chave vem do `.env` do backend, não do código.

### Princípios
1. **Contexto é tudo** — a qualidade vem do *context builder*, não de prompts espertos.
2. **Sempre com disclaimer** — toda saída carrega "análise preliminar; consulte o RT".
3. **Determinística onde dá** — score de risco tem componente calculado + explicação da IA (a IA não inventa o número sozinha).
4. **Barata por padrão** — cache agressivo, respostas curtas, streaming; Flash em vez de Pro.
5. **Sem PII sensível no prompt** — envia dados do imóvel/ambientais, não dados pessoais do cliente final.

---

## Arquitetura

```
                    ┌────────────────────────────────────────┐
                    │  services/ai-context.ts                 │
  CAR + alerts +    │  buildCarContext(carId)                 │
  camadas + NDVI +  │   → { cadastro, camadas, conformidade,  │
  autorizações +    │       alertas[], sobreposicoes[],       │
  vizinho           │       autorizacoes[], ndviTrend, ... }  │
                    └───────────────┬────────────────────────┘
                                    │ JSON compacto
                    ┌───────────────▼────────────────────────┐
                    │  services/ai.ts                         │
                    │  chat() · complete() · stream()         │
                    │  DeepSeek V4 Flash + retry + cache      │
                    └───────────────┬────────────────────────┘
                                    │
     ┌──────────────┬──────────────┼──────────────┬───────────────┐
     ▼              ▼              ▼              ▼               ▼
  /ai/chat    /ai/summary   /risk-score   /ai/ndvi-analysis  /ai/laudo
  (thread)    (resumo)      (0–100+expl)  (interpreta diff)  (minuta)
```

### `ai-context.ts` — Context Builder
Monta um JSON compacto e **determinístico** com tudo que a IA precisa saber do imóvel:

```ts
interface CarContext {
  cadastro:      { numero, municipio, areaHa, bioma, status }
  camadas:       { arlHa, appHa, auasHa, avnHa, nascentes, consolidadaHa }
  conformidade:  { arlExigidaHa, arlDeclaradaHa, deficitArlHa, passivoAppHa, antropizadoPos2008Ha }
  alertas:       Array<{ classe, data, areaHa, fonte, status, dentroDe: 'APP'|'ARL'|null, temAutorizacao: boolean }>
  sobreposicoes: Array<{ tipo: 'TI'|'UC'|'ASSENTAMENTO', nome, percentual }>
  autorizacoes:  Array<{ tipo, numero, validade, areaHa }>
  ndviTrend:     Array<{ ano, ndviMedio }>
  vizinho:       { desmateProximoHa, distanciaKm }
}
```

Tudo isso já vem das Fases 4–6 — a IA **não busca dados**, só recebe o contexto pronto.

### RAG jurídico-ambiental

O backend mantém uma cópia versionada da base jurídica/técnica em `backend/knowledge/` e faz seleção
lexical determinística antes de chamar o modelo. Apenas até quatro documentos e
`AI_KNOWLEDGE_MAX_CHARS` caracteres de trechos pertinentes acompanham a pergunta. As referências são
apoio interno: a resposta deve indicar a necessidade de validar a fonte oficial atualizada.

---

## Funcionalidades e endpoints

| Endpoint | Método | O que faz |
|----------|--------|-----------|
| `/api/ai/chat` | POST | Chat conversacional (por CAR ou por carteira), com thread persistente e streaming |
| `/api/cars/:id/ai/summary` | POST | Resumo em linguagem natural dos alertas do período |
| `/api/cars/:id/risk-score` | GET | Score 0–100 de risco de desmate + explicação (parte calculada + parte IA) |
| `/api/cars/:id/ai/ndvi-analysis` | POST | Interpreta o diff de NDVI (Fase 6): polígonos com perda, área, severidade, parecer |
| `/api/ai/triage` | POST | Classifica um alerta: verdadeiro / falso positivo / provável legal |
| `/api/cars/:id/ai/recomendacoes` | POST | Próximos passos conforme o achado (embargo, desmate sem AUTEX, licença vencendo) |
| `/api/cars/:id/ai/laudo` | POST | Minuta de laudo técnico estruturado (editável, exporta p/ PDF da Fase 9) |
| `/api/ai/portfolio-digest` | POST | Resumo semanal da carteira inteira (para digest de e-mail) |

### 1. Assistente conversacional (`/ai/chat`)
- Escopo `car` (contexto de 1 imóvel) ou `portfolio` (resumo da carteira).
- Perguntas típicas: *"o que aconteceu na Fazenda X esse mês?"*, *"esse alerta de 12 ha é grave?"*,
  *"esse desmate tem autorização?"*, *"quais dos meus imóveis estão em risco?"*.
- Threads em `ai_threads`/`ai_messages`; front usa **streaming** (SSE) na aba IA.

### 2. Score de risco (`/risk-score`) ⭐
Componente **calculado** (transparente) + **explicação** da IA:

```
score = w1·histórico_alertas + w2·tendência_NDVI_negativa
      + w3·desmate_vizinho   + w4·sobreposição_restrita
      + w5·passivo_APP/ARL   + w6·antropização_recente
```
A IA recebe os componentes e gera: faixa (Baixo/Médio/Alto/Crítico) + 2-3 frases explicando **por quê** e o que observar. Nunca inventa o número.

### 3. Interpretação de NDVI (`/ai/ndvi-analysis`)
Recebe o diff de NDVI entre dois períodos (polígonos com queda ≥ threshold) e produz:
perda total (ha), polígonos ordenados por severidade, e parecer preliminar ("compatível com corte raso entre X e Y").

### 4. Triagem de alertas (`/ai/triage`)
Para acelerar o workflow da Fase 5: dado o alerta + contexto (dentro de APP? tem AUTEX? área? recência?),
sugere **verdadeiro / falso positivo / provável legal** com justificativa. O consultor confirma (a IA não muda status sozinha).

### 5. Gerador de laudo (`/ai/laudo`) ⭐⭐
Do contexto completo → minuta estruturada em blocos: **Introdução · Identificação do imóvel · Análise
dos alertas · Análise de NDVI/satélite · Conformidade (ARL/APP) · Conclusão · Recomendações**.
 Retorna Markdown editável e persistido como rascunho; blocos estruturados, mapas/NDVI e exportação PDF são a próxima etapa.

---

## Schema (novas tabelas)

```sql
-- Threads de conversa da IA
CREATE TABLE ai_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  scope TEXT NOT NULL,          -- 'car' | 'portfolio'
  car_id TEXT REFERENCES cars(id),
  title TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES ai_threads(id),
  role TEXT NOT NULL,           -- 'user' | 'assistant'
  content TEXT NOT NULL,
  tokens_in INTEGER, tokens_out INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Score de risco (cache + histórico)
CREATE TABLE risk_scores (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES cars(id),
  score INTEGER NOT NULL,       -- 0–100
  band TEXT NOT NULL,           -- 'baixo'|'medio'|'alto'|'critico'
  components_json TEXT,         -- pesos e valores calculados
  explanation TEXT,             -- texto da IA
  computed_at TEXT DEFAULT (datetime('now'))
);

-- Laudos gerados (rascunhos editáveis)
CREATE TABLE ai_laudos (
  id TEXT PRIMARY KEY,
  car_id TEXT NOT NULL REFERENCES cars(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  content_md TEXT NOT NULL,
  status TEXT DEFAULT 'rascunho', -- 'rascunho'|'final'
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

---

## UX no app

- **Aba IA** na página do CAR: chat com streaming + botões rápidos ("explicar este alerta", "gerar resumo do mês", "gerar laudo").
- **Widget "Pergunte sobre sua carteira"** no dashboard (chat de escopo `portfolio`).
- **Badge de score** (cor + número) nos cards do dashboard e na tabela da carteira; clique abre a explicação.
- Botão **"Triagem IA"** em cada alerta (sugere status, consultor confirma).
- No editor de laudo: gerar minuta → editar blocos → inserir mapa/NDVI → exportar PDF.

## Custos, cache e limites
- **Cache** por (car_id, tipo, hash-do-contexto) — resumo/score só recomputam quando o contexto muda.
- **Rate limiting** por usuário (ex.: 60 chamadas/h) para chat.
- Respostas **curtas por padrão**; laudo é a única saída longa.
- Registrar `tokens_in/out` para observabilidade de custo.

## Guardrails
- Disclaimer fixo em toda saída técnica.
- A IA **não** altera dados (status de alerta, remoção de CAR) — só sugere; ações são do usuário.
- Sem dados pessoais do cliente final no prompt (só dados do imóvel e ambientais).
- Timeout + fallback: se a IA falhar, a plataforma continua 100% funcional sem ela.
