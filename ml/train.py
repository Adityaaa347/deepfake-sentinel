"""
SIH 2024 - SIH1683: Deepfake Detection Assistant (Veritas Sentinel)
Neural Network Training Engine
Author: Aditya Majumdar (Group G011)

Usage:
    python ml/train.py --model mesonet --loss focal --epochs 5 --batch_size 16
    python ml/train.py --model vit --loss focal --epochs 5 --batch_size 16
    python ml/train.py --model hybrid --loss class_balanced --epochs 5 --batch_size 16
"""

import os
import argparse
import time
import torch
import torch.optim as optim
from torch.utils.data import DataLoader, random_split
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score

from models import build_model
from loss import FocalLoss, ClassBalancedLoss, get_balanced_sampler
from dataset import FaceForensicsCelebDataset


def train_model(args):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print("=" * 70)
    print("  SIH 2024 - SIH1683: DEEPFAKE DETECTION ASSISTANT")
    print(f"  Training Run | Model: {args.model.upper()} | Device: {device}")
    print("=" * 70)

    # 1. Dataset & Class Imbalance Handling
    full_dataset = FaceForensicsCelebDataset(root_dir=args.data_dir, create_demo_if_empty=True)
    n_total = len(full_dataset)
    n_train = int(n_total * 0.8)
    n_val = n_total - n_train

    train_set, val_set = random_split(
        full_dataset, [n_train, n_val],
        generator=torch.Generator().manual_seed(42)
    )

    train_labels = [full_dataset.labels[i] for i in train_set.indices]
    n_real = train_labels.count(0)
    n_fake = train_labels.count(1)
    print(f"[Data Split] Total: {n_total} | Train: {n_train} (Real: {n_real}, Fake: {n_fake}) | Val: {n_val}")
    print(f"[Class Imbalance] Ratio Fake:Real = {n_fake / max(n_real, 1):.2f}:1")

    # Balanced Sampler to eliminate bias
    if args.use_sampler:
        sampler = get_balanced_sampler(train_labels)
        train_loader = DataLoader(train_set, batch_size=args.batch_size, sampler=sampler)
        print("[Sampler] WeightedRandomSampler ACTIVE - 1:1 batch class parity enforced.")
    else:
        train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True)

    val_loader = DataLoader(val_set, batch_size=args.batch_size, shuffle=False)

    # 2. Build Model Architecture
    model = build_model(args.model).to(device)
    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[Architecture] Initialized {args.model.upper()} with {total_params:,} trainable parameters.")

    # 3. Loss Function (Focal Loss / Class Balanced Loss)
    if args.loss == 'focal':
        criterion = FocalLoss(alpha=args.focal_alpha, gamma=args.focal_gamma)
        print(f"[Loss Function] Focal Loss (alpha={args.focal_alpha}, gamma={args.focal_gamma})")
    elif args.loss == 'class_balanced':
        criterion = ClassBalancedLoss(samples_per_cls=[n_real, n_fake], beta=0.999, gamma=2.0)
        print("[Loss Function] Class-Balanced Focal Loss with effective volume weighting.")
    else:
        criterion = torch.nn.BCEWithLogitsLoss()
        print("[Loss Function] Standard Binary Cross-Entropy Loss.")

    optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    # 4. Training Loop
    os.makedirs('ml/checkpoints', exist_ok=True)
    best_auc = 0.0

    for epoch in range(1, args.epochs + 1):
        start_time = time.time()
        model.train()
        running_loss = 0.0

        for batch_idx, (inputs, targets) in enumerate(train_loader):
            inputs, targets = inputs.to(device), targets.to(device)
            optimizer.zero_grad()

            logits = model(inputs).view(-1)
            loss = criterion(logits, targets)
            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)

        epoch_loss = running_loss / len(train_set)
        scheduler.step()

        # Validation Step
        model.eval()
        val_targets = []
        val_preds = []
        val_probs = []

        with torch.no_grad():
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                logits = model(inputs).view(-1)
                probs = torch.sigmoid(logits)

                val_probs.extend(probs.cpu().numpy())
                val_preds.extend((probs >= 0.5).cpu().numpy().astype(int))
                val_targets.extend(targets.cpu().numpy().astype(int))

        val_acc = accuracy_score(val_targets, val_preds)
        val_f1 = f1_score(val_targets, val_preds, zero_division=0)
        try:
            val_auc = roc_auc_score(val_targets, val_probs)
        except Exception:
            val_auc = 0.5

        elapsed = time.time() - start_time
        print(f"Epoch [{epoch:02d}/{args.epochs:02d}] ({elapsed:.1f}s) | "
              f"Train Loss: {epoch_loss:.4f} | Val Acc: {val_acc * 100:.2f}% | "
              f"Val F1: {val_f1:.4f} | Val AUC: {val_auc:.4f}")

        # Checkpoint Best Model
        if val_auc > best_auc:
            best_auc = val_auc
            checkpoint_path = f'ml/checkpoints/{args.model}_best.pth'
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'val_auc': val_auc,
                'val_acc': val_acc,
                'args': vars(args)
            }, checkpoint_path)
            print(f"       -> Checkpoint saved: {checkpoint_path} (AUC: {best_auc:.4f})")

    print("=" * 70)
    print(f"  Training Complete! Peak Validation AUC-ROC: {best_auc:.4f}")
    print("=" * 70)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="SIH1683 Deepfake Classifier Training")
    parser.add_argument('--model', type=str, default='mesonet', choices=['mesonet', 'vit', 'hybrid'])
    parser.add_argument('--loss', type=str, default='focal', choices=['focal', 'class_balanced', 'bce'])
    parser.add_argument('--focal_alpha', type=float, default=0.25)
    parser.add_argument('--focal_gamma', type=float, default=2.0)
    parser.add_argument('--use_sampler', action='store_true', default=True)
    parser.add_argument('--epochs', type=int, default=3)
    parser.add_argument('--batch_size', type=int, default=16)
    parser.add_argument('--lr', type=float, default=1e-4)
    parser.add_argument('--data_dir', type=str, default=None)

    args = parser.parse_args()
    train_model(args)
