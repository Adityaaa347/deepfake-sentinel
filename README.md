# VERITAS SENTINEL // Deepfake Forensic Suite & Cyber Security Escalation Desk

An aesthetic, precision-engineered, **100% zero-dependency, from-scratch** forensic analysis platform and official law enforcement reporting desk for detecting synthetic media across **Images, Videos, Voice/Audio, and Text**.

---

## ⚡ Zero External Libraries Guarantee
- **No NPM packages, no CDNs, no external frameworks, no cloud AI APIs**.
- Every algorithm is implemented strictly from first principles using standard HTML5, Canvas API, Web Audio API, Web Crypto API, and pure mathematical heuristics.
- **100% Client-Side Privacy**: Evidentiary media never leaves your local browser memory. Files are processed entirely in RAM.

---

## 🔬 Core Forensic Capabilities

### 1. Image Forensics (ELA & Spectral Noise Analysis)
- **Error Level Analysis (ELA)**: Computes localized JPEG recompression error deltas to expose image splicing, inpainting, and synthetic generative masks.
- **Laplacian High-Pass Noise Spectrum**: Evaluates micro-texture variance to isolate neural diffusion over-smoothing and GAN checkerboard upsampling artifacts.
- **YCbCr Chrominance Disparity**: Dissects luminance vs chrominance correlation to detect specular highlight anomalies and color plane bleeding.
- **Binary Metadata & EXIF Parser**: Handcrafted binary parser inspecting JPEG APP1 (TIFF/IFD0) markers and PNG chunks (`tEXt`, `iTXt`) to uncover AI generation signatures (Stable Diffusion, Midjourney, ComfyUI, DALL-E, NovelAI) or camera hardware sensor profiles.
- **Interactive 4× Forensic Loupe**: Move your cursor across the canvas to inspect pixel-level boundary deltas and compression seams in real time.

### 2. Video Deepfake Analysis
- **Temporal Keyframe Decomposition**: Extracts frame intervals via Canvas and HTML5 Video APIs.
- **Mean Absolute Difference (MAD) Tracking**: Measures inter-frame structural variance across consecutive frames.
- **Central Facial Motion & Boundary Disparity**: Exposes facial warping, alignment losses, and periodic boundary flickering common in neural face-swaps and diffusion video generators.
- **Frame Strip Visualizer**: Chronological keyframe inspection dock highlighting anomaly timestamps.

### 3. Voice & Audio Spectral Analysis
- **Nyquist High-Frequency Cutoffs**: Pinpoints brick-wall frequency ceilings typical of 16kHz/24kHz neural vocoders (HiFi-GAN, ElevenLabs, VALL-E).
- **Acoustic Digital Zero Silence Detector**: Identifies the unnatural absence of room impulse response / ambient microphone thermal noise floor.
- **Vocal Micro-Perturbation & Jitter**: Distinguishes organic human vocal chord tremor from algorithmically smoothed synthetic speech.

### 4. Text & AI Narrative Forensics
- **Shannon Entropy**: Measures word-level information density to expose typical LLM probabilistic token distributions.
- **Burstiness & Sentence Length Variance**: Distinguishes human rhythmic irregularity from uniform algorithmic pacing.
- **Lexical Diversity (Type-Token Ratio)**: Evaluates vocabulary repetition and hapax legomena distribution.
- **Rhetorical Marker Dictionary**: Flags statistical over-representations of stereotypical AI transitional crutches (*"delve"*, *"testament"*, *"tapestry"*, *"moreover"*, *"underscores"*, *"pivotal"*, etc.).

---

## 🛡️ Direct Cyber Police & Law Enforcement Reporting Desk
Citizens, organizations, and legal teams can immediately convert forensic findings into court-admissible evidence:

- **Cryptographic Chain of Custody (SHA-256)**: Real-time cryptographic digest generation using the native browser `crypto.subtle` engine.
- **Formal Legal Incident Dossier (Print / PDF)**: Formats a complete legal complaint docket with Section 65B (Indian Evidence Act) / FRE 902 (US Federal Rules of Evidence) compliance, complete with complaint particulars, suspect coordinates, platform URLs, forensic metrics, and signature blocks.
- **Signed Machine-Readable JSON Export**: Export an immutable JSON file containing all diagnostic findings, SHA-256 hashes, timestamps, and suspect profiles.
- **Direct Jurisdiction Routing**:
  - **India**: National Cyber Crime Reporting Portal (`cybercrime.gov.in`) + Helpline 1930.
  - **United States**: FBI Internet Crime Complaint Center (`ic3.gov`) + CISA.
  - **United Kingdom**: Action Fraud & City of London Police (`actionfraud.police.uk`).
  - **European Union**: Europol EC3 & Member State Police Agencies.
  - **Australia**: ReportCyber (`cyber.gov.au`).
  - **International**: INTERPOL Cybercrime Directorate.
- **Direct Dispatch Simulation**: Pre-registers incident dockets and provides emergency statutory freeze directives for golden-hour fraud mitigation.

---

## 🚀 How to Run Locally

### Option A: One-Click Windows Launcher
Double-click `run.bat` in this directory.

### Option B: Python Standard Library Server
```bash
python server.py --open
```
Navigate to `http://localhost:8080` in any modern web browser (Edge, Chrome, Firefox, Safari).

### Option C: Direct File Opening
You can also open `index.html` directly in your browser. (Serving via HTTP with Option B is recommended for full Web Audio buffer rendering and canvas cross-origin security).
