<div align="center">

<img src="./public/icon.svg" width="110" height="110" alt="Open Brain Logo" />

# Open Brain
### **100% Free, Unlimited & Zero-Phone-Pressure AI Super-Agent + Native Android APK**

[![Android APK](https://img.shields.io/badge/Android_APK-OpenBrain_v2.0_Signed-14B8A6?style=for-the-badge&logo=android&logoColor=white)](./apk/OpenBrain-AI.apk)
[![Zero Phone Pressure](https://img.shields.io/badge/Featherlight-~190_KB_•_0%25_Phone_Lag-0D9488?style=for-the-badge)](#)
[![Free Unlimited](https://img.shields.io/badge/100%25_Free-Unlimited_Zero_API_Key-0F766E?style=for-the-badge)](#)

**Claude-Style Skills (`SKILL.md`) • Live MCP Connectors • Code-to-MP4 Sandbox Video Renderer • Android Phone OS Control • Zero-Shot Voice Cloning • Flux.1 HD Art**

</div>

---

## Direct Android APK Download

Your ready-to-install **Featherlight (~190 KB), Zero-Phone-Pressure, V2+V3 Signed Android APK** is located directly inside this repository:

**[Download `OpenBrain-AI.apk` (`apk/OpenBrain-AI.apk`)](./apk/OpenBrain-AI.apk)**

### Phone Installation Steps:
1. Open **[`apk/OpenBrain-AI.apk`](./apk/OpenBrain-AI.apk)** and tap **Download raw file** (or tap **Get APK** inside the web app).
2. Open the downloaded `.apk` file on your Android device and tap **Install** (Package: `com.openbrain.ai`, compatible with Android 7.0 through Android 16+).
3. **Zero Phone Pressure**: The app weighs under 200 KB, stores zero heavy local AI model files on your phone, and suspends timers automatically via `onPause()` for **0% background battery and CPU drain**.

---

## Core Capabilities

| Module | Capabilities | Open-Source Engines |
| :--- | :--- | :--- |
| **Claude-Style Code to Sandbox `.MP4` Video** | Writes deterministic JavaScript Canvas2D / Manim-style animation code, validates & executes it in Sandbox, and muxes real H.264 `.mp4` video via hardware `VideoEncoder` + `mp4-muxer` in ~2 seconds. Includes live code editor & re-rendering. | `Qwen 2.5 Coder 32B` + WebCodecs Hardware H.264 + `mp4-muxer` + Flux Cinema Director + `Wan2.1` / `LTX-Video` |
| **Claude-Style Modular Skills (`SKILL.md`)** | 7 built-in Pro Skills + Custom Skill Creator, AI Auto-Write Skill, and `.md` (`SKILL.md`) file importer. | Dynamic Cortex Skill Injection |
| **Live App & MCP Connectors** | 8 live connectors (**Android Phone OS**, **GitHub**, **Live Web/Wiki/DDG**, **Open-Meteo Weather**, **CoinGecko Markets**, **ArXiv Papers**, **Reddit/HN Pulse**, **HuggingFace ZeroGPU**) + **Custom Webhook / MCP HTTP Bridge** (n8n, Telegram, Slack, Notion). | Zero-Key Open REST + Custom HTTP/MCP Webhooks |
| **Full Android Phone Control** | Control system Alarms, Countdown Timers, WhatsApp, SMS, Phone Dialer, Calendar Reminders, Google Maps, YouTube, System Settings (Wi-Fi/Bluetooth/Sound/Display/Battery), Battery/Thermal monitor, and Scoped Storage saving to `Downloads/OpenBrain/`. | Native `OpenBrainNativeBridge` (`MainActivity.java`) |
| **Universal Multilingual Input** | Clean English interface while effortlessly understanding user messages typed or spoken in **any language** (English, Banglish, Bengali, Hindi, Spanish, Arabic, Japanese, and 100+ more). | **DeepSeek-R1**, **Qwen 2.5 Coder 32B**, **Llama 3.3 70B**, **Mistral**, **Omni-GPT4o Vision** |
| **Zero-Shot Voice Cloning Lab & Flux.1 Art** | Record 6–12s voice samples or upload `.wav`/`.mp3` -> Vocal DNA Biometrics ($F_0$ Hz, Warmth, Timbre) + **F5-TTS / CosyVoice ZeroGPU + Acoustic Voice Twin DSP** -> 16-bit `.wav` export, plus watermark-free **Flux.1** HD image generation. | `SWivid F5-TTS`, `CosyVoice`, Neural OpenAI-Audio, `Black Forest Labs Flux.1` |

---

## Run Locally or Rebuild APK

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build production web app & start server
npm run build
npm start
```

---

## License
100% Free & Open-Source (MIT) — **Open Brain**.
