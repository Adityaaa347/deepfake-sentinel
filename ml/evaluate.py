"""
SIH 2024 - SIH1683: Deepfake Detection Assistant (Veritas Sentinel)
Model Evaluation & Benchmark Verification Suite
Author: Aditya Majumdar (Group G011)

Usage:
    python ml/evaluate.py --model mesonet --checkpoint ml/checkpoints/mesonet_best.pth
"""

import os
import argparse
import numpy as np
import torch
from torch.utils.data import DataLoader
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, roc_curve
)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from models import build_model
from dataset import FaceForensicsCelebDataset


def evaluate_model(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print("=" * 70)
    print("  SIH 2024 - SIH1683: EVALUATION & BENCHMARK SUITE")
    print(f"  Target Architecture: {args.model.upper()} | Device: {device}")
    print("=" * 70)

    # 1. Load Dataset
    test_dataset = FaceForensicsCelebDataset(root_dir=args.data_dir, split='val', create_demo_if_empty=True)
    test_loader = DataLoader(test_dataset, batch_size=args.batch_size, shuffle=False)

    # 2. Build Model & Load Checkpoint
    model = build_model(args.model).to(device)
    if args.checkpoint and os.path.exists(args.checkpoint):
        checkpoint = torch.load(args.checkpoint, map_location=device)
        if 'model_state_dict' in checkpoint:
            model.load_state_dict(checkpoint['model_state_dict'])
        else:
            model.load_state_dict(checkpoint)
        print(f"[Checkpoint] Successfully loaded weights from: {args.checkpoint}")
    else:
        print("[Notice] Running evaluation with initialized baseline model.")

    model.eval()

    y_true = []
    y_pred = []
    y_prob = []

    with torch.no_grad():
        for inputs, targets in test_loader:
            inputs = inputs.to(device)
            logits = model(inputs).view(-1)
            probs = torch.sigmoid(logits)

            y_prob.extend(probs.cpu().numpy())
            y_pred.extend((probs >= 0.5).cpu().numpy().astype(int))
            y_true.extend(targets.numpy().astype(int))

    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    y_prob = np.array(y_prob)

    # Compute Metrics
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    auc = roc_auc_score(y_true, y_prob)
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    print("\n------------------- VERIFICATION METRICS -------------------")
    print(f"  Accuracy:         {acc * 100:.2f}%")
    print(f"  Area Under ROC:   {auc:.4f}")
    print(f"  Precision:        {prec:.4f}")
    print(f"  Recall (Sens.):   {rec:.4f}")
    print(f"  Specificity:      {spec:.4f}")
    print(f"  F1-Score:         {f1:.4f}")
    print("------------------------------------------------------------")
    print(f"  Confusion Matrix: [TN: {tn:3d} | FP: {fp:3d}]")
    print(f"                    [FN: {fn:3d} | TP: {tp:3d}]")
    print("------------------------------------------------------------\n")

    # Generate Visual ROC Curve Plot
    os.makedirs('ml/plots', exist_ok=True)
    fpr, tpr, _ = roc_curve(y_true, y_prob)

    plt.figure(figsize=(7, 6))
    plt.plot(fpr, tpr, color='#2563eb', lw=2.5, label=f'{args.model.upper()} (AUC = {auc:.3f})')
    plt.plot([0, 1], [0, 1], color='#94a3b8', lw=1.5, linestyle='--')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate (1 - Specificity)', fontsize=11)
    plt.ylabel('True Positive Rate (Sensitivity / Recall)', fontsize=11)
    plt.title(f'SIH1683 ROC Curve - {args.model.upper()} Face-Swap Classifier', fontsize=12)
    plt.legend(loc="lower right")
    plt.grid(alpha=0.3)
    roc_plot_path = f'ml/plots/{args.model}_roc_curve.png'
    plt.savefig(roc_plot_path, dpi=200, bbox_inches='tight')
    plt.close()
    print(f"[Plot Saved] ROC Curve saved to: {roc_plot_path}")

    # Generate Confusion Matrix Plot
    plt.figure(figsize=(5, 4))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title(f'Confusion Matrix ({args.model.upper()})')
    plt.colorbar()
    tick_marks = np.arange(2)
    plt.xticks(tick_marks, ['Authentic', 'Deepfake'])
    plt.yticks(tick_marks, ['Authentic', 'Deepfake'])
    
    thresh = cm.max() / 2.
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            plt.text(j, i, format(cm[i, j], 'd'),
                     ha="center", va="center",
                     color="white" if cm[i, j] > thresh else "black")
    plt.ylabel('Ground Truth')
    plt.xlabel('Predicted Label')
    cm_plot_path = f'ml/plots/{args.model}_confusion_matrix.png'
    plt.savefig(cm_plot_path, dpi=200, bbox_inches='tight')
    plt.close()
    print(f"[Plot Saved] Confusion Matrix saved to: {cm_plot_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="SIH1683 Model Evaluation")
    parser.add_argument('--model', type=str, default='mesonet', choices=['mesonet', 'vit', 'hybrid'])
    parser.add_argument('--checkpoint', type=str, default=None)
    parser.add_argument('--batch_size', type=int, default=16)
    parser.add_argument('--data_dir', type=str, default=None)

    args = parser.parse_args()
    evaluate_model(args)
