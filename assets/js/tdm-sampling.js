// =============================================================
// tdm-sampling.js — Vancomycin TDM Sampling Guide Calculator
// =============================================================

let hasScrolledTDM = false;

// Ward-specific admin times (set when frequency is selected or changed)
let currentAdminTimes = null;

// Whether the 2nd scheduled dose was omitted due to short gap from 1st MD
let secondDoseOmitted = null; // null = not applicable/not yet selected, false = given, true = omitted

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

// Labels for admin time inputs per frequency slot
const ADMIN_TIME_LABELS = {
  'EOD': ['Every-other-day'],
  'OD':  ['Daily'],
  'BD':  ['Morning', 'Evening'],
  'TDS': ['Dose 1', 'Dose 2', 'Dose 3'],
  'QID': ['Dose 1', 'Dose 2', 'Dose 3', 'Dose 4']
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
  document.getElementById('tdm_tdmOutput').style.display = 'none';
  
  // Reset admin times section
  const adminSection = document.getElementById('adminTimesSection');
  if (adminSection) adminSection.style.display = 'none';
  currentAdminTimes = null;

  // Reset dose omission prompt
  const gapPrompt = document.getElementById('doseGapPrompt');
  if (gapPrompt) gapPrompt.style.display = 'none';
  secondDoseOmitted = null;
  
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
  
  // Sync admin times from inputs (ensures currentAdminTimes is always current)
  if (frequency) {
    currentAdminTimes = getAdminTimesFromInputs(frequency);
  }

  const outputDiv = document.getElementById('tdm_tdmOutput');
  
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

  // Check gap to next scheduled dose and prompt if < 6h
  checkAndShowDoseGapPrompt(firstMDDateTime, frequency);
  
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
  const adminTimes = currentAdminTimes || STANDARD_TIMES[frequency];
  const extraSlot  = secondDoseOmitted === true ? 1 : 0;
  const slotsNeeded = samplingDoseNum - 1 + extraSlot;
  const slots = generateAdminSlots(firstMDDateTime, adminTimes, frequency, slotsNeeded);
  const slotIndex = samplingDoseNum - 2 + extraSlot;
  const nthDoseDateTime = slots[slotIndex];

  // Fallback to interval-based method if slot generation fails
  if (!nthDoseDateTime) {
    const fallback = new Date(firstMDDateTime);
    const hoursMap = { EOD: 48, OD: 48, BD: 36, TDS: 24, QID: 18 };
    fallback.setHours(fallback.getHours() + (hoursMap[frequency] || 0));
    fallback.setMinutes(fallback.getMinutes() - 30);
    return fallback;
  }

  const troughDateTime = new Date(nthDoseDateTime);
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
    
    noteDiv.innerHTML = `<span style="font-size:0.78rem;"><strong>Standard administration times for ${frequency} in HSgB:</strong> ${timeStr}<br>Consider adjusting dose times to align with HSgB standard administration times.</span>`;
    noteDiv.style.display = 'block';
  } else {
    noteDiv.style.display = 'none';
  }
}

function displayTimeRoundingNote(inputHour12, inputMinute, inputAmPm, frequency) {
  // Removed — rounding suggestion no longer shown
  document.getElementById('timeRoundingNote').style.display = 'none';
}

