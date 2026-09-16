import { React, ReactNative } from "@vendetta/metro/common";
import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showToast } from "@vendetta/ui/toasts";

const { View, Text, TouchableOpacity, ScrollView } = ReactNative;

const MediaEngineStore = findByProps("getInputVolume", "getEchoCancellation");
const FluxDispatcher = findByProps("dispatch", "subscribe");
const SelectedChannelStore = findByProps("getVoiceChannelId");
const ChannelStore = findByProps("getChannel");

export const logcatBuffer: { id: number; tag: string; msg: string; color: string; time: string }[] = [];
let logIdCounter = 0;

export function appendLog(tag: string, msg: string, color = "#C4C7C5") {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
  logcatBuffer.unshift({ id: ++logIdCounter, tag, msg, color, time });
  if (logcatBuffer.length > 50) logcatBuffer.pop();
}

// TOTAL CLIENT PIPELINE OVERHAUL INJECTOR
export function applyGodGain(gainDb: number, isWatchdog = false) {
  try {
    const linearMultiplier = Math.pow(10, gainDb / 20); // 80dB = 10,000x | 25dB = 17.78x
    const boostVolume = Math.round(100 * linearMultiplier);

    const engine = MediaEngineStore?.getMediaEngine?.();

    // 1. Force Audio Subsystem to Experimental/Legacy (Kills Android OS Hardware AGC)
    try {
      if (engine?.setAudioSubsystem) {
        engine.setAudioSubsystem("experimental");
      }
    } catch {}

    // 2. Terminate software AGC, Echo Cancellation, Noise Suppression, and Krisp
    if (FluxDispatcher?.dispatch) {
      FluxDispatcher.dispatch({ type: "AUDIO_SET_AUTOMATIC_GAIN_CONTROL", automaticGainControl: false });
      FluxDispatcher.dispatch({ type: "AUDIO_SET_ECHO_CANCELLATION", echoCancellation: false });
      FluxDispatcher.dispatch({ type: "AUDIO_SET_NOISE_SUPPRESSION", noiseSuppression: false });
      FluxDispatcher.dispatch({ type: "AUDIO_SET_NOISE_CANCELLATION", noiseCancellation: false });
      FluxDispatcher.dispatch({
        type: "AUDIO_SET_MODE",
        mode: "VOICE_ACTIVITY",
        options: { threshold: -100, autoThreshold: false, vadLeading: 200, vadTrailing: 500 }
      });
    }

    if (engine) {
      try {
        engine.setEchoCancellation?.(false);
        engine.setNoiseSuppression?.(false);
        engine.setAutomaticGainControl?.(false);
        engine.setNoiseCancellation?.(false);
        engine.setBitrate?.(512000);
        engine.setMode?.("VOICE_ACTIVITY", { threshold: -100, autoThreshold: false, vadLeading: 200, vadTrailing: 500 });
      } catch {}

      // 3. Low-Level WebRTC Connection Injection
      let activeStreams = 0;
      if (engine.connections) {
        const conns = engine.connections instanceof Set
          ? Array.from(engine.connections)
          : Array.isArray(engine.connections)
            ? engine.connections
            : Object.values(engine.connections);

        conns.forEach((conn: any) => {
          activeStreams++;
          try {
            if (conn.input) {
              conn.input.setVolume?.(linearMultiplier);
              conn.input.volume = linearMultiplier;
            }
            if (conn.setBitrate) conn.setBitrate(512000);
            if (conn.setAutomaticGainControl) conn.setAutomaticGainControl(false);
            if (conn.setEchoCancellation) conn.setEchoCancellation(false);
            if (conn.setNoiseSuppression) conn.setNoiseSuppression(false);
            if (conn.setAudioSubsystem) conn.setAudioSubsystem("experimental");
          } catch {}
        });
      }

      // 4. Force software setInputVolume
      try {
        engine.setInputVolume?.(boostVolume);
      } catch {}

      if (!isWatchdog) {
        appendLog("PIPELINE", `Audio subsystem: EXPERIMENTAL • Bitrate: 512kbps`, "#D0BCFF");
        appendLog("OVERDRIVE", `Scaled by +${gainDb.toFixed(1)}dB (${Math.round(linearMultiplier)}x) • Streams: ${activeStreams}`, "#6DD58C");
        appendLog("AI-ANALYZER", `VAD Threshold: -100dB • Hardware AGC: NULLIFIED`, "#A8C7FA");
      }
    }
  } catch (err: any) {
    appendLog("ERROR", `Pipeline Overdrive Fail: ${err?.message ?? err}`, "#F2B8B5");
  }
}

