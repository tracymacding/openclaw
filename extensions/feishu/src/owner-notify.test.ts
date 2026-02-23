import type { ClawdbotConfig, RuntimeEnv } from "openclaw/plugin-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeishuMessageEvent } from "./bot.js";
import { maybeNotifyOwnerMention } from "./owner-notify.js";

const { mockSendMessageFeishu } = vi.hoisted(() => ({
  mockSendMessageFeishu: vi.fn().mockResolvedValue({ messageId: "notify-msg", chatId: "oc-dm" }),
}));

vi.mock("./send.js", () => ({
  sendMessageFeishu: mockSendMessageFeishu,
  getMessageFeishu: vi.fn().mockResolvedValue(null),
}));

function makeGroupEvent(overrides?: {
  mentions?: FeishuMessageEvent["message"]["mentions"];
  messageId?: string;
  content?: string;
}): FeishuMessageEvent {
  return {
    sender: { sender_id: { open_id: "ou-colleague" } },
    message: {
      message_id: overrides?.messageId ?? "msg-owner-mention-1",
      chat_id: "oc-group",
      chat_type: "group",
      message_type: "text",
      content: overrides?.content ?? JSON.stringify({ text: "@_user_1 请看一下这个问题" }),
      mentions: overrides?.mentions,
    },
  };
}

describe("maybeNotifyOwnerMention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends DM notification when owner is @mentioned in group (bot not mentioned)", async () => {
    const cfg: ClawdbotConfig = {
      channels: {
        feishu: {
          ownerOpenId: "ou-owner",
          requireMention: true,
        },
      },
    } as ClawdbotConfig;

    const event = makeGroupEvent({
      mentions: [{ key: "@_user_1", id: { open_id: "ou-owner" }, name: "Owner", tenant_key: "t1" }],
    });

    await maybeNotifyOwnerMention({ cfg, event, log: vi.fn() });

    expect(mockSendMessageFeishu).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user:ou-owner",
        text: expect.stringContaining("[群聊提醒]"),
      }),
    );
  });

  it("does NOT send notification when owner is NOT mentioned", async () => {
    const cfg: ClawdbotConfig = {
      channels: {
        feishu: {
          ownerOpenId: "ou-owner",
          requireMention: true,
        },
      },
    } as ClawdbotConfig;

    const event = makeGroupEvent({
      mentions: [
        { key: "@_user_1", id: { open_id: "ou-someone-else" }, name: "Other", tenant_key: "t1" },
      ],
    });

    await maybeNotifyOwnerMention({ cfg, event, log: vi.fn() });

    expect(mockSendMessageFeishu).not.toHaveBeenCalled();
  });

  it("does NOT send notification when ownerOpenId is not configured", async () => {
    const cfg: ClawdbotConfig = {
      channels: {
        feishu: {
          requireMention: true,
        },
      },
    } as ClawdbotConfig;

    const event = makeGroupEvent({
      mentions: [
        { key: "@_user_1", id: { open_id: "ou-someone" }, name: "Someone", tenant_key: "t1" },
      ],
    });

    await maybeNotifyOwnerMention({ cfg, event, log: vi.fn() });

    expect(mockSendMessageFeishu).not.toHaveBeenCalled();
  });

  it("does NOT send notification for DM messages", async () => {
    const cfg: ClawdbotConfig = {
      channels: {
        feishu: {
          ownerOpenId: "ou-owner",
          requireMention: true,
        },
      },
    } as ClawdbotConfig;

    const event: FeishuMessageEvent = {
      sender: { sender_id: { open_id: "ou-colleague" } },
      message: {
        message_id: "msg-dm",
        chat_id: "oc-dm",
        chat_type: "p2p",
        message_type: "text",
        content: JSON.stringify({ text: "hello" }),
        mentions: [
          { key: "@_user_1", id: { open_id: "ou-owner" }, name: "Owner", tenant_key: "t1" },
        ],
      },
    };

    await maybeNotifyOwnerMention({ cfg, event, log: vi.fn() });

    expect(mockSendMessageFeishu).not.toHaveBeenCalled();
  });

  it("does NOT send notification when bot is mentioned (message handled normally)", async () => {
    const cfg: ClawdbotConfig = {
      channels: {
        feishu: {
          ownerOpenId: "ou-owner",
          requireMention: true,
        },
      },
    } as ClawdbotConfig;

    const event = makeGroupEvent({
      mentions: [
        { key: "@_user_1", id: { open_id: "ou-owner" }, name: "Owner", tenant_key: "t1" },
        { key: "@_user_2", id: { open_id: "ou-bot" }, name: "Bot", tenant_key: "t1" },
      ],
    });

    await maybeNotifyOwnerMention({ cfg, event, botOpenId: "ou-bot", log: vi.fn() });

    expect(mockSendMessageFeishu).not.toHaveBeenCalled();
  });
});
