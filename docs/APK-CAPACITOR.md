# Option : APK Android avec Capacitor

La PWA suffit dans la plupart des cas. Un APK apporte une icône « vraie app » et un plein écran verrouillé. L'APK **ne contient pas le serveur** : il affiche l'application servie par votre PC, ou une copie embarquée du frontend qui parle au serveur.

Prérequis : Node 22, Android Studio (SDK), et le serveur PixiContes accessible en HTTPS (voir HTTPS-TABLETTE.md).

```bash
cd frontend
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/android
npx cap init PixiContes fr.pixicontes.app --web-dir=dist
```

Éditez `capacitor.config.ts` pour charger l'application depuis votre serveur local (le plus simple, tout reste à jour) :

```ts
import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'fr.pixicontes.app', appName: 'PixiContes', webDir: 'dist',
  server: { url: 'https://192.168.1.50:8080', cleartext: false },
  android: { allowMixedContent: false },
};
export default config;
```

Puis :

```bash
npm run build
npx cap add android
npx cap sync
npx cap open android      # Android Studio → Build → Build APK(s)
```

Ajoutez `<uses-permission android:name="android.permission.RECORD_AUDIO" />` dans `android/app/src/main/AndroidManifest.xml` pour le micro. Si le certificat mkcert n'est pas installé sur la tablette, la WebView refusera la connexion : installez-le d'abord (HTTPS-TABLETTE.md, option A).
