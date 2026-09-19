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

      const category =
        findMinecraftCategory(
          guild,
          member
        );

      if (!category) {
        continue;
      }

      try {
        await updateLinkPanel(
          member,
          category
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
    3000
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
