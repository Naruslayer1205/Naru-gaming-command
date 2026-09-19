const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND
// MINECRAFT — PLAYER SPACES
// ============================================================

// ============================================================
// CONFIGURATION
// ============================================================

const MINECRAFT_ROLE_ID =
  '1550948318639554620';

const CATEGORY_PREFIX =
  '⛏️ Minecraft — ';

// ============================================================
// SALONS PERSONNELS
// ============================================================

const PLAYER_CHANNELS = [
  '👤・joueur',
  '🌍・monde',
  '📊・statistiques',
  '🏆・progression',
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

function hasMinecraftRole(
  member
) {
  if (
    !member
  ) {
    return false;
  }

  return member.roles.cache.has(
    MINECRAFT_ROLE_ID
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
    `# ⛏️ Espace Minecraft de ${member.displayName}`,
    '',
    'Bienvenue dans ton espace personnel **Minecraft**.',
    '',
    'Les informations de tes parties Minecraft seront automatiquement regroupées ici par **Naru Gaming Command — Minecraft Game Bridge**.',
    '',
    '## 📂 Salons',
    '',
    '👤 **joueur**',
    'Informations sur ton joueur Minecraft et ton profil.',
    '',
    '🌍 **monde**',
    'Informations sur le monde actuellement détecté par le Bridge.',
    '',
    '📊 **statistiques**',
    'Tes statistiques Minecraft : blocs, créatures, déplacements et autres données disponibles.',
    '',
    '🏆 **progression**',
    'Suivi de ta progression et de tes accomplissements Minecraft.',
    '',
    '🎯 **défis**',
    'Défis Minecraft proposés par Naru Gaming Command.',
    '',
    '📜 **journal**',
    'Événements importants détectés pendant tes sessions Minecraft.',
    '',
    '⚙️ **commandes**',
    'Commandes et outils disponibles avec le Minecraft Game Bridge.',
    '',
    '🔗 **connexion**',
    'État de connexion entre Minecraft, le client Bridge et Discord.',
    '',
    '🆘 **aide**',
    'Aide et informations concernant ton espace personnel Minecraft.',
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
    `⛏️ Minecraft : création ${channelName} pour ${member.user.tag}`
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
          `Naru Gaming Command — Player Space Minecraft de ${member.user.tag}`
      }
    );

  return channel;
}

// ============================================================
// CRÉATION PLAYER SPACE
// ============================================================

async function createMinecraftPlayerSpace(
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
    !hasMinecraftRole(
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
      `⛏️ Création espace Minecraft pour ${member.user.tag}...`
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
            `Naru Gaming Command — Player Space Minecraft de ${member.user.tag}`
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
          'Naru Gaming Command — mise à jour du nom Minecraft'
        );

      } catch (
        error
      ) {
        console.warn(
          `⚠️ Minecraft : impossible de renommer la catégorie de ${member.user.tag} :`,
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
        `❌ Minecraft : impossible de créer ${channelName} pour ${member.user.tag} :`,
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
              'Espace Minecraft'
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
        `⚠️ Minecraft : message d'aide impossible pour ${member.user.tag} :`,
        error.message
      );
    }
  }

  console.log(
    `✅ Espace Minecraft prêt pour ${member.user.tag}`
  );

  return category;
}

// ============================================================
// SUPPRESSION PLAYER SPACE
// ============================================================

async function deleteMinecraftPlayerSpace(
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
    `⛏️ Suppression espace Minecraft de ${member.user.tag}...`
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
        `Naru Gaming Command — rôle Minecraft retiré à ${member.user.tag}`
      );

    } catch (
      error
    ) {
      console.error(
        `❌ Minecraft : impossible de supprimer ${channel.name} :`,
        error.message
      );
    }
  }

  // ==========================================================
  // SUPPRESSION CATÉGORIE
  // ==========================================================

  try {
    await category.delete(
      `Naru Gaming Command — rôle Minecraft retiré à ${member.user.tag}`
    );

    console.log(
      `✅ Espace Minecraft supprimé pour ${member.user.tag}`
    );

  } catch (
    error
  ) {
    console.error(
      `❌ Minecraft : impossible de supprimer la catégorie de ${member.user.tag} :`,
      error
    );
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createMinecraftPlayerSpace,
  deleteMinecraftPlayerSpace,
  findPlayerCategory,

  MINECRAFT_ROLE_ID,
  CATEGORY_PREFIX,
  PLAYER_CHANNELS
};
