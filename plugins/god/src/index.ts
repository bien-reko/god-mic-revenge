import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { instead } from "@vendetta/patcher";
import Settings, { applyGodGain, appendLog } from "./Settings";

const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

storage.gainDb ??= 80.0;
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];
let watchdogTimer: any = null;

export default {
  onLoad: () => {
    appendLog("KERNEL", "God-Mic Astral Engine initialized.", "#D0BCFF");

    // 1. Initial gain injection
    applyGodGain(storage.gainDb);

    // 2. Patch MediaEngine Store to completely prevent Discord from capping volume
    try {
      if (MediaEngineStore) {
        unpatches.push(
          instead("getInputVolume", MediaEngineStore, () => {
            return Math.round(100 * Math.pow(10, storage.gainDb / 20));
          })
        );
        unpatches.push(instead("getAutomaticGainControl", MediaEngineStore, () => false));
        unpatches.push(instead("getEchoCancellation", MediaEngineStore, () => false));
        unpatches.push(instead("getNoiseSuppression", MediaEngineStore, () => false));
        unpatches.push(instead("getNoiseCancellation", MediaEngineStore, () => false));
        appendLog("PATCH", "MediaEngineStore clamped getters successfully hooked.", "#C4EDD9");
      }
    } catch (err: any) {
      appendLog("ERROR", `Failed to patch MediaEngineStore: ${err?.message}`, "#F2B8B5");
    }

    // 3. Real-time VC Presence & Watchdog Engine
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE") {
        if (event.state === "RTC_CONNECTED") {
          applyGodGain(storage.gainDb);
          const channelId = SelectedChannelStore?.getVoiceChannelId();
          const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
          const mult = Math.round(Math.pow(10, storage.gainDb / 20));

          appendLog("WEBRTC", `RTC Connected to #${channel?.name ?? "Voice"} • Enforcing +${storage.gainDb}dB`, "#6DD58C");

          if (storage.liveToast) {
            showToast(`⚡ [GOD MIC ACTIVE] Linked: #${channel?.name ?? "Voice"} | +${storage.gainDb.toFixed(1)}dB (${mult}x RAW)`, 0);
          }

          // Start active 1.5s Anti-Reset Watchdog
          if (!watchdogTimer) {
            watchdogTimer = setInterval(() => {
              const inVC = Boolean(SelectedChannelStore?.getVoiceChannelId());
              if (inVC) {
                applyGodGain(storage.gainDb, true);
              } else {
                clearInterval(watchdogTimer);
                watchdogTimer = null;
              }
            }, 1500);
          }
        } else if (event.state === "RTC_DISCONNECTED") {
          appendLog("WEBRTC", "Voice connection closed.", "#CAC4D0");
          if (watchdogTimer) {
            clearInterval(watchdogTimer);
            watchdogTimer = null;
          }
        }
      }
    };

    if (FluxDispatcher?.subscribe) {
      FluxDispatcher.subscribe("RTC_CONNECTION_STATE", onVoiceUpdate);
      unpatches.push(() => FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", onVoiceUpdate));
    }
  },

  onUnload: () => {
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(100);
    }
    unpatches.forEach((u) => u());
    unpatches = [];
    appendLog("SYS", "Plugin unloaded. Hardware volume restored.", "#F2B8B5");
  },

  settings: Settings,
};
