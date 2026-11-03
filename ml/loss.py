"""
SIH 2024 - SIH1683: Deepfake Detection Assistant (Veritas Sentinel)
Class Imbalance Mitigation Module
Author: Aditya Majumdar (Group G011)

In benchmark face-swap datasets (such as Celeb-DF v2 with ~590 real vs 5,639 fake videos,
a ~1:10 imbalance ratio), standard Binary Cross-Entropy yields skewed decision boundaries
and excessive false-positive rates.

This module implements three mathematical techniques to resolve class imbalance:
1. Focal Loss (Lin et al.): Down-weights easily classified examples (gamma) and balances
   positive/negative frequencies (alpha).
2. Class-Balanced Loss (Cui et al., CVPR 2019): Formulates weights using the 'effective number'
   of samples (En = (1 - beta^n) / (1 - beta)).
3. Weighted Random Batch Sampler: Re-samples minority instances to achieve 1:1 batch parity.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import WeightedRandomSampler


class FocalLoss(nn.Module):
    """
    Focal Loss for Dense Face-Swap Classification.
    FL(p_t) = -alpha_t * (1 - p_t)^gamma * log(p_t)
    
    Args:
        alpha (float): Balancing factor for class 1 vs class 0 (default: 0.25).
        gamma (float): Focusing parameter for hard vs easy examples (default: 2.0).
        reduction (str): 'mean', 'sum', or 'none'.
    """
    def __init__(self, alpha=0.25, gamma=2.0, reduction='mean'):
        super(FocalLoss, self).__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.reduction = reduction

    def forward(self, inputs, targets):
        """
        inputs: raw logits [B, 1] or [B]
        targets: binary targets (0=Real, 1=Fake) [B, 1] or [B]
        """
        inputs = inputs.view(-1)
        targets = targets.view(-1).float()

        # Binary Cross Entropy with logits
        bce_loss = F.binary_cross_entropy_with_logits(inputs, targets, reduction='none')

        # Compute p_t
        p = torch.sigmoid(inputs)
        p_t = p * targets + (1 - p) * (1 - targets)

        # Compute alpha_t
        if self.alpha is not None:
            alpha_t = self.alpha * targets + (1 - self.alpha) * (1 - targets)
        else:
            alpha_t = 1.0

        # Modulating factor: (1 - p_t)^gamma
        modulating_factor = (1.0 - p_t) ** self.gamma

        focal_loss = alpha_t * modulating_factor * bce_loss

        if self.reduction == 'mean':
            return focal_loss.mean()
        elif self.reduction == 'sum':
            return focal_loss.sum()
        else:
            return focal_loss


class ClassBalancedLoss(nn.Module):
    """
    Class-Balanced Loss based on Effective Number of Samples (Cui et al.).
    Weights = (1 - beta) / (1 - beta^N_y)
    
    Args:
        samples_per_cls (list): Number of samples per class [N_real, N_fake].
        beta (float): Hyperparameter controlling effective volume scale (default: 0.999).
        gamma (float): Optional focal focusing parameter (default: 2.0).
    """
    def __init__(self, samples_per_cls, beta=0.999, gamma=2.0):
        super(ClassBalancedLoss, self).__init__()
        effective_num = [1.0 - math.pow(beta, n) for n in samples_per_cls]
        weights = [(1.0 - beta) / max(en, 1e-8) for en in effective_num]
        total_weight = sum(weights)
        self.weights = [w / total_weight * 2.0 for w in weights]  # Normalize to sum to num_classes
        self.focal = FocalLoss(alpha=self.weights[1] / (self.weights[0] + self.weights[1]), gamma=gamma)

    def forward(self, inputs, targets):
        return self.focal(inputs, targets)


def get_balanced_sampler(dataset_labels):
    """
    Constructs a PyTorch WeightedRandomSampler to achieve 1:1 balance in every training batch.
    
    Args:
        dataset_labels (list or np.array): List of target labels (0 or 1).
    Returns:
        WeightedRandomSampler
    """
    labels = list(dataset_labels)
    class_counts = [labels.count(0), labels.count(1)]
    assert class_counts[0] > 0 and class_counts[1] > 0, "Both classes must have at least one sample"

    # Invert frequency: weight = 1.0 / count
    class_weights = [1.0 / class_counts[0], 1.0 / class_counts[1]]
    sample_weights = [class_weights[label] for label in labels]
    
    sampler = WeightedRandomSampler(
        weights=sample_weights,
        num_samples=len(sample_weights),
        replacement=True
    )
    return sampler
