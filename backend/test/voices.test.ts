import { describe, it, expect } from 'vitest';
import { buildInstructions, defaultSpec, specSchema, voiceFor, DEFAULT_PROFILES, BASE_VOICES, TONE_EMOTIONS } from '../src/voices';

describe('voix', () => {
  it('propose 13 voix de base et au moins 16 profils prêts à l’emploi, tous valides', () => {
    expect(BASE_VOICES).toHaveLength(13);
    expect(DEFAULT_PROFILES.length).toBeGreaterThanOrEqual(16);
    for (const p of DEFAULT_PROFILES) expect(specSchema.safeParse(p.spec).success).toBe(true);
    expect(new Set(DEFAULT_PROFILES.map((p) => p.id)).size).toBe(DEFAULT_PROFILES.length);
  });
  it('traduit chaque réglage en consigne d’interprétation', () => {
    const t = buildInstructions(defaultSpec({ pitch: -2, timbre: ['rauque', 'resonant'], emotion: ['mysterieux', 'tendre'], expressiveness: 4, variation: 4, pace: -2, diction: 2, pauses: 2, breath: true, age: 'ancien', accent: 'suisse' }), 'fr');
    for (const w of ['very deep', 'husky', 'resonant', 'mysterious', 'tender', 'theatrical', 'wide dynamic', 'very slow', 'precise articulation', 'dramatic pauses', 'breaths', 'elderly', 'Swiss French']) expect(t).toContain(w);
    expect(t).toContain('never scary'.replace('never', 'Never'));
    expect(t).toMatch(/no robotic/);
  });
  it('est déterministe (cache audio) et dépend de la langue', () => {
    const s = defaultSpec({ voice: 'sage' });
    expect(buildInstructions(s, 'fr')).toBe(buildInstructions(s, 'fr'));
    expect(buildInstructions(s, 'de')).toContain('German');
    expect(buildInstructions(s, 'en')).toContain('English');
  });
  it('borne les valeurs hors limites et refuse une voix inconnue', () => {
    expect(specSchema.safeParse({ pitch: 9 }).success).toBe(false);
    expect(specSchema.safeParse({ voice: 'robot' }).success).toBe(false);
    expect(specSchema.safeParse({ extra: 'x'.repeat(300) }).success).toBe(false);
  });
  it('replie sur une voix compatible avec tts-1', () => {
    expect(voiceFor(defaultSpec({ voice: 'marin' }), 'tts-1')).toBe('coral');
    expect(voiceFor(defaultSpec({ voice: 'marin' }), 'gpt-4o-mini-tts')).toBe('marin');
    expect(voiceFor(defaultSpec({ voice: 'onyx' }), 'tts-1')).toBe('onyx');
  });
  it('les ambiances rapides existent', () => { expect(Object.keys(TONE_EMOTIONS)).toEqual(['calme', 'enjoue', 'mysterieux', 'aventureux']); });
});
