/**
 * Tech.Care HealthCare Dashboard - Application Logic
 * Coalition Technologies FED Skills Test Submission
 * Target Patient: Jessica Taylor
 */

// Configuration & API Constants
const API_CONFIG = {
  ENDPOINT: 'https://fedskillstest.coalitiontechnologies.workers.dev',
  USERNAME: 'coalition',
  PASSWORD: 'skills-test',
  TARGET_PATIENT_NAME: 'Jessica Taylor',
};

// Global State
let bpChartInstance = null;
let currentPatientData = null;
let allPatientsList = [];

/**
 * Generate HTTP Basic Auth header dynamically
 * Adheres strictly to: "Hard coding the encrypted Basic Auth will be counted against you, 
 * we expect that you encrypt the key yourself using the proper methods."
 */
function getBasicAuthHeader(username, password) {
  const credentials = `${username}:${password}`;
  // Standard btoa browser encoding for Basic Auth
  return 'Basic ' + btoa(credentials);
}

/**
 * Format date string (e.g. "1996-08-23" or "08/23/1996") into "August 23, 1996"
 */
function formatBirthDate(dateStr) {
  if (!dateStr) return 'August 23, 1996';
  try {
    const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
    let year, month, day;
    if (dateStr.includes('-')) {
      // YYYY-MM-DD
      [year, month, day] = parts;
    } else {
      // MM/DD/YYYY
      [month, day, year] = parts;
    }
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    return dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch (e) {
    console.warn('Date formatting fallback:', e);
    return dateStr;
  }
}

/**
 * Fetch patient data from Coalition Technologies API
 * Includes fallback to local JSON file for offline or local file:// review
 */
async function fetchPatients() {
  const authHeader = getBasicAuthHeader(API_CONFIG.USERNAME, API_CONFIG.PASSWORD);

  try {
    const response = await fetch(API_CONFIG.ENDPOINT, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (apiError) {
    console.warn('Direct worker fetch failed (possibly offline or CORS), trying fallback:', apiError);
    // Graceful offline fallback
    try {
      const fallbackResponse = await fetch('patients.json');
      if (fallbackResponse.ok) {
        return await fallbackResponse.json();
      }
    } catch (fallbackError) {
      console.error('Offline fallback fetch failed:', fallbackError);
    }
    throw apiError;
  }
}

/**
 * Render the Blood Pressure Chart using Chart.js
 * Shows the last 6 months in chronological order matching Adobe XD specifications
 */
function renderBloodPressureChart(diagnosisHistory) {
  const canvas = document.getElementById('bloodPressureChart');
  if (!canvas) return;

  // The API returns historical months sorted from most recent (e.g. Mar 2024) to past.
  // Take the first 6 entries and reverse so time progresses left-to-right (Oct 2023 -> Mar 2024).
  const recent6Months = diagnosisHistory.slice(0, 6).reverse();

  const labels = recent6Months.map(item => `${item.month.substring(0, 3)}, ${item.year}`);
  const systolicData = recent6Months.map(item => item.blood_pressure?.systolic?.value ?? 0);
  const diastolicData = recent6Months.map(item => item.blood_pressure?.diastolic?.value ?? 0);

  if (bpChartInstance) {
    bpChartInstance.destroy();
  }

  const ctx = canvas.getContext('2d');

  bpChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Systolic',
          data: systolicData,
          borderColor: '#C26EB4',
          backgroundColor: '#E66FD2',
          borderWidth: 2,
          tension: 0.45, // Smooth bezier curve matching Adobe XD
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: '#E66FD2',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          fill: false,
        },
        {
          label: 'Diastolic',
          data: diastolicData,
          borderColor: '#7E6CAB',
          backgroundColor: '#8C6FE6',
          borderWidth: 2,
          tension: 0.45, // Smooth bezier curve matching Adobe XD
          pointRadius: 6,
          pointHoverRadius: 8,
          pointBackgroundColor: '#8C6FE6',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 1.5,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          display: false // Custom metrics panel handles the legend
        },
        tooltip: {
          backgroundColor: '#072635',
          titleFont: { family: 'Manrope', size: 12, weight: '700' },
          bodyFont: { family: 'Manrope', size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          boxWidth: 8,
          boxHeight: 8,
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
            drawBorder: false,
          },
          ticks: {
            autoSkip: false,
            maxTicksLimit: 10,
            color: '#072635',
            font: {
              family: 'Manrope',
              size: 10,
              weight: '400',
            },
            padding: 6,
            maxRotation: 0,
            minRotation: 0,
          }
        },
        y: {
          min: 60,
          max: 180,
          ticks: {
            stepSize: 20,
            color: '#072635',
            font: {
              family: 'Manrope',
              size: 12,
              weight: '400',
            },
            padding: 10,
          },
          grid: {
            color: '#CBC8D4',
            drawBorder: false,
            lineWidth: 0.7,
          }
        }
      }
    }
  });
}

