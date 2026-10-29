#!/usr/bin/env bash
# HTTPS local pour le micro de la tablette (mkcert). Usage : ./scripts/https-setup.sh 192.168.1.50
set -euo pipefail
IP="${1:?Donnez l'adresse IP locale de ce PC, ex: ./scripts/https-setup.sh 192.168.1.50}"
command -v mkcert >/dev/null || { echo "Installez mkcert d'abord (https://github.com/FiloSottile/mkcert) : brew install mkcert / choco install mkcert / apt install mkcert"; exit 1; }
cd "$(dirname "$0")/.."
mkdir -p certs
mkcert -install
mkcert -key-file certs/key.pem -cert-file certs/cert.pem "$IP" localhost 127.0.0.1
grep -q '^HTTPS_KEY=' .env 2>/dev/null || printf 'HTTPS_KEY=./certs/key.pem\nHTTPS_CERT=./certs/cert.pem\n' >> .env
echo "✅ Certificats créés. Relancez 'npm run start' puis ouvrez https://$IP:8080 sur la tablette."
echo "👉 Copiez le certificat racine sur la tablette : $(mkcert -CAROOT)/rootCA.pem (voir docs/HTTPS-TABLETTE.md)"
