const {
  ChannelType
} = require('discord.js');

// ============================================================
// NARU GAMING COMMAND
// PLAYER SPACES — GESTIONNAIRE GÉNÉRAL
// ============================================================

// ─────────────────────────────
// ARK
// ─────────────────────────────

const {
  createArkPlayerSpace,
  deleteArkPlayerSpace
} =
  require('./ark/player-spaces');

// ─────────────────────────────
// GTA V
// ─────────────────────────────

const {
  createGtaPlayerSpace,
  deleteGtaPlayerSpace
} =
  require('./gta/player-spaces');

// ─────────────────────────────
// ATS / ETS2
// ─────────────────────────────

const {
  createPlayerSpace:
    createAtsEtsPlayerSpace,

  deletePlayerSpace:
    deleteAtsEtsPlayerSpace
} =
  require('./ATS-ETS/player-spaces');

// ─────────────────────────────
// ACOLONY
// ─────────────────────────────

const {
  createAColonyPlayerSpace,
  deleteAColonyPlayerSpace
} =
  require('./acolony/player-spaces');

// ─────────────────────────────
// MINECRAFT
// ─────────────────────────────

const {
  createMinecraftPlayerSpace,
  deleteMinecraftPlayerSpace
} =
  require('./minecraft/player-spaces');

// ============================================================
// RÔLES
// ============================================================

const ARK_ROLE_ID =
  process.env.ARK_ROLE_ID;

const GTA_ROLE_ID =
  '1546760047105806366';

const ATS_ROLE_ID =
  '1546760053741064242';

const ETS2_ROLE_ID =
  '1546760060879765544';

const ACOLONY_ROLE_ID =
  '1548387660517609572';

const MINECRAFT_ROLE_ID =
  '1550948318639554620';

// ============================================================
// CATÉGORIES PRINCIPALES
// ============================================================

const ARK_MAIN_CATEGORY_ID =
  '1546771818596139059';

const GTA_MAIN_CATEGORY_ID =
  '1546772954447089765';

const ATS_MAIN_CATEGORY_ID =
  '1546773656615526520';

const ETS2_MAIN_CATEGORY_ID =
  '1546774027144532068';

const ACOLONY_MAIN_CATEGORY_ID =
  '1548387571388653619';

const MINECRAFT_MAIN_CATEGORY_ID =
  '1550948429838942319';

// ============================================================
// CONFIGURATION JEUX
// ============================================================

const ATS_GAME = {
  key:
    'ats',

  name:
    'American Truck Simulator',

  shortName:
    'ATS',

  roleId:
    ATS_ROLE_ID,

  categoryEmoji:
    '🇺🇸'
};

const ETS2_GAME = {
  key:
    'ets2',

  name:
    'Euro Truck Simulator 2',

  shortName:
    'ETS2',

  roleId:
    ETS2_ROLE_ID,

  categoryEmoji:
    '🇪🇺'
};

// ============================================================
// CONFIGURATION DU RANGEMENT
// ============================================================

const SPACE_LAYOUTS = {
  ark: {
    key:
      'ark',

    name:
      'ARK',

    emoji:
      '🦖',

    mainCategoryId:
      ARK_MAIN_CATEGORY_ID,

    matches:
      category =>
        category.name.startsWith(
          '🦖 ARK — '
        )
  },

  gta: {
    key:
      'gta',

    name:
      'GTA V',

    emoji:
      '🚘',

    mainCategoryId:
      GTA_MAIN_CATEGORY_ID,

    matches:
      category =>
        category.name.startsWith(
          '🚘 GTA V — '
        )
  },

  ats: {
    key:
      'ats',

    name:
      'ATS',

    emoji:
      '🇺🇸',

    mainCategoryId:
      ATS_MAIN_CATEGORY_ID,

    matches:
      category => {
        const name =
          category.name
            .toLowerCase();

        return (
          name.endsWith(
            '-ats'
          ) &&
          category.id !==
            ATS_MAIN_CATEGORY_ID
        );
      }
  },

  ets2: {
    key:
      'ets2',

    name:
      'ETS2',

    emoji:
      '🇪🇺',

    mainCategoryId:
      ETS2_MAIN_CATEGORY_ID,

    matches:
      category => {
        const name =
          category.name
            .toLowerCase();

        return (
          name.endsWith(
            '-ets2'
          ) &&
          category.id !==
            ETS2_MAIN_CATEGORY_ID
        );
      }
  },

  acolony: {
    key:
      'acolony',

    name:
      'AColony',

    emoji:
      '🏭',

    mainCategoryId:
      ACOLONY_MAIN_CATEGORY_ID,

    matches:
      category =>
        category.name.startsWith(
          '🏭 AColony — '
        )
  },

  minecraft: {
    key:
      'minecraft',

    name:
      'Minecraft',

    emoji:
      '⛏️',

    mainCategoryId:
      MINECRAFT_MAIN_CATEGORY_ID,

    matches:
      category =>
        category.name.startsWith(
          '⛏️ Minecraft — '
        )
  }
};

