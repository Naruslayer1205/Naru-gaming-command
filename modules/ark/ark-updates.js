const {
  EmbedBuilder
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const config = require('./config');

let checking = false;
let interval = null;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; NaruGamingCommand/3.0)',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} sur ${url}`);
  }

  return await response.text();
}

function decodeHtml(text = '') {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#x27;/gi, "'")
    .replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”');
}

function stripHtml(html = '') {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\r/g, '')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanLine(line = '') {
  return line
    .replace(/^\s*[-–—•]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureDataFolder() {
  fs.mkdirSync(
    path.dirname(config.stateFile),
    { recursive: true }
  );
}

function defaultState() {
  return {
    platforms: {},
    translations: {}
  };
}

function loadState() {
  ensureDataFolder();

  let sourceFile = config.stateFile;

  // Migration transparente de l'ancien fichier placé à la racine.
  if (
    !fs.existsSync(sourceFile) &&
    fs.existsSync(config.legacyStateFile)
  ) {
    try {
      fs.copyFileSync(
        config.legacyStateFile,
        config.stateFile
      );

      console.log(
        '♻️ ARK : ancien fichier d’état migré vers data/ark-update-state.json'
      );
    } catch (error) {
      console.log(
        `⚠️ ARK : migration de l’état impossible : ${error.message}`
      );

      sourceFile = config.legacyStateFile;
    }
  }

  if (!fs.existsSync(sourceFile)) {
    return defaultState();
  }

  try {
    const oldState = JSON.parse(
      fs.readFileSync(sourceFile, 'utf8')
    );

    const state = defaultState();

    if (oldState.platforms) {
      state.platforms = oldState.platforms;
    }

    if (oldState.translations) {
      state.translations = oldState.translations;
    }

    // Compatibilité avec une ancienne version qui ne stockait que lastVersion.
    if (
      oldState.lastVersion &&
      !state.platforms.pc
    ) {
      state.platforms.pc = oldState.lastVersion;
    }

    return state;
  } catch (error) {
    console.log(
      `⚠️ ARK : impossible de lire l’état : ${error.message}`
    );

    return defaultState();
  }
}

function saveState(state) {
  ensureDataFolder();

  try {
    fs.writeFileSync(
      config.stateFile,
      JSON.stringify(state, null, 2)
    );
  } catch (error) {
    console.log(
      `⚠️ ARK : impossible de sauvegarder l’état : ${error.message}`
    );
  }
}

function extractPatchContent(html) {
  const text = stripHtml(html);

  const versionRegex =
    /(?:^|\n)\s*v?(\d{2,}(?:\.\d+)*)\s*[-–—]\s*([^\n]+)/gim;

  const versions = [
    ...text.matchAll(versionRegex)
  ];

  if (versions.length === 0) {
    return null;
  }

  const latest = versions[0];
  const version = latest[1];
  const header = latest[2].trim();

  const start =
    latest.index + latest[0].length;

  const end =
    versions.length > 1
      ? versions[1].index
      : text.length;

  let notes = text
    .slice(start, end)
    .split('\n')
    .map(cleanLine)
    .filter(Boolean);

  notes = notes.filter(line => {
    const lower = line.toLowerCase();

    const ignoredExact = [
      'share',
      'followers'
    ];

    if (ignoredExact.includes(lower)) {
      return false;
    }

    const ignoredParts = [
      'recommended posts',
      'more sharing options',
      'reply to this topic',
      'create an account',
      'sign in'
    ];

    if (
      ignoredParts.some(item =>
        lower.includes(item)
      )
    ) {
      return false;
    }

    if (lower.startsWith('posted ')) {
      return false;
    }

    return true;
  });

  const dateMatch = header.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})/
  );

  const date =
    dateMatch
      ? dateMatch[1]
      : 'Non précisée';

  let type = header;

  if (dateMatch) {
    type = type.replace(dateMatch[0], '');
  }

  type = type
    .replace(/^[-–—\s]+/, '')
    .replace(/[-–—\s]+$/, '')
    .trim();

  return {
    version,
    date,
    type: type || 'Mise à jour ARK',
    notes
  };
}