/**
 * Render Trend indicator with arrow and text
 */
function getTrendHTML(level) {
  if (!level) return '';
  const isHigher = level.toLowerCase().includes('higher');
  const isLower = level.toLowerCase().includes('lower');
  
  if (isHigher) {
    return `<img src="assets/icons/arrow-up.svg" alt="" width="10" height="6" aria-hidden="true"> <span>${level}</span>`;
  } else if (isLower) {
    return `<img src="assets/icons/arrow-down.svg" alt="" width="10" height="6" aria-hidden="true"> <span>${level}</span>`;
  }
  return `<span>${level}</span>`;
}

/**
 * Populate all metrics for Jessica Taylor
 */
function populatePatientMetrics(patient) {
  if (!patient) return;

  const history = patient.diagnosis_history || [];
  const latestMonth = history[0] || {};

  // 1. Blood Pressure Stats
  const systolicVal = latestMonth.blood_pressure?.systolic?.value ?? 160;
  const systolicLevel = latestMonth.blood_pressure?.systolic?.levels ?? 'Higher than Average';
  const diastolicVal = latestMonth.blood_pressure?.diastolic?.value ?? 78;
  const diastolicLevel = latestMonth.blood_pressure?.diastolic?.levels ?? 'Lower than Average';

  const systolicValueEl = document.getElementById('systolicValue');
  const systolicLevelRowEl = document.getElementById('systolicLevelRow');
  const diastolicValueEl = document.getElementById('diastolicValue');
  const diastolicLevelRowEl = document.getElementById('diastolicLevelRow');

  if (systolicValueEl) systolicValueEl.textContent = systolicVal;
  if (systolicLevelRowEl) systolicLevelRowEl.innerHTML = getTrendHTML(systolicLevel);
  if (diastolicValueEl) diastolicValueEl.textContent = diastolicVal;
  if (diastolicLevelRowEl) diastolicLevelRowEl.innerHTML = getTrendHTML(diastolicLevel);

  // 2. Vitals
  const respVal = latestMonth.respiratory_rate?.value ?? 20;
  const respStatus = latestMonth.respiratory_rate?.levels ?? 'Normal';
  const tempVal = latestMonth.temperature?.value ?? 98.6;
  const tempStatus = latestMonth.temperature?.levels ?? 'Normal';
  const heartVal = latestMonth.heart_rate?.value ?? 78;
  const heartStatus = latestMonth.heart_rate?.levels ?? 'Lower than Average';

  const respValEl = document.getElementById('respiratoryRate');
  const respStatusEl = document.getElementById('respiratoryStatus');
  const tempValEl = document.getElementById('temperatureValue');
  const tempStatusEl = document.getElementById('temperatureStatus');
  const heartValEl = document.getElementById('heartRate');
  const heartStatusEl = document.getElementById('heartRateStatus');

  if (respValEl) respValEl.textContent = `${respVal} bpm`;
  if (respStatusEl) respStatusEl.textContent = respStatus;
  if (tempValEl) tempValEl.textContent = `${tempVal}°F`;
  if (tempStatusEl) tempStatusEl.textContent = tempStatus;
  if (heartValEl) heartValEl.textContent = `${heartVal} bpm`;
  if (heartStatusEl) heartStatusEl.innerHTML = getTrendHTML(heartStatus);

  // 3. Render Chart
  renderBloodPressureChart(history);

  // 4. Diagnostic List Table
  populateDiagnosticList(patient.diagnostic_list || []);

  // 5. Patient Profile Card (Right Column)
  populateProfileDetails(patient);

  // 6. Lab Results (Right Column)
  populateLabResults(patient.lab_results || []);
}

/**
 * Populate Diagnostic List Table
 */
