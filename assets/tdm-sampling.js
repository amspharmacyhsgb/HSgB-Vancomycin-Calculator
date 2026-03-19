// =============================================================
// tdm-sampling.js — Vancomycin TDM Sampling Guide Calculator
// =============================================================

let hasScrolledTDM = false;

// Stores alternative (after-hours / weekend) sampling times
let adjustedTroughDateTime = null;
let adjustedPostdoseDateTime = null;
let adjustedTimeLabel = '';

// Urgency state
let isUrgentCase = false;
let lastWarningState = null;
let urgentSelectedOption = null;    // 'A' | 'B' | null
let standardAdjustedConfirmed = false; // true = user agreed to use adjusted time in note

// Infusion duration mapping (in hours)
const INFUSION_DURATION = {
  500: 1,
  750: 1.5,
  1000: 2,
  1250: 2.5,
  1500: 2.5,
  1750: 3,
  2000: 4
};

// Standard administration times
const STANDARD_TIMES = {
  'EOD': ['06:00'],
  'OD': ['06:00'],
  'BD': ['06:00', '18:00'],
  'TDS': ['06:00', '14:00', '22:00'],
  'QID': ['06:00', '12:00', '18:00', '00:00']
};

// Sampling dose numbers
const SAMPLING_DOSE_NUMBER = {
  'EOD': 2,
  'OD': 3,
  'BD': 4,
  'TDS': 4,
  'QID': 4
};

// Frequency display names
const FREQUENCY_NAMES = {
  'EOD': 'Every Other Day',
  'OD': 'Once Daily',
  'BD': 'Twice Daily',
  'TDS': 'Three Times Daily',
  'QID': 'Four Times Daily'
};

// =============================================================
// Utility Functions
// =============================================================

function clearTDMInputs() {
  document.getElementById('tdmForm').reset();
  
  // Reset sampling method badge
  document.getElementById('samplingMethod').value = '';
  document.getElementById('badge-trough').className = 'method-badge';
  document.getElementById('badge-auc').className = 'method-badge';
  ['trough', 'auc'].forEach(m => {
    const p = document.getElementById('info-panel-' + m);
    if (p) p.classList.remove('visible', 'pinned');
  });
  
  document.getElementById('timeRoundingNote').style.display = 'none';
  document.getElementById('frequencyNote').style.display = 'none';
  document.getElementById('tdmOutput').style.display = 'none';
  
  // Reset adjusted time state
  adjustedTroughDateTime = null;
  adjustedPostdoseDateTime = null;
  adjustedTimeLabel = '';
  isUrgentCase = false;
  lastWarningState = null;
  urgentSelectedOption = null;
  standardAdjustedConfirmed = false;

  hasScrolledTDM = false;
}

function formatDateTime(date) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  
  const minuteStr = minutes.toString().padStart(2, '0');
  const timeStr = `${hours}:${minuteStr} ${ampm}`;
  
  return {
    full: `${dayName}, ${day} ${month} ${year} at ${timeStr}`,
    time: timeStr,
    day: dayName,
    date: `${day} ${month} ${year}`,
    dayOfWeek: date.getDay() // 0 = Sunday, 6 = Saturday
  };
}

function isWeekend(date) {
  const day = date.getDay();
  const hour = date.getHours();
  
  // Saturday or Sunday
  if (day === 0 || day === 6) return true;
  
  // Friday after 5pm
  if (day === 5 && hour >= 17) return true;
  
  return false;
}

function isAfterHours(date) {
  const hour = date.getHours();
  // After 5pm (17:00) to before 4am (04:00)
  return hour >= 17 || hour < 4;
}

function getNextWorkingDay(date) {
  const nextDay = new Date(date);
  
  // Keep adding days until we find a weekday (Monday-Friday)
  do {
    nextDay.setDate(nextDay.getDate() + 1);
  } while (nextDay.getDay() === 0 || nextDay.getDay() === 6); // 0 = Sunday, 6 = Saturday
  
  return nextDay;
}

function findNearestStandardTime(inputHour, inputMinute, frequency) {
  const standardTimes = STANDARD_TIMES[frequency];
  if (!standardTimes) return null;
  
  const inputMinutes = inputHour * 60 + inputMinute;
  
  let nearest = null;
  let minDiff = Infinity;
  
  standardTimes.forEach(time => {
    const [h, m] = time.split(':').map(Number);
    const standardMinutes = h * 60 + m;
    const diff = Math.abs(inputMinutes - standardMinutes);
    
    if (diff < minDiff) {
      minDiff = diff;
      nearest = time;
    }
  });
  
  return nearest;
}

// =============================================================
// Main Calculation Function
// =============================================================

