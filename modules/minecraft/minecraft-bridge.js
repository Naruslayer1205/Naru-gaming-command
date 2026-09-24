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

// ============================================================
// CONFIGURATION
// ============================================================

const MINECRAFT_ROLE_ID =
  process.env.MINECRAFT_ROLE_ID ||
  '1550948318639554620';

const CATEGORY_PREFIX =
  '⛏️ Minecraft — ';

const MINECRAFT_DOWNLOAD_URL =
  process.env.MINECRAFT_DOWNLOAD_URL ||
  null;

const CHANNEL_NAMES = {
  player: '👤・joueur',
  world: '🌍・monde',
  statistics: '📊・statistiques',
  progression: '🏆・progression',
  challenges: '🎯・défis',
  journal: '📜・journal',
  commands: '⚙️・commandes',
  connection: '🔗・connexion',
  help: '🆘・aide'
};

const BUTTON_GENERATE_CODE =
  'minecraft_generate_link_code';

const BUTTON_RELINK =
  'minecraft_relink_bridge';

const DATA_FOLDER =
  path.join(__dirname, '../../data');

const DATA_FILE =
  path.join(DATA_FOLDER, 'minecraft-links.json');

let discordClient = null;
let interactionListenerStarted = false;
let memberUpdateListenerStarted = false;

// ============================================================
// DONNÉES
// ============================================================

function ensureDataFile() {
  if (!fs.existsSync(DATA_FOLDER)) {
    fs.mkdirSync(DATA_FOLDER, {
      recursive: true
    });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          users: {}
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

function loadData() {
  ensureDataFile();

  try {
    const data =
      JSON.parse(
        fs.readFileSync(
          DATA_FILE,
          'utf8'
        )
      );

    if (
      !data.users ||
      typeof data.users !== 'object'
    ) {
      data.users = {};
    }

    return data;

  } catch (error) {
    console.error(
      '❌ Minecraft : lecture minecraft-links.json impossible :',
      error
    );

    return {
      users: {}
    };
  }
}

function saveData(data) {
  ensureDataFile();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

// ============================================================
// SÉCURITÉ / LIAISON
// ============================================================

function randomBlock(length = 4) {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let result = '';

  for (
    let i = 0;
    i < length;
    i++
  ) {
    result +=
      chars[
        crypto.randomInt(
          0,
          chars.length
        )
      ];
  }

  return result;
}

function generateLinkCode() {
  return `MC-${randomBlock(4)}-${randomBlock(4)}`;
}

function generateToken() {
  return crypto
    .randomBytes(32)
    .toString('hex');
}

function hashToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token))
    .digest('hex');
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

      createdAt:
        new Date().toISOString()
    };

    changed = true;
  }

  const user =
    data.users[userId];

  if (
    user.linked &&
    user.linkCode
  ) {
    user.linkCode = null;

    if (
      !user.linkCodeConsumedAt
    ) {
      user.linkCodeConsumedAt =
        new Date().toISOString();
    }

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

  const userId =
    String(member.id);

  let user =
    data.users[userId];

  if (!user) {
    ensureUserData(member);

    data = loadData();
    user = data.users[userId];
  }

  if (user.linked) {
    return {
      ok: false,
      reason: 'ALREADY_LINKED',
      user
    };
  }

  user.linkCode =
    generateLinkCode();

  user.linkCodeCreatedAt =
    new Date().toISOString();

  user.linkCodeConsumedAt =
    null;

  data.users[userId] = user;

  saveData(data);

  return {
    ok: true,
    user
  };
}

function createRelinkCode(member) {
  let data = loadData();

  const userId =
    String(member.id);

  let user =
    data.users[userId];

  if (!user) {
    ensureUserData(member);

    data = loadData();
    user = data.users[userId];
  }

  user.linked = false;

  user.installationId = null;

  user.tokenHash = null;

  user.linkedAt = null;

  user.lastSeenAt = null;

  user.linkCode =
    generateLinkCode();

  user.linkCodeCreatedAt =
    new Date().toISOString();

  user.linkCodeConsumedAt =
    null;

  data.users[userId] = user;

  saveData(data);

  return {
    ok: true,
    user
  };
}

function findUserByCode(code) {
  const normalized =
    String(code || '')
      .trim()
      .toUpperCase();

  if (!normalized) {
    return null;
  }

  const data =
    loadData();

  for (
    const [userId, user]
    of Object.entries(data.users)
  ) {
    if (
      user.linked ||
      !user.linkCode
    ) {
      continue;
    }

    if (
      String(user.linkCode)
        .trim()
        .toUpperCase() ===
      normalized
    ) {
      return {
        data,
        userId,
        user
      };
    }
  }

  return null;
}

