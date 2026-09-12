const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND
// ACOLONY — PLAYER SPACES
// ============================================================

const ACOLONY_ROLE_ID =
  '1548387660517609572';

const CATEGORY_PREFIX =
  '🏭 AColony — ';

// ============================================================
// NOM DE LA CATÉGORIE
// ============================================================

function getCategoryName(member) {
  return `${CATEGORY_PREFIX}${member.displayName}`;
}

// ============================================================
// TROUVER LA CATÉGORIE DU JOUEUR
// ============================================================

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

// ============================================================
// TROUVER UN SALON
// ============================================================

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

// ============================================================
// MESSAGE D'AIDE
// ============================================================

async function sendHelpMessage(
  channel,
  member
) {
  try {
    const message = [
      `👋 Bienvenue ${member} dans ton espace AColony personnel.`,
      '',
      'Cet espace est privé et te permet de retrouver toutes les informations envoyées par **Naru Gaming Command** depuis ton jeu AColony.',
      '',
      'Voici à quoi correspondent les différents salons :',
      '',
      '👤 **・colonie**',
      'Les informations générales concernant ta colonie : progression, niveau, état général et autres données récupérables.',
      '',
      '🏭 **・production**',
      'Les informations concernant tes productions, bâtiments, chaînes de fabrication et rendement de ta colonie.',
      '',
      '📦 **・stockage**',
      'Les informations concernant les ressources, objets et stocks disponibles dans ta colonie.',
      '',
      '👥 **・colons**',
      'Les informations concernant tes colons : nombre, état, activités et autres données récupérables.',
      '',
      '📊 **・statistiques**',
      'Tes différentes statistiques AColony récupérées automatiquement par le Bridge.',
      '',
      '🎯 **・défis**',
      'Tes futurs défis AColony quotidiens et leur progression suivie automatiquement par le Bridge.',
      '',
      '🧩 **・mods**',
      'Les mods détectés comme actifs pour ta partie AColony et les informations disponibles à leur sujet.',
      '',
      '📜 **・journal**',
      'Ton journal AColony. Il pourra afficher certains événements importants détectés pendant ta partie.',
      '',
      '⚙️ **・commandes**',
      'Le statut de ton Naru AColony Bridge, les synchronisations et les futures commandes disponibles.',
      '',
      '🆘 **・aide**',
      'Ce salon est prévu si tu rencontres un problème avec ton espace AColony, le Bridge, tes données ou si tu as besoin de l’aide d’un membre du staff.',
      '',
      'Tu peux simplement expliquer ton problème ici et un membre du staff pourra venir t’aider.',
      '',
      '⚠️ Pense à laisser **Naru AColony Bridge Client** ouvert sur ton PC lorsque tu joues afin que tes informations puissent être synchronisées.',
      '',
      '🏭 **Naru Gaming Command — AColony Game Bridge**'
    ].join('\n');

    await channel.send(
      message
    );

    console.log(
      `📨 Message d'aide AColony initial envoyé pour ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      `❌ Impossible d'envoyer le message d'aide AColony pour ${member.user.tag} :`,
      error
    );
  }
}

// ============================================================
// CRÉER L'ESPACE ACOLONY
// ============================================================

async function createAColonyPlayerSpace(
  member
) {
  const guild =
    member.guild;

  if (
    member.user.bot
  ) {
    return null;
  }

  if (
    !member.roles.cache.has(
      ACOLONY_ROLE_ID
    )
  ) {
    return null;
  }

  // ==========================================================
  // CATÉGORIE
  // ==========================================================

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
      `🏭 Catégorie AColony créée pour ${member.user.tag}`
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

  // ==========================================================
  // SALONS
  // ==========================================================

  const channels = [
    '👤・colonie',
    '🏭・production',
    '📦・stockage',
    '👥・colons',
    '📊・statistiques',
    '🎯・défis',
    '🧩・mods',
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

    // Message envoyé uniquement
    // lors de la création du salon aide.

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

  console.log(
    `✅ Espace AColony prêt pour ${member.user.tag}`
  );

  return {
    category,
    channels:
      createdChannels
  };
}

// ============================================================
// SUPPRIMER L'ESPACE ACOLONY
// ============================================================

async function deleteAColonyPlayerSpace(
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
      `ℹ️ Aucun espace AColony trouvé pour ${member.user.tag}`
    );

    return;
  }

  console.log('');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    '🗑️ SUPPRESSION ESPACE ACOLONY'
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    `👤 ${member.user.tag}`
  );

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
        'Rôle AColony retiré'
      );

      console.log(
        `🗑️ Salon AColony supprimé : ${channelName}`
      );

    } catch (error) {
      console.error(
        `❌ Impossible de supprimer le salon AColony ${channel.name} :`,
        error
      );
    }
  }

  try {
    await category.delete(
      'Rôle AColony retiré'
    );

    console.log(
      `🗑️ Catégorie AColony supprimée pour ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      '❌ Impossible de supprimer la catégorie AColony :',
      error
    );
  }

  console.log(
    `✅ Espace AColony supprimé pour ${member.user.tag}`
  );
}

