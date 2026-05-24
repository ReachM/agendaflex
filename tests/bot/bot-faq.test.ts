import { describe, expect, it } from "vitest";
import { matchFaq } from "@/lib/services/bot-faq";

const faq = [
  { pergunta: "Qual o horário de funcionamento?", resposta: "Seg a Sex, 8h às 18h." },
  { pergunta: "Vocês aceitam cartão?", resposta: "Sim, aceitamos todos os cartões." }
];

describe("Bot FAQ — matchFaq", () => {
  it("retorna a resposta configurada para uma pergunta correspondente", () => {
    expect(matchFaq("qual o horario de funcionamento de voces?", faq)).toBe("Seg a Sex, 8h às 18h.");
  });

  it("casa por palavras-chave / similaridade (com acento e sem)", () => {
    expect(matchFaq("aceita cartao?", faq)).toBe("Sim, aceitamos todos os cartões.");
  });

  it("retorna null quando nada bate", () => {
    expect(matchFaq("xpto aleatorio zzz", faq)).toBeNull();
  });

  it("retorna null quando o FAQ está vazio", () => {
    expect(matchFaq("oi", [])).toBeNull();
  });
});
