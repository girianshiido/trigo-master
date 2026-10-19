# Trigo Master

**Jouer : https://girianshiido.github.io/trigo-master/**

Jeu de trigonométrie en TypeScript, conçu pour téléphone, tablette et ordinateur. Une ambiance d’observatoire, un logo vectoriel original, des retours immédiats et sept motifs sonores mélodieux en OGG avec alternative AAC.

## Aventures et grades

Une nouvelle partie commence au grade **Débutant**. Chaque sauvegarde possède son nom, son parcours, ses succès, ses compteurs et son aide. Aucun nombre maximal de sauvegardes n’est imposé ; l’espace disponible dépend de l’appareil.

| Épreuve | Questions sans faute | Points actifs | Guides |
|---|---:|---:|---|
| Multiples de π | 10 | 2 | Aucun |
| Multiples de π/2 | 8 | 4 | Aucun |
| Multiples de π/3 | 8 | 6 | x = ±1/2 |
| Multiples de π/6 | 10 | 12 | x = ±1/2, y = ±1/2 |
| Multiples de π/4 | 10 | 8 | Repères x = ±1/2 et y = ±1/2 conservés, plus y = x et y = −x |
| π/4 et π/6 réunis | 12 | 16 | Tous les précédents |
| Grands angles | 20 | 16 | Tous |
| Épreuve de Maître | 40 | 16 | Tous |
| Épreuve rapide sur π/12 | 40, moyenne ≤ 5 s | 24 | Aucun nouveau guide |

Les grades sont **Débutant, Apprenti, Initié, Pratiquant, Confirmé, Expert, Maître et Grand Maître**. Les succès des premiers paliers entraînent automatiquement le passage au suivant. Une erreur affiche la correction pendant 500 ms, conserve le grade acquis et oblige à retenter la série pour progresser.

Les grands multiples entiers de π, positifs ou négatifs jusqu’à ±100π, apparaissent dès le début. Leur parité est accessible immédiatement. Toutes les fractions sont irréductibles. Les fractions plus grandes apparaissent dans les paliers avancés.

L’aide est cumulative : 2, 4, 8, 12, 16, puis 24 points connus. Elle ne révèle jamais les points des paliers à venir. Dans l’épreuve courante, les points connus mais hors de la famille étudiée sont désactivés.

## Cosinus & sinus

Le second parcours se débloque en découvrant les seize points.

1. **Lecture** : 20 questions alternant cosinus et sinus, avec quatre valeurs possibles. Les dix premières montrent une projection sur l’axe correspondant.
2. **Équations** : 20 questions demandant tous les points d’une valeur de cosinus ou de sinus. Le premier bon point reste sélectionné ; le second valide automatiquement. Les valeurs ±1 n’ont qu’une solution.

Les deux épreuves demandent un sans-faute. **Grand Maître** exige leur validation ainsi que 40 angles sur π/12 sans erreur, avec une moyenne ≤ 5 s. Les certifications acquises sont conservées, quel que soit l’ordre de réussite.

## Succès et entraînement

31 succès indépendants accompagnent la progression, dont plusieurs accessibles dès le premier palier. Ils comprennent les séries de **10, 25, 50, 100, 200, 500 et 1 000** bonnes réponses, les cumuls, la découverte des points, les angles négatifs, les grands angles fractionnaires et les grades.

**Parité express** demande 10 multiples de π en moins de 10 secondes. **À la vitesse de π** demande 20 en moins de 15 secondes. Les limites sont strictes, contrairement au seuil inclusif de 5 s pour Grand Maître. Les succès de vitesse exigent des réponses consécutives sans pause ; ouvrir l’aide, quitter ou masquer l’application interrompt cette tentative de vitesse.

Sept succès récompensent aussi la vitesse en cosinus/sinus : pour chaque fonction, **5 lectures en moins de 10 s cumulées** puis **10 en moins de 15 s cumulées**. Les temps de lecture du cosinus et du sinus sont comptés séparément au sein de la même épreuve. En mode équation : **5 équations en moins de 20 s**, **10 en moins de 30 s**, puis **20 en moins de 45 s**. Une équation compte une seule fois, après la sélection de tous ses points, avec le temps complet de réponse. Une erreur interrompt la série ; une pause exclut cette épreuve des nouveaux succès de vitesse cosinus/sinus. Les succès déjà acquis restent conservés. Aucun changement de format de sauvegarde n’est nécessaire.

Les paliers déjà débloqués sont rejouables en entraînement, avec des séries de 10, 20, 40 ou 100 questions. Les succès et séries consécutives comptent aussi en entraînement. Seule une erreur remet la série consécutive à zéro, jamais une fermeture ou un changement d’épreuve.

