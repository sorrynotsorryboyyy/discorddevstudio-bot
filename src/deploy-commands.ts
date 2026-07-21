import "dotenv/config";
import { REST, Routes } from "discord.js";
import { ddsCommand } from "./commands/index.js";

// Enregistre la commande /dds (et retire les anciennes commandes).
// Avec DISCORD_GUILD_ID : enregistrement instantané sur un seul serveur (idéal en dev).
// Sans : enregistrement global (propagation en ~1 h).
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token || !clientId) {
  console.error("Variables DISCORD_TOKEN et DISCORD_CLIENT_ID requises.");
  process.exit(1);
}

const body = [ddsCommand.toJSON()];
const rest = new REST().setToken(token);
const guildId = process.env.DISCORD_GUILD_ID;

try {
  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`✅ Commande /dds enregistrée sur le serveur ${guildId}.`);
  } else {
    await rest.put(Routes.applicationCommands(clientId), { body });
    console.log("✅ Commande /dds enregistrée globalement (propagation ~1 h).");
  }
} catch (error) {
  console.error("Échec de l'enregistrement des commandes :", error);
  process.exitCode = 1;
}
