import { describe, it, expect } from 'vitest';
import { localCheck, evaluateModeration, scrubPII } from '../src/moderation';

describe('filtre local', () => {
  it.each([
    ['il faut égorger le loup', 'violence/graphic'],
    ['montre du porno', 'sexual'],
    ['je veux me tuer', 'self-harm'],
    ['mon adresse est rue de la Paix', 'privacy'],
    ['tu es un connard', 'harassment'],
    ['Heil Hitler', 'hate'],
  ])('bloque « %s »', (txt, cat) => {
    expect(localCheck(txt)).toEqual({ flagged: true, category: cat });
  });
  it.each(['le dragon crache du feu', 'le chevalier se bat avec une épée en mousse', 'il marche pieds nus', 'une viole de gambe', 'le pirate cherche le trésor', 'une potion violette'])('laisse passer « %s »', (t) => {
    expect(localCheck(t).flagged).toBe(false);
  });
});

describe('seuils de modération OpenAI', () => {
  const base = { flagged: false, categories: {}, category_scores: {} as Record<string, number> };
  it('tolère une violence légère de conte', () => {
    expect(evaluateModeration({ ...base, category_scores: { violence: 0.4 } }).flagged).toBe(false);
  });
  it('bloque une violence forte', () => {
    expect(evaluateModeration({ ...base, category_scores: { violence: 0.95 } })).toEqual({ flagged: true, category: 'violence' });
  });
  it('bloque dès un faible score sexuel, de haine ou d’automutilation', () => {
    expect(evaluateModeration({ ...base, category_scores: { sexual: 0.15 } }).flagged).toBe(true);
    expect(evaluateModeration({ ...base, category_scores: { 'sexual/minors': 0.02 } }).flagged).toBe(true);
    expect(evaluateModeration({ ...base, category_scores: { hate: 0.3 } }).flagged).toBe(true);
    expect(evaluateModeration({ ...base, category_scores: { 'self-harm': 0.2 } }).flagged).toBe(true);
  });
  it('ne signale rien quand tout est bas', () => {
    expect(evaluateModeration({ ...base, category_scores: { sexual: 0.001, violence: 0.1, hate: 0.0 } }).flagged).toBe(false);
  });
});

describe('données personnelles', () => {
  it('retire liens, e-mails et téléphones', () => {
    const out = scrubPII('écris à jean@exemple.ch ou va sur https://x.com ou appelle +41 79 123 45 67 pour Léo');
    expect(out).not.toMatch(/@|https?|123/);
    expect(out).toContain('Léo');
  });
  it('limite la longueur', () => {
    expect(scrubPII('a'.repeat(1000)).length).toBe(400);
  });
});