function calculateTDM() {
  const samplingMethod = document.getElementById('samplingMethod').value;
  
  const ldDate = document.getElementById('ld_date').value;
  const ldHour = document.getElementById('ld_hour').value;
  const ldMinute = document.getElementById('ld_minute').value;
  const ldAmPm = document.getElementById('ld_ampm').value;
  
  const mdDate = document.getElementById('md_date').value;
  const mdHour = document.getElementById('md_hour').value;
  const mdMinute = document.getElementById('md_minute').value;
  const mdAmPm = document.getElementById('md_ampm').value;
  
  const dose = document.getElementById('dose').value;
  const frequency = document.getElementById('frequency').value;
  
  const outputDiv = document.getElementById('tdmOutput');
  
  // Validation
  const inputsComplete = mdDate && mdHour !== '' && mdMinute !== '' && mdAmPm !== '' && dose && frequency && samplingMethod;
  
  if (!inputsComplete) {
    outputDiv.style.display = 'none';
    return;
  }
  
  // Convert 12H to 24H format
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  
  // Show output
  outputDiv.style.display = 'block';
  
  // Toggle merged sampling card style + show/hide post-dose section
  const aucPostSection = document.getElementById('aucPostSection');
  const samplingCard = document.getElementById('samplingCard');
  if (samplingMethod === 'auc') {
    aucPostSection.style.display = 'block';
    samplingCard.style.backgroundColor = '#F0F4FF';
    samplingCard.style.borderLeftColor = '#5C6BC0';
  } else {
    aucPostSection.style.display = 'none';
    samplingCard.style.backgroundColor = '#E8F5E9';
    samplingCard.style.borderLeftColor = '#4CAF50';
  }
  
  // Auto-scroll on first calculation
  if (!hasScrolledTDM) {
    setTimeout(() => {
      const firstHeading = outputDiv.querySelector('h3');
      const targetElement = firstHeading || outputDiv;
      const headerHeight = document.querySelector('.header').offsetHeight;
      const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = targetPosition - headerHeight - 20;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      hasScrolledTDM = true;
    }, 100);
  }
  
  // Display frequency note
  displayFrequencyNote(frequency);
  
  // Display time rounding note
  displayTimeRoundingNote(parseInt(mdHour), parseInt(mdMinute), mdAmPm, frequency);
  
  // Calculate sampling times
  const firstMDDateTime = new Date(mdDate);
  firstMDDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
  
  const samplingDoseNum = SAMPLING_DOSE_NUMBER[frequency];
  const infusionDuration = INFUSION_DURATION[dose];
  
  // Calculate which dose to sample before
  const troughDateTime = calculateTroughTime(firstMDDateTime, frequency, samplingDoseNum);
  
  // Display results
  displaySummary(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod);
  displayTroughSampling(troughDateTime, samplingDoseNum);
  
  if (samplingMethod === 'auc') {
    const postdoseDateTime = calculatePostdoseTime(troughDateTime, infusionDuration);
    displayPostdoseSampling(postdoseDateTime, samplingDoseNum, troughDateTime, infusionDuration);
  }
  
  // Reset adjusted time state for this calculation run
  adjustedTroughDateTime = null;
  adjustedPostdoseDateTime = null;
  adjustedTimeLabel = '';
  isUrgentCase = false;
  lastWarningState = null;
  urgentSelectedOption = null;
  standardAdjustedConfirmed = false;

  // Check for after-hours and weekend warnings
  const shouldShowWeekend = isWeekend(troughDateTime) || (samplingMethod === 'auc' && isWeekend(calculatePostdoseTime(troughDateTime, infusionDuration)));
  const shouldShowAfterHours = !shouldShowWeekend && (isAfterHours(troughDateTime) || (samplingMethod === 'auc' && isAfterHours(calculatePostdoseTime(troughDateTime, infusionDuration))));
  
  if (shouldShowWeekend) {
    displayWeekendWarning(troughDateTime, samplingMethod === 'auc', infusionDuration);
    document.getElementById('afterHoursWarning').style.display = 'none';
  } else if (shouldShowAfterHours) {
    displayAfterHoursWarning(troughDateTime, samplingMethod === 'auc', infusionDuration);
    document.getElementById('weekendWarning').style.display = 'none';
  } else {
    document.getElementById('afterHoursWarning').style.display = 'none';
    document.getElementById('weekendWarning').style.display = 'none';
  }
  
  // Generate clinical note
  generateClinicalNote(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod, troughDateTime, samplingDoseNum, infusionDuration);
}

// Helper function to convert 12H to 24H
function convertTo24Hour(hour12, ampm) {
  if (ampm === 'AM') {
    if (hour12 === 12) return 0; // 12 AM = 00:00
    return hour12;
  } else { // PM
    if (hour12 === 12) return 12; // 12 PM = 12:00
    return hour12 + 12;
  }
}

// =============================================================
// Time Calculation Functions
// =============================================================

function calculateTroughTime(firstMDDateTime, frequency, samplingDoseNum) {
  const troughDateTime = new Date(firstMDDateTime);
  
  // Calculate hours to add based on frequency and dose number
  let hoursToAdd = 0;
  
  if (frequency === 'EOD') {
    // 2nd dose = 1 interval = 48 hours
    hoursToAdd = 48;
  } else if (frequency === 'OD') {
    // 3rd dose = 2 intervals = 48 hours
    hoursToAdd = 48;
  } else if (frequency === 'BD') {
    // 4th dose = 3 intervals = 36 hours (12h each)
    hoursToAdd = 36;
  } else if (frequency === 'TDS') {
    // 4th dose = 3 intervals = 24 hours (8h each)
    hoursToAdd = 24;
  } else if (frequency === 'QID') {
    // 4th dose = 3 intervals = 18 hours (6h each)
    hoursToAdd = 18;
  }
  
  troughDateTime.setHours(troughDateTime.getHours() + hoursToAdd);
  
  // Subtract 30 minutes for pre-dose timing
  troughDateTime.setMinutes(troughDateTime.getMinutes() - 30);
  
  return troughDateTime;
}

