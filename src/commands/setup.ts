import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
  type ForumChannel,
  type Guild,
  type CategoryChannel,
  type OverwriteResolvable,
  type Role,
  type StringSelectMenuBuilder,
  type TextChannel,
} from "discord.js";
import {
  CAT_ARRIVEE,
  CAT_STUDIO,
  CAT_DISCUSSION,
  CAT_STAFF,
  CHAN_VERIFICATION,
  CHAN_ANNONCES,
  CHAN_COMMANDE,
  CHAN_AVIS,
  CHAN_LOGS_TICKETS,
  CHAN_STAFF_DISCUSSION,
  CHAN_GENERAL,
  CHAN_IMAGE,
  CHAN_LASALADE,
  CHAN_FORUM_AIDE,
  CATALOGUE_CATEGORIES,
  ROLE_VISITEUR,
  ROLE_MEMBRE,
  ROLE_MODERATION,
  ROLE_ADMIN,
  ROLE_ANNONCES,
  ROLE_CLIENT,
  type CatalogueCategoryKey,
} from "../lib/config.js";
import { getServerConfig, updateServerConfig } from "../lib/serverConfig.js";
import { arrow, brandEmbed, divider, errorEmbed, inviteUrl, joinLines, sectionTitle } from "../lib/embeds.js";
import { verificationStartComponents } from "../features/verification.js";
import { commandeComponents } from "../features/tickets.js";
import { annoncesToggleComponents } from "../features/annonces.js";

async function ensureRole(
  guild: Guild,
  storedId: string | undefined,
  name: string,
  options: { color?: number; permissions?: bigint[]; hoist?: boolean }
): Promise<Role> {
  if (storedId) {
    const found = await guild.roles.fetch(storedId).catch(() => null);
    if (found) return found;
  }
  const byName = guild.roles.cache.find((r) => r.name === name);
  if (byName) return byName;
  return guild.roles.create({
    name,
    color: options.color,
    permissions: options.permissions ?? [],
    hoist: options.hoist ?? false,
  });
}

