/**
 * Veritas Forensic Core - Video Deepfake Analysis Module
 * Pure Vanilla JavaScript & HTML5 Video/Canvas - Zero Dependencies
 * Analyzes temporal frame consistency, inter-frame flicker, facial/central bounding
 * motion disparity, and optical continuity across sampled frames.
 */

const VideoForensics = (function () {
  'use strict';

  async function analyzeVideo(file, progressCallback) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to decode video format or codec'));
      };

      video.onloadedmetadata = async () => {
        try {
          const duration = video.duration || 1;
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;

          // Target frame count for rapid client-side inspection
          const sampleCount = Math.min(24, Math.max(12, Math.floor(duration * 3)));
          const timestamps = [];
          for (let i = 0; i < sampleCount; i++) {
            timestamps.push((i / (sampleCount - 1 || 1)) * Math.max(0.1, duration - 0.2));
          }

          const sampledFrames = [];
          const offCanvas = document.createElement('canvas');
          // Scale down for processing performance
          const procW = 320;
          const procH = Math.round((height / width) * procW);
          offCanvas.width = procW;
          offCanvas.height = procH;
          const ctx = offCanvas.getContext('2d', { willReadFrequently: true });

          for (let i = 0; i < timestamps.length; i++) {
            const time = timestamps[i];
            await seekVideo(video, time);

            ctx.drawImage(video, 0, 0, procW, procH);
            const imgData = ctx.getImageData(0, 0, procW, procH);

            // Create thumbnail for user inspection
            const thumbCanvas = document.createElement('canvas');
            thumbCanvas.width = procW;
            thumbCanvas.height = procH;
            const thumbCtx = thumbCanvas.getContext('2d');
            thumbCtx.drawImage(offCanvas, 0, 0);

            sampledFrames.push({
              time: time,
              data: imgData,
              thumbDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.8),
              metrics: extractFrameFeatures(imgData, procW, procH)
            });

            if (progressCallback) {
              progressCallback(Math.round(((i + 1) / timestamps.length) * 100));
            }
          }

          // Evaluate temporal deltas between consecutive frames
          const temporalDeltas = [];
          const centralFlickers = [];

          for (let i = 1; i < sampledFrames.length; i++) {
            const prev = sampledFrames[i - 1].data.data;
            const curr = sampledFrames[i].data.data;

            let diffSum = 0;
            let centerDiffSum = 0;
            let centerPixels = 0;

            const cMinX = procW * 0.25;
            const cMaxX = procW * 0.75;
            const cMinY = procH * 0.20;
            const cMaxY = procH * 0.80;

            for (let y = 0; y < procH; y++) {
              for (let x = 0; x < procW; x++) {
                const idx = (y * procW + x) * 4;
                const d = (Math.abs(prev[idx] - curr[idx]) +
                           Math.abs(prev[idx + 1] - curr[idx + 1]) +
                           Math.abs(prev[idx + 2] - curr[idx + 2])) / 3;
                diffSum += d;

                if (x >= cMinX && x <= cMaxX && y >= cMinY && y <= cMaxY) {
                  centerDiffSum += d;
                  centerPixels++;
                }
              }
            }

            const totalPx = procW * procH;
            const avgDiff = diffSum / totalPx;
            const avgCenterDiff = centerDiffSum / (centerPixels || 1);

            temporalDeltas.push(avgDiff);
            centralFlickers.push(avgCenterDiff);
          }

          // Statistical summary of temporal consistency
          const meanDelta = temporalDeltas.reduce((a, b) => a + b, 0) / (temporalDeltas.length || 1);
          let sumDeltaSq = 0;
          for (let d of temporalDeltas) {
            sumDeltaSq += Math.pow(d - meanDelta, 2);
          }
          const deltaVariance = sumDeltaSq / (temporalDeltas.length || 1);
          const deltaStdDev = Math.sqrt(deltaVariance);

          // Deepfake temporal jitter metric: ratio of sudden jitter spikes to baseline motion
          let jitterSpikes = 0;
          for (let d of temporalDeltas) {
            if (d > meanDelta * 2.2 && d > 12) jitterSpikes++;
          }

          // Neural facial boundary motion disparity:
          // In face swap deepfakes, the central region fluctuates independently from peripheral background
          let boundaryDisparitySum = 0;
          for (let i = 0; i < temporalDeltas.length; i++) {
            const ratio = centralFlickers[i] / (temporalDeltas[i] + 0.001);
            if (ratio > 2.0 || ratio < 0.3) {
              boundaryDisparitySum++;
            }
          }
          const boundaryDisparityRatio = boundaryDisparitySum / (temporalDeltas.length || 1);

          // Scoring logic
          let score = 22;
          const reasons = [];

          if (jitterSpikes >= 3) {
            score += 30;
            reasons.push(`Detected ${jitterSpikes} high-frequency temporal flicker spikes across consecutive frames`);
          }

          if (boundaryDisparityRatio > 0.4) {
            score += 26;
            reasons.push('Elevated central facial region boundary motion disparity (indicative of neural face swapping or warped mask edges)');
          }

          if (deltaStdDev > 9.0) {
            score += 18;
            reasons.push(`Unstable inter-frame structural variance (StdDev: ${deltaStdDev.toFixed(2)})`);
          }

          // Check video resolution standard (AI video generation often uses non-standard dimensions e.g. 512x512, 1024x576)
          if ((width === 512 && height === 512) || (width === 1024 && height === 576) || (width === 768 && height === 768)) {
            score += 15;
            reasons.push(`Video resolution (${width}x${height}) matches standard diffusion model output dimensions`);
          }

          score = Math.max(5, Math.min(98, Math.round(score)));

          let riskLevel = 'AUTHENTIC VIDEO';
          let riskClass = 'status-safe';
          if (score >= 70) {
            riskLevel = 'DEEPFAKE DETECTED';
            riskClass = 'status-danger';
          } else if (score >= 40) {
            riskLevel = 'SUSPICIOUS MANIPULATION';
            riskClass = 'status-warning';
          }

          URL.revokeObjectURL(objectUrl);

          resolve({
            score: score,
            riskLevel: riskLevel,
            riskClass: riskClass,
            reasons: reasons,
            metrics: {
              duration: `${duration.toFixed(1)} seconds`,
              resolution: `${width} × ${height} px`,
              sampledFrames: sampledFrames.length,
              temporalMeanDelta: meanDelta.toFixed(2),
              jitterSpikes: jitterSpikes,
              deltaStdDev: deltaStdDev.toFixed(2),
              boundaryDisparity: `${(boundaryDisparityRatio * 100).toFixed(1)}%`
            },
            sampledFrames: sampledFrames,
            temporalDeltas: temporalDeltas
          });
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err);
        }
      };
    });
  }

  function seekVideo(video, time) {
    return new Promise((resolve) => {
      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        resolve();
      };
      video.addEventListener('seeked', handleSeeked);
      video.currentTime = Math.max(0, time);
    });
  }

  function extractFrameFeatures(imgData, w, h) {
    const data = imgData.data;
    let lumSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      lumSum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    return {
      avgLuminance: (lumSum / (w * h)).toFixed(1)
    };
  }

  // Pure vanilla client-side synthetic video generator using Canvas + MediaRecorder
  function generateDemoDeepfakeVideo() {
    return new Promise((resolve, reject) => {
      const c = document.createElement('canvas');
      c.width = 400;
      c.height = 300;
      const ctx = c.getContext('2d');

      const stream = c.captureStream(30);
      let mediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      } catch (e) {
        try {
          mediaRecorder = new MediaRecorder(stream);
        } catch (e2) {
          return reject(new Error('MediaRecorder not supported for client-side demo generation'));
        }
      }

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        resolve(blob);
      };

      mediaRecorder.start();

      let frame = 0;
      const totalFrames = 60; // 2 seconds at 30 fps
      const interval = setInterval(() => {
        // Draw background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 400, 300);

        // Body / shoulders
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.ellipse(200, 280, 120, 80, 0, 0, Math.PI * 2);
        ctx.fill();

        // Face region with intentional synthetic jitter and boundary flicker on specific frames
        const hasJitterSpike = (frame === 15 || frame === 16 || frame === 32 || frame === 45);
        const offsetX = hasJitterSpike ? (Math.random() * 14 - 7) : 0;
        const color = hasJitterSpike ? '#f43f5e' : '#f59e0b';

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(200 + offsetX, 140, 50, 65, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(180 + offsetX, 130, 5, 0, Math.PI * 2);
        ctx.arc(220 + offsetX, 130, 5, 0, Math.PI * 2);
        ctx.fill();

        frame++;
        if (frame >= totalFrames) {
          clearInterval(interval);
          mediaRecorder.stop();
        }
      }, 1000 / 30);
    });
  }

  return {
    analyzeVideo: analyzeVideo,
    generateDemoDeepfakeVideo: generateDemoDeepfakeVideo
  };
})();
