// Faux serveur OpenAI pour les tests de bout en bout (aucun coût, aucune clé réelle).
import http from 'node:http';
let n = 0;
const png = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const wav = Buffer.from('UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=', 'base64');
const chapter = (t) => ({
  title: 'Léo et le dragon timide', chapter_text: t, chapter_summary: 'Léo rencontre Zog.', translation_fr: '',
  memory_update: { setting: 'une forêt magique', characters: [
    { name: 'Léo', appearance: '', personality: '', powers: '', flaws: '', relations: '', visual: 'boy with brown curly hair, yellow sweater' },
    { name: 'Zog', appearance: 'petit dragon vert', personality: 'timide', powers: 'bulles', flaws: '', relations: 'ami de Léo', visual: 'small round green dragon' }],
    places: [{ name: 'Forêt', description: 'magique' }], objects: [], events: ['Léo rencontre Zog'] },
  choices: [{ icon: '🐉', label: 'Suivre Zog', label_fr: '' }, { icon: '🌳', label: 'Grimper à l’arbre', label_fr: '' }, { icon: '🍪', label: 'Goûter les biscuits', label_fr: '' }],
  image_prompt: 'Leo and a small green dragon in a magical forest',
});
http.createServer((req, res) => {
  let b = [];
  req.on('data', (c) => b.push(c));
  req.on('end', () => {
    const u = req.url;
    const json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    if (u.endsWith('/models')) return json({ data: [] });
    if (u.endsWith('/moderations')) return json({ results: [{ flagged: false, categories: {}, category_scores: {} }] });
    if (u.endsWith('/chat/completions')) {
      n++;
      const body = JSON.parse(Buffer.concat(b).toString());
      const sys = body.messages[0].content;
      if (sys.includes('dictionnaire')) return json({ choices: [{ message: { content: JSON.stringify({ emoji: '🐉', meaning: 'Un grand animal imaginaire qui crache du feu.', example: 'Le dragon dort.', kind: 'nom' }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 60 } });
      return json({ choices: [{ message: { content: JSON.stringify(chapter(`Chapitre ${n}. Léo marche dans la forêt magique. Il entend un petit bruit. « Qui est là ? » dit-il. Un petit dragon vert sort des buissons. Il s’appelle Zog et il est très timide !`)) }, finish_reason: 'stop' }], usage: { prompt_tokens: 1200, completion_tokens: 350 } });
    }
    if (u.endsWith('/images/generations')) return json({ data: [{ b64_json: png.toString('base64') }] });
    if (u.endsWith('/audio/speech')) { res.setHeader('Content-Type', 'audio/wav'); return res.end(wav); }
    if (u.endsWith('/audio/transcriptions')) return json({ text: 'Je veux un dragon qui chante' });
    res.statusCode = 404; res.end('{}');
  });
}).listen(9099, () => console.log('mock openai :9099'));