// ============================================================
// FILES D'ATTENTE
// ============================================================

const memberQueues =
  new Map();

let layoutQueue =
  Promise.resolve();

// ============================================================
// OUTILS
// ============================================================

function sleep(
  ms
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}

function isUsableMember(
  member
) {
  return Boolean(
    member &&
    member.user &&
    !member.user.bot
  );
}

function hasRole(
  member,
  roleId
) {
  if (
    !member ||
    !roleId
  ) {
    return false;
  }

  return member.roles.cache.has(
    roleId
  );
}

function normalizeName(
  value
) {
  return String(
    value || ''
  )
    .normalize(
      'NFD'
    )
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}

// ============================================================
// FILE D'ATTENTE PAR JOUEUR
// ============================================================

async function queueMemberTask(
  memberId,
  task
) {
  const previous =
    memberQueues.get(
      memberId
    ) ||
    Promise.resolve();

  const next =
    previous
      .catch(
        () => {}
      )
      .then(
        task
      );

  memberQueues.set(
    memberId,
    next
  );

  try {
    await next;
  } finally {
    if (
      memberQueues.get(
        memberId
      ) ===
      next
    ) {
      memberQueues.delete(
        memberId
      );
    }
  }
}

// ============================================================
// FILE D'ATTENTE POUR LE RANGEMENT
// ============================================================

async function queueLayoutTask(
  task
) {
  const next =
    layoutQueue
      .catch(
        () => {}
      )
      .then(
        task
      );

  layoutQueue =
    next;

  await next;
}

// ============================================================
// TROUVER LES CATÉGORIES PLAYER SPACE
// ============================================================

function findPlayerCategories(
  guild,
  layout
) {
  return Array.from(
    guild.channels.cache.values()
  )
    .filter(
      channel =>
        channel.type ===
          ChannelType.GuildCategory &&
        channel.id !==
          layout.mainCategoryId &&
        layout.matches(
          channel
        )
    )
    .sort(
      (
        a,
        b
      ) =>
        normalizeName(
          a.name
        ).localeCompare(
          normalizeName(
            b.name
          ),
          'fr'
        )
    );
}

// ============================================================
// RANGER UN JEU
// ============================================================

async function reorderGameSpaces(
  guild,
  gameKey
) {
  const layout =
    SPACE_LAYOUTS[
      gameKey
    ];

  if (
    !layout
  ) {
    return;
  }

  const mainCategory =
    guild.channels.cache.get(
      layout.mainCategoryId
    );

  if (
    !mainCategory
  ) {
    console.warn(
      `⚠️ ${layout.name} : catégorie principale introuvable (${layout.mainCategoryId}).`
    );

    return;
  }

  if (
    mainCategory.type !==
    ChannelType.GuildCategory
  ) {
    console.warn(
      `⚠️ ${layout.name} : l'ID principal ne correspond pas à une catégorie Discord.`
    );

    return;
  }

  const playerCategories =
    findPlayerCategories(
      guild,
      layout
    );

  if (
    playerCategories.length ===
    0
  ) {
    return;
  }

  console.log(
    `${layout.emoji} Rangement ${layout.name} : ${playerCategories.length} espace(s)...`
  );

  let targetPosition =
    mainCategory.position +
    1;

  for (
    const category
    of playerCategories
  ) {
    try {
      await category.setPosition(
        targetPosition,
        {
          reason:
            `Naru Gaming Command — rangement Player Spaces ${layout.name}`
        }
      );

      targetPosition++;

      await sleep(
        250
      );

    } catch (error) {
      console.error(
        `❌ Impossible de déplacer ${category.name} :`,
        error.message
      );
    }
  }

  console.log(
    `✅ ${layout.name} : catégories rangées.`
  );
}

