const fs = require('fs');
const path = require('path');

const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND
// ATS / ETS2 — PLAYER SPACES
// ============================================================

const ATS_ROLE_ID =
  '1546760053741064242';

const ETS2_ROLE_ID =
  '1546760060879765544';

const DATA_DIR =
  path.join(
    __dirname,
    'data'
  );

const DATA_FILE =
  path.join(
    DATA_DIR,
    'player-spaces.json'
  );

// ============================================================
// CONFIGURATION DES ESPACES
// ============================================================

const GAMES = {
  ats: {
    key: 'ats',

    name:
      'American Truck Simulator',

    shortName:
      'ATS',

    roleId:
      ATS_ROLE_ID,

    categoryEmoji:
      '🇺🇸'
  },

  ets2: {
    key: 'ets2',

    name:
      'Euro Truck Simulator 2',

    shortName:
      'ETS2',

    roleId:
      ETS2_ROLE_ID,

    categoryEmoji:
      '🇪🇺'
  }
};

const PLAYER_CHANNELS = [
  {
    key: 'profil',
    name: '📊・profil'
  },

  {
    key: 'camion',
    name: '🚚・camion'
  },

  {
    key: 'livraison',
    name: '📦・livraison'
  },

  {
    key: 'statistiques',
    name: '📈・statistiques'
  },

  {
    key: 'defis',
    name: '🏆・defis'
  },

  {
    key: 'connexion',
    name: '🔗・connexion'
  }
];

// ============================================================
// SAUVEGARDE
// ============================================================

function ensureDataDirectory() {
  if (
    !fs.existsSync(
      DATA_DIR
    )
  ) {
    fs.mkdirSync(
      DATA_DIR,
      {
        recursive: true
      }
    );
  }
}

function loadData() {
  ensureDataDirectory();

  if (
    !fs.existsSync(
      DATA_FILE
    )
  ) {
    return {};
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        DATA_FILE,
        'utf8'
      )
    );
  } catch (error) {
    console.error(
      '❌ ATS/ETS2 Player Spaces : erreur lecture sauvegarde :',
      error
    );

    return {};
  }
}