function calculatePostdoseTime(troughDateTime, infusionDuration) {
  // Postdose = trough time + 30 min (to get back to dose time) + infusion duration + 1 hour
  const postdoseDateTime = new Date(troughDateTime);
  postdoseDateTime.setMinutes(postdoseDateTime.getMinutes() + 30); // Add back the 30 min
  postdoseDateTime.setHours(postdoseDateTime.getHours() + infusionDuration); // Add infusion duration
  postdoseDateTime.setHours(postdoseDateTime.getHours() + 1); // Add 1 hour wait
  
  return postdoseDateTime;
}

// =============================================================
// Display Functions
// =============================================================

function displayFrequencyNote(frequency) {
  const noteDiv = document.getElementById('frequencyNote');
  const times = STANDARD_TIMES[frequency];
  
  if (times && times.length > 0) {
    let timeStr = '';
    if (frequency === 'EOD') {
      timeStr = '6:00 AM';
    } else if (frequency === 'OD') {
      timeStr = '6:00 AM';
    } else if (frequency === 'BD') {
      timeStr = '6:00 AM & 6:00 PM';
    } else if (frequency === 'TDS') {
      timeStr = '6:00 AM, 2:00 PM & 10:00 PM';
    } else if (frequency === 'QID') {
      timeStr = '6:00 AM, 12:00 PM, 6:00 PM & 12:00 MN';
    }
    
    noteDiv.innerHTML = `<strong>Standard administration times for ${frequency} in HSgB:</strong> ${timeStr}<br>Consider adjusting dose times to align with HSgB standard administration times.`;
    noteDiv.style.display = 'block';
  } else {
    noteDiv.style.display = 'none';
  }
}

function displayTimeRoundingNote(inputHour12, inputMinute, inputAmPm, frequency) {
  const noteDiv = document.getElementById('timeRoundingNote');
  
  if (!frequency || !inputAmPm) {
    noteDiv.style.display = 'none';
    return;
  }
  
  // Convert to 24H for comparison
  const inputHour24 = convertTo24Hour(inputHour12, inputAmPm);
  const nearestTime = findNearestStandardTime(inputHour24, inputMinute, frequency);
  
  if (nearestTime) {
    const inputTime24 = `${inputHour24.toString().padStart(2, '0')}:${inputMinute.toString().padStart(2, '0')}`;
    
    if (inputTime24 !== nearestTime) {
      // Convert nearest time to 12H format for display
      const [h24, m] = nearestTime.split(':').map(Number);
      const displayHour = h24 === 0 ? 12 : (h24 > 12 ? h24 - 12 : h24);
      const displayAmPm = h24 >= 12 ? 'PM' : 'AM';
      const displayTime = `${displayHour}:${m.toString().padStart(2, '0')} ${displayAmPm}`;
      
      noteDiv.innerHTML = `💡 <strong>Suggestion:</strong> Consider rounding to the nearest standard time: <strong>${displayTime}</strong>`;
      noteDiv.style.display = 'block';
      noteDiv.style.color = '#FF6F00';
      noteDiv.style.fontWeight = '500';
    } else {
      noteDiv.style.display = 'none';
    }
  } else {
    noteDiv.style.display = 'none';
  }
}

function displaySummary(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod) {
  const summaryDiv = document.getElementById('summaryOutput');
  const ldDose = document.getElementById('ld_dose').value;
  
  let html = '';
  
  if (ldDose && ldDate && ldHour !== '' && ldMinute !== '' && ldAmPm !== '') {
    const ldHour24 = convertTo24Hour(parseInt(ldHour), ldAmPm);
    const ldDateTime = new Date(ldDate);
    ldDateTime.setHours(ldHour24, parseInt(ldMinute), 0, 0);
    const ldFormatted = formatDateTime(ldDateTime);
    html += `<p style="margin: 0 0 3px 0; font-size: 0.88rem;"><strong>Loading Dose:</strong> ${ldDose} mg given on ${ldFormatted.full}</p>`;
  }
  
  // Maintenance dose
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  const mdDateTime = new Date(mdDate);
  mdDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
  const mdFormatted = formatDateTime(mdDateTime);
  html += `<p style="margin: 0 0 3px 0; font-size: 0.88rem;"><strong>Maintenance Dose:</strong> ${dose} mg ${frequency}, first given on ${mdFormatted.full}</p>`;
  
  // Sampling method
  const methodText = samplingMethod === 'auc' ? 'AUC Sampling (Pre-dose + Post-dose)' : 'Trough Sampling (Pre-dose only)';
  html += `<p style="margin: 0; font-size: 0.88rem;"><strong>Sampling Method:</strong> ${methodText}</p>`;
  
  summaryDiv.innerHTML = html;
}

function displayTroughSampling(troughDateTime, samplingDoseNum) {
  const troughDiv = document.getElementById('troughOutput');
  const formatted = formatDateTime(troughDateTime);
  
  const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');
  
  troughDiv.innerHTML = `
    <p style="margin: 0; font-size: 1rem; font-weight: 700; color: #2E7D32;">${formatted.full}</p>
    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #666;">(30 minutes before the ${ordinal} maintenance dose)</p>
  `;
}

function displayPostdoseSampling(postdoseDateTime, samplingDoseNum, troughDateTime, infusionDuration) {
  const postdoseDiv = document.getElementById('postdoseOutput');
  const formatted = formatDateTime(postdoseDateTime);
  
  // Calculate the actual dose time (trough + 30 min)
  const doseTime = new Date(troughDateTime);
  doseTime.setMinutes(doseTime.getMinutes() + 30);
  const doseFormatted = formatDateTime(doseTime);
  
  const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');
  
  postdoseDiv.innerHTML = `
    <p style="margin: 0 0 4px 0; font-size: 0.82rem; font-style: italic; color: #555;">Assuming dose given on ${doseFormatted.full}, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''}:</p>
    <p style="margin: 0; font-size: 1rem; font-weight: 700; color: #1565C0;">${formatted.full}</p>
    <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #666;">(1 hour after completion of the ${ordinal} maintenance dose infusion)</p>
  `;
}

