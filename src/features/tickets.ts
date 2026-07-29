import { FieldValue } from "firebase-admin/firestore";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type StringSelectMenuInteraction,
  type TextChannel,
  type User,
} from "discord.js";
import { db } from "../lib/firestore.js";
import { getServerConfig, hasAnyRole, type ServerConfig } from "../lib/serverConfig.js";
import { CUSTOM_ID, TICKET_TYPES, type TicketTypeKey } from "../lib/config.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";

function sanitizeForChannelName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "client";
}

async function findOpenTicketChannelId(guild: Guild, userId: string): Promise<string | null> {
  const existing = await db()
    .collection("tickets")
    .where("guildId", "==", guild.id)
    .where("ownerId", "==", userId)
    .where("status", "==", "open")
    .limit(1)
    .get();
  return existing.empty ? null : (existing.docs[0].data().channelId as string);
}

async function createTicketChannel(guild: Guild, config: ServerConfig, user: User, channelName: string): Promise<TextChannel> {
  const botId = guild.members.me!.id;
  return guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: config.channels.staffCategoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: config.roles.moderationId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: config.roles.adminId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
      },
      {
        id: botId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      },
    ],
  });
}

function ticketActionRow() {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.TICKET_MARK_CLIENT)
      .setLabel("Marquer comme client")
      .setEmoji("🛒")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(CUSTOM_ID.TICKET_CLOSE).setLabel("Fermer le ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger)
  );
}

// Composants du message fixe posté dans #passer-commande par /is setup.
export function commandeComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.TICKET_OPEN)
        .setLabel("Ouvrir un ticket")
        .setEmoji("📩")
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

