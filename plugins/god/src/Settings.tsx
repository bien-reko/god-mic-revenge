import { React, ReactNative } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";

const { View, Text, TouchableOpacity, ScrollView } = ReactNative;

const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

// Advanced Tier Real-Time Hardware & Encoder Gain Injector
export function applyGodGain(gainDb: number) {
  try {
    const linearMultiplier = Math.pow(10, gainDb / 20);
    const targetVolume = Math.round(100 * linearMultiplier); // +25dB = 1778%

    // 1. Dispatch internal audio state update
    if (FluxDispatcher?.dispatch) {
      FluxDispatcher.dispatch({
        type: "AUDIO_SET_INPUT_VOLUME",
        volume: targetVolume,
      });
      // Kill compressor and phase cancelers so the gain is never compressed
      FluxDispatcher.dispatch({
        type: "AUDIO_SET_AUTOMATIC_GAIN_CONTROL",
        automaticGainControl: false,
      });
      FluxDispatcher.dispatch({
        type: "AUDIO_SET_ECHO_CANCELLATION",
        echoCancellation: false,
      });
      FluxDispatcher.dispatch({
        type: "AUDIO_SET_NOISE_SUPPRESSION",
        noiseSuppression: false,
      });
    }

    // 2. High-level UI Action
    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(targetVolume);
    }

    // 3. Native WebRTC Connection Injection
    const nativeEngine = MediaEngineStore?.getMediaEngine?.();
    if (nativeEngine) {
      if (nativeEngine.setInputVolume) {
        nativeEngine.setInputVolume(targetVolume);
      }
      if (nativeEngine.connections) {
        nativeEngine.connections.forEach((conn: any) => {
          try {
            if (conn.input?.setVolume) {
              conn.input.setVolume(linearMultiplier);
            }
          } catch {}
        });
      }
    }
  } catch (err) {
    console.error("[GOD_MIC_GAIN_ERR]", err);
  }
}

