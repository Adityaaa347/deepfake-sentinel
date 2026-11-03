"""
SIH 2024 - SIH1683: Deepfake Detection Assistant (Veritas Sentinel)
FaceForensics++ and Celeb-DF Dataset Pipeline
Author: Aditya Majumdar (Group G011)

This module implements data ingestion, face alignment/cropping, and augmentation
specifically targeted for the two benchmark datasets identified in the problem statement:
1. FaceForensics++ (FF++): Deepfakes, Face2Face, FaceSwap, NeuralTextures.
2. Celeb-DF (v2): High-quality celebrity deepfakes with challenging class imbalance.
"""

import os
import glob
import cv2
import numpy as np
import torch
from torch.utils.data import Dataset
from torchvision import transforms
from PIL import Image


# Standard ImageNet normalization for deep feature backbones
TRANSFORM_TRAIN = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

TRANSFORM_VAL = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])


class FaceForensicsCelebDataset(Dataset):
    """
    Unified Dataset loader for FaceForensics++ and Celeb-DF face crops.
    
    Structure expected:
        data_root/
            real/
                *.jpg / *.png
            fake/
                *.jpg / *.png
    """
    def __init__(self, root_dir=None, split='train', transform=None, create_demo_if_empty=True):
        self.transform = transform if transform is not None else (TRANSFORM_TRAIN if split == 'train' else TRANSFORM_VAL)
        self.samples = []  # tuples of (image_path_or_array, label)

        if root_dir and os.path.exists(root_dir):
            real_dir = os.path.join(root_dir, 'real')
            fake_dir = os.path.join(root_dir, 'fake')

            real_files = glob.glob(os.path.join(real_dir, '*.[jp][pn]g'))
            fake_files = glob.glob(os.path.join(fake_dir, '*.[jp][pn]g'))

            for path in real_files:
                self.samples.append((path, 0))  # 0 = Authentic
            for path in fake_files:
                self.samples.append((path, 1))  # 1 = Deepfake

        # Fallback: create procedural synthetic dataset for evaluation/testing if no files present
        if len(self.samples) == 0 and create_demo_if_empty:
            print("[Dataset] No local raw FaceForensics++/Celeb-DF files found at specified path.")
            print("[Dataset] Initializing simulated FaceForensics++ / Celeb-DF evaluation split (100 real, 300 fake - demonstrating 1:3 class imbalance)...")
            self._create_procedural_samples(n_real=100, n_fake=300)

    def _create_procedural_samples(self, n_real=100, n_fake=300):
        """Generates synthetic face-swap simulation matrices with authentic skin noise vs synthetic warping."""
        np.random.seed(42)
        for i in range(n_real):
            # Real face simulation: smooth coherent Gaussian noise + natural color gradients
            arr = np.ones((224, 224, 3), dtype=np.uint8) * 160
            noise = np.random.normal(0, 12, (224, 224, 3)).astype(np.int16)
            arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
            self.samples.append((arr, 0))

        for i in range(n_fake):
            # Fake face-swap simulation: central boundary seam + inconsistent compression
            arr = np.ones((224, 224, 3), dtype=np.uint8) * 160
            noise = np.random.normal(0, 24, (224, 224, 3)).astype(np.int16)
            arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
            # Add synthetic face-swap blending seam in central boundary (64 to 160)
            arr[64:160, 64:160, :] = (arr[64:160, 64:160, :] * 0.85).astype(np.uint8)
            self.samples.append((arr, 1))

    @property
    def labels(self):
        return [s[1] for s in self.samples]

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        item, label = self.samples[idx]
        if isinstance(item, str):
            img = Image.open(item).convert('RGB')
        else:
            img = Image.fromarray(item)

        if self.transform:
            tensor = self.transform(img)
        else:
            tensor = transforms.ToTensor()(img)

        return tensor, torch.tensor(label, dtype=torch.float32)


def extract_face_crops_from_video(video_path, output_dir=None, max_frames=30):
    """
    Extracts aligned facial crops from an uploaded MP4/AVI video using OpenCV Haar Cascade.
    """
    cap = cv2.VideoCapture(video_path)
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    crops = []
    frame_idx = 0

    while cap.isOpened() and len(crops) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        frame_idx += 1
        if frame_idx % 3 != 0:  # Sample every 3rd frame
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))

        for (x, y, w, h) in faces:
            # Expand bounding box by 15% to capture facial blending boundary
            pad_x = int(w * 0.15)
            pad_y = int(h * 0.15)
            x1 = max(0, x - pad_x)
            y1 = max(0, y - pad_y)
            x2 = min(frame.shape[1], x + w + pad_x)
            y2 = min(frame.shape[0], y + h + pad_y)

            crop = frame[y1:y2, x1:x2]
            crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            crop_resized = cv2.resize(crop_rgb, (224, 224))
            crops.append(crop_resized)
            break

    cap.release()
    return crops
