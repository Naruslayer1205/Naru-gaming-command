const {
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ACOLONY_ROLE_ID = process.env.ACOLONY_ROLE_ID || '1548387660517609572';
const CATEGORY_PREFIX = '🏭 AColony — ';
const ACOLONY_DOWNLOAD_URL = process.env.ACOLONY_DOWNLOAD_URL || null;

const CHANNEL_NAMES = {
  colony: '🏠・colonie',
  colonists: '👥・colons',
  storage: '📦・stockage',
  production: '🏭・production',
  research: '🔬・recherche',
  infrastructure: '🧱・infrastructure',
  animals: '🐾・animaux',
  world: '🌦️・monde',
  statistics: '📊・statistiques',
  challenges: '🎯・défis',
  journal: '📜・journal',
  commands: '⚙️・commandes',
  connection: '🔗・connexion',
  help: '🆘・aide'
};

const BUTTON_GENERATE_CODE = 'acolony_generate_link_code';
const BUTTON_RELINK = 'acolony_relink_bridge';

const DATA_FOLDER = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_FOLDER, 'acolony-links.json');

let discordClient = null;
let scanInterval = null;
let interactionListenerStarted = false;
let memberUpdateListenerStarted = false;

const playerStates = new Map();


const ACOLONY_ITEM_NAMES = new Map([
  [256, 'Monnaie'],
  [1000, 'Bois'],
  [1010, 'Vêtements'],
  [1055, 'Graines de plante à huile'],
  [1120, 'Terre'],
  [1121, 'Pierre'],
  [1130, 'Minerai de fer'],
  [1150, 'Acier'],
  [1155, 'Or'],
  [1210, 'Viande'],
  [1250, 'Pommes de terre'],
  [1251, 'Carottes'],
  [1280, 'Repas niv. 1 (viande)'],
  [1281, 'Repas niv. 1 (légumes)'],
  [1282, 'Repas niv. 1 (pain)'],
  [1283, 'Repas niv. 1 (viande humaine)'],
  [1284, 'Repas niv. 2 (viande)'],
  [1285, 'Repas niv. 2 (légumes)'],
  [1286, 'Repas niv. 2 (pain)'],
  [1287, 'Repas niv. 3 (viande)'],
  [1288, 'Repas niv. 3 (légumes)'],
  [1289, 'Repas niv. 3 (pain)'],
  [1295, 'Nourriture animale (végétale)'],
  [1296, 'Nourriture animale (viande)'],
  [1575, 'Jeune arbre'],
  [1650, 'Médicament simple'],
  [9999, 'Batte en bois'],
  [10000, 'Hache'],
  [10005, 'Batte barbelée'],
  [10100, 'Épée'],
  [10105, 'Batte en métal'],
  [10108, 'Hache moderne'],
  [10110, 'Épée moderne'],
  [12000, 'Arc'],
  [12001, 'Arbalète'],
  [12100, 'Pistolet'],
  [12120, 'Fusil à pompe'],
  [12145, 'Arbalète moderne'],
  [13000, 'Bouclier en bois'],
  [13001, 'Bouclier en acier'],
  [13002, 'Bouclier moderne'],
  [25, 'Poulet'],
  [35, 'Mouche'],
  [36, 'Mouche guerrière'],
  [45, 'Abeille'],
  [46, 'Abeille guerrière'],
  [55, 'Mille-pattes'],
  [56, 'Mille-pattes combattant']
]);

const ACOLONY_WEATHER_NAMES = {
  0: '☀️ Ensoleillé',
  1: '🌧️ Pluvieux',
  2: '⛈️ Tempête',
  3: '🌋 Activité volcanique'
};

const ACOLONY_RESEARCH_TYPES = {
  0: 'Science basique',
  1: 'Science moderne',
  2: 'Informatique',
  3: 'Science nucléaire'
};

const DAILY_CHALLENGE_POOLS = {
  easy: [
    { metric: 'treesCut', title: 'Bûcheron du jour', action: 'Couper', unit: 'arbres', target: 10, points: 1 },
    { metric: 'blocksMined', title: 'Petit mineur', action: 'Miner', unit: 'blocs', target: 20, points: 1 },
    { metric: 'plantsSeeded', title: 'Premières cultures', action: 'Planter', unit: 'plantes', target: 8, points: 1 },
    { metric: 'plantsHarvested', title: 'Petite récolte', action: 'Récolter', unit: 'plantes', target: 10, points: 1 },
    { metric: 'buildingsBuilt', title: 'Petit chantier', action: 'Construire', unit: 'structures', target: 3, points: 1 },
    { metric: 'animalsKilled', title: 'Chasse rapide', action: 'Éliminer', unit: 'animaux', target: 2, points: 1 }
  ],
  medium: [
    { metric: 'treesCut', title: 'Exploitation forestière', action: 'Couper', unit: 'arbres', target: 30, points: 2 },
    { metric: 'blocksMined', title: 'Mine active', action: 'Miner', unit: 'blocs', target: 75, points: 2 },
    { metric: 'plantsSeeded', title: 'Agriculteur', action: 'Planter', unit: 'plantes', target: 25, points: 2 },
    { metric: 'plantsHarvested', title: 'Bonne récolte', action: 'Récolter', unit: 'plantes', target: 30, points: 2 },
    { metric: 'buildingsBuilt', title: 'Extension de la colonie', action: 'Construire', unit: 'structures', target: 10, points: 2 },
    { metric: 'animalsButchered', title: 'Boucherie', action: 'Dépecer', unit: 'animaux', target: 6, points: 2 }
  ],
  hard: [
    { metric: 'treesCut', title: 'Déforestation contrôlée', action: 'Couper', unit: 'arbres', target: 75, points: 3 },
    { metric: 'blocksMined', title: 'Mineur acharné', action: 'Miner', unit: 'blocs', target: 200, points: 3 },
    { metric: 'plantsSeeded', title: 'Grand cultivateur', action: 'Planter', unit: 'plantes', target: 60, points: 3 },
    { metric: 'plantsHarvested', title: 'Moisson massive', action: 'Récolter', unit: 'plantes', target: 75, points: 3 },
    { metric: 'buildingsBuilt', title: 'Grand bâtisseur', action: 'Construire', unit: 'structures', target: 25, points: 3 },
    { metric: 'animalsKilled', title: 'Grand chasseur', action: 'Éliminer', unit: 'animaux', target: 20, points: 3 }
  ]
};

function formatFrenchNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n);
}

function getAColonyItemName(id, fallbackName) {
  const numericId = Number(id);
  if (ACOLONY_ITEM_NAMES.has(numericId)) return ACOLONY_ITEM_NAMES.get(numericId);
  if (fallbackName && !/^Objet\s*#/i.test(String(fallbackName))) return String(fallbackName);
  return `Objet #${numericId}`;
}

function translateBuildingName(name) {
  const raw = String(name || '').trim();
  const exact = {
    'Craft': 'Atelier de fabrication',
    'Science': 'Table de recherche',
    'Power Generator': 'Générateur électrique',
    'Power Storage': 'Stockage électrique',
    'Power Cable': 'Câble électrique',
    'Feeder': 'Mangeoire',
    'Animal Cage': 'Cage animale',
    'Cooling': 'Système de refroidissement',
    'Ventilation': 'Ventilation',
    'Sprinkler': 'Arroseur',
    'Pump': 'Pompe',
    'Reactor': 'Réacteur',
    'Disposal': 'Traitement des déchets',
    'Mineral Resource': 'Installation minière'
  };
  if (exact[raw]) return exact[raw];
  for (const [key, value] of Object.entries(exact)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) {
      return raw.replace(new RegExp(key, 'i'), value);
    }
  }
  return raw || 'Installation';
}

