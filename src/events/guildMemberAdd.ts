import type { GuildMember } from "discord.js";
import { getServerConfig } from "../lib/serverConfig.js";

// Rôle Visiteur attribué automatiquement : donne accès au seul salon de
// vérification, jusqu'à l'acceptation du règlement (voir features/reglement.ts).
export async function handleGuildMemberAdd(member: GuildMember) {
  const config = await getServerConfig();
  if (!config) return;
  await member.roles.add(config.roles.visiteurId).catch((error) => {
    console.error("Attribution du rôle Visiteur échouée :", error);
  });
}
