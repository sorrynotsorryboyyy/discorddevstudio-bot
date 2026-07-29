import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { getServerConfig } from "../lib/serverConfig.js";
import { CATALOGUE_CATEGORIES, type CatalogueCategoryKey } from "../lib/config.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";
import { postAndPinAnnonce } from "../features/annonces.js";

export async function executeEmbedCreate(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      embeds: [errorEmbed("Cette commande est réservée aux administrateurs (permission « Gérer le serveur »).")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guild = interaction.guild!;
  const config = await getServerConfig();
  if (!config) {
    await interaction.editReply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/is setup` manquant).")] });
    return;
  }

  const titre = interaction.options.getString("titre", true);
  const description = interaction.options.getString("description", true);
  const salon = interaction.options.getString("salon", true);
  const prix = interaction.options.getString("prix");
  const image = interaction.options.getAttachment("image");

  const embed = brandEmbed()
    .setTitle(titre)
    .setDescription(prix ? joinLines(description, "", arrow("Prix", prix)) : description);
  if (image) embed.setImage(image.url);

  if (salon === "annonces") {
    await postAndPinAnnonce(guild, config, embed);
    await interaction.editReply({ embeds: [successEmbed("Embed posté dans #annonces (ping + épingle).")] });
    return;
  }

  const channelId = config.channels.catalogueChannels[salon as CatalogueCategoryKey];
  const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : null;
  if (!channel?.isTextBased() || channel.isDMBased()) {
    await interaction.editReply({ embeds: [errorEmbed("Le salon choisi est introuvable (`/is setup` manquant ou salon supprimé).")] });
    return;
  }

  await (channel as TextChannel).send({ embeds: [embed] });
  const category = CATALOGUE_CATEGORIES.find((c) => c.key === salon);
  await interaction.editReply({ embeds: [successEmbed(`Embed posté dans ${category?.emoji ?? ""} ${category?.label ?? salon}.`)] });
}