function formatDayTime(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Inconnue';
  const normalized = ((n % 1) + 1) % 1;
  const totalMinutes = Math.floor(normalized * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function getParisDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function deterministicIndex(seed, length) {
  if (length <= 0) return 0;
  const hash = crypto.createHash('sha256').update(seed).digest();
  return hash.readUInt32BE(0) % length;
}

function normalizeGameStats(stats) {
  const source = stats && typeof stats === 'object' ? stats : {};
  const keys = [
    'animalsKilled', 'animalsButchered', 'treesCut', 'blocksMined',
    'plantsSeeded', 'plantsHarvested', 'buildingsBuilt'
  ];
  const result = {};
  for (const key of keys) result[key] = Math.max(0, Number(source[key]) || 0);
  return result;
}

function buildDailyChallengeEntries(userId, dateKey) {
  const difficulties = ['easy', 'medium', 'hard'];
  const usedMetrics = new Set();
  const entries = [];

  for (const difficulty of difficulties) {
    const pool = DAILY_CHALLENGE_POOLS[difficulty];
    const start = deterministicIndex(`${dateKey}:${userId}:${difficulty}`, pool.length);
    let selected = pool[start];
    for (let offset = 0; offset < pool.length; offset++) {
      const candidate = pool[(start + offset) % pool.length];
      if (!usedMetrics.has(candidate.metric)) {
        selected = candidate;
        break;
      }
    }
    usedMetrics.add(selected.metric);
    entries.push({ difficulty, ...selected, completed: false, completedAt: null });
  }
  return entries;
}

function updateDailyChallenges(userId, gameStats) {
  if (!gameStats || typeof gameStats !== 'object') return null;

  const current = normalizeGameStats(gameStats);
  const dateKey = getParisDateKey();
  const data = loadData();
  const user = data.users[String(userId)];
  if (!user) return null;

  if (!user.acolonyChallenges || user.acolonyChallenges.date !== dateKey) {
    user.acolonyChallenges = {
      date: dateKey,
      baseline: current,
      entries: buildDailyChallengeEntries(String(userId), dateKey)
    };
  }

  if (!Number.isFinite(Number(user.acolonyChallengePoints))) {
    user.acolonyChallengePoints = 0;
  }

  const baseline = normalizeGameStats(user.acolonyChallenges.baseline);
  let changed = false;

  for (const entry of user.acolonyChallenges.entries) {
    const progress = Math.max(0, (current[entry.metric] || 0) - (baseline[entry.metric] || 0));
    if (!entry.completed && progress >= entry.target) {
      entry.completed = true;
      entry.completedAt = new Date().toISOString();
      user.acolonyChallengePoints += Number(entry.points) || 0;
      changed = true;
    }
  }

  data.users[String(userId)] = user;
  saveData(data);

  return {
    date: dateKey,
    baseline,
    current,
    entries: user.acolonyChallenges.entries,
    totalPoints: user.acolonyChallengePoints,
    newlyCompleted: changed
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_FOLDER)) fs.mkdirSync(DATA_FOLDER, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ users: {} }, null, 2), 'utf8');
  }
}

function loadData() {
  ensureDataFile();
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    if (!data.users || typeof data.users !== 'object') data.users = {};
    return data;
  } catch (error) {
    console.error('❌ AColony : lecture acolony-links.json impossible :', error);
    return { users: {} };
  }
}

function saveData(data) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function randomBlock(length = 4) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[crypto.randomInt(0, chars.length)];
  }
  return result;
}

function generateLinkCode() {
  return `ACOL-${randomBlock(4)}-${randomBlock(4)}`;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function ensureUserData(member) {
  const data = loadData();
  const userId = String(member.id);
  let changed = false;

  if (!data.users[userId]) {
    data.users[userId] = {
      discordUserId: userId,
      linkCode: null,
      linked: false,
      installationId: null,
      tokenHash: null,
      linkedAt: null,
      lastSeenAt: null,
      linkCodeCreatedAt: null,
      linkCodeConsumedAt: null,
      createdAt: new Date().toISOString()
    };
    changed = true;
  }

  const user = data.users[userId];

  if (user.linked && user.linkCode) {
    user.linkCode = null;
    if (!user.linkCodeConsumedAt) user.linkCodeConsumedAt = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    data.users[userId] = user;
    saveData(data);
  }

  return user;
}

function createUserLinkCode(member) {
  let data = loadData();
  const userId = String(member.id);
  let user = data.users[userId];

  if (!user) {
    ensureUserData(member);
    data = loadData();
    user = data.users[userId];
  }

  if (user.linked) return { ok: false, reason: 'ALREADY_LINKED', user };

  user.linkCode = generateLinkCode();
  user.linkCodeCreatedAt = new Date().toISOString();
  user.linkCodeConsumedAt = null;
  data.users[userId] = user;
  saveData(data);

  return { ok: true, user };
}

function createRelinkCode(member) {
  let data = loadData();
  const userId = String(member.id);
  let user = data.users[userId];

  if (!user) {
    ensureUserData(member);
    data = loadData();
    user = data.users[userId];
  }

  // Une reliaison invalide immédiatement l'ancienne installation.
  // Le nouveau code permettra au Bridge réinstallé d'obtenir un nouveau token.
  user.linked = false;
  user.installationId = null;
  user.tokenHash = null;
  user.linkedAt = null;
  user.lastSeenAt = null;
  user.linkCode = generateLinkCode();
  user.linkCodeCreatedAt = new Date().toISOString();
  user.linkCodeConsumedAt = null;

  data.users[userId] = user;
  saveData(data);

  return { ok: true, user };
}

function findUserByCode(code) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;

  const data = loadData();

  for (const [userId, user] of Object.entries(data.users)) {
    if (user.linked || !user.linkCode) continue;
    if (String(user.linkCode).trim().toUpperCase() === normalized) {
      return { data, userId, user };
    }
  }

  return null;
}

function authenticateInstallation(request) {
  const installationId = String(request.headers['x-acolony-installation-id'] || '').trim();
  const authorization = String(request.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(authorization);

  if (!installationId || !match) return null;

  const tokenHash = hashToken(match[1].trim());
  const data = loadData();

  for (const [userId, user] of Object.entries(data.users)) {
    if (!user.linked || !user.installationId || !user.tokenHash) continue;
    if (user.installationId !== installationId) continue;
    if (user.tokenHash !== tokenHash) continue;
    return { data, userId, user };
  }

  return null;
}

function sendJson(response, status, data) {
  if (response.headersSent) return;
  const payload = JSON.stringify(data);

  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-AColony-Installation-Id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });

  response.end(payload);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let finished = false;

    request.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        finished = true;
        reject(new Error('Payload trop volumineux'));
        return;
      }
      body += chunk.toString('utf8');
    });

    request.on('end', () => {
      if (finished) return;
      finished = true;
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON invalide'));
      }
    });

    request.on('error', error => {
      if (finished) return;
      finished = true;
      reject(error);
    });
  });
}

async function findDiscordMember(userId) {
  if (!discordClient) return null;

  for (const guild of discordClient.guilds.cache.values()) {
    const cachedMember = guild.members.cache.get(String(userId));
    if (cachedMember) return { guild, member: cachedMember };

    try {
      const member = await guild.members.fetch(userId);
      if (member) return { guild, member };
    } catch {}
  }

  return null;
}

function findAColonyCategory(guild, member) {
  const categories = guild.channels.cache.filter(
    channel =>
      channel.type === ChannelType.GuildCategory &&
      channel.name.startsWith(CATEGORY_PREFIX)
  );

  const byPermission = categories.find(
    category => category.permissionOverwrites.cache.has(member.id)
  );

  if (byPermission) return byPermission;

  const displayName = member.displayName.toLowerCase();

  return categories.find(
    category => category.name.toLowerCase().includes(displayName)
  ) || null;
}

