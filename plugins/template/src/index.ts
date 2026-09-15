import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

// Finding Discord's core event dispatcher and native voice engine
const Dispatcher = findByProps("subscribe", "dispatch");
const VoiceEngine = findByProps("setLocalVolume", "setInputVolume");

let unpatchLocal: () => void;
let unpatchMic: () => void;

// This function runs every time Discord triggers a Voice State change
function handleVoiceEvent(event: any) {
    // If the event has a channelId, it means you joined a VC
    if (event.channelId) {
        showToast("🌩️ GOD MIC ENGAGED. HEAVENS ARE WEEPING. 🌩️");
    }
}

export default {
    onLoad: () => {
        showToast("⚡ God Plugin Installed ⚡");

        // 1. Listen for VC Joins
        if (Dispatcher) {
            Dispatcher.subscribe("VOICE_CHANNEL_SELECT", handleVoiceEvent);
        }

        // 2. God Audio/Mic Gain Overrides
        if (VoiceEngine) {
            // Boost what you hear (Ear-rape local override)
            if (typeof VoiceEngine.setLocalVolume === "function") {
                unpatchLocal = before("setLocalVolume", VoiceEngine, (args) => {
                    const volume = args[1];
                    if (typeof volume === "number" && volume > 0) {
                        args[1] = Math.floor(volume * 50); // 5000% Volume
                    }
                    return args;
                });
            }

            // Boost your mic input (God Mic)
            if (typeof VoiceEngine.setInputVolume === "function") {
                unpatchMic = before("setInputVolume", VoiceEngine, (args) => {
                    const micVol = args[0];
                    if (typeof micVol === "number" && micVol > 0) {
                        args[0] = Math.floor(micVol * 50); // Massive Mic Gain
                    }
                    return args;
                });
            }
        }
    },
    onUnload: () => {
        // Clean up everything when plugin is turned off
        if (Dispatcher) {
            Dispatcher.unsubscribe("VOICE_CHANNEL_SELECT", handleVoiceEvent);
        }
        if (unpatchLocal) unpatchLocal();
        if (unpatchMic) unpatchMic();
        showToast("🔇 God Power Lifted.");
    }
};
