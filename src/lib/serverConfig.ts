import type { GuildMember } from "discord.js";
import { db } from "./firestore.js";

export interface ServerConfig {
  roles: {
    visiteurId: string;
    membreId: string;
    moderationId: string;
    adminId: string;
  };
  channels: {
    arriveeCategoryId: string;
    verificationId: string;
    studioCategoryId: string;
    portfolioId: string;
    commandeId: string;
    avisId: string;
    staffCategoryId: string;
    logsTicketsId: string;
  };
  messages: {
    verificationMessageId?: string;
    portfolioMessageId?: string;
    commandeMessageId?: string;
    avisMessageId?: string;
    logsTicketsMessageId?: string;
  };
}

const CONFIG_DOC = () => db().collection("config").doc("server");

export async function getServerConfig(): Promise<ServerConfig | null> {
  const snap = await CONFIG_DOC().get();
  return snap.exists ? (snap.data() as ServerConfig) : null;
}

export async function updateServerConfig(patch: Record<string, unknown>): Promise<void> {
  await CONFIG_DOC().set(patch, { merge: true });
}

export function hasAnyRole(member: GuildMember, roleIds: (string | undefined)[]): boolean {
  return roleIds.some((id) => id !== undefined && member.roles.cache.has(id));
}