function utf8Length(text) {
  return Buffer.byteLength(text, 'utf8');
}

function splitTranslationText(
  text,
  maxBytes = 430
) {
  if (utf8Length(text) <= maxBytes) {
    return [text];
  }

  const words = text.split(' ');
  const parts = [];
  let current = '';

  for (const word of words) {
    const test =
      current
        ? `${current} ${word}`
        : word;

    if (utf8Length(test) > maxBytes) {
      if (current) {
        parts.push(current);
      }

      current = word;
    } else {
      current = test;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

async function translateChunk(text) {
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    '&langpair=en%7Cfr';

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'NaruGamingCommand/3.0'
    }
  });

  if (!response.ok) {
    throw new Error(
      `Traduction HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (
    data &&
    data.responseData &&
    data.responseData.translatedText
  ) {
    return decodeHtml(
      data.responseData.translatedText
    );
  }

  return text;
}

async function translateText(
  text,
  state
) {
  if (!text) {
    return text;
  }

  if (state.translations[text]) {
    return state.translations[text];
  }

  try {
    const chunks =
      splitTranslationText(text);

    const translatedParts = [];

    for (const chunk of chunks) {
      const translated =
        await translateChunk(chunk);

      translatedParts.push(translated);

      // Évite de bombarder l’API de traduction.
      await wait(350);
    }

    const translated =
      translatedParts.join(' ').trim();

    state.translations[text] = translated;

    return translated;
  } catch (error) {
    console.log(
      `⚠️ ARK traduction impossible : ${error.message}`
    );

    return text;
  }
}

async function translatePatch(
  patch,
  state
) {
  console.log(
    `🇫🇷 ARK : traduction de v${patch.version}...`
  );

  const translatedNotes = [];

  for (
    let i = 0;
    i < patch.notes.length;
    i++
  ) {
    translatedNotes.push(
      await translateText(
        patch.notes[i],
        state
      )
    );

    console.log(
      `🇫🇷 ARK : traduction ${i + 1}/${patch.notes.length}`
    );
  }

  return {
    ...patch,
    type: await translateText(
      patch.type,
      state
    ),
    notes: translatedNotes
  };
}

function categorizeNotes(notes) {
  const categories = {
    '🆕 Nouveautés': [],
    '🦖 Créatures': [],
    '🚢 Navires': [],
    '🏗️ Construction': [],
    '⚔️ Gameplay': [],
    '🗺️ Cartes & environnements': [],
    '⚙️ Performances & stabilité': [],
    '🔒 Exploits & sécurité': [],
    '🐛 Corrections': [],
    '🛠️ Autres modifications': []
  };

  for (const note of notes) {
    const lower = note.toLowerCase();

    if (
      lower.startsWith('ajout') ||
      lower.startsWith('nouveau') ||
      lower.includes('a été ajouté') ||
      lower.includes('ajouté')
    ) {
      categories['🆕 Nouveautés'].push(note);
      continue;
    }

    if (
      lower.includes('exploit') ||
      lower.includes('duplication') ||
      lower.includes('hack') ||
      lower.includes('sécurité')
    ) {
      categories['🔒 Exploits & sécurité'].push(note);
      continue;
    }

    if (
      lower.includes('crash') ||
      lower.includes('performance') ||
      lower.includes('stabilité') ||
      lower.includes('fps') ||
      lower.includes('mémoire') ||
      lower.includes('optimis')
    ) {
      categories['⚙️ Performances & stabilité'].push(note);
      continue;
    }

    if (
      lower.includes('navire') ||
      lower.includes('bateau') ||
      lower.includes('radeau') ||
      lower.includes('ship') ||
      lower.includes('galion') ||
      lower.includes('trirème') ||
      lower.includes('chantier naval')
    ) {
      categories['🚢 Navires'].push(note);
      continue;
    }

    if (
      lower.includes('créature') ||
      lower.includes('dinosaure') ||
      lower.includes('dino') ||
      lower.includes('apprivois') ||
      lower.includes('astrocetus') ||
      lower.includes('bloodstalker') ||
      lower.includes('wyvern') ||
      lower.includes('rex') ||
      lower.includes('raptor') ||
      lower.includes('basilosaurus') ||
      lower.includes('pyromane') ||
      lower.includes('deinonychus') ||
      lower.includes('magmasaur')
    ) {
      categories['🦖 Créatures'].push(note);
      continue;
    }

    if (
      lower.includes('structure') ||
      lower.includes('construction') ||
      lower.includes('fondation') ||
      lower.includes('mur') ||
      lower.includes('porte') ||
      lower.includes('tourelle') ||
      lower.includes('stockage')
    ) {
      categories['🏗️ Construction'].push(note);
      continue;
    }

    if (
      lower.includes('astraeos') ||
      lower.includes('genesis') ||
      lower.includes('valguero') ||
      lower.includes('aberration') ||
      lower.includes('extinction') ||
      lower.includes('ragnarok') ||
      lower.includes('carte') ||
      lower.includes('grotte') ||
      lower.includes('cave') ||
      lower.includes('biome')
    ) {
      categories['🗺️ Cartes & environnements'].push(note);
      continue;
    }

    if (
      lower.includes('joueur') ||
      lower.includes('inventaire') ||
      lower.includes('fabrication') ||
      lower.includes('objet') ||
      lower.includes('arme') ||
      lower.includes('armure') ||
      lower.includes('mission') ||
      lower.includes('hud') ||
      lower.includes('companion') ||
      lower.includes('compagnon')
    ) {
      categories['⚔️ Gameplay'].push(note);
      continue;
    }

    if (
      lower.includes('corrig') ||
      lower.includes('correction') ||
      lower.includes('problème') ||
      lower.includes('résolu')
    ) {
      categories['🐛 Corrections'].push(note);
      continue;
    }

    categories['🛠️ Autres modifications'].push(note);
  }

  return categories;
}

function buildPatchText(patch) {
  const categories =
    categorizeNotes(patch.notes);

  let text = '';

  for (
    const [category, notes]
    of Object.entries(categories)
  ) {
    if (notes.length === 0) {
      continue;
    }

    text += `### ${category}\n`;

    for (const note of notes) {
      text += `• ${note}\n`;
    }

    text += '\n';
  }

  return (
    text.trim() ||
    'Aucun détail supplémentaire communiqué par Studio Wildcard.'
  );
}

function splitDiscordText(
  text,
  maxLength = 3700
) {
  const parts = [];
  let current = '';

  for (const line of text.split('\n')) {
    if (
      current.length +
      line.length +
      1 >
      maxLength
    ) {
      if (current.trim()) {
        parts.push(current.trim());
      }

      current = '';
    }

    current += `${line}\n`;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function createArkEmbed(
  platform,
  patch,
  description,
  part,
  totalParts
) {
  const first = part === 1;

  const embed = new EmbedBuilder()
    .setColor(config.color)
    .setURL(platform.url)
    .setFooter({
      text:
        `🦖 Naru Gaming Command • ARK Updates • ${platform.name}` +
        (
          totalParts > 1
            ? ` • ${part}/${totalParts}`
            : ''
        )
    });

  if (first) {
    embed
      .setAuthor({
        name:
          'ARK: SURVIVAL ASCENDED • PATCH NOTES'
      })
      .setTitle(
        `${platform.emoji} MISE À JOUR ${platform.name.toUpperCase()} • v${patch.version}`
      )
      .setDescription(description)
      .addFields(
        {
          name: '🦖 Jeu',
          value: 'ARK: Survival Ascended',
          inline: true
        },
        {
          name: `${platform.emoji} Plateforme`,
          value: platform.name,
          inline: true
        },
        {
          name: '🔢 Version',
          value: `v${patch.version}`,
          inline: true
        },
        {
          name: '📅 Date',
          value: patch.date,
          inline: true
        },
        {
          name: '🛠️ Type de mise à jour',
          value: patch.type,
          inline: false
        },
        {
          name: '🌿 Source officielle',
          value:
            `[Studio Wildcard — SurviveTheARK](${platform.url})`,
          inline: false
        }
      )
      .setTimestamp();
  } else {
    embed
      .setTitle(
        `🦖 ${platform.name} • v${patch.version} • Partie ${part}/${totalParts}`
      )
      .setDescription(description);
  }

  return embed;
}

async function publishPatch(
  channel,
  platform,
  patch
) {
  const parts =
    splitDiscordText(
      buildPatchText(patch)
    );

  for (
    let i = 0;
    i < parts.length;
    i++
  ) {
    await channel.send({
      embeds: [
        createArkEmbed(
          platform,
          patch,
          parts[i],
          i + 1,
          parts.length
        )
      ]
    });

    await wait(750);
  }
}

async function checkPlatform(
  platformKey,
  platform,
  channel,
  state
) {
  console.log(
    `🔎 ARK ${platform.name} : vérification...`
  );

  const html =
    await fetchPage(platform.url);

  const patch =
    extractPatchContent(html);

  if (!patch) {
    console.log(
      `❌ ARK ${platform.name} : aucune version détectée.`
    );
    return;
  }

  console.log(
    `🦖 ARK ${platform.name} : v${patch.version} • ${patch.notes.length} modification(s)`
  );

  const previousVersion =
    state.platforms[platformKey];

  if (
    previousVersion === patch.version
  ) {
    console.log(
      `✅ ARK ${platform.name} v${patch.version} déjà publiée.`
    );
    return;
  }

  console.log(
    `🆕 ARK ${platform.name} : nouvelle version v${patch.version}`
  );

  const frenchPatch =
    await translatePatch(
      patch,
      state
    );

  await publishPatch(
    channel,
    platform,
    frenchPatch
  );

  state.platforms[platformKey] =
    patch.version;

  saveState(state);

  console.log(
    `📢 ARK ${platform.name} v${patch.version} publiée !`
  );
}

async function checkArkUpdates(client) {
  if (checking) {
    console.log(
      '⏳ ARK : une vérification est déjà en cours.'
    );
    return;
  }

  checking = true;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🦖 ARK UPDATES • Vérification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const channel =
      await client.channels.fetch(
        config.channelId
      );

    if (
      !channel ||
      !channel.isTextBased()
    ) {
      console.log(
        `❌ ARK : salon ${config.channelId} introuvable.`
      );
      return;
    }

    const state = loadState();

    for (
      const [key, platform]
      of Object.entries(config.platforms)
    ) {
      try {
        await checkPlatform(
          key,
          platform,
          channel,
          state
        );
      } catch (error) {
        console.log(
          `❌ ARK ${platform.name} : ${error.message}`
        );
      }

      await wait(1500);
    }

    saveState(state);

    console.log(
      '✅ ARK : vérification terminée.'
    );
  } catch (error) {
    console.error(
      '❌ Erreur ARK :',
      error.message
    );
  } finally {
    checking = false;
  }
}

function startArkUpdates(client) {
  console.log(
    '🦖 Module ARK Updates chargé.'
  );

  // Immédiatement au démarrage.
  checkArkUpdates(client);

  // Puis toutes les 15 minutes.
  if (!interval) {
    interval = setInterval(
      () => checkArkUpdates(client),
      config.checkInterval
    );
  }
}

module.exports = startArkUpdates;
