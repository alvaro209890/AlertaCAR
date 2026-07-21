import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import config from '../lib/config.js'

export type LegalKnowledgeDoc = {
  id: string
  title: string
  tags: string[]
  relPath: string
  text: string
}

export type LegalKnowledgeSelection = {
  context: string
  documents: Array<{ id: string; title: string; relPath: string }>
}

let cachedPath = ''
let cachedDocs: LegalKnowledgeDoc[] = []

export function selectLegalKnowledge(query: string, maxChars = config.ai.knowledgeMaxChars, documents = loadLegalKnowledge()): LegalKnowledgeSelection {
  const terms = tokenize(query)
  if (!terms.length || !documents.length) return { context: '', documents: [] }

  const ranked = documents
    .map((doc) => ({ doc, score: scoreDocument(doc, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))

  let used = 0
  const parts: string[] = []
  const selected: LegalKnowledgeSelection['documents'] = []
  for (const { doc } of ranked.slice(0, 4)) {
    const remaining = maxChars - used
    if (remaining < 300) break
    const excerpt = excerptForTerms(doc.text, terms, Math.min(1_800, remaining - 100))
    const part = `### ${doc.title}\nFonte interna: ${doc.relPath}\n${excerpt}`
    parts.push(part)
    selected.push({ id: doc.id, title: doc.title, relPath: doc.relPath })
    used += part.length
  }
  return { context: parts.join('\n\n'), documents: selected }
}

export function loadLegalKnowledge(root = config.ai.knowledgePath): LegalKnowledgeDoc[] {
  if (root === cachedPath) return cachedDocs
  cachedPath = root
  cachedDocs = existsSync(root) ? listMarkdownFiles(root).map((filePath) => parseDocument(root, filePath)).filter(Boolean) as LegalKnowledgeDoc[] : []
  return cachedDocs
}

export function legalKnowledgeHealth(root = config.ai.knowledgePath) {
  const docs = loadLegalKnowledge(root)
  return { configuredPath: root, documents: docs.length, available: docs.length > 0 }
}

function listMarkdownFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name)
    if (entry.isDirectory()) files.push(...listMarkdownFiles(fullPath))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
  }
  return files.sort()
}

function parseDocument(root: string, filePath: string): LegalKnowledgeDoc | null {
  const text = readFileSync(filePath, 'utf8').trim()
  if (!text) return null
  const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(filePath, '.md')
  const tags = [...(text.match(/tags:\s*(.+)/i)?.[1]?.matchAll(/`([^`]+)`/g) || [])].map((match) => match[1])
  const relPath = path.relative(root, filePath).replaceAll(path.sep, '/')
  return { id: relPath.replace(/\.md$/, ''), title, tags, relPath, text }
}

function scoreDocument(doc: LegalKnowledgeDoc, terms: string[]): number {
  const title = normalize(doc.title)
  const tags = normalize(doc.tags.join(' '))
  const body = normalize(doc.text)
  const lexicalScore = terms.reduce((score, term) => {
    const occurrences = countOccurrences(body, term)
    return score + (title.includes(term) ? 12 : 0) + (tags.includes(term) ? 7 : 0) + Math.min(5, occurrences)
  }, 0)
  // When several documents address the subject, ground legal implications in legislation before technical guides.
  const sourcePriority = doc.relPath.startsWith('02_legislacao_federal/') ? 30 : doc.relPath.startsWith('03_legislacao_estadual/') ? 20 : 0
  return lexicalScore + sourcePriority
}

function excerptForTerms(text: string, terms: string[], maxChars: number): string {
  const normalized = normalize(text)
  const firstIndex = terms.map((term) => normalized.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] || 0
  const start = Math.max(0, text.lastIndexOf('\n', Math.max(0, firstIndex - 300)))
  const end = Math.min(text.length, start + maxChars)
  return `${text.slice(start, end).trim()}${end < text.length ? '\n[trecho truncado]' : ''}`
}

function tokenize(value: string): string[] {
  const stopwords = new Set(['a', 'o', 'as', 'os', 'de', 'da', 'do', 'dos', 'das', 'e', 'em', 'no', 'na', 'para', 'por', 'com', 'sem', 'que', 'um', 'uma', 'sobre', 'este', 'esta', 'isso', 'isso', 'como'])
  return [...new Set(normalize(value).match(/[a-z0-9]{3,}/g)?.filter((term) => !stopwords.has(term)) || [])]
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function countOccurrences(value: string, term: string) {
  return value.split(term).length - 1
}
