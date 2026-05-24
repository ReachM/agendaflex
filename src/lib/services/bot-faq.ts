/**
 * Casamento simples (sem IA pesada) entre a mensagem do cliente e o FAQ
 * configurado em CompanyBotConfig.faqConfig — normalização + similaridade
 * por tokens (Jaccard) + cobertura da pergunta + substring.
 */

export type FaqItem = { pergunta: string; resposta: string };

// Stopwords pt-BR que não ajudam a distinguir perguntas.
const STOPWORDS = new Set([
  "a", "o", "os", "as", "de", "da", "do", "das", "dos", "e", "em", "um", "uma",
  "para", "pra", "por", "com", "que", "qual", "quais", "como", "quanto", "quanta",
  "voce", "voces", "tem", "ter", "meu", "minha", "seu", "sua", "eu", "no", "na",
  "nos", "nas", "ao", "aos", "se", "ou", "the", "is"
]);

/** Remove marcas diacríticas (acentos) sem embutir caracteres combinantes no fonte. */
function stripDiacritics(text: string): string {
  let out = "";
  for (const char of text.normalize("NFD")) {
    const code = char.codePointAt(0) ?? 0;
    // Combining Diacritical Marks: U+0300–U+036F
    if (code >= 0x300 && code <= 0x36f) continue;
    out += char;
  }
  return out;
}

function normalize(text: string): string {
  return stripDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function isFaqItem(value: unknown): value is { pergunta: unknown; resposta: unknown } {
  return typeof value === "object" && value !== null && "pergunta" in value && "resposta" in value;
}

/**
 * Lê com segurança o faqConfig (Json do Prisma, formato desconhecido em runtime)
 * e devolve apenas itens válidos { pergunta, resposta } não vazios.
 */
export function parseFaqConfig(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];

  const items: FaqItem[] = [];
  for (const entry of raw) {
    if (!isFaqItem(entry)) continue;
    const pergunta = String(entry.pergunta ?? "").trim();
    const resposta = String(entry.resposta ?? "").trim();
    if (pergunta && resposta) items.push({ pergunta, resposta });
  }
  return items;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Retorna a resposta do FAQ mais parecido com a mensagem, ou null se nada
 * atingir o limiar mínimo de similaridade.
 */
export function matchFaq(message: string, faqConfig: unknown, threshold = 0.34): string | null {
  const items = parseFaqConfig(faqConfig);
  if (items.length === 0) return null;

  const messageNorm = normalize(message);
  const messageTokens = tokenize(message);
  if (messageTokens.length === 0) return null;

  let best: { score: number; resposta: string } | null = null;

  for (const item of items) {
    const questionNorm = normalize(item.pergunta);
    const questionTokens = tokenize(item.pergunta);

    let score = jaccard(messageTokens, questionTokens);

    // Substring forte (a mensagem contém a pergunta ou vice-versa).
    if (questionNorm && (messageNorm.includes(questionNorm) || questionNorm.includes(messageNorm))) {
      score = Math.max(score, 0.9);
    }

    // Quanto da pergunta foi coberto pela mensagem.
    if (questionTokens.length > 0) {
      const covered = questionTokens.filter((token) => messageTokens.includes(token)).length / questionTokens.length;
      score = Math.max(score, covered * 0.95);
    }

    if (!best || score > best.score) {
      best = { score, resposta: item.resposta };
    }
  }

  return best && best.score >= threshold ? best.resposta : null;
}
