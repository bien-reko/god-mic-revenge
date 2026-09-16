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
    appendLog("CORE", "God-Mic WebRTC Pipeline Activated.", "#D0BCFF");

    try {
      const engine = MediaEngineStore?.getMediaEngine?.();
      if (engine) {
        // Enforce experimental subsystem to decouple from Android OS AGC
        try {
          if (engine.setAudioSubsystem) engine.setAudioSubsystem("experimental");
        } catch {}

        // Hijack engine.setInputVolume to permanently override the 100 clamp
        const origSetInputVolume = engine.setInputVolume?.bind(engine);
        if (origSetInputVolume) {
          engine.setInputVolume = function (vol: number) {
            const linearMultiplier = Math.pow(10, storage.gainDb / 20);
            const boosted = Math.round(100 * linearMultiplier);
            return origSetInputVolume(boosted);
          };
          unpatches.push(() => { engine.setInputVolume = origSetInputVolume; });
        }

        applyGodGain(storage.gainDb);
      }
    } catch (err: any) {
      appendLog("ERROR", `Init error: ${err?.message}`, "#F2B8B5");
    }

    // REAL-TIME VC HANDSHAKE & WATCHDOG
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE") {
        if (event.state === "RTC_CONNECTED") {
          applyGodGain(storage.gainDb);
          const channelId = SelectedChannelStore?.getVoiceChannelId();
          const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
          const mult = Math.round(Math.pow(10, storage.gainDb / 20));

          appendLog("HANDSHAKE", `Connected to #${channel?.name ?? "Voice"} • Pinned +${storage.gainDb}dB`, "#6DD58C");

          if (storage.liveToast) {
            showToast(`⚡ [GOD MIC ACTIVE] #${channel?.name ?? "VC"} | +${storage.gainDb.toFixed(1)}dB (${mult}x RAW)`, 0);
          }

          // Active 800ms Watchdog: Continuously forces gain into active WebRTC connection streams
          if (!watchdogTimer) {
            watchdogTimer = setInterval(() => {
              const inVC = Boolean(SelectedChannelStore?.getVoiceChannelId());
              if (inVC) {
                applyGodGain(storage.gainDb, true);
              } else {
                clearInterval(watchdogTimer);
                watchdogTimer = null;
              }
            }, 800);
          }
        } else if (event.state === "RTC_DISCONNECTED") {
          appendLog("HANDSHAKE", "Voice connection released.", "#CAC4D0");
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
      try {
        engine.setLoopback(false, {
          echoCancellation: false,
          noiseSuppression: false,
          automaticGainControl: false,
          noiseCancellation: false,
        });
      } catch {}
    }
    unpatches.forEach((u) => u());
    unpatches = [];
    appendLog("CORE", "God-Mic unmounted. Normal volume restored.", "#F2B8B5");
  },

  settings: Settings,
};
