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

const DATA_FOLDER = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_FOLDER, 'acolony-links.json');

let discordClient = null;
let scanInterval = null;
let interactionListenerStarted = false;
let memberUpdateListenerStarted = false;

const playerStates = new Map();

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
      '⚠️ En cas de changement de PC ou de réinstallation, une nouvelle liaison devra être créée.'
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

function startInteractionListener(client) {
  if (interactionListenerStarted) return;
  interactionListenerStarted = true;

  client.on('interactionCreate', async interaction => {
    try {
      if (!interaction.isButton()) return;
      if (interaction.customId !== BUTTON_GENERATE_CODE) return;
      await handleGenerateCodeButton(interaction);
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

function formatCountItems(items, limit = 25) {
  if (!Array.isArray(items) || items.length === 0) return 'Aucun élément détecté.';
  return truncate(
    items.slice(0, limit).map(item => {
      const name = item?.name || item?.label || (item?.id ? `Objet #${item.id}` : 'Élément');
      const count = item?.count ?? item?.amount ?? item?.quantity ?? 0;
      return `• **${name}** : ${Number.isInteger(Number(count)) ? Number(count) : Number(count).toFixed(2)}`;
    }).join('\n')
  );
}

function createStorageEmbed(state) {
  const storage = Array.isArray(state.storage) ? state.storage : [];
  const totalUnits = storage.reduce((sum, item) => sum + number(item?.count), 0);

  return buildBaseEmbed('📦 Stockage', 0xFEE75C, 'AColony • Stockage', state)
    .setDescription([
      `📦 **Types de ressources :** ${storage.length}`,
      `🧮 **Unités détectées :** ${Math.round(totalUnits * 100) / 100}`,
      '',
      storage.length > 0
        ? formatCountItems(storage, 30)
        : 'Aucune ressource stockée détectée dans la sauvegarde.'
    ].join('\n'));
}

function createProductionEmbed(state) {
  const production = state.production || {};
  const machines = Array.isArray(production.machines) ? production.machines : [];

  return buildBaseEmbed('🏭 Production', 0xE67E22, 'AColony • Production', state)
    .setDescription([
      `⚙️ **Installations de production détectées :** ${production.totalMachines ?? machines.reduce((s, x) => s + number(x?.count), 0)}`,
      '',
      machines.length > 0
        ? formatCountItems(machines, 30)
        : 'Aucune installation de production spécifique détectée.'
    ].join('\n'));
}

function createResearchEmbed(state) {
  const research = state.research || {};
  const progress = Array.isArray(research.progress) ? research.progress : [];

  const lines = progress.map(entry => {
    const current = number(entry.current);
    const required = number(entry.required);
    const percent = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
    return `• **Branche ${entry.type ?? '?'}** : ${Math.round(current * 100) / 100}/${Math.round(required * 100) / 100} (${percent}%) • Chercheurs: ${number(entry.activeResearchers)}`;
  });

  return buildBaseEmbed('🔬 Recherche', 0x9B59B6, 'AColony • Recherche', state)
    .setDescription([
      `🧪 **Sciences débloquées :** ${research.unlockedCount ?? state.sciences ?? 'Non disponible'}`,
      `🎯 **Recherche actuelle :** ${number(research.currentResearchId, -1) >= 0 ? `#${research.currentResearchId}` : 'Aucune'}`,
      '',
      lines.length > 0 ? truncate(lines.join('\n')) : 'Aucune progression de recherche active.'
    ].join('\n'));
}

function createInfrastructureEmbed(state) {
  const infrastructure = Array.isArray(state.infrastructure) ? state.infrastructure : [];
  const total = infrastructure.reduce((sum, item) => sum + number(item?.count), 0);

  return buildBaseEmbed('🧱 Infrastructure', 0x95A5A6, 'AColony • Infrastructure', state)
    .setDescription([
      `🏗️ **Éléments construits détectés :** ${Math.round(total)}`,
      `🧩 **Types de structures :** ${infrastructure.length}`,
      '',
      infrastructure.length > 0
        ? formatCountItems(infrastructure, 35)
        : 'Aucune structure détectée.'
    ].join('\n'));
}

function createAnimalsEmbed(state) {
  const animals = state.animals || {};
  const species = Array.isArray(animals.species) ? animals.species : [];

  return buildBaseEmbed('🐾 Animaux', 0x2ECC71, 'AColony • Animaux', state)
    .setDescription([
      `🐾 **Animaux présents :** ${animals.total ?? 0}`,
      `🏠 **Apprivoisés / appartenant à un groupe :** ${animals.tamed ?? 0}`,
      `🌲 **Sauvages :** ${animals.wild ?? 0}`,
      '',
      species.length > 0
        ? formatCountItems(species, 25)
        : 'Aucun animal détecté.'
    ].join('\n'));
}

function weatherLabel(id) {
  const labels = {
    0: 'Clair',
    1: 'Variable',
    2: 'Pluie / mauvais temps',
    3: 'Orage',
    4: 'Extrême'
  };
  return labels[id] ? `${labels[id]} (#${id})` : `Météo #${id ?? '?'}`;
}

function createWorldEmbed(state) {
  const weather = state.weather || {};
  const dayTime = typeof weather.dayTime === 'number'
    ? `${Math.round(weather.dayTime * 100)}% de la journée`
    : 'Non disponible';

  return buildBaseEmbed('🌦️ Monde', 0x3498DB, 'AColony • Monde', state)
    .setDescription([
      `🌍 **Monde :** ${state.world || 'Inconnu'}`,
      `🗺️ **Taille :** ${state.mapSize ?? 'Non disponible'}`,
      `📆 **Année :** ${weather.year ?? 'Non disponible'}`,
      `☀️ **Période :** ${weather.isNight ? 'Nuit' : 'Jour'}`,
      `🕒 **Cycle :** ${dayTime}`,
      `🌧️ **Pluie :** ${weather.isRaining ? 'Oui' : 'Non'}`,
      `🌤️ **Météo actuelle :** ${weatherLabel(weather.currentWeatherId)}`,
      `🔮 **Prochaine météo :** ${weatherLabel(weather.nextWeatherId)}`,
      '',
      `⏱️ **Temps de jeu :** ${state.playTime || 'Non disponible'}`,
      `📅 **Sauvegarde :** ${state.saveDate || 'Non disponible'}`,
      `🎮 **Version :** ${state.version || 'Inconnue'}`
    ].join('\n'));
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

  const stats = state.gameStats || {};
  const avgHealth = average(healthValues);
  const avgMood = average(moodValues);
  const avgFood = average(foodValues);
  const avgSleep = average(sleepValues);

  return buildBaseEmbed('📊 Statistiques', 0x5865F2, 'AColony • Statistiques', state)
    .setDescription([
      '### 👥 Colonie',
      `👥 **Population :** ${colonists.length}`,
      `❤️ **Santé moyenne :** ${avgHealth === null ? '?' : `${Math.round(avgHealth)}%`}`,
      `🙂 **Humeur moyenne :** ${avgMood === null ? '?' : Math.round(avgMood * 10) / 10}`,
      `🍖 **Nourriture moyenne :** ${avgFood === null ? '?' : `${Math.round(avgFood)}%`}`,
      `😴 **Sommeil moyen :** ${avgSleep === null ? '?' : `${Math.round(avgSleep)}%`}`,
      `🩸 Blessures: **${injuries}** • 🦠 Maladies: **${diseases}** • ☠️ Empoisonnements: **${poisonings}** • 🧠 Crises: **${breakdowns}**`,
      '',
      '### 🎮 Activité cumulée',
      `⛏️ **Blocs minés :** ${stats.blocksMined ?? 0}`,
      `🌲 **Arbres coupés :** ${stats.treesCut ?? 0}`,
      `🌱 **Plantes semées :** ${stats.plantsSeeded ?? 0}`,
      `🌾 **Plantes récoltées :** ${stats.plantsHarvested ?? 0}`,
      `🏗️ **Constructions :** ${stats.buildingsBuilt ?? 0}`,
      `🏹 **Animaux tués :** ${stats.animalsKilled ?? 0}`,
      `🥩 **Animaux dépecés :** ${stats.animalsButchered ?? 0}`
    ].join('\n'));
}

function nextMilestone(value, step) {
  const current = Math.max(0, number(value));
  return Math.max(step, Math.ceil((current + 1) / step) * step);
}

function challengeLine(label, value, step) {
  const current = Math.max(0, number(value));
  const target = nextMilestone(current, step);
  const previous = Math.max(0, target - step);
  const progress = Math.max(0, current - previous);
  return `${label} **${progress}/${step}** → prochain palier total **${target}**`;
}

function createChallengesEmbed(state) {
  const stats = state.gameStats || {};

  return buildBaseEmbed('🎯 Défis AColony', 0xED4245, 'AColony • Défis', state)
    .setDescription([
      '### 🎯 Prochains paliers automatiques',
      challengeLine('⛏️ Minage', stats.blocksMined, 100),
      challengeLine('🌾 Récolte', stats.plantsHarvested, 100),
      challengeLine('🏗️ Construction', stats.buildingsBuilt, 50),
      challengeLine('🌲 Foresterie', stats.treesCut, 100),
      challengeLine('🏹 Chasse', stats.animalsKilled, 25),
      '',
      'Ces objectifs sont calculés automatiquement à partir de ta sauvegarde et évoluent avec ta progression.'
    ].join('\n'));
}

function createJournalEmbed(state) {
  const timestamp = Math.floor(new Date(state.receivedAt).getTime() / 1000);
  return buildBaseEmbed('📜 Journal de synchronisation', 0x2F3136, 'AColony • Journal', state)
    .setDescription([
      `🟢 **Dernière synchronisation :** <t:${timestamp}:F> (<t:${timestamp}:R>)`,
      `🎮 **Joueur :** ${state.playerName || 'Inconnu'}`,
      `💾 **Sauvegarde :** ${state.saveName || 'Inconnue'}`,
      `🏠 **Colonie :** ${state.colonyName || 'Inconnue'}`,
      `🌍 **Monde :** ${state.world || 'Inconnu'}`,
      `👥 **Colons détectés :** ${state.colonists.length}`,
      `📦 **Types de ressources :** ${Array.isArray(state.storage) ? state.storage.length : 0}`,
      `🧱 **Types de structures :** ${Array.isArray(state.infrastructure) ? state.infrastructure.length : 0}`,
      `🐾 **Animaux :** ${state.animals?.total ?? 0}`,
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
      '• Les salons sont actualisés automatiquement.',
      '',
      '### 🔄 Forcer une synchronisation',
      'Effectue simplement une nouvelle sauvegarde dans AColony.',
      '',
      '### 📡 Données suivies',
      'Colonie • colons • stockage • production • recherche • infrastructure • animaux • monde • statistiques • défis.',
      '',
      `🟢 **Dernière save :** ${state.saveName || 'Inconnue'}`
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
      '### Connexion / changement de PC',
      'Utilise **🔗・connexion** pour gérer la liaison.',
      '',
      '### État actuel',
      `🎮 Joueur : **${state.playerName || 'Inconnu'}**`,
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
    playerName: body.playerName || null,
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
    challenges: body.challenges ?? null
  };

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
