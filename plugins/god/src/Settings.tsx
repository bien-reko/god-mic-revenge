import { React, ReactNative } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";

const { View, Text, TouchableOpacity, ScrollView } = ReactNative;

const MediaEngineActions = findByProps("setInputVolume", "setOutputVolume");
const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");

// God Gain Mathematical Multiplier (10^(dB/20))
export function applyGodGain(gainDb: number) {
  try {
    const linearMultiplier = Math.pow(10, gainDb / 20);
    const targetVolume = Math.round(100 * linearMultiplier); // +25dB = 1778% volume

    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(targetVolume);
    }
    const nativeEngine = MediaEngineStore?.getMediaEngine?.();
    if (nativeEngine?.setInputVolume) {
      nativeEngine.setInputVolume(targetVolume);
    }
  } catch (err) {
    console.error("[GOD_MIC_ERR]", err);
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

  const updateGain = (newGain: number) => {
    const clamped = Math.max(0, Math.min(35, parseFloat(newGain.toFixed(1))));
    storage.gainDb = clamped;
    applyGodGain(clamped);
    if (storage.liveToast) {
      showToast(`⚡ [GOD MIC] Gain: +${clamped.toFixed(1)}dB (${Math.round(100 * Math.pow(10, clamped / 20))}%)`, 0);
    }
  };

  const fillPercent = Math.min(100, Math.round((storage.gainDb / 30) * 100));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#090A0F", padding: 16 }}>
      {/* GOD HEADER */}
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text style={{ color: "#E0A96D", fontSize: 22, fontWeight: "900", letterSpacing: 1.5 }}>
          ⚡ GOD-MIC REALTIME ENGINE ⚡
        </Text>
        <Text style={{ color: "#72767D", fontSize: 12, marginTop: 4 }}>
          Opus Overdrive • Stereo Spatial Bypass • Zero Artifacts
        </Text>
      </View>

      {/* ACTIVE GAIN DISPLAY & HUD METER */}
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
          Active Opus Overdrive
        </Text>
        <Text style={{ color: "#FFFFFF", fontSize: 38, fontWeight: "900", marginVertical: 6 }}>
          +{storage.gainDb.toFixed(1)} dB
        </Text>
        <Text style={{ color: "#4EAA86", fontSize: 12, fontWeight: "bold" }}>
          MULTIPLIER: {Math.round(100 * Math.pow(10, storage.gainDb / 20))}% POWER
        </Text>

        {/* Dynamic Visual Meter */}
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

      {/* STEPPER BUTTONS */}
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

      {/* GOD TIER PRESETS (WITH INSTANT +25dB PUNCH) */}
      <Text style={{ color: "#8A909D", fontSize: 12, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase" }}>
        Instant Power Presets
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

      {/* TOGGLES */}
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
            showToast(`Stereo Bypass: ${storage.stereoBypass ? "ENABLED" : "DISABLED"}`, 0);
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold" }}>
            Stereo Bypass: [ {storage.stereoBypass ? "ACTIVE" : "OFF"} ]
          </Text>
          <Text style={{ color: "#72767D", fontSize: 11, marginTop: 2 }}>
            Disables mono downmix & bypasses phase filtering
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
            showToast(`Live Toast: ${storage.liveToast ? "ENABLED" : "DISABLED"}`, 0);
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold" }}>
            Live VC Join Toast: [ {storage.liveToast ? "ACTIVE" : "OFF"} ]
          </Text>
          <Text style={{ color: "#72767D", fontSize: 11, marginTop: 2 }}>
            Real-time status notification badge upon joining any VC
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
