import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";
import { COLOR_CHALLENGE_PALETTE, CUSTOM_ID } from "../lib/config.js";
import { brandEmbed, joinLines } from "../lib/embeds.js";

// Composants du message fixe posté dans #verification par /dds setup.
export function verificationStartComponents() {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.VERIF_START)
        .setLabel("Se vérifier")
        .setEmoji("🔎")
        .setStyle(ButtonStyle.Primary)
    ),
  ];
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Défi couleur : la couleur cible est portée par l'emoji du bouton (Discord
// n'offre que 4 styles de bouton, pas 6 couleurs) ; la bonne réponse est
// encodée dans le customId lui-même (ex. "verif:color:bleu:bleu" si le
// bouton bleu est cliqué alors que la cible est bleu), donc aucun état
// serveur à conserver entre l'affichage du défi et le clic.
function buildChallenge(note?: string) {
  const buttons = shuffle(COLOR_CHALLENGE_PALETTE);
  const target = buttons[Math.floor(Math.random() * buttons.length)];

  const embed = brandEmbed()
    .setTitle("🎨 Vérification anti-bot")
    .setDescription(
      joinLines(
        note ?? null,
        note ? "" : null,
        `Clique sur le bouton **${target.label}** ${target.emoji} pour continuer.`
      )
    );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...buttons.slice(i, i + 3).map((c) =>
          new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID.VERIF_COLOR_PREFIX}${c.key}:${target.key}`)
            .setLabel(c.label)
            .setEmoji(c.emoji)
            .setStyle(ButtonStyle.Secondary)
        )
      )
    );
  }

  return { embeds: [embed], components: rows };
}

export async function handleVerifStart(interaction: ButtonInteraction) {
  const { embeds, components } = buildChallenge();
  await interaction.reply({ embeds, components, flags: MessageFlags.Ephemeral });
}

export async function handleVerifColorClick(interaction: ButtonInteraction) {
  const payload = interaction.customId.slice(CUSTOM_ID.VERIF_COLOR_PREFIX.length);
  const [buttonKey, targetKey] = payload.split(":");

  if (buttonKey === targetKey) {
    const embed = brandEmbed()
      .setTitle("📜 Règlement")
      .setDescription(
        joinLines(
          "Avant d'accéder au serveur, merci de lire et d'accepter le règlement :",
          "",
          "1. Respecte les autres membres et le staff — aucune insulte, harcèlement ou discrimination.",
          "2. Pas de spam, pas de publicité non sollicitée.",
          "3. Le salon #passer-commande sert uniquement à ouvrir un ticket, pas à discuter.",
          "4. Le staff peut clore, refuser ou annuler une commande à sa discrétion.",
          "5. Toute tentative de contournement de l'anti-bot ou du règlement entraîne une exclusion.",
          "",
          "Clique ci-dessous pour accepter et débloquer les salons du serveur."
        )
      );
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(CUSTOM_ID.REGLEMENT_ACCEPT)
        .setLabel("J'accepte le règlement")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success)
    );
    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  const { embeds, components } = buildChallenge("❌ Mauvaise couleur, réessaie !");
  await interaction.update({ embeds, components });
}
