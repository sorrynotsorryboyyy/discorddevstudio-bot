import { FieldValue } from "firebase-admin/firestore";
import { MessageFlags, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { db } from "../lib/firestore.js";
import { getServerConfig, hasAnyRole } from "../lib/serverConfig.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";

export async function executeAvis(interaction: ChatInputCommandInteraction) {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed("Cette commande doit être utilisée depuis le serveur Discord Dev Studio.")], flags: MessageFlags.Ephemeral });
    return;
  }

  const config = await getServerConfig();
  if (!config) {
    await interaction.reply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/dds setup` manquant).")], flags: MessageFlags.Ephemeral });
    return;
  }

  const member = interaction.member as GuildMember;
  if (!hasAnyRole(member, [config.roles.membreId, config.roles.moderationId, config.roles.adminId])) {
    await interaction.reply({
      embeds: [errorEmbed("Tu dois avoir vérifié ton compte (rôle Membre) pour laisser un avis.")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const note = interaction.options.getInteger("note", true);
  const commentaire = interaction.options.getString("commentaire", true);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const avisChannel = await guild.channels.fetch(config.channels.avisId).catch(() => null);
  if (!avisChannel?.isTextBased() || avisChannel.isDMBased()) {
    await interaction.editReply({ embeds: [errorEmbed("Le salon #avis-client est introuvable.")] });
    return;
  }

  const stars = "⭐".repeat(note) + "☆".repeat(5 - note);
  const sent = await avisChannel.send({
    embeds: [
      brandEmbed()
        .setTitle("⭐ Nouvel avis client")
        .setDescription(joinLines(arrow("Client", `<@${interaction.user.id}>`), arrow("Note", stars), "", commentaire)),
    ],
  });

  await db().collection("avis").add({
    guildId: guild.id,
    userId: interaction.user.id,
    userTag: interaction.user.tag,
    note,
    commentaire,
    messageId: sent.id,
    createdAt: FieldValue.serverTimestamp(),
  });

  await interaction.editReply({ embeds: [successEmbed("Merci pour ton avis, il a été publié dans #avis-client !")] });
}
