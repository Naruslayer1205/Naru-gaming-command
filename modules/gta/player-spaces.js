const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ─────────────────────────────────────
// CONFIGURATION GTA V
// ─────────────────────────────────────

const GTA_ROLE_ID =
  '1546760047105806366';

const CATEGORY_PREFIX =
  '🚘 GTA V — ';

// ─────────────────────────────────────
// NOM DE LA CATÉGORIE
// ─────────────────────────────────────

function getCategoryName(member) {
  return `${CATEGORY_PREFIX}${member.displayName}`;
}

// ─────────────────────────────────────
// TROUVER LA CATÉGORIE DU JOUEUR
// ─────────────────────────────────────

function findPlayerCategory(
  guild,
  userId
) {
  return guild.channels.cache.find(
    channel => {
      if (
        channel.type !==
        ChannelType.GuildCategory
      ) {
        return false;
      }

      if (
        !channel.name.startsWith(
          CATEGORY_PREFIX
        )
      ) {
        return false;
      }

      const permission =
        channel.permissionOverwrites.cache.get(
          userId
        );

      return Boolean(
        permission
      );
    }
  );
}

// ─────────────────────────────────────
// TROUVER UN SALON
// ─────────────────────────────────────

function findChannel(
  guild,
  categoryId,
  name
) {
  return guild.channels.cache.find(
    channel =>
      channel.parentId ===
        categoryId &&
      channel.name ===
        name
  );
}

// ─────────────────────────────────────
// MESSAGE D'AIDE
// ─────────────────────────────────────

async function sendHelpMessage(
  channel,
  member
) {
  try {
    const message = [
      `👋 Bienvenue ${member} dans ton espace GTA V personnel.`,
      '',
      'Cet espace est privé et te permet de retrouver toutes les informations envoyées par **Naru Gaming Command** depuis ton jeu GTA V.',
      '',
      'Voici à quoi correspondent les différents salons :',
      '',
      '👤 **・personnage**',
      'Les informations concernant ton personnage : personnage actuel, santé, armure, argent, arme équipée et autres données récupérables.',
      '',
      '📍 **・position**',
      'Ta localisation actuelle dans GTA V : zone, quartier, rue et autres informations de position disponibles.',
      '',
      '🚗 **・vehicule**',
      'Les informations concernant ton véhicule actuel : modèle, plaque, état, vitesse et autres données récupérables.',
      '',
      '📊 **・statistiques**',
      'Tes statistiques GTA V récupérées par le Bridge : temps de jeu, distance parcourue, véhicules utilisés et autres statistiques disponibles.',
      '',
      '📜 **・journal**',
      'Ton journal GTA V. Il pourra afficher certains événements importants détectés pendant ta partie.',
      '',
      '⚙️ **・commandes**',
      'Le statut de ton Naru GTA V Bridge, les synchronisations et les futures commandes disponibles.',
      '',
      '🆘 **・aide**',
      'Ce salon est prévu si tu rencontres un problème avec ton espace GTA V, le Bridge, tes données ou si tu as besoin de l’aide d’un membre du staff.',
      '',
      'Tu peux simplement expliquer ton problème ici et un membre du staff pourra venir t’aider.',
      '',
      '⚠️ Pense à laisser **Naru GTA V Bridge Client** ouvert sur ton PC lorsque tu joues afin que tes informations puissent être synchronisées.',
      '',
      '🚘 **Naru Gaming Command — GTA V Game Bridge**'
    ].join('\n');

    await channel.send(
      message
    );

    console.log(
      `📨 Message d'aide GTA V initial envoyé pour ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      `❌ Impossible d'envoyer le message d'aide GTA V pour ${member.user.tag} :`,
      error
    );
  }
}

// ─────────────────────────────────────
// CRÉER L'ESPACE GTA V
// ─────────────────────────────────────

async function createGtaPlayerSpace(
  member
) {
  const guild =
    member.guild;

  if (
    member.user.bot
  ) {
    return null;
  }

  // Le membre doit avoir le rôle GTA V

  if (
    !member.roles.cache.has(
      GTA_ROLE_ID
    )
  ) {
    return null;
  }

  // ─────────────────────────────
  // CATÉGORIE
  // ─────────────────────────────

  let category =
    findPlayerCategory(
      guild,
      member.id
    );

  if (!category) {
    category =
      await guild.channels.create({
        name:
          getCategoryName(
            member
          ),

        type:
          ChannelType.GuildCategory,

        permissionOverwrites: [
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
              PermissionFlagsBits.ReadMessageHistory
            ]
          },

          {
            id:
              guild.members.me.id,

            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory
            ]
          }
        ]
      });

    console.log(
      `🚘 Catégorie GTA V créée pour ${member.user.tag}`
    );

  } else {
    const expectedName =
      getCategoryName(
        member
      );

    if (
      category.name !==
      expectedName
    ) {
      await category.setName(
        expectedName
      );
    }
  }

  // ─────────────────────────────
  // SALONS
  // ─────────────────────────────

  const channels = [
    '👤・personnage',
    '📍・position',
    '🚗・vehicule',
    '📊・statistiques',
    '📜・journal',
    '⚙️・commandes',
    '🆘・aide'
  ];

  const createdChannels = {};

  for (
    const channelName
    of channels
  ) {
    let channel =
      findChannel(
        guild,
        category.id,
        channelName
      );

    let channelWasCreated =
      false;

    // ─────────────────────────
    // LE SALON N'EXISTE PAS
    // ─────────────────────────

    if (!channel) {
      channel =
        await guild.channels.create({
          name:
            channelName,

          type:
            ChannelType.GuildText,

          parent:
            category.id,

          permissionOverwrites: [
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
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.SendMessages
              ]
            },

            {
              id:
                guild.members.me.id,

              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

      channelWasCreated =
        true;

      console.log(
        `✅ Salon ${channelName} créé pour ${member.user.tag}`
      );
    }

    createdChannels[
      channelName
    ] = channel;

    // ─────────────────────────
    // MESSAGE D'AIDE
    // UNIQUEMENT À LA CRÉATION
    // DU SALON
    // ─────────────────────────

    if (
      channelName ===
        '🆘・aide' &&
      channelWasCreated
    ) {
      await sendHelpMessage(
        channel,
        member
      );
    }
  }

  console.log('');

  console.log(
    `✅ Espace GTA V prêt pour ${member.user.tag}`
  );

  return {
    category,
    channels:
      createdChannels
  };
}

// ─────────────────────────────────────
// SUPPRIMER L'ESPACE GTA V
// ─────────────────────────────────────

async function deleteGtaPlayerSpace(
  member
) {
  const guild =
    member.guild;

  const category =
    findPlayerCategory(
      guild,
      member.id
    );

  if (!category) {
    console.log(
      `ℹ️ Aucun espace GTA V trouvé pour ${member.user.tag}`
    );

    return;
  }

  console.log('');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    '🗑️ SUPPRESSION ESPACE GTA V'
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    `👤 ${member.user.tag}`
  );

  // ─────────────────────────────
  // SUPPRIMER LES SALONS
  // ─────────────────────────────

  const childChannels =
    guild.channels.cache.filter(
      channel =>
        channel.parentId ===
        category.id
    );

  for (
    const channel
    of childChannels.values()
  ) {
    try {
      const channelName =
        channel.name;

      await channel.delete(
        'Rôle GTA V retiré'
      );

      console.log(
        `🗑️ Salon supprimé : ${channelName}`
      );

    } catch (error) {
      console.error(
        `❌ Impossible de supprimer le salon ${channel.name} :`,
        error
      );
    }
  }

  // ─────────────────────────────
  // SUPPRIMER LA CATÉGORIE
  // ─────────────────────────────

  try {
    await category.delete(
      'Rôle GTA V retiré'
    );

    console.log(
      `🗑️ Catégorie GTA V supprimée pour ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      '❌ Impossible de supprimer la catégorie GTA V :',
      error
    );
  }

  console.log(
    `✅ Espace GTA V supprimé pour ${member.user.tag}`
  );
}