function authenticateInstallation(
  request
) {
  const installationId =
    String(
      request.headers[
        'x-minecraft-installation-id'
      ] || ''
    ).trim();

  const authorization =
    String(
      request.headers.authorization ||
      ''
    );

  const match =
    /^Bearer\s+(.+)$/i.exec(
      authorization
    );

  if (
    !installationId ||
    !match
  ) {
    return null;
  }

  const tokenHash =
    hashToken(
      match[1].trim()
    );

  const data =
    loadData();

  for (
    const [userId, user]
    of Object.entries(data.users)
  ) {
    if (
      !user.linked ||
      !user.installationId ||
      !user.tokenHash
    ) {
      continue;
    }

    if (
      user.installationId !==
      installationId
    ) {
      continue;
    }

    if (
      user.tokenHash !==
      tokenHash
    ) {
      continue;
    }

    return {
      data,
      userId,
      user
    };
  }

  return null;
}

// ============================================================
// HTTP
// ============================================================

function sendJson(
  response,
  status,
  data
) {
  if (
    response.headersSent
  ) {
    return;
  }

  const payload =
    JSON.stringify(data);

  response.writeHead(
    status,
    {
      'Content-Type':
        'application/json; charset=utf-8',

      'Content-Length':
        Buffer.byteLength(
          payload
        ),

      'Access-Control-Allow-Origin':
        '*',

      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, X-Minecraft-Installation-Id',

      'Access-Control-Allow-Methods':
        'GET, POST, OPTIONS'
    }
  );

  response.end(payload);
}

function readJsonBody(request) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let body = '';
      let size = 0;
      let finished = false;

      request.on(
        'data',
        chunk => {
          if (finished) {
            return;
          }

          size +=
            chunk.length;

          if (
            size >
            5 * 1024 * 1024
          ) {
            finished = true;

            reject(
              new Error(
                'Payload trop volumineux'
              )
            );

            return;
          }

          body +=
            chunk.toString(
              'utf8'
            );
        }
      );

      request.on(
        'end',
        () => {
          if (finished) {
            return;
          }

          finished = true;

          if (
            !body.trim()
          ) {
            resolve({});
            return;
          }

          try {
            resolve(
              JSON.parse(body)
            );

          } catch {
            reject(
              new Error(
                'JSON invalide'
              )
            );
          }
        }
      );

      request.on(
        'error',
        error => {
          if (finished) {
            return;
          }

          finished = true;
          reject(error);
        }
      );
    }
  );
}

// ============================================================
// DISCORD
// ============================================================

async function findDiscordMember(
  userId
) {
  if (!discordClient) {
    return null;
  }

  for (
    const guild
    of discordClient.guilds.cache.values()
  ) {
    const cachedMember =
      guild.members.cache.get(
        String(userId)
      );

    if (cachedMember) {
      return {
        guild,
        member: cachedMember
      };
    }

    try {
      const member =
        await guild.members.fetch(
          userId
        );

      if (member) {
        return {
          guild,
          member
        };
      }

    } catch {}
  }

  return null;
}

function findMinecraftCategory(
  guild,
  member
) {
  const categories =
    guild.channels.cache.filter(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        channel.name.startsWith(
          CATEGORY_PREFIX
        )
    );

  const byPermission =
    categories.find(
      category =>
        category.permissionOverwrites
          .cache
          .has(member.id)
    );

  if (byPermission) {
    return byPermission;
  }

  const displayName =
    member.displayName.toLowerCase();

  return (
    categories.find(
      category =>
        category.name
          .toLowerCase()
          .includes(displayName)
    ) ||
    null
  );
}

function findChannel(
  guild,
  category,
  name
) {
  return (
    guild.channels.cache.find(
      channel =>
        channel.parentId ===
          category.id &&
        channel.name ===
          name
    ) ||
    null
  );
}

async function findLinkMessage(
  channel
) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 50
      });

    return (
      messages.find(
        message =>
          message.author.id ===
            channel.client.user.id &&
          message.embeds?.[0]
            ?.footer?.text ===
            'Naru Minecraft Bridge • Liaison'
      ) ||
      null
    );

  } catch {
    return null;
  }
}

// ============================================================
// SYNCHRONISATION DES DONNÉES MINECRAFT
// ============================================================

async function upsertMinecraftEmbed(
  channel,
  footerText,
  embed
) {
  try {
    const messages =
      await channel.messages.fetch({
        limit: 50
      });

    const existing =
      messages.find(
        message =>
          message.author.id ===
            channel.client.user.id &&
          message.embeds?.[0]
            ?.footer?.text ===
            footerText
      );

    if (existing) {
      await existing.edit({
        content: null,
        embeds: [embed]
      });

      return existing;
    }

    return await channel.send({
      embeds: [embed]
    });

  } catch (error) {
    console.error(
      '❌ Minecraft : mise à jour embed impossible :',
      error
    );

    return null;
  }
}

function safeText(value, fallback = 'Non disponible') {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return fallback;
  }

  return String(value);
}