function displayAfterHoursWarning(troughDateTime, isAUC, infusionDuration) {
  lastWarningState = { kind: 'afterHours', troughDateTime: new Date(troughDateTime), isAUC, infusionDuration };
  renderWarningCard();
}

function displayWeekendWarning(troughDateTime, isAUC, infusionDuration) {
  lastWarningState = { kind: 'weekend', troughDateTime: new Date(troughDateTime), isAUC, infusionDuration };
  renderWarningCard();
}

// =============================================================
// Note Time Toggle Helpers
// =============================================================

function showNoteTimeToggle(type, isUrgent) {
  // Note time toggle removed — selection is handled in-card
}

// =============================================================
// Urgency Logic
// =============================================================

function setUrgency(urgent) {
  isUrgentCase = urgent;
  renderWarningCard();
}

// Returns next morning at 5:30am.
// If trough is 12:01am–5am, use same calendar day (just ~hours later).
// Otherwise (≥17:00), use next calendar day.
function getUrgentNextMorning(troughDateTime) {
  const h = troughDateTime.getHours();
  const result = new Date(troughDateTime);
  if (h < 5) {
    result.setHours(5, 30, 0, 0);
  } else {
    result.setDate(result.getDate() + 1);
    result.setHours(5, 30, 0, 0);
  }
  return result;
}

function getWarningScenario(kind, dt) {
  const day = dt.getDay(); // 0=Sun, 1–4=Mon–Thu, 5=Fri, 6=Sat
  const h   = dt.getHours();
  if (kind === 'afterHours') {
    return h < 5 ? 'weekday-early-morning' : 'weekday-aoh';
  }
  // weekend kind
  if ((day === 6 || day === 0) && h < 17) return 'weekend-daytime';
  if (day === 5 && h >= 17) return 'fri-evening';
  if (day === 6 && h >= 17) return 'sat-evening';
  return 'sun-evening'; // day === 0 && h >= 17
}

function renderWarningCard() {
  if (!lastWarningState) return;
  const { kind, troughDateTime, isAUC, infusionDuration } = lastWarningState;
  const scenario = getWarningScenario(kind, troughDateTime);

  const isWknd     = kind === 'weekend';
  const divId      = isWknd ? 'weekendWarning' : 'afterHoursWarning';
  const icon       = isWknd ? '📅' : '🕐';
  const title      = isWknd ? 'WEEKEND CONSIDERATION' : 'AFTER-HOURS CONSIDERATION';
  const titleColor = isWknd ? '#C62828' : '#E65100';
  const cardStyle  = isWknd
    ? 'background:#FFEBEE; border:3px solid #C62828; border-radius:8px; box-shadow:0 4px 8px rgba(198,40,40,0.2);'
    : 'background:#FFF3E0; border-left:4px solid #FF6F00; border-radius:8px;';

  const cardPadding = isWknd ? 'padding:12px 16px 12px;' : 'padding:14px 18px 12px;';

  const toggleHTML = `
    <div style="display:flex; gap:8px; margin-bottom:14px;">
      <button onclick="setUrgency(false)" style="flex:1; padding:8px 12px; border-radius:8px; border:2px solid ${!isUrgentCase ? '#E65100' : '#DDD'}; background:${!isUrgentCase ? '#FFF3E0' : '#F5F5F5'}; color:${!isUrgentCase ? '#BF360C' : '#999'}; font-weight:700; cursor:pointer; font-size:0.82rem; font-family:inherit;">Standard</button>
      <button onclick="setUrgency(true)"  style="flex:1; padding:8px 12px; border-radius:8px; border:2px solid ${ isUrgentCase ? '#C62828' : '#DDD'}; background:${ isUrgentCase ? '#FFEBEE' : '#F5F5F5'}; color:${ isUrgentCase ? '#C62828' : '#999'}; font-weight:700; cursor:pointer; font-size:0.82rem; font-family:inherit;">⚠️ Urgent</button>
    </div>`;

  const contentHTML = isUrgentCase
    ? buildUrgentWarningContent(scenario, troughDateTime, isAUC, infusionDuration)
    : buildNonUrgentWarningContent(kind, troughDateTime, isAUC, infusionDuration);

  document.getElementById(divId).innerHTML = `
    <div style="${cardStyle} ${cardPadding} margin:12px 0;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <span style="font-size:1.5rem;">${icon}</span>
        <strong style="font-size:1.05rem; color:${titleColor};">${title}</strong>
      </div>
      ${toggleHTML}
      ${contentHTML}
    </div>`;
  document.getElementById(divId).style.display = 'block';
}

// Shared white box helper for a sampling time entry
function buildTimeBox(label, labelColor, formattedDT, subtext, bold) {
  return `
    <div style="margin-bottom:8px;">
      <p style="margin:0 0 2px 0; font-size:0.82rem; font-weight:600; color:${labelColor};">${label}:</p>
      <p style="margin:0 0 2px 0; padding-left:14px; color:#333; ${bold ? 'font-weight:600;' : ''}">${formattedDT.full}</p>
      <p style="margin:0; padding-left:14px; font-size:0.8rem; color:#777;">${subtext}</p>
    </div>`;
}

