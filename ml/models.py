"""
SIH 2024 - SIH1683: AI/ML Solution for Detection of Face-Swap Based Deepfake Videos
Project: Deepfake Detection Assistant (Veritas Sentinel)
Author: Aditya Majumdar (Group G011)

This module implements two foundational neural architectures for face-swap deepfake detection:
1. MesoNet-4 (CNN): Specialized convolutional neural network focusing on mesoscopic facial
   features, compression artifacts, and blending boundaries (Afchar et al.).
2. DeepfakeViT (Vision Transformer): Pure self-attention architecture operating on 16x16 image patches
   to identify global spatial incoherence and facial landmark misalignments.
3. HybridCNNViT: Dual-stream model combining local CNN edge/texture descriptors with global ViT self-attention.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


# ==============================================================================
# 1. MesoNet-4 Architecture (CNN for Face-Swap Artifact Detection)
# ==============================================================================
class Meso4(nn.Module):
    """
    MesoNet-4 classifier engineered for mesoscopic forensic analysis of face crops.
    Architecture: 4 Convolutional layers with Batch Normalization and Max-Pooling,
    followed by 2 Dense layers with Dropout for regularization.
    """
    def __init__(self, num_classes=1):
        super(Meso4, self).__init__()
        self.conv1 = nn.Conv2d(3, 8, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm2d(8)
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)

        self.conv2 = nn.Conv2d(8, 8, kernel_size=5, padding=2)
        self.bn2 = nn.BatchNorm2d(8)
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)

        self.conv3 = nn.Conv2d(8, 16, kernel_size=5, padding=2)
        self.bn3 = nn.BatchNorm2d(16)
        self.pool3 = nn.MaxPool2d(kernel_size=2, stride=2)

        self.conv4 = nn.Conv2d(16, 16, kernel_size=5, padding=2)
        self.bn4 = nn.BatchNorm2d(16)
        self.pool4 = nn.MaxPool2d(kernel_size=4, stride=4)

        # For 224x224 input: 224 -> 112 -> 56 -> 28 -> 7 (7x7x16 = 784)
        self.fc1 = nn.Linear(16 * 7 * 7, 64)
        self.dropout = nn.Dropout(0.5)
        self.fc2 = nn.Linear(64, num_classes)

        # Hook holder for Grad-CAM
        self.gradients = None
        self.activations = None

    def activations_hook(self, grad):
        self.gradients = grad

    def forward(self, x):
        # Layer 1
        x = self.conv1(x)
        x = self.bn1(x)
        x = F.relu(x)
        x = self.pool1(x)

        # Layer 2
        x = self.conv2(x)
        x = self.bn2(x)
        x = F.relu(x)
        x = self.pool2(x)

        # Layer 3
        x = self.conv3(x)
        x = self.bn3(x)
        x = F.relu(x)
        x = self.pool3(x)

        # Layer 4 (Target for Grad-CAM explainability)
        x = self.conv4(x)
        x = self.bn4(x)
        x = F.relu(x)
        
        if x.requires_grad:
            h = x.register_hook(self.activations_hook)
        self.activations = x

        x = self.pool4(x)

        # Dense Classifier
        x = x.view(x.size(0), -1)
        x = self.fc1(x)
        x = F.relu(x)
        x = self.dropout(x)
        x = self.fc2(x)
        return x


# ==============================================================================
# 2. DeepfakeViT (Vision Transformer for Face-Swap Incoherence)
# ==============================================================================
class PatchEmbedding(nn.Module):
    """Splits image into non-overlapping patches and projects them to embedding dimension D."""
    def __init__(self, img_size=224, patch_size=16, in_channels=3, embed_dim=256):
        super(PatchEmbedding, self).__init__()
        self.img_size = img_size
        self.patch_size = patch_size
        self.n_patches = (img_size // patch_size) ** 2

        self.projection = nn.Conv2d(
            in_channels, embed_dim, kernel_size=patch_size, stride=patch_size
        )

    def forward(self, x):
        # x: [B, 3, 224, 224] -> [B, embed_dim, 14, 14] -> [B, 196, embed_dim]
        x = self.projection(x)
        x = x.flatten(2).transpose(1, 2)
        return x


class MultiHeadSelfAttention(nn.Module):
    """Multi-Head Self-Attention mechanism with attention weight capture for explainability."""
    def __init__(self, embed_dim=256, num_heads=8, dropout=0.1):
        super(MultiHeadSelfAttention, self).__init__()
        self.embed_dim = embed_dim
        self.num_heads = num_heads
        self.head_dim = embed_dim // num_heads
        assert self.head_dim * num_heads == embed_dim, "embed_dim must be divisible by num_heads"

        self.qkv_projection = nn.Linear(embed_dim, embed_dim * 3)
        self.out_projection = nn.Linear(embed_dim, embed_dim)
        self.dropout = nn.Dropout(dropout)
        self.last_attn_weights = None

    def forward(self, x):
        B, N, C = x.shape
        qkv = self.qkv_projection(x).reshape(B, N, 3, self.num_heads, self.head_dim).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]

        # Scaled Dot-Product Attention: Softmax(Q * K^T / sqrt(d_k))
        attn_scores = (q @ k.transpose(-2, -1)) / math.sqrt(self.head_dim)
        attn_weights = F.softmax(attn_scores, dim=-1)
        self.last_attn_weights = attn_weights.detach()
        attn_weights = self.dropout(attn_weights)

        out = (attn_weights @ v).transpose(1, 2).reshape(B, N, C)
        out = self.out_projection(out)
        return out


class TransformerBlock(nn.Module):
    """Pre-LN Transformer Encoder Block with MHSA and MLP feed-forward."""
    def __init__(self, embed_dim=256, num_heads=8, mlp_ratio=4.0, dropout=0.1):
        super(TransformerBlock, self).__init__()
        self.norm1 = nn.LayerNorm(embed_dim)
        self.attn = MultiHeadSelfAttention(embed_dim, num_heads=num_heads, dropout=dropout)
        self.norm2 = nn.LayerNorm(embed_dim)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, int(embed_dim * mlp_ratio)),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(int(embed_dim * mlp_ratio), embed_dim),
            nn.Dropout(dropout),
        )

    def forward(self, x):
        x = x + self.attn(self.norm1(x))
        x = x + self.mlp(self.norm2(x))
        return x


class DeepfakeViT(nn.Module):
    """
    Vision Transformer (ViT) model tailored for face-swap deepfake detection.
    Processes facial patches to capture long-range landmark inconsistencies (e.g. eye-jaw distance,
    skin tone mismatch, lighting angle discrepancy).
    """
    def __init__(self, img_size=224, patch_size=16, in_channels=3, embed_dim=256,
                 depth=6, num_heads=8, mlp_ratio=4.0, num_classes=1, dropout=0.1):
        super(DeepfakeViT, self).__init__()
        self.patch_embed = PatchEmbedding(img_size, patch_size, in_channels, embed_dim)
        num_patches = self.patch_embed.n_patches

        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, embed_dim))
        self.pos_dropout = nn.Dropout(dropout)

        self.blocks = nn.ModuleList([
            TransformerBlock(embed_dim, num_heads, mlp_ratio, dropout)
            for _ in range(depth)
        ])

        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)

        # Initialize weights
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x):
        B = x.shape[0]
        x = self.patch_embed(x)  # [B, 196, embed_dim]

        cls_tokens = self.cls_token.expand(B, -1, -1)
        x = torch.cat((cls_tokens, x), dim=1)  # [B, 197, embed_dim]
        x = self.pos_dropout(x + self.pos_embed)

        for block in self.blocks:
            x = block(x)

        x = self.norm(x)
        cls_rep = x[:, 0]  # [CLS] token representation
        logits = self.head(cls_rep)
        return logits

    def get_attention_map(self):
        """Returns the self-attention map of the final transformer block for explainability."""
        if len(self.blocks) > 0 and self.blocks[-1].attn.last_attn_weights is not None:
            # Average attention weights across all heads: [B, 197, 197]
            attn = self.blocks[-1].attn.last_attn_weights.mean(dim=1)
            # CLS token attention to image patches: [B, 196] -> reshape to [B, 14, 14]
            cls_attn = attn[:, 0, 1:].reshape(-1, 14, 14)
            return cls_attn
        return None


# ==============================================================================
# 3. Hybrid CNN-ViT Dual Stream Classifier
# ==============================================================================
class HybridCNNViT(nn.Module):
    """
    State-of-the-Art Dual-Stream Hybrid:
    - CNN Stream captures high-frequency edge, noise, and compression artifacts.
    - ViT Stream captures global semantic consistency and lighting coherence.
    - Fusion Layer produces the combined deepfake probability score.
    """
    def __init__(self, num_classes=1):
        super(HybridCNNViT, self).__init__()
        self.cnn_stream = Meso4(num_classes=64)
        self.vit_stream = DeepfakeViT(embed_dim=192, depth=4, num_heads=6, num_classes=64)
        self.fusion = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        cnn_feat = F.relu(self.cnn_stream(x))
        vit_feat = F.relu(self.vit_stream(x))
        fused = torch.cat((cnn_feat, vit_feat), dim=1)
        return self.fusion(fused)


def build_model(model_name="mesonet", num_classes=1):
    """Model factory helper function."""
    model_name = model_name.lower()
    if model_name in ["meso", "mesonet", "meso4"]:
        return Meso4(num_classes=num_classes)
    elif model_name in ["vit", "deepfakevit", "transformer"]:
        return DeepfakeViT(num_classes=num_classes)
    elif model_name in ["hybrid", "cnn_vit", "dual_stream"]:
        return HybridCNNViT(num_classes=num_classes)
    else:
        raise ValueError(f"Unknown model name: {model_name}. Choose from: mesonet, vit, hybrid")
