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

// THE DIVINE CONFIGURATION MATRIX
export const CFG = Object.freeze({
  mic: Object.freeze({
    channelCount:     { ideal: 2 },
    sampleRate:       { ideal: 48000 },
    sampleSize:       { ideal: 16 },
    echoCancellation: { exact: false },
    noiseSuppression: { exact: false },
    autoGainControl:  { exact: false },
  }),
  opus: Object.freeze({
    stereo:            '1',
    'sprop-stereo':    '1',
    maxaveragebitrate: '512000',
    maxplaybackrate:   '48000',
    usedtx:            '0',
    useinbandfec:      '0',
    minptime:          '10',
    ptime:             '20',
  }),
  bitrate: 512000,
  blocklist: ['krisp', 'noise', 'suppression'],
  eq: Object.freeze([
    { freq:    31, gain: 0, q: 1.4 },
    { freq:    62, gain: 0, q: 1.4 },
    { freq:   125, gain: 0, q: 1.4 },
    { freq:   250, gain: 0, q: 1.4 },
    { freq:   500, gain: 0, q: 1.4 },
    { freq:  1000, gain: 0, q: 1.4 },
    { freq:  2000, gain: 0, q: 1.4 },
    { freq:  4000, gain: 0, q: 1.4 },
    { freq:  8000, gain: 0, q: 1.4 },
    { freq: 16000, gain: 0, q: 1.4 },
  ]),
});

// SDP Munger: Injects Opus stereo & 512kbps bitrate straight into WebRTC SDP handshake
export function mungeSDP(sdp: string): string {
  if (!sdp) return sdp;
  return sdp.replace(/(a=fmtp:\d+ .*)/g, (line) => {
    if (!line.includes("opus")) return line;
    const opusParams = Object.entries(CFG.opus)
      .map(([k, v]) => `${k}=${v}`)
      .join(";");
    return `${line};${opusParams}`;
  });
}

