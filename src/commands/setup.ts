import {
  ActionRowBuilder,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonBuilder,
  type ChatInputCommandInteraction,
  type EmbedBuilder,
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
  CAT_STAFF,
  CHAN_VERIFICATION,
  CHAN_PORTFOLIO,
  CHAN_COMMANDE,
  CHAN_AVIS,
  CHAN_LOGS_TICKETS,
  ROLE_VISITEUR,
  ROLE_MEMBRE,
  ROLE_MODERATION,
  ROLE_ADMIN,
} from "../lib/config.js";
import { getServerConfig, updateServerConfig } from "../lib/serverConfig.js";
import { arrow, brandEmbed, divider, errorEmbed, inviteUrl, joinLines } from "../lib/embeds.js";
import { verificationStartComponents } from "../features/verification.js";
import { commandeComponents } from "../features/tickets.js";

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

  await updateServerConfig({
    roles: { visiteurId: visiteurRole.id, membreId: membreRole.id, moderationId: moderationRole.id, adminId: adminRole.id },
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

  const arriveeCategory = await ensureCategory(guild, existingConfig?.channels.arriveeCategoryId, CAT_ARRIVEE, arriveeOverwrites);
  const studioCategory = await ensureCategory(guild, existingConfig?.channels.studioCategoryId, CAT_STUDIO, studioOverwrites);
  const staffCategory = await ensureCategory(guild, existingConfig?.channels.staffCategoryId, CAT_STAFF, staffOverwrites);

  const verificationChannel = await ensureChannel(
    guild,
    existingConfig?.channels.verificationId,
    CHAN_VERIFICATION,
    arriveeCategory.id,
    arriveeOverwrites
  );
  const portfolioChannel = await ensureChannel(
    guild,
    existingConfig?.channels.portfolioId,
    CHAN_PORTFOLIO,
    studioCategory.id,
    studioOverwrites
  );
  const commandeChannel = await ensureChannel(
    guild,
    existingConfig?.channels.commandeId,
    CHAN_COMMANDE,
    studioCategory.id,
    studioOverwrites
  );
  const avisChannel = await ensureChannel(guild, existingConfig?.channels.avisId, CHAN_AVIS, studioCategory.id, studioOverwrites);
  const logsTicketsChannel = await ensureChannel(
    guild,
    existingConfig?.channels.logsTicketsId,
    CHAN_LOGS_TICKETS,
    staffCategory.id,
    staffOverwrites
  );

  await updateServerConfig({
    channels: {
      arriveeCategoryId: arriveeCategory.id,
      verificationId: verificationChannel.id,
      studioCategoryId: studioCategory.id,
      portfolioId: portfolioChannel.id,
      commandeId: commandeChannel.id,
      avisId: avisChannel.id,
      staffCategoryId: staffCategory.id,
      logsTicketsId: logsTicketsChannel.id,
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

  const portfolioMessageId = await ensureChannelMessage(portfolioChannel, storedMessages.portfolioMessageId, () => ({
    embeds: [
      brandEmbed()
        .setTitle("🎨 Portfolio")
        .setDescription(
          joinLines(
            "Voici les bots que j'ai développés et disponibles à la vente — certains sont exclusifs à ce Discord.",
            "",
            `➜ Une question sur un bot ? Ouvre un ticket dans <#${commandeChannel.id}>.`
          )
        ),
    ],
  }));

  const commandeMessageId = await ensureChannelMessage(commandeChannel, storedMessages.commandeMessageId, () => ({
    embeds: [
      brandEmbed()
        .setTitle("🎫 Passer commande")
        .setDescription(
          joinLines(
            "Une question, une demande, besoin d'un devis, ou prêt à passer commande ?",
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

  const logsTicketsMessageId = await ensureChannelMessage(logsTicketsChannel, storedMessages.logsTicketsMessageId, () => ({
    embeds: [brandEmbed().setTitle("📋 Logs tickets").setDescription("Les transcripts des tickets fermés apparaissent ici.")],
  }));

  await updateServerConfig({
    messages: { verificationMessageId, portfolioMessageId, commandeMessageId, avisMessageId, logsTicketsMessageId },
  });

  const embed = brandEmbed()
    .setTitle("✅ Discord Dev Studio est configuré !")
    .setDescription(
      joinLines(
        arrow("Vérification", `<#${verificationChannel.id}>`),
        arrow("Portfolio", `<#${portfolioChannel.id}>`),
        arrow("Passer commande", `<#${commandeChannel.id}>`),
        arrow("Avis clients", `<#${avisChannel.id}>`),
        arrow("Logs tickets", `<#${logsTicketsChannel.id}>`),
        "",
        divider("amber"),
        "⚠️ Vérifie que le rôle du bot est bien positionné **au-dessus** de Admin/Modération/Membre/Visiteur dans Paramètres du serveur → Rôles, sinon la gestion des rôles échouera."
      )
    );

  await interaction.editReply({ embeds: [embed] });
}
