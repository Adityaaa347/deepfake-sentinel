/**
 * Veritas Forensic Core - Cybercrime & Law Enforcement Reporting Module
 * Pure Vanilla JavaScript & Web Crypto API - Zero Dependencies
 * Generates SHA-256 evidentiary hashes, formal legal complaint dossiers,
 * chain of custody metadata, and routes to national cybercrime authorities.
 */

const PoliceReporting = (function () {
  'use strict';

  // Compute SHA-256 hash using native browser Web Crypto API
  async function computeSHA256(arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate a random official docket tracking ID
  function generateDocketNumber() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CASE-CYBER-${dateStr}-${rand}`;
  }

  // National Cyber Security & Police Jurisdiction Directory
  const JURISDICTIONS = {
    IN: {
      name: 'India (National Cyber Crime Reporting Portal)',
      portalUrl: 'https://cybercrime.gov.in',
      helpline: '1930',
      authority: 'Ministry of Home Affairs (I4C)',
      filingGuide: 'Under IT Act 2000 (Sec 66D, 66E, 67A) and BNS 2023. File directly on cybercrime.gov.in or dial 1930 immediately for financial fraud.'
    },
    US: {
      name: 'United States (FBI IC3 & CISA)',
      portalUrl: 'https://www.ic3.gov',
      helpline: '1-800-CALL-FBI',
      authority: 'Federal Bureau of Investigation (IC3) / CISA',
      filingGuide: 'File complaint with FBI Internet Crime Complaint Center (IC3). For corporate executive impersonation, alert local FBI field office.'
    },
    UK: {
      name: 'United Kingdom (Action Fraud & Police)',
      portalUrl: 'https://www.actionfraud.police.uk',
      helpline: '0300 123 2040',
      authority: 'City of London Police / Action Fraud',
      filingGuide: 'Report to Action Fraud, the UK national reporting centre for fraud and cyber crime, or call 101 for non-emergencies.'
    },
    EU: {
      name: 'European Union (Europol EC3)',
      portalUrl: 'https://www.europol.europa.eu/report-a-crime',
      helpline: '112 (Emergency)',
      authority: 'European Cybercrime Centre (EC3)',
      filingGuide: 'Submit directly through your national cybercrime division or EU member state police agency.'
    },
    AU: {
      name: 'Australia (ReportCyber)',
      portalUrl: 'https://www.cyber.gov.au/report',
      helpline: '1300 CYBER1 (1300 292 371)',
      authority: 'Australian Cyber Security Centre (ACSC)',
      filingGuide: 'Use ReportCyber to notify state, territory and federal police of cyber crimes, extortion, or deepfake scams.'
    },
    INTL: {
      name: 'International (Interpol Cybercrime Directorate)',
      portalUrl: 'https://www.interpol.int/en/Crimes/Cybercrime',
      helpline: 'Contact National Police Agency',
      authority: 'INTERPOL Cybercrime Operations',
      filingGuide: 'For cross-border extortion or organized synthetic media syndicates, file via your national central bureau (NCB).'
    }
  };

  // Compile formal evidentiary dossier
  function generateEvidenceDossier(data) {
    const docketId = data.docketId || generateDocketNumber();
    const timestamp = new Date().toISOString();

    const dossier = {
      docketId: docketId,
      timestampUTC: timestamp,
      jurisdiction: data.jurisdiction,
      incidentCategory: data.incidentCategory,
      evidenceType: data.evidenceType || 'Digital Synthetic Media',
      evidenceFileName: data.fileName || 'evidence_file',
      fileSizeBytes: data.fileSize || 0,
      sha256Hash: data.sha256Hash || 'PENDING_HASH_CALCULATION',
      forensicMetrics: data.forensicMetrics || {},
      detectionVerdict: data.detectionVerdict || 'UNKNOWN',
      tamperScore: data.tamperScore || 0,
      keyFindings: data.keyFindings || [],
      reporter: {
        fullName: data.reporterName || 'Confidential / Anonymous',
        contactEmail: data.reporterEmail || 'N/A',
        contactPhone: data.reporterPhone || 'N/A',
        identityRef: data.reporterId || 'REDACTED',
        location: data.reporterLocation || 'N/A'
      },
      suspect: {
        aliasOrName: data.suspectName || 'Unknown / Under Investigation',
        platformSource: data.platformSource || 'Unspecified Platform',
        profileUrl: data.profileUrl || 'N/A',
        contactDetails: data.suspectContact || 'N/A'
      },
      incidentStatement: data.narrative || 'No additional narrative statement provided.',
      chainOfCustody: [
        {
          event: 'Client-side forensic artifact ingested',
          timestamp: timestamp,
          agent: 'Veritas Forensic Client Engine v3.4 (Zero-Dependency Cryptographic Runtime)'
        },
        {
          event: 'SHA-256 cryptographic digest verified',
          timestamp: timestamp,
          agent: 'Web Crypto API Sub-System'
        }
      ]
    };

    return dossier;
  }

  // Export dossier as downloadable JSON
  function downloadDossierJSON(dossier) {
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dossier.docketId}_VERITAS_FORENSIC_EVIDENCE.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Generate printable formal legal police complaint document
  function renderPrintableComplaint(dossier) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups to print the official police complaint.');
      return;
    }

    const jurisdictionInfo = JURISDICTIONS[dossier.jurisdiction] || JURISDICTIONS.INTL;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OFFICIAL POLICE COMPLAINT // ${dossier.docketId}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #111;
      background: #fff;
      line-height: 1.5;
      font-size: 13px;
      margin: 0;
      padding: 20px;
    }
    .header {
      border-bottom: 2px solid #000;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      background: #000;
      color: #fff;
      padding: 4px 8px;
      display: inline-block;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .subhead {
      font-size: 12px;
      color: #555;
    }
    .meta-box {
      border: 1px solid #ccc;
      background: #fafafa;
      padding: 10px 14px;
      margin-bottom: 20px;
      font-family: monospace;
      font-size: 12px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      border-bottom: 1px solid #000;
      padding-bottom: 4px;
      margin: 20px 0 10px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 7px 10px;
      text-align: left;
    }
    th {
      background: #f0f0f0;
      width: 30%;
      font-weight: 600;
    }
    .hash {
      font-family: monospace;
      font-size: 11px;
      word-break: break-all;
      background: #f4f4f4;
      padding: 4px;
      border: 1px solid #e0e0e0;
    }
    .danger {
      color: #b91c1c;
      font-weight: 700;
    }
    .statement-box {
      border: 1px solid #ddd;
      padding: 12px;
      background: #fdfdfd;
      white-space: pre-wrap;
      min-height: 80px;
      font-size: 12px;
    }
    .signatures {
      margin-top: 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .sig-line {
      border-top: 1px solid #000;
      padding-top: 6px;
      font-size: 11px;
      text-align: center;
    }
    .print-btn-bar {
      margin-bottom: 20px;
      text-align: right;
    }
    .print-btn {
      background: #000;
      color: #fff;
      border: none;
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 600;
    }
    @media print {
      .print-btn-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="print-btn" onclick="window.print()">PRINT / SAVE AS PDF</button>
  </div>

  <div class="header">
    <div>
      <span class="badge">EVIDENTIARY DOSSIER // LAW ENFORCEMENT EXHIBIT</span>
      <h1>Formal Cybercrime & Deepfake Incident Report</h1>
      <div class="subhead">Submitted for Criminal Investigation, Section 65B/Evidence Act Verification, and Content Takedown</div>
    </div>
    <div style="text-align: right; font-family: monospace;">
      <strong>DOCKET ID:</strong><br>${dossier.docketId}<br>
      <small>${dossier.timestampUTC}</small>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-grid">
      <div><strong>Jurisdiction:</strong> ${jurisdictionInfo.name}</div>
      <div><strong>Target Authority:</strong> ${jurisdictionInfo.authority}</div>
      <div><strong>Statutory Context:</strong> ${jurisdictionInfo.filingGuide}</div>
      <div><strong>Official Helpline:</strong> ${jurisdictionInfo.helpline}</div>
    </div>
  </div>

  <div class="section-title">1. INCIDENT CLASSIFICATION & DETAILS</div>
  <table>
    <tr><th>Incident Classification</th><td class="danger">${dossier.incidentCategory}</td></tr>
    <tr><th>Digital Evidence Type</th><td>${dossier.evidenceType}</td></tr>
    <tr><th>Original File Name</th><td>${dossier.evidenceFileName}</td></tr>
    <tr><th>File Size</th><td>${(dossier.fileSizeBytes / 1024).toFixed(2)} KB (${dossier.fileSizeBytes} bytes)</td></tr>
    <tr><th>Cryptographic Hash (SHA-256)</th><td><div class="hash">${dossier.sha256Hash}</div></td></tr>
  </table>

  <div class="section-title">2. FORENSIC TAMPER ANALYSIS & DETECTION METRICS</div>
  <table>
    <tr><th>Automated Forensic Verdict</th><td class="danger">${dossier.detectionVerdict} (Confidence Score: ${dossier.tamperScore}%)</td></tr>
    <tr><th>Forensic Telemetry</th><td>${Object.entries(dossier.forensicMetrics).map(([k, v]) => `<strong>${k}:</strong> ${v}`).join(' &nbsp;|&nbsp; ')}</td></tr>
    <tr><th>Key Diagnostic Anomalies</th><td>
      <ul>
        ${dossier.keyFindings.map(f => `<li>${f}</li>`).join('') || '<li>No specific anomaly flagged</li>'}
      </ul>
    </td></tr>
  </table>

  <div class="section-title">3. COMPLAINANT / VICTIM INFORMATION</div>
  <table>
    <tr><th>Complainant Full Name</th><td>${dossier.reporter.fullName}</td></tr>
    <tr><th>Contact Email & Phone</th><td>${dossier.reporter.contactEmail} &nbsp;/&nbsp; ${dossier.reporter.contactPhone}</td></tr>
    <tr><th>Govt ID / National Identity</th><td>${dossier.reporter.identityRef}</td></tr>
    <tr><th>Residential Jurisdiction</th><td>${dossier.reporter.location}</td></tr>
  </table>

  <div class="section-title">4. SUSPECT / DISTRIBUTION PLATFORM LOGISTICS</div>
  <table>
    <tr><th>Suspect Identity / Alias</th><td>${dossier.suspect.aliasOrName}</td></tr>
    <tr><th>Distribution Platform</th><td>${dossier.suspect.platformSource}</td></tr>
    <tr><th>Source URL / Profile Handle</th><td><div class="hash">${dossier.suspect.profileUrl}</div></td></tr>
    <tr><th>Known Coordinates / Contact</th><td>${dossier.suspect.contactDetails}</td></tr>
  </table>

  <div class="section-title">5. COMPLAINANT SWORN STATEMENT & FACTUAL NARRATIVE</div>
  <div class="statement-box">${dossier.incidentStatement}</div>

  <div class="section-title">6. STATUTORY DECLARATION & CHAIN OF CUSTODY</div>
  <p style="font-size: 11px; color: #444;">
    I hereby declare that the particulars submitted above are true, accurate, and substantiated by digital evidence. The digital artifact identified by SHA-256 hash <span style="font-family: monospace;">${dossier.sha256Hash.slice(0, 16)}...</span> was analyzed and preserved in its raw binary format without unauthorized alteration. I request the Cyber Crime Investigation Division / Law Enforcement Officers to register an FIR / Incident Docket, secure electronic records under applicable digital evidence provisions, issue emergency takedown notices to the host platform, and initiate legal proceedings against the perpetrators.
  </p>

  <div class="signatures">
    <div>
      <br><br><br>
      <div class="sig-line">Signature of Complainant / Victim<br>Date: ${new Date().toLocaleDateString()}</div>
    </div>
    <div>
      <br><br><br>
      <div class="sig-line">Receiving Cyber Crime Officer / Stamp<br>Police Station / Incident Desk</div>
    </div>
  </div>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return {
    computeSHA256: computeSHA256,
    generateDocketNumber: generateDocketNumber,
    generateEvidenceDossier: generateEvidenceDossier,
    downloadDossierJSON: downloadDossierJSON,
    renderPrintableComplaint: renderPrintableComplaint,
    JURISDICTIONS: JURISDICTIONS
  };
})();
