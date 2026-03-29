import type { WebClient } from "@slack/web-api";
import type { ChannelMap, RouteRule } from "./config.js";
import type { ActivityLog } from "./paperclip/types.js";

export class ChannelRouter {
  private channelMap: ChannelMap;
  private channelIdCache = new Map<string, string>();

  constructor(channelMap: ChannelMap) {
    this.channelMap = channelMap;
  }

  async resolveChannelIds(slack: WebClient): Promise<void> {
    const channelNames = new Set<string>();
    channelNames.add(this.channelMap.default);
    for (const route of this.channelMap.routes) {
      channelNames.add(route.channel);
    }

    const result = await slack.conversations.list({
      types: "public_channel,private_channel",
      limit: 1000,
    });

    for (const channel of result.channels ?? []) {
      const name = `#${channel.name}`;
      if (channel.id && channelNames.has(name)) {
        this.channelIdCache.set(name, channel.id);
      }
    }

    for (const name of channelNames) {
      if (!this.channelIdCache.has(name)) {
        console.warn(`Channel ${name} not found in workspace`);
      }
    }
  }

  route(event: ActivityLog): string | null {
    for (const rule of this.channelMap.routes) {
      if (this.matches(rule, event)) {
        return this.channelIdCache.get(rule.channel) ?? null;
      }
    }
    return this.channelIdCache.get(this.channelMap.default) ?? null;
  }

  private matches(rule: RouteRule, event: ActivityLog): boolean {
    for (const [key, value] of Object.entries(rule.match)) {
      const eventValue = this.getEventProperty(event, key);
      if (eventValue !== value) return false;
    }
    return true;
  }

  private getEventProperty(event: ActivityLog, key: string): string | undefined {
    if (key in event) {
      const val = event[key as keyof ActivityLog];
      return val != null ? String(val) : undefined;
    }
    if (event.details && key in event.details) {
      const val = event.details[key];
      return val != null ? String(val) : undefined;
    }
    return undefined;
  }
}
