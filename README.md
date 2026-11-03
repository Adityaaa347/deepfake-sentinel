# VERITAS SENTINEL // Deepfake Detection Assistant
### SIH 2024 – Problem Statement SIH1683: AI/ML Solution for Detection of Face-Swap Based Deepfake Videos
**Group ID:** G011 &bull; **Project Lead:** Aditya Majumdar (`Adityaaa347`)  
**Live Application:** [https://adityaaa347.github.io/deepfake-sentinel/](https://adityaaa347.github.io/deepfake-sentinel/)

---

## ⚡ Problem Statement Summary (SIH1683)
* **Title:** AI/ML solution for detection of face-swap based deepfake videos
* **Mandated Datasets:** FaceForensics++ (FF++) and Celeb-DF (v2)
* **Core Requirements:**
  1. Automated detection of face-swap and manipulated videos.
  2. Implement **CNN and Vision Transformer (ViT)** neural classifiers.
  3. Include robust **Class Imbalance Handling** (mitigating the ~10:1 synthetic skew in Celeb-DF).
  4. Include comprehensive **Model Explainability** (Grad-CAM, ELA, and spatial frequency maps).

---

## 📂 Benchmark Datasets & Download Links
1. **FaceForensics++ (FF++)**:
   * **Source & Official Repository:** [https://github.com/ondyari/FaceForensics](https://github.com/ondyari/FaceForensics)
   * **Size:** 1,000 original videos, 4,000 manipulated sequences across Deepfakes, Face2Face, FaceSwap, NeuralTextures (~45 GB).
   * **Preprocessing:** Temporal sampling, Haar cascade facial crop with 15% boundary dilation, resized to $224 \times 224$ with ImageNet normalization.
2. **Celeb-DF v2**:
   * **Source & Official Repository:** [https://github.com/yuezunli/celeb-deepfakeforensics](https://github.com/yuezunli/celeb-deepfakeforensics)
   * **Size:** 590 authentic celebrity videos and 5,639 high-quality synthesized videos (~16.8 GB).
   * **Class Imbalance:** 9.55:1 imbalance ratio mitigated via Focal Loss ($\gamma=2.0, \alpha=0.25$) and batch-level `WeightedRandomSampler`.

---

## 🧠 Neural Architecture & ML Pipeline (`ml/`)

### 1. MesoNet-4 (CNN Architecture)
* **Design:** 4-stage convolutional backbone with Batch Normalization and Max-Pooling (`ml/models.py`).
* **Purpose:** Detects subtle **mesoscopic compression artifacts and boundary blending seams** along face-swap contours that standard object recognition networks miss.
* **Footprint:** 61,865 parameters (>140 FPS on standard CPU, real-time edge ready).

### 2. DeepfakeViT (Vision Transformer)
* **Design:** Splits $224 \times 224$ face crops into non-overlapping $16 \times 16$ patches ($N = 196$) with 6 Transformer Encoder blocks and Multi-Head Self-Attention (8 heads, $D=256$).
* **Purpose:** Models long-range facial landmark incoherencies (asymmetric eye reflections, lighting direction mismatches, and jawline warping).

### 3. Dual-Stream Hybrid (CNN-ViT Ensemble)
* Combines high-frequency boundary gradient descriptors from MesoNet-4 with global self-attention representations from DeepfakeViT via late feature fusion.

---

## ⚖️ Class Imbalance Mitigation Strategy

Celeb-DF v2 presents a severe class imbalance ($\approx 5,639$ deepfakes vs $590$ authentic videos, a **~9.55:1 imbalance**). Standard Cross-Entropy leads to biased decision boundaries. We resolve this via:

1. **Focal Loss Formulation (`ml/loss.py`):**
   $$\text{FL}(p_t) = -\alpha_t (1 - p_t)^\gamma \log(p_t)$$
   Down-weights easy majority-class background samples ($\gamma = 2.0, \alpha = 0.25$) and focuses optimization on ambiguous face-swap boundary examples.
2. **Class-Balanced Effective Number of Samples Loss:**
   Normalizes weights based on effective volume $E_n = \frac{1 - \beta^n}{1 - \beta}$ ($\beta = 0.999$).
3. **`WeightedRandomSampler`:**
   Enforces exact **1:1 batch class parity** inside every mini-batch during PyTorch DataLoader iterations.

---

## 🔍 Explainability & Visual Attribution

Rather than an unexplainable black-box prediction, Veritas Sentinel provides two complementary layers of explainability:

1. **Neural Grad-CAM Heatmaps (`ml/explainability.py`):**
   Calculates gradient attribution weights from the final convolutional layer:
   $$L_{\text{Grad-CAM}}^c = \text{ReLU}\left(\sum_k \alpha_k^c A^k\right)$$
   Locates the exact pixel regions (e.g. mouth blending perimeter or eye socket seams) that triggered the deepfake classification.
2. **Physical Signal Forensic Workbench (Client-Side Web Engine):**
   * **Error Level Analysis (ELA):** Recompression differential reveals digital splicing.
   * **Laplacian High-Pass Filter:** Exposes GAN checkerboard patterns and synthetic skin smoothing.
   * **Temporal Mean Absolute Difference (MAD):** Frame-by-frame motion tracking reveals face-swap warping jitter.
   * **Audio Nyquist Vocoder Cliffs:** Detects 16kHz/24kHz brickwall ceilings in cloned voices.

---

## 📊 Benchmark Verification Matrix

Evaluated across FaceForensics++ (c23) and Celeb-DF v2:

| Model Architecture | Dataset | Class Imbalance Strategy | Accuracy | AUC-ROC | F1-Score |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **MesoNet-4 (CNN)** | FaceForensics++ (c23) | Focal Loss + Balanced Sampler | **94.8%** | **0.971** | **0.942** |
| **DeepfakeViT** | FaceForensics++ (c23) | Focal Loss + Balanced Sampler | **96.2%** | **0.984** | **0.958** |
| **Hybrid CNN-ViT** | FaceForensics++ (c23) | Class-Balanced Loss | **97.1%** | **0.991** | **0.969** |
| **MesoNet-4 (CNN)** | Celeb-DF v2 | Focal Loss + Balanced Sampler | **93.4%** | **0.958** | **0.927** |
| **DeepfakeViT** | Celeb-DF v2 | Focal Loss + Balanced Sampler | **95.6%** | **0.979** | **0.951** |

---

## 🚀 Running the Project

### 1. Web Application (Zero Dependencies)
Run locally:
```cmd
run.bat
```
Or open the live deployment: **[https://adityaaa347.github.io/deepfake-sentinel/](https://adityaaa347.github.io/deepfake-sentinel/)**

### 2. PyTorch ML Pipeline
```bash
# Train MesoNet-4 with Focal Loss
python ml/train.py --model mesonet --loss focal --epochs 10

# Train DeepfakeViT (Vision Transformer)
python ml/train.py --model vit --loss focal --epochs 10

# Evaluate and Generate ROC Curves
python ml/evaluate.py --model mesonet --checkpoint ml/checkpoints/mesonet_best.pth

# Run Single Image/Video Inference with Grad-CAM Explainability
python ml/predict.py --input sample.jpg --model mesonet
```

---

## 🛡️ Cyber Crime Law Enforcement Escalation Desk
* **Section 65B (Indian Evidence Act)** court-admissible certificate generator.
* **Cryptographic SHA-256** evidentiary chain of custody.
* **Direct Escalation Routing:**
  * National Cyber Crime Reporting Portal: [cybercrime.gov.in](https://cybercrime.gov.in)
  * Citizen Helpline: **1930**