function buildNonUrgentWarningContent(kind, troughDateTime, isAUC, infusionDuration) {
  // Always next calendar day for AOH; next working day for weekend
  let adjusted;
  if (kind === 'weekend') {
    adjusted = getNextWorkingDay(troughDateTime);
    adjusted.setHours(5, 30, 0, 0);
  } else {
    adjusted = new Date(troughDateTime);
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(5, 30, 0, 0);
  }

  // Update global adjusted state
  adjustedTroughDateTime = new Date(adjusted);
  if (isAUC) {
    const adj = new Date(adjusted);
    adj.setMinutes(adj.getMinutes() + 30);
    adj.setHours(adj.getHours() + infusionDuration + 1);
    adjustedPostdoseDateTime = adj;
  } else {
    adjustedPostdoseDateTime = null;
  }

  const troughFmt = formatDateTime(adjusted);
  const intro = kind === 'weekend'
    ? 'The calculated sampling time falls on a weekend. For non-urgent cases, consider postponing to the next working day. Choose the <strong>Urgent</strong> tab above if this is an urgent case (e.g. suspected toxicity).'
    : 'The calculated sampling time falls after office hours (5:00 PM – 4:00 AM). For non-urgent cases, consider taking the sample the following morning. Choose the <strong>Urgent</strong> tab above if this is an urgent case (e.g. suspected toxicity).';

  let html = `<p style="margin:0 0 12px 0; line-height:1.55; font-size:0.82rem; color:#B71C1C;">${intro}</p>`;
  html += `<div style="background:white; padding:12px; border-radius:6px; margin-bottom:12px;">`;
  html += buildTimeBox('Pre-dose (Trough)', '#2E7D32', troughFmt, '(30 minutes before 6:00 AM dose)', true);
  if (isAUC) {
    const postdose = new Date(adjusted);
    postdose.setMinutes(postdose.getMinutes() + 30);
    postdose.setHours(postdose.getHours() + infusionDuration + 1);
    html += buildTimeBox('Post-dose (Peak)', '#1565C0', formatDateTime(postdose), '(1 hour after infusion completion)', true);
  }
  html += `</div>`;

  // Confirmation button
  if (standardAdjustedConfirmed) {
    html += `
      <button onclick="confirmAdjustedTime()" style="width:100%; padding:10px 14px; border-radius:8px; border:2px solid #2E7D32; background:#E8F5E9; color:#1B5E20; font-weight:700; cursor:pointer; font-size:0.85rem; font-family:inherit; margin-bottom:6px;">
        ✔ Using adjusted time in clinical note &nbsp;·&nbsp; <span style="font-weight:400; font-size:0.8rem;">Tap to revert to original</span>
      </button>`;
  } else {
    html += `
      <button onclick="confirmAdjustedTime()" style="width:100%; padding:10px 14px; border-radius:8px; border:2px solid #FF6F00; background:#FFF3E0; color:#BF360C; font-weight:700; cursor:pointer; font-size:0.85rem; font-family:inherit; margin-bottom:6px;">
        Use this adjusted time in clinical note →
      </button>`;
  }
  html += `<p style="margin:0; font-size:0.75rem; color:#999; font-style:italic;">* The clinical note template below will reflect whichever time is confirmed here.</p>`;

  if (kind === 'weekend') {
    html += `<p style="margin:8px 0 0 0; font-size:0.85rem; font-style:italic; color:#666;"><strong>Note:</strong> This calculator does not account for Malaysian public holidays. Please verify and adjust accordingly.</p>`;
  }
  return html;
}

