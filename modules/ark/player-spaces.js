const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

const CATEGORY_PREFIX =
  '🦖 ARK — ';

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
      `👋 Bienvenue ${member} dans ton espace ARK personnel.`,
      '',
      'Cet espace est privé et te permet de retrouver toutes les informations envoyées par **Naru Gaming Command** depuis ton jeu ARK.',
      '',
      'Voici à quoi correspondent les différents salons :',
      '',
      '👤 **・personnage**',
      'Tes informations de personnage : nom, niveau, expérience, tribu, statistiques, position et autres données récupérables.',
      '',
      '🌍 **・monde**',
      'Les informations concernant ta partie et ta map : monde actuel, sauvegarde, structures, heure, données générales et autres informations disponibles.',
      '',
      '🦕 **・dinos**',
      'Les informations concernant tes dinos apprivoisés : espèce, nom, niveau, sexe, statistiques, imprint, mutations, reproduction, propriétaire, position et autres données disponibles.',
      '',
      '🎯 **・défis**',
      'Tes 3 défis ARK quotidiens : 1 facile, 1 moyen et 1 difficile. Leur progression est suivie automatiquement par ton Naru ARK Bridge.',
      '',
      '🧩 **・mods**',
      'Les mods détectés comme actifs pour ta partie ARK : nom, identifiant et autres informations récupérables selon le jeu et le Bridge.',
      '',
      '💀 **・journal**',
      'Ton journal ARK. Il pourra afficher certains événements importants détectés pendant ta partie.',
      '',
      '⚙️ **・commandes**',
      'Le statut de ton Naru ARK Bridge, les synchronisations et les futures commandes disponibles.',
      '',
      '🆘 **・aide**',
      'Ce salon est prévu si tu rencontres un problème avec ton espace ARK, le Bridge, tes données ou si tu as besoin de l’aide d’un membre du staff.',
      '',
      'Tu peux simplement expliquer ton problème ici et un membre du staff pourra venir t’aider.',
      '',
      '⚠️ Pense à laisser **Naru ARK Bridge Client** ouvert sur ton PC lorsque tu joues afin que tes informations puissent être synchronisées.',
      '',
      '🦖 **Naru Gaming Command — ARK Game Bridge**'
    ].join('\n');

    await channel.send(
      message
    );

    console.log(
      `📨 Message d'aide initial envoyé pour ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      `❌ Impossible d'envoyer le message d'aide pour ${member.user.tag} :`,
      error
    );
  }
}

// ─────────────────────────────────────
// CRÉER L'ESPACE ARK
// ─────────────────────────────────────

async function createArkPlayerSpace(
  member
) {
  const guild =
    member.guild;

  if (!ARK_ROLE_ID) {
    console.error(
      '❌ Variable ARK_ROLE_ID manquante.'
    );

    return null;
  }

  if (
    member.user.bot
  ) {
    return null;
  }

  if (
    !member.roles.cache.has(
      ARK_ROLE_ID
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
      `🦖 Catégorie ARK créée pour ${member.user.tag}`
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
    '🌍・monde',
    '🦕・dinos',
    '🎯・défis',
    '🧩・mods',
    '💀・journal',
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
    `✅ Espace ARK prêt pour ${member.user.tag}`
  );

  return {
    category,
    channels:
      createdChannels
  };
}

// ─────────────────────────────────────
// SUPPRIMER L'ESPACE ARK
// ─────────────────────────────────────

async function deleteArkPlayerSpace(
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
      `ℹ️ Aucun espace ARK trouvé pour ${member.user.tag}`
    );

    return;
  }

  console.log('');
  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    '🗑️ SUPPRESSION ESPACE ARK'
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
        'Rôle ARK retiré'
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

  try {
    await category.delete(
      'Rôle ARK retiré'
    );

    console.log(
      `🗑️ Catégorie ARK supprimée pour ${member.user.tag}`
    );

  } catch (error) {
    console.error(
      '❌ Impossible de supprimer la catégorie ARK :',
      error
    );
  }

  console.log(
    `✅ Espace ARK supprimé pour ${member.user.tag}`
  );
}

// ─────────────────────────────────────
// SYNCHRONISER LES MEMBRES EXISTANTS
// ─────────────────────────────────────

async function syncExistingArkMembers(
  client
) {
  if (!ARK_ROLE_ID) {
    return;
  }

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
              ARK_ROLE_ID
            )
        );

      console.log(
        `🦖 ${members.size} membre(s) avec le rôle ARK sur ${guild.name}`
      );

      for (
        const member
        of members.values()
      ) {
        await createArkPlayerSpace(
          member
        );
      }

    } catch (error) {
      console.error(
        `❌ Vérification ARK impossible sur ${guild.name} :`,
        error
      );
    }
  }
}

// ─────────────────────────────────────
// MODULE PRINCIPAL
// ─────────────────────────────────────

function startArkPlayerSpaces(
  client
) {
  if (!ARK_ROLE_ID) {
    console.error(
      '❌ ARK Player Spaces : ARK_ROLE_ID manquant.'
    );

    return;
  }

  console.log(
    '🦖 ARK Player Spaces : module chargé'
  );

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        const hadArkRole =
          oldMember.roles.cache.has(
            ARK_ROLE_ID
          );

        const hasArkRole =
          newMember.roles.cache.has(
            ARK_ROLE_ID
          );

        if (
          !hadArkRole &&
          hasArkRole
        ) {
          console.log('');
          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            '🦖 RÔLE ARK ATTRIBUÉ'
          );

          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            `👤 ${newMember.user.tag}`
          );

          await createArkPlayerSpace(
            newMember
          );
        }

        if (
          hadArkRole &&
          !hasArkRole
        ) {
          console.log('');
          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            '⚠️ RÔLE ARK RETIRÉ'
          );

          console.log(
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          );

          console.log(
            `👤 ${newMember.user.tag}`
          );

          await deleteArkPlayerSpace(
            newMember
          );
        }

      } catch (error) {
        console.error(
          '❌ Erreur ARK Player Spaces :',
          error
        );
      }
    }
  );

  syncExistingArkMembers(
    client
  );
}

module.exports = {
  startArkPlayerSpaces,
  createArkPlayerSpace,
  deleteArkPlayerSpace,
  findPlayerCategory
};
