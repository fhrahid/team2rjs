// Runtime settings, adjustable live from the dashboard (POST /api/settings).
export const settings = {
  aiEnabled: true,          // master switch for the AI auto-off
  autoOffDelaySeconds: 60,  // how long a room stays empty before AI switches devices off
};

export function updateSettings(patch = {}) {
  if (typeof patch.aiEnabled === 'boolean') settings.aiEnabled = patch.aiEnabled;
  if (patch.autoOffDelaySeconds !== undefined) {
    const v = Number(patch.autoOffDelaySeconds);
    if (!Number.isFinite(v) || v < 5 || v > 3600) {
      throw new Error('autoOffDelaySeconds must be between 5 and 3600');
    }
    settings.autoOffDelaySeconds = Math.round(v);
  }
  return settings;
}