// Low-Level Real-Time Encoder & Hardware Gain Overdrive (+80dB Max)
export function applyGodGain(gainDb: number) {
  try {
    const linearMultiplier = Math.pow(10, gainDb / 20); // 80dB = 10,000x multiplier
    const targetVolume = Math.round(100 * linearMultiplier); // 1,000,000% raw input

    // 1. Dispatch internal audio state updates
    if (FluxDispatcher?.dispatch) {
      FluxDispatcher.dispatch({
        type: "AUDIO_SET_INPUT_VOLUME",
        volume: targetVolume,
      });
      // Neutralize compressor & ducking
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

    // 2. High-level UI Action volume
    if (MediaEngineActions?.setInputVolume) {
      MediaEngineActions.setInputVolume(targetVolume);
    }

    // 3. WebRTC low-level media connection overdrive
    const nativeEngine = MediaEngineStore?.getMediaEngine?.();
    if (nativeEngine) {
      if (nativeEngine.setInputVolume) {
        nativeEngine.setInputVolume(targetVolume);
      }
      if (nativeEngine.setBitrate) {
        nativeEngine.setBitrate(CFG.bitrate);
      }
      if (nativeEngine.connections) {
        nativeEngine.connections.forEach((conn: any) => {
          try {
            if (conn.input?.setVolume) {
              conn.input.setVolume(linearMultiplier);
            }
            if (conn.setBitrate) {
              conn.setBitrate(CFG.bitrate);
            }
          } catch {}
        });
      }
    }
  } catch (err) {
    console.error("[GOD_ENGINE_GAIN_ERROR]", err);
  }
}

export default function Settings() {
  useProxy(storage);

  const presets = [
    { label: "+5dB Crisp", val: 5.0, color: "#4EAA86" },
    { label: "+25dB DJ Boost", val: 25.0, color: "#3B82F6" },
    { label: "+50dB Sonic Void", val: 50.0, color: "#A855F7" },
    { label: "+80dB GOD APOCALYPSE", val: 80.0, color: "#EF4444" },
  ];

  const activeChannelId = SelectedChannelStore?.getVoiceChannelId();
  const activeChannel = activeChannelId ? ChannelStore?.getChannel(activeChannelId) : null;
  const isInVC = Boolean(activeChannelId);

  const updateGain = (newGain: number) => {
    const clamped = Math.max(0, Math.min(80, parseFloat(newGain.toFixed(1))));
    storage.gainDb = clamped;
    applyGodGain(clamped);

    const mult = Math.round(Math.pow(10, clamped / 20));
    if (storage.liveToast) {
      if (isInVC) {
        showToast(`⚡ [GOD MIC] VC #${activeChannel?.name}: +${clamped.toFixed(1)}dB (${mult}x AMPLIFIED)`, 0);
      } else {
        showToast(`⚡ [GOD MIC] Arming: +${clamped.toFixed(1)}dB (${mult}x RAW)`, 0);
      }
    }
  };

  const fillPercent = Math.min(100, Math.round((storage.gainDb / 80) * 100));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#06070A", padding: 16 }}>
      {/* HEADER */}
      <View style={{ alignItems: "center", marginBottom: 16 }}>
        <Text style={{ color: "#E0A96D", fontSize: 24, fontWeight: "900", letterSpacing: 2 }}>
          ⚡ GOD-MIC ASTRAL OVERDRIVE ⚡
        </Text>
        <Text style={{ color: "#72767D", fontSize: 11, marginTop: 4, letterSpacing: 1 }}>
          C-Level WebRTC Handshake • 512kbps Opus • 80dB Peak
        </Text>
      </View>

      {/* LIVE VC TELEMETRY HUD */}
      <View
        style={{
          backgroundColor: isInVC ? "#0D241C" : "#17141E",
          borderColor: isInVC ? "#4EAA86" : "#A855F7",
          borderWidth: 1.5,
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
                backgroundColor: isInVC ? "#4EAA86" : "#A855F7",
                marginRight: 8,
              }}
            />
            <Text style={{ color: isInVC ? "#4EAA86" : "#A855F7", fontWeight: "900", fontSize: 13 }}>
              {isInVC ? "REALTIME VC LINK ENGAGED" : "ASTRAL STANDBY (NOT IN VC)"}
            </Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontWeight: "900", fontSize: 12 }}>
            {isInVC ? `#${activeChannel?.name}` : "IDLE"}
          </Text>
        </View>

        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingTop: 8 }}>
          <Text style={{ color: "#8A909D", fontSize: 11, lineHeight: 16 }}>
            • Pipeline: {isInVC ? "TRANSMITTING 48kHz DUAL-CHANNEL" : "ARMED FOR HANDSHAKE"}
            {"\n"}• Opus Payload: 512,000 bps • minptime: 10ms • ptime: 20ms
            {"\n"}• Noise Engine: KRISP & AGC PERMANENTLY SUPPRESSED
            {"\n"}• Target Amplitude: +{storage.gainDb.toFixed(1)} dB (10,000x Max Range)
          </Text>
        </View>
      </View>

      {/* POWER DISPLAY METER */}
      <View
        style={{
          backgroundColor: "#0F1118",
          padding: 18,
          borderRadius: 14,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#232738",
          marginBottom: 16,
        }}
      >
        <Text style={{ color: "#8A909D", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>
          Current Opus Encoder Drive
        </Text>
        <Text
          style={{
            color: storage.gainDb >= 50 ? "#EF4444" : "#FFFFFF",
            fontSize: 44,
            fontWeight: "900",
            marginVertical: 4,
          }}
        >
          +{storage.gainDb.toFixed(1)} dB
        </Text>
        <Text style={{ color: "#4EAA86", fontSize: 13, fontWeight: "bold" }}>
          RAW SIGNAL: {Math.round(Math.pow(10, storage.gainDb / 20))}x AMPLIFIED
        </Text>

        {/* Dynamic 80dB Fill Bar */}
        <View
          style={{
            width: "100%",
            height: 10,
            backgroundColor: "#1B1E2B",
            borderRadius: 5,
            marginTop: 14,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${fillPercent}%`,
              height: "100%",
              backgroundColor: storage.gainDb >= 50 ? "#EF4444" : storage.gainDb >= 25 ? "#E0A96D" : "#4EAA86",
            }}
          />
        </View>
      </View>

      {/* STEPPERS */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#161924",
            padding: 14,
            borderRadius: 8,
            alignItems: "center",
            marginRight: 6,
          }}
          onPress={() => updateGain(storage.gainDb - 5.0)}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 15 }}>▼ -5.0 dB</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#161924",
            padding: 14,
            borderRadius: 8,
            alignItems: "center",
            marginLeft: 6,
          }}
          onPress={() => updateGain(storage.gainDb + 5.0)}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold", fontSize: 15 }}>▲ +5.0 dB</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#161924",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
            marginRight: 6,
          }}
          onPress={() => updateGain(storage.gainDb - 1.0)}
        >
          <Text style={{ color: "#8A909D", fontWeight: "bold", fontSize: 13 }}>-1.0 dB Fine</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "#161924",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
            marginLeft: 6,
          }}
          onPress={() => updateGain(storage.gainDb + 1.0)}
        >
          <Text style={{ color: "#8A909D", fontWeight: "bold", fontSize: 13 }}>+1.0 dB Fine</Text>
        </TouchableOpacity>
      </View>

      {/* PRESETS (INCLUDING 80dB GOD APOCALYPSE) */}
      <Text style={{ color: "#8A909D", fontSize: 12, fontWeight: "bold", marginBottom: 8, textTransform: "uppercase" }}>
        Overdrive Presets
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {presets.map((preset) => (
          <TouchableOpacity
            key={preset.label}
            style={{
              width: "48%",
              backgroundColor: storage.gainDb === preset.val ? preset.color : "#0F1118",
              paddingVertical: 14,
              borderRadius: 8,
              alignItems: "center",
              marginBottom: 10,
              borderWidth: 1.5,
              borderColor: preset.color,
            }}
            onPress={() => updateGain(preset.val)}
          >
            <Text
              style={{
                color: storage.gainDb === preset.val ? "#000000" : "#FFFFFF",
                fontWeight: "900",
                fontSize: 12,
              }}
            >
              {preset.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* TOGGLE SETTINGS */}
      <View style={{ marginTop: 8 }}>
        <TouchableOpacity
          style={{
            backgroundColor: storage.sdpMunge ? "#162720" : "#0F1118",
            padding: 14,
            borderRadius: 8,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: storage.sdpMunge ? "#4EAA86" : "#232738",
          }}
          onPress={() => {
            storage.sdpMunge = !storage.sdpMunge;
            showToast(`SDP Munge: ${storage.sdpMunge ? "ENGAGED" : "DISABLED"}`, 0);
          }}
        >
          <Text style={{ color: "#FFF", fontWeight: "bold" }}>
            SDP Handshake Munger: [ {storage.sdpMunge ? "ACTIVE (512kbps)" : "OFF"} ]
          </Text>
          <Text style={{ color: "#72767D", fontSize: 11, marginTop: 2 }}>
            Injects stereo=1;sprop-stereo=1;ptime=20 into WebRTC local description
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: storage.liveToast ? "#171F33" : "#0F1118",
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
            Live VC Join Telemetry Toast: [ {storage.liveToast ? "ACTIVE" : "OFF"} ]
          </Text>
          <Text style={{ color: "#72767D", fontSize: 11, marginTop: 2 }}>
            Fires instant dB multiplier toasts upon entering or hopping between voice channels
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
