# 🎮 Naru Gaming Command

Bot Discord communautaire multi-gaming.

## Structure

```text
naru-gaming-command/
├── index.js
├── package.json
├── .gitignore
├── .env.example
├── data/
│   └── .gitkeep
└── modules/
    ├── ark/
    │   ├── config.js
    │   └── ark-updates.js
    └── gta/
        ├── config.js
        └── gta-updates.js
```

## 🦖 ARK Updates

Salon Discord : `1546773481587216425`

- ARK: Survival Ascended
- PC
- Xbox
- PlayStation
- Serveurs
- Traduction française
- Classement des notes de patch par catégories
- Vérification toutes les 15 minutes
- Anti-doublon dans `data/ark-update-state.json`
- Migration automatique de l'ancien `ark-update-state.json`

## 🌴 GTA Updates

Salon Discord : `1546773502336442420`

- Grand Theft Auto V
- GTA Online
- GTA VI exclu
- Rockstar Games Newswire officiel
- Version française Rockstar prioritaire
- Traduction automatique en secours
- Image officielle dans l'embed quand elle est disponible
- Vérification toutes les 15 minutes
- Anti-doublon dans `data/gta-update-state.json`
- Au premier lancement, mémorise la dernière actu sans la publier

## Installation

```bash
npm install
```

Définir ensuite la variable d'environnement :

```text
DISCORD_TOKEN=...
```

Puis :

```bash
npm start
```

## Vérification syntaxique

```bash
npm run check
```

Les fichiers d'état dans `data/` sont créés automatiquement et ne doivent pas être commit sur GitHub.