// ============================================================
// RANGER TOUS LES JEUX
// ============================================================

async function reorderAllPlayerSpaces(
  guild
) {
  await queueLayoutTask(
    async () => {
      console.log('');

      console.log(
        `🗂️ Rangement des Player Spaces sur ${guild.name}...`
      );

      /*
       * IMPORTANT :
       *
       * On récupère la position réelle de chaque
       * catégorie principale Discord.
       *
       * Ensuite on range du BAS vers le HAUT.
       *
       * Ça permet d'ajouter de nouveaux jeux
       * comme AColony sans devoir modifier
       * manuellement l'ordre ici.
       */

      const layouts =
        Object.values(
          SPACE_LAYOUTS
        )
          .map(
            layout => {
              const mainCategory =
                guild.channels.cache.get(
                  layout.mainCategoryId
                );

              return {
                layout,
                position:
                  mainCategory?.position ??
                  -1
              };
            }
          )
          .filter(
            item =>
              item.position >= 0
          )
          .sort(
            (
              a,
              b
            ) =>
              b.position -
              a.position
          );

      for (
        const item
        of layouts
      ) {
        await reorderGameSpaces(
          guild,
          item.layout.key
        );

        await sleep(
          500
        );
      }

      console.log(
        '✅ Rangement général des Player Spaces terminé.'
      );

      console.log('');
    }
  );
}

// ============================================================
// RANGER UN SEUL BLOC
// ============================================================

async function reorderOneGame(
  guild,
  gameKey
) {
  await queueLayoutTask(
    async () => {
      await reorderGameSpaces(
        guild,
        gameKey
      );
    }
  );
}

// ============================================================
// SYNCHRONISATION D'UN MEMBRE
// ============================================================

async function syncMember(
  member
) {
  if (
    !isUsableMember(
      member
    )
  ) {
    return;
  }

  // ==========================================================
  // ARK
  // ==========================================================

  if (
    ARK_ROLE_ID &&
    hasRole(
      member,
      ARK_ROLE_ID
    )
  ) {
    await createArkPlayerSpace(
      member
    );
  }

  // ==========================================================
  // GTA V
  // ==========================================================

  if (
    hasRole(
      member,
      GTA_ROLE_ID
    )
  ) {
    await createGtaPlayerSpace(
      member
    );
  }

  // ==========================================================
  // ATS
  // ==========================================================

  if (
    hasRole(
      member,
      ATS_ROLE_ID
    )
  ) {
    await createAtsEtsPlayerSpace(
      member,
      ATS_GAME
    );
  }

  // ==========================================================
  // ETS2
  // ==========================================================

  if (
    hasRole(
      member,
      ETS2_ROLE_ID
    )
  ) {
    await createAtsEtsPlayerSpace(
      member,
      ETS2_GAME
    );
  }

  // ==========================================================
  // ACOLONY
  // ==========================================================

  if (
    hasRole(
      member,
      ACOLONY_ROLE_ID
    )
  ) {
    await createAColonyPlayerSpace(
      member
    );
  }

  // ==========================================================
  // MINECRAFT
  // ==========================================================

  if (
    hasRole(
      member,
      MINECRAFT_ROLE_ID
    )
  ) {
    await createMinecraftPlayerSpace(
      member
    );
  }
}

// ============================================================
// RÉCUPÉRATION UNIQUE DES MEMBRES
// ============================================================

async function fetchGuildMembersOnce(
  guild
) {
  console.log(
    `👥 Player Spaces : récupération des membres de ${guild.name}...`
  );

  try {
    const members =
      await guild.members.fetch();

    console.log(
      `✅ Player Spaces : ${members.size} membre(s) récupéré(s).`
    );

    return members;

  } catch (error) {
    console.warn(
      `⚠️ Player Spaces : récupération complète impossible sur ${guild.name}.`
    );

    console.warn(
      `⚠️ Utilisation du cache Discord (${guild.members.cache.size} membre(s)).`
    );

    console.warn(
      `⚠️ Détail : ${error.message}`
    );

    return guild.members.cache;
  }
}

// ============================================================
// NETTOYAGE DES PLAYER SPACES ORPHELINS
// ============================================================

