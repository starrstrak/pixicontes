import { describe, it, expect } from 'vitest';
import { emptyBook, newCharacter, applyMemoryUpdate, compactMemory, narrativeContext, charactersInScene, splitSentences, removeChapter, addNote, type Chapter } from '../src/memory';

const ch = (n: number): Chapter => ({ id: `c${n}`, text: `Texte du chapitre ${n}.`, translation: '', summary: `Résumé ${n}`, imagePrompt: '', image: null, choices: [], chosen: '', kind: 'choice' });

describe('mémoire du livre', () => {
  it('ajoute un nouveau personnage et complète un existant sans écraser la fiche visuelle', () => {
    let b = emptyBook();
    b.characters.push(newCharacter({ name: 'Léo', isHero: true, visual: 'boy, red cap' }));
    b = applyMemoryUpdate(b, { characters: [{ name: 'léo', powers: 'vole', visual: 'CHANGED' }, { name: 'Pixel', appearance: 'petit robot', visual: 'small blue robot' }] });
    expect(b.characters).toHaveLength(2);
    expect(b.characters[0].powers).toBe('vole');
    expect(b.characters[0].visual).toBe('boy, red cap');
    expect(b.characters[1].visual).toBe('small blue robot');
    expect(b.characters[1].isHero).toBe(false);
  });
  it('ne modifie pas le livre d’origine (immutabilité) et limite les événements', () => {
    const b = emptyBook();
    const nb = applyMemoryUpdate(b, { events: Array.from({ length: 30 }, (_, i) => `e${i}`) });
    expect(b.events).toHaveLength(0);
    expect(nb.events).toHaveLength(14);
    expect(nb.events.at(-1)).toBe('e29');
  });
  it('fusionne lieux et objets par nom', () => {
    let b = applyMemoryUpdate(emptyBook(), { places: [{ name: 'Forêt', description: 'sombre' }] });
    b = applyMemoryUpdate(b, { places: [{ name: 'forêt', description: 'enchantée' }, { name: 'Lac', description: '' }] });
    expect(b.places).toEqual([{ name: 'Forêt', description: 'enchantée' }, { name: 'Lac', description: '' }]);
  });
  it('résume les anciens chapitres et garde les 2 derniers en texte complet', () => {
    const b = emptyBook();
    b.chapters = [1, 2, 3, 4, 5].map(ch);
    const { older, recent } = narrativeContext(b);
    expect(older).toContain('Résumé 1');
    expect(older).toContain('Résumé 3');
    expect(older).not.toContain('Résumé 4');
    expect(recent).toContain('Texte du chapitre 4.');
    expect(recent).toContain('Texte du chapitre 5.');
    expect(recent).not.toContain('chapitre 3');
  });
  it('compacte la mémoire avec les notes de changement', () => {
    let b = emptyBook();
    b.characters.push(newCharacter({ name: 'Mia', isHero: true, powers: 'invisible', flaws: 'gourmande' }));
    b = addNote(b, 'Chapitre 1: le dragon est bleu');
    const m = compactMemory(b);
    expect(m).toContain('Mia (héros)');
    expect(m).toContain('invisible');
    expect(m).toContain('le dragon est bleu');
  });
  it('choisit les personnages à illustrer (cités, sinon le héros)', () => {
    const b = emptyBook();
    b.characters = [newCharacter({ name: 'Mia', isHero: true, visual: 'girl' }), newCharacter({ name: 'Zog', visual: 'dragon' }), newCharacter({ name: 'Sans', visual: '' })];
    expect(charactersInScene(b, 'Zog arrive').map((c) => c.name)).toEqual(['Zog']);
    expect(charactersInScene(b, 'Un oiseau chante').map((c) => c.name)).toEqual(['Mia']);
  });
  it('supprime un chapitre', () => {
    const b = emptyBook();
    b.chapters = [ch(1), ch(2)];
    expect(removeChapter(b, 'c1').chapters.map((c) => c.id)).toEqual(['c2']);
  });
  it('découpe en phrases et fusionne les très courtes', () => {
    const s = splitSentences('Oh ! Il était une fois un petit dragon. « Bonjour ! » dit-il.');
    expect(s[0]).toBe('Oh ! Il était une fois un petit dragon.');
    expect(s).toHaveLength(2);
  });
});