function listText(items, fallback = 'Aucune donnée') {
  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return fallback;
  }

  return items
    .slice(0, 12)
    .map(item => `• ${item}`)
    .join('\n')
    .slice(0, 1000);
}

function formatPlayTime(ticks) {
  const seconds =
    Math.floor(
      Number(ticks || 0) / 20
    );

  const hours =
    Math.floor(seconds / 3600);

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    );

  return `${hours} h ${minutes} min`;
}

function formatDistance(cm) {
  const meters =
    Number(cm || 0) / 100;

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}

async function syncDataChannel(
  member,
  category,
  channelName,
  footer,
  embed
) {
  const channel =
    findChannel(
      member.guild,
      category,
      channelName
    );

  if (!channel) {
    return false;
  }

  await upsertMinecraftEmbed(
    channel,
    footer,
    embed.setFooter({
      text: footer
    }).setTimestamp()
  );

  return true;
}

async function syncAllMinecraftChannels(
  member,
  category,
  payload
) {
  const d =
    payload.data || {};

  const now =
    payload.detectedAt
      ? new Date(payload.detectedAt)
      : new Date();

  const unix =
    Math.floor(
      (
        Number.isNaN(now.getTime())
          ? Date.now()
          : now.getTime()
      ) / 1000
    );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.player,
    'Naru Minecraft Bridge • Joueur',
    new EmbedBuilder()
      .setTitle('👤 Joueur Minecraft')
      .setColor(0x57F287)
      .addFields(
        {
          name: '📍 Position',
          value:
            `X **${Number(d.x || 0).toFixed(1)}** • Y **${Number(d.y || 0).toFixed(1)}** • Z **${Number(d.z || 0).toFixed(1)}**`
        },
        {
          name: '🌌 Dimension',
          value: `\`${safeText(d.dimension)}\``,
          inline: true
        },
        {
          name: '❤️ Vie',
          value: `${Number(d.health || 0).toFixed(1)} HP`,
          inline: true
        },
        {
          name: '🍗 Nourriture',
          value: `${Number(d.food || 0)}/20`,
          inline: true
        },
        {
          name: '✨ XP',
          value:
            `Niveau **${Number(d.xpLevel || 0)}** • Total **${Number(d.xpTotal || 0)}**`,
          inline: false
        },
        {
          name: '🛏️ Respawn',
          value: safeText(d.respawn),
          inline: true
        },
        {
          name: '💀 Dernière mort',
          value: safeText(d.lastDeath),
          inline: true
        },
        {
          name: '🛡️ Équipement',
          value: listText(d.equipment),
          inline: false
        },
        {
          name: '🎒 Inventaire',
          value: listText(d.inventoryHighlights),
          inline: false
        }
      )
  );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.world,
    'Naru Minecraft Bridge • Monde',
    new EmbedBuilder()
      .setTitle('🌍 Monde Minecraft actif')
      .setColor(0x57F287)
      .setDescription(
        'Une seule save est affichée : la save active/la plus récemment utilisée.'
      )
      .addFields(
        {
          name: '📦 Instance / Modpack',
          value: `\`${safeText(d.instance)}\``,
          inline: false
        },
        {
          name: '🌍 Save active',
          value: `\`${safeText(d.world)}\``,
          inline: false
        },
        {
          name: '🧱 Version',
          value: `\`${safeText(d.version)}\``,
          inline: true
        },
        {
          name: '🎮 Mode',
          value: safeText(d.gameMode),
          inline: true
        },
        {
          name: '⚔️ Difficulté',
          value: safeText(d.difficulty),
          inline: true
        },
        {
          name: '☠️ Hardcore',
          value: d.hardcore ? 'Oui' : 'Non',
          inline: true
        },
        {
          name: '📅 Jour',
          value: `${Number(d.day || 0)}`,
          inline: true
        },
        {
          name: '🌦️ Météo',
          value: safeText(d.weather),
          inline: true
        },
        {
          name: '🌱 Seed',
          value: `\`${safeText(d.seed)}\``,
          inline: false
        },
        {
          name: '🔄 Dernière synchro',
          value: `<t:${unix}:R>`,
          inline: false
        }
      )
  );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.statistics,
    'Naru Minecraft Bridge • Statistiques',
    new EmbedBuilder()
      .setTitle('📊 Statistiques Minecraft')
      .setColor(0x5865F2)
      .addFields(
        {
          name: '⏱️ Temps joué',
          value: formatPlayTime(d.playTimeTicks),
          inline: true
        },
        {
          name: '💀 Morts',
          value: `${Number(d.deaths || 0)}`,
          inline: true
        },
        {
          name: '⚔️ Mobs tués',
          value: `${Number(d.mobKills || 0)}`,
          inline: true
        },
        {
          name: '👥 Joueurs tués',
          value: `${Number(d.playerKills || 0)}`,
          inline: true
        },
        {
          name: '🦘 Sauts',
          value: `${Number(d.jumps || 0).toLocaleString('fr-FR')}`,
          inline: true
        },
        {
          name: '🚶 Marche',
          value: formatDistance(d.walkCm),
          inline: true
        },
        {
          name: '🏃 Course',
          value: formatDistance(d.sprintCm),
          inline: true
        },
        {
          name: '🏊 Nage',
          value: formatDistance(d.swimCm),
          inline: true
        },
        {
          name: '🪽 Elytra',
          value: formatDistance(d.elytraCm),
          inline: true
        },
        {
          name: '👹 Mobs les plus tués',
          value: listText(d.topMobs),
          inline: false
        },
        {
          name: '⛏️ Blocs les plus minés',
          value: listText(d.topMined),
          inline: false
        }
      )
  );

  const advancementPercent =
    Number(d.advancementTotal || 0) > 0
      ? Math.round(
          Number(d.advancementDone || 0) /
          Number(d.advancementTotal || 1) *
          100
        )
      : 0;

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.progression,
    'Naru Minecraft Bridge • Progression',
    new EmbedBuilder()
      .setTitle('🏆 Progression Minecraft')
      .setColor(0xFEE75C)
      .addFields(
        {
          name: '🏅 Advancements',
          value:
            `**${Number(d.advancementDone || 0)} / ${Number(d.advancementTotal || 0)}** (${advancementPercent} %)`,
          inline: false
        },
        {
          name: '🆕 Derniers débloqués',
          value: listText(d.recentAdvancements),
          inline: false
        }
      )
  );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.challenges,
    'Naru Minecraft Bridge • Défis',
    new EmbedBuilder()
      .setTitle('🎯 Défis Minecraft')
      .setColor(0xEB459E)
      .setDescription(
        'Le suivi automatique est connecté aux statistiques de la save active.'
      )
      .addFields(
        {
          name: '📈 Compteurs disponibles',
          value:
            `Mobs tués : **${Number(d.mobKills || 0)}**\n` +
            `Morts : **${Number(d.deaths || 0)}**\n` +
            `Sauts : **${Number(d.jumps || 0).toLocaleString('fr-FR')}**\n` +
            `Advancements : **${Number(d.advancementDone || 0)}**`
        },
        {
          name: 'ℹ️ État',
          value:
            'Les défis automatiques pourront utiliser directement ces compteurs.'
        }
      )
  );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.journal,
    'Naru Minecraft Bridge • Journal',
    new EmbedBuilder()
      .setTitle('📜 Journal Minecraft')
      .setColor(0x3498DB)
      .setDescription(
        `Dernière activité détectée sur **${safeText(d.world)}**.`
      )
      .addFields(
        {
          name: '📦 Instance',
          value: safeText(d.instance),
          inline: true
        },
        {
          name: '🌌 Dimension',
          value: safeText(d.dimension),
          inline: true
        },
        {
          name: '📍 Position actuelle',
          value:
            `${Number(d.x || 0).toFixed(0)}, ${Number(d.y || 0).toFixed(0)}, ${Number(d.z || 0).toFixed(0)}`,
          inline: false
        },
        {
          name: '🕒 Activité',
          value: `<t:${unix}:R>`,
          inline: false
        }
      )
  );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.commands,
    'Naru Minecraft Bridge • Commandes',
    new EmbedBuilder()
      .setTitle('⚙️ Commandes Minecraft')
      .setColor(0x95A5A6)
      .setDescription(
        'Le Bridge fonctionne automatiquement : aucune commande n’est nécessaire pour synchroniser la save.'
      )
      .addFields(
        {
          name: '🔄 Synchronisation',
          value:
            'Lance Minecraft via CurseForge et ouvre un monde. Les données sont actualisées automatiquement.'
        },
        {
          name: '🌍 Changer de monde',
          value:
            'Ouvre simplement une autre save : le Bridge basculera automatiquement dessus.'
        }
      )
  );

  await syncDataChannel(
    member,
    category,
    CHANNEL_NAMES.help,
    'Naru Minecraft Bridge • Aide Auto',
    new EmbedBuilder()
      .setTitle('🆘 Minecraft Game Bridge')
      .setColor(0x5865F2)
      .setDescription(
        'Ton espace Minecraft est alimenté automatiquement à partir de la save CurseForge active.'
      )
      .addFields(
        {
          name: '📡 Données détectées',
          value:
            'Monde, joueur, position, vie, nourriture, XP, statistiques, déplacements, mobs, blocs minés et advancements.'
        },
        {
          name: '🔒 Confidentialité du Player Space',
          value:
            'Les données sont publiées uniquement dans ton espace Minecraft privé configuré sur le serveur.'
        }
      )
  );

  return true;
}

