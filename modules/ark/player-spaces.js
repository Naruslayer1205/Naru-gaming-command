const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

// ─────────────────────────────────────
// NOM DE LA CATÉGORIE
// ─────────────────────────────────────

function getCategoryName(member) {
  return `🦖 ARK — ${member.displayName}`;
}

// ─────────────────────────────────────
// TROUVER LA CATÉGORIE D'UN JOUEUR
// ─────────────────────────────────────

function findPlayerCategory(guild, userId) {
  return guild.channels.cache.find(
    channel =>
      channel.type ===
        ChannelType.GuildCategory &&
      channel.topic ===
        `naru-ark-player:${userId}`
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
      channel.parentId === categoryId &&
      channel.name === name
  );
}

// ─────────────────────────────────────
// CRÉATION DE L'ESPACE ARK
// ─────────────────────────────────────

async function createArkPlayerSpace(
  member
) {
  const guild = member.guild;

  if (!ARK_ROLE_ID) {
    console.error(
      '❌ Variable ARK_ROLE_ID manquante.'
    );

    return null;
  }

  // Le membre doit avoir le rôle ARK
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
          getCategoryName(member),

        type:
          ChannelType.GuildCategory,

        topic:
          `naru-ark-player:${member.id}`,

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
  }

  // ─────────────────────────────
  // SALONS
  // ─────────────────────────────

  const channels = [
    {
      name: '👤・personnage',

      topic:
        `Informations du personnage ARK de ${member.user.tag}`
    },

    {
      name: '🌍・monde',

      topic:
        `Informations du monde ARK de ${member.user.tag}`
    },

    {
      name: '🦕・dinos',

      topic:
        `Dinos ARK de ${member.user.tag}`
    },

    {
      name: '💀・journal',

      topic:
        `Journal ARK de ${member.user.tag}`
    },

    {
      name: '⚙️・commandes',

      topic:
        `Commandes et statut du Naru ARK Bridge de ${member.user.tag}`
    }
  ];

  const createdChannels = {};

  for (const channelData of channels) {
    let channel =
      findChannel(
        guild,
        category.id,
        channelData.name
      );

    if (!channel) {
      channel =
        await guild.channels.create({
          name:
            channelData.name,

          type:
            ChannelType.GuildText,

          parent:
            category.id,

          topic:
            channelData.topic,

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
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageMessages,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });

      console.log(
        `✅ Salon ${channelData.name} créé pour ${member.user.tag}`
      );
    }

    createdChannels[
      channelData.name
    ] = channel;
  }

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
// VÉRIFICATION DES MEMBRES EXISTANTS
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

  // ─────────────────────────────
  // RÔLE AJOUTÉ / RETIRÉ
  // ─────────────────────────────

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

        // Rôle ARK vient d'être ajouté
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

        // Pour le moment :
        // si le rôle est retiré,
        // on ne supprime pas la catégorie.
        //
        // Plus tard on pourra :
        // - la verrouiller
        // - l'archiver
        // - ou la supprimer.

        if (
          hadArkRole &&
          !hasArkRole
        ) {
          console.log(
            `⚠️ Rôle ARK retiré à ${newMember.user.tag}`
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

  // Vérifie également les personnes
  // qui possèdent déjà le rôle
  // au démarrage du bot.

  syncExistingArkMembers(
    client
  );
}

module.exports = {
  startArkPlayerSpaces,
  createArkPlayerSpace,
  findPlayerCategory
};