## Sauvegardes

Les parties sont enregistrées dans IndexedDB après chaque réponse et périodiquement pendant les questions. Si ce service du navigateur échoue, le jeu utilise un stockage local de secours avec la même enveloppe chiffrée AES-GCM. Au rétablissement d’IndexedDB, les deux emplacements sont consultés et la copie la plus récente est conservée ; les suppressions restent effectives. Quitter conserve la question, les éventuels points déjà sélectionnés, la progression et le temps de réponse déjà écoulé. Le temps hors de l’application est exclu de la moyenne.

- Créer, charger, renommer et supprimer des parties indépendantes.
- Sauvegardes locales automatiques, sans fonction d’export ou d’import par fichier.
- AES-GCM chiffre et authentifie le contenu, avec un nonce aléatoire et une identité liée à la partie. Les modifications manuelles sont détectées et refusées.
- Le chiffrement côté client décourage l’édition simple ; il ne constitue pas un système anti-triche reposant sur un serveur. La clé reste stable pour conserver la compatibilité des parties existantes.
- Web Locks et une réservation locale protègent la partie contre l’ouverture simultanée dans deux onglets. Un échec interne de Web Locks ne suffit pas à annoncer qu’un autre onglet utilise la partie. La réservation est libérée à la fermeture de la page et expire après deux minutes en cas d’arrêt brutal.

## Installer et jouer hors connexion

Le bouton **Installer le jeu** propose l’installation native lorsque le navigateur le permet. Sur iPhone/iPad, ouvrir le site dans Safari, puis **Partager → Sur l’écran d’accueil → Ajouter**. Sur Android, utiliser l’invite ou le menu **Installer l’application / Ajouter à l’écran d’accueil**.

Le service worker précharge le jeu, les icônes, le logo, les polices et les sons. Après le premier chargement complet, l’application démarre et conserve les parties hors connexion. Les mises à jour attendent une action explicite et enregistrent la partie avant le rechargement.

Le double appui et le pincement sont bloqués dans la page, avec conservation du défilement vertical des menus. Les formulaires utilisent une taille de texte adaptée à iOS. Le cercle tient compte des encoches et de l’indicateur d’accueil.

Les données restent propres au navigateur/application et à l’adresse du site. Aucun transfert par fichier n’est proposé.

## Rendu mathématique et ressources

Fractions, signes moins et parenthèses extensibles sont composés en MathML, avec la police locale STIX Two Math. Les radicaux √2 et √3 utilisent un unique tracé SVG continu, de même épaisseur jusqu’au bout de la barre, avec un espacement adapté au chiffre. Les licences sont dans `public/fonts/`.

Les autres polices, DM Sans et Manrope, sont également locales et sous SIL OFL. Le jeu n’utilise aucun service distant pendant une partie. Le logo est un dessin vectoriel avec des lettres converties en contours.

## Développement et vérification

Node.js 22 ou ultérieur.

```sh
npm install
npm test
npm run build
npm run dev
```

`npm run build` vérifie TypeScript, produit le site dans `docs/` puis génère un cache hors connexion dont la version dépend de tous les fichiers et du code du service worker. GitHub Pages publie `main:/docs`.

- `tests/` : calculs exacts, progression, seuils de vitesse, deux modes, reprise de sélection et protection des sauvegardes.
- `scripts/make-fixtures.ts` : parties chiffrées de test, générées dans le dossier ignoré `test-results/`.
- `scripts/browser-qa.mjs` : sept formats d’écran, parcours réel, aide, sauvegardes locales chiffrées, altération, suppression et Grand Maître.
- `scripts/math-qa.mjs` : dimensions des expressions, parenthèses et radicaux.
- `scripts/audio-qa.mjs` : OGG/AAC, sons de jeu et de succès, préférence et coupure immédiate.
- `scripts/pwa-qa.mjs` : critères d’installation Chromium, cache, reprise hors connexion, pincement et indications iOS simulées.
- `scripts/storage-recovery-qa.mjs` : reproduction des erreurs internes de stockage/verrouillage, démarrage, chiffrement de secours, reprise, exclusion entre onglets, retour à IndexedDB et suppression définitive.

Les scripts de navigateur nécessitent Playwright et Chromium. `PLAYWRIGHT_MODULE`, `TRIGO_CHROME` et `TRIGO_QA_URL` permettent de désigner une installation et une URL existantes. Les essais simulés ne remplacent pas une installation sur un iPhone et un Android physiques.

Régénération facultative : `scripts/generate-sounds.py` utilise Python et FFmpeg ; `scripts/generate-logo.py` utilise fontTools. Aucun de ces outils n’est nécessaire au fonctionnement du site.
