// Test de bout en bout : parcours parent (PIN + clé) puis enfant (création, choix, annuler, dictionnaire).
// Usage : node e2e/e2e.cjs   (le frontend doit être construit : npm run build)
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-e2e-'));
const shots = process.env.SHOTS || path.join(data, 'shots'); fs.mkdirSync(shots, { recursive: true });
const env = { ...process.env, DATA_DIR: data, PORT: '8099', OPENAI_BASE_URL: 'http://127.0.0.1:9099/v1', NODE_NO_WARNINGS: '1' };
delete env.OPENAI_API_KEY;
const procs = [
  spawn('node', [path.join(root, 'e2e/mock-openai.mjs')], { stdio: 'inherit' }),
  spawn(path.join(root, 'backend/node_modules/.bin/tsx'), ['src/server.ts'], { cwd: path.join(root, 'backend'), env, stdio: 'inherit' }),
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (m) => console.log('•', m);

(async () => {
  await sleep(2500);
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1180, height: 780 }, hasTouch: false, permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  try {
    await p.goto('http://127.0.0.1:8099/');
    await p.getByText('Nouvelle histoire').first().waitFor();
    await p.screenshot({ path: `${shots}/01-accueil.png` });

    step('admin : appui long sur le logo, création du PIN, clé API');
    const logo = p.locator('.logo-btn'); const box = await logo.boundingBox();
    await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.down(); await sleep(1500); await p.mouse.up();
    await p.getByRole('dialog', { name: 'Espace parent' }).waitFor();
    for (const k of ['1', '2', '3', '4']) await p.getByRole('button', { name: k, exact: true }).click();
    await p.getByRole('button', { name: '✔' }).click();
    await p.getByText('Clé API OpenAI').waitFor();
    await p.getByLabel('Clé API').fill('sk-test-0000000000000000000000000');
    await p.getByRole('button', { name: 'Enregistrer la clé' }).click();
    await p.getByText('✅ Clé enregistrée').waitFor();
    await p.getByRole('button', { name: 'Tester la clé' }).click();
    await p.getByText(/Clé valide/).waitFor();
    await p.screenshot({ path: `${shots}/02-admin.png` });
    // la clé ne doit jamais être renvoyée au navigateur
    const settingsJson = await p.evaluate(async () => (await fetch('/api/admin/settings', { headers: { 'x-admin-token': sessionStorage.getItem('pixi_admin') } })).text());
    assert(!settingsJson.includes('sk-test-0000'), 'la clé API fuit vers le navigateur !');
    await p.getByRole('button', { name: /Coûts/ }).click();
    await p.getByText(/Plafond/).first().waitFor();
    await p.getByRole('button', { name: 'Quitter' }).click();

    step('enfant : nouvelle histoire');
    await p.getByRole('button', { name: /Aventure/ }).click();
    await p.getByRole('button', { name: 'Suivant' }).click();
    await p.screenshot({ path: `${shots}/03-styles.png` });
    await p.getByRole('button', { name: 'Suivant' }).click();
    await p.getByRole('button', { name: /Créer un nouveau héros/ }).click();
    await p.getByLabel('Prénom').fill('Léo');
    await p.getByRole('button', { name: 'Suivant' }).click();
    await p.getByRole('button', { name: /cheveux bruns/ }).click();
    await p.getByRole('button', { name: /pull jaune/ }).click();
    await p.screenshot({ path: `${shots}/04-heros.png` });
    for (let i = 0; i < 3; i++) await p.getByRole('button', { name: /^Suivant/ }).click();
    await p.getByRole('button', { name: /C’est mon héros/ }).click();
    await p.getByText(/Léo marche dans la forêt/).waitFor({ timeout: 15000 });
    step('lecteur : texte, image, choix');
    await p.locator('img.illus').waitFor({ timeout: 15000 });
    await sleep(600);
    await p.screenshot({ path: `${shots}/05-lecteur.png` });
    assert((await p.locator('.choice').count()) >= 3, '3 propositions attendues');
    assert(await p.getByText('Suivre Zog').isVisible());

    step('choix → chapitre 2, annuler, refaire');
    await p.getByText('Suivre Zog').click();
    await p.locator('article.page').nth(1).waitFor({ timeout: 15000 });
    assert.equal(await p.locator('article.page').count(), 2);
    await p.getByRole('button', { name: 'Annuler' }).click();
    await p.waitForFunction(() => document.querySelectorAll('article.page').length === 1);
    await p.getByRole('button', { name: 'Refaire' }).click();
    await p.waitForFunction(() => document.querySelectorAll('article.page').length === 2);

    step('texte libre + surprise');
    await p.getByLabel('Ton idée').fill('Ils trouvent un trésor');
    await p.getByRole('button', { name: 'Envoyer' }).click();
    await p.waitForFunction(() => document.querySelectorAll('article.page').length === 3, null, { timeout: 15000 });
    await p.getByText('Surprise !').first().click();
    await p.waitForFunction(() => document.querySelectorAll('article.page').length === 4, null, { timeout: 15000 });

    step('dictionnaire (toucher un mot)');
    await p.locator('.story-text .w', { hasText: 'forêt' }).first().click();
    await p.getByText(/grand animal imaginaire/).waitFor();
    await p.screenshot({ path: `${shots}/06-dico.png` });
    await p.getByRole('button', { name: 'Fermer' }).click();

    step('bibliothèque');
    await p.getByRole('button', { name: 'Retour' }).click();
    await p.getByRole('button', { name: /Mes histoires/ }).click();
    await p.getByText('Léo et le dragon timide').waitFor();
    await p.screenshot({ path: `${shots}/07-bibliotheque.png` });
    const pdf = await p.evaluate(async () => { const id = (await (await fetch('/api/stories')).json())[0].id; const r = await fetch(`/api/stories/${id}/pdf`); return [r.status, r.headers.get('content-type'), (await r.arrayBuffer()).byteLength]; });
    assert.equal(pdf[0], 200); assert.equal(pdf[1], 'application/pdf'); assert(pdf[2] > 1000);

    step('portrait tablette + réglages');
    await p.setViewportSize({ width: 800, height: 1180 });
    await p.getByRole('button', { name: /Réglages/ }).click();
    await p.screenshot({ path: `${shots}/08-reglages-portrait.png` });
    step('atelier de voix : 16+ voix, réglages fins, échantillon avec consigne détaillée');
    assert((await p.getByRole('button', { name: /^Écouter / }).count()) >= 16, 'au moins 16 voix attendues');
    await p.getByRole('button', { name: /Atelier de voix/ }).click();
    await p.getByRole('button', { name: 'Cedar' }).click();
    await p.getByRole('button', { name: 'Théâtrale' }).count();
    await p.getByRole('button', { name: 'Mélancolique doux' }).click();
    await p.getByRole('button', { name: 'Personne âgée' }).click();
    await p.getByRole('button', { name: 'Suisse romand' }).click();
    const [req] = await Promise.all([p.waitForRequest((r) => r.url().includes('/api/tts')), p.getByRole('button', { name: /Écouter cet échantillon/ }).click()]);
    const body = JSON.parse(req.postData());
    assert.equal(body.spec.voice, 'cedar'); assert(body.spec.emotion.includes('melancolique')); assert.equal(body.spec.age, 'ancien'); assert.equal(body.spec.accent, 'suisse');
    await p.screenshot({ path: `${shots}/09-atelier-voix.png`, fullPage: false });
    assert.equal(errors.length, 0, 'erreurs JS : ' + errors.join('; '));
    console.log('\n✅ E2E OK — captures dans', shots);
  } catch (e) {
    await p.screenshot({ path: `${shots}/ERREUR.png` }).catch(() => {});
    console.error('\n❌ E2E ÉCHEC', e.message, '\nJS errors:', errors); process.exitCode = 1;
  } finally { await b.close(); procs.forEach((x) => x.kill()); }
})();
