/**
 * Mock local da Evolution API para o smoke test.
 *
 * Captura (e NÃO repassa para o WhatsApp) as chamadas de saída que o bot faz via
 * sendTextMessage — POST {EVOLUTION_API_URL}/message/sendText/{instance}.
 * Sempre responde 200 para o envio ser considerado bem-sucedido pelo bot.
 *
 * Uso:
 *   node scripts/mock-evolution.mjs
 *   # e no .env:  EVOLUTION_API_URL="http://localhost:4000"
 *
 * Nunca imprime o valor da apikey — apenas se o header veio presente.
 */

import http from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4000);

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) req.destroy(); // proteção simples
  });
  req.on("end", () => {
    console.log("\n────────── Evolution OUT capturada ──────────");
    console.log(`${req.method} ${req.url}`);
    const isSendText = req.url?.includes("/message/sendText/");
    console.log(`rota /message/sendText/{instance}? ${isSendText ? "SIM ✅" : "não"}`);
    console.log(`header apikey presente? ${req.headers["apikey"] ? "SIM ✅" : "NÃO ❌"}`);
    try {
      const parsed = JSON.parse(body);
      console.log("body:", JSON.stringify(parsed));
      console.log(`  → number: ${parsed.number ?? "(ausente)"}`);
      console.log(`  → text:   ${parsed.text ?? "(ausente)"}`);
    } catch {
      console.log("body (não-JSON):", body);
    }
    console.log("─────────────────────────────────────────────");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ key: { id: `mock-${Date.now()}` }, status: "PENDING" }));
  });
});

server.listen(PORT, () => {
  console.log(`Mock da Evolution capturando envios em http://localhost:${PORT}`);
  console.log(`Configure no .env:  EVOLUTION_API_URL="http://localhost:${PORT}"`);
  console.log("Aguardando chamadas de sendTextMessage... (Ctrl+C para sair)");
});
