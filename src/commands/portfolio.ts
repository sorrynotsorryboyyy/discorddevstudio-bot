import { FieldValue } from "firebase-admin/firestore";
import { MessageFlags, PermissionFlagsBits, type ChatInputCommandInteraction, type TextChannel } from "discord.js";
import { db } from "../lib/firestore.js";
import { getServerConfig } from "../lib/serverConfig.js";
import { arrow, brandEmbed, errorEmbed, joinLines, successEmbed } from "../lib/embeds.js";

interface PortfolioEntry {
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
  exclusifDiscord: boolean;
  statut: "disponible" | "vendu";
  messageId?: string;
}

async function getPortfolioChannel(interaction: ChatInputCommandInteraction): Promise<TextChannel | null> {
  const config = await getServerConfig();
  if (!config) return null;
  const channel = await interaction.guild!.channels.fetch(config.channels.portfolioId).catch(() => null);
  return channel?.isTextBased() && !channel.isDMBased() ? (channel as TextChannel) : null;
}

function portfolioEmbed(entry: PortfolioEntry) {
  const embed = brandEmbed()
    .setTitle(entry.exclusifDiscord ? `${entry.name} · 🔒 Exclusif Discord` : entry.name)
    .setDescription(
      joinLines(
        entry.description,
        "",
        arrow("Prix", entry.price),
        arrow("Statut", entry.statut === "vendu" ? "🔴 Vendu" : "🟢 Disponible")
      )
    );
  if (entry.imageUrl) embed.setImage(entry.imageUrl);
  return embed;
}

async function postOrUpdateEntry(
  channel: TextChannel,
  docRef: FirebaseFirestore.DocumentReference,
  entry: PortfolioEntry
): Promise<void> {
  if (entry.messageId) {
    const message = await channel.messages.fetch(entry.messageId).catch(() => null);
    if (message) {
      await message.edit({ embeds: [portfolioEmbed(entry)] });
      return;
    }
  }
  const sent = await channel.send({ embeds: [portfolioEmbed(entry)] });
  await docRef.update({ messageId: sent.id });
}

export async function executePortfolio(interaction: ChatInputCommandInteraction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      embeds: [errorEmbed("Cette commande est réservée aux administrateurs (permission « Gérer le serveur »).")],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "list") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const snap = await db().collection("portfolio").orderBy("name").get();
    if (snap.empty) {
      await interaction.editReply({ embeds: [brandEmbed().setTitle("🎨 Portfolio").setDescription("Aucune entrée pour le moment.")] });
      return;
    }
    const lines = snap.docs.map((doc) => {
      const e = doc.data() as PortfolioEntry;
      return arrow(e.name, `${e.statut === "vendu" ? "🔴 Vendu" : "🟢 Disponible"} — ${e.price}`);
    });
    await interaction.editReply({ embeds: [brandEmbed().setTitle("🎨 Portfolio").setDescription(joinLines(...lines))] });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = await getPortfolioChannel(interaction);
  if (!channel) {
    await interaction.editReply({ embeds: [errorEmbed("Le serveur n'est pas encore configuré (`/dds setup` manquant).")] });
    return;
  }

  const nom = interaction.options.getString("nom", true);
  const portfolio = db().collection("portfolio");

  if (sub === "add") {
    const existing = await portfolio.where("name", "==", nom).limit(1).get();
    if (!existing.empty) {
      await interaction.editReply({ embeds: [errorEmbed(`Une entrée « ${nom} » existe déjà. Utilise \`/dds portfolio edit\`.`)] });
      return;
    }
    const entry: PortfolioEntry = {
      name: nom,
      description: interaction.options.getString("description", true),
      price: interaction.options.getString("prix", true),
      imageUrl: interaction.options.getAttachment("image")?.url,
      exclusifDiscord: interaction.options.getBoolean("exclusif") ?? false,
      statut: "disponible",
    };
    const docRef = await portfolio.add({ ...entry, createdAt: FieldValue.serverTimestamp() });
    await postOrUpdateEntry(channel, docRef, entry);
    await interaction.editReply({ embeds: [successEmbed(`« ${nom} » a été ajouté au portfolio.`)] });
    return;
  }

  const snap = await portfolio.where("name", "==", nom).limit(1).get();
  if (snap.empty) {
    await interaction.editReply({ embeds: [errorEmbed(`Aucune entrée « ${nom} » trouvée dans le portfolio.`)] });
    return;
  }
  const doc = snap.docs[0];

  if (sub === "remove") {
    const entry = doc.data() as PortfolioEntry;
    if (entry.messageId) {
      const message = await channel.messages.fetch(entry.messageId).catch(() => null);
      await message?.delete().catch(() => {});
    }
    await doc.ref.delete();
    await interaction.editReply({ embeds: [successEmbed(`« ${nom} » a été retiré du portfolio.`)] });
    return;
  }

  if (sub === "edit") {
    const current = doc.data() as PortfolioEntry;
    const description = interaction.options.getString("description");
    const prix = interaction.options.getString("prix");
    const image = interaction.options.getAttachment("image");
    const exclusif = interaction.options.getBoolean("exclusif");
    const statut = interaction.options.getString("statut") as "disponible" | "vendu" | null;

    const updated: PortfolioEntry = {
      ...current,
      description: description ?? current.description,
      price: prix ?? current.price,
      imageUrl: image?.url ?? current.imageUrl,
      exclusifDiscord: exclusif ?? current.exclusifDiscord,
      statut: statut ?? current.statut,
    };
    await doc.ref.update({ ...updated });
    await postOrUpdateEntry(channel, doc.ref, updated);
    await interaction.editReply({ embeds: [successEmbed(`« ${nom} » a été mis à jour.`)] });
    return;
  }
}
