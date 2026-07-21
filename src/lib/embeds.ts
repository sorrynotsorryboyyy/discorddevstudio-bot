import { EmbedBuilder } from "discord.js";

// Style commun de tous les embeds DDS Bot : couleur de marque, footer, timestamp.
export const BRAND_COLOR = 0x5865f2; // blurple Discord par défaut, à remplacer si tu as une couleur de marque
const ERROR_COLOR = 0xef4444;
const SUCCESS_COLOR = 0x22c55e;

export function brandEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setFooter({ text: "Discord Dev Studio" })
    .setTimestamp();
}

export function errorEmbed(message: string, title = "⚠️ Oups"): EmbedBuilder {
  return brandEmbed().setColor(ERROR_COLOR).setTitle(title).setDescription(message);
}

export function successEmbed(message: string, title = "✅ Terminé"): EmbedBuilder {
  return brandEmbed().setColor(SUCCESS_COLOR).setTitle(title).setDescription(message);
}

// Ligne « ➜ **Label** : valeur »
export function arrow(label: string, value: string): string {
  return `➜ **${label}** : ${value}`;
}

// Séparateur visuel coloré entre deux sections d'un embed
export function divider(color: "blue" | "violet" | "amber" = "blue"): string {
  const square = { blue: "🟦", violet: "🟪", amber: "🟨" }[color];
  return square.repeat(10);
}

// Titre de section en gras, précédé d'un séparateur coloré
export function sectionTitle(title: string, color: "blue" | "violet" | "amber" = "blue"): string {
  return `${divider(color)}\n**${title}**`;
}

// Assemble des lignes en ignorant les null ; "" produit une ligne vide (espacement)
export function joinLines(...lines: (string | null)[]): string {
  return lines.filter((line) => line !== null).join("\n");
}

// URL d'invitation du bot avec les permissions requises : Voir les salons,
// Gérer les salons/rôles, Expulser, Timeout, Gérer les messages, Envoyer des
// messages, Intégrer des liens, Joindre des fichiers, Historique des messages.
export function inviteUrl(clientId: string): string {
  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=1099780189202&scope=bot%20applications.commands`;
}
