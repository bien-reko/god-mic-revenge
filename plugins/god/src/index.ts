import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { before } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";
import { Forms, General } from "@vendetta/ui/components";

const { FormSection, FormRow, FormSwitch, FormSlider } = Forms;
const { ScrollView, Text, View } = General;

// Voice Stores & Dispatcher
const FluxDispatcher = findByProps("dispatch", "subscribe");
const MediaEngineStore = findByProps("getEchoCancellation", "getMediaEngine");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

// Default God Mic Settings (+5dB Clear Opus Gain)
storage.gainDb ??= 5.0;
storage.stereoBypass ??= true;
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];

// Settings UI Screen
function SettingsScreen() {
  useProxy(storage);

  return React.createElement(
    ScrollView,
    { style: { flex: 1, backgroundColor: "#0b0e14", padding: 16 } },
    React.createElement(
      View,
      { style: { marginBottom: 16, alignItems: "center" } },
      React.createElement(
        Text,
        { style: { color: "#E0A96D", fontSize: 20, fontWeight: "bold" } },
        "⚡ GOD-MIC OPUS ENGINE ⚡"
      )
    ),
    React.createElement(
      FormSection,
      { title: "DIVINE OPUS GAIN MATRIX" },
      React.createElement(FormRow, {
        label: `Opus Boost: +${storage.gainDb.toFixed(1)} dB`,
        subLabel: "Crystal clean pre-encoder signal amplification",
      }),
      React.createElement(FormSlider, {
        value: storage.gainDb,
        min: 0.0,
        max: 30.0,
        step: 0.5,
        onValueChange: (val: number) => {
          storage.gainDb = parseFloat(val.toFixed(1));
        },
      })
    ),
    React.createElement(
      FormSection,
      { title: "STEREO MASTER PROFILE" },
      React.createElement(FormSwitch, {
        label: "Stereo God-Mic Bypass",
        subLabel: "Bypass mono downmix & disable phase canceling",
        value: storage.stereoBypass,
        onValueChange: (val: boolean) => {
          storage.stereoBypass = val;
        },
      }),
      React.createElement(FormSwitch, {
        label: "Live Connect Toast",
        subLabel: "Instant heads-up notification when joining VC",
        value: storage.liveToast,
        onValueChange: (val: boolean) => {
          storage.liveToast = val;
        },
      })
    )
  );
}

export default {
  onLoad: () => {
    try {
      const MediaEngine =
        MediaEngineStore?.getMediaEngine?.() ??
        findByProps("setBitrate", "applyMediaFilterSettings");

      if (MediaEngine) {
        // Gain formula: 10^(dB / 20)
        unpatches.push(
          before("setLocalVolume", MediaEngine, (args) => {
            const linearGain = Math.pow(10, storage.gainDb / 20);
            if (args[1] !== undefined) {
              args[1] = args[1] * linearGain;
            }
          })
        );

        unpatches.push(
          before("applyMediaFilterSettings", MediaEngine, (args) => {
            if (storage.stereoBypass && args[0]) {
              args[0].echoCancellation = false;
              args[0].noiseSuppression = false;
              args[0].automaticGainControl = false;
              args[0].stereo = 2; // Studio Stereo Mode
            }
          })
        );
      }
    } catch (err) {
      console.error("[GOD_MIC_INIT_ERR]", err);
    }

    // VC Presence Listener
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE" && event.state === "RTC_CONNECTED") {
        if (!storage.liveToast) return;
        const channelId = SelectedChannelStore.getVoiceChannelId();
        const channel = channelId ? ChannelStore.getChannel(channelId) : null;
        showToast(
          `⚡ [GOD MIC ACTIVE] #${channel?.name ?? "Voice"} (+${storage.gainDb.toFixed(1)}dB Stereo)`,
          0
        );
      }
    };

    FluxDispatcher.subscribe("RTC_CONNECTION_STATE", onVoiceUpdate);
    unpatches.push(() => FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", onVoiceUpdate));
  },

  onUnload: () => {
    unpatches.forEach((u) => u());
    unpatches = [];
  },

  settings: SettingsScreen,
};