function findChannel(guild, category, name) {
  return guild.channels.cache.find(
    channel => channel.parentId === category.id && channel.name === name
  ) || null;
}

async function findLinkMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 50 });
    return messages.find(
      message =>
        message.author.id === channel.client.user.id &&
        message.embeds?.[0]?.footer?.text === 'Naru AColony Bridge • Liaison'
    ) || null;
  } catch {
    return null;
  }
}

function buildLinkButtons(user) {
  const row = new ActionRowBuilder();

  if (ACOLONY_DOWNLOAD_URL) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel('Télécharger le Bridge')
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Link)
        .setURL(ACOLONY_DOWNLOAD_URL)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('acolony_download_not_ready')
        .setLabel('Télécharger le Bridge')
        .setEmoji('⬇️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
  }

  if (!user.linked) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_GENERATE_CODE)
        .setLabel(user.linkCode ? 'Regénérer mon code' : 'Générer mon code')
        .setEmoji('🔑')
        .setStyle(ButtonStyle.Primary)
    );
  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(BUTTON_RELINK)
        .setLabel('Relier le Bridge')
        .setEmoji('🔄')
        .setStyle(ButtonStyle.Primary)
    );
  }

  return [row];
}

async function updateLinkPanel(member, category) {
  const channel = findChannel(member.guild, category, CHANNEL_NAMES.connection);
  if (!channel) return false;

  const user = ensureUserData(member);
  let description;

  if (user.linked) {
    description = [
      `Bienvenue <@${member.id}>.`,
      '',
      'Ton installation **AColony** est connectée à ton espace personnel Naru Gaming Command.',
      '',
      '### 🔐 Code de liaison',
      '`••••-••••-••••`',
      '',
      '🟢 **Statut : LIÉ**',
      '',
      '🔒 Le code utilisé pour effectuer la liaison a été **détruit et désactivé**.',
      'Une ancienne capture de ce code ne permet plus de connecter une autre installation.',
      '',
      `💻 **Installation :** \`${user.installationId || '?'}\``,
      `🕒 **Dernière connexion :** ${
        user.lastSeenAt
          ? `<t:${Math.floor(new Date(user.lastSeenAt).getTime() / 1000)}:R>`
          : 'En attente'
      }`,
      '',
      '✅ **La configuration est terminée.**',
      '',
      'Lorsque AColony sera lancé, Naru AColony Bridge pourra synchroniser automatiquement les données de ta colonie.',
      '',
      '⚠️ En cas de changement de PC, de réinstallation ou de perte de configuration, utilise le bouton **Relier le Bridge** ci-dessous.'
    ].join('\n');
  } else if (user.linkCode) {
    description = [
      `Bienvenue <@${member.id}>.`,
      '',
      'Tu as commencé la configuration de **Naru AColony Bridge**.',
      '',
      '### 1️⃣ Télécharger le Bridge',
      'Utilise le bouton **Télécharger le Bridge** ci-dessous et installe-le sur ton PC.',
      '',
      '### 2️⃣ Ton code de liaison',
      `\`${user.linkCode}\``,
      '',
      '🟡 **Statut : CODE GÉNÉRÉ — EN ATTENTE DE LIAISON**',
      '',
      '### 3️⃣ Dans Naru AColony Bridge',
      'Lance le programme puis entre le code affiché ci-dessus.',
      '',
      'Dès que la liaison est validée :',
      '• le code sera immédiatement désactivé ;',
      '• ton installation sera associée à ton Discord ;',
      '• le véritable token de connexion sera enregistré automatiquement.',
      '',
      '⚠️ **Ne partage pas ce code.**',
      '',
      'Si nécessaire, tu peux utiliser **Regénérer mon code**. L’ancien code deviendra immédiatement invalide.'
    ].join('\n');
  } else {
    description = [
      `Bienvenue <@${member.id}>.`,
      '',
      'Ce salon permet de connecter **AColony** à ton espace personnel Naru Gaming Command.',
      '',
      '## 📥 Installation',
      '',
      '**1.** Clique sur **Télécharger le Bridge**.',
      '',
      '**2.** Installe **Naru AColony Bridge** sur ton PC.',
      '',
      '**3.** Reviens ici puis clique sur **Générer mon code**.',
      '',
      '**4.** Lance Naru AColony Bridge et entre le code personnel qui apparaîtra ici.',
      '',
      '**5.** Clique sur **Lier mon Discord** dans l’application.',
      '',
      'Une fois la liaison terminée, tu n’auras plus besoin de saisir de code.',
      '',
      '⚪ **Statut : NON LIÉ**',
      '',
      '🔐 Aucun code de liaison n’a encore été généré.'
    ].join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle('🔗 Connexion AColony')
    .setColor(user.linked ? 0x57F287 : (user.linkCode ? 0xFEE75C : 0x5865F2))
    .setDescription(description)
    .setFooter({ text: 'Naru AColony Bridge • Liaison' })
    .setTimestamp();

  const components = buildLinkButtons(user);
  const oldMessage = await findLinkMessage(channel);

  if (oldMessage) {
    await oldMessage.edit({ content: null, embeds: [embed], components });
  } else {
    await channel.send({ embeds: [embed], components });
  }

  return true;
}

async function handleGenerateCodeButton(interaction) {
  if (!interaction.inGuild()) return;

  const member = interaction.member;
  if (!member) return;

  if (!member.roles.cache.has(ACOLONY_ROLE_ID)) {
    await interaction.reply({ content: '❌ Tu ne possèdes pas le rôle AColony.', ephemeral: true });
    return;
  }

  const category = findAColonyCategory(interaction.guild, member);
  if (!category) {
    await interaction.reply({ content: '❌ Ton espace personnel AColony est introuvable.', ephemeral: true });
    return;
  }

  const connectionChannel = findChannel(
    interaction.guild,
    category,
    CHANNEL_NAMES.connection
  );

  if (!connectionChannel || interaction.channelId !== connectionChannel.id) {
    await interaction.reply({
      content: '❌ Ce bouton ne peut être utilisé que dans ton espace AColony personnel.',
      ephemeral: true
    });
    return;
  }

  const current = ensureUserData(member);

  if (current.linked) {
    await interaction.reply({ content: '✅ Ton installation AColony est déjà liée.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const result = createUserLinkCode(member);

  if (!result.ok) {
    await interaction.editReply({ content: '❌ Impossible de générer le code.' });
    return;
  }

  await updateLinkPanel(member, category);

  await interaction.editReply({
    content: [
      '🔑 **Ton code de liaison a été généré.**',
      '',
      `Code : \`${result.user.linkCode}\``,
      '',
      'Entre maintenant ce code dans **Naru AColony Bridge**.',
      '',
      '⚠️ Ne partage pas ce code.'
    ].join('\n')
  });

  console.log(`🔑 Code AColony généré pour ${member.user.tag}`);
}

async function handleRelinkButton(interaction) {
  if (!interaction.inGuild()) return;

  const member = interaction.member;
  if (!member) return;

  if (!member.roles.cache.has(ACOLONY_ROLE_ID)) {
    await interaction.reply({ content: '❌ Tu ne possèdes pas le rôle AColony.', ephemeral: true });
    return;
  }

  const category = findAColonyCategory(interaction.guild, member);
  if (!category) {
    await interaction.reply({ content: '❌ Ton espace personnel AColony est introuvable.', ephemeral: true });
    return;
  }

  const connectionChannel = findChannel(
    interaction.guild,
    category,
    CHANNEL_NAMES.connection
  );

  if (!connectionChannel || interaction.channelId !== connectionChannel.id) {
    await interaction.reply({
      content: '❌ Ce bouton ne peut être utilisé que dans ton espace AColony personnel.',
      ephemeral: true
    });
    return;
  }

  const current = ensureUserData(member);

  if (!current.linked) {
    await interaction.reply({
      content: 'ℹ️ Ton Bridge n’est plus marqué comme lié. Utilise **Générer mon code**.',
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const result = createRelinkCode(member);

  await updateLinkPanel(member, category);

  await interaction.editReply({
    content: [
      '🔄 **Nouvelle liaison AColony créée.**',
      '',
      `Code : \`${result.user.linkCode}\``,
      '',
      'L’ancienne installation a été désactivée.',
      'Ouvre maintenant **Naru AColony Bridge**, entre ce code puis clique sur **Lier mon Discord**.',
      '',
      '⚠️ Ne partage pas ce code.'
    ].join('\n')
  });

  console.log(`🔄 Reliaison AColony demandée pour ${member.user.tag}`);
}

function startInteractionListener(client) {
  if (interactionListenerStarted) return;
  interactionListenerStarted = true;

  client.on('interactionCreate', async interaction => {
    try {
      if (!interaction.isButton()) return;

      if (interaction.customId === BUTTON_GENERATE_CODE) {
        await handleGenerateCodeButton(interaction);
        return;
      }

      if (interaction.customId === BUTTON_RELINK) {
        await handleRelinkButton(interaction);
        return;
      }
    } catch (error) {
      console.error('❌ AColony : erreur bouton liaison :', error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: '❌ Une erreur est survenue pendant la génération du code.'
          });
        } else {
          await interaction.reply({
            content: '❌ Une erreur est survenue pendant la génération du code.',
            ephemeral: true
          });
        }
      } catch {}
    }
  });
}

async function syncLinkPanels() {
  if (!discordClient) return;

  for (const guild of discordClient.guilds.cache.values()) {
    const members = guild.members.cache;

    console.log(
      `🏭 AColony : vérification de ${members.size} membre(s) en cache sur ${guild.name}`
    );

    for (const member of members.values()) {
      if (member.user?.bot) continue;
      if (!member.roles.cache.has(ACOLONY_ROLE_ID)) continue;

      const category = findAColonyCategory(guild, member);
      if (!category) continue;

      try {
        await updateLinkPanel(member, category);
      } catch (error) {
        console.error(
          `❌ AColony : panneau liaison ${member.user?.tag || member.id} :`,
          error.message
        );
      }
    }
  }
}

// ============================================================
// CORRECTION : attendre que Player Spaces ait créé connexion
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAColonySpace(member) {
  for (let attempt = 1; attempt <= 20; attempt++) {
    const category = findAColonyCategory(member.guild, member);

    if (category) {
      const connectionChannel = findChannel(
        member.guild,
        category,
        CHANNEL_NAMES.connection
      );

      if (connectionChannel) {
        console.log(`🔗 Salon connexion AColony prêt pour ${member.user.tag}`);

        await updateLinkPanel(member, category);

        console.log(`✅ Panneau AColony envoyé pour ${member.user.tag}`);
        return true;
      }
    }

    console.log(
      `⏳ AColony : attente espace de ${member.user.tag} (${attempt}/20)`
    );

    await sleep(1500);
  }

  console.error(
    `❌ AColony : espace incomplet pour ${member.user.tag} après attente`
  );

  return false;
}

function startAColonyMemberListener(client) {
  if (memberUpdateListenerStarted) return;
  memberUpdateListenerStarted = true;

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
      const hadRole = oldMember.roles.cache.has(ACOLONY_ROLE_ID);
      const hasRole = newMember.roles.cache.has(ACOLONY_ROLE_ID);

      if (!hadRole && hasRole) {
        console.log(
          `🏭 AColony Bridge : nouveau joueur détecté → ${newMember.user.tag}`
        );

        await waitForAColonySpace(newMember);
      }
    } catch (error) {
      console.error('❌ AColony : erreur détection rôle :', error);
    }
  });
}

function number(value, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

function formatPercent(value) {
  if (typeof value !== 'number') return '?';
  return `${Math.round(value)}%`;
}

function healthEmoji(value) {
  if (typeof value !== 'number') return '❔';
  if (value >= 75) return '💚';
  if (value >= 40) return '💛';
  return '❤️‍🩹';
}

function moodEmoji(value) {
  if (typeof value !== 'number') return '❔';
  if (value >= 75) return '😄';
  if (value >= 50) return '🙂';
  if (value >= 25) return '😕';
  return '😫';
}

function talentStars(value) {
  const amount = Math.max(0, Math.min(5, Number(value) || 0));
  return amount === 0 ? '' : ` ${'⭐'.repeat(amount)}`;
}

function buildSkillsText(colonist) {
  const skills = Array.isArray(colonist.skills) ? colonist.skills : [];
  if (skills.length === 0) return 'Aucune donnée.';

  return [...skills]
    .sort((a, b) => number(b.level) - number(a.level))
    .map(skill =>
      `**${skill.name || 'Inconnue'}** — Niv. ${number(skill.level)}${talentStars(skill.talent)}`
    )
    .join('\n')
    .slice(0, 1024);
}

function buildTraitsText(colonist) {
  const traits = Array.isArray(colonist.traits) ? colonist.traits : [];
  if (traits.length === 0) return 'Aucun trait.';

  return traits
    .map(trait => {
      if (typeof trait === 'string') return `• ${trait}`;
      return `• ${trait.name || `Trait ${trait.id ?? '?'}`}`;
    })
    .join('\n')
    .slice(0, 1024);
}

function buildJobsText(colonist) {
  const jobs = Array.isArray(colonist.jobs) ? colonist.jobs : [];

  const important = jobs
    .filter(job => number(job.priority) > 1 || number(job.talent) > 0)
    .sort((a, b) => {
      const diff = number(b.priority) - number(a.priority);
      return diff !== 0 ? diff : number(b.talent) - number(a.talent);
    });

  if (important.length === 0) return 'Aucune spécialisation particulière.';

  return important
    .map(job =>
      `• **${job.name || 'Travail'}** — Priorité ${number(job.priority)}${talentStars(job.talent)}`
    )
    .join('\n')
    .slice(0, 1024);
}

function buildRelationsText(colonist) {
  const relations = Array.isArray(colonist.relations) ? colonist.relations : [];
  if (relations.length === 0) return 'Aucune donnée.';

  return relations
    .map(relation => {
      const special = number(relation.special);
      const temporary = number(relation.temporary);
      let details = `${special} spéciale(s)`;
      if (temporary > 0) details += ` • ${temporary} temporaire(s)`;
      return `• **${relation.name || 'Inconnu'}** — ${details}`;
    })
    .join('\n')
    .slice(0, 1024);
}

function createColonistEmbed(colonist, state) {
  const health = number(colonist.health);
  const maxHealth = number(colonist.maxHealth);

  const healthPercent =
    typeof colonist.healthPercent === 'number'
      ? colonist.healthPercent
      : (maxHealth > 0 ? (health / maxHealth) * 100 : null);

  const injuries = number(colonist.injuries);
  const diseases = number(colonist.diseases);
  const poisonings = number(colonist.poisonings);

  const danger =
    injuries > 0 ||
    diseases > 0 ||
    poisonings > 0 ||
    colonist.breakdown === true;

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${colonist.name || 'Colon inconnu'}`)
    .setColor(danger ? 0xED4245 : 0x57F287)
    .setDescription([
      `🆔 **ID :** ${colonist.id ?? '?'}`,
      `🎂 **Âge :** ${colonist.age ?? '?'} ans`,
      `🚻 **Sexe :** ${colonist.gender || 'Inconnu'}`
    ].join('\n'))
    .addFields(
      {
        name: '❤️ État',
        value: [
          `${healthEmoji(healthPercent)} **Santé :** ${health} / ${maxHealth} (${formatPercent(healthPercent)})`,
          `${moodEmoji(colonist.mood)} **Humeur :** ${
            typeof colonist.mood === 'number'
              ? Math.round(colonist.mood * 10) / 10
              : '?'
          }`,
          `🍖 **Nourriture :** ${formatPercent(colonist.foodPercent)}`,
          `😴 **Sommeil :** ${formatPercent(colonist.sleepPercent)}`
        ].join('\n')
      },
      {
        name: '🩺 Santé détaillée',
        value: [
          `🩸 Blessures : **${injuries}**`,
          `🦠 Maladies : **${diseases}**`,
          `☠️ Empoisonnements : **${poisonings}**`,
          `🧠 Crise mentale : **${colonist.breakdown ? '⚠️ Oui' : '✅ Non'}**`
        ].join('\n')
      },
      {
        name: '📚 Compétences',
        value: buildSkillsText(colonist)
      },
      {
        name: '🧬 Traits',
        value: buildTraitsText(colonist),
        inline: true
      },
      {
        name: '🛠️ Spécialisations',
        value: buildJobsText(colonist),
        inline: true
      },
      {
        name: '🤝 Relations',
        value: buildRelationsText(colonist)
      }
    )
    .setFooter({ text: `AColony • Colon ID ${colonist.id ?? '?'}` })
    .setTimestamp();

  if (state.world) {
    embed.setAuthor({
      name: `${state.colonyName || 'Colonie'} • ${state.world}`
    });
  }

  return embed;
}

async function getExistingColonistMessages(channel) {
  const map = new Map();

  try {
    const messages = await channel.messages.fetch({ limit: 100 });

    for (const message of messages.values()) {
      if (message.author.id !== channel.client.user.id) continue;

      const footer = message.embeds?.[0]?.footer?.text;
      if (!footer) continue;

      const match = /^AColony • Colon ID (.+)$/.exec(footer);
      if (!match) continue;

      map.set(String(match[1]), message);
    }
  } catch (error) {
    console.error(
      '❌ AColony : lecture fiches colons impossible :',
      error.message
    );
  }

  return map;
}

async function updateColonistsChannel(channel, state) {
  const colonists = Array.isArray(state.colonists) ? state.colonists : [];
  const existing = await getExistingColonistMessages(channel);
  const activeIds = new Set();

  for (const colonist of colonists) {
    const colonistId = String(colonist.id ?? colonist.name);
    activeIds.add(colonistId);

    const embed = createColonistEmbed(colonist, state);
    const oldMessage = existing.get(colonistId);

    if (oldMessage) {
      await oldMessage.edit({ content: null, embeds: [embed] });
    } else {
      await channel.send({ embeds: [embed] });
    }
  }

  for (const [colonistId, message] of existing.entries()) {
    if (activeIds.has(colonistId)) continue;
    try {
      await message.delete();
    } catch {}
  }
}


function truncate(text, max = 3900) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatValue(value) {
  if (value === null || value === undefined) return 'Non disponible';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'string') return value || '—';
  return truncate(JSON.stringify(value, null, 2), 1000);
}

function summarizeCollection(value, emptyText = 'Aucune donnée transmise par le Bridge.') {
  if (value === null || value === undefined) return emptyText;

  if (Array.isArray(value)) {
    if (value.length === 0) return 'Aucun élément.';
    return truncate(
      value.slice(0, 25).map((item, index) => {
        if (item === null || item === undefined) return `• Élément ${index + 1}`;
        if (typeof item === 'string' || typeof item === 'number') return `• ${item}`;
        const name =
          item.name ??
          item.label ??
          item.title ??
          item.type ??
          item.id ??
          `Élément ${index + 1}`;
        const amount =
          item.amount ??
          item.count ??
          item.quantity ??
          item.value ??
          item.level ??
          null;
        return amount !== null ? `• **${name}** : ${amount}` : `• **${name}**`;
      }).join('\n')
    );
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return 'Aucune donnée.';
    return truncate(
      entries.slice(0, 25).map(([key, val]) => {
        if (val && typeof val === 'object') {
          if (Array.isArray(val)) return `• **${key}** : ${val.length} élément(s)`;
          return `• **${key}** : données disponibles`;
        }
        return `• **${key}** : ${formatValue(val)}`;
      }).join('\n')
    );
  }

  return String(value);
}

async function findManagedMessage(channel, footerText) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 });
    return messages.find(
      message =>
        message.author.id === channel.client.user.id &&
        message.embeds?.[0]?.footer?.text === footerText
    ) || null;
  } catch {
    return null;
  }
}

async function upsertManagedEmbed(channel, footerText, embed) {
  const oldMessage = await findManagedMessage(channel, footerText);
  if (oldMessage) {
    await oldMessage.edit({ content: null, embeds: [embed], components: [] });
    return oldMessage;
  }
  return channel.send({ embeds: [embed] });
}

function average(values) {
  const valid = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function buildBaseEmbed(title, color, footerText, state) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setFooter({ text: footerText })
    .setTimestamp();

  if (state?.colonyName || state?.world) {
    embed.setAuthor({
      name: `${state.colonyName || 'Colonie'}${state.world ? ` • ${state.world}` : ''}`
    });
  }

  return embed;
}

function createColonyEmbed(state) {
  return buildBaseEmbed('🏠 Vue générale de la colonie', 0x57F287, 'AColony • Colonie', state)
    .setDescription([
      `🏠 **Colonie :** ${state.colonyName || 'Inconnue'}`,
      `🌍 **Monde :** ${state.world || 'Inconnu'}`,
      `👥 **Colons :** ${state.colonists.length}`,
      `🔬 **Sciences :** ${state.sciences ?? 'Non disponible'}`,
      `🗺️ **Taille de la carte :** ${state.mapSize ?? 'Non disponible'}`,
      `⏱️ **Temps de jeu :** ${state.playTime || 'Non disponible'}`,
      `💾 **Sauvegarde :** ${state.saveName || 'Inconnue'}`,
      `🎮 **Version :** ${state.version || 'Inconnue'}`,
      `📅 **Date de sauvegarde :** ${state.saveDate || 'Non disponible'}`,
      '',
      '🟢 **Synchronisation automatique active**'
    ].join('\n'));
}

function createStorageEmbed(state) {
  const storage = Array.isArray(state.storage) ? state.storage : [];
  const lines = [];

  if (storage.length > 0) {
    for (const item of storage.slice(0, 35)) {
      const id = Number(item.id ?? item.Id ?? 0);
      const name = getAColonyItemName(id, item.name ?? item.Name);
      const count = item.count ?? item.Count ?? 0;
      lines.push(`• **${name}** : ${formatFrenchNumber(count)}`);
    }
  }

  return buildBaseEmbed('📦 Stockage', 0xFEE75C, 'AColony • Stockage', state)
    .setDescription(
      lines.length > 0
        ? lines.join('\n')
        : '📭 Aucun objet stocké détecté dans les zones de stockage de la colonie.'
    );
}

function createProductionEmbed(state) {
  const production = state.production && typeof state.production === 'object' ? state.production : null;
  const machines = Array.isArray(production?.machines) ? production.machines : [];
  const totalMachines = Number(production?.totalMachines) || machines.reduce((sum, item) => sum + (Number(item.count) || 0), 0);

  const lines = [
    `🏭 **Installations de production :** ${formatFrenchNumber(totalMachines)}`
  ];

  if (machines.length > 0) {
    lines.push('', '### ⚙️ Détail');
    for (const machine of machines.slice(0, 25)) {
      const name = translateBuildingName(machine.name ?? machine.Name);
      const count = machine.count ?? machine.Count ?? 0;
      lines.push(`• **${name}** : ${formatFrenchNumber(count)}`);
    }
  } else {
    lines.push('', 'Aucune installation de production détectée.');
  }

  return buildBaseEmbed('🏭 Production', 0xE67E22, 'AColony • Production', state)
    .setDescription(lines.join('\n'));
}

function makeProgressBar(current, required, size = 20) {
  const safeRequired = Number(required) > 0 ? Number(required) : 0;
  const safeCurrent = Math.max(0, Number(current) || 0);
  const ratio = safeRequired > 0 ? Math.max(0, Math.min(1, safeCurrent / safeRequired)) : 0;
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, size - filled))}`;
}

function createResearchEmbed(state) {
  const research = state.research && typeof state.research === 'object' ? state.research : null;
  const currentResearchId = Number(research?.currentResearchId ?? -1);
  const progress = Array.isArray(research?.progress) ? research.progress : [];

  const lines = [
    `🧪 **Sciences débloquées :** ${state.sciences ?? 'Non disponible'}`
  ];

  if (currentResearchId < 0) {
    lines.push('', '🔬 **Recherche en cours :** Aucune');
  } else {
    lines.push('', `🔬 **Recherche en cours :** Technologie #${currentResearchId}`);

    // On n'affiche qu'une progression réellement active.
    // Les anciennes valeurs 0/40, 0/65, 0/80 correspondaient aux réserves/types
    // de science et non au coût exact de chaque technologie.
    const activeProgress = progress.find(item =>
      Number(item.activeResearchers ?? item.ActiveResearchers ?? 0) > 0
    );

    if (activeProgress) {
      const current = Number(activeProgress.current ?? activeProgress.Current ?? 0);
      const required = Number(activeProgress.required ?? activeProgress.Required ?? 0);
      const active = Number(activeProgress.activeResearchers ?? activeProgress.ActiveResearchers ?? 0);
      const percent = required > 0
        ? Math.max(0, Math.min(100, Math.round((current / required) * 100)))
        : 0;

      lines.push(
        '',
        '### 📈 Progression',
        `\`${makeProgressBar(current, required)}\` **${percent} %**`,
        `${formatFrenchNumber(current)} / ${formatFrenchNumber(required)}`,
        `👨‍🔬 Chercheur${active > 1 ? 's' : ''} actif${active > 1 ? 's' : ''} : **${active}**`
      );
    } else {
      lines.push('', '⏳ Recherche sélectionnée, mais aucune progression active détectée pour le moment.');
    }
  }

  return buildBaseEmbed('🔬 Recherche', 0x9B59B6, 'AColony • Recherche', state)
    .setDescription(lines.join('\n'));
}

function createInfrastructureEmbed(state) {
  const infrastructure = Array.isArray(state.infrastructure) ? state.infrastructure : [];
  const lines = [];

  if (infrastructure.length > 0) {
    for (const item of infrastructure.slice(0, 35)) {
      lines.push(`• **${translateBuildingName(item.name ?? item.Name)}** : ${formatFrenchNumber(item.count ?? item.Count ?? 0)}`);
    }
  }

  return buildBaseEmbed('🧱 Infrastructure', 0x95A5A6, 'AColony • Infrastructure', state)
    .setDescription(lines.length ? lines.join('\n') : 'Aucune infrastructure détectée.');
}

function createAnimalsEmbed(state) {
  const animals = state.animals && typeof state.animals === 'object' ? state.animals : null;
  const species = Array.isArray(animals?.species) ? animals.species : [];
  const lines = [
    `🐾 **Animaux détectés :** ${formatFrenchNumber(animals?.total ?? 0)}`,
    `🏡 **Apprivoisés / colonie :** ${formatFrenchNumber(animals?.tamed ?? 0)}`,
    `🌲 **Sauvages :** ${formatFrenchNumber(animals?.wild ?? 0)}`
  ];

  if (species.length > 0) {
    lines.push('', '### 🐾 Détail');
    for (const item of species.slice(0, 25)) {
      lines.push(`• **${item.name ?? item.Name ?? 'Animal'}** : ${formatFrenchNumber(item.count ?? item.Count ?? 0)}`);
    }
  }

  return buildBaseEmbed('🐾 Animaux', 0x2ECC71, 'AColony • Animaux', state)
    .setDescription(lines.join('\n'));
}

function createWorldEmbed(state) {
  const weather = state.weather && typeof state.weather === 'object' ? state.weather : null;
  const currentWeatherId = Number(weather?.currentWeatherId ?? -1);
  const nextWeatherId = Number(weather?.nextWeatherId ?? -1);

  const lines = [
    `🌍 **Monde :** ${state.world || 'Inconnu'}`,
    `🗺️ **Taille de la carte :** ${state.mapSize ?? 'Non disponible'}`,
    `⏱️ **Temps de jeu :** ${state.playTime || 'Non disponible'}`,
    `📅 **Sauvegarde :** ${state.saveDate || 'Non disponible'}`,
    `🎮 **Version :** ${state.version || 'Inconnue'}`
  ];

  if (weather) {
    lines.push(
      '',
      '### 🌦️ Météo',
      `**Actuelle :** ${ACOLONY_WEATHER_NAMES[currentWeatherId] || `Météo #${currentWeatherId}`}`,
      `**Prochaine :** ${ACOLONY_WEATHER_NAMES[nextWeatherId] || `Météo #${nextWeatherId}`}`,
      `📆 **Année :** ${weather.year ?? '?'}`,
      `🕒 **Heure :** ${formatDayTime(weather.dayTime)}`,
      `🌧️ **Il pleut :** ${weather.isRaining ? 'Oui' : 'Non'}`,
      `🌙 **Période :** ${weather.isNight ? 'Nuit' : 'Jour'}`
    );
  }

  return buildBaseEmbed('🌦️ Monde', 0x3498DB, 'AColony • Monde', state)
    .setDescription(lines.join('\n'));
}

function createStatisticsEmbed(state) {
  const colonists = state.colonists;
  const healthValues = [];
  const moodValues = [];
  const foodValues = [];
  const sleepValues = [];

  let injuries = 0;
  let diseases = 0;
  let poisonings = 0;
  let breakdowns = 0;

  for (const colonist of colonists) {
    const health = number(colonist.health);
    const maxHealth = number(colonist.maxHealth);
    const healthPercent = typeof colonist.healthPercent === 'number'
      ? colonist.healthPercent
      : (maxHealth > 0 ? (health / maxHealth) * 100 : null);

    if (typeof healthPercent === 'number') healthValues.push(healthPercent);
    if (typeof colonist.mood === 'number') moodValues.push(colonist.mood);
    if (typeof colonist.foodPercent === 'number') foodValues.push(colonist.foodPercent);
    if (typeof colonist.sleepPercent === 'number') sleepValues.push(colonist.sleepPercent);

    injuries += number(colonist.injuries);
    diseases += number(colonist.diseases);
    poisonings += number(colonist.poisonings);
    if (colonist.breakdown === true) breakdowns++;
  }

  const avgHealth = average(healthValues);
  const avgMood = average(moodValues);
  const avgFood = average(foodValues);
  const avgSleep = average(sleepValues);
  const stats = normalizeGameStats(state.gameStats);

  return buildBaseEmbed('📊 Statistiques', 0x5865F2, 'AColony • Statistiques', state)
    .setDescription([
      `👥 **Population :** ${colonists.length}`,
      `❤️ **Santé moyenne :** ${avgHealth === null ? '?' : `${Math.round(avgHealth)}%`}`,
      `🙂 **Humeur moyenne :** ${avgMood === null ? '?' : Math.round(avgMood * 10) / 10}`,
      `🍖 **Nourriture moyenne :** ${avgFood === null ? '?' : `${Math.round(avgFood)}%`}`,
      `😴 **Sommeil moyen :** ${avgSleep === null ? '?' : `${Math.round(avgSleep)}%`}`,
      '',
      `🩸 **Blessures :** ${injuries}`,
      `🦠 **Maladies :** ${diseases}`,
      `☠️ **Empoisonnements :** ${poisonings}`,
      `🧠 **Crises mentales :** ${breakdowns}`,
      '',
      '### 🏗️ Activité de la colonie',
      `🌲 **Arbres coupés :** ${formatFrenchNumber(stats.treesCut)}`,
      `⛏️ **Blocs minés :** ${formatFrenchNumber(stats.blocksMined)}`,
      `🌱 **Plantes semées :** ${formatFrenchNumber(stats.plantsSeeded)}`,
      `🌾 **Plantes récoltées :** ${formatFrenchNumber(stats.plantsHarvested)}`,
      `🧱 **Constructions :** ${formatFrenchNumber(stats.buildingsBuilt)}`,
      `🏹 **Animaux éliminés :** ${formatFrenchNumber(stats.animalsKilled)}`,
      `🥩 **Animaux dépecés :** ${formatFrenchNumber(stats.animalsButchered)}`,
      '',
      `🔬 **Sciences :** ${state.sciences ?? 'Non disponible'}`,
      `⏱️ **Temps de jeu :** ${state.playTime || 'Non disponible'}`
    ].join('\n'));
}

function createChallengesEmbed(state) {
  const challenges = state.challenges;

  if (!challenges || !Array.isArray(challenges.entries)) {
    return buildBaseEmbed('🎯 Défis AColony', 0xED4245, 'AColony • Défis', state)
      .setDescription('⏳ Les statistiques de la sauvegarde ne sont pas encore disponibles pour générer les défis.');
  }

  const difficultyNames = { easy: '🟢 Facile', medium: '🟠 Moyen', hard: '🔴 Difficile' };
  const lines = [
    '### 🎯 Défis du jour',
    'Les progrès sont calculés automatiquement à partir de ta sauvegarde.',
    ''
  ];

  for (const entry of challenges.entries) {
    const current = Math.max(0, (challenges.current?.[entry.metric] || 0) - (challenges.baseline?.[entry.metric] || 0));
    const progress = Math.min(current, entry.target);
    const done = Boolean(entry.completed);
    lines.push(
      `${done ? '✅' : '⬜'} **${difficultyNames[entry.difficulty] || entry.difficulty} — ${entry.title}**`,
      `${entry.action} **${entry.target} ${entry.unit}** • ${formatFrenchNumber(progress)}/${formatFrenchNumber(entry.target)} • **+${entry.points} pt${entry.points > 1 ? 's' : ''}**`,
      ''
    );
  }

  lines.push(`🏆 **Points AColony cumulés : ${formatFrenchNumber(challenges.totalPoints || 0)}**`);

  return buildBaseEmbed('🎯 Défis AColony', 0xED4245, 'AColony • Défis', state)
    .setDescription(lines.join('\n'));
}

function createJournalEmbed(state) {
  const timestamp = Math.floor(new Date(state.receivedAt).getTime() / 1000);
  return buildBaseEmbed('📜 Journal de synchronisation', 0x2F3136, 'AColony • Journal', state)
    .setDescription([
      `🟢 **Dernière synchronisation :** <t:${timestamp}:F> (<t:${timestamp}:R>)`,
      `💾 **Sauvegarde :** ${state.saveName || 'Inconnue'}`,
      `🏠 **Colonie :** ${state.colonyName || 'Inconnue'}`,
      `🌍 **Monde :** ${state.world || 'Inconnu'}`,
      `👥 **Colons détectés :** ${state.colonists.length}`,
      `🔬 **Sciences :** ${state.sciences ?? 'Non disponible'}`,
      '',
      'Le Bridge surveille automatiquement les sauvegardes AColony.'
    ].join('\n'));
}

function createCommandsEmbed(state) {
  return buildBaseEmbed('⚙️ Commandes & fonctionnement', 0x5865F2, 'AColony • Commandes', state)
    .setDescription([
      '### 🤖 Fonctionnement automatique',
      '• Lance **AColony**.',
      '• Le Bridge détecte le jeu et lit la dernière sauvegarde.',
      '• Les salons de ton espace personnel sont actualisés automatiquement.',
      '',
      '### 🔄 Pour forcer une nouvelle synchronisation',
      'Effectue une nouvelle sauvegarde dans AColony.',
      '',
      '### 🔗 Liaison',
      'La gestion de la connexion se fait dans **🔗・connexion**.',
      '',
      '### 🟢 État actuel',
      `Dernière sauvegarde reçue : **${state.saveName || 'Inconnue'}**`
    ].join('\n'));
}

function createHelpEmbed(state) {
  return buildBaseEmbed('🆘 Aide AColony Bridge', 0x5865F2, 'AColony • Aide', state)
    .setDescription([
      '### Rien ne se met à jour ?',
      '1. Vérifie que **Naru AColony Bridge** tourne sur ton PC.',
      '2. Lance AColony et charge ta partie.',
      '3. Effectue une sauvegarde.',
      '4. Attends quelques secondes.',
      '',
      '### La connexion est perdue ?',
      'Consulte **🔗・connexion**.',
      '',
      '### État détecté actuellement',
      `🏠 Colonie : **${state.colonyName || 'Inconnue'}**`,
      `🌍 Monde : **${state.world || 'Inconnu'}**`,
      `👥 Colons : **${state.colonists.length}**`,
      `💾 Save : **${state.saveName || 'Inconnue'}**`
    ].join('\n'));
}

async function updateAllAColonyChannels(guild, category, state) {
  const jobs = [
    [CHANNEL_NAMES.colony, 'AColony • Colonie', createColonyEmbed(state)],
    [CHANNEL_NAMES.storage, 'AColony • Stockage', createStorageEmbed(state)],
    [CHANNEL_NAMES.production, 'AColony • Production', createProductionEmbed(state)],
    [CHANNEL_NAMES.research, 'AColony • Recherche', createResearchEmbed(state)],
    [CHANNEL_NAMES.infrastructure, 'AColony • Infrastructure', createInfrastructureEmbed(state)],
    [CHANNEL_NAMES.animals, 'AColony • Animaux', createAnimalsEmbed(state)],
    [CHANNEL_NAMES.world, 'AColony • Monde', createWorldEmbed(state)],
    [CHANNEL_NAMES.statistics, 'AColony • Statistiques', createStatisticsEmbed(state)],
    [CHANNEL_NAMES.challenges, 'AColony • Défis', createChallengesEmbed(state)],
    [CHANNEL_NAMES.journal, 'AColony • Journal', createJournalEmbed(state)],
    [CHANNEL_NAMES.commands, 'AColony • Commandes', createCommandsEmbed(state)],
    [CHANNEL_NAMES.help, 'AColony • Aide', createHelpEmbed(state)]
  ];

  const results = [];

  for (const [channelName, footer, embed] of jobs) {
    const channel = findChannel(guild, category, channelName);

    if (!channel) {
      results.push({ channel: channelName, ok: false, reason: 'introuvable' });
      continue;
    }

    try {
      await upsertManagedEmbed(channel, footer, embed);
      results.push({ channel: channelName, ok: true });
    } catch (error) {
      console.error(`❌ AColony : mise à jour ${channelName} :`, error.message);
      results.push({ channel: channelName, ok: false, reason: error.message });
    }
  }

  return results;
}

async function handleLink(request, response) {
  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return sendJson(response, 400, { ok: false, error: error.message });
  }

  const code = String(body.code || '').trim().toUpperCase();
  const installationId = String(body.installationId || '').trim();

  if (!code) {
    return sendJson(response, 400, { ok: false, error: 'Code AColony manquant' });
  }

  if (!installationId) {
    return sendJson(response, 400, { ok: false, error: 'installationId manquant' });
  }

  const found = findUserByCode(code);

  if (!found) {
    return sendJson(response, 404, {
      ok: false,
      error: 'Code AColony invalide ou déjà utilisé'
    });
  }

  const discordFound = await findDiscordMember(found.userId);

  if (!discordFound) {
    return sendJson(response, 404, {
      ok: false,
      error: 'Compte Discord introuvable'
    });
  }

  const { member } = discordFound;

  if (!member.roles.cache.has(ACOLONY_ROLE_ID)) {
    return sendJson(response, 403, {
      ok: false,
      error: 'Rôle AColony manquant'
    });
  }

  const token = generateToken();

  found.user.linked = true;
  found.user.installationId = installationId;
  found.user.tokenHash = hashToken(token);
  found.user.linkedAt = new Date().toISOString();
  found.user.lastSeenAt = found.user.linkedAt;
  found.user.linkCode = null;
  found.user.linkCodeConsumedAt = found.user.linkedAt;

  found.data.users[found.userId] = found.user;
  saveData(found.data);

  const category = findAColonyCategory(member.guild, member);

  if (category) {
    try {
      await updateLinkPanel(member, category);
    } catch (error) {
      console.error(
        '⚠️ AColony : panneau liaison non actualisé :',
        error.message
      );
    }
  }

  console.log(`🔗 AColony lié : ${member.user.tag} → ${installationId}`);
  console.log(`🔐 Code AColony consommé : ${member.user.tag}`);

  return sendJson(response, 200, {
    ok: true,
    linked: true,
    token,
    discordUserId: member.id,
    message: 'Installation AColony liée avec succès'
  });
}

async function handleUpdate(request, response) {
  const auth = authenticateInstallation(request);

  if (!auth) {
    return sendJson(response, 401, {
      ok: false,
      error: 'Installation AColony non authentifiée'
    });
  }

  let body;

  try {
    body = await readJsonBody(request);
  } catch (error) {
    return sendJson(response, 400, { ok: false, error: error.message });
  }

  if (!Array.isArray(body.colonists)) {
    return sendJson(response, 400, {
      ok: false,
      error: 'colonists manquant'
    });
  }

  const found = await findDiscordMember(auth.userId);

  if (!found) {
    return sendJson(response, 404, {
      ok: false,
      error: 'Membre Discord introuvable'
    });
  }

  const { guild, member } = found;

  if (!member.roles.cache.has(ACOLONY_ROLE_ID)) {
    return sendJson(response, 403, {
      ok: false,
      error: 'Rôle AColony manquant'
    });
  }

  const category = findAColonyCategory(guild, member);

  if (!category) {
    return sendJson(response, 404, {
      ok: false,
      error: 'Catégorie personnelle AColony introuvable'
    });
  }

  const colonistsChannel = findChannel(
    guild,
    category,
    CHANNEL_NAMES.colonists
  );

  if (!colonistsChannel) {
    return sendJson(response, 404, {
      ok: false,
      error: 'Salon 👥・colons introuvable'
    });
  }

  const state = {
    discordUserId: member.id,
    installationId: auth.user.installationId,
    receivedAt: new Date().toISOString(),
    saveName: body.saveName || null,
    colonyName: body.colonyName || null,
    world: body.world || null,
    version: body.version || null,
    saveDate: body.saveDate || null,
    playTime: body.playTime || null,
    sciences: body.sciences ?? null,
    mapSize: body.mapSize ?? null,
    colonists: body.colonists,
    storage: body.storage ?? body.storages ?? body.inventory ?? body.resources ?? null,
    production: body.production ?? body.productions ?? body.machines ?? null,
    research: body.research ?? body.researches ?? body.technologies ?? null,
    infrastructure: body.infrastructure ?? body.buildings ?? body.structures ?? body.constructions ?? null,
    animals: body.animals ?? body.tamedAnimals ?? body.creatures ?? null,
    weather: body.weather ?? body.worldData ?? body.environment ?? null,
    gameStats: body.gameStats ?? body.statistics ?? null,
    challenges: null
  };

  state.challenges = updateDailyChallenges(member.id, state.gameStats);

  playerStates.set(member.id, state);

  if (discordClient?.acolonyBridge) {
    discordClient.acolonyBridge.players.set(member.id, state);
  }

  await updateColonistsChannel(colonistsChannel, state);
  const channelResults = await updateAllAColonyChannels(guild, category, state);

  const data = loadData();

  if (data.users[member.id]) {
    data.users[member.id].lastSeenAt = new Date().toISOString();
    saveData(data);
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏭 DONNÉES ACOLONY REÇUES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`👤 Discord : ${member.user.tag}`);
  console.log(`🏠 Colonie : ${state.colonyName || '?'}`);
  console.log(`🌍 Monde : ${state.world || '?'}`);
  console.log(`👥 Colons : ${state.colonists.length}`);
  console.log(`💾 Save : ${state.saveName || '?'}`);
  console.log(`📡 Salons : ${channelResults.filter(result => result.ok).length}/${channelResults.length + 1} mis à jour`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  return sendJson(response, 200, {
    ok: true,
    message: 'Données AColony reçues',
    colonists: state.colonists.length,
    channelsUpdated: channelResults.filter(result => result.ok).length + 1
  });
}

async function handleAColonyRequest(request, response) {
  const requestUrl = new URL(
    request.url,
    `http://${request.headers.host || 'localhost'}`
  );

  if (
    request.method === 'OPTIONS' &&
    requestUrl.pathname.startsWith('/acolony/')
  ) {
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (
    request.method === 'GET' &&
    requestUrl.pathname === '/acolony/status'
  ) {
    sendJson(response, 200, {
      ok: true,
      service: 'Naru AColony Bridge',
      ready: Boolean(discordClient),
      connectedPlayers: playerStates.size
    });
    return true;
  }

  if (
    request.method === 'POST' &&
    requestUrl.pathname === '/acolony/link'
  ) {
    await handleLink(request, response);
    return true;
  }

  if (
    request.method === 'POST' &&
    requestUrl.pathname === '/acolony/update'
  ) {
    await handleUpdate(request, response);
    return true;
  }

  return false;
}

function getAColonyPlayerState(discordUserId) {
  return playerStates.get(String(discordUserId)) || null;
}

function startAColonyBridge(client) {
  discordClient = client;

  if (!client.acolonyBridge) {
    client.acolonyBridge = {
      players: new Map(),
      previousStates: new Map(),
      messages: new Map()
    };
  }

  ensureDataFile();

  startInteractionListener(client);
  startAColonyMemberListener(client);

  console.log('🏭 AColony Bridge : module chargé');

  if (ACOLONY_DOWNLOAD_URL) {
    console.log(`⬇️ AColony téléchargement : ${ACOLONY_DOWNLOAD_URL}`);
  } else {
    console.log(
      '⚠️ ACOLONY_DOWNLOAD_URL non configuré — bouton téléchargement désactivé.'
    );
  }

  setTimeout(() => {
    syncLinkPanels().catch(error => {
      console.error('❌ AColony : synchro initiale :', error);
    });
  }, 10000);

  if (!scanInterval) {
    scanInterval = setInterval(() => {
      syncLinkPanels().catch(error => {
        console.error('❌ AColony : synchro panneaux :', error);
      });
    }, 300000);
  }
}

module.exports = {
  startAColonyBridge,
  handleAColonyRequest,
  getAColonyPlayerState
};