// ─────────────────────────────────────
// SYNCHRONISER LES MEMBRES EXISTANTS
// ─────────────────────────────────────

async function syncExistingGtaMembers(
  client
) {
  for (
    const guild
    of client.guilds.cache.values()
  ) {
    try {
      await guild.members.fetch();

      const members =
        guild.members.cache.filter(
          member =>
            !member.user.bot &&
            member.roles.cache.has(
              GTA_ROLE_ID
            )
        );

      console.log(
        `🚘 ${members.size} membre(s) avec le rôle GTA V sur ${guild.name}`
      );

      for (
        const member
        of members.values()
      ) {
        await createGtaPlayerSpace(
          member
        );
      }

    } catch (error) {
      console.error(
        `❌ Vérification GTA V impossible sur ${guild.name} :`,
        error
      );
    }
  }
}

// ─────────────────────────────────────
// MODULE PRINCIPAL
// ─────────────────────────────────────

function startGtaPlayerSpaces(
  client
) {
  console.log(
    '🚘 GTA V Player Spaces : module chargé'
  );

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        const hadGtaRole =
          oldMember.roles.cache.has(
            GTA_ROLE_ID
          );

        const hasGtaRole =
          newMember.roles.cache.has(
            GTA_ROLE_ID
          );

        // ─────────────────────
        // RÔLE GTA V AJOUTÉ
        // ─────────────────────

        if (
          !hadGtaRole &&
          hasGtaRole
        ) {
          console.log('');
          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            '🚘 RÔLE GTA V ATTRIBUÉ'
          );

          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            `👤 ${newMember.user.tag}`
          );

          await createGtaPlayerSpace(
            newMember
          );
        }

        // ─────────────────────
        // RÔLE GTA V RETIRÉ
        // ─────────────────────

        if (
          hadGtaRole &&
          !hasGtaRole
        ) {
          console.log('');
          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            '⚠️ RÔLE GTA V RETIRÉ'
          );

          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            `👤 ${newMember.user.tag}`
          );

          await deleteGtaPlayerSpace(
            newMember
          );
        }

      } catch (error) {
        console.error(
          '❌ Erreur GTA V Player Spaces :',
          error
        );
      }
    }
  );

  // Vérifie les membres ayant déjà
  // le rôle GTA V au démarrage.
  //
  // Si leur espace existe déjà,
  // aucun nouveau salon n'est créé
  // et aucun nouveau message d'aide
  // n'est envoyé.

  syncExistingGtaMembers(
    client
  );
}

module.exports = {
  startGtaPlayerSpaces,
  createGtaPlayerSpace,
  deleteGtaPlayerSpace,
  findPlayerCategory
};
