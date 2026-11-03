"""
SIH 2024 - SIH1683: Deepfake Detection Assistant (Veritas Sentinel)
Inference & Explainability Prediction Script
Author: Aditya Majumdar (Group G011)

Usage:
    python ml/predict.py --input path/to/image.jpg --model mesonet
    python ml/predict.py --input path/to/video.mp4 --model vit
"""

import os
import argparse
import json
import cv2
import numpy as np
import torch
from torchvision import transforms
from PIL import Image

from models import build_model
from explainability import explain_prediction


def run_inference(image_path, model_name='mesonet', checkpoint_path=None, output_cam='output_cam.jpg'):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    # Load Model
    model = build_model(model_name).to(device)
    if checkpoint_path and os.path.exists(checkpoint_path):
        chk = torch.load(checkpoint_path, map_location=device)
        model.load_state_dict(chk.get('model_state_dict', chk))
        print(f"[Model] Loaded weights from: {checkpoint_path}")
    model.eval()

    # Preprocess Image
    if not os.path.exists(image_path):
        # Generate demo synthetic face for immediate CLI testing
        print(f"[Notice] File {image_path} not found. Running inference on synthetic face-swap sample.")
        img_np = np.ones((224, 224, 3), dtype=np.uint8) * 160
        img_np[64:160, 64:160, :] = (img_np[64:160, 64:160, :] * 0.85).astype(np.uint8)
        img_pil = Image.fromarray(img_np)
    else:
        img_pil = Image.open(image_path).convert('RGB')
        img_np = np.array(img_pil.resize((224, 224)))

    transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
    ])
    input_tensor = transform(img_pil).unsqueeze(0).to(device)
    input_tensor.requires_grad = True

    # Run Prediction & Explainability
    if model_name == 'mesonet':
        explanation = explain_prediction(model, input_tensor, img_np)
        cv2.imwrite(output_cam, cv2.cvtColor(explanation['overlay'], cv2.COLOR_RGB2BGR))
        print(f"[Explainability] Grad-CAM heatmap saved to: {output_cam}")
    else:
        with torch.no_grad():
            logit = model(input_tensor).view(-1)
            prob = torch.sigmoid(logit).item()
        explanation = {
            "probability": float(prob),
            "confidence_pct": round(prob * 100, 2),
            "label": "DEEPFAKE" if prob >= 0.5 else "AUTHENTIC",
            "focal_region": "Patch Self-Attention Inconsistency" if prob >= 0.5 else "Uniform Landmark Consistency"
        }

    print("\n================== INFERENCE RESULT ==================")
    print(f"  Classification:     {explanation['label']}")
    print(f"  Probability Score:  {explanation['probability']:.4f} ({explanation['confidence_pct']}%)")
    print(f"  Focal Diagnostic:   {explanation['focal_region']}")
    print("======================================================")

    return explanation


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run Deepfake Detection Inference")
    parser.add_argument('--input', type=str, default='sample.jpg')
    parser.add_argument('--model', type=str, default='mesonet', choices=['mesonet', 'vit', 'hybrid'])
    parser.add_argument('--checkpoint', type=str, default=None)
    parser.add_argument('--output_cam', type=str, default='ml/plots/gradcam_output.jpg')

    args = parser.parse_args()
    os.makedirs('ml/plots', exist_ok=True)
    run_inference(args.input, args.model, args.checkpoint, args.output_cam)
