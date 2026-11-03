/**
 * Veritas Forensic Core - Image Analysis Module
 * Pure Vanilla JavaScript & HTML5 Canvas - Zero Dependencies
 * Implements ELA (Error Level Analysis), High-Pass Noise Spectrum,
 * YCbCr Chrominance Disparity, and Raw Binary EXIF/PNG Chunk Parsing.
 */

const ImageForensics = (function () {
  'use strict';

  // Read binary metadata from ArrayBuffer (EXIF, XMP, PNG Chunks)
  function parseMetadata(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const result = {
      format: 'Unknown',
      hasExif: false,
      hasCameraMetadata: false,
      aiMarkersFound: [],
      cameraMake: null,
      cameraModel: null,
      software: null,
      dateTime: null,
      rawChunks: [],
      verdictNote: ''
    };

    if (data.length < 8) return result;

    // 1. Check for PNG
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
      result.format = 'PNG';
      parsePngChunks(data, result);
      return result;
    }

    // 2. Check for JPEG (SOI 0xFF, 0xD8)
    if (data[0] === 0xff && data[1] === 0xd8) {
      result.format = 'JPEG';
      parseJpegMarkers(data, result);
      return result;
    }

    // 3. Check for WebP
    if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
        data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      result.format = 'WebP';
      // Search for text chunks in WebP
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const str = textDecoder.decode(data.slice(0, Math.min(data.length, 32768)));
      checkAiStringMatches(str, result);
      return result;
    }

    return result;
  }

  function checkAiStringMatches(text, result) {
    const aiSignatures = [
      { pattern: /stable diffusion/i, label: 'Stable Diffusion Generation Signature' },
      { pattern: /midjourney/i, label: 'Midjourney Prompt Metadata' },
      { pattern: /dall-e/i, label: 'DALL-E Generation Metadata' },
      { pattern: /novelai/i, label: 'NovelAI Generation Signature' },
      { pattern: /comfyui/i, label: 'ComfyUI Node Graph Data' },
      { pattern: /automatic1111/i, label: 'Automatic1111 WebUI Parameters' },
      { pattern: /flux\.1/i, label: 'FLUX.1 Diffusion Model Marker' },
      { pattern: /civitai/i, label: 'Civitai Model Hash Metadata' },
      { pattern: /checkpoint_hash|denoising_strength|cfg_scale/i, label: 'Diffusion Inference Hyperparameters' },
      { pattern: /adobe firefly/i, label: 'Adobe Firefly Generative AI Tag' }
    ];

    for (const sig of aiSignatures) {
      if (sig.pattern.test(text)) {
        if (!result.aiMarkersFound.includes(sig.label)) {
          result.aiMarkersFound.push(sig.label);
        }
      }
    }
  }

  function parsePngChunks(data, result) {
    let offset = 8;
    const textDecoder = new TextDecoder('utf-8', { fatal: false });

    while (offset < data.length - 8) {
      const length = (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
      const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
      result.rawChunks.push(type);

      const chunkDataStart = offset + 8;
      const chunkDataEnd = Math.min(chunkDataStart + length, data.length);

      if (['tEXt', 'zTXt', 'iTXt'].includes(type)) {
        const chunkSlice = data.slice(chunkDataStart, chunkDataEnd);
        const text = textDecoder.decode(chunkSlice);
        checkAiStringMatches(text, result);
        if (text.includes('parameters') || text.includes('workflow')) {
          result.aiMarkersFound.push('Embedded PNG AI Generation Parameters');
        }
      }

      offset += 12 + length;
    }
  }

  function parseJpegMarkers(data, result) {
    let offset = 2;
    const textDecoder = new TextDecoder('utf-8', { fatal: false });

    while (offset < data.length - 4) {
      if (data[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = data[offset + 1];
      if (marker === 0xd9) break; // EOI

      if (marker >= 0xe0 && marker <= 0xef) {
        const length = (data[offset + 2] << 8) | data[offset + 3];
        const segData = data.slice(offset + 4, offset + 2 + length);

        // Check APP1 Exif
        if (marker === 0xe1 && length > 6) {
          const header = String.fromCharCode(...segData.slice(0, 6));
          if (header.startsWith('Exif')) {
            result.hasExif = true;
            parseExifTiff(segData.slice(6), result);
          } else if (header.startsWith('http:/') || textDecoder.decode(segData).includes('xmp')) {
            const xmpStr = textDecoder.decode(segData);
            checkAiStringMatches(xmpStr, result);
          }
        }

        // Check general text search in APP segments for prompt parameters
        const segStr = textDecoder.decode(segData.slice(0, Math.min(segData.length, 4096)));
        checkAiStringMatches(segStr, result);

        offset += 2 + length;
      } else {
        offset += 2;
      }
    }
  }

  function parseExifTiff(tiffData, result) {
    if (tiffData.length < 8) return;
    const isLE = tiffData[0] === 0x49 && tiffData[1] === 0x49; // 'II'
    const view = new DataView(tiffData.buffer, tiffData.byteOffset, tiffData.byteLength);

    const firstIFDOffset = view.getUint32(4, isLE);
    if (firstIFDOffset >= tiffData.length - 2) return;

    try {
      const numEntries = view.getUint16(firstIFDOffset, isLE);
      let cur = firstIFDOffset + 2;

      for (let i = 0; i < numEntries && cur + 12 <= tiffData.length; i++) {
        const tag = view.getUint16(cur, isLE);
        const count = view.getUint32(cur + 4, isLE);
        const valOffset = view.getUint32(cur + 8, isLE);

        // Helper to read ASCII string
        const readAscii = (offset, len) => {
          let s = '';
          for (let j = 0; j < len && offset + j < tiffData.length; j++) {
            const c = tiffData[offset + j];
            if (c === 0) break;
            s += String.fromCharCode(c);
          }
          return s.trim();
        };

        if (tag === 0x010f) { // Make
          result.cameraMake = readAscii(valOffset, count);
          result.hasCameraMetadata = true;
        } else if (tag === 0x0110) { // Model
          result.cameraModel = readAscii(valOffset, count);
          result.hasCameraMetadata = true;
        } else if (tag === 0x0131) { // Software
          result.software = readAscii(valOffset, count);
        } else if (tag === 0x0132 || tag === 0x9003) { // DateTime / DateTimeOriginal
          result.dateTime = readAscii(valOffset, count);
        }

        cur += 12;
      }
    } catch (e) {
      // Graceful fallback for malformed EXIF
    }
  }

  // Error Level Analysis (ELA)
  // Computes pixel error delta between source image and a controlled JPEG recompression.
  function computeELA(sourceCanvas, quality = 0.88, amplification = 18) {
    return new Promise((resolve) => {
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;

      const recompressedImg = new Image();
      recompressedImg.onload = function () {
        const recompCanvas = document.createElement('canvas');
        recompCanvas.width = width;
        recompCanvas.height = height;
        const recompCtx = recompCanvas.getContext('2d');
        recompCtx.drawImage(recompressedImg, 0, 0, width, height);

        const srcCtx = sourceCanvas.getContext('2d');
        const srcData = srcCtx.getImageData(0, 0, width, height);
        const recData = recompCtx.getImageData(0, 0, width, height);

        const elaCanvas = document.createElement('canvas');
        elaCanvas.width = width;
        elaCanvas.height = height;
        const elaCtx = elaCanvas.getContext('2d');
        const elaData = elaCtx.createImageData(width, height);

        const srcPx = srcData.data;
        const recPx = recData.data;
        const outPx = elaData.data;

        let totalDelta = 0;
        let maxDelta = 0;
        const blockStats = [];
        const blockSize = 32;
        const blocksX = Math.ceil(width / blockSize);
        const blocksY = Math.ceil(height / blockSize);

        for (let by = 0; by < blocksY; by++) {
          for (let bx = 0; bx < blocksX; bx++) {
            let blockSum = 0;
            let blockCount = 0;

            const startX = bx * blockSize;
            const startY = by * blockSize;
            const endX = Math.min(startX + blockSize, width);
            const endY = Math.min(startY + blockSize, height);

            for (let y = startY; y < endY; y++) {
              for (let x = startX; x < endX; x++) {
                const i = (y * width + x) * 4;
                const dr = Math.abs(srcPx[i] - recPx[i]);
                const dg = Math.abs(srcPx[i + 1] - recPx[i + 1]);
                const db = Math.abs(srcPx[i + 2] - recPx[i + 2]);
                const avgDiff = (dr + dg + db) / 3;

                blockSum += avgDiff;
                blockCount++;
                totalDelta += avgDiff;
                if (avgDiff > maxDelta) maxDelta = avgDiff;

                // Visualized amplified ELA
                outPx[i] = Math.min(255, dr * amplification);
                outPx[i + 1] = Math.min(255, dg * amplification);
                outPx[i + 2] = Math.min(255, db * amplification);
                outPx[i + 3] = 255;
              }
            }

            if (blockCount > 0) {
              blockStats.push(blockSum / blockCount);
            }
          }
        }

        elaCtx.putImageData(elaData, 0, 0);

        const totalPixels = width * height;
        const meanDelta = totalDelta / totalPixels;

        // Calculate variance of block error levels
        let sumSquaredDiff = 0;
        for (let val of blockStats) {
          sumSquaredDiff += Math.pow(val - meanDelta, 2);
        }
        const blockVariance = blockStats.length > 0 ? sumSquaredDiff / blockStats.length : 0;
        const blockStdDev = Math.sqrt(blockVariance);

        resolve({
          canvas: elaCanvas,
          meanDelta: meanDelta,
          maxDelta: maxDelta,
          blockVariance: blockVariance,
          blockStdDev: blockStdDev
        });
      };

      recompressedImg.src = sourceCanvas.toDataURL('image/jpeg', quality);
    });
  }

  // High-Pass Filter & Laplacian Edge / Noise Variance Map
  function computeNoiseAndGradients(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext('2d');
    const srcData = srcCtx.getImageData(0, 0, width, height);
    const srcPx = srcData.data;

    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = width;
    noiseCanvas.height = height;
    const noiseCtx = noiseCanvas.getContext('2d');
    const noiseData = noiseCtx.createImageData(width, height);
    const outPx = noiseData.data;

    // 3x3 Laplacian Kernel:
    //  0  -1   0
    // -1   4  -1
    //  0  -1   0
    let totalLaplacianEnergy = 0;
    let smoothPixelCount = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        // Grayscale conversion for center and 4 neighbors
        const center = (srcPx[idx] * 0.299 + srcPx[idx + 1] * 0.587 + srcPx[idx + 2] * 0.114);
        const top = (srcPx[((y - 1) * width + x) * 4] * 0.299 + srcPx[((y - 1) * width + x) * 4 + 1] * 0.587 + srcPx[((y - 1) * width + x) * 4 + 2] * 0.114);
        const bottom = (srcPx[((y + 1) * width + x) * 4] * 0.299 + srcPx[((y + 1) * width + x) * 4 + 1] * 0.587 + srcPx[((y + 1) * width + x) * 4 + 2] * 0.114);
        const left = (srcPx[(y * width + (x - 1)) * 4] * 0.299 + srcPx[(y * width + (x - 1)) * 4 + 1] * 0.587 + srcPx[(y * width + (x - 1)) * 4 + 2] * 0.114);
        const right = (srcPx[(y * width + (x + 1)) * 4] * 0.299 + srcPx[(y * width + (x + 1)) * 4 + 1] * 0.587 + srcPx[(y * width + (x + 1)) * 4 + 2] * 0.114);

        const lap = Math.abs(4 * center - top - bottom - left - right);
        totalLaplacianEnergy += lap;

        // If laplacian is extremely close to 0 in textured areas, it indicates neural synthetic smoothing
        if (lap < 1.8) {
          smoothPixelCount++;
        }

        const vis = Math.min(255, lap * 4);
        outPx[idx] = vis;
        outPx[idx + 1] = Math.min(255, vis * 1.2);
        outPx[idx + 2] = Math.min(255, vis * 1.5);
        outPx[idx + 3] = 255;
      }
    }

    noiseCtx.putImageData(noiseData, 0, 0);

    const activePixels = (width - 2) * (height - 2);
    const meanEnergy = totalLaplacianEnergy / activePixels;
    const smoothRatio = smoothPixelCount / activePixels;

    return {
      canvas: noiseCanvas,
      meanEnergy: meanEnergy,
      smoothRatio: smoothRatio
    };
  }

  // Luminance & Chrominance Disparity Analysis (YCbCr)
  function computeChrominanceMap(sourceCanvas) {
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const srcCtx = sourceCanvas.getContext('2d');
    const srcPx = srcCtx.getImageData(0, 0, width, height).data;

    const chromCanvas = document.createElement('canvas');
    chromCanvas.width = width;
    chromCanvas.height = height;
    const chromCtx = chromCanvas.getContext('2d');
    const chromData = chromCtx.createImageData(width, height);
    const outPx = chromData.data;

    let cbSum = 0;
    let crSum = 0;
    let clippingCount = 0;

    for (let i = 0; i < srcPx.length; i += 4) {
      const r = srcPx[i];
      const g = srcPx[i + 1];
      const b = srcPx[i + 2];

      // YCbCr conversion
      const Y = 0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      cbSum += Cb;
      crSum += Cr;

      if (r > 250 || g > 250 || b > 250 || r < 5 || g < 5 || b < 5) {
        clippingCount++;
      }

      // Visualizing Chrominance High-Frequencies (Disparity Map)
      outPx[i] = Math.min(255, Math.abs(Cb - 128) * 3);
      outPx[i + 1] = Math.min(255, Math.abs(Cr - 128) * 3);
      outPx[i + 2] = Math.min(255, Y);
      outPx[i + 3] = 255;
    }

    chromCtx.putImageData(chromData, 0, 0);

    const totalPixels = width * height;
    return {
      canvas: chromCanvas,
      clippingRatio: clippingCount / totalPixels,
      avgCb: cbSum / totalPixels,
      avgCr: crSum / totalPixels
    };
  }

  // Synthesize complete image forensics investigation
  async function analyzeImage(imageElement, arrayBuffer) {
    const origCanvas = document.createElement('canvas');
    // Normalize analysis size to keep performance snappy while preserving forensic fidelity
    const maxDim = 1200;
    let w = imageElement.naturalWidth || imageElement.width;
    let h = imageElement.naturalHeight || imageElement.height;
    if (w > maxDim || h > maxDim) {
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    origCanvas.width = w;
    origCanvas.height = h;
    const ctx = origCanvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, w, h);

    // 1. Binary Metadata
    const metadata = arrayBuffer ? parseMetadata(arrayBuffer) : { format: 'Unknown', aiMarkersFound: [] };

    // 2. ELA
    const ela = await computeELA(origCanvas);

    // 3. High-Pass Noise & Laplacian
    const noise = computeNoiseAndGradients(origCanvas);

    // 4. Chrominance Disparity
    const chrom = computeChrominanceMap(origCanvas);

    // Deepfake Probability Scoring Heuristic (0 to 100)
    let score = 20; // baseline neutral
    const reasons = [];

    // Factor A: Direct AI signatures in metadata
    if (metadata.aiMarkersFound.length > 0) {
      score = 96;
      reasons.push(`Direct AI metadata signature detected: ${metadata.aiMarkersFound.join(', ')}`);
    } else if (metadata.hasCameraMetadata) {
      score -= 22;
      reasons.push(`Authentic hardware EXIF metadata found (${metadata.cameraMake || ''} ${metadata.cameraModel || ''})`);
    } else {
      score += 10;
      reasons.push('Camera EXIF metadata completely absent or sanitized');
    }

    // Factor B: ELA inconsistency / compression anomalies
    // If standard deviation across blocks is disproportionately high, regions were resaved at different compression factors (splicing/deepfake)
    if (ela.blockStdDev > 4.5) {
      score += 25;
      reasons.push(`High compression disparity detected across localized regions (ELA StdDev: ${ela.blockStdDev.toFixed(2)})`);
    } else if (ela.meanDelta < 1.2 && !metadata.hasCameraMetadata) {
      // Extremely low recompression delta is hallmark of raw AI generator output
      score += 20;
      reasons.push(`Unusually uniform low-frequency recompression response characteristic of direct diffusion model outputs`);
    }

    // Factor C: Neural smoothing & noise distribution
    if (noise.smoothRatio > 0.45) {
      score += 18;
      reasons.push(`Excessive micro-texture suppression detected (${(noise.smoothRatio * 100).toFixed(1)}% synthetic smoothness)`);
    } else if (noise.meanEnergy > 16.0) {
      // Very high high-pass energy can indicate checkerboard upsampling artifacts
      score += 14;
      reasons.push(`High-frequency spectral anomalies indicative of neural upsampling / GAN artifacts`);
    }

    // Clamp score
    score = Math.max(2, Math.min(99, Math.round(score)));

    let riskLevel = 'AUTHENTIC';
    let riskClass = 'status-safe';
    if (score >= 70) {
      riskLevel = 'DEEPFAKE / SYNTHETIC';
      riskClass = 'status-danger';
    } else if (score >= 40) {
      riskLevel = 'SUSPICIOUS / MANIPULATED';
      riskClass = 'status-warning';
    }

    return {
      score: score,
      riskLevel: riskLevel,
      riskClass: riskClass,
      reasons: reasons,
      metadata: metadata,
      metrics: {
        dimensions: `${origCanvas.width} × ${origCanvas.height} px`,
        elaMean: ela.meanDelta.toFixed(2),
        elaStdDev: ela.blockStdDev.toFixed(2),
        noiseEnergy: noise.meanEnergy.toFixed(2),
        smoothRatio: `${(noise.smoothRatio * 100).toFixed(1)}%`,
        colorClipping: `${(chrom.clippingRatio * 100).toFixed(2)}%`
      },
      canvases: {
        original: origCanvas,
        ela: ela.canvas,
        noise: noise.canvas,
        chrom: chrom.canvas
      }
    };
  }

  return {
    analyzeImage: analyzeImage,
    parseMetadata: parseMetadata
  };
})();