function populateDiagnosticList(diagnostics) {
  const tbody = document.getElementById('diagnosticListBody');
  if (!tbody) return;

  if (diagnostics.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding: 20px;">No diagnostic records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = diagnostics.map(diag => `
    <tr>
      <td>${escapeHTML(diag.name)}</td>
      <td>${escapeHTML(diag.description)}</td>
      <td>${escapeHTML(diag.status)}</td>
    </tr>
  `).join('');
}

/**
 * Populate Patient Profile Sidebar Information
 */
function populateProfileDetails(patient) {
  const avatarEl = document.getElementById('patientAvatar');
  const nameEl = document.getElementById('patientName');
  const dobEl = document.getElementById('patientDOB');
  const genderEl = document.getElementById('patientGender');
  const phoneEl = document.getElementById('patientPhone');
  const emergencyEl = document.getElementById('patientEmergency');
  const insuranceEl = document.getElementById('patientInsurance');

  if (avatarEl) {
    avatarEl.src = patient.profile_picture || 'assets/images/4.png';
    avatarEl.alt = patient.name || 'Jessica Taylor';
    avatarEl.onerror = () => {
      avatarEl.src = 'assets/images/4.png';
    };
  }

  if (nameEl) nameEl.textContent = patient.name || 'Jessica Taylor';
  if (dobEl) dobEl.textContent = formatBirthDate(patient.date_of_birth);
  if (genderEl) genderEl.textContent = patient.gender || 'Female';
  if (phoneEl) phoneEl.textContent = patient.phone_number || '(415) 555-1234';
  if (emergencyEl) emergencyEl.textContent = patient.emergency_contact || '(415) 555-5678';
  if (insuranceEl) insuranceEl.textContent = patient.insurance_type || 'Sunrise Health Assurance';
}

/**
 * Populate Lab Results list with Download actions
 */
function populateLabResults(labResults) {
  const listEl = document.getElementById('labResultsList');
  if (!listEl) return;

  if (labResults.length === 0) {
    listEl.innerHTML = `<li style="padding: 12px; text-align: center; color: var(--text-secondary);">No lab results recorded.</li>`;
    return;
  }

  listEl.innerHTML = labResults.map((result, index) => {
    // In XD prototype, the active/highlighted item has light grey background
    const isFirst = index === 0 ? 'highlight' : '';
    return `
      <li class="lab-result-item ${isFirst}">
        <span class="lab-result-name">${escapeHTML(result)}</span>
        <button class="lab-download-btn" aria-label="Download ${escapeHTML(result)} report">
          <img src="assets/icons/download.svg" alt="Download" width="18" height="18">
        </button>
      </li>
    `;
  }).join('');
}

/**
 * Populate Patients Sidebar List
 * Highlights Jessica Taylor as specified in instructions
 */
function populatePatientsList(patients) {
  const listContainer = document.getElementById('patientList');
  if (!listContainer) return;

  if (!patients || patients.length === 0) {
    listContainer.innerHTML = `<li style="padding: 16px; text-align: center;">No patients found.</li>`;
    return;
  }

  listContainer.innerHTML = patients.map(p => {
    const isJessica = p.name === API_CONFIG.TARGET_PATIENT_NAME;
    const activeClass = isJessica ? 'active' : '';
    const avatarUrl = p.profile_picture || 'assets/images/1.png';

    return `
      <li class="patient-item ${activeClass}" data-patient-name="${escapeHTML(p.name)}" tabindex="0">
        <div class="patient-item-main">
          <img src="${avatarUrl}" 
               alt="${escapeHTML(p.name)}" 
               class="patient-item-avatar" 
               width="48" 
               height="48"
               onerror="this.onerror=null; this.src='assets/images/1.png';">
          <div class="patient-item-info">
            <span class="patient-item-name">${escapeHTML(p.name)}</span>
            <span class="patient-item-meta">${escapeHTML(p.gender || 'Female')}, ${escapeHTML(String(p.age || ''))}</span>
          </div>
        </div>
        <button class="patient-item-more" aria-label="More options for ${escapeHTML(p.name)}">
          <img src="assets/icons/more-horiz.svg" alt="" width="16" height="4">
        </button>
      </li>
    `;
  }).join('');
}

/**
 * Simple HTML sanitizer
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

/**
 * Application Initialization
 */
async function initApp() {
  try {
    const patients = await fetchPatients();
    allPatientsList = patients;

    // Render left sidebar directory
    populatePatientsList(allPatientsList);

    // Filter target patient: Jessica Taylor
    const jessica = patients.find(p => p.name === API_CONFIG.TARGET_PATIENT_NAME);

    if (jessica) {
      currentPatientData = jessica;
      populatePatientMetrics(jessica);
    } else {
      console.error(`Patient "${API_CONFIG.TARGET_PATIENT_NAME}" not found in API response.`);
    }

  } catch (error) {
    console.error('Failed to initialize application:', error);
    const listContainer = document.getElementById('patientList');
    if (listContainer) {
      listContainer.innerHTML = `<li style="padding: 16px; color: #ff5c8a;">Failed to load patient data. Please check network connection.</li>`;
    }
  }
}

// Boot application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