function getPlayerSpaceOwnerIds(
  guild,
  category
) {
  const botId =
    guild.members.me?.id;

  return Array.from(
    category.permissionOverwrites.cache.values()
  )
    .filter(
      overwrite =>
        // Discord : 1 = permission overwrite d'un membre.
        // On ignore l'overwrite du bot lui-même.
        Number(overwrite.type) === 1 &&
        overwrite.id !== botId
    )
    .map(
      overwrite =>
        overwrite.id
    );
}

async function memberStillExists(
  guild,
  memberId,
  fetchedMembers
) {
  if (
    fetchedMembers?.has(
      memberId
    )
  ) {
    return true;
  }

  try {
    const member =
      await guild.members.fetch(
        memberId
      );

    return Boolean(
      member
    );

  } catch (error) {
    // 10007 = Unknown Member : l'utilisateur n'est plus sur le serveur.
    if (
      error?.code === 10007 ||
      error?.rawError?.code === 10007
    ) {
      return false;
    }

    // En cas de souci Discord/réseau, on NE SUPPRIME RIEN par sécurité.
    console.warn(
      `⚠️ Player Spaces : impossible de vérifier le membre ${memberId} sur ${guild.name} : ${error.message}`
    );

    return null;
  }
}

async function deleteOrphanCategory(
  category
) {
  const guild =
    category.guild;

  const children =
    guild.channels.cache.filter(
      channel =>
        channel.parentId ===
          category.id
    );

  for (
    const channel
    of children.values()
  ) {
    try {
      await channel.delete(
        'Player Space orphelin : propriétaire absent du serveur'
      );

      await sleep(
        250
      );
    } catch (error) {
      console.error(
        `❌ Player Spaces : impossible de supprimer ${channel.name} :`,
        error
      );
    }
  }

  try {
    const categoryName =
      category.name;

    await category.delete(
      'Player Space orphelin : propriétaire absent du serveur'
    );

    console.log(
      `🗑️ Player Space orphelin supprimé : ${categoryName}`
    );

    return true;
  } catch (error) {
    console.error(
      `❌ Player Spaces : impossible de supprimer la catégorie ${category.name} :`,
      error
    );

    return false;
  }
}

async function cleanupOrphanedPlayerSpaces(
  guild,
  fetchedMembers
) {
  console.log('');
  console.log(
    '🧹 Player Spaces : recherche des espaces orphelins...'
  );

  let deletedCount =
    0;

  for (
    const layout
    of Object.values(
      SPACE_LAYOUTS
    )
  ) {
    const categories =
      findPlayerCategories(
        guild,
        layout
      );

    for (
      const category
      of categories
    ) {
      const ownerIds =
        getPlayerSpaceOwnerIds(
          guild,
          category
        );

      // Aucune permission membre identifiable : on garde la catégorie.
      // Cela évite toute suppression hasardeuse d'une catégorie mal configurée.
      if (
        ownerIds.length === 0
      ) {
        console.warn(
          `⚠️ ${layout.name} : propriétaire introuvable dans les permissions de ${category.name}, catégorie conservée.`
        );

        continue;
      }

      let hasExistingOwner =
        false;

      let verificationFailed =
        false;

      for (
        const ownerId
        of ownerIds
      ) {
        const exists =
          await memberStillExists(
            guild,
            ownerId,
            fetchedMembers
          );

        if (
          exists === true
        ) {
          hasExistingOwner =
            true;

          break;
        }

        if (
          exists === null
        ) {
          verificationFailed =
            true;

          break;
        }
      }

      if (
        hasExistingOwner ||
        verificationFailed
      ) {
        continue;
      }

      console.log(
        `👻 ${layout.name} : espace orphelin détecté → ${category.name}`
      );

      const deleted =
        await deleteOrphanCategory(
          category
        );

      if (
        deleted
      ) {
        deletedCount++;
      }

      await sleep(
        350
      );
    }
  }

  if (
    deletedCount === 0
  ) {
    console.log(
      '✅ Player Spaces : aucun espace orphelin détecté.'
    );
  } else {
    console.log(
      `✅ Player Spaces : ${deletedCount} espace(s) orphelin(s) supprimé(s).`
    );
  }

  console.log('');
}

// ============================================================
// SYNCHRONISATION D'UN SERVEUR
// ============================================================

