/**
 * Veritas Forensic Core - Text & LLM Deepfake Analysis Module
 * Pure Vanilla JavaScript - Zero Dependencies
 * Analyzes Shannon Entropy, Burstiness (sentence length variance),
 * Lexical Diversity (Type-Token Ratio), and AI Model Rhetorical Signatures.
 */

const TextForensics = (function () {
  'use strict';

  // Over-indexed vocabulary and rhetorical markers typical of LLM generation
  const AI_RHETORICAL_MARKERS = [
    { word: 'delve', weight: 4.5 },
    { word: 'delves', weight: 4.5 },
    { word: 'delving', weight: 4.5 },
    { word: 'testament', weight: 4.0 },
    { word: 'tapestry', weight: 4.5 },
    { word: 'pivotal', weight: 3.5 },
    { word: 'crucial', weight: 2.5 },
    { word: 'moreover', weight: 3.0 },
    { word: 'furthermore', weight: 3.0 },
    { word: 'in conclusion', weight: 4.0 },
    { word: 'fostering', weight: 3.5 },
    { word: 'beacon', weight: 4.0 },
    { word: 'paramount', weight: 3.8 },
    { word: 'underscores', weight: 3.8 },
    { word: 'interplay', weight: 4.0 },
    { word: 'navigating', weight: 3.2 },
    { word: 'ever-evolving', weight: 4.5 },
    { word: 'multifaceted', weight: 4.0 },
    { word: 'realm', weight: 3.5 },
    { word: 'harnessing', weight: 3.5 },
    { word: 'holistic', weight: 3.0 },
    { word: 'cornerstone', weight: 3.8 },
    { word: 'quintessential', weight: 4.0 },
    { word: 'vibrant', weight: 2.8 },
    { word: 'shed light', weight: 3.5 },
    { word: 'it is important to note', weight: 4.5 },
    { word: 'it is worth noting', weight: 4.5 },
    { word: 'in summary', weight: 3.0 },
    { word: 'vital', weight: 2.2 },
    { word: 'intricate', weight: 3.0 }
  ];

  function analyzeText(rawText) {
    const text = rawText.trim();
    if (!text || text.length < 50) {
      throw new Error('Please input at least 50 characters of text for meaningful forensic analysis.');
    }

    // Tokenization
    const words = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const totalWords = words.length;
    if (totalWords < 15) {
      throw new Error('Text is too short. At least 15 words are required.');
    }

    // 1. Lexical Diversity (Type-Token Ratio)
    const wordCounts = {};
    for (let w of words) {
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    }
    const uniqueWords = Object.keys(wordCounts).length;
    const typeTokenRatio = uniqueWords / totalWords;

    // 2. Shannon Entropy (Word-level)
    // H = - sum(p * log2(p))
    let entropy = 0;
    for (let w in wordCounts) {
      const p = wordCounts[w] / totalWords;
      entropy -= p * Math.log2(p);
    }

    // 3. Sentence Length Variance (Burstiness)
    // Human writing has high burstiness (very short sentences mixed with long ones)
    // AI text tends to be rhythmic and uniform (low variance)
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const sentenceLengths = sentences.map(s => {
      return s.split(/\s+/).filter(w => w.length > 0).length;
    }).filter(len => len > 0);

    let meanSentenceLen = 0;
    let burstinessStdDev = 0;

    if (sentenceLengths.length > 0) {
      meanSentenceLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
      let sumSq = 0;
      for (let len of sentenceLengths) {
        sumSq += Math.pow(len - meanSentenceLen, 2);
      }
      burstinessStdDev = Math.sqrt(sumSq / sentenceLengths.length);
    }

    // 4. AI Vocabulary & Rhetorical Density
    let markerScore = 0;
    const foundMarkers = [];
    const lowerText = text.toLowerCase();

    for (let item of AI_RHETORICAL_MARKERS) {
      const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        markerScore += matches.length * item.weight;
        foundMarkers.push(`${item.word} (${matches.length}x)`);
      }
    }

    // 5. Syntactic Symmetry (e.g. "Not only... but also...", tripartite bullet points, em-dashes)
    const emDashCount = (text.match(/—|--/g) || []).length;
    const colonIntroCount = (text.match(/:\s*\n/g) || []).length;
    const tripartiteCount = (text.match(/,\s*[^,]+,\s*and\s+/g) || []).length;

    // Scoring heuristic
    let score = 25; // baseline neutral
    const reasons = [];

    // Factor A: Marker density
    const markerDensity = (markerScore / totalWords) * 100;
    if (markerDensity > 2.5) {
      score += 35;
      reasons.push(`High concentration of stereotypical LLM rhetorical markers: ${foundMarkers.slice(0, 6).join(', ')}`);
    } else if (markerDensity > 1.0) {
      score += 20;
      reasons.push(`Moderate presence of AI transition markers (${foundMarkers.slice(0, 4).join(', ')})`);
    }

    // Factor B: Burstiness (Uniformity of sentence pacing)
    if (sentenceLengths.length >= 3) {
      if (burstinessStdDev < 4.0 && meanSentenceLen >= 14) {
        score += 26;
        reasons.push(`Extremely low sentence length variance (StdDev: ${burstinessStdDev.toFixed(2)}). Typical of algorithmic sentence generation.`);
      } else if (burstinessStdDev > 10.0) {
        score -= 15;
        reasons.push(`High natural burstiness (StdDev: ${burstinessStdDev.toFixed(2)}) typical of organic human prose variation.`);
      }
    }

    // Factor C: Shannon Entropy
    // Typical AI text in medium length has entropy between 5.0 and 6.8 with very regular distribution
    if (entropy > 5.5 && entropy < 7.2 && typeTokenRatio < 0.65) {
      score += 15;
      reasons.push(`Uniform lexical entropy (${entropy.toFixed(2)} bits/word) with standardized vocabulary spread`);
    }

    // Factor D: Punctuation and structuring
    if (emDashCount >= 3 || tripartiteCount >= 2) {
      score += 10;
      reasons.push('Syntactic balance patterns detected (frequent balanced clauses and parenthetical dashes)');
    }

    score = Math.max(4, Math.min(98, Math.round(score)));

    let riskLevel = 'HUMAN WRITTEN';
    let riskClass = 'status-safe';
    if (score >= 70) {
      riskLevel = 'AI-GENERATED / SYNTHETIC';
      riskClass = 'status-danger';
    } else if (score >= 40) {
      riskLevel = 'MIXED / LIKELY AI-ASSISTED';
      riskClass = 'status-warning';
    }

    return {
      score: score,
      riskLevel: riskLevel,
      riskClass: riskClass,
      reasons: reasons,
      metrics: {
        totalWords: totalWords,
        uniqueWords: uniqueWords,
        typeTokenRatio: typeTokenRatio.toFixed(3),
        shannonEntropy: `${entropy.toFixed(2)} bits`,
        sentenceCount: sentences.length,
        meanSentenceLength: `${meanSentenceLen.toFixed(1)} words`,
        burstinessStdDev: burstinessStdDev.toFixed(2),
        markersFoundCount: foundMarkers.length
      },
      foundMarkers: foundMarkers
    };
  }

  return {
    analyzeText: analyzeText
  };
})();