// ============================================================
// PANNEAU DE CONNEXION
// ============================================================

function buildLinkButtons(user) {
  const row =
    new ActionRowBuilder();

  if (
    MINECRAFT_DOWNLOAD_URL
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setLabel(
          'Télécharger le Bridge'
        )
        .setEmoji('⬇️')
        .setStyle(
          ButtonStyle.Link
        )
        .setURL(
          MINECRAFT_DOWNLOAD_URL
        )
    );

  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          'minecraft_download_not_ready'
        )
        .setLabel(
          'Télécharger le Bridge'
        )
        .setEmoji('⬇️')
        .setStyle(
          ButtonStyle.Secondary
        )
        .setDisabled(true)
    );
  }

  if (!user.linked) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          BUTTON_GENERATE_CODE
        )
        .setLabel(
          user.linkCode
            ? 'Regénérer mon code'
            : 'Générer mon code'
        )
        .setEmoji('🔑')
        .setStyle(
          ButtonStyle.Primary
        )
    );

  } else {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(
          BUTTON_RELINK
        )
        .setLabel(
          'Relier le Bridge'
        )
        .setEmoji('🔄')
        .setStyle(
          ButtonStyle.Primary
        )
    );
  }

  return [row];
}

async function updateLinkPanel(
  member,
  category
) {
  const channel =
    findChannel(
      member.guild,
      category,
      CHANNEL_NAMES.connection
    );

  if (!channel) {
    return false;
  }

  const user =
    ensureUserData(member);

  let description;

  if (user.linked) {
    description = [
      `Bienvenue <@${member.id}>.`,
      '',
      'Ton installation **Minecraft Java** est connectée à ton espace personnel Naru Gaming Command.',
      '',
      '### 🔐 Code de liaison',
      '`••••-••••-••••`',
      '',
      '🟢 **Statut : LIÉ**',
      '',
      '🔒 Le code utilisé pour effectuer la liaison a été détruit et désactivé.',
      '',
      `💻 **Installation :** \`${user.installationId || '?'}\``,
      `🕒 **Dernière connexion :** ${
        user.lastSeenAt
          ? `<t:${Math.floor(
              new Date(
                user.lastSeenAt
              ).getTime() / 1000
            )}:R>`
          : 'En attente'
      }`,
      '',
      '✅ **La configuration est terminée.**',
      '',
      'Lorsque Minecraft Java sera lancé via CurseForge, Naru Minecraft Bridge pourra synchroniser automatiquement tes données.',
      '',
      '⚠️ En cas de changement de PC ou de réinstallation, utilise **Relier le Bridge**.'
    ].join('\n');

  } else if (
    user.linkCode
  ) {
    description = [
      `Bienvenue <@${member.id}>.`,
      '',
      'Tu as commencé la configuration de **Naru Minecraft Bridge**.',
      '',
      '### 1️⃣ Télécharger le Bridge',
      'Installe Naru Minecraft Bridge sur ton PC.',
      '',
      '### 2️⃣ Ton code de liaison',
      `\`${user.linkCode}\``,
      '',
      '🟡 **Statut : CODE GÉNÉRÉ — EN ATTENTE DE LIAISON**',
      '',
      '### 3️⃣ Dans Naru Minecraft Bridge',
      'Lance le programme puis entre le code affiché ci-dessus.',
      '',
      'Dès que la liaison est validée :',
      '• le code sera désactivé ;',
      '• ton installation sera associée à ton Discord ;',
      '• le token de connexion sera enregistré automatiquement.',
      '',
      '⚠️ **Ne partage pas ce code.**'
    ].join('\n');

  } else {
    description = [
      `Bienvenue <@${member.id}>.`,
      '',
      'Ce salon permet de connecter **Minecraft Java** à ton espace personnel Naru Gaming Command.',
      '',
      '## 📥 Installation',
      '',
      '**1.** Télécharge et installe **Naru Minecraft Bridge**.',
      '',
      '**2.** Reviens ici puis clique sur **Générer mon code**.',
      '',
      '**3.** Lance le Bridge et entre le code personnel.',
      '',
      '**4.** Valide la liaison.',
      '',
      '**5.** Le Bridge détectera ensuite automatiquement Minecraft Java lancé depuis CurseForge.',
      '',
      '⚪ **Statut : NON LIÉ**',
      '',
      '🔐 Aucun code de liaison n’a encore été généré.'
    ].join('\n');
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        '🔗 Connexion Minecraft'
      )
      .setColor(
        user.linked
          ? 0x57F287
          : (
              user.linkCode
                ? 0xFEE75C
                : 0x5865F2
            )
      )
      .setDescription(
        description
      )
      .setFooter({
        text:
          'Naru Minecraft Bridge • Liaison'
      })
      .setTimestamp();

  const components =
    buildLinkButtons(user);

  const oldMessage =
    await findLinkMessage(
      channel
    );

  if (oldMessage) {
    await oldMessage.edit({
      content: null,
      embeds: [embed],
      components
    });

  } else {
    await channel.send({
      embeds: [embed],
      components
    });
  }

  return true;
}

