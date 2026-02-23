import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import { resolveFeishuAccount } from "./accounts.js";
import type { FeishuMessageEvent } from "./bot.js";
import { checkOwnerMentioned } from "./mention.js";
import { resolveFeishuGroupConfig, resolveFeishuReplyPolicy } from "./policy.js";
import { sendMessageFeishu } from "./send.js";

/**
 * Fire-and-forget owner @mention notification for group chats.
 *
 * When `ownerOpenId` is configured and someone @mentions the owner in a group
 * where the bot was NOT mentioned, a DM notification is sent to the owner.
 *
 * This runs alongside `handleFeishuMessage` from monitor.ts so that
 * bot.ts stays untouched and upstream merges remain conflict-free.
 */
export async function maybeNotifyOwnerMention(params: {
  cfg: ClawdbotConfig;
  event: FeishuMessageEvent;
  accountId?: string;
  botOpenId?: string;
  log?: (...args: unknown[]) => void;
}): Promise<void> {
  const { cfg, event, accountId, botOpenId, log = console.log } = params;

  // Only group messages
  if (event.message.chat_type !== "group") return;

  const account = resolveFeishuAccount({ cfg, accountId });
  const feishuCfg = account.config;

  // Resolve ownerOpenId(s)
  const rawOwnerOpenId = feishuCfg?.ownerOpenId;
  const ownerOpenIds = rawOwnerOpenId
    ? Array.isArray(rawOwnerOpenId)
      ? rawOwnerOpenId
      : [rawOwnerOpenId]
    : [];
  if (ownerOpenIds.length === 0) return;

  // Check requireMention policy — owner notify only fires when bot requires mention
  const chatId = event.message.chat_id;
  const groupConfig = resolveFeishuGroupConfig({ cfg: feishuCfg, groupId: chatId });
  const { requireMention } = resolveFeishuReplyPolicy({
    isDirectMessage: false,
    globalConfig: feishuCfg,
    groupConfig,
  });
  if (!requireMention) return;

  // If bot is mentioned, the message will be handled normally — no owner DM needed
  const mentions = event.message.mentions ?? [];
  if (botOpenId && mentions.some((m) => m.id.open_id === botOpenId)) return;

  // Check if owner is mentioned
  if (!checkOwnerMentioned(event, ownerOpenIds)) return;

  // Build notification text
  const speaker = event.sender.sender_id.open_id;
  let textBody = "";
  try {
    const parsed = JSON.parse(event.message.content);
    textBody = parsed.text ?? event.message.content;
  } catch {
    textBody = event.message.content;
  }
  const preview = textBody.slice(0, 500);
  const notifyText = `[群聊提醒] ${speaker} @了你:\n${preview}`;

  await sendMessageFeishu({
    cfg,
    to: `user:${ownerOpenIds[0]}`,
    text: notifyText,
    accountId: account.accountId,
  }).catch((err) => {
    log(`feishu[${account.accountId}]: failed to notify owner: ${String(err)}`);
  });
}
