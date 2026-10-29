# Coûts estimés

> ⚠️ **Tarifs à vérifier.** Lors de la conception, les pages officielles d'OpenAI (platform.openai.com / developers.openai.com) n'étaient pas joignables depuis l'environnement de développement. Les tarifs ci-dessous viennent de sources tierces (agrégateurs de prix) et de mes connaissances ; ils sont **tous modifiables dans Admin → Coûts → Tarifs** et le plafond mensuel s'appuie dessus. Vérifiez-les sur la page de tarifs d'OpenAI avant de vous fier aux chiffres, et ajustez-les si besoin.

## Modèles par défaut (les moins chers répondant au besoin)

| Rôle | Modèle par défaut | Tarif retenu | Alternative |
|---|---|---|---|
| Texte (histoire, dictionnaire) | `gpt-5-nano` | 0,05 $ / M tokens entrée, 0,40 $ / M sortie | `gpt-4.1-nano`, `gpt-4o-mini`, `gpt-5-mini` (meilleure écriture, ~5× plus cher) |
| Voix | `gpt-4o-mini-tts` | ≈ 0,015 $ / minute audio | `tts-1` (pas d'instructions de style) |
| Transcription | `gpt-4o-mini-transcribe` | ≈ 0,003 $ / minute | `whisper-1` |
| Image | `gpt-image-1-mini`, qualité *low*, 1024×1024 | ≈ 0,005 $ / image (*medium* ≈ 0,011 $) | `gpt-image-1` (≈ 2 à 4× plus cher) |
| Modération | `omni-moderation-latest` | gratuit | — |

## Histoire type : 6 chapitres, voix et images

Hypothèses : chapitres de ~120 mots, ~2 000 tokens d'entrée (consigne + livre + résumés + 2 derniers chapitres) et ~700 tokens de sortie par chapitre, une image par chapitre, chaque chapitre écouté une fois (~47 s), 10 phrases dictées (~8 s chacune), 10 mots du dictionnaire.

| Poste | Calcul | USD |
|---|---|---|
| Texte | 6 × (2 000 × 0,05 + 700 × 0,40) / 1 M | 0,002 |
| Images (low) | 6 × 0,005 | 0,030 |
| Voix | 6 × 0,78 min × 0,015 | 0,070 |
| Transcription | 1,3 min × 0,003 | 0,004 |
| Dictionnaire | 10 × ~0,0001 | 0,001 |
| Modération | gratuite | 0 |
| **Total** | | **≈ 0,11 USD ≈ 0,09 CHF** (à 0,80 CHF/USD) |

Variantes : sans voix ≈ 0,04 USD ; sans images ≈ 0,08 USD ; texte seul ≈ 0,01 USD ; images *medium* ≈ 0,15 USD. Avec le plafond par défaut de **5 USD/mois**, cela représente de l'ordre de 45 histoires complètes.

## Où ça économise
- **Cache audio** : un texte déjà synthétisé avec la même voix/style n'est jamais regénéré (la vitesse est appliquée par le lecteur, donc changer de vitesse ne coûte rien). Réécouter une histoire = 0 $.
- **Cache dictionnaire** : un mot n'est expliqué qu'une fois par langue.
- **Contexte minimal** : les anciens chapitres sont réduits à une phrase de résumé (produite en même temps que le chapitre, sans appel supplémentaire) ; seuls les 2 derniers sont envoyés en entier.
- **Une seule requête par chapitre** : texte, mémoire, 3 propositions et prompt d'image sortent d'un seul JSON.
- **Silence** : un enregistrement vide n'est pas envoyé à la transcription.
- **Réglages** : images « par moments importants » ou désactivées, régénération d'image limitée par jour, plafonds quotidiens (chapitres, images, caractères de voix) et plafond mensuel **bloquant**.