// ============================================================
// BOUTONS
// ============================================================

async function handleGenerateCodeButton(
  interaction
) {
  if (!interaction.inGuild()) {
    return;
  }

  const member =
    interaction.member;

  if (!member) {
    return;
  }

  if (
    !member.roles.cache.has(
      MINECRAFT_ROLE_ID
    )
  ) {
    await interaction.reply({
      content:
        '❌ Tu ne possèdes pas le rôle Minecraft.',
      ephemeral: true
    });

    return;
  }

  const category =
    findMinecraftCategory(
      interaction.guild,
      member
    );

  if (!category) {
    await interaction.reply({
      content:
        '❌ Ton espace personnel Minecraft est introuvable.',
      ephemeral: true
    });

    return;
  }

  const connectionChannel =
    findChannel(
      interaction.guild,
      category,
      CHANNEL_NAMES.connection
    );

  if (
    !connectionChannel ||
    interaction.channelId !==
      connectionChannel.id
  ) {
    await interaction.reply({
      content:
        '❌ Ce bouton ne peut être utilisé que dans ton espace Minecraft personnel.',
      ephemeral: true
    });

    return;
  }

  const current =
    ensureUserData(member);

  if (current.linked) {
    await interaction.reply({
      content:
        '✅ Ton installation Minecraft est déjà liée.',
      ephemeral: true
    });

    return;
  }

  await interaction.deferReply({
    ephemeral: true
  });

  const result =
    createUserLinkCode(member);

  if (!result.ok) {
    await interaction.editReply({
      content:
        '❌ Impossible de générer le code.'
    });

    return;
  }

  await updateLinkPanel(
    member,
    category
  );

  await interaction.editReply({
    content: [
      '🔑 **Ton code de liaison Minecraft a été généré.**',
      '',
      `Code : \`${result.user.linkCode}\``,
      '',
      'Entre ce code dans **Naru Minecraft Bridge**.',
      '',
      '⚠️ Ne partage pas ce code.'
    ].join('\n')
  });

  console.log(
    `🔑 Code Minecraft généré pour ${member.user.tag}`
  );
}

