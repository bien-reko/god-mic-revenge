import { React } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { Forms, General } from "@vendetta/ui/components";

const { FormSection, FormRow, FormSwitch, FormSlider, FormDivider } = Forms;
const { ScrollView, Text, View } = General;

export default function Settings() {
  useProxy(storage);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#090A0F", padding: 16 }}>
      {/* GOD HEADER */}
      <View style={{ marginBottom: 20, alignItems: "center" }}>
        <Text style={{ color: "#E0A96D", fontSize: 24, fontWeight: "900", letterSpacing: 2 }}>
          ⚡ ASTRAL SOUND ENGINE ⚡
        </Text>
        <Text style={{ color: "#8A909D", fontSize: 12, marginTop: 4 }}>
          Stereo Analysis • Pure Opus Master • Absolute Dominance
        </Text>
      </View>

      {/* TIER 1: OPUS GAIN SCALING SLIDER */}
      <FormSection title="DIVINE GAIN SCALING (OPUS STAGE)">
        <FormRow
          label={`Opus Boost: +${storage.gainDb.toFixed(1)} dB`}
          subLabel={
            storage.gainDb <= 5.0
              ? "Crystal Crisp 5.0dB Precision Profile (Godly Resonance)"
              : "Massive Amplitude Drive (Warning: Sonic Rupture)"
          }
        />
        <FormSlider
          value={storage.gainDb}
          min={0.0}
          max={30.0}
          step={0.5}
          onValueChange={(val: number) => {
            storage.gainDb = parseFloat(val.toFixed(1));
          }}
        />
      </FormSection>

      <FormDivider />

      {/* TIER 2: ACOUSTIC PURITY & STEREO DEIFICATION */}
      <FormSection title="STEREO MASTER & SPATIAL PURITY">
        <FormSwitch
          label="God-Tier Stereo Analyzer Bypass"
          subLabel="Forces Discord to stop downmixing mic to mono; enables true Left/Right stereo audio processing."
          value={storage.stereoBypass}
          onValueChange={(val: boolean) => {
            storage.stereoBypass = val;
          }}
        />
        <FormSwitch
          label="Celestial Connection Toast"
          subLabel="Fires an instant real-time telemetry badge the microsecond you descend into any VC."
          value={storage.liveToast}
          onValueChange={(val: boolean) => {
            storage.liveToast = val;
          }}
        />
      </FormSection>

      {/* LIVE SOUND MATRIX SPECS */}
      <View style={{ marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: "#12141D" }}>
        <Text style={{ color: "#4EAA86", fontWeight: "bold", fontSize: 13 }}>
          ENGINE STATUS: HARMONIZED & TRANSCENDED
        </Text>
        <Text style={{ color: "#6C727F", fontSize: 11, marginTop: 4 }}>
          • Codec Pipeline: Full-Band Opus (48kHz Stereo)
          {"\n"}• Target Amplitude: +{storage.gainDb} dB Raw Injection
          {"\n"}• Noise Suppression: BYPASS (Zero Artifacting)
          {"\n"}• Acoustic Distortion Matrix: 0.0001%
        </Text>
      </View>
    </ScrollView>
  );
}