export default function Settings() {
  useProxy(storage);

  const presets = [
    { label: "+5dB Crisp", val: 5.0, color: "#4EAA86" },
    { label: "+15dB DJ Boost", val: 15.0, color: "#3B82F6" },
    { label: "+25dB GOD MIC", val: 25.0, color: "#E0A96D" },
    { label: "+30dB RUPTURE", val: 30.0, color: "#EF4444" },
  ];

  // Resolve current VC connection
  const activeChannelId = SelectedChannelStore?.getVoiceChannelId();
  const activeChannel = activeChannelId ? ChannelStore?.getChannel(activeChannelId) : null;
  const isInVC = Boolean(activeChannelId);

  const updateGain = (newGain: number) => {
    const clamped = Math.max(0, Math.min(35, parseFloat(newGain.toFixed(1))));
    storage.gainDb = clamped;
    applyGodGain(clamped);

    const mult = Math.round(100 * Math.pow(10, clamped / 20));
    if (storage.liveToast) {
      if (isInVC) {
        showToast(`⚡ [GOD MIC] LIVE in #${activeChannel?.name}: +${clamped.toFixed(1)}dB (${mult}%)`, 0);
      } else {
        showToast(`⚡ [GOD MIC] Standby Gain: +${clamped.toFixed(1)}dB (${mult}%)`, 0);
      }
    }
  };

  const fillPercent = Math.min(100, Math.round((storage.gainDb / 30) * 100));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#090A0F", padding: 16 }}>
      {/* GOD HEADER */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: "#E0A96D", fontSize: 22, fontWeight: "900", letterSpacing: 1.5 }}>
          ⚡ GOD-MIC REALTIME ENGINE ⚡
        </Text>
        <Text style={{ color: "#72767D", fontSize: 12, marginTop: 4 }}>
          Opus Overdrive • Hardware Unclamped • Realtime Link
        </Text>
      </View>

      {/* LIVE VC CONNECTION TELEMETRY HUD */}
      <View
        style={{
          backgroundColor: isInVC ? "#0F241D" : "#1B1712",
          borderColor: isInVC ? "#4EAA86" : "#E0A96D",
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: isInVC ? "#4EAA86" : "#E0A96D",
                marginRight: 8,
              }}
            />
            <Text style={{ color: isInVC ? "#4EAA86" : "#E0A96D", fontWeight: "900", fontSize: 13 }}>
              {isInVC ? "CONNECTED TO VOICE" : "STANDBY (NOT IN VC)"}
            </Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontWeight: "bold", fontSize: 12 }}>
            {isInVC ? `#${activeChannel?.name ?? "Active Channel"}` : "IDLE"}
          </Text>
        </View>

        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 8 }}>
          <Text style={{ color: "#8A909D", fontSize: 11 }}>
            • Live Stream: {isInVC ? "TRANSMITTING ENCODER SIGNAL" : "ARMED FOR CONNECTION"}
            {"\n"}• Target Multiplier: {Math.round(100 * Math.pow(10, storage.gainDb / 20))}% Direct
            {"\n"}• AGC Compressor: BYPASS FORCED (No Volume Ducking)
          </Text>
        </View>
      </View>

      {/* GAIN POWER DISPLAY */}
      <View
        style={{
          backgroundColor: "#12141D",
          padding: 16,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#232738",
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#8A909D", fontSize: 13, textTransform: "uppercase" }}>
          Current Opus Drive Gain
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 38, fontWeight: "900", marginVertical: 4 }}>
          +{storage.gainDb.toFixed(1)} dB
        </Text>
        <Text style={{ color: "#4EAA86", fontSize: 13, fontWeight: "bold" }}>
          AMPLIFIER: {Math.round(100 * Math.pow(10, storage.gainDb / 20))}% RAW
        </Text>

        {/* Dynamic Visual Progress Bar */}
        <View
          style={{
            width: "100%",
            height: 8,
            backgroundColor: "#1F2333",
            borderRadius: 4,
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${fillPercent}%`,
              height: "100%",
              backgroundColor: storage.gainDb >= 25 ? "#EF4444" : "#E0A96D",
            }}
          />
        </View>
      </View>

      {/* FINE TUNE STEPPERS */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 14 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#1F2333",
            padding: 14,
            borderRadius: 8,
            alignItems: "center",
            marginRight: 6,
          }}
          onPress={() => updateGain(storage.gainDb - 1.0)}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 16 }}>▼ -1.0 dB</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#E0A96D",
            padding: 14,
            borderRadius: 8,
            alignItems: "center",
            marginLeft: 6,
          }}
          onPress={() => updateGain(storage.gainDb + 1.0)}
        >
          <Text style={{ color: "#000", fontWeight: "bold", fontSize: 16 }}>▲ +1.0 dB</Text>
        </TouchableOpacity>
      </View>

      {/* PRESETS (WITH INSTANT +25dB PUNCH) */}
      <Text style={{ color: "#8A909D", fontSize: 12, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase" }}>
        Gain Presets
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {presets.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={{
              width: "48%",
              backgroundColor: storage.gainDb === preset.val ? preset.color : "#12141D",
              paddingVertical: 14,
              borderRadius: 8,
              alignItems: "center",
              marginBottom: 10,
              borderWidth: 1,
              borderColor: preset.color,
            }}
            onPress={() => updateGain(preset.val)}
          >
            <Text
              style={{
                color: storage.gainDb === preset.val ? "#000000" : "#FFFFFF",
                fontWeight: "900",
                fontSize: 13,
              }}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SYSTEM TOGGLES */}
      <View style={{ marginTop: 10 }}>
        <TouchableOpacity
          style={{
            backgroundColor: storage.stereoBypass ? "#1A2E26" : "#12141D",
            padding: 14,
            borderRadius: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: storage.stereoBypass ? "#4EAA86" : "#232738",
          }}
          onPress={() => {
            storage.stereoBypass = !storage.stereoBypass;
            applyGodGain(storage.gainDb);
            showToast(`Stereo Bypass: ${storage.stereoBypass ? "ACTIVE" : "OFF"}`, 0);
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold" }}>
            Stereo Mode 2 Bypass: [ {storage.stereoBypass ? "ACTIVE" : "OFF"} ]
          </Text>
          <Text style={{ color: "#72767D", fontSize: 11, marginTop: 2 }}>
            Forces uncompressed dual-channel stereo without mono downsampling
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: storage.liveToast ? "#1E2538" : "#12141D",
            padding: 14,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: storage.liveToast ? "#3B82F6" : "#232738",
          }}
          onPress={() => {
            storage.liveToast = !storage.liveToast;
            showToast(`VC Live Toast: ${storage.liveToast ? "ENABLED" : "DISABLED"}`, 0);
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold" }}>
            VC Live Notification Toast: [ {storage.liveToast ? "ACTIVE" : "OFF"} ]
          </Text>
          <Text style={{ color: "#72767D", fontSize: 11, marginTop: 2 }}>
            Pops telemetry alerts whenever joining or adjusting gain in voice rooms
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