async function handleRelinkButton(
  interaction
) {
  if (!interaction.inGuild()) {
    return;
  }

  const member =
    interaction.member;

  if (!member) {
    return;
  }

  if (
    !member.roles.cache.has(
      MINECRAFT_ROLE_ID
    )
  ) {
    await interaction.reply({
      content:
        '❌ Tu ne possèdes pas le rôle Minecraft.',
      ephemeral: true
    });

    return;
  }

  const category =
    findMinecraftCategory(
      interaction.guild,
      member
    );

  if (!category) {
    await interaction.reply({
      content:
        '❌ Ton espace personnel Minecraft est introuvable.',
      ephemeral: true
    });

    return;
  }

  await interaction.deferReply({
    ephemeral: true
  });

  const result =
    createRelinkCode(member);

  await updateLinkPanel(
    member,
    category
  );

  await interaction.editReply({
    content: [
      '🔄 **Nouvelle liaison Minecraft créée.**',
      '',
      `Code : \`${result.user.linkCode}\``,
      '',
      'L’ancienne installation a été désactivée.',
      '',
      'Entre ce nouveau code dans Naru Minecraft Bridge.',
      '',
      '⚠️ Ne partage pas ce code.'
    ].join('\n')
  });

  console.log(
    `🔄 Reliaison Minecraft demandée pour ${member.user.tag}`
  );
}

function startInteractionListener(
  client
) {
  if (
    interactionListenerStarted
  ) {
    return;
  }

  interactionListenerStarted =
    true;

  client.on(
    'interactionCreate',
    async interaction => {
      try {
        if (
          !interaction.isButton()
        ) {
          return;
        }

        if (
          interaction.customId ===
          BUTTON_GENERATE_CODE
        ) {
          await handleGenerateCodeButton(
            interaction
          );

          return;
        }

        if (
          interaction.customId ===
          BUTTON_RELINK
        ) {
          await handleRelinkButton(
            interaction
          );
        }

      } catch (error) {
        console.error(
          '❌ Minecraft : erreur bouton liaison :',
          error
        );
      }
    }
  );
}

// ============================================================
// ATTENTE PLAYER SPACE
// ============================================================

function sleep(ms) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

