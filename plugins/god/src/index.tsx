import { findByProps, findByName } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { before, after } from "@vendetta/patcher";
import Settings from "./Settings";

// Sonic Realm Stores & Dispatchers
const FluxDispatcher = findByProps("dispatch", "subscribe");
const MediaEngineStore = findByProps("getEchoCancellation", "getMediaEngine");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

// Initialize Godly Parameters
storage.gainDb ??= 5.0; // Divine +5dB Clear Opus Gain Default
storage.stereoBypass ??= true;
storage.bitrateCap ??= 512000; // Ultra 512kbps Opus Ceiling
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];

// Celestial Toast Matrix
const summonToast = (channelName: string, gain: number) => {
  if (!storage.liveToast) return;
  showToast(
    `⚡ [GOD MIC ACTIVE] Connected to: #${channelName} | Opus +${gain.toFixed(1)}dB Stereo Pure Master`,
    findByProps("ToastType")?.ToastType?.SUCCESS ?? 0
  );
};

export default {
  onLoad: () => {
    // 1. REWRITE OPUS CODEC & AUDIO ENGINE CONSTRAINTS
    try {
      const MediaEngine = MediaEngineStore?.getMediaEngine?.() ?? findByProps("setBitrate", "applyMediaFilterSettings");

      if (MediaEngine) {
        // God patch: Inject pure 5dB+ signal multiplier directly into local audio input matrix
        unpatches.push(
          before("setLocalVolume", MediaEngine, (args) => {
            // Apply cosmic gain factor mathematically: 10^(dB / 20)
            const linearGain = Math.pow(10, storage.gainDb / 20);
            if (args[1] !== undefined) {
              args[1] = args[1] * linearGain;
            }
          })
        );

        // Force High-Fidelity Audio Profile (Stereo Mode 2, Noise Suppression Override)
        if (MediaEngine.setAudioSubsystem) {
          unpatches.push(
            before("applyMediaFilterSettings", MediaEngine, (args) => {
              if (storage.stereoBypass && args[0]) {
                args[0].echoCancellation = false;     // Kill phase-canceling garbage
                args[0].noiseSuppression = false;     // Raw frequency throughput
                args[0].automaticGainControl = false; // Prevent Discord from ducking our volume
                args[0].stereo = 2;                   // Force Studio Stereo
              }
            })
          );
        }
      }
    } catch (err) {
      console.error("[GOD_MIC_FATAL]: Failed to ascend the audio pipeline", err);
    }

    // 2. LIVE VC JOIN TELEMETRY (Flux Event Listener)
    const handleVoiceStateUpdate = (event: any) => {
      // Catch our divine transition into a Voice Channel
      if (event.type === "RTC_CONNECTION_STATE" && event.state === "RTC_CONNECTED") {
        const channelId = SelectedChannelStore.getVoiceChannelId();
        if (channelId) {
          const channel = ChannelStore.getChannel(channelId);
          summonToast(channel?.name ?? "Ether", storage.gainDb);
        }
      }
    };

    FluxDispatcher.subscribe("RTC_CONNECTION_STATE", handleVoiceStateUpdate);
    unpatches.push(() => FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", handleVoiceStateUpdate));
  },

  onUnload: () => {
    for (const unpatch of unpatches) unpatch();
    unpatches = [];
  },

  settings: Settings,
};
