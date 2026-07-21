import { describe, expect, it } from 'vitest'
import { loadLegalKnowledge, selectLegalKnowledge, type LegalKnowledgeDoc } from './legal-knowledge.js'

const docs: LegalKnowledgeDoc[] = [
  { id: 'codigo', title: 'Código Florestal', tags: ['APP', 'Reserva Legal'], relPath: 'federal/codigo.md', text: '# Código Florestal\nReserva Legal e APP dependem de regras específicas.' },
  { id: 'pmfs', title: 'Manejo florestal', tags: ['PMFS', 'AUTEX'], relPath: 'tecnico/pmfs.md', text: '# PMFS\nA exploração florestal exige autorização e plano aprovado.' },
]

describe('selectLegalKnowledge', () => {
  it('prioriza título e tags pertinentes à pergunta', () => {
    const result = selectLegalKnowledge('Há déficit de Reserva Legal e APP?', 2000, docs)
    expect(result.documents).toHaveLength(1)
    expect(result.documents[0].id).toBe('codigo')
    expect(result.context).toContain('Fonte interna: federal/codigo.md')
  })

  it('respeita o orçamento de contexto e não seleciona consulta sem termos', () => {
    expect(selectLegalKnowledge('a e de', 2000, docs).documents).toHaveLength(0)
    expect(selectLegalKnowledge('autorização PMFS', 250, docs).context.length).toBeLessThanOrEqual(250)
  })

  it('carrega a base jurídica empacotada no backend', () => {
    const packaged = loadLegalKnowledge()
    expect(packaged.length).toBeGreaterThanOrEqual(39)
    expect(selectLegalKnowledge('Reserva Legal APP', 3000, packaged).documents.map((doc) => doc.id)).toContain('02_legislacao_federal/codigo_florestal')
  })
})
