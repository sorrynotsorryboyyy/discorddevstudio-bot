import "dotenv/config";
import { Client, Events, GatewayIntentBits, MessageFlags } from "discord.js";
import { executeDds } from "./commands/index.js";
import { handleGuildMemberAdd } from "./events/guildMemberAdd.js";
import { handleVerifColorClick, handleVerifStart } from "./features/verification.js";
import { handleReglementAccept } from "./features/reglement.js";
import { handleTicketClose, handleTicketMarkClient, handleTicketOpen, handleTicketTypeSelect } from "./features/tickets.js";
import { handleAnnoncesToggle } from "./features/annonces.js";
import { CUSTOM_ID } from "./lib/config.js";
import { errorEmbed } from "./lib/embeds.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Variable DISCORD_TOKEN manquante.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`🤖 DDS Bot connecté en tant que ${readyClient.user.tag}`);
});

client.on(Events.GuildMemberAdd, (member) => {
  handleGuildMemberAdd(member).catch((error) => console.error("guildMemberAdd échoué :", error));
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === "dds") {
      await executeDds(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === CUSTOM_ID.VERIF_START) {
        await handleVerifStart(interaction);
      } else if (interaction.customId.startsWith(CUSTOM_ID.VERIF_COLOR_PREFIX)) {
        await handleVerifColorClick(interaction);
      } else if (interaction.customId === CUSTOM_ID.REGLEMENT_ACCEPT) {
        await handleReglementAccept(interaction);
      } else if (interaction.customId === CUSTOM_ID.TICKET_OPEN) {
        await handleTicketOpen(interaction);
      } else if (interaction.customId === CUSTOM_ID.TICKET_CLOSE) {
        await handleTicketClose(interaction);
      } else if (interaction.customId === CUSTOM_ID.TICKET_MARK_CLIENT) {
        await handleTicketMarkClient(interaction);
      } else if (interaction.customId === CUSTOM_ID.ANNONCES_TOGGLE) {
        await handleAnnoncesToggle(interaction);
      }
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === CUSTOM_ID.TICKET_TYPE_SELECT) {
      await handleTicketTypeSelect(interaction);
    }
  } catch (error) {
    console.error("Erreur d'interaction :", error);
    if (interaction.isRepliable()) {
      const embeds = [errorEmbed("Une erreur est survenue. Réessaie plus tard.")];
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds }).catch(() => {});
      } else {
        await interaction.reply({ embeds, flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  }
});

client.login(token);
