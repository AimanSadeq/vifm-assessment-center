import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAIClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("AI features disabled. Set ANTHROPIC_API_KEY in .env.local.");
    return null;
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export function isAIConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export const AI_MODEL = "claude-sonnet-4-20250514";
