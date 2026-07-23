import { SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import { executeSetup } from "./setup.js";
import { executeAvis } from "./avis.js";
import { executeCatalogue } from "./catalogue.js";
import { CATALOGUE_CATEGORIES, CATALOGUE_STATUTS } from "../lib/config.js";

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
      .setName("catalogue")
      .setDescription("Gère le catalogue de bots à vendre — admin uniquement")
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Ajoute un bot au catalogue")
          .addStringOption((opt) => opt.setName("nom").setDescription("Nom du bot").setRequired(true))
          .addStringOption((opt) =>
            opt
              .setName("categorie")
              .setDescription("Catégorie du bot")
              .setRequired(true)
              .addChoices(...CATALOGUE_CATEGORIES.map((cat) => ({ name: cat.label, value: cat.key })))
          )
          .addStringOption((opt) => opt.setName("description").setDescription("Description du bot").setRequired(true))
          .addStringOption((opt) => opt.setName("prix").setDescription("Prix (ex: 49 €, sur devis...)").setRequired(true))
          .addAttachmentOption((opt) => opt.setName("image").setDescription("Image/aperçu du bot"))
          .addBooleanOption((opt) => opt.setName("exclusif").setDescription("Vendu uniquement sur ce Discord ?"))
          .addStringOption((opt) =>
            opt
              .setName("statut")
              .setDescription("Statut de vente (par défaut Disponible)")
              .addChoices(...CATALOGUE_STATUTS.map((s) => ({ name: s.label, value: s.key })))
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("Modifie une entrée du catalogue")
          .addStringOption((opt) => opt.setName("nom").setDescription("Nom de l'entrée à modifier").setRequired(true))
          .addStringOption((opt) => opt.setName("description").setDescription("Nouvelle description"))
          .addStringOption((opt) => opt.setName("prix").setDescription("Nouveau prix"))
          .addAttachmentOption((opt) => opt.setName("image").setDescription("Nouvelle image"))
          .addBooleanOption((opt) => opt.setName("exclusif").setDescription("Vendu uniquement sur ce Discord ?"))
          .addStringOption((opt) =>
            opt
              .setName("statut")
              .setDescription("Statut de vente")
              .addChoices(...CATALOGUE_STATUTS.map((s) => ({ name: s.label, value: s.key })))
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Retire une entrée du catalogue")
          .addStringOption((opt) => opt.setName("nom").setDescription("Nom de l'entrée à retirer").setRequired(true))
      )
      .addSubcommand((sub) =>
        sub
          .setName("list")
          .setDescription("Liste les entrées du catalogue")
          .addStringOption((opt) =>
            opt
              .setName("categorie")
              .setDescription("Filtrer par catégorie")
              .addChoices(...CATALOGUE_CATEGORIES.map((cat) => ({ name: cat.label, value: cat.key })))
          )
      )
  );

export async function executeDds(interaction: ChatInputCommandInteraction) {
  const group = interaction.options.getSubcommandGroup(false);
  if (group === "catalogue") {
    await executeCatalogue(interaction);
    return;
  }
  switch (interaction.options.getSubcommand()) {
    case "setup":
      return executeSetup(interaction);
    case "avis":
      return executeAvis(interaction);
  }
}
