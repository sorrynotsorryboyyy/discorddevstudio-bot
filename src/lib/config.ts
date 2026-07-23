// Noms des rôles créés/gérés par /dds setup
export const ROLE_VISITEUR = "Visiteur";
export const ROLE_MEMBRE = "Membre";
export const ROLE_MODERATION = "Modération";
export const ROLE_ADMIN = "Admin";
export const ROLE_ANNONCES = "🔔 Annonces";
export const ROLE_CLIENT = "🛒 Client";

// Noms des catégories et salons créés par /dds setup
export const CAT_ARRIVEE = "🚪 Arrivée";
export const CAT_STUDIO = "🏢 Discord Dev Studio";
export const CAT_DISCUSSION = "💬 Discussion";
export const CAT_STAFF = "🛠️ Staff";

export const CHAN_VERIFICATION = "✅・verification";
export const CHAN_ANNONCES = "📢・annonces";
export const CHAN_COMMANDE = "🎫・passer-commande";
export const CHAN_AVIS = "⭐・avis-client";
export const CHAN_LOGS_TICKETS = "📋・logs-tickets";
export const CHAN_STAFF_DISCUSSION = "🗣️・discussion-staff";
export const CHAN_GENERAL = "💬・général";
export const CHAN_IMAGE = "🖼️・image";
export const CHAN_LASALADE = "🥗・la-salade";
export const CHAN_FORUM_AIDE = "❓・questions-aide";

// Catégories du catalogue vendu — chaque catégorie a son propre salon dédié.
// Pour ajouter une catégorie : ajouter une entrée ici, relancer `/dds setup`
// (crée le salon) puis `npm run deploy-commands` (met à jour les choix de
// `/dds catalogue add`).
export const CATALOGUE_CATEGORIES = [
  { key: "botdiscord", label: "Bots Discord", emoji: "🤖", channel: "🤖・bots-discord" },
  { key: "minecraft", label: "Minecraft", emoji: "⛏️", channel: "⛏️・minecraft" },
  { key: "web", label: "Web", emoji: "🌐", channel: "🌐・web" },
] as const;

export type CatalogueCategoryKey = (typeof CATALOGUE_CATEGORIES)[number]["key"];

// Statuts possibles d'une entrée du catalogue.
export const CATALOGUE_STATUTS = [
  { key: "disponible", label: "Disponible", emoji: "🟢" },
  { key: "en_developpement", label: "En développement", emoji: "🟡" },
  { key: "vendu", label: "Vendu", emoji: "🔴" },
] as const;

export type CatalogueStatutKey = (typeof CATALOGUE_STATUTS)[number]["key"];

// Palette du défi anti-bot (couleur portée par l'emoji, pas par le style du
// bouton — Discord ne propose que 4 styles de bouton, pas 6 couleurs).
export const COLOR_CHALLENGE_PALETTE = [
  { key: "rouge", label: "Rouge", emoji: "🔴" },
  { key: "orange", label: "Orange", emoji: "🟠" },
  { key: "jaune", label: "Jaune", emoji: "🟡" },
  { key: "vert", label: "Vert", emoji: "🟢" },
  { key: "bleu", label: "Bleu", emoji: "🔵" },
  { key: "violet", label: "Violet", emoji: "🟣" },
] as const;

// Types de ticket proposés dans #passer-commande
export const TICKET_TYPES = [
  { key: "question", label: "Question", emoji: "❓" },
  { key: "demande", label: "Demande", emoji: "📝" },
  { key: "devis", label: "Devis", emoji: "💰" },
  { key: "commande", label: "Passer commande", emoji: "🛒" },
] as const;

export type TicketTypeKey = (typeof TICKET_TYPES)[number]["key"];

// customId des boutons/menus, préfixés par flux pour un routage simple dans
// index.ts (startsWith / égalité stricte selon les cas).
export const CUSTOM_ID = {
  VERIF_START: "verif:start",
  VERIF_COLOR_PREFIX: "verif:color:",
  REGLEMENT_ACCEPT: "reglement:accept",
  TICKET_OPEN: "ticket:open",
  TICKET_TYPE_SELECT: "ticket:type-select",
  TICKET_CLOSE: "ticket:close",
  TICKET_MARK_CLIENT: "ticket:mark-client",
  ANNONCES_TOGGLE: "annonces:toggle",
} as const;

export const REGLEMENT_TEXT = [
  "1. Respecte les autres membres et le staff — aucune insulte, harcèlement ou discrimination.",
  "2. Pas de spam, pas de publicité non sollicitée.",
  "3. Le salon #passer-commande sert uniquement à ouvrir un ticket, pas à discuter.",
  "4. Le staff peut clore, refuser ou annuler une commande à sa discrétion.",
  "5. Toute tentative de contournement de l'anti-bot ou du règlement entraîne une exclusion.",
].join("\n");
