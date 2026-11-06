#!/usr/bin/env bash
# Deploy to Vercel with the CLI (alternative to Vercel's Git integration).
#   VERCEL_TOKEN=... ./scripts/deploy.sh            # preview deployment
#   VERCEL_TOKEN=... ./scripts/deploy.sh --prod     # production
# Uses a separate project so the existing portfolio project is left untouched.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="${VERCEL_PROJECT:-gabor-beleczki-studio}"
SCOPE="${VERCEL_SCOPE:-beleczkigabor-4723}"
TOKEN="${VERCEL_TOKEN:?set VERCEL_TOKEN}"
npx --yes vercel@latest link --yes --project "$PROJECT" --scope "$SCOPE" --token "$TOKEN"
npx --yes vercel@latest deploy --yes --scope "$SCOPE" --token "$TOKEN" \
  --build-env SITE_URL="https://${PROJECT}.vercel.app" "$@"