function buildUrgentWarningContent(scenario, troughDateTime, isAUC, infusionDuration) {

  // ── Weekend daytime: simplified card, no options ──
  if (scenario === 'weekend-daytime') {
    adjustedTroughDateTime = null;
    adjustedPostdoseDateTime = null;

    return `
      <div style="background:white; padding:14px; border-radius:8px; border-left:4px solid #757575; margin-bottom:10px;">
        <p style="margin:0 0 8px 0; line-height:1.6; color:#333;">You may proceed with the <strong>original sampling time</strong> as calculated above.</p>
      </div>
      <div style="display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:#FFEBEE; border-radius:6px;">
        <span style="font-size:1rem; flex-shrink:0;">⚠️</span>
        <p style="margin:0; font-size:0.88rem; font-weight:700; color:#C62828;">Passover to TDM pharmacist is COMPULSORY for urgent cases.</p>
      </div>`;
  }

  // ── All other urgent scenarios: Option A + Option B ──
  const nextMorning = getUrgentNextMorning(troughDateTime);

  // Update global adjusted state (Option B) for note toggle
  adjustedTroughDateTime = new Date(nextMorning);
  if (isAUC) {
    const adj = new Date(nextMorning);
    adj.setMinutes(adj.getMinutes() + 30);
    adj.setHours(adj.getHours() + infusionDuration + 1);
    adjustedPostdoseDateTime = adj;
  } else {
    adjustedPostdoseDateTime = null;
  }
  showNoteTimeToggle('urgent', true);

  // Preferred badge for fri/sat/sun evenings
  const showPreferred = ['fri-evening', 'sat-evening', 'sun-evening'].includes(scenario);
  const preferredBadge = showPreferred
    ? `<span style="background:#2E7D32; color:white; font-size:0.7rem; padding:2px 7px; border-radius:10px; font-weight:700; margin-left:6px; vertical-align:middle;">⭐ Preferred</span>`
    : '';

  const troughOrigFmt = formatDateTime(troughDateTime);
  const troughAdjFmt  = formatDateTime(nextMorning);

  // Post-dose times
  const postdoseOrig = isAUC ? calculatePostdoseTime(troughDateTime, infusionDuration) : null;
  const postdoseAdj  = isAUC ? (() => {
    const a = new Date(nextMorning);
    a.setMinutes(a.getMinutes() + 30);
    a.setHours(a.getHours() + infusionDuration + 1);
    return a;
  })() : null;

  const doseTimeOrig = isAUC ? (() => {
    const d = new Date(troughDateTime);
    d.setMinutes(d.getMinutes() + 30);
    return d;
  })() : null;

  let html = `<p style="margin:0 0 10px 0; line-height:1.55; font-size:0.82rem; color:#B71C1C;">The calculated sampling time falls outside routine hours. Two options are available for this <strong>urgent case</strong> — select the option you prefer to be reflected in the clinical note template.</p>`;

  // Default to Option B on first render if nothing selected yet
  if (!urgentSelectedOption) urgentSelectedOption = 'B';

  // Prompt bar
  html += `
    <div style="display:flex; align-items:center; gap:7px; background:#FFF8E1; border:1px solid #FFD54F; border-radius:6px; padding:7px 11px; margin-bottom:10px;">
      <span style="font-size:0.85rem;">👇</span>
      <span style="font-size:0.78rem; font-weight:600; color:#E65100;">Select one option below — the clinical note template will update accordingly.</span>
    </div>`;

  const selA = urgentSelectedOption === 'A';
  const selB = urgentSelectedOption === 'B';
  const styleA = selA ? 'border-left:3px solid #1565C0; background:#F0F4FF;' : 'border-left:3px solid #DDD; background:white;';
  const styleB = selB ? 'border-left:3px solid #2E7D32; background:#F1F8E9;' : 'border-left:3px solid #DDD; background:white;';
  const cursorStyle = 'cursor:pointer; transition: background 0.15s, border-color 0.15s;';

  // Option A — tonight
  html += `
    <div id="urgentOptA" onclick="selectUrgentOption('A')" style="padding:12px 14px; border-radius:8px; margin-bottom:10px; ${styleA} ${cursorStyle}">
      <p style="margin:0 0 9px 0; font-size:0.78rem; font-weight:700; color:${selA ? '#1565C0' : '#555'}; text-transform:uppercase; letter-spacing:0.6px;">
        ${selA ? '✔ ' : ''}Option A — Tonight (As Calculated)
      </p>`;
  html += buildTimeBox('Pre-dose (Trough)', '#2E7D32', troughOrigFmt, '(30 minutes before the scheduled dose)', false);
  if (isAUC && postdoseOrig && doseTimeOrig) {
    const doseOrigFmt = formatDateTime(doseTimeOrig);
    html += buildTimeBox('Post-dose (Peak)', '#1565C0', formatDateTime(postdoseOrig),
      `(1 hour after infusion completion; dose at ${doseOrigFmt.time}, infused over ${infusionDuration} hr)`, false);
  }
  html += `</div>`;

  // Option B — next morning (preferred for fri/sat/sun)
  html += `
    <div id="urgentOptB" onclick="selectUrgentOption('B')" style="padding:12px 14px; border-radius:8px; margin-bottom:10px; ${styleB} ${cursorStyle}">
      <p style="margin:0 0 9px 0; font-size:0.78rem; font-weight:700; color:${selB ? '#2E7D32' : '#555'}; text-transform:uppercase; letter-spacing:0.6px;">
        ${selB ? '✔ ' : ''}Option B — Next Morning ${preferredBadge}
      </p>`;
  html += buildTimeBox('Pre-dose (Trough)', '#2E7D32', troughAdjFmt, '(30 minutes before 6:00 AM dose)', true);
  if (isAUC && postdoseAdj) {
    html += buildTimeBox('Post-dose (Peak)', '#1565C0', formatDateTime(postdoseAdj),
      `(1 hour after infusion completion; dose at 6:00 AM, infused over ${infusionDuration} hr)`, true);
  }
  html += `</div>`;

  // Passover requirement
  html += `
    <div style="display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:#FFEBEE; border-radius:6px;">
      <span style="font-size:1rem; flex-shrink:0;">⚠️</span>
      <p style="margin:0; font-size:0.88rem; font-weight:700; color:#C62828;">Passover to TDM pharmacist is COMPULSORY for urgent cases.</p>
    </div>`;

  return html;
}

// Called when user clicks Option A or B in the urgent warning card
function selectUrgentOption(option) {
  urgentSelectedOption = option;

  // Re-render the warning card so selection state updates visually
  renderWarningCard();

  // Regenerate the clinical note to reflect the chosen option
  refreshClinicalNoteFromToggle();
}

// Called when user clicks the "I agree" / "Use original time" button in standard warning card
function confirmAdjustedTime() {
  standardAdjustedConfirmed = !standardAdjustedConfirmed;
  renderWarningCard();
  refreshClinicalNoteFromToggle();
}

