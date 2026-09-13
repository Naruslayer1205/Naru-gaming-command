const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND
// ACOLONY — PLAYER SPACES
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const ACOLONY_ROLE_ID =
  '1548387660517609572';

const CATEGORY_PREFIX =
  '🏭 AColony — ';

// ============================================================
// SALONS PERSONNELS
// ============================================================

const PLAYER_CHANNELS = [
  '🏠・colonie',
  '👥・colons',
  '📦・stockage',
  '🏭・production',
  '🔬・recherche',
  '🧱・infrastructure',
  '🐾・animaux',
  '🌦️・monde',
  '📊・statistiques',
  '🎯・défis',
  '📜・journal',
  '⚙️・commandes',
  '🔗・connexion',
  '🆘・aide'
];

// ============================================================
// OUTILS
// ============================================================

function isUsableMember(
  member
) {
  return Boolean(
    member &&
    member.user &&
    !member.user.bot
  );
}

function hasAColonyRole(
  member
) {
  if (
    !member
  ) {
    return false;
  }

  return member.roles.cache.has(
    ACOLONY_ROLE_ID
  );
}

// ============================================================
// NOM DE LA CATÉGORIE
// ============================================================

function getPlayerCategoryName(
  member
) {
  return (
    CATEGORY_PREFIX +
    member.displayName
  );
}

// ============================================================
// TROUVER LA CATÉGORIE PERSONNELLE
// ============================================================

function findPlayerCategory(
  guild,
  member
) {
  if (
    !guild ||
    !member
  ) {
    return null;
  }

  return (
    guild.channels.cache.find(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&

        channel.name.startsWith(
          CATEGORY_PREFIX
        ) &&

        channel.permissionOverwrites.cache.has(
          member.id
        )
    ) ||
    null
  );
}

// ============================================================
// PERMISSIONS CATÉGORIE
// ============================================================