async function syncGuild(
  guild
) {
  console.log('');

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    `🎮 PLAYER SPACES — ${guild.name}`
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  const members =
    await fetchGuildMembersOnce(
      guild
    );

  // Nettoie aussi les espaces créés pour des membres qui avaient
  // déjà quitté le serveur avant l'installation de guildMemberRemove.
  await cleanupOrphanedPlayerSpaces(
    guild,
    members
  );

  const realMembers =
    Array.from(
      members.values()
    ).filter(
      member =>
        isUsableMember(
          member
        )
    );

  // ==========================================================
  // COMPTAGE
  // ==========================================================

  let arkCount =
    0;

  let gtaCount =
    0;

  let atsCount =
    0;

  let ets2Count =
    0;

  let acolonyCount =
    0;

  let minecraftCount =
    0;

  for (
    const member
    of realMembers
  ) {
    if (
      ARK_ROLE_ID &&
      hasRole(
        member,
        ARK_ROLE_ID
      )
    ) {
      arkCount++;
    }

    if (
      hasRole(
        member,
        GTA_ROLE_ID
      )
    ) {
      gtaCount++;
    }

    if (
      hasRole(
        member,
        ATS_ROLE_ID
      )
    ) {
      atsCount++;
    }

    if (
      hasRole(
        member,
        ETS2_ROLE_ID
      )
    ) {
      ets2Count++;
    }

    if (
      hasRole(
        member,
        ACOLONY_ROLE_ID
      )
    ) {
      acolonyCount++;
    }

    if (
      hasRole(
        member,
        MINECRAFT_ROLE_ID
      )
    ) {
      minecraftCount++;
    }
  }

  console.log(
    `🦖 ARK : ${arkCount} joueur(s)`
  );

  console.log(
    `🚘 GTA V : ${gtaCount} joueur(s)`
  );

  console.log(
    `🇺🇸 ATS : ${atsCount} joueur(s)`
  );

  console.log(
    `🇪🇺 ETS2 : ${ets2Count} joueur(s)`
  );

  console.log(
    `🏭 AColony : ${acolonyCount} joueur(s)`
  );

  console.log(
    `⛏️ Minecraft : ${minecraftCount} joueur(s)`
  );

  // ==========================================================
  // ARK
  // ==========================================================

  console.log('');

  console.log(
    '🦖 Synchronisation ARK...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !ARK_ROLE_ID ||
      !hasRole(
        member,
        ARK_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createArkPlayerSpace(
        member
      );

    } catch (error) {
      console.error(
        `❌ ARK : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation ARK terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // GTA V
  // ==========================================================

  console.log('');

  console.log(
    '🚘 Synchronisation GTA V...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        GTA_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createGtaPlayerSpace(
        member
      );

    } catch (error) {
      console.error(
        `❌ GTA V : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation GTA V terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // ATS
  // ==========================================================

  console.log('');

  console.log(
    '🇺🇸 Synchronisation ATS...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        ATS_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createAtsEtsPlayerSpace(
        member,
        ATS_GAME
      );

    } catch (error) {
      console.error(
        `❌ ATS : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation ATS terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // ETS2
  // ==========================================================

  console.log('');

  console.log(
    '🇪🇺 Synchronisation ETS2...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        ETS2_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createAtsEtsPlayerSpace(
        member,
        ETS2_GAME
      );

    } catch (error) {
      console.error(
        `❌ ETS2 : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation ETS2 terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // ACOLONY
  // ==========================================================

  console.log('');

  console.log(
    '🏭 Synchronisation AColony...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        ACOLONY_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createAColonyPlayerSpace(
        member
      );

    } catch (error) {
      console.error(
        `❌ AColony : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation AColony terminée.'
  );

  await sleep(
    750
  );

  // ==========================================================
  // MINECRAFT
  // ==========================================================

  console.log('');

  console.log(
    '⛏️ Synchronisation Minecraft...'
  );

  for (
    const member
    of realMembers
  ) {
    if (
      !hasRole(
        member,
        MINECRAFT_ROLE_ID
      )
    ) {
      continue;
    }

    try {
      await createMinecraftPlayerSpace(
        member
      );

    } catch (error) {
      console.error(
        `❌ Minecraft : ${member.user.tag} :`,
        error
      );
    }
  }

  console.log(
    '✅ Synchronisation Minecraft terminée.'
  );

  // ==========================================================
  // RANGEMENT AUTOMATIQUE
  // ==========================================================

  await sleep(
    1000
  );

  await reorderAllPlayerSpaces(
    guild
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );

  console.log(
    '✅ PLAYER SPACES SYNCHRONISÉS'
  );

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
  );
}

// ============================================================
// SYNCHRONISATION DE TOUS LES SERVEURS
// ============================================================

async function syncAllGuilds(
  client
) {
  for (
    const guild
    of client.guilds.cache.values()
  ) {
    await syncGuild(
      guild
    );
  }
}

// ============================================================
// CHANGEMENT DE RÔLE
// ============================================================

async function handleRoleChange(
  oldMember,
  newMember
) {
  if (
    !isUsableMember(
      newMember
    )
  ) {
    return;
  }

  await queueMemberTask(
    newMember.id,
    async () => {

      // ======================================================
      // ARK
      // ======================================================

      if (
        ARK_ROLE_ID
      ) {
        const oldArk =
          hasRole(
            oldMember,
            ARK_ROLE_ID
          );

        const newArk =
          hasRole(
            newMember,
            ARK_ROLE_ID
          );

        if (
          !oldArk &&
          newArk
        ) {
          console.log(
            `🦖 Rôle ARK attribué à ${newMember.user.tag}`
          );

          await createArkPlayerSpace(
            newMember
          );

          await sleep(
            500
          );

          await reorderOneGame(
            newMember.guild,
            'ark'
          );
        }

        if (
          oldArk &&
          !newArk
        ) {
          console.log(
            `🦖 Rôle ARK retiré à ${newMember.user.tag}`
          );

          await deleteArkPlayerSpace(
            newMember
          );

          await sleep(
            500
          );

          await reorderOneGame(
            newMember.guild,
            'ark'
          );
        }
      }

      // ======================================================
      // GTA V
      // ======================================================

      const oldGta =
        hasRole(
          oldMember,
          GTA_ROLE_ID
        );

      const newGta =
        hasRole(
          newMember,
          GTA_ROLE_ID
        );

      if (
        !oldGta &&
        newGta
      ) {
        console.log(
          `🚘 Rôle GTA V attribué à ${newMember.user.tag}`
        );

        await createGtaPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'gta'
        );
      }

      if (
        oldGta &&
        !newGta
      ) {
        console.log(
          `🚘 Rôle GTA V retiré à ${newMember.user.tag}`
        );

        await deleteGtaPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'gta'
        );
      }

      // ======================================================
      // ATS
      // ======================================================

      const oldAts =
        hasRole(
          oldMember,
          ATS_ROLE_ID
        );

      const newAts =
        hasRole(
          newMember,
          ATS_ROLE_ID
        );

      if (
        !oldAts &&
        newAts
      ) {
        console.log(
          `🇺🇸 Rôle ATS attribué à ${newMember.user.tag}`
        );

        await createAtsEtsPlayerSpace(
          newMember,
          ATS_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ats'
        );
      }

      if (
        oldAts &&
        !newAts
      ) {
        console.log(
          `🇺🇸 Rôle ATS retiré à ${newMember.user.tag}`
        );

        await deleteAtsEtsPlayerSpace(
          newMember,
          ATS_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ats'
        );
      }

      // ======================================================
      // ETS2
      // ======================================================

      const oldEts2 =
        hasRole(
          oldMember,
          ETS2_ROLE_ID
        );

      const newEts2 =
        hasRole(
          newMember,
          ETS2_ROLE_ID
        );

      if (
        !oldEts2 &&
        newEts2
      ) {
        console.log(
          `🇪🇺 Rôle ETS2 attribué à ${newMember.user.tag}`
        );

        await createAtsEtsPlayerSpace(
          newMember,
          ETS2_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ets2'
        );
      }

      if (
        oldEts2 &&
        !newEts2
      ) {
        console.log(
          `🇪🇺 Rôle ETS2 retiré à ${newMember.user.tag}`
        );

        await deleteAtsEtsPlayerSpace(
          newMember,
          ETS2_GAME
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'ets2'
        );
      }

      // ======================================================
      // ACOLONY
      // ======================================================

      const oldAColony =
        hasRole(
          oldMember,
          ACOLONY_ROLE_ID
        );

      const newAColony =
        hasRole(
          newMember,
          ACOLONY_ROLE_ID
        );

      // Rôle ajouté

      if (
        !oldAColony &&
        newAColony
      ) {
        console.log(
          `🏭 Rôle AColony attribué à ${newMember.user.tag}`
        );

        await createAColonyPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'acolony'
        );
      }

      // Rôle retiré

      if (
        oldAColony &&
        !newAColony
      ) {
        console.log(
          `🏭 Rôle AColony retiré à ${newMember.user.tag}`
        );

        await deleteAColonyPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'acolony'
        );
      }

      // ======================================================
      // MINECRAFT
      // ======================================================

      const oldMinecraft =
        hasRole(
          oldMember,
          MINECRAFT_ROLE_ID
        );

      const newMinecraft =
        hasRole(
          newMember,
          MINECRAFT_ROLE_ID
        );

      if (
        !oldMinecraft &&
        newMinecraft
      ) {
        console.log(
          `⛏️ Rôle Minecraft attribué à ${newMember.user.tag}`
        );

        await createMinecraftPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'minecraft'
        );
      }

      if (
        oldMinecraft &&
        !newMinecraft
      ) {
        console.log(
          `⛏️ Rôle Minecraft retiré à ${newMember.user.tag}`
        );

        await deleteMinecraftPlayerSpace(
          newMember
        );

        await sleep(
          500
        );

        await reorderOneGame(
          newMember.guild,
          'minecraft'
        );
      }
    }
  );
}

// ============================================================
// ARRIVÉE D'UN MEMBRE
// ============================================================

async function handleMemberAdd(
  member
) {
  if (
    !isUsableMember(
      member
    )
  ) {
    return;
  }

  await queueMemberTask(
    member.id,
    async () => {
      await syncMember(
        member
      );

      await sleep(
        500
      );

      await reorderAllPlayerSpaces(
        member.guild
      );
    }
  );
}

// ============================================================
// DÉPART D'UN MEMBRE
// ============================================================

async function handleMemberRemove(
  member
) {
  if (
    !member ||
    !member.user ||
    member.user.bot
  ) {
    return;
  }

  await queueMemberTask(
    member.id,
    async () => {
      console.log('');
      console.log(
        `👋 ${member.user.tag} a quitté ${member.guild.name} — suppression de tous ses Player Spaces...`
      );

      const deletions = [
        {
          name: 'ARK',
          emoji: '🦖',
          gameKey: 'ark',
          run: () => deleteArkPlayerSpace(member)
        },
        {
          name: 'GTA V',
          emoji: '🚘',
          gameKey: 'gta',
          run: () => deleteGtaPlayerSpace(member)
        },
        {
          name: 'ATS',
          emoji: '🇺🇸',
          gameKey: 'ats',
          run: () => deleteAtsEtsPlayerSpace(
            member,
            ATS_GAME
          )
        },
        {
          name: 'ETS2',
          emoji: '🇪🇺',
          gameKey: 'ets2',
          run: () => deleteAtsEtsPlayerSpace(
            member,
            ETS2_GAME
          )
        },
        {
          name: 'AColony',
          emoji: '🏭',
          gameKey: 'acolony',
          run: () => deleteAColonyPlayerSpace(member)
        },
        {
          name: 'Minecraft',
          emoji: '⛏️',
          gameKey: 'minecraft',
          run: () => deleteMinecraftPlayerSpace(member)
        }
      ];

      for (
        const deletion
        of deletions
      ) {
        try {
          await deletion.run();

          console.log(
            `${deletion.emoji} ${deletion.name} : nettoyage terminé pour ${member.user.tag}.`
          );
        } catch (error) {
          console.error(
            `❌ ${deletion.name} : erreur pendant le nettoyage de ${member.user.tag} :`,
            error
          );
        }

        await sleep(
          350
        );
      }

      await sleep(
        500
      );

      try {
        await reorderAllPlayerSpaces(
          member.guild
        );
      } catch (error) {
        console.error(
          `❌ Player Spaces : rangement après le départ de ${member.user.tag} impossible :`,
          error
        );
      }

      console.log(
        `✅ Player Spaces : nettoyage du départ de ${member.user.tag} terminé.`
      );
      console.log('');
    }
  );
}

// ============================================================
// MODULE PRINCIPAL
// ============================================================

function startPlayerSpaces(
  client
) {
  console.log(
    '🎮 Player Spaces général : module chargé'
  );

  // ==========================================================
  // RÔLES
  // ==========================================================

  if (
    !ARK_ROLE_ID
  ) {
    console.warn(
      '⚠️ ARK_ROLE_ID manquant : espaces ARK désactivés.'
    );

  } else {
    console.log(
      `🦖 ARK → ${ARK_ROLE_ID}`
    );
  }

  console.log(
    `🚘 GTA V → ${GTA_ROLE_ID}`
  );

  console.log(
    `🇺🇸 ATS → ${ATS_ROLE_ID}`
  );

  console.log(
    `🇪🇺 ETS2 → ${ETS2_ROLE_ID}`
  );

  console.log(
    `🏭 AColony → ${ACOLONY_ROLE_ID}`
  );

  console.log(
    `⛏️ Minecraft → ${MINECRAFT_ROLE_ID}`
  );

  // ==========================================================
  // CATÉGORIES PRINCIPALES
  // ==========================================================

  console.log(
    '🗂️ Catégories principales :'
  );

  console.log(
    `🦖 ARK → ${ARK_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🚘 GTA V → ${GTA_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🇺🇸 ATS → ${ATS_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🇪🇺 ETS2 → ${ETS2_MAIN_CATEGORY_ID}`
  );

  console.log(
    `🏭 AColony → ${ACOLONY_MAIN_CATEGORY_ID}`
  );

  console.log(
    `⛏️ Minecraft → ${MINECRAFT_MAIN_CATEGORY_ID}`
  );

  // ==========================================================
  // CHANGEMENT DE RÔLE
  // ==========================================================

  client.on(
    'guildMemberUpdate',
    async (
      oldMember,
      newMember
    ) => {
      try {
        await handleRoleChange(
          oldMember,
          newMember
        );

      } catch (error) {
        console.error(
          '❌ Player Spaces : erreur changement de rôle :',
          error
        );
      }
    }
  );

  // ==========================================================
  // ARRIVÉE MEMBRE
  // ==========================================================

  client.on(
    'guildMemberAdd',
    async member => {
      try {
        await handleMemberAdd(
          member
        );

      } catch (error) {
        console.error(
          '❌ Player Spaces : erreur arrivée membre :',
          error
        );
      }
    }
  );

  // ==========================================================
  // DÉPART MEMBRE
  // ==========================================================

  client.on(
    'guildMemberRemove',
    async member => {
      try {
        await handleMemberRemove(
          member
        );

      } catch (error) {
        console.error(
          '❌ Player Spaces : erreur départ membre :',
          error
        );
      }
    }
  );

  // ==========================================================
  // SYNCHRONISATION INITIALE
  // ==========================================================

  setTimeout(
    async () => {
      try {
        await syncAllGuilds(
          client
        );

      } catch (error) {
        console.error(
          '❌ Player Spaces : synchronisation initiale impossible :',
          error
        );
      }
    },
    5000
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  startPlayerSpaces,
  syncAllGuilds,
  syncGuild,
  syncMember,
  handleMemberRemove,
  cleanupOrphanedPlayerSpaces,
  reorderAllPlayerSpaces,
  reorderGameSpaces,

  // ARK

  createArkPlayerSpace,
  deleteArkPlayerSpace,

  // GTA V

  createGtaPlayerSpace,
  deleteGtaPlayerSpace,

  // ATS

  createAtsPlayerSpace:
    member =>
      createAtsEtsPlayerSpace(
        member,
        ATS_GAME
      ),

  deleteAtsPlayerSpace:
    member =>
      deleteAtsEtsPlayerSpace(
        member,
        ATS_GAME
      ),

  // ETS2

  createEts2PlayerSpace:
    member =>
      createAtsEtsPlayerSpace(
        member,
        ETS2_GAME
      ),

  deleteEts2PlayerSpace:
    member =>
      deleteAtsEtsPlayerSpace(
        member,
        ETS2_GAME
      ),

  // ACOLONY

  createAColonyPlayerSpace,
  deleteAColonyPlayerSpace,

  // MINECRAFT

  createMinecraftPlayerSpace,
  deleteMinecraftPlayerSpace
};
