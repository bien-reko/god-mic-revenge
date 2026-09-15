import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import Settings, { applyGodGain, appendLog } from "./Settings";

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
    appendLog("KERNEL", "God-Mic Core Activated.", "#D0BCFF");

    try {
      const engine = MediaEngineStore?.getMediaEngine?.();
      if (engine) {
        // MONKEYPATCH NATIVE setInputVolume: Intercept Discord's 100 clamp
        const origSetInputVolume = engine.setInputVolume?.bind(engine);
        if (origSetInputVolume) {
          engine.setInputVolume = function (vol: number) {
            const linearMultiplier = Math.pow(10, storage.gainDb / 20);
            const boosted = Math.round(100 * linearMultiplier);
            return origSetInputVolume(boosted);
          };
          unpatches.push(() => {
            engine.setInputVolume = origSetInputVolume;
          });
          appendLog("PATCH", "MediaEngine.setInputVolume clamp permanently hijacked.", "#6DD58C");
        }

        // Apply immediately
        applyGodGain(storage.gainDb);
      }
    } catch (err: any) {
      appendLog("ERROR", `Failed to hook MediaEngine: ${err?.message}`, "#F2B8B5");
    }

    // REAL-TIME VC PRESENCE & WATCHDOG
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE") {
        if (event.state === "RTC_CONNECTED") {
          applyGodGain(storage.gainDb);
          const channelId = SelectedChannelStore?.getVoiceChannelId();
          const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
          const mult = Math.round(Math.pow(10, storage.gainDb / 20));

          appendLog("WEBRTC", `Handshake linked on #${channel?.name ?? "Voice"}`, "#6DD58C");

          if (storage.liveToast) {
            showToast(`⚡ [GOD MIC ACTIVE] Linked: #${channel?.name ?? "Voice"} | +${storage.gainDb.toFixed(1)}dB (${mult}x RAW)`, 0);
          }

          // Active 1.0s Watchdog: Re-applies to connection streams continuously
          if (!watchdogTimer) {
            watchdogTimer = setInterval(() => {
              const inVC = Boolean(SelectedChannelStore?.getVoiceChannelId());
              if (inVC) {
                applyGodGain(storage.gainDb, true);
              } else {
                clearInterval(watchdogTimer);
                watchdogTimer = null;
              }
            }, 1000);
          }
        } else if (event.state === "RTC_DISCONNECTED") {
          appendLog("WEBRTC", "Voice connection released.", "#CAC4D0");
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
    const engine = MediaEngineStore?.getMediaEngine?.();
    if (engine?.setLoopback) {
      try { engine.setLoopback(false); } catch {}
    }
    unpatches.forEach((u) => u());
    unpatches = [];
    appendLog("SYS", "God-Mic unloaded. Engine reverted.", "#F2B8B5");
  },

  settings: Settings,
};
