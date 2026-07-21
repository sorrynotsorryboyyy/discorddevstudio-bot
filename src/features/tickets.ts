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
  type GuildMember,
  type StringSelectMenuInteraction,
  type TextChannel,
} from "discord.js";
import { db } from "../lib/firestore.js";
import { getServerConfig, hasAnyRole } from "../lib/serverConfig.js";
import { CUSTOM_ID, TICKET_TYPES, type TicketTypeKey } from "../lib/config.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";

// Composants du message fixe posté dans #passer-commande par /dds setup.
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

function sanitizeForChannelName(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 20) || "client";
}

export async function handleTicketTypeSelect(interaction: StringSelectMenuInteraction) {
  const guild = interaction.guild;
  if (!guild) return;
  await interaction.deferUpdate();

  const config = await getServerConfig();
  if (!config) {
    await interaction.editReply({
      embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/dds setup` manquant).")],
      components: [],
    });
    return;
  }

  const existing = await db()
    .collection("tickets")
    .where("guildId", "==", guild.id)
    .where("ownerId", "==", interaction.user.id)
    .where("status", "==", "open")
    .limit(1)
    .get();
  if (!existing.empty) {
    const channelId = existing.docs[0].data().channelId as string;
    await interaction.editReply({
      embeds: [errorEmbed(`Tu as déjà un ticket ouvert : <#${channelId}>`)],
      components: [],
    });
    return;
  }

  const typeKey = interaction.values[0] as TicketTypeKey;
  const ticketType = TICKET_TYPES.find((t) => t.key === typeKey)!;
  const botId = guild.members.me!.id;

  const channel = await guild.channels.create({
    name: `🎫・${ticketType.key}-${sanitizeForChannelName(interaction.user.username)}`,
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
        id: interaction.user.id,
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
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.TICKET_CLOSE)
          .setLabel("Fermer le ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
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
