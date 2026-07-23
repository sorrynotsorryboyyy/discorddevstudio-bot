import type { GuildMember } from "discord.js";
import { db } from "./firestore.js";
import type { CatalogueCategoryKey } from "./config.js";

export interface ServerConfig {
  roles: {
    visiteurId: string;
    membreId: string;
    moderationId: string;
    adminId: string;
    annoncesId: string;
    clientId: string;
  };
  channels: {
    arriveeCategoryId: string;
    verificationId: string;
    studioCategoryId: string;
    annoncesId: string;
    catalogueChannels: Partial<Record<CatalogueCategoryKey, string>>;
    commandeId: string;
    avisId: string;
    discussionCategoryId: string;
    generalId: string;
    imageId: string;
    lasaladeId: string;
    forumAideId: string;
    staffCategoryId: string;
    logsTicketsId: string;
    staffDiscussionId: string;
  };
  messages: {
    verificationMessageId?: string;
    annoncesMessageId?: string;
    catalogueMessages?: Partial<Record<CatalogueCategoryKey, string>>;
    commandeMessageId?: string;
    avisMessageId?: string;
    generalMessageId?: string;
    imageMessageId?: string;
    lasaladeMessageId?: string;
    logsTicketsMessageId?: string;
    staffDiscussionMessageId?: string;
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
