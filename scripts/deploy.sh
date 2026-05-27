#!/usr/bin/env bash
#
# Deploy do MarcaiFlex na VPS.
#
# Uso (na VPS, dentro do diretório do projeto):
#   ./scripts/deploy.sh
#
# Pré-requisitos na VPS:
#   - Node 20+
#   - PM2 instalado globalmente (npm i -g pm2)
#   - .env preenchido (ver .env.example)
#   - Postgres acessível em DATABASE_URL
#   - Já existe um clone do repo + `pm2 start ecosystem.config.cjs` rodado
#     ao menos uma vez (este script faz RELOAD, não start inicial).
#
# O que o script faz:
#   1) git pull --ff-only (aborta se houver conflito)
#   2) npm ci (instala deps reproduzível, lê o lockfile)
#   3) prisma migrate deploy (aplica migrations pendentes — NUNCA prisma db push)
#   4) npm run build (gera Prisma client + build do Next)
#   5) pm2 reload com --update-env (zero downtime — Next 15 lida com reload)
#
# Falhas:
#   - set -e aborta na primeira falha
#   - Em caso de migration falha, PM2 NÃO é tocado — a versão antiga continua
#     servindo. Investigue antes de tentar de novo.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "▶ deploy iniciado em $(date -Iseconds)"
echo "  cwd: $PROJECT_DIR"

# ── 0) Pré-checagens ────────────────────────────────────────────────
if [[ ! -f .env ]]; then
  echo "✗ .env não encontrado em $PROJECT_DIR. Copie .env.example e preencha." >&2
  exit 1
fi
command -v pm2 >/dev/null || { echo "✗ PM2 não encontrado. npm i -g pm2" >&2; exit 1; }

# ── 1) Pull ─────────────────────────────────────────────────────────
echo "▶ git pull"
git fetch --prune
git pull --ff-only

# ── 2) Dependências ─────────────────────────────────────────────────
echo "▶ npm ci"
npm ci

# ── 3) Migrations (não destrutivo: deploy só aplica pendentes) ──────
echo "▶ prisma migrate deploy"
npx prisma migrate deploy

# ── 4) Build ────────────────────────────────────────────────────────
echo "▶ npm run build"
npm run build

# ── 5) Reload PM2 ───────────────────────────────────────────────────
echo "▶ pm2 reload"
mkdir -p logs
if pm2 describe marcaiflex >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  echo "  (primeira vez nesta VPS — usando 'start' em vez de 'reload')"
  pm2 start ecosystem.config.cjs --env production
  pm2 save
fi

echo "✓ deploy concluído em $(date -Iseconds)"
pm2 describe marcaiflex | head -20
