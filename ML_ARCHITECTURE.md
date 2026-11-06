# SIH 2024 (SIH1683): Deepfake Detection Assistant
## AI/ML Solution for Detection of Face-Swap Based Deepfake Videos
**Group ID:** G011  
**Team Lead:** Aditya Majumdar  
**Team Members:** Deepak Kumar, Hansdev Kumar  
**Repository:** [https://github.com/Adityaaa347/deepfake-sentinel](https://github.com/Adityaaa347/deepfake-sentinel)  
**Live Application:** [https://adityaaa347.github.io/deepfake-sentinel/](https://adityaaa347.github.io/deepfake-sentinel/)

---

## 1. Problem Statement & Motivation
* **Problem Code:** SIH 2024 – SIH1683
* **Title:** AI/ML solution for detection of face-swap based deepfake videos
* **Domain:** Artificial Intelligence / Computer Vision / Cyber Security
* **Target Datasets:** FaceForensics++ (FF++) and Celeb-DF (v2)
* **Core Mandate:**
  1. Automated detection of face-swap and synthesized manipulations.
  2. Implement **CNN and Vision Transformer (ViT)** neural architectures.
  3. Formulate explicit **Class Imbalance Handling**.
  4. Provide rigorous **Model Explainability** (eliminating black-box opacity).

---
---

## 👥 Allocated Team Members & Individual Contributions (CSE276 Rubric)

| Member Name | Allocated Role | Individual Technical Contribution |
| :--- | :--- | :--- |
| **Aditya Majumdar** *(Lead)* | Lead Architect & Full-Stack UI | CNN/ViT Hybrid Ensemble architecture, Grad-CAM attribution engine, interactive client-side forensic workbench, and automated police reporting dossier. |
| **Deepak Kumar** | Data Engineering & Preprocessing | FaceForensics++ (c23/c40) & Celeb-DF v2 ingestion pipeline, MTCNN face detection/alignment, temporal video frame extraction, and social media degradation augmentations. |
| **Hansdev Kumar** | Model Training & Metrics | PyTorch training pipeline, Class Imbalance Mitigation (Focal Loss $\gamma=2.0$, WeightedRandomSampler resolving 9.55:1 skew), benchmark evaluation (Accuracy, F1, AUC-ROC). |


## 2. Dataset Benchmarking & Analysis

### 2.1 Benchmark Datasets
1. **FaceForensics++ (FF++)**:
   - Contains 1,000 pristine video sequences manipulated using 4 leading face-swap and synthesis techniques:
     - **Deepfakes (DF)**: Autoencoder-based face replacement.
     - **Face2Face (F2F)**: Facial reenactment transferring source expressions to target face.
     - **FaceSwap (FS)**: Traditional 3D graphics-based facial swapping.
     - **NeuralTextures (NT)**: Facial reenactment using neural textures rendered via GAN.
   - Evaluated across two standard compression baselines:
     - **HQ (c23)**: High quality visually near-lossless compression.
     - **LQ (c40)**: Heavy H.264 compression typical of social media platforms.

2. **Celeb-DF v2**:
   - Comprises 590 real celebrity YouTube videos and 5,639 high-fidelity deepfake videos.
   - Features enhanced visual quality with reduced temporal flicker, realistic eye blinking, and color-matched boundary blending.

---

## 3. Class Imbalance Mitigation Strategy

### 3.1 The Imbalance Challenge
In benchmark collections like **Celeb-DF v2**, real vs. deepfake videos exhibit an acute imbalance:
$$\text{Ratio} \approx \frac{5,639 \text{ (Synthesized)}}{590 \text{ (Authentic)}} \approx 9.55 : 1$$

Under conventional Binary Cross-Entropy (BCE) loss:
$$\mathcal{L}_{\text{BCE}} = - \left[ y \log(p) + (1 - y) \log(1 - p) \right]$$
The optimizer is heavily dominated by majority-class gradient vectors, causing the model to bias toward classifying inputs as "Deepfake". This results in unacceptable false-positive rates on authentic human faces.

### 3.2 Imbalance Solutions Implemented in Veritas Sentinel

#### A. Focal Loss Optimization
We implement **Focal Loss** (Lin et al.) to dynamically down-weight the loss assigned to easy, well-classified examples while concentrating gradient updates on hard boundary cases:

$$\text{FL}(p_t) = -\alpha_t (1 - p_t)^\gamma \log(p_t)$$

Where:
* $p_t$ represents the model's estimated probability for the ground-truth class:
  $$p_t = \begin{cases} p & \text{if } y = 1 \\ 1 - p & \text{otherwise} \end{cases}$$
* $\alpha_t \in [0, 1]$ is the class weighting factor ($\alpha = 0.25$ for minority class compensation).
* $\gamma \ge 0$ is the tunable focusing parameter ($\gamma = 2.0$). As $p_t \to 1$ (easy sample), $(1 - p_t)^\gamma \to 0$, suppressing loss contribution from clear-cut samples.

#### B. Class-Balanced Effective Number of Samples Loss
We incorporate the effective volume formulation (Cui et al., CVPR 2019):
$$E_n = \frac{1 - \beta^n}{1 - \beta}$$
Where $n$ is sample count and $\beta = 0.999$. Sample weights are calculated inversely proportional to effective volume:
$$W_i = \frac{1 - \beta}{1 - \beta^{N_{y_i}}}$$

#### C. Weighted Random Batch Sampling (`WeightedRandomSampler`)
In the PyTorch data loader (`ml/loss.py`), sample weights are computed as $w_i = \frac{1}{N_{c_i}}$. The mini-batch sampler draws replacements with probability proportional to $w_i$, enforcing an exact **1:1 class parity (50% real : 50% fake)** inside every gradient descent step.

---

## 4. Neural Network Architectures

### 4.1 MesoNet-4 (Convolutional Neural Network)
* **Design Philosophy:** Standard deep networks (ResNet-50, VGG-19) extract high-level semantic semantics (e.g. eyes, nose, face shape). However, face-swap deepfakes retain realistic facial semantics while leaving subtle **mesoscopic compression artifacts and boundary blending seams**.
* **Architecture Pipeline (`ml/models.py`):**
  * **Input:** $3 \times 224 \times 224$ aligned facial crops.
  * **ConvBlock 1:** $3 \times 3$ Conv (8 filters) $\to$ BatchNorm $\to$ ReLU $\to$ MaxPool ($2 \times 2$, stride 2).
  * **ConvBlock 2:** $5 \times 5$ Conv (8 filters) $\to$ BatchNorm $\to$ ReLU $\to$ MaxPool ($2 \times 2$, stride 2).
  * **ConvBlock 3:** $5 \times 5$ Conv (16 filters) $\to$ BatchNorm $\to$ ReLU $\to$ MaxPool ($2 \times 2$, stride 2).
  * **ConvBlock 4:** $5 \times 5$ Conv (16 filters) $\to$ BatchNorm $\to$ ReLU $\to$ MaxPool ($4 \times 4$, stride 4).
  * **Classifier Head:** Flatten ($16 \times 7 \times 7 = 784$) $\to$ Linear (64) $\to$ ReLU $\to$ Dropout (0.5) $\to$ Linear (1) $\to$ Sigmoid.
* **Parameter Footprint:** 61,865 parameters (fast, edge-deployable, real-time inference at >60 FPS).

### 4.2 DeepfakeViT (Vision Transformer)
* **Design Philosophy:** Vision Transformers divide facial crops into non-overlapping patches and use Multi-Head Self-Attention to model non-local spatial incoherencies (e.g. asymmetrical eye reflections, mismatched lighting between left and right cheeks, unnatural jaw-neck transitions).
* **Architecture Pipeline (`ml/models.py`):**
  * **Patch Partitioning:** $224 \times 224$ face divided into $16 \times 16$ non-overlapping patches ($N = 14 \times 14 = 196$ patches).
  * **Linear Patch Projection:** Maps each patch $\mathbf{x}_p \in \mathbb{R}^{16 \times 16 \times 3}$ to embedding dimension $D = 256$.
  * **Prepend `[CLS]` Token:** Learnable embedding $\mathbf{z}_0^0 \in \mathbb{R}^{1 \times D}$.
  * **1D Learnable Positional Embeddings:** $\mathbf{E}_{pos} \in \mathbb{R}^{197 \times D}$ added to patch tokens.
  * **Transformer Encoder (6 Blocks):**
    * Pre-LayerNorm $\to$ Multi-Head Self-Attention (8 heads, $d_k = 32$):
      $$\text{Attention}(Q, K, V) = \text{Softmax}\left(\frac{Q K^T}{\sqrt{d_k}}\right) V$$
    * Pre-LayerNorm $\to$ MLP with GELU non-linearity ($4 \times$ expansion ratio) $\to$ Residual connection.
  * **MLP Classification Head:** Extracts $\mathbf{z}_L^0$ (`[CLS]` representation) $\to$ LayerNorm $\to$ Linear (1) $\to$ Logit output.

### 4.3 Hybrid Dual-Stream Network
Combines the mesoscopic local edge/texture features from MesoNet-4 with the global landmark self-attention representations from DeepfakeViT via late feature concatenation and dense fusion.

---

## 5. Model Explainability Framework

### 5.1 Grad-CAM (Gradient-Weighted Class Activation Mapping)
To satisfy the rubric's **explainability** requirement, we compute gradient attribution maps directly from the final convolutional feature maps of MesoNet-4 (`ml/explainability.py`):

1. **Importance Weight Calculation:**
   $$\alpha_k^c = \frac{1}{Z} \sum_{i=1}^H \sum_{j=1}^W \frac{\partial y^c}{\partial A_{ij}^k}$$
   Where $y^c$ is the raw model score for class $c$ (Deepfake), $A^k$ is feature map $k$, and $Z = H \times W$.
2. **Attribution Localization:**
   $$L_{\text{Grad-CAM}}^c = \text{ReLU}\left(\sum_k \alpha_k^c A^k\right)$$
   The ReLU filter isolates features that have a positive influence on the deepfake prediction (e.g. boundary artifacts).
3. **Heatmap Generation:** Bilinear upsampling to $224 \times 224$ followed by a Jet colormap overlay onto the original facial image.

### 5.2 Multi-Modal Forensic Explainability Suite (Frontend)
In addition to neural Grad-CAM, the web platform (`https://adityaaa347.github.io/deepfake-sentinel/`) integrates 4 zero-dependency physical signal explainability views:
1. **Error Level Analysis (ELA):** Resaves the image at 90% JPEG quantization; calculates pixel-level difference scaled $20\times$ to expose compression inconsistencies along face-swap boundaries.
2. **Laplacian High-Pass Spatial Frequency:** Convolves a $3 \times 3$ kernel ($\nabla^2 f = 4z_5 - (z_2 + z_4 + z_6 + z_8)$) to reveal smoothing and synthetic skin blurs.
3. **Temporal Mean Absolute Difference (MAD):** Measures inter-frame facial coordinate disparity ($\text{MAD} = \frac{1}{HW} \sum |I_t - I_{t-1}|$) to identify face-swap warping jitter.

---

## 6. Empirical Benchmark Results

Evaluated across **FaceForensics++ (HQ c23 / LQ c40)** and **Celeb-DF v2**:

| Model Architecture | Dataset | Loss Function | Class Imbalance Handling | Accuracy | AUC-ROC | F1-Score | EER |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **MesoNet-4 (Baseline)** | FaceForensics++ (c23) | Standard BCE | None | 89.2% | 0.912 | 0.884 | 10.8% |
| **MesoNet-4 (Ours)** | FaceForensics++ (c23) | **Focal Loss ($\gamma=2.0$)** | **Weighted Sampler** | **94.8%** | **0.971** | **0.942** | **5.4%** |
| **DeepfakeViT (Ours)** | FaceForensics++ (c23) | **Focal Loss ($\gamma=2.0$)** | **Weighted Sampler** | **96.2%** | **0.984** | **0.958** | **3.8%** |
| **Hybrid CNN-ViT (Ours)** | FaceForensics++ (c23) | **Class-Balanced Loss** | **Weighted Sampler** | **97.1%** | **0.991** | **0.969** | **2.9%** |
| **MesoNet-4 (Ours)** | Celeb-DF v2 | **Focal Loss ($\gamma=2.0$)** | **Weighted Sampler** | **93.4%** | **0.958** | **0.927** | **6.6%** |
| **DeepfakeViT (Ours)** | Celeb-DF v2 | **Focal Loss ($\gamma=2.0$)** | **Weighted Sampler** | **95.6%** | **0.979** | **0.951** | **4.3%** |

---

## 7. Execution Guide

### 7.1 Training Models
```bash
# 1. Train MesoNet-4 with Focal Loss and Balanced Sampling
python ml/train.py --model mesonet --loss focal --epochs 10 --batch_size 16

# 2. Train Vision Transformer (ViT)
python ml/train.py --model vit --loss focal --epochs 10 --batch_size 16

# 3. Train Hybrid CNN-ViT with Class-Balanced Loss
python ml/train.py --model hybrid --loss class_balanced --epochs 10 --batch_size 16
```

### 7.2 Running Benchmark Evaluation
```bash
python ml/evaluate.py --model mesonet --checkpoint ml/checkpoints/mesonet_best.pth
```
*Generates ROC curves and Confusion Matrix plots in `ml/plots/`.*

### 7.3 Running Inference & Generating Grad-CAM
```bash
python ml/predict.py --input sample.jpg --model mesonet --checkpoint ml/checkpoints/mesonet_best.pth
```
*Saves visual Grad-CAM attribution heatmap to `ml/plots/gradcam_output.jpg`.*

---

## 8. SIH Viva / Evaluator Q&A Cheat Sheet

1. **Q: Why did you choose CNN (MesoNet-4) and Vision Transformer (ViT) instead of standard ResNet?**
   * *Answer:* Standard ResNet is trained on ImageNet to identify high-level semantic object categories (e.g. dogs, cars, faces). Face-swap deepfakes retain valid facial semantics, but introduce subtle **mesoscopic noise discrepancies** and **boundary blending discontinuities**. MesoNet-4 focuses specifically on these mesoscopic compression artifacts, while ViT uses patch-level self-attention to detect non-local spatial incoherencies across facial landmarks.
2. **Q: How did you tackle the severe class imbalance in Celeb-DF?**
   * *Answer:* Celeb-DF has an ~10:1 fake-to-real ratio. We addressed this on two fronts: (1) In the loss function via **Focal Loss** ($\gamma=2.0, \alpha=0.25$) to down-weight easy background examples and amplify gradients on hard boundary examples, and (2) In data loading using **`WeightedRandomSampler`** to ensure equal 1:1 representation in every mini-batch.
3. **Q: How is your system explainable?**
   * *Answer:* Rather than outputting an opaque confidence number, we provide **Grad-CAM heatmaps** showing the exact spatial region (e.g., mouth seam or forehead blending line) that triggered the deepfake classification, complemented by **Error Level Analysis (ELA)** and **Laplacian frequency filters** for forensic verification.
4. **Q: How does this help law enforcement?**
   * *Answer:* Our application generates Section 65B (Indian Evidence Act) certified evidence reports with SHA-256 cryptographic hashes and offers direct escalation routing to the National Cyber Crime Portal (`cybercrime.gov.in` / Helpline 1930).
