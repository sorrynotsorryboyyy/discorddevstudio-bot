import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import { CATALOGUE_CATEGORIES, CUSTOM_ID, type CatalogueCategoryKey } from "../lib/config.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";
import { getServerConfig, type ServerConfig } from "../lib/serverConfig.js";

// Composants du message fixe posté dans #annonces par /dds setup.
export function annoncesToggleComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.ANNONCES_TOGGLE)
        .setLabel("S'abonner / Se désabonner")
        .setEmoji("🔔")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

export async function handleAnnoncesToggle(interaction: ButtonInteraction) {
  const config = await getServerConfig();
  if (!config) {
    await interaction.reply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré.")], flags: MessageFlags.Ephemeral });
    return;
  }

  const member = interaction.member as GuildMember;
  const subscribed = member.roles.cache.has(config.roles.annoncesId);

  if (subscribed) {
    await member.roles.remove(config.roles.annoncesId).catch(() => {});
    await interaction.reply({ embeds: [successEmbed("Tu ne recevras plus les pings d'annonces.")], flags: MessageFlags.Ephemeral });
  } else {
    await member.roles.add(config.roles.annoncesId).catch(() => {});
    await interaction.reply({ embeds: [successEmbed("Tu recevras désormais un ping à chaque nouveauté 🔔")], flags: MessageFlags.Ephemeral });
  }
}

// Poste une annonce dans #annonces (avec ping du rôle Annonces) et épingle le
// message à la place du précédent, pour que le salon reflète toujours la
// dernière nouveauté sans avoir à maintenir un message récapitulatif à part.
export async function announceCatalogueEntry(
  guild: Guild,
  config: ServerConfig,
  kind: "nouveau" | "disponible",
  entry: { name: string; categorie: CatalogueCategoryKey; price: string }
): Promise<void> {
  const channel = await guild.channels.fetch(config.channels.annoncesId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;

  const category = CATALOGUE_CATEGORIES.find((c) => c.key === entry.categorie);
  const embed = brandEmbed()
    .setTitle(kind === "nouveau" ? "🆕 Nouveauté" : "✅ Maintenant disponible")
    .setDescription(
      joinLines(
        arrow("Nom", entry.name),
        arrow("Catégorie", category ? `${category.emoji} ${category.label}` : entry.categorie),
        arrow("Prix", entry.price)
      )
    );

  const sent = await (channel as TextChannel).send({
    content: `<@&${config.roles.annoncesId}>`,
    embeds: [embed],
  });

  const pinned = await (channel as TextChannel).messages.fetchPinned().catch(() => null);
  if (pinned) {
    for (const [, message] of pinned) {
      await message.unpin().catch(() => {});
    }
  }
  await sent.pin().catch(() => {});
}