function displaySummary(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod) {
  const summaryDiv = document.getElementById('tdm_summaryOutput');
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

// Returns next adjusted trough time (30 min before first admin time of day).
// If trough is early morning (before adjusted trough time), use same calendar day.
// Otherwise, use next calendar day.
function getUrgentNextMorning(troughDateTime) {
  const adminTime = (currentAdminTimes || STANDARD_TIMES['OD'])[0];
  const [ah, am] = adminTime.split(':').map(Number);
  const adjustedMins = ah * 60 + am - 30;
  const adjH = Math.floor(adjustedMins / 60);
  const adjM = adjustedMins % 60;

  const h = troughDateTime.getHours();
  const result = new Date(troughDateTime);
  if (h < adjH) {
    // Very early morning — same calendar day
    result.setHours(adjH, adjM, 0, 0);
  } else {
    result.setDate(result.getDate() + 1);
    result.setHours(adjH, adjM, 0, 0);
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
    <div style="margin-bottom:10px;">
      <div style="font-size:0.75rem; font-weight:600; color:#888; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:6px;">Clinical Urgency</div>
      <div style="display:flex; gap:8px;">
        <button onclick="setUrgency(false)" style="flex:1; padding:8px 12px; border-radius:8px; border:2px solid ${!isUrgentCase ? '#E65100' : '#DDD'}; background:${!isUrgentCase ? '#FFF3E0' : '#F5F5F5'}; color:${!isUrgentCase ? '#BF360C' : '#999'}; font-weight:700; cursor:pointer; font-size:0.82rem; font-family:inherit;">Non-urgent</button>
        <button onclick="setUrgency(true)"  style="flex:1; padding:8px 12px; border-radius:8px; border:2px solid ${ isUrgentCase ? '#C62828' : '#DDD'}; background:${ isUrgentCase ? '#FFEBEE' : '#F5F5F5'}; color:${ isUrgentCase ? '#C62828' : '#999'}; font-weight:700; cursor:pointer; font-size:0.82rem; font-family:inherit;">⚠️ Urgent</button>
      </div>
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
  // Compute adjusted trough = 30 min before first admin time of the day
  const adminTime = (currentAdminTimes || STANDARD_TIMES['OD'])[0];
  const [ah, am] = adminTime.split(':').map(Number);
  const adjustedMins = ah * 60 + am - 30;
  const adjH = Math.floor(adjustedMins / 60);
  const adjM = adjustedMins % 60;
  const adminDisplayTime = adminTimeToDisplay(adminTime);

  let adjusted;
  if (kind === 'weekend') {
    adjusted = getNextWorkingDay(troughDateTime);
    adjusted.setHours(adjH, adjM, 0, 0);
  } else {
    adjusted = new Date(troughDateTime);
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(adjH, adjM, 0, 0);
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
    ? 'The calculated sampling time falls on a weekend. For non-urgent cases, consider postponing to the next working day.<br>Select the <strong>Urgent</strong> tab above for urgent cases (e.g., suspected toxicity or patients at high risk of nephrotoxicity).'
    : 'The calculated sampling time falls after office hours (5:00 PM – 4:00 AM). For non-urgent cases, consider taking the sample the following morning. Choose the <strong>Urgent</strong> tab above if this is an urgent case (e.g. suspected toxicity).';

  let html = `<p style="margin:0 0 12px 0; line-height:1.55; font-size:0.82rem; color:#B71C1C;">${intro}</p>`;

  // Prompt bar
  html += `
    <div style="display:flex; align-items:flex-start; gap:7px; background:#FFF8E1; border:1px solid #FFD54F; border-radius:6px; padding:7px 11px; margin-bottom:10px;">
      <span style="font-size:0.85rem; flex-shrink:0;">👇</span>
      <span style="font-size:0.78rem; font-weight:600; color:#E65100; line-height:1.45;">Select the option below if you agree with the adjusted timing — the clinical note template will update automatically. Tap again to revert to the original recommendation.</span>
    </div>`;

  // Tappable timing container
  const confirmed = standardAdjustedConfirmed;
  const containerStyle = confirmed
    ? 'border:2px solid #2E7D32; background:#F1F8E9;'
    : 'border:2px solid #DDD; background:white;';
  const headerLabel = confirmed
    ? `<span style="font-size:0.78rem; font-weight:700; color:#2E7D32; text-transform:uppercase; letter-spacing:0.6px;">✔ Adjusted Timing — Applied to Clinical Note</span>`
    : `<span style="font-size:0.78rem; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:0.6px;">Adjusted Timing</span>`;

  html += `
    <div onclick="confirmAdjustedTime()" style="padding:12px 14px; border-radius:8px; margin-bottom:8px; ${containerStyle} cursor:pointer; transition:background 0.15s, border-color 0.15s;">
      <p style="margin:0 0 9px 0;">${headerLabel}</p>`;
  html += buildTimeBox('Pre-dose (Trough)', '#2E7D32', troughFmt, `(30 minutes before ${adminDisplayTime} dose)`, true);
  if (isAUC) {
    const postdose = new Date(adjusted);
    postdose.setMinutes(postdose.getMinutes() + 30);
    postdose.setHours(postdose.getHours() + infusionDuration + 1);
    html += buildTimeBox('Post-dose (Peak)', '#1565C0', formatDateTime(postdose), '(1 hour after infusion completion)', true);
  }
  html += `</div>`;

  if (kind === 'weekend') {
    html += `<p style="margin:8px 0 0 0; font-size:0.85rem; font-style:italic; color:#666;"><strong>Note:</strong> This calculator does not account for Malaysian public holidays. Please verify and adjust accordingly.</p>`;
  }
  return html;
}

function buildUrgentWarningContent(scenario, troughDateTime, isAUC, infusionDuration) {

  // -- Weekend daytime: simplified card, no options --
  if (scenario === 'weekend-daytime') {
    adjustedTroughDateTime = null;
    adjustedPostdoseDateTime = null;

    const wdBtnConfirmed = !standardAdjustedConfirmed;
    const wdBtnStyle = wdBtnConfirmed
      ? 'border:2px solid #2E7D32; background:#E8F5E9; color:#1B5E20;'
      : 'border:2px solid #5C6BC0; background:#EEF0FF; color:#283593;';
    const wdBtnLabel = wdBtnConfirmed
      ? '&#x2714; Using original calculated time in clinical notes &mdash; urgent case'
      : 'Use original calculated time in clinical notes &mdash; urgent case \u2192';

    return `
      <div style="background:white; padding:14px; border-radius:8px; border-left:4px solid #757575; margin-bottom:10px;">
        <p style="margin:0 0 8px 0; line-height:1.6; color:#333;">You may proceed with the <strong>original sampling time</strong> as calculated above.</p>
      </div>
      <button onclick="confirmUrgentOriginalTime()" style="width:100%; padding:10px 14px; border-radius:8px; ${wdBtnStyle} font-weight:700; cursor:pointer; font-size:0.85rem; font-family:inherit; margin:10px 0 6px 0;">${wdBtnLabel}</button>
      <p style="margin:0 0 10px 0; font-size:0.75rem; color:#999; font-style:italic;">* The clinical note template will use the original sampling time above and include an urgent case note.</p>
      <div style="display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:#FFEBEE; border-radius:6px;">
        <span style="font-size:1rem; flex-shrink:0;">&#x26A0;&#xFE0F;</span>
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
  html += buildTimeBox('Pre-dose (Trough)', '#2E7D32', troughAdjFmt, `(30 minutes before ${adminTimeToDisplay((currentAdminTimes || STANDARD_TIMES['OD'])[0])} dose)`, true);
  if (isAUC && postdoseAdj) {
    html += buildTimeBox('Post-dose (Peak)', '#1565C0', formatDateTime(postdoseAdj),
      `(1 hour after infusion completion; dose at ${adminTimeToDisplay((currentAdminTimes || STANDARD_TIMES['OD'])[0])}, infused over ${infusionDuration} hr)`, true);
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
  // Tap again to deselect and revert to original
  urgentSelectedOption = urgentSelectedOption === option ? null : option;
  // Option A = use original time; mirror this back to the standard toggle too
  if (option === 'A') standardAdjustedConfirmed = false;

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

// Called by the "Use original calculated time" button in the urgent weekend-daytime card
function confirmUrgentOriginalTime() {
  // Explicitly clear the standard adjusted toggle so switching back to Standard shows it as unclicked
  standardAdjustedConfirmed = false;
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
  
  if (secondDoseOmitted === true) {
    const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');
    summaryHTML += `<p style="margin: 0 0 3px 0;">- <strong>Note:</strong> 2nd scheduled dose omitted (&lt;6h gap from 1st MD); TDM based on ${ordinal} <em>administered</em> dose.</p>`;
  }
  
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
    tdmHTML += `<p style="margin: 0 0 10px 14px; font-size: 0.88rem; color: #555;">(30 minutes before ${adminTimeToDisplay((currentAdminTimes || STANDARD_TIMES['OD'])[0])} dose)</p>`;
  } else {
    tdmHTML += `<p style="margin: 0 0 10px 14px; font-size: 0.88rem; color: #555;">(30 minutes before the ${ordinal} maintenance dose)</p>`;
  }

  if (samplingMethod === 'auc' && effectivePostdose) {
    const postdoseFormatted = formatDateTime(effectivePostdose);
    tdmHTML += `<p style="margin: 0 0 2px 0;">- <strong>Post-dose (Peak):</strong>${adjustedBadge}</p>`;
    tdmHTML += `<p style="margin: 0 0 2px 0; padding-left: 14px;">${postdoseFormatted.full}</p>`;
    if (useAdjusted) {
      tdmHTML += `<p style="margin: 0 0 0 14px; font-size: 0.88rem; color: #555;">(1 hour after infusion completion; assuming dose given at ${adminTimeToDisplay((currentAdminTimes || STANDARD_TIMES['OD'])[0])}, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''})</p>`;
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
// Admin Times — Helper, UI, and Slot Generation
// =============================================================

// Convert "HH:MM" (24h) → "H:MM AM/PM" display
function adminTimeToDisplay(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h === 0 ? 12 : (h > 12 ? h - 12 : h);
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// Show / rebuild the admin times input section when frequency changes
function showAdminTimesSection(frequency) {
  const section   = document.getElementById('adminTimesSection');
  const container = document.getElementById('adminTimesInputs');
  if (!section || !container) return;

  if (!frequency) {
    section.style.display = 'none';
    currentAdminTimes = null;
    secondDoseOmitted = null;
    const gapPrompt = document.getElementById('doseGapPrompt');
    if (gapPrompt) gapPrompt.style.display = 'none';
    return;
  }

  const defaultTimes = STANDARD_TIMES[frequency] || [];
  const labels       = ADMIN_TIME_LABELS[frequency] || [];
  const useGrid      = frequency === 'QID'; // 2×2 for four fields

  container.style.display              = useGrid ? 'grid' : 'flex';
  container.style.gridTemplateColumns  = useGrid ? '1fr 1fr' : '';
  container.style.flexWrap             = useGrid ? ''        : 'wrap';
  container.style.gap                  = '8px';

  container.innerHTML = defaultTimes.map((time, i) => `
    <div style="display:flex;flex-direction:column;gap:3px;min-width:90px;flex:1;">
      <label style="font-size:0.72rem;color:#666;font-weight:600;">${labels[i] || ('Dose ' + (i + 1))}</label>
      <input type="time" id="adminTime_${i}" value="${time}"
        oninput="onAdminTimesChange()"
        style="height:36px;padding:0 8px;border:1.5px solid #CCC;border-radius:6px;
               font-size:0.9rem;font-family:inherit;box-sizing:border-box;width:100%;
               color:#333;background:#fff;">
    </div>`).join('');

  currentAdminTimes = [...defaultTimes];
  section.style.display = 'block';
}

// Read current values from admin time inputs
function getAdminTimesFromInputs(frequency) {
  const defaultTimes = STANDARD_TIMES[frequency] || [];
  return defaultTimes.map((def, i) => {
    const el = document.getElementById(`adminTime_${i}`);
    return (el && el.value) ? el.value : def;
  });
}

// Reset inputs to HSgB standard times
function resetAdminTimes() {
  const frequency = document.getElementById('frequency').value;
  if (!frequency) return;
  const defaultTimes = STANDARD_TIMES[frequency] || [];
  defaultTimes.forEach((time, i) => {
    const el = document.getElementById(`adminTime_${i}`);
    if (el) el.value = time;
  });
  currentAdminTimes = [...defaultTimes];
  calculateTDM();
}

// Triggered on every admin time input change — update global and recalculate
function onAdminTimesChange() {
  const frequency = document.getElementById('frequency').value;
  if (!frequency) return;
  currentAdminTimes = getAdminTimesFromInputs(frequency);
  calculateTDM();
}

// =============================================================
// Dose Gap Prompt (< 6h between 1st MD and 2nd scheduled dose)
// =============================================================

function checkAndShowDoseGapPrompt(firstMDDateTime, frequency) {
  const promptDiv = document.getElementById('doseGapPrompt');
  if (!promptDiv || !frequency || !currentAdminTimes) {
    if (promptDiv) promptDiv.style.display = 'none';
    return;
  }

  // Get only the very first slot after firstMD
  const slots = generateAdminSlots(firstMDDateTime, currentAdminTimes, frequency, 1);
  if (!slots.length) { promptDiv.style.display = 'none'; return; }

  const nextSlot  = slots[0];
  const gapHours  = (nextSlot - firstMDDateTime) / 3600000;

  if (gapHours >= 6) {
    promptDiv.style.display = 'none';
    if (secondDoseOmitted !== null) secondDoseOmitted = null; // auto-reset if gap widens
    return;
  }

  // Gap < 6h — render prompt
  const gapText = gapHours < 1
    ? `${Math.round(gapHours * 60)} min`
    : `${gapHours.toFixed(1)} hrs`;
  const nextSlotFmt   = formatDateTime(nextSlot);
  const selGiven      = secondDoseOmitted === false;
  const selOmitted    = secondDoseOmitted === true;
  const noneSelected  = secondDoseOmitted === null;

  const btnBase   = 'flex:1; padding:8px 10px; border-radius:7px; font-weight:700; cursor:pointer; font-size:0.8rem; font-family:inherit;';
  const styleGiven   = selGiven
    ? `${btnBase} border:2px solid #2E7D32; background:#F1F8E9; color:#1B5E20;`
    : `${btnBase} border:2px solid #DDD; background:#F9F9F9; color:#555;`;
  const styleOmitted = selOmitted
    ? `${btnBase} border:2px solid #E65100; background:#FFF3E0; color:#BF360C;`
    : `${btnBase} border:2px solid #DDD; background:#F9F9F9; color:#555;`;

  promptDiv.innerHTML = `
    <div style="background:#FFFDE7; border:1px solid #FDD835; border-radius:8px; padding:10px 13px;">
      <p style="margin:0 0 3px 0; font-size:0.8rem; font-weight:700; color:#F57F17;">
        ⚠️ 2nd scheduled dose is only ${gapText} after 1st MD
      </p>
      <p style="margin:0 0 9px 0; font-size:0.78rem; color:#666;">
        Next dose: ${nextSlotFmt.full} — was it given or omitted?
      </p>
      <div style="display:flex; gap:8px;">
        <button type="button" onclick="selectDoseOmission(false)" style="${styleGiven}">
          ${selGiven ? '✔ ' : ''}Given
        </button>
        <button type="button" onclick="selectDoseOmission(true)" style="${styleOmitted}">
          ${selOmitted ? '✔ ' : ''}Omitted
        </button>
      </div>
      ${noneSelected ? '<p style="margin:6px 0 0; font-size:0.74rem; color:#999; font-style:italic;">Please confirm — this affects which dose is used for TDM sampling.</p>' : ''}
    </div>`;
  promptDiv.style.display = 'block';
}

function selectDoseOmission(omitted) {
  secondDoseOmitted = omitted;

  // Re-read inputs to re-render the prompt with updated button state
  const mdDate    = document.getElementById('md_date').value;
  const mdHour    = document.getElementById('md_hour').value;
  const mdMinute  = document.getElementById('md_minute').value;
  const mdAmPm    = document.getElementById('md_ampm').value;
  const frequency = document.getElementById('frequency').value;

  if (mdDate && mdHour !== '' && mdMinute !== '' && mdAmPm !== '' && frequency) {
    const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
    const firstMDDateTime = new Date(mdDate);
    firstMDDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
    checkAndShowDoseGapPrompt(firstMDDateTime, frequency);
  }
  calculateTDM();
}

// Generate N admin slots strictly after firstMDDateTime,
// respecting frequency interval (EOD = every 2 days, others = daily)
function generateAdminSlots(firstMDDateTime, adminTimes, frequency, count) {
  const slots    = [];
  const baseDate = new Date(firstMDDateTime);
  baseDate.setHours(0, 0, 0, 0);

  const step    = frequency === 'EOD' ? 2 : 1;
  let dayOffset = 0;
  const maxDays = 60; // safety limit

  while (slots.length < count && dayOffset < maxDays) {
    for (const timeStr of adminTimes) {
      const [h, m] = timeStr.split(':').map(Number);
      const slot   = new Date(baseDate);
      slot.setDate(slot.getDate() + dayOffset);
      slot.setHours(h, m, 0, 0);

      if (slot > firstMDDateTime) {
        slots.push(new Date(slot));
        if (slots.length >= count) break;
      }
    }
    dayOffset += step;
  }

  return slots;
}

function tdmcopyClinicalNote() {
  const htmlContentDiv = document.getElementById('tdm_clinicalNoteContent');
  
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
    textToCopy += `  (30 minutes before ${adminTimeToDisplay((currentAdminTimes || STANDARD_TIMES['OD'])[0])} dose)\n`;
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
      textToCopy += `  (1 hour after infusion completion; assuming dose given at ${adminTimeToDisplay((currentAdminTimes || STANDARD_TIMES['OD'])[0])}, infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''})\n`;
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
    const button = document.querySelector('#tab-tdm .copy-button');
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