// ============================================================
// SYNCHRONISER LES MEMBRES EXISTANTS
// ============================================================

async function syncExistingAColonyMembers(
  client
) {
  for (
    const guild
    of client.guilds.cache.values()
  ) {
    try {
      // On utilise uniquement le cache.
      // Le gestionnaire général récupère déjà
      // les membres du serveur.

      const members =
        guild.members.cache.filter(
          member =>
            !member.user.bot &&
            member.roles.cache.has(
              ACOLONY_ROLE_ID
            )
        );

      console.log(
        `🏭 ${members.size} membre(s) AColony détecté(s) dans le cache sur ${guild.name}`
      );

      for (
        const member
        of members.values()
      ) {
        await createAColonyPlayerSpace(
          member
        );
      }

    } catch (error) {
      console.error(
        `❌ Vérification AColony impossible sur ${guild.name} :`,
        error
      );
    }
  }
}

// ============================================================
// MODULE PRINCIPAL
// ============================================================

function startAColonyPlayerSpaces(
  client
) {
  console.log(
    '🏭 AColony Player Spaces : module chargé'
  );

  // ==========================================================
  // CHANGEMENTS DE RÔLES
  // ==========================================================

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        const hadAColonyRole =
          oldMember.roles.cache.has(
            ACOLONY_ROLE_ID
          );

        const hasAColonyRole =
          newMember.roles.cache.has(
            ACOLONY_ROLE_ID
          );

        // RÔLE AJOUTÉ

        if (
          !hadAColonyRole &&
          hasAColonyRole
        ) {
          console.log('');
          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            '🏭 RÔLE ACOLONY ATTRIBUÉ'
          );

          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            `👤 ${newMember.user.tag}`
          );

          await createAColonyPlayerSpace(
            newMember
          );
        }

        // RÔLE RETIRÉ

        if (
          hadAColonyRole &&
          !hasAColonyRole
        ) {
          console.log('');
          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            '⚠️ RÔLE ACOLONY RETIRÉ'
          );

          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            `👤 ${newMember.user.tag}`
          );

          await deleteAColonyPlayerSpace(
            newMember
          );
        }

      } catch (error) {
        console.error(
          '❌ Erreur AColony Player Spaces :',
          error
        );
      }
    }
  );

  // ==========================================================
  // SYNCHRONISATION AU DÉMARRAGE
  // ==========================================================

  syncExistingAColonyMembers(
    client
  );

  setTimeout(
    () => {
      syncExistingAColonyMembers(
        client
      );
    },
    5000
  );

  setTimeout(
    () => {
      syncExistingAColonyMembers(
        client
      );
    },
    15000
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startAColonyPlayerSpaces,
  createAColonyPlayerSpace,
  deleteAColonyPlayerSpace,
  findPlayerCategory
};