async function ensureCategory(
  guild: Guild,
  storedId: string | undefined,
  name: string,
  overwrites: OverwriteResolvable[]
): Promise<CategoryChannel> {
  if (storedId) {
    const found = await guild.channels.fetch(storedId).catch(() => null);
    if (found?.type === ChannelType.GuildCategory) {
      await found.permissionOverwrites.set(overwrites).catch(() => {});
      return found;
    }
  }
  return guild.channels.create({ name, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
}

async function ensureChannel(
  guild: Guild,
  storedId: string | undefined,
  name: string,
  parentId: string,
  overwrites: OverwriteResolvable[]
): Promise<TextChannel> {
  if (storedId) {
    const found = await guild.channels.fetch(storedId).catch(() => null);
    if (found?.type === ChannelType.GuildText) {
      await found.permissionOverwrites.set(overwrites).catch(() => {});
      if (found.parentId !== parentId) await found.setParent(parentId, { lockPermissions: false }).catch(() => {});
      return found;
    }
  }
  return guild.channels.create({ name, type: ChannelType.GuildText, parent: parentId, permissionOverwrites: overwrites });
}

async function ensureForumChannel(
  guild: Guild,
  storedId: string | undefined,
  name: string,
  parentId: string,
  topic: string,
  overwrites: OverwriteResolvable[]
): Promise<ForumChannel> {
  if (storedId) {
    const found = await guild.channels.fetch(storedId).catch(() => null);
    if (found?.type === ChannelType.GuildForum) {
      await found.permissionOverwrites.set(overwrites).catch(() => {});
      if (found.parentId !== parentId) await found.setParent(parentId, { lockPermissions: false }).catch(() => {});
      return found;
    }
  }
  return guild.channels.create({ name, type: ChannelType.GuildForum, parent: parentId, topic, permissionOverwrites: overwrites });
}

interface ChannelMessagePayload {
  embeds: EmbedBuilder[];
  components?: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
}

async function ensureChannelMessage(
  channel: TextChannel,
  storedMessageId: string | undefined,
  build: () => ChannelMessagePayload
): Promise<string> {
  if (storedMessageId) {
    const message = await channel.messages.fetch(storedMessageId).catch(() => null);
    if (message) {
      const edited = await message.edit(build()).catch(() => message);
      return edited.id;
    }
  }
  const sent = await channel.send(build());
  return sent.id;
}

export async function executeSetup(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ embeds: [errorEmbed("Cette commande doit être utilisée depuis un serveur Discord.")] });
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({
      embeds: [errorEmbed("Cette commande est réservée aux administrateurs (permission « Gérer le serveur »).")],
    });
    return;
  }

  const me = guild.members.me;
  if (!me || !me.permissions.has(PermissionFlagsBits.ManageRoles) || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
    await interaction.editReply({
      embeds: [
        errorEmbed(
          joinLines(
            "Il me manque les permissions **Gérer les rôles** et/ou **Gérer les salons** pour configurer le serveur.",
            "",
            "Ré-invite-moi avec ce lien (permissions à jour), puis relance `/dds setup` :",
            inviteUrl(interaction.client.user.id)
          )
        ),
      ],
    });
    return;
  }

  const existingConfig = await getServerConfig();

  const visiteurRole = await ensureRole(guild, existingConfig?.roles.visiteurId, ROLE_VISITEUR, { color: 0x99aab5 });
  const membreRole = await ensureRole(guild, existingConfig?.roles.membreId, ROLE_MEMBRE, { color: 0x57f287 });
  const moderationRole = await ensureRole(guild, existingConfig?.roles.moderationId, ROLE_MODERATION, {
    color: 0xe67e22,
    permissions: [PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages],
    hoist: true,
  });
  const adminRole = await ensureRole(guild, existingConfig?.roles.adminId, ROLE_ADMIN, {
    color: 0xed4245,
    permissions: [PermissionFlagsBits.Administrator],
    hoist: true,
  });
  const annoncesRole = await ensureRole(guild, existingConfig?.roles.annoncesId, ROLE_ANNONCES, { color: 0xfee75c });
  const clientRole = await ensureRole(guild, existingConfig?.roles.clientId, ROLE_CLIENT, { color: 0xeb459e, hoist: true });

  await updateServerConfig({
    roles: {
      visiteurId: visiteurRole.id,
      membreId: membreRole.id,
      moderationId: moderationRole.id,
      adminId: adminRole.id,
      annoncesId: annoncesRole.id,
      clientId: clientRole.id,
    },
  });

  const botId = me.id;
  const everyoneId = guild.roles.everyone.id;

  const arriveeOverwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: visiteurRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: botId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory],
    },
  ];
  const studioOverwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: membreRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: moderationRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: adminRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];
  const staffOverwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: moderationRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: adminRole.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  const discussionOverwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: membreRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: moderationRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: adminRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];
  const forumOverwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: membreRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: moderationRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: adminRole.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.ManageThreads,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
    {
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.SendMessagesInThreads,
        PermissionFlagsBits.CreatePublicThreads,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  const arriveeCategory = await ensureCategory(guild, existingConfig?.channels.arriveeCategoryId, CAT_ARRIVEE, arriveeOverwrites);
  const studioCategory = await ensureCategory(guild, existingConfig?.channels.studioCategoryId, CAT_STUDIO, studioOverwrites);
  const discussionCategory = await ensureCategory(
    guild,
    existingConfig?.channels.discussionCategoryId,
    CAT_DISCUSSION,
    discussionOverwrites
  );
  const staffCategory = await ensureCategory(guild, existingConfig?.channels.staffCategoryId, CAT_STAFF, staffOverwrites);

  await guild.channels
    .setPositions([
      { channel: arriveeCategory, position: 0 },
      { channel: studioCategory, position: 1 },
      { channel: discussionCategory, position: 2 },
      { channel: staffCategory, position: 3 },
    ])
    .catch(() => {});

  const verificationChannel = await ensureChannel(
    guild,
    existingConfig?.channels.verificationId,
    CHAN_VERIFICATION,
    arriveeCategory.id,
    arriveeOverwrites
  );
  const annoncesChannel = await ensureChannel(
    guild,
    existingConfig?.channels.annoncesId,
    CHAN_ANNONCES,
    studioCategory.id,
    studioOverwrites
  );
  const catalogueChannels = {} as Record<CatalogueCategoryKey, TextChannel>;
  for (const cat of CATALOGUE_CATEGORIES) {
    catalogueChannels[cat.key] = await ensureChannel(
      guild,
      existingConfig?.channels.catalogueChannels?.[cat.key],
      cat.channel,
      studioCategory.id,
      studioOverwrites
    );
  }
  const commandeChannel = await ensureChannel(
    guild,
    existingConfig?.channels.commandeId,
    CHAN_COMMANDE,
    studioCategory.id,
    studioOverwrites
  );
  const avisChannel = await ensureChannel(guild, existingConfig?.channels.avisId, CHAN_AVIS, studioCategory.id, studioOverwrites);

  await guild.channels
    .setPositions([
      { channel: annoncesChannel, position: 0 },
      ...CATALOGUE_CATEGORIES.map((cat, i) => ({ channel: catalogueChannels[cat.key], position: i + 1 })),
      { channel: commandeChannel, position: CATALOGUE_CATEGORIES.length + 1 },
      { channel: avisChannel, position: CATALOGUE_CATEGORIES.length + 2 },
    ])
    .catch(() => {});

  const generalChannel = await ensureChannel(
    guild,
    existingConfig?.channels.generalId,
    CHAN_GENERAL,
    discussionCategory.id,
    discussionOverwrites
  );
  const imageChannel = await ensureChannel(
    guild,
    existingConfig?.channels.imageId,
    CHAN_IMAGE,
    discussionCategory.id,
    discussionOverwrites
  );
  const lasaladeChannel = await ensureChannel(
    guild,
    existingConfig?.channels.lasaladeId,
    CHAN_LASALADE,
    discussionCategory.id,
    discussionOverwrites
  );
  const forumAideChannel = await ensureForumChannel(
    guild,
    existingConfig?.channels.forumAideId,
    CHAN_FORUM_AIDE,
    discussionCategory.id,
    "Pose ta question ou demande de l'aide en créant un post ici.",
    forumOverwrites
  );
  const logsTicketsChannel = await ensureChannel(
    guild,
    existingConfig?.channels.logsTicketsId,
    CHAN_LOGS_TICKETS,
    staffCategory.id,
    staffOverwrites
  );
  const staffDiscussionChannel = await ensureChannel(
    guild,
    existingConfig?.channels.staffDiscussionId,
    CHAN_STAFF_DISCUSSION,
    staffCategory.id,
    staffOverwrites
  );

  await updateServerConfig({
    channels: {
      arriveeCategoryId: arriveeCategory.id,
      verificationId: verificationChannel.id,
      studioCategoryId: studioCategory.id,
      annoncesId: annoncesChannel.id,
      catalogueChannels: Object.fromEntries(CATALOGUE_CATEGORIES.map((cat) => [cat.key, catalogueChannels[cat.key].id])),
      commandeId: commandeChannel.id,
      avisId: avisChannel.id,
      discussionCategoryId: discussionCategory.id,
      generalId: generalChannel.id,
      imageId: imageChannel.id,
      lasaladeId: lasaladeChannel.id,
      forumAideId: forumAideChannel.id,
      staffCategoryId: staffCategory.id,
      logsTicketsId: logsTicketsChannel.id,
      staffDiscussionId: staffDiscussionChannel.id,
    },
  });

  const storedMessages = existingConfig?.messages ?? {};

  const verificationMessageId = await ensureChannelMessage(verificationChannel, storedMessages.verificationMessageId, () => ({
    embeds: [
      brandEmbed()
        .setTitle("🔎 Vérification")
        .setDescription(
          joinLines(
            "Bienvenue sur **Discord Dev Studio** !",
            "",
            "Clique sur le bouton ci-dessous pour passer une petite vérification anti-bot, puis accepter le règlement. Tu débloqueras ensuite l'accès aux salons du serveur."
          )
        ),
    ],
    components: verificationStartComponents(),
  }));

  const annoncesMessageId = await ensureChannelMessage(annoncesChannel, storedMessages.annoncesMessageId, () => ({
    embeds: [
      brandEmbed()
        .setTitle("📢 Annonces")
        .setDescription(
          joinLines(
            "Les nouveautés du catalogue (nouveaux bots, sorties, promos) sont annoncées ici.",
            "",
            "➜ Abonne-toi avec le bouton ci-dessous pour être pingé à chaque nouveauté."
          )
        ),
    ],
    components: annoncesToggleComponents(),
  }));

  const catalogueMessages = {} as Record<CatalogueCategoryKey, string>;
  for (const cat of CATALOGUE_CATEGORIES) {
    catalogueMessages[cat.key] = await ensureChannelMessage(
      catalogueChannels[cat.key],
      storedMessages.catalogueMessages?.[cat.key],
      () => ({
        embeds: [
          brandEmbed()
            .setTitle(`${cat.emoji} ${cat.label}`)
            .setDescription(
              joinLines(
                `Voici les bots ${cat.label} que j'ai développés et disponibles à la vente — certains sont exclusifs à ce Discord.`,
                "",
                `➜ Une question sur un bot ? Ouvre un ticket dans <#${commandeChannel.id}>.`
              )
            ),
        ],
      })
    );
  }

  const commandeMessageId = await ensureChannelMessage(commandeChannel, storedMessages.commandeMessageId, () => ({
    embeds: [
      brandEmbed()
        .setTitle("🎫 Passer commande")
        .setDescription(
          joinLines(
            "Une question, une demande, besoin d'un devis, ou prêt à passer commande ?",
            "",
            sectionTitle("Créations sur mesure"),
            "➜ Bot Discord",
            "➜ Plugin Minecraft",
            "➜ Skript Minecraft",
            "➜ Site web relié à un jeu (boutique...) et à un Discord",
            "➜ Admin dashboard",
            "➜ Préconfig Minecraft en français",
            "",
            "➜ Clique sur le bouton ci-dessous pour ouvrir un ticket privé avec le staff."
          )
        ),
    ],
    components: commandeComponents(),
  }));

  const avisMessageId = await ensureChannelMessage(avisChannel, storedMessages.avisMessageId, () => ({
    embeds: [
      brandEmbed()
        .setTitle("⭐ Avis clients")
        .setDescription(
          joinLines(
            "Retrouve ici les avis laissés par mes clients.",
            "",
            "➜ Tu as fait appel à mes services ? Laisse ton avis avec la commande `/dds avis`."
          )
        ),
    ],
  }));

  const generalMessageId = await ensureChannelMessage(generalChannel, storedMessages.generalMessageId, () => ({
    embeds: [brandEmbed().setTitle("💬 Général").setDescription("Discussion libre, présentations, actu du studio...")],
  }));

  const imageMessageId = await ensureChannelMessage(imageChannel, storedMessages.imageMessageId, () => ({
    embeds: [brandEmbed().setTitle("🖼️ Image").setDescription("Partage tes screenshots, memes, créations...")],
  }));

  const lasaladeMessageId = await ensureChannelMessage(lasaladeChannel, storedMessages.lasaladeMessageId, () => ({
    embeds: [brandEmbed().setTitle("🥗 La Salade").setDescription("Le fourre-tout : parle de ce que tu veux ici.")],
  }));

  const logsTicketsMessageId = await ensureChannelMessage(logsTicketsChannel, storedMessages.logsTicketsMessageId, () => ({
    embeds: [brandEmbed().setTitle("📋 Logs tickets").setDescription("Les transcripts des tickets fermés apparaissent ici.")],
  }));

  const staffDiscussionMessageId = await ensureChannelMessage(staffDiscussionChannel, storedMessages.staffDiscussionMessageId, () => ({
    embeds: [brandEmbed().setTitle("🗣️ Discussion Staff").setDescription("Salon privé pour discuter entre modérateurs et admins.")],
  }));

  await updateServerConfig({
    messages: {
      verificationMessageId,
      annoncesMessageId,
      catalogueMessages,
      commandeMessageId,
      avisMessageId,
      generalMessageId,
      imageMessageId,
      lasaladeMessageId,
      logsTicketsMessageId,
      staffDiscussionMessageId,
    },
  });

  const embed = brandEmbed()
    .setTitle("✅ Discord Dev Studio est configuré !")
    .setDescription(
      joinLines(
        arrow("Vérification", `<#${verificationChannel.id}>`),
        arrow("Annonces", `<#${annoncesChannel.id}>`),
        ...CATALOGUE_CATEGORIES.map((cat) => arrow(cat.label, `<#${catalogueChannels[cat.key].id}>`)),
        arrow("Passer commande", `<#${commandeChannel.id}>`),
        arrow("Avis clients", `<#${avisChannel.id}>`),
        arrow("Général", `<#${generalChannel.id}>`),
        arrow("Image", `<#${imageChannel.id}>`),
        arrow("La Salade", `<#${lasaladeChannel.id}>`),
        arrow("Questions/Aide", `<#${forumAideChannel.id}>`),
        arrow("Logs tickets", `<#${logsTicketsChannel.id}>`),
        arrow("Discussion Staff", `<#${staffDiscussionChannel.id}>`),
        "",
        divider("amber"),
        "⚠️ Vérifie que le rôle du bot est bien positionné **au-dessus** de Admin/Modération/Membre/Visiteur dans Paramètres du serveur → Rôles, sinon la gestion des rôles échouera."
      )
    );

  await interaction.editReply({ embeds: [embed] });
}
