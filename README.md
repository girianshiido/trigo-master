# Trigo Master

Jeu de trigonométrie en TypeScript, jouable sur téléphone, tablette et ordinateur.

**Jouer : https://girianshiido.github.io/trigo-master/**

## Le premier mode : Série

Choisissez de **5 à 40 questions**, puis touchez le point correspondant à l’angle proposé. Il y a exactement **16 points** : la réunion des multiples de π/4 et de π/6, sans doublons.

- Bonne réponse : passage immédiat à la question suivante.
- Erreur : le point correct et son rayon apparaissent pendant **500 ms**, puis la série continue.
- Les angles fractionnaires commencent entre −π et π. Leur valeur absolue gagne un intervalle de longueur π toutes les trois bonnes réponses.
- Dès la deuxième question, puis une question sur quatre, un grand multiple entier de π (jusqu’à ±100π) permet de travailler la parité, quel que soit le palier.
- Toutes les fractions affichées sont **irréductibles**.
- Le bilan indique les réussites, le temps moyen et les points à revoir.
- Le bouton **?** ouvre une aide avec les angles remarquables. Aucun chronomètre de jeu ni autre mode pour cette première version.

Le repère est orthonormé. Le cercle est centré en O, de rayon 1. Les six droites y=x, y=−x, y=±1/2 et x=±1/2 sont tracées en pointillés.

## Développement

Node.js 22 ou ultérieur.

```sh
npm install
npm run dev
npm test
npm run build
```

Le code du moteur se trouve dans `src/engine.ts`, l’interface dans `src/main.ts` et les styles dans `src/style.css`. Le calcul des angles utilise des entiers en unités de π/12, sans comparer de nombres flottants.

Le script `scripts/browser-qa.mjs` vérifie sept tailles d’écran et les interactions tactiles, dont le centrage et la forme ronde des seize points. Il nécessite Playwright et Chromium. Les variables `PLAYWRIGHT_MODULE`, `TRIGO_CHROME` et `TRIGO_QA_URL` permettent de désigner une installation et une URL existantes.

Les polices DM Sans et Manrope sont servies localement ; leurs licences SIL Open Font License sont dans `public/fonts/`. Le jeu ne dépend d’aucun service externe pour fonctionner après chargement.

## GitHub Pages

`npm run build` produit le site statique dans `docs/`, avec des chemins relatifs. GitHub Pages peut publier la branche `main`, dossier `/docs`. Le fichier `.nojekyll` désactive le traitement Jekyll. Aucun serveur applicatif ni compte utilisateur n’est nécessaire.
