import { FieldValue } from "firebase-admin/firestore";
import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { db } from "../lib/firestore.js";
import { getServerConfig } from "../lib/serverConfig.js";
import { CATALOGUE_CATEGORIES, CATALOGUE_STATUTS, type CatalogueCategoryKey, type CatalogueStatutKey } from "../lib/config.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";
import { announceCatalogueEntry } from "../features/annonces.js";

interface CatalogueEntry {
  name: string;
  categorie: CatalogueCategoryKey;
  description: string;
  price: string;
  imageUrl?: string;
  exclusifDiscord: boolean;
  statut: CatalogueStatutKey;
  messageId?: string;
}

function statutLabel(statut: CatalogueStatutKey): string {
  const s = CATALOGUE_STATUTS.find((s) => s.key === statut);
  return s ? `${s.emoji} ${s.label}` : statut;
}

async function getCatalogueChannel(
  interaction: ChatInputCommandInteraction,
  categorie: CatalogueCategoryKey
): Promise<TextChannel | null> {
  const config = await getServerConfig();
  const channelId = config?.channels.catalogueChannels?.[categorie];
  if (!channelId) return null;
  const channel = await interaction.guild!.channels.fetch(channelId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() ? (channel as TextChannel) : null;
}

function catalogueEmbed(entry: CatalogueEntry) {
  const category = CATALOGUE_CATEGORIES.find((c) => c.key === entry.categorie);
  const embed = brandEmbed()
    .setTitle(entry.exclusifDiscord ? `${entry.name} · 🔒 Exclusif Discord` : entry.name)
    .setDescription(
      joinLines(
        entry.description,
        "",
        arrow("Catégorie", category ? `${category.emoji} ${category.label}` : entry.categorie),
        arrow("Prix", entry.price),
        arrow("Statut", statutLabel(entry.statut))
      )
    );
  if (entry.imageUrl) embed.setImage(entry.imageUrl);
  return embed;
}

async function postOrUpdateEntry(
  channel: TextChannel,
  docRef: FirebaseFirestore.DocumentReference,
  entry: CatalogueEntry
): Promise<void> {
  if (entry.messageId) {
    const message = await channel.messages.fetch(entry.messageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [catalogueEmbed(entry)] });
      return;
    }
  }
  const sent = await channel.send({ embeds: [catalogueEmbed(entry)] });
  await docRef.update({ messageId: sent.id });
}

export async function executeCatalogue(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      embeds: [errorEmbed("Cette commande est réservée aux administrateurs (permission « Gérer le serveur »).")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();
  const catalogue = db().collection("catalogue");

  if (sub === "list") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const categorieFilter = interaction.options.getString("categorie") as CatalogueCategoryKey | null;
    const snap = categorieFilter
      ? await catalogue.where("categorie", "==", categorieFilter).get()
      : await catalogue.orderBy("name").get();
    if (snap.empty) {
      await interaction.editReply({ embeds: [brandEmbed().setTitle("📦 Catalogue").setDescription("Aucune entrée pour le moment.")] });
      return;
    }
    const docs = categorieFilter
      ? snap.docs.sort((a, b) => (a.data().name as string).localeCompare(b.data().name as string))
      : snap.docs;
    const lines = docs.map((doc) => {
      const e = doc.data() as CatalogueEntry;
      const category = CATALOGUE_CATEGORIES.find((c) => c.key === e.categorie);
      return arrow(`${category?.emoji ?? ""} ${e.name}`.trim(), `${statutLabel(e.statut)} — ${e.price}`);
    });
    await interaction.editReply({ embeds: [brandEmbed().setTitle("📦 Catalogue").setDescription(joinLines(...lines))] });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const nom = interaction.options.getString("nom", true);

  if (sub === "add") {
    const categorie = interaction.options.getString("categorie", true) as CatalogueCategoryKey;
    const channel = await getCatalogueChannel(interaction, categorie);
    if (!channel) {
      await interaction.editReply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/dds setup` manquant).")] });
      return;
    }
    const existing = await catalogue.where("name", "==", nom).limit(1).get();
    if (!existing.empty) {
      await interaction.editReply({ embeds: [errorEmbed(`Une entrée « ${nom} » existe déjà. Utilise \`/dds catalogue edit\`.`)] });
      return;
    }
    const entry: CatalogueEntry = {
      name: nom,
      categorie,
      description: interaction.options.getString("description", true),
      price: interaction.options.getString("prix", true),
      imageUrl: interaction.options.getAttachment("image")?.url,
      exclusifDiscord: interaction.options.getBoolean("exclusif") ?? false,
      statut: (interaction.options.getString("statut") as CatalogueStatutKey | null) ?? "disponible",
    };
    const docRef = await catalogue.add({ ...entry, createdAt: FieldValue.serverTimestamp() });
    await postOrUpdateEntry(channel, docRef, entry);
    const config = await getServerConfig();
    if (config) await announceCatalogueEntry(interaction.guild!, config, "nouveau", entry);
    await interaction.editReply({ embeds: [successEmbed(`« ${nom} » a été ajouté au catalogue.`)] });
    return;
  }

  const snap = await catalogue.where("name", "==", nom).limit(1).get();
  if (snap.empty) {
    await interaction.editReply({ embeds: [errorEmbed(`Aucune entrée « ${nom} » trouvée dans le catalogue.`)] });
    return;
  }
  const doc = snap.docs[0];
  const current = doc.data() as CatalogueEntry;
  const channel = await getCatalogueChannel(interaction, current.categorie);

  if (sub === "remove") {
    if (channel && current.messageId) {
      const message = await channel.messages.fetch(current.messageId).catch(() => null);
      await message?.delete().catch(() => {});
    }
    await doc.ref.delete();
    await interaction.editReply({ embeds: [successEmbed(`« ${nom} » a été retiré du catalogue.`)] });
    return;
  }

  if (sub === "edit") {
    if (!channel) {
      await interaction.editReply({
        embeds: [errorEmbed("Le salon de cette catégorie est introuvable (`/dds setup` manquant ou salon supprimé).")],
      });
      return;
    }
    const description = interaction.options.getString("description");
    const prix = interaction.options.getString("prix");
    const image = interaction.options.getAttachment("image");
    const exclusif = interaction.options.getBoolean("exclusif");
    const statut = interaction.options.getString("statut") as CatalogueStatutKey | null;

    const updated: CatalogueEntry = {
      ...current,
      description: description ?? current.description,
      price: prix ?? current.price,
      imageUrl: image?.url ?? current.imageUrl,
      exclusifDiscord: exclusif ?? current.exclusifDiscord,
      statut: statut ?? current.statut,
    };
    await doc.ref.update({ ...updated });
    await postOrUpdateEntry(channel, doc.ref, updated);
    if (statut === "disponible" && current.statut !== "disponible") {
      const config = await getServerConfig();
      if (config) await announceCatalogueEntry(interaction.guild!, config, "disponible", updated);
    }
    await interaction.editReply({ embeds: [successEmbed(`« ${nom} » a été mis à jour.`)] });
    return;
  }
}
