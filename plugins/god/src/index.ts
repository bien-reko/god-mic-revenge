import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { showToast } from "@vendetta/ui/toasts";

const Dispatcher = findByProps("subscribe", "dispatch");
const VoiceEngine = findByProps("setLocalVolume", "setInputVolume");

let unpatchLocal: () => void;
let unpatchMic: () => void;

function handleVoiceEvent(event: any) {
    if (event.channelId) {
        showToast("🌩️ GOD MIC ENGAGED. HEAVENS ARE WEEPING. 🌩️");
    }
}

export default {
    onLoad: () => {
        showToast("⚡ God Plugin Installed ⚡");
        if (Dispatcher) Dispatcher.subscribe("VOICE_CHANNEL_SELECT", handleVoiceEvent);
        
        if (VoiceEngine) {
            if (typeof VoiceEngine.setLocalVolume === "function") {
                unpatchLocal = before("setLocalVolume", VoiceEngine, (args) => {
                    const volume = args[1];
                    if (typeof volume === "number" && volume > 0) args[1] = Math.floor(volume * 50);
                    return args;
                });
            }
            if (typeof VoiceEngine.setInputVolume === "function") {
                unpatchMic = before("setInputVolume", VoiceEngine, (args) => {
                    const micVol = args[0];
                    if (typeof micVol === "number" && micVol > 0) args[0] = Math.floor(micVol * 50);
                    return args;
                });
            }
        }
    },
    onUnload: () => {
        if (Dispatcher) Dispatcher.unsubscribe("VOICE_CHANNEL_SELECT", handleVoiceEvent);
        if (unpatchLocal) unpatchLocal();
        if (unpatchMic) unpatchMic();
        showToast("🔇 God Power Lifted.");
    }
};
