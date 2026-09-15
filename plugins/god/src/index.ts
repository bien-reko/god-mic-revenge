import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import Settings, { applyGodGain } from "./Settings";

const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

storage.gainDb ??= 25.0; // Default +25dB God Mode
storage.stereoBypass ??= true;
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];

export default {
  onLoad: () => {
    // 1. Instantly inject +25dB on plugin load
    applyGodGain(storage.gainDb);

    // 2. Real-time VC Presence Listener: Re-injects gain and triggers toast
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE" && event.state === "RTC_CONNECTED") {
        applyGodGain(storage.gainDb); // Re-apply immediately when entering voice room

        if (storage.liveToast) {
          const channelId = SelectedChannelStore?.getVoiceChannelId();
          const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
          showToast(
            `⚡ [GOD MIC ACTIVE] #${channel?.name ?? "Voice"} | +${storage.gainDb.toFixed(1)}dB (${Math.round(100 * Math.pow(10, storage.gainDb / 20))}%)`,
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
      MediaEngineActions.setInputVolume(100); // Restore normal volume
    }
    unpatches.forEach((u) => u());
    unpatches = [];
  },

  settings: Settings,
};
