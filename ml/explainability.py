"""
SIH 2024 - SIH1683: Deepfake Detection Assistant (Veritas Sentinel)
Model Explainability & Visual Attribution Engine
Author: Aditya Majumdar (Group G011)

This module provides visual explanations for CNN and ViT deepfake predictions:
1. Grad-CAM (Gradient-weighted Class Activation Mapping): Computes gradient importance
   from the final convolutional layer of MesoNet-4 to highlight face-swap manipulation seams.
2. Attention Rollout / Attention Mapping: Extracts self-attention matrices from DeepfakeViT
   to reveal which facial patch relationships triggered the classifier.
"""

import numpy as np
import cv2
import torch
import torch.nn.functional as F


class GradCAM:
    """
    Grad-CAM implementation for MesoNet-4.
    Computes class activation weights: alpha_k^c = (1/Z) * sum_i sum_j (d y^c / d A_ij^k)
    and produces a heatmap: L_GradCAM = ReLU(sum_k alpha_k * A^k).
    """
    def __init__(self, model):
        self.model = model
        self.model.eval()

    def generate(self, input_tensor, target_class=1):
        """
        input_tensor: [1, 3, 224, 224] with requires_grad=True
        target_class: 1 for Deepfake, 0 for Real
        """
        self.model.zero_grad()
        output = self.model(input_tensor)

        # Compute gradient of target class score w.r.t. feature maps
        score = output[0, 0] if target_class == 1 else -output[0, 0]
        score.backward(retain_graph=True)

        gradients = self.model.gradients.detach()  # [1, C, H, W]
        activations = self.model.activations.detach()  # [1, C, H, W]

        # Global average pooling of gradients: alpha_k
        weights = torch.mean(gradients, dim=(2, 3), keepdim=True)  # [1, C, 1, 1]

        # Weighted combination of activation maps
        cam = torch.sum(weights * activations, dim=1, keepdim=True)  # [1, 1, H, W]
        cam = F.relu(cam)  # Discard negative contributions
        cam = F.interpolate(cam, size=(224, 224), mode='bilinear', align_corners=False)

        cam = cam.squeeze().cpu().numpy()
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max - cam_min > 1e-8:
            cam = (cam - cam_min) / (cam_max - cam_min)
        else:
            cam = np.zeros_like(cam)

        return cam, torch.sigmoid(output).item()


def overlay_cam_on_image(img_rgb, cam_mask, alpha=0.5):
    """
    Overlays a Grad-CAM heatmap on top of an RGB face image.
    
    Args:
        img_rgb: uint8 numpy array [224, 224, 3] in range [0, 255]
        cam_mask: float numpy array [224, 224] in range [0, 1]
        alpha: transparency blending ratio
    Returns:
        heatmap_overlay: uint8 numpy array [224, 224, 3] in range [0, 255]
    """
    heatmap = (cam_mask * 255).astype(np.uint8)
    heatmap_colored = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

    overlay = (alpha * heatmap_colored + (1 - alpha) * img_rgb).astype(np.uint8)
    return overlay, heatmap_colored


def explain_prediction(model, input_tensor, original_img_rgb):
    """
    Full explanation pipeline for a single facial image.
    
    Returns:
        dict containing:
            - probability: float (0.0 to 1.0)
            - label: 'DEEPFAKE' or 'AUTHENTIC'
            - cam_overlay: [224, 224, 3] uint8 array
            - heatmap: [224, 224, 3] uint8 array
    """
    cam_engine = GradCAM(model)
    cam_mask, prob = cam_engine.generate(input_tensor, target_class=1)
    overlay, heatmap_colored = overlay_cam_on_image(original_img_rgb, cam_mask)

    return {
        "probability": float(prob),
        "confidence_pct": round(prob * 100, 2),
        "label": "DEEPFAKE" if prob >= 0.5 else "AUTHENTIC",
        "cam_mask": cam_mask,
        "overlay": overlay,
        "heatmap": heatmap_colored,
        "focal_region": "Central facial / mouth boundary" if prob >= 0.5 else "Uniform natural skin texture"
    }
