# HTTPS local pour le micro de la tablette

Les navigateurs n'autorisent le micro (et l'installation PWA) que sur une page **sécurisée** : `https://…` ou `localhost`. Sur le réseau domestique, `http://192.168.x.x:8080` ne suffit donc pas. Trois options, de la plus simple à la plus souple.

## Option A — mkcert (recommandée)
1. Sur le PC qui héberge PixiContes, installez [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert`, `choco install mkcert`, ou `apt install mkcert`).
2. Trouvez l'adresse IP du PC (ex. `192.168.1.50`) et lancez : `./scripts/https-setup.sh 192.168.1.50`. Cela crée `certs/key.pem` + `certs/cert.pem` et ajoute `HTTPS_KEY`/`HTTPS_CERT` à `.env`.
3. Copiez `rootCA.pem` (dossier affiché par `mkcert -CAROOT`) sur la tablette (câble, e-mail, clé USB), puis : *Paramètres → Sécurité → Chiffrement et identifiants → Installer un certificat → **Certificat CA*** (le chemin varie selon la marque).
4. Relancez `npm run start` et ouvrez `https://192.168.1.50:8080` dans Chrome sur la tablette. Réservez cette IP dans votre box (bail DHCP fixe) pour qu'elle ne change pas.

## Option B — Tunnel local sans certificat à installer
Un tunnel chiffré (ex. `cloudflared tunnel --url http://localhost:8080`, ou Tailscale + `tailscale serve`) donne une adresse `https://` valide. **Attention** : avec cloudflared l'application devient joignable depuis Internet par quiconque a l'adresse ; préférez Tailscale (privé à vos appareils). Cela contredit un peu l'objectif « tout reste local » : à n'utiliser que si vous comprenez le compromis.

## Option C — Chrome Android, exception de test
Dans Chrome sur la tablette, `chrome://flags/#unsafely-treat-insecure-origin-as-secure` → ajoutez `http://192.168.1.50:8080` → Activer → Relancer. Rapide, mais à refaire si Chrome se met à jour ; réservé au dépannage.

## Installer la PWA
Ouvrez l'adresse dans Chrome → menu ⋮ → **Installer l'application** (ou *Ajouter à l'écran d'accueil*). L'icône du dragon apparaît ; l'app s'ouvre en plein écran.
