import { MessageFlags, type ButtonInteraction } from "discord.js";
import { getServerConfig } from "../lib/serverConfig.js";
import { errorEmbed, successEmbed } from "../lib/embeds.js";

export async function handleReglementAccept(interaction: ButtonInteraction) {
  const guild = interaction.guild;
  if (!guild) return;

  const config = await getServerConfig();
  if (!config) {
    await interaction.reply({
      embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/dds setup` manquant).")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return;

  await member.roles.remove(config.roles.visiteurId).catch(() => {});
  await member.roles.add(config.roles.membreId).catch((error) => {
    console.error("Attribution du rôle Membre échouée :", error);
  });

  await interaction.update({
    embeds: [
      successEmbed(
        "Bienvenue sur **Discord Dev Studio** ! Tu as maintenant accès aux salons du serveur.",
        "🎉 Vérification terminée"
      ),
    ],
    components: [],
  });
}