function getCategoryPermissions(
  member
) {
  const botId =
    member.guild.members.me?.id;

  const permissions = [
    {
      id:
        member.guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        member.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }
  ];

  if (
    botId
  ) {
    permissions.push(
      {
        id:
          botId,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    );
  }

  return permissions;
}

// ============================================================
// PERMISSIONS SALONS
// ============================================================

function getChannelPermissions(
  member
) {
  const botId =
    member.guild.members.me?.id;

  const permissions = [
    {
      id:
        member.guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id:
        member.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.UseApplicationCommands
      ]
    }
  ];

  if (
    botId
  ) {
    permissions.push(
      {
        id:
          botId,

        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    );
  }

  return permissions;
}

// ============================================================
// MESSAGE D'AIDE
// ============================================================

function getHelpMessage(
  member
) {
  return [
    `# 🏭 Espace AColony de ${member.displayName}`,
    '',
    'Bienvenue dans ton espace personnel **AColony**.',
    '',
    'Les informations de ta partie seront automatiquement regroupées ici par **Naru Gaming Command — AColony Bridge**.',
    '',
    '## 📂 Salons',
    '',
    '🏠 **colonie**',
    'Informations générales sur ta colonie, ta sauvegarde et ta progression.',
    '',
    '👥 **colons**',
    'État de tes colons : santé, humeur, faim, sommeil, compétences et autres informations.',
    '',
    '📦 **stockage**',
    'Résumé des ressources et objets présents dans les stockages de ta colonie.',
    '',
    '🏭 **production**',
    'Suivi des productions, crafts et objectifs de stock.',
    '',
    '🔬 **recherche**',
    'Technologies débloquées, progression scientifique et recherche actuelle.',
    '',
    '🧱 **infrastructure**',
    'Informations sur les bâtiments et équipements de ta colonie.',
    '',
    '🐾 **animaux**',
    'Informations sur les animaux détectés et ceux liés à ta colonie.',
    '',
    '🌦️ **monde**',
    'Jour, heure, météo et événements concernant ton monde.',
    '',
    '📊 **statistiques**',
    'Tes statistiques de jeu et la progression globale de ta partie.',
    '',
    '🎯 **défis**',
    'Défis AColony proposés par Naru Gaming Command.',
    '',
    '📜 **journal**',
    'Événements importants détectés entre tes sauvegardes.',
    '',
    '⚙️ **commandes**',
    'Commandes et outils du Bridge AColony.',
    '',
    '🔗 **connexion**',
    'État de connexion entre ton jeu, le client AColony et Discord.',
    '',
    '🆘 **aide**',
    'Aide et informations concernant ton espace personnel.',
    '',
    '> 🔒 Cet espace est privé et visible uniquement par toi et le bot.'
  ].join(
    '\n'
  );
}

// ============================================================
// CRÉATION D'UN SALON
// ============================================================

async function createPlayerChannel(
  member,
  category,
  channelName
) {
  const existing =
    member.guild.channels.cache.find(
      channel =>
        channel.parentId ===
          category.id &&

        channel.name ===
          channelName
    );

  if (
    existing
  ) {
    return existing;
  }

  console.log(
    `🏭 AColony : création ${channelName} pour ${member.user.tag}`
  );

  const channel =
    await member.guild.channels.create(
      {
        name:
          channelName,

        type:
          ChannelType.GuildText,

        parent:
          category.id,

        permissionOverwrites:
          getChannelPermissions(
            member
          ),

        reason:
          `Naru Gaming Command — Player Space AColony de ${member.user.tag}`
      }
    );

  return channel;
}

// ============================================================
// CRÉATION PLAYER SPACE
// ============================================================

async function createAColonyPlayerSpace(
  member
) {
  if (
    !isUsableMember(
      member
    )
  ) {
    return null;
  }

  if (
    !hasAColonyRole(
      member
    )
  ) {
    return null;
  }

  const guild =
    member.guild;

  let category =
    findPlayerCategory(
      guild,
      member
    );

  // ==========================================================
  // CRÉATION CATÉGORIE
  // ==========================================================

  if (
    !category
  ) {
    console.log(
      `🏭 Création espace AColony pour ${member.user.tag}...`
    );

    category =
      await guild.channels.create(
        {
          name:
            getPlayerCategoryName(
              member
            ),

          type:
            ChannelType.GuildCategory,

          permissionOverwrites:
            getCategoryPermissions(
              member
            ),

          reason:
            `Naru Gaming Command — Player Space AColony de ${member.user.tag}`
        }
      );

  } else {

    // ========================================================
    // MISE À JOUR DU NOM
    // ========================================================

    const expectedName =
      getPlayerCategoryName(
        member
      );

    if (
      category.name !==
      expectedName
    ) {
      try {
        await category.setName(
          expectedName,
          `Naru Gaming Command — mise à jour du nom AColony`
        );

      } catch (
        error
      ) {
        console.warn(
          `⚠️ AColony : impossible de renommer la catégorie de ${member.user.tag} :`,
          error.message
        );
      }
    }
  }

  // ==========================================================
  // CRÉATION DES SALONS
  // ==========================================================

  const createdChannels =
    {};

  for (
    const channelName
    of PLAYER_CHANNELS
  ) {
    try {
      const channel =
        await createPlayerChannel(
          member,
          category,
          channelName
        );

      createdChannels[
        channelName
      ] =
        channel;

    } catch (
      error
    ) {
      console.error(
        `❌ AColony : impossible de créer ${channelName} pour ${member.user.tag} :`,
        error
      );
    }
  }

  // ==========================================================
  // MESSAGE D'AIDE
  // ==========================================================

  const helpChannel =
    createdChannels[
      '🆘・aide'
    ];

  if (
    helpChannel
  ) {
    try {
      const messages =
        await helpChannel.messages.fetch(
          {
            limit:
              10
          }
        );

      const existingHelp =
        messages.find(
          message =>
            message.author.id ===
              member.guild.members.me?.id &&

            message.content.includes(
              'Espace AColony'
            )
        );

      if (
        !existingHelp
      ) {
        await helpChannel.send(
          getHelpMessage(
            member
          )
        );
      }

    } catch (
      error
    ) {
      console.warn(
        `⚠️ AColony : message d'aide impossible pour ${member.user.tag} :`,
        error.message
      );
    }
  }

  console.log(
    `✅ Espace AColony prêt pour ${member.user.tag}`
  );

  return category;
}

// ============================================================
// SUPPRESSION PLAYER SPACE
// ============================================================

async function deleteAColonyPlayerSpace(
  member
) {
  if (
    !member ||
    !member.guild
  ) {
    return;
  }

  const category =
    findPlayerCategory(
      member.guild,
      member
    );

  if (
    !category
  ) {
    return;
  }

  console.log(
    `🏭 Suppression espace AColony de ${member.user.tag}...`
  );

  // ==========================================================
  // SUPPRESSION DES SALONS
  // ==========================================================

  const children =
    Array.from(
      member.guild.channels.cache.values()
    ).filter(
      channel =>
        channel.parentId ===
          category.id
    );

  for (
    const channel
    of children
  ) {
    try {
      await channel.delete(
        `Naru Gaming Command — rôle AColony retiré à ${member.user.tag}`
      );

    } catch (
      error
    ) {
      console.error(
        `❌ AColony : impossible de supprimer ${channel.name} :`,
        error.message
      );
    }
  }

  // ==========================================================
  // SUPPRESSION CATÉGORIE
  // ==========================================================

  try {
    await category.delete(
      `Naru Gaming Command — rôle AColony retiré à ${member.user.tag}`
    );

    console.log(
      `✅ Espace AColony supprimé pour ${member.user.tag}`
    );

  } catch (
    error
  ) {
    console.error(
      `❌ AColony : impossible de supprimer la catégorie de ${member.user.tag} :`,
      error
    );
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createAColonyPlayerSpace,
  deleteAColonyPlayerSpace,
  findPlayerCategory,

  ACOLONY_ROLE_ID,
  CATEGORY_PREFIX,
  PLAYER_CHANNELS
};
