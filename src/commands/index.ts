import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { executeSetup } from "./setup.js";
import { executeAvis } from "./avis.js";
import { executePortfolio } from "./portfolio.js";

export const ddsCommand = new SlashCommandBuilder()
  .setName("dds")
  .setDescription("Discord Dev Studio — configuration et commandes du bot")
  .setDMPermission(false)
  .addSubcommand((sub) => sub.setName("setup").setDescription("Configure le serveur (rôles, salons, messages) — admin uniquement"))
  .addSubcommand((sub) =>
    sub
      .setName("avis")
      .setDescription("Laisse un avis client")
      .addIntegerOption((opt) => opt.setName("note").setDescription("Note de 1 à 5").setMinValue(1).setMaxValue(5).setRequired(true))
      .addStringOption((opt) => opt.setName("commentaire").setDescription("Ton commentaire").setMaxLength(1000).setRequired(true))
  )
  .addSubcommandGroup((group) =>
    group
      .setName("portfolio")
      .setDescription("Gère les entrées du portfolio — admin uniquement")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Ajoute un bot au portfolio")
          .addStringOption((opt) => opt.setName("nom").setDescription("Nom du bot").setRequired(true))
          .addStringOption((opt) => opt.setName("description").setDescription("Description du bot").setRequired(true))
          .addStringOption((opt) => opt.setName("prix").setDescription("Prix (ex: 49 €, sur devis...)").setRequired(true))
          .addAttachmentOption((opt) => opt.setName("image").setDescription("Image/aperçu du bot"))
          .addBooleanOption((opt) => opt.setName("exclusif").setDescription("Vendu uniquement sur ce Discord ?"))
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("Modifie une entrée du portfolio")
          .addStringOption((opt) => opt.setName("nom").setDescription("Nom de l'entrée à modifier").setRequired(true))
          .addStringOption((opt) => opt.setName("description").setDescription("Nouvelle description"))
          .addStringOption((opt) => opt.setName("prix").setDescription("Nouveau prix"))
          .addAttachmentOption((opt) => opt.setName("image").setDescription("Nouvelle image"))
          .addBooleanOption((opt) => opt.setName("exclusif").setDescription("Vendu uniquement sur ce Discord ?"))
          .addStringOption((opt) =>
            opt
              .setName("statut")
              .setDescription("Statut de vente")
              .addChoices({ name: "Disponible", value: "disponible" }, { name: "Vendu", value: "vendu" })
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Retire une entrée du portfolio")
          .addStringOption((opt) => opt.setName("nom").setDescription("Nom de l'entrée à retirer").setRequired(true))
      )
      .addSubcommand((sub) => sub.setName("list").setDescription("Liste toutes les entrées du portfolio"))
  );

export async function executeDds(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup(false);
  if (group === "portfolio") {
    await executePortfolio(interaction);
    return;
  }
  switch (interaction.options.getSubcommand()) {
    case "setup":
      return executeSetup(interaction);
    case "avis":
      return executeAvis(interaction);
  }
}
