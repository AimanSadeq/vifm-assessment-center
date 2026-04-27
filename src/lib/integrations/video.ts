/**
 * Video Integration Module
 *
 * Placeholder for Daily.co SDK integration for virtual assessment center sessions.
 * To enable:
 * 1. npm install @daily-co/daily-js
 * 2. Set DAILY_API_KEY in .env.local
 * 3. Implement room creation and embed components
 */

export type VideoRoom = {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  expiresAt: string;
};

export type VideoConfig = {
  apiKey: string;
  baseUrl: string;
};

function getConfig(): VideoConfig | null {
  const apiKey = process.env.DAILY_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: "https://api.daily.co/v1",
  };
}

export async function createVideoRoom(
  engagementId: string,
  exerciseName: string
): Promise<VideoRoom | null> {
  const config = getConfig();
  if (!config) {
    console.warn("Video integration not configured. Set DAILY_API_KEY.");
    return null;
  }

  // TODO: Implement Daily.co API call
  // POST /rooms with { name, properties: { exp, enable_recording } }
  return {
    id: `room_${engagementId}_${Date.now()}`,
    name: `VIFM AC - ${exerciseName}`,
    url: `https://vifm.daily.co/room_placeholder`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function isVideoConfigured(): boolean {
  return !!process.env.DAILY_API_KEY;
}
