/**
 * Next.js instrumentation: register() roda UMA vez no bootstrap do servidor.
 *
 * A lógica node-only (carregar `.env` + subir o cron de lembretes) vive em
 * `instrumentation-node.ts` e é carregada por um `import()` dinâmico DENTRO de um
 * guard POSITIVO `NEXT_RUNTIME === "nodejs"`.
 *
 * Por que guard POSITIVO e não early-return: como existe `middleware.ts`, o
 * Next.js também compila este arquivo para o runtime edge. O webpack coleta os
 * `import()` sintaticamente alcançáveis MESMO após um `return` inalcançável — um
 * early-return puxaria `instrumentation-node.ts` (e, via whatsapp.ts, o builtin
 * `child_process`) para o bundle edge, quebrando o build. Com o `import()` dentro
 * do `if (... === "nodejs")`, o DefinePlugin torna a condição estaticamente falsa
 * no bundle edge e o webpack descarta todo o grafo node-only.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNodeRuntime } = await import("./instrumentation-node");
    await registerNodeRuntime();
  }
}