async function waitForMinecraftSpace(
  member
) {
  for (
    let attempt = 1;
    attempt <= 20;
    attempt++
  ) {
    const category =
      findMinecraftCategory(
        member.guild,
        member
      );

    if (category) {
      const connectionChannel =
        findChannel(
          member.guild,
          category,
          CHANNEL_NAMES.connection
        );

      if (connectionChannel) {
        console.log(
          `🔗 Salon connexion Minecraft prêt pour ${member.user.tag}`
        );

        await updateLinkPanel(
          member,
          category
        );

        console.log(
          `✅ Panneau Minecraft envoyé pour ${member.user.tag}`
        );

        return true;
      }
    }

    console.log(
      `⏳ Minecraft : attente espace de ${member.user.tag} (${attempt}/20)`
    );

    await sleep(1500);
  }

  console.error(
    `❌ Minecraft : espace incomplet pour ${member.user.tag}`
  );

  return false;
}

function startMinecraftMemberListener(
  client
) {
  if (
    memberUpdateListenerStarted
  ) {
    return;
  }

  memberUpdateListenerStarted =
    true;

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        const hadRole =
          oldMember.roles.cache.has(
            MINECRAFT_ROLE_ID
          );

        const hasRole =
          newMember.roles.cache.has(
            MINECRAFT_ROLE_ID
          );

        if (
          !hadRole &&
          hasRole
        ) {
          console.log(
            `⛏️ Minecraft Bridge : nouveau joueur détecté → ${newMember.user.tag}`
          );

          await waitForMinecraftSpace(
            newMember
          );
        }

      } catch (error) {
        console.error(
          '❌ Minecraft : erreur détection rôle :',
          error
        );
      }
    }
  );
}

// ============================================================
// SYNCHRONISATION DES PANNEAUX
// ============================================================

async function syncLinkPanels() {
  if (!discordClient) {
    return;
  }

  for (
    const guild
    of discordClient.guilds.cache.values()
  ) {
    try {
      await guild.members.fetch();
    } catch (error) {
      console.error(
        `❌ Minecraft : impossible de récupérer les membres de ${guild.name} :`,
        error.message
      );
    }

    for (
      const member
      of guild.members.cache.values()
    ) {
      if (
        member.user?.bot
      ) {
        continue;
      }

      if (
        !member.roles.cache.has(
          MINECRAFT_ROLE_ID
        )
      ) {
        continue;
      }

      try {
        await waitForMinecraftSpace(
          member
        );

      } catch (error) {
        console.error(
          `❌ Minecraft : panneau liaison ${member.user?.tag || member.id} :`,
          error.message
        );
      }
    }
  }
}

// ============================================================
// ROUTES HTTP MINECRAFT
// ============================================================