// Called when the user clicks Original / Adjusted toggle
function refreshClinicalNoteFromToggle() {
  // Re-read all the inputs and re-call generateClinicalNote with current state
  const ldDate   = document.getElementById('ld_date').value;
  const ldHour   = document.getElementById('ld_hour').value;
  const ldMinute = document.getElementById('ld_minute').value;
  const ldAmPm   = document.getElementById('ld_ampm').value;
  const mdDate   = document.getElementById('md_date').value;
  const mdHour   = document.getElementById('md_hour').value;
  const mdMinute = document.getElementById('md_minute').value;
  const mdAmPm   = document.getElementById('md_ampm').value;
  const dose     = document.getElementById('dose').value;
  const frequency = document.getElementById('frequency').value;
  const samplingMethod = document.getElementById('samplingMethod').value;

  if (!mdDate || !mdHour || !mdMinute || !mdAmPm || !dose || !frequency || !samplingMethod) return;
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  const firstMDDateTime = new Date(mdDate);
  firstMDDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);

  const samplingDoseNum  = SAMPLING_DOSE_NUMBER[frequency];
  const infusionDuration = INFUSION_DURATION[dose];
  const troughDateTime   = calculateTroughTime(firstMDDateTime, frequency, samplingDoseNum);

  generateClinicalNote(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod, troughDateTime, samplingDoseNum, infusionDuration);
}

// =============================================================
// Effective time helper — respects urgent option selection
// =============================================================

function getEffectiveUseAdjusted() {
  if (isUrgentCase && lastWarningState) {
    return urgentSelectedOption === 'B' && adjustedTroughDateTime !== null;
  }
  return standardAdjustedConfirmed && adjustedTroughDateTime !== null;
}

// =============================================================
// Clinical Note Generation
// =============================================================

function generateClinicalNote(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod, troughDateTime, samplingDoseNum, infusionDuration) {
  
  // Determine whether to use original or adjusted times
  const useAdjusted = getEffectiveUseAdjusted();
  const effectiveTrough  = useAdjusted ? adjustedTroughDateTime : troughDateTime;
  const effectivePostdose = useAdjusted
    ? adjustedPostdoseDateTime
    : (samplingMethod === 'auc' ? calculatePostdoseTime(troughDateTime, infusionDuration) : null);

  // Patient Summary — plain dash style
  let summaryHTML = '';
  const ldDose = document.getElementById('ld_dose').value;
  
  if (ldDose && ldDate && ldHour !== '' && ldMinute !== '' && ldAmPm !== '') {
    const ldHour24 = convertTo24Hour(parseInt(ldHour), ldAmPm);
    const ldDateTime = new Date(ldDate);
    ldDateTime.setHours(ldHour24, parseInt(ldMinute), 0, 0);
    const ldFormatted = formatDateTime(ldDateTime);
    summaryHTML += `<p style="margin: 0 0 3px 0;">- <strong>LD:</strong> ${ldDose} mg given on ${ldFormatted.full}</p>`;
  }
  
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  const mdDateTime = new Date(mdDate);
  mdDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
  const mdFormatted = formatDateTime(mdDateTime);
  summaryHTML += `<p style="margin: 0 0 3px 0;">- <strong>MD:</strong> ${dose} mg ${frequency}, first given on ${mdFormatted.full}</p>`;
  
  const methodText = samplingMethod === 'auc' ? 'AUC Sampling (Pre-dose + Post-dose)' : 'Trough Sampling (Pre-dose only)';
  summaryHTML += `<p style="margin: 0 0 3px 0;">- <strong>Sampling Method:</strong> ${methodText}</p>`;
  
  document.getElementById('notePatientSummary').innerHTML = summaryHTML;
  
  // TDM Instructions — plain dash style, Adjusted badge appears dynamically
  const troughFormatted = formatDateTime(effectiveTrough);
  const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');
  const adjustedBadge = useAdjusted
    ? ` <span style="background-color:#FF6F00; color:white; font-size:0.75rem; padding:2px 7px; border-radius:10px; font-weight:600; vertical-align:middle;">Adjusted</span>`
    : '';

  let tdmHTML = '';

  tdmHTML += `<p style="margin: 0 0 2px 0;">- <strong>Pre-dose (Trough):</strong>${adjustedBadge}</p>`;
  tdmHTML += `<p style="margin: 0 0 2px 0; padding-left: 14px;">${troughFormatted.full}</p>`;
  if (useAdjusted) {
    tdmHTML += `<p style="margin: 0 0 10px 14px; font-size: 0.88rem; color: #555;">(30 minutes before 6:00 AM dose)</p>`;
  } else {
    tdmHTML += `<p style="margin: 0 0 10px 14px; font-size: 0.88rem; color: #555;">(30 minutes before the ${ordinal} maintenance dose)</p>`;
  }

  if (samplingMethod === 'auc' && effectivePostdose) {
    const postdoseFormatted = formatDateTime(effectivePostdose);
    tdmHTML += `<p style="margin: 0 0 2px 0;">- <strong>Post-dose (Peak):</strong>${adjustedBadge}</p>`;
    tdmHTML += `<p style="margin: 0 0 2px 0; padding-left: 14px;">${postdoseFormatted.full}</p>`;
    if (useAdjusted) {
      tdmHTML += `<p style="margin: 0 0 0 14px; font-size: 0.88rem; color: #555;">(1 hour after infusion completion; assuming dose given at 6:00 AM, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''})</p>`;
    } else {
      const doseTime = new Date(troughDateTime);
      doseTime.setMinutes(doseTime.getMinutes() + 30);
      const doseFormatted = formatDateTime(doseTime);
      tdmHTML += `<p style="margin: 0 0 0 14px; font-size: 0.88rem; color: #555;">(1 hour after infusion completion; assuming dose given at ${doseFormatted.time}, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''})</p>`;
    }
  }

  // Urgent note line — appended when case is urgent and a warning was triggered
  if (isUrgentCase && lastWarningState) {
    tdmHTML += `<p style="margin: 10px 0 0 0;">- <strong>Note:</strong> Recommended TDM sampling given outside of routine hours / on weekend as this case was deemed urgent by the prescriber.</p>`;
  }

  document.getElementById('noteTDMInstructions').innerHTML = tdmHTML;
}

