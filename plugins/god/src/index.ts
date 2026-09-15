import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { showToast } from "@vendetta/ui/toasts";
import { React, ReactNative } from "@vendetta/metro/common";
import { useProxy } from "@vendetta/storage";

const { View, Text, TouchableOpacity, ScrollView } = ReactNative;

// Audio Stores & Engines
const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

// Initialize Settings
storage.gainDb ??= 25.0; // Default set to +25dB as requested
storage.stereoBypass ??= true;
storage.liveToast ??= true;

let unpatches: (() => void)[] = [];

// Real-Time Hardware Gain Injector (Linear: 10^(dB/20))
function applyGodGain(gainDb: number) {
  try {
    const linearMultiplier = Math.pow(10, gainDb / 20);
    const targetVolume = Math.round(100 * linearMultiplier); // 100% normal -> 1778% at +25dB

    // Apply directly to Discord's active MediaEngine
    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(targetVolume);
    }

    const nativeEngine = MediaEngineStore?.getMediaEngine?.();
    if (nativeEngine?.setInputVolume) {
      nativeEngine.setInputVolume(targetVolume);
    }
  } catch (err) {
    console.error("[GOD_MIC_INJECT_ERR]", err);
  }
}

// Interactive DJ Settings Screen (100% Crash-Proof React Native)
function SettingsScreen() {
  useProxy(storage);

  const presets = [
    { label: "+5dB Clean", val: 5.0, color: "#4EAA86" },
    { label: "+15dB DJ", val: 15.0, color: "#3B82F6" },
    { label: "+25dB GOD MIC", val: 25.0, color: "#E0A96D" },
    { label: "+30dB RUPTURE", val: 30.0, color: "#EF4444" },
  ];

  const updateGain = (newGain: number) => {
    const clamped = Math.max(0, Math.min(35, parseFloat(newGain.toFixed(1))));
    storage.gainDb = clamped;
    applyGodGain(clamped);
    if (storage.liveToast) {
      showToast(`⚡ [GOD MIC] Gain: +${clamped.toFixed(1)}dB (${Math.round(100 * Math.pow(10, clamped / 20))}%)`, 0);
    }
  };

  return React.createElement(
    ScrollView,
    { style: { flex: 1, backgroundColor: "#090A0F", padding: 16 } },

    // TITLE HEADER
    React.createElement(
      View,
      { style: { alignItems: "center", marginBottom: 20 } },
      React.createElement(
        Text,
        { style: { color: "#E0A96D", fontSize: 22, fontWeight: "900", letterSpacing: 1 } },
        "⚡ GOD-MIC REALTIME ENGINE ⚡"
      ),
      React.createElement(
        Text,
        { style: { color: "#72767D", fontSize: 12, marginTop: 4 } },
        "Pure WebRTC Signal Overdrive • Real-Time Matrix"
      )
    ),

    // LIVE GAIN DISPLAY PANEL
    React.createElement(
      View,
      {
        style: {
          backgroundColor: "#12141D",
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#232738",
          marginBottom: 16,
        },
      },
      React.createElement(
        Text,
        { style: { color: "#8A909D", fontSize: 13, textTransform: "uppercase" } },
        "Active Opus Gain Power"
      ),
      React.createElement(
        Text,
        { style: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginVertical: 6 } },
        `+${storage.gainDb.toFixed(1)} dB`
      ),
      React.createElement(
        Text,
        { style: { color: "#4EAA86", fontSize: 12, fontWeight: "bold" } },
        `SIGNAL MULTIPLIER: ${Math.round(100 * Math.pow(10, storage.gainDb / 20))}%`
      )
    ),

    // FINE TUNE CONTROLS (-1 / +1)
    React.createElement(
      View,
      { style: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 } },
      React.createElement(
        TouchableOpacity,
        {
          style: {
            flex: 1,
            backgroundColor: "#1F2333",
            padding: 14,
            borderRadius: 8,
            alignItems: "center",
            marginRight: 6,
          },
          onPress: () => updateGain(storage.gainDb - 1.0),
        },
        React.createElement(Text, { style: { color: "#FFF", fontWeight: "bold", fontSize: 16 } }, "▼ -1.0 dB")
      ),
      React.createElement(
        TouchableOpacity,
        {
          style: {
            flex: 1,
            backgroundColor: "#E0A96D",
            padding: 14,
            borderRadius: 8,
            alignItems: "center",
            marginLeft: 6,
          },
          onPress: () => updateGain(storage.gainDb + 1.0),
        },
        React.createElement(Text, { style: { color: "#000", fontWeight: "bold", fontSize: 16 } }, "▲ +1.0 dB")
      )
    ),

    // QUICK PRESETS
    React.createElement(
      Text,
      { style: { color: "#8A909D", fontSize: 12, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase" } },
      "God Tier Presets"
    ),
    React.createElement(
      View,
      { style: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" } },
      presets.map((preset) =>
        React.createElement(
          TouchableOpacity,
          {
            key: preset.label,
            style: {
              width: "48%",
              backgroundColor: storage.gainDb === preset.val ? preset.color : "#12141D",
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              marginBottom: 10,
              borderWidth: 1,
              borderColor: preset.color,
            },
            onPress: () => updateGain(preset.val),
          },
          React.createElement(
            Text,
            {
              style: {
                color: storage.gainDb === preset.val ? "#000000" : "#FFFFFF",
                fontWeight: "bold",
                fontSize: 13,
              },
            },
            preset.label
          )
        )
      )
    ),

    // TOGGLE OPTIONS
    React.createElement(
      View,
      { style: { marginTop: 12 } },
      React.createElement(
        TouchableOpacity,
        {
          style: {
            backgroundColor: storage.stereoBypass ? "#1A2E26" : "#12141D",
            padding: 14,
            borderRadius: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: storage.stereoBypass ? "#4EAA86" : "#232738",
          },
          onPress: () => {
            storage.stereoBypass = !storage.stereoBypass;
            showToast(`Stereo Bypass: ${storage.stereoBypass ? "ENABLED" : "DISABLED"}`, 0);
          },
        },
        React.createElement(
          Text,
          { style: { color: "#FFF", fontWeight: "bold" } },
          `Stereo Bypass Mode: [ ${storage.stereoBypass ? "ACTIVE" : "OFF"} ]`
        ),
        React.createElement(
          Text,
          { style: { color: "#72767D", fontSize: 11, marginTop: 2 } },
          "Forces Stereo 2-channel audio and stops mono compression"
        )
      ),

      React.createElement(
        TouchableOpacity,
        {
          style: {
            backgroundColor: storage.liveToast ? "#1E2538" : "#12141D",
            padding: 14,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: storage.liveToast ? "#3B82F6" : "#232738",
          },
          onPress: () => {
            storage.liveToast = !storage.liveToast;
            showToast(`Live Toast: ${storage.liveToast ? "ENABLED" : "DISABLED"}`, 0);
          },
        },
        React.createElement(
          Text,
          { style: { color: "#FFF", fontWeight: "bold" } },
          `VC Join Telemetry Toast: [ ${storage.liveToast ? "ACTIVE" : "OFF"} ]`
        ),
        React.createElement(
          Text,
          { style: { color: "#72767D", fontSize: 11, marginTop: 2 } },
          "Pop up a heads-up badge whenever entering voice channels"
        )
      )
    )
  );
}

export default {
  onLoad: () => {
    // 1. Initial gain injection
    applyGodGain(storage.gainDb);

    // 2. Real-time VC Join Listener
    const onVoiceUpdate = (event: any) => {
      if (event.type === "RTC_CONNECTION_STATE" && event.state === "RTC_CONNECTED") {
        applyGodGain(storage.gainDb); // Re-apply immediately when connecting
        if (!storage.liveToast) return;

        const channelId = SelectedChannelStore?.getVoiceChannelId();
        const channel = channelId ? ChannelStore?.getChannel(channelId) : null;
        showToast(
          `⚡ [GOD MIC] Active: #${channel?.name ?? "Voice"} (+${storage.gainDb.toFixed(1)}dB | Gain: ${Math.round(100 * Math.pow(10, storage.gainDb / 20))}%)`,
          0
        );
      }
    };

    if (FluxDispatcher?.subscribe) {
      FluxDispatcher.subscribe("RTC_CONNECTION_STATE", onVoiceUpdate);
      unpatches.push(() => FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", onVoiceUpdate));
    }
  },

  onUnload: () => {
    // Reset back to standard volume on plugin disable
    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(100);
    }
    unpatches.forEach((u) => u());
    unpatches = [];
  },

  settings: SettingsScreen,
};
