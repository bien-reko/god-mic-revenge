import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { after } from "@vendetta/patcher";
import Settings, { applyGodGain } from "./Settings";

const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

storage.gainDb ??= 25.0; // Default +25dB God mic gain
storage.stereoBypass ??= true;
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];

export default {
  onLoad: () => {
    // 1. Initial gain injection
    applyGodGain(storage.gainDb);

    // 2. Patch MediaEngineStore so Discord's internal getters reflect the uncompressed boost
    try {
      if (MediaEngineStore) {
        unpatches.push(
          after("getInputVolume", MediaEngineStore, () => {
            return Math.round(100 * Math.pow(10, storage.gainDb / 20));
          })
        );
        // Force AGC and Echo Cancellation to return false so the client never suppresses audio
        unpatches.push(after("getAutomaticGainControl", MediaEngineStore, () => false));
        unpatches.push(after("getEchoCancellation", MediaEngineStore, () => false));
        unpatches.push(after("getNoiseSuppression", MediaEngineStore, () => false));
      }
    } catch (err) {
      console.error("[GOD_MIC_PATCH_ERR]", err);
    }

    // 3. Real-time Voice Channel presence listener
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE" && event.state === "RTC_CONNECTED") {
        // Enforce the +25dB amplification immediately upon handshake
        applyGodGain(storage.gainDb);

        if (storage.liveToast) {
          const channelId = SelectedChannelStore?.getVoiceChannelId();
          const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
          const mult = Math.round(100 * Math.pow(10, storage.gainDb / 20));

          showToast(
            `⚡ [GOD MIC ACTIVE] Linked: #${channel?.name ?? "Voice"} | +${storage.gainDb.toFixed(1)}dB (${mult}%)`,
            0
          );
        }
      }
    };

    if (FluxDispatcher?.subscribe) {
      FluxDispatcher.subscribe("RTC_CONNECTION_STATE", onVoiceUpdate);
      unpatches.push(() => FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", onVoiceUpdate));
    }
  },

  onUnload: () => {
    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(100);
    }
    unpatches.forEach((u) => u());
    unpatches = [];
  },

  settings: Settings,
};
