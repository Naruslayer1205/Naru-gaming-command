const {
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

const CATEGORY_PREFIX =
  '🦖 ARK — ';

// ─────────────────────────────────────
// NOM CATÉGORIE
// ─────────────────────────────────────

function getCategoryName(member) {
  return `${CATEGORY_PREFIX}${member.displayName}`;
}

// ─────────────────────────────────────
// TROUVER CATÉGORIE JOUEUR
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
// TROUVER SALON
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
      channel.name === name
  );
}

// ─────────────────────────────────────
// CRÉATION ESPACE ARK
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

  // Ignore les bots
  if (member.user.bot) {
    return null;
  }

  // Doit avoir le rôle ARK
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

    // Si le joueur change son pseudo Discord,
    // on met le nom de catégorie à jour.

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
  // SALONS À CRÉER
  // ─────────────────────────────

  const channels = [
    '👤・personnage',
    '🌍・monde',
    '🦕・dinos',
    '💀・journal',
    '⚙️・commandes'
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
        `✅ Salon ${channelName} créé pour ${member.user.tag}`
      );
    }

    createdChannels[
      channelName
    ] = channel;
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
// MEMBRES AYANT DÉJÀ LE RÔLE
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
// MODULE
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
  // ATTRIBUTION / RETRAIT RÔLE
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

        // ─────────────────────
        // RÔLE AJOUTÉ
        // ─────────────────────

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

        // ─────────────────────
        // RÔLE RETIRÉ
        // ─────────────────────

        if (
          hadArkRole &&
          !hasArkRole
        ) {

          console.log('');
          console.log(
            `⚠️ Rôle ARK retiré à ${newMember.user.tag}`
          );

          // Pour l'instant :
          // on garde sa catégorie.
          //
          // On décidera ensuite si :
          // - suppression
          // - archivage
          // - verrouillage
        }

      } catch (error) {

        console.error(
          '❌ Erreur ARK Player Spaces :',
          error
        );
      }
    }
  );

  // Vérifie également les membres
  // qui avaient déjà le rôle
  // avant le démarrage du bot.

  syncExistingArkMembers(
    client
  );
}

module.exports = {
  startArkPlayerSpaces,
  createArkPlayerSpace,
  findPlayerCategory
};
