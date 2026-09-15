import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { before, after, instead } from "@vendetta/patcher";
import Settings, { CFG, mungeSDP, applyGodGain } from "./Settings";

const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

storage.gainDb ??= 80.0; // Sovereign +80dB default
storage.sdpMunge ??= true;
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];

export default {
  onLoad: () => {
    // 1. Initial 80dB Gain and Handshake Injection
    applyGodGain(storage.gainDb);

    // 2. Patch MediaEngine Store to completely prevent clamping
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
      }
    } catch (err) {
      console.error("[GOD_MIC_STORE_PATCH_ERR]", err);
    }

    // 3. WebRTC C-Level SDP Handshake Munging Hook
    try {
      // Patch global RTCPeerConnection if available
      const win = (globalThis as any).window ?? globalThis;
      if (win.RTCPeerConnection) {
        unpatches.push(
          before("setLocalDescription", win.RTCPeerConnection.prototype, (args) => {
            if (storage.sdpMunge && args[0]?.sdp) {
              args[0].sdp = mungeSDP(args[0].sdp);
            }
          })
        );
      }

      // Intercept media filter applications to strip Krisp and noise suppression
      const MediaEngine = MediaEngineStore?.getMediaEngine?.() ?? findByProps("applyMediaFilterSettings");
      if (MediaEngine?.applyMediaFilterSettings) {
        unpatches.push(
          before("applyMediaFilterSettings", MediaEngine, (args) => {
            if (args[0]) {
              args[0].echoCancellation = false;
              args[0].noiseSuppression = false;
              args[0].automaticGainControl = false;
              args[0].noiseCancellation = false;
              args[0].stereo = 2; // Studio Stereo Mode
            }
          })
        );
      }
    } catch (err) {
      console.error("[GOD_MIC_SDP_ERR]", err);
    }

    // 4. Real-time VC Presence & Telemetry Listener
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE" && event.state === "RTC_CONNECTED") {
        // Enforce the +80dB gain immediately upon connection handshake
        applyGodGain(storage.gainDb);

        if (storage.liveToast) {
          const channelId = SelectedChannelStore?.getVoiceChannelId();
          const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
          const mult = Math.round(Math.pow(10, storage.gainDb / 20));

          showToast(
            `⚡ [GOD MIC ACTIVE] Connected to #${channel?.name ?? "Voice"} | +${storage.gainDb.toFixed(1)}dB (${mult}x RAW OPUS)`,
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
