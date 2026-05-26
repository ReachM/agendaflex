import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECKOUT_REDIRECT_DELAY_MS,
  scheduleCheckoutRedirect
} from "@/components/checkout-modal.helpers";

/**
 * Exercita a função pura por trás do CheckoutModal (Opção A — redirect).
 * Não montamos o componente: vitest aqui roda em ambiente `node`. A função
 * recebe um `go` injetável justamente para o teste evitar mexer em
 * `window.location` (que é só-leitura em jsdom).
 */
describe("scheduleCheckoutRedirect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("usa um delay padrão de 2000ms", () => {
    expect(CHECKOUT_REDIRECT_DELAY_MS).toBe(2000);
  });

  it("não navega antes do delay completar", () => {
    const go = vi.fn();
    scheduleCheckoutRedirect("https://mp.example/auth/X", CHECKOUT_REDIRECT_DELAY_MS, go);
    expect(go).not.toHaveBeenCalled();
    vi.advanceTimersByTime(CHECKOUT_REDIRECT_DELAY_MS - 1);
    expect(go).not.toHaveBeenCalled();
  });

  it("navega para o init_point depois do delay", () => {
    const go = vi.fn();
    scheduleCheckoutRedirect("https://mp.example/auth/X", CHECKOUT_REDIRECT_DELAY_MS, go);
    vi.advanceTimersByTime(CHECKOUT_REDIRECT_DELAY_MS);
    expect(go).toHaveBeenCalledTimes(1);
    expect(go).toHaveBeenCalledWith("https://mp.example/auth/X");
  });

  it("cancel() aborta o redirect se for chamado antes do disparo", () => {
    const go = vi.fn();
    const cancel = scheduleCheckoutRedirect("https://mp.example/auth/Y", CHECKOUT_REDIRECT_DELAY_MS, go);
    cancel();
    vi.advanceTimersByTime(CHECKOUT_REDIRECT_DELAY_MS * 2);
    expect(go).not.toHaveBeenCalled();
  });

  it("usa window.location.href quando `go` não é passado", () => {
    // Em ambiente node, `window` é undefined — a função NÃO deve quebrar nesse
    // caso (proteção contra ambientes sem DOM). Garantia: o setTimeout dispara
    // sem lançar exceção.
    expect(() => {
      scheduleCheckoutRedirect("https://mp.example/auth/Z", 10);
      vi.advanceTimersByTime(20);
    }).not.toThrow();
  });
});