// =============================================================
// Copy Clinical Note Function
// =============================================================

function copyClinicalNote() {
  const htmlContentDiv = document.getElementById('clinicalNoteContent');
  
  // Create temporary container
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContentDiv.innerHTML;
  
  // Apply styles
  tempDiv.setAttribute('style', 'font-family: Arial, sans-serif; font-size: 10pt;');
  
  const htmlToCopy = tempDiv.innerHTML;
  
  // Plain text version — built directly (don't scrape innerHTML for TDM section)
  const useAdjusted = getEffectiveUseAdjusted();
  const summaryDiv = document.getElementById('notePatientSummary');
  const summaryText = summaryDiv ? summaryDiv.innerText.trim() : '';

  let textToCopy = '';
  textToCopy += 'VANCOMYCIN TDM SAMPLING PLAN\n';
  textToCopy += '========================================\n';
  textToCopy += 'PATIENT SUMMARY\n';
  textToCopy += summaryText + '\n';
  textToCopy += '----------------------------------------\n';
  textToCopy += 'TDM SAMPLING INSTRUCTIONS\n';

  // Rebuild TDM text cleanly
  const dose      = document.getElementById('dose').value;
  const frequency = document.getElementById('frequency').value;
  const samplingMethod = document.getElementById('samplingMethod').value;
  const mdDate   = document.getElementById('md_date').value;
  const mdHour   = document.getElementById('md_hour').value;
  const mdMinute = document.getElementById('md_minute').value;
  const mdAmPm   = document.getElementById('md_ampm').value;

  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  const firstMDDateTime = new Date(mdDate);
  firstMDDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
  const samplingDoseNum  = SAMPLING_DOSE_NUMBER[frequency];
  const infusionDuration = INFUSION_DURATION[dose];
  const troughDateTime   = calculateTroughTime(firstMDDateTime, frequency, samplingDoseNum);
  const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');

  const effectiveTrough   = useAdjusted ? adjustedTroughDateTime : troughDateTime;
  const effectivePostdose = useAdjusted
    ? adjustedPostdoseDateTime
    : (samplingMethod === 'auc' ? calculatePostdoseTime(troughDateTime, infusionDuration) : null);

  const troughFmt = formatDateTime(effectiveTrough);

  if (useAdjusted) {
    textToCopy += `- Pre-dose (Trough): (After-office hour / Weekend sampling adjustment)\n`;
    textToCopy += `  ${troughFmt.full}\n`;
    textToCopy += `  (30 minutes before 6:00 AM dose)\n`;
  } else {
    textToCopy += `- Pre-dose (Trough):\n`;
    textToCopy += `  ${troughFmt.full}\n`;
    textToCopy += `  (30 minutes before the ${ordinal} maintenance dose)\n`;
  }

  if (samplingMethod === 'auc' && effectivePostdose) {
    const postFmt = formatDateTime(effectivePostdose);
    if (useAdjusted) {
      textToCopy += `- Post-dose (Peak): (After-office hour / Weekend sampling adjustment)\n`;
      textToCopy += `  ${postFmt.full}\n`;
      textToCopy += `  (1 hour after infusion completion; assuming dose given at 6:00 AM, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''})\n`;
    } else {
      const doseTime = new Date(troughDateTime);
      doseTime.setMinutes(doseTime.getMinutes() + 30);
      const doseFmt = formatDateTime(doseTime);
      textToCopy += `- Post-dose (Peak):\n`;
      textToCopy += `  ${postFmt.full}\n`;
      textToCopy += `  (1 hour after infusion completion; assuming dose given at ${doseFmt.time}, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''})\n`;
    }
  }

  if (isUrgentCase && lastWarningState) {
    textToCopy += `- Note: Recommended TDM sampling given outside of routine hours / on weekend as this case was deemed urgent by the prescriber.\n`;
  }

  textToCopy += '----------------------------------------\n';
  textToCopy += 'REMINDERS\n';
  textToCopy += '- TDM blood sample should be obtained via venipuncture whenever possible, from the arm opposite to drug administration.\n';
  textToCopy += '- Do not collect TDM samples from central lines (e.g. PICC, CVC, or other central venous catheters).\n';
  textToCopy += '- Document the exact timing of dose administration and sample collection in the patient\'s medical record.\n';
  textToCopy += '========================================\n';
  
  // Copy to clipboard
  const blobHtml = new Blob([htmlToCopy], { type: 'text/html' });
  const blobPlain = new Blob([textToCopy], { type: 'text/plain' });
  
  if (!navigator.clipboard || !navigator.clipboard.write) {
    alert("Your browser does not support copying rich text. Only plain text will be copied.");
    navigator.clipboard.writeText(textToCopy);
    return;
  }
  
  const clipboardItem = new ClipboardItem({
    'text/plain': blobPlain,
    'text/html': blobHtml
  });
  
  navigator.clipboard.write([clipboardItem]).then(() => {
    const button = document.querySelector('.copy-button');
    const originalText = button.innerHTML;
    button.innerHTML = '✅ Copied!';
    setTimeout(() => {
      button.innerHTML = originalText;
    }, 1500);
  }).catch(err => {
    console.error('Could not copy: ', err);
    alert('Failed to copy. Please check browser permissions.');
  });
}