function saveData(
  data
) {
  ensureDataDirectory();

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
// OUTILS
// ============================================================

function cleanName(
  value
) {
  return String(
    value || 'joueur'
  )
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase()
    .replace(
      /[^a-z0-9_-]/g,
      '-'
    )
    .replace(
      /-+/g,
      '-'
    )
    .replace(
      /^[-_]+|[-_]+$/g,
      ''
    )
    .slice(
      0,
      50
    ) || 'joueur';
}

function getPlayerName(
  member
) {
  return cleanName(
    member.displayName ||
    member.user?.username ||
    member.id
  );
}

function getPlayerKey(
  guildId,
  userId,
  gameKey
) {
  return `${guildId}:${userId}:${gameKey}`;
}

// ============================================================
// PERMISSIONS
// ============================================================

function buildPermissions(
  guild,
  member
) {
  return [
    {
      id:
        guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        member.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.UseApplicationCommands
      ]
    },

    {
      id:
        guild.members.me.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];
}

// ============================================================
// CRÉATION CATÉGORIE
// ============================================================

async function createPlayerSpace(
  member,
  game
) {
  const guild =
    member.guild;

  const data =
    loadData();

  const playerKey =
    getPlayerKey(
      guild.id,
      member.id,
      game.key
    );

  const existingData =
    data[playerKey];

  if (
    existingData?.categoryId
  ) {
    const existingCategory =
      guild.channels.cache.get(
        existingData.categoryId
      );

    if (
      existingCategory
    ) {
      return existingData;
    }
  }

  const playerName =
    getPlayerName(
      member
    );

  console.log(
    `🚛 Création espace ${game.shortName} pour ${member.user.tag}`
  );

  const category =
    await guild.channels.create({
      name:
        `${game.categoryEmoji}・${playerName}-${game.key}`,

      type:
        ChannelType.GuildCategory,

      permissionOverwrites:
        buildPermissions(
          guild,
          member
        )
    });

  const channels =
    {};

  for (
    const channelConfig
    of PLAYER_CHANNELS
  ) {
    const channel =
      await guild.channels.create({
        name:
          channelConfig.name,

        type:
          ChannelType.GuildText,

        parent:
          category.id,

        permissionOverwrites:
          buildPermissions(
            guild,
            member
          )
      });

    channels[
      channelConfig.key
    ] =
      channel.id;
  }

  data[playerKey] = {
    guildId:
      guild.id,

    userId:
      member.id,

    game:
      game.key,

    categoryId:
      category.id,

    channels,

    createdAt:
      new Date().toISOString()
  };

  saveData(
    data
  );

  const connectionChannel =
    guild.channels.cache.get(
      channels.connexion
    );

  if (
    connectionChannel
  ) {
    await connectionChannel.send({
      content:
        [
          `# ${game.categoryEmoji} ${game.name}`,
          '',
          `Bienvenue <@${member.id}>.`,
          '',
          'Ton espace personnel a été créé automatiquement.',
          '',
          '🔴 **Bridge : non connecté**',
          '',
          'Lorsque le Naru ATS/ETS Bridge sera installé sur ton PC, ce salon affichera automatiquement son état de connexion.'
        ].join('\n')
    });
  }

  console.log(
    `✅ Espace ${game.shortName} créé pour ${member.user.tag}`
  );

  return data[
    playerKey
  ];
}

// ============================================================
// SUPPRESSION CATÉGORIE
// ============================================================

async function deletePlayerSpace(
  member,
  game
) {
  const guild =
    member.guild;

  const data =
    loadData();

  const playerKey =
    getPlayerKey(
      guild.id,
      member.id,
      game.key
    );

  const playerData =
    data[playerKey];

  if (
    !playerData
  ) {
    return;
  }

  console.log(
    `🗑️ Suppression espace ${game.shortName} de ${member.user.tag}`
  );

  if (
    playerData.channels
  ) {
    for (
      const channelId
      of Object.values(
        playerData.channels
      )
    ) {
      const channel =
        guild.channels.cache.get(
          channelId
        );

      if (
        channel
      ) {
        try {
          await channel.delete(
            `Rôle ${game.shortName} retiré`
          );
        } catch (error) {
          console.error(
            `❌ Impossible de supprimer le salon ${channelId} :`,
            error.message
          );
        }
      }
    }
  }

  const category =
    guild.channels.cache.get(
      playerData.categoryId
    );

  if (
    category
  ) {
    try {
      await category.delete(
        `Rôle ${game.shortName} retiré`
      );
    } catch (error) {
      console.error(
        `❌ Impossible de supprimer la catégorie ${game.shortName} :`,
        error.message
      );
    }
  }

  delete data[
    playerKey
  ];

  saveData(
    data
  );

  console.log(
    `✅ Espace ${game.shortName} supprimé pour ${member.user.tag}`
  );
}

// ============================================================
// SYNCHRONISATION D'UN MEMBRE
// ============================================================

async function syncMemberGame(
  member,
  game
) {
  if (
    member.user?.bot
  ) {
    return;
  }

  const hasRole =
    member.roles.cache.has(
      game.roleId
    );

  const data =
    loadData();

  const playerKey =
    getPlayerKey(
      member.guild.id,
      member.id,
      game.key
    );

  const hasSpace =
    Boolean(
      data[playerKey]
    );

  if (
    hasRole &&
    !hasSpace
  ) {
    await createPlayerSpace(
      member,
      game
    );

    return;
  }

  if (
    hasRole &&
    hasSpace
  ) {
    const category =
      member.guild.channels.cache.get(
        data[playerKey].categoryId
      );

    if (
      !category
    ) {
      delete data[
        playerKey
      ];

      saveData(
        data
      );

      await createPlayerSpace(
        member,
        game
      );
    }

    return;
  }

  if (
    !hasRole &&
    hasSpace
  ) {
    await deletePlayerSpace(
      member,
      game
    );
  }
}

async function syncMember(
  member
) {
  await syncMemberGame(
    member,
    GAMES.ats
  );

  await syncMemberGame(
    member,
    GAMES.ets2
  );
}

// ============================================================
// SYNCHRONISATION SERVEUR
// ============================================================

async function syncGuild(
  guild
) {
  console.log(
    `🔄 Vérification espaces ATS/ETS2 sur ${guild.name}...`
  );

  let members;

  try {
    members =
      await guild.members.fetch();
  } catch (error) {
    console.error(
      `❌ Impossible de récupérer les membres de ${guild.name} :`,
      error.message
    );

    return;
  }

  for (
    const member
    of members.values()
  ) {
    try {
      await syncMember(
        member
      );
    } catch (error) {
      console.error(
        `❌ Erreur espace ATS/ETS2 pour ${member.user?.tag || member.id} :`,
        error
      );
    }
  }

  console.log(
    `✅ Vérification ATS/ETS2 terminée sur ${guild.name}`
  );
}

// ============================================================
// RECHERCHE ESPACE POUR LE FUTUR BRIDGE
// ============================================================

function findPlayerSpace(
  guildId,
  userId,
  gameKey
) {
  const data =
    loadData();

  const playerKey =
    getPlayerKey(
      guildId,
      userId,
      gameKey
    );

  return (
    data[playerKey] ||
    null
  );
}

// ============================================================
// DÉMARRAGE
// ============================================================

function startAtsEtsPlayerSpaces(
  client
) {
  console.log(
    '🚛 ATS / ETS2 Player Spaces : module chargé'
  );

  console.log(
    `🇺🇸 Rôle ATS → ${ATS_ROLE_ID}`
  );

  console.log(
    `🇪🇺 Rôle ETS2 → ${ETS2_ROLE_ID}`
  );

  // Vérifie tous les joueurs déjà présents
  // lorsque le bot démarre.

  setTimeout(
    async () => {
      for (
        const guild
        of client.guilds.cache.values()
      ) {
        await syncGuild(
          guild
        );
      }
    },
    3000
  );

  // Détection ajout / retrait d'un rôle.

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        const oldAts =
          oldMember.roles.cache.has(
            ATS_ROLE_ID
          );

        const newAts =
          newMember.roles.cache.has(
            ATS_ROLE_ID
          );

        const oldEts2 =
          oldMember.roles.cache.has(
            ETS2_ROLE_ID
          );

        const newEts2 =
          newMember.roles.cache.has(
            ETS2_ROLE_ID
          );

        if (
          oldAts !==
          newAts
        ) {
          await syncMemberGame(
            newMember,
            GAMES.ats
          );
        }

        if (
          oldEts2 !==
          newEts2
        ) {
          await syncMemberGame(
            newMember,
            GAMES.ets2
          );
        }
      } catch (error) {
        console.error(
          '❌ ATS/ETS2 Player Spaces : erreur changement rôle :',
          error
        );
      }
    }
  );

  // Si un joueur rejoint avec un rôle
  // déjà attribué par un autre système.

  client.on(
    'guildMemberAdd',
    async member => {
      try {
        await syncMember(
          member
        );
      } catch (error) {
        console.error(
          '❌ ATS/ETS2 Player Spaces : erreur arrivée membre :',
          error
        );
      }
    }
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startAtsEtsPlayerSpaces,
  createPlayerSpace,
  deletePlayerSpace,
  findPlayerSpace
};