async function handleMinecraftRequest(
  request,
  response
) {
  let url;

  try {
    url =
      new URL(
        request.url,
        'http://localhost'
      );

  } catch {
    return false;
  }

  if (
    !url.pathname.startsWith(
      '/minecraft/'
    )
  ) {
    return false;
  }

  if (
    request.method ===
    'OPTIONS'
  ) {
    response.writeHead(
      204,
      {
        'Access-Control-Allow-Origin':
          '*',

        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Minecraft-Installation-Id',

        'Access-Control-Allow-Methods':
          'GET, POST, OPTIONS'
      }
    );

    response.end();

    return true;
  }

  // ----------------------------------------------------------
  // STATUS
  // ----------------------------------------------------------

  if (
    request.method === 'GET' &&
    url.pathname ===
      '/minecraft/status'
  ) {
    sendJson(
      response,
      200,
      {
        ok: true,
        service:
          'Naru Minecraft Bridge',
        game:
          'Minecraft Java',
        launcher:
          'CurseForge'
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // LIAISON
  // ----------------------------------------------------------

  if (
    request.method === 'POST' &&
    url.pathname ===
      '/minecraft/link'
  ) {
    try {
      const body =
        await readJsonBody(
          request
        );

      const code =
        String(
          body.code || ''
        )
          .trim()
          .toUpperCase();

      const installationId =
        String(
          body.installationId ||
          ''
        ).trim();

      if (
        !code ||
        !installationId
      ) {
        sendJson(
          response,
          400,
          {
            ok: false,
            error:
              'Code ou installationId manquant.'
          }
        );

        return true;
      }

      const found =
        findUserByCode(code);

      if (!found) {
        sendJson(
          response,
          404,
          {
            ok: false,
            error:
              'Code de liaison invalide ou expiré.'
          }
        );

        return true;
      }

      const discord =
        await findDiscordMember(
          found.userId
        );

      if (
        !discord ||
        !discord.member.roles.cache.has(
          MINECRAFT_ROLE_ID
        )
      ) {
        sendJson(
          response,
          403,
          {
            ok: false,
            error:
              'Compte Discord Minecraft introuvable.'
          }
        );

        return true;
      }

      const token =
        generateToken();

      found.user.linked =
        true;

      found.user.installationId =
        installationId;

      found.user.tokenHash =
        hashToken(token);

      found.user.linkedAt =
        new Date().toISOString();

      found.user.lastSeenAt =
        new Date().toISOString();

      found.user.linkCode =
        null;

      found.user.linkCodeConsumedAt =
        new Date().toISOString();

      found.data.users[
        found.userId
      ] = found.user;

      saveData(
        found.data
      );

      const category =
        findMinecraftCategory(
          discord.guild,
          discord.member
        );

      if (category) {
        await updateLinkPanel(
          discord.member,
          category
        );
      }

      console.log(
        `🔗 Minecraft lié → ${discord.member.user.tag}`
      );

      sendJson(
        response,
        200,
        {
          ok: true,

          token,

          discordUserId:
            found.userId,

          discordName:
            discord.member.user.tag
        }
      );

      return true;

    } catch (error) {
      console.error(
        '❌ Minecraft : erreur liaison :',
        error
      );

      sendJson(
        response,
        500,
        {
          ok: false,
          error:
            'Erreur pendant la liaison.'
        }
      );

      return true;
    }
  }

  // ----------------------------------------------------------
  // PING AUTHENTIFIÉ
  // ----------------------------------------------------------

  if (
    request.method === 'POST' &&
    url.pathname ===
      '/minecraft/ping'
  ) {
    const auth =
      authenticateInstallation(
        request
      );

    if (!auth) {
      sendJson(
        response,
        401,
        {
          ok: false,
          error:
            'Authentification invalide.'
        }
      );

      return true;
    }

    auth.user.lastSeenAt =
      new Date().toISOString();

    auth.data.users[
      auth.userId
    ] = auth.user;

    saveData(
      auth.data
    );

    sendJson(
      response,
      200,
      {
        ok: true,
        linked: true
      }
    );

    return true;
  }

  // ----------------------------------------------------------
  // SYNCHRONISATION MONDE / SAVE ACTIVE
  // ----------------------------------------------------------

  if (
    request.method === 'POST' &&
    url.pathname ===
      '/minecraft/sync'
  ) {
    const auth =
      authenticateInstallation(
        request
      );

    if (!auth) {
      sendJson(
        response,
        401,
        {
          ok: false,
          error:
            'Authentification invalide.'
        }
      );

      return true;
    }

    try {
      const body =
        await readJsonBody(
          request
        );

      const minecraftData =
        body.data &&
        typeof body.data === 'object'
          ? body.data
          : {};

      const instance =
        String(
          minecraftData.instance || ''
        ).trim();

      const world =
        String(
          minecraftData.world || ''
        ).trim();

      if (
        !instance ||
        !world
      ) {
        sendJson(
          response,
          400,
          {
            ok: false,
            error:
              'Instance ou save active manquante.'
          }
        );

        return true;
      }

      const discord =
        await findDiscordMember(
          auth.userId
        );

      if (!discord) {
        sendJson(
          response,
          404,
          {
            ok: false,
            error:
              'Compte Discord introuvable.'
          }
        );

        return true;
      }

      const category =
        findMinecraftCategory(
          discord.guild,
          discord.member
        );

      if (!category) {
        sendJson(
          response,
          404,
          {
            ok: false,
            error:
              'Player Space Minecraft introuvable.'
          }
        );

        return true;
      }

      await syncAllMinecraftChannels(
        discord.member,
        category,
        body
      );

      auth.user.lastSeenAt =
        new Date().toISOString();

      auth.user.lastInstance =
        instance;

      auth.user.lastWorld =
        world;

      auth.data.users[
        auth.userId
      ] = auth.user;

      saveData(
        auth.data
      );

      await updateLinkPanel(
        discord.member,
        category
      );

      sendJson(
        response,
        200,
        {
          ok: true,
          synced: true,
          instance,
          world
        }
      );

      return true;

    } catch (error) {
      console.error(
        '❌ Minecraft : erreur synchronisation monde :',
        error
      );

      sendJson(
        response,
        500,
        {
          ok: false,
          error:
            'Erreur pendant la synchronisation Minecraft.'
        }
      );

      return true;
    }
  }

  // ----------------------------------------------------------
  // ROUTE MINECRAFT INCONNUE
  // ----------------------------------------------------------

  sendJson(
    response,
    404,
    {
      ok: false,
      error:
        'Route Minecraft inconnue.'
    }
  );

  return true;
}

// ============================================================
// DÉMARRAGE
// ============================================================

function startMinecraftBridge(
  client
) {
  discordClient = client;

  ensureDataFile();

  startInteractionListener(
    client
  );

  startMinecraftMemberListener(
    client
  );

  setTimeout(
    () => {
      syncLinkPanels()
        .catch(
          error => {
            console.error(
              '❌ Minecraft : synchronisation panneaux :',
              error
            );
          }
        );
    },
    1000
  );

  console.log(
    '⛏️ Minecraft Bridge initialisé'
  );

  console.log(
    '🔗 Minecraft : système de liaison prêt'
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startMinecraftBridge,
  handleMinecraftRequest
};