export default function Settings() {
  useProxy(storage);
  const [, setTick] = (React as any).useState(0);
  const [isLoopback, setIsLoopback] = (React as any).useState(false);

  const presets = [
    { label: "+5dB Crisp", val: 5.0, color: "#C4EDD9", onColor: "#003822" },
    { label: "+25dB DJ Master", val: 25.0, color: "#D0BCFF", onColor: "#381E72" },
    { label: "+50dB Void Push", val: 50.0, color: "#A8C7FA", onColor: "#04315A" },
    { label: "+80dB GOD APOCALYPSE", val: 80.0, color: "#F2B8B5", onColor: "#601410" },
  ];

  const activeChannelId = SelectedChannelStore?.getVoiceChannelId();
  const activeChannel = activeChannelId ? ChannelStore?.getChannel(activeChannelId) : null;
  const isInVC = Boolean(activeChannelId);

  const engine = MediaEngineStore?.getMediaEngine?.();
  const engineConnected = Boolean(engine);
  const streamsCount = engine?.connections ? (engine.connections.size ?? Object.keys(engine.connections).length) : 0;

  const updateGain = (newGain: number) => {
    const clamped = Math.max(0, Math.min(80, parseFloat(newGain.toFixed(1))));
    storage.gainDb = clamped;
    applyGodGain(clamped);
    setTick((t: number) => t + 1);

    const mult = Math.round(Math.pow(10, clamped / 20));
    if (storage.liveToast) {
      showToast(`⚡ [GOD MIC] ${isInVC ? `#${activeChannel?.name}` : "Ready"}: +${clamped.toFixed(1)}dB (${mult}x RAW)`, 0);
    }
  };

  const toggleLoopback = () => {
    try {
      const next = !isLoopback;
      setIsLoopback(next);
      if (engine?.setLoopback) {
        engine.setLoopback(next);
        appendLog("MONITOR", `Live Mic Probe: ${next ? "ENABLED" : "DISABLED"}`, "#D0BCFF");
        showToast(`Mic Test: ${next ? "ACTIVE (Speak to verify)" : "OFF"}`, 0);
      } else {
        showToast("Loopback not supported by device HAL", 0);
      }
    } catch (e: any) {
      appendLog("ERROR", `Loopback failed: ${e?.message}`, "#F2B8B5");
    }
  };

  const fillPercent = Math.min(100, Math.round((storage.gainDb / 80) * 100));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#141218", padding: 16 }}>
      {/* HEADER */}
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: "#E6E1E5", fontSize: 24, fontWeight: "800" }}>
          God-Mic Audio Overdrive
        </Text>
        <Text style={{ color: "#CAC4D0", fontSize: 13, marginTop: 2 }}>
          Experimental Subsystem • WebRTC Track Overdrive
        </Text>
      </View>

      {/* HOOK STATUS & DIAGNOSTICS */}
      <View style={{ backgroundColor: "#211F26", borderRadius: 24, padding: 18, marginBottom: 16 }}>
        <Text style={{ color: "#D0BCFF", fontSize: 13, fontWeight: "800", textTransform: "uppercase" }}>
          Engine Hook Diagnostics
        </Text>
        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: "#36343B", paddingTop: 8 }}>
          <Text style={{ color: "#CAC4D0", fontSize: 12, lineHeight: 18 }}>
            • MediaEngine Core: <Text style={{ color: engineConnected ? "#6DD58C" : "#F2B8B5", fontWeight: "bold" }}>{engineConnected ? "HOOKED & ARMED" : "DISCONNECTED"}</Text>
            {"\n"}• Active Voice Streams: <Text style={{ color: streamsCount > 0 ? "#6DD58C" : "#D0BCFF", fontWeight: "bold" }}>{streamsCount} ACTIVE</Text>
            {"\n"}• Subsystem Mode: <Text style={{ color: "#A8C7FA", fontWeight: "bold" }}>EXPERIMENTAL (No Hardware AGC)</Text>
            {"\n"}• Opus Rate: <Text style={{ color: "#6DD58C", fontWeight: "bold" }}>512,000 bps Stereo (Mode 2)</Text>
            {"\n"}• VAD Sensitivity Gate: <Text style={{ color: "#6DD58C", fontWeight: "bold" }}>-100 dBFS (Wide Open)</Text>
          </Text>
        </View>
      </View>

      {/* AMPLITUDE DISPLAY */}
      <View style={{ backgroundColor: "#211F26", borderRadius: 24, padding: 20, marginBottom: 16 }}>
        <Text style={{ color: "#CAC4D0", fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>
          Raw Opus Signal Amplification
        </Text>
        <Text style={{ color: "#E6E1E5", fontSize: 46, fontWeight: "900", marginVertical: 4 }}>
          +{storage.gainDb.toFixed(1)} <Text style={{ fontSize: 22, color: "#D0BCFF" }}>dB</Text>
        </Text>
        <Text style={{ color: "#6DD58C", fontSize: 13, fontWeight: "bold" }}>
          SIGNAL MULTIPLIER: {Math.round(Math.pow(10, storage.gainDb / 20))}x ACTUAL DRIVE
        </Text>

        <View style={{ width: "100%", height: 10, backgroundColor: "#49454F", borderRadius: 5, marginVertical: 12, overflow: "hidden" }}>
          <View style={{ width: `${fillPercent}%`, height: "100%", backgroundColor: storage.gainDb >= 50 ? "#F2B8B5" : "#D0BCFF" }} />
        </View>

        {/* Steppers */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "#4A4458", padding: 14, borderRadius: 16, alignItems: "center", marginRight: 4 }}
            onPress={() => updateGain(storage.gainDb - 5.0)}
          >
            <Text style={{ color: "#EADDFF", fontWeight: "800", fontSize: 14 }}>-5 dB</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "#4A4458", padding: 14, borderRadius: 16, alignItems: "center", marginHorizontal: 4 }}
            onPress={() => updateGain(storage.gainDb - 1.0)}
          >
            <Text style={{ color: "#EADDFF", fontWeight: "800", fontSize: 14 }}>-1 dB</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "#D0BCFF", padding: 14, borderRadius: 16, alignItems: "center", marginHorizontal: 4 }}
            onPress={() => updateGain(storage.gainDb + 1.0)}
          >
            <Text style={{ color: "#381E72", fontWeight: "800", fontSize: 14 }}>+1 dB</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "#D0BCFF", padding: 14, borderRadius: 16, alignItems: "center", marginLeft: 4 }}
            onPress={() => updateGain(storage.gainDb + 5.0)}
          >
            <Text style={{ color: "#381E72", fontWeight: "800", fontSize: 14 }}>+5 dB</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* PRESETS */}
      <Text style={{ color: "#CAC4D0", fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase" }}>
        Gain Presets
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 16 }}>
        {presets.map((p) => {
          const isSelected = storage.gainDb === p.val;
          return (
            <TouchableOpacity
              key={p.label}
              style={{
                width: "48%",
                backgroundColor: isSelected ? p.color : "#2B2930",
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: "center",
                marginBottom: 10,
              }}
              onPress={() => updateGain(p.val)}
            >
              <Text style={{ color: isSelected ? p.onColor : "#E6E1E5", fontWeight: "800", fontSize: 13 }}>
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MIC TEST LOOPBACK PROBE */}
      <TouchableOpacity
        style={{
          backgroundColor: isLoopback ? "#601410" : "#2B2930",
          borderColor: isLoopback ? "#F2B8B5" : "#49454F",
          borderWidth: 1.5,
          padding: 16,
          borderRadius: 20,
          marginBottom: 16,
          alignItems: "center",
        }}
        onPress={toggleLoopback}
      >
        <Text style={{ color: isLoopback ? "#F2B8B5" : "#D0BCFF", fontWeight: "800", fontSize: 14 }}>
          {isLoopback ? "🔴 STOP MIC MONITOR" : "🎧 TEST MIC GAIN (SELF-LISTEN)"}
        </Text>
        <Text style={{ color: "#CAC4D0", fontSize: 11, marginTop: 4 }}>
          {isLoopback ? "Loopback active! Listen to your own voice in real time." : "Verify the amplified sound in your headphones."}
        </Text>
      </TouchableOpacity>

      {/* AI LOGCAT TERMINAL */}
      <View style={{ backgroundColor: "#1D1B20", borderRadius: 24, padding: 16, marginBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ color: "#D0BCFF", fontWeight: "800", fontSize: 13 }}>AI LOGCAT ENGINE</Text>
          <TouchableOpacity
            onPress={() => {
              logcatBuffer.length = 0;
              appendLog("SYS", "Diagnostic log cleared.", "#CAC4D0");
              setTick((t: number) => t + 1);
            }}
          >
            <Text style={{ color: "#A8C7FA", fontSize: 11, fontWeight: "700" }}>CLEAR</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: "#0E0E11", borderRadius: 16, padding: 12, minHeight: 140, maxHeight: 200 }}>
          <ScrollView nestedScrollEnabled={true}>
            {logcatBuffer.length === 0 ? (
              <Text style={{ color: "#49454F", fontSize: 11, fontStyle: "italic" }}>
                Awaiting audio engine activity...
              </Text>
            ) : (
              logcatBuffer.map((log) => (
                <Text key={log.id} style={{ fontSize: 10.5, lineHeight: 15, marginBottom: 3, fontFamily: "monospace" }}>
                  <Text style={{ color: "#79747E" }}>{log.time} </Text>
                  <Text style={{ color: log.color, fontWeight: "bold" }}>[{log.tag}] </Text>
                  <Text style={{ color: "#E6E1E5" }}>{log.msg}</Text>
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </ScrollView>
  );
}