export async function handleTicketOpen(interaction: ButtonInteraction) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.TICKET_TYPE_SELECT)
    .setPlaceholder("Choisis un type de ticket")
    .addOptions(
      TICKET_TYPES.map((t) => ({ label: t.label, value: t.key, emoji: t.emoji }))
    );

  await interaction.reply({
    embeds: [brandEmbed().setTitle("🎫 Ouvrir un ticket").setDescription("Choisis le type de ticket qui correspond à ta demande.")],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleTicketTypeSelect(interaction: StringSelectMenuInteraction) {
  const guild = interaction.guild;
  if (!guild) return;
  await interaction.deferUpdate();

  const config = await getServerConfig();
  if (!config) {
    await interaction.editReply({
      embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/is setup` manquant).")],
      components: [],
    });
    return;
  }

  const openChannelId = await findOpenTicketChannelId(guild, interaction.user.id);
  if (openChannelId) {
    await interaction.editReply({
      embeds: [errorEmbed(`Tu as déjà un ticket ouvert : <#${openChannelId}>`)],
      components: [],
    });
    return;
  }

  const typeKey = interaction.values[0] as TicketTypeKey;
  const ticketType = TICKET_TYPES.find((t) => t.key === typeKey)!;

  const channel = await createTicketChannel(
    guild,
    config,
    interaction.user,
    `🎫・${ticketType.key}-${sanitizeForChannelName(interaction.user.username)}`
  );

  await channel.send({
    embeds: [
      brandEmbed()
        .setTitle(`${ticketType.emoji} ${ticketType.label}`)
        .setDescription(
          joinLines(
            `Bienvenue <@${interaction.user.id}> !`,
            "Décris ta demande ici, un membre du staff va te répondre au plus vite.",
            "",
            "➜ Un membre du staff peut fermer ce ticket avec le bouton ci-dessous une fois la demande traitée."
          )
        ),
    ],
    components: [ticketActionRow()],
  });

  await db().collection("tickets").add({
    guildId: guild.id,
    type: typeKey,
    ownerId: interaction.user.id,
    ownerTag: interaction.user.tag,
    channelId: channel.id,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });

  await interaction.editReply({
    embeds: [successEmbed(`Ticket créé : <#${channel.id}>`)],
    components: [],
  });
}

export async function handleCatalogueBuyClick(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const docId = interaction.customId.slice(CUSTOM_ID.CATALOGUE_BUY_PREFIX.length);
  const doc = await db().collection("catalogue").doc(docId).get();
  if (!doc.exists) {
    await interaction.reply({ embeds: [errorEmbed("Ce produit n'existe plus.")], flags: MessageFlags.Ephemeral });
    return;
  }
  const produit = doc.data()!.name as string;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const config = await getServerConfig();
  if (!config) {
    await interaction.editReply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/is setup` manquant).")] });
    return;
  }

  const openChannelId = await findOpenTicketChannelId(guild, interaction.user.id);
  if (openChannelId) {
    await interaction.editReply({ embeds: [errorEmbed(`Tu as déjà un ticket ouvert : <#${openChannelId}>`)] });
    return;
  }

  const channel = await createTicketChannel(guild, config, interaction.user, `🎫・achat-${sanitizeForChannelName(interaction.user.username)}`);

  await channel.send({
    embeds: [
      brandEmbed()
        .setTitle("🔒 Achat de l'exclusivité")
        .setDescription(
          joinLines(
            `Bienvenue <@${interaction.user.id}> !`,
            `Tu souhaites acheter l'exclusivité de **${produit}**.`,
            "",
            "➜ Le staff va te répondre au plus vite pour finaliser l'achat."
          )
        ),
    ],
    components: [ticketActionRow()],
  });

  await db().collection("tickets").add({
    guildId: guild.id,
    type: "commande",
    produit,
    ownerId: interaction.user.id,
    ownerTag: interaction.user.tag,
    channelId: channel.id,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
  });

  await interaction.editReply({ embeds: [successEmbed(`Ticket créé : <#${channel.id}>`)] });
}

export async function handleTicketClose(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !channel || !channel.isTextBased() || channel.isDMBased()) return;

  const config = await getServerConfig();
  const member = interaction.member as GuildMember;
  const allowed =
    (config && hasAnyRole(member, [config.roles.moderationId, config.roles.adminId])) ||
    member.permissions.has(PermissionFlagsBits.Administrator);

  if (!allowed) {
    await interaction.reply({
      embeds: [errorEmbed("Seul le staff (Modération/Admin) peut fermer un ticket.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply();

  const ticketSnap = await db()
    .collection("tickets")
    .where("channelId", "==", channel.id)
    .where("status", "==", "open")
    .limit(1)
    .get();
  const ticketData = ticketSnap.empty ? null : ticketSnap.docs[0].data();

  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const lines = sorted.map((m) => {
    const time = new Date(m.createdTimestamp).toLocaleString("fr-FR");
    const content = m.content || (m.embeds.length ? "[embed]" : m.attachments.size ? "[fichier]" : "");
    return `[${time}] ${m.author.tag}: ${content}`;
  });
  const transcriptFile = new AttachmentBuilder(Buffer.from(lines.join("\n") || "(aucun message)", "utf8"), {
    name: `transcript-${(channel as TextChannel).name}.txt`,
  });

  let transcriptMessageId: string | null = null;
  if (config) {
    const logsChannel = await guild.channels.fetch(config.channels.logsTicketsId).catch(() => null);
    if (logsChannel?.isTextBased() && !logsChannel.isDMBased()) {
      const sent = await logsChannel.send({
        embeds: [
          brandEmbed()
            .setTitle("📋 Ticket fermé")
            .setDescription(
              joinLines(
                arrow("Salon", (channel as TextChannel).name),
                arrow("Type", ticketData?.type ?? "inconnu"),
                arrow("Client", ticketData?.ownerTag ?? "inconnu"),
                arrow("Fermé par", interaction.user.tag)
              )
            ),
        ],
        files: [transcriptFile],
      });
      transcriptMessageId = sent.id;
    }
  }

  if (ticketData?.ownerId) {
    await (channel as TextChannel).permissionOverwrites
      .edit(ticketData.ownerId, { SendMessages: false })
      .catch(() => {});
  }
  await (channel as TextChannel).setName(`🔒-${(channel as TextChannel).name}`.slice(0, 100)).catch(() => {});

  if (!ticketSnap.empty) {
    await ticketSnap.docs[0].ref.update({
      status: "closed",
      closedAt: FieldValue.serverTimestamp(),
      transcriptMessageId,
    });
  }

  await interaction.editReply({
    embeds: [successEmbed("Ticket fermé. Le transcript a été envoyé dans les logs.")],
  });
}

export async function handleTicketMarkClient(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  const channel = interaction.channel;
  if (!guild || !channel || !channel.isTextBased() || channel.isDMBased()) return;

  const config = await getServerConfig();
  const member = interaction.member as GuildMember;
  const allowed =
    (config && hasAnyRole(member, [config.roles.moderationId, config.roles.adminId])) ||
    member.permissions.has(PermissionFlagsBits.Administrator);

  if (!allowed) {
    await interaction.reply({
      embeds: [errorEmbed("Seul le staff (Modération/Admin) peut marquer un client.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!config) {
    await interaction.reply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré.")], flags: MessageFlags.Ephemeral });
    return;
  }

  const ticketSnap = await db().collection("tickets").where("channelId", "==", channel.id).limit(1).get();
  if (ticketSnap.empty) {
    await interaction.reply({ embeds: [errorEmbed("Ticket introuvable.")], flags: MessageFlags.Ephemeral });
    return;
  }

  const ownerId = ticketSnap.docs[0].data().ownerId as string;
  const ownerMember = await guild.members.fetch(ownerId).catch(() => null);
  if (!ownerMember) {
    await interaction.reply({ embeds: [errorEmbed("Ce membre a quitté le serveur.")], flags: MessageFlags.Ephemeral });
    return;
  }

  if (ownerMember.roles.cache.has(config.roles.clientId)) {
    await interaction.reply({ embeds: [successEmbed(`<@${ownerId}> est déjà marqué comme client.`)], flags: MessageFlags.Ephemeral });
    return;
  }

  await ownerMember.roles.add(config.roles.clientId);
  await interaction.reply({ embeds: [successEmbed(`<@${ownerId}> a été marqué comme client 🛒`)] });
}
