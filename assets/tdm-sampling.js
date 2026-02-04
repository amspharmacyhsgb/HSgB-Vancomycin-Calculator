// =============================================================
// tdm-sampling.js — Vancomycin TDM Sampling Guide Calculator
// =============================================================

let hasScrolledTDM = false;

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
  const method = document.querySelector('input[name="samplingMethod"]:checked');
  if (method) method.checked = true; // Keep trough selected
  
  document.getElementById('timeRoundingNote').style.display = 'none';
  document.getElementById('frequencyNote').style.display = 'none';
  document.getElementById('tdmOutput').style.display = 'none';
  
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
  // Get inputs
  const samplingMethod = document.querySelector('input[name="samplingMethod"]:checked')?.value;
  
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
  const aucSection = document.getElementById('aucSection');
  
  // Validation
  const inputsComplete = mdDate && mdHour !== '' && mdMinute !== '' && mdAmPm !== '' && dose && frequency;
  
  if (!inputsComplete) {
    outputDiv.style.display = 'none';
    return;
  }
  
  // Convert 12H to 24H format
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  
  // Show output
  outputDiv.style.display = 'block';
  
  // Show/hide AUC section
  if (samplingMethod === 'auc') {
    aucSection.style.display = 'block';
  } else {
    aucSection.style.display = 'none';
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
  
  let html = '<ul>';
  
  // Loading dose (if provided)
  if (ldDate && ldHour !== '' && ldMinute !== '' && ldAmPm !== '') {
    const ldHour24 = convertTo24Hour(parseInt(ldHour), ldAmPm);
    const ldDateTime = new Date(ldDate);
    ldDateTime.setHours(ldHour24, parseInt(ldMinute), 0, 0);
    const ldFormatted = formatDateTime(ldDateTime);
    html += `<li><strong>Loading Dose:</strong> ${ldFormatted.full}</li>`;
  }
  
  // First maintenance dose
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  const mdDateTime = new Date(mdDate);
  mdDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
  const mdFormatted = formatDateTime(mdDateTime);
  html += `<li><strong>First Maintenance Dose:</strong> ${mdFormatted.full}</li>`;
  
  // Regimen
  html += `<li><strong>Vancomycin Regimen:</strong> ${dose} mg ${frequency}</li>`;
  
  // Sampling method
  const methodText = samplingMethod === 'auc' ? 'AUC Sampling (Pre-dose + Post-dose)' : 'Trough Sampling (Pre-dose only)';
  html += `<li><strong>Sampling Method:</strong> ${methodText}</li>`;
  
  html += '</ul>';
  
  summaryDiv.innerHTML = html;
}

function displayTroughSampling(troughDateTime, samplingDoseNum) {
  const troughDiv = document.getElementById('troughOutput');
  const formatted = formatDateTime(troughDateTime);
  
  const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');
  
  troughDiv.innerHTML = `
    <p style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #2E7D32;">
      ${formatted.full}
    </p>
    <p style="margin: 10px 0 0 0; font-size: 0.95rem; color: #666;">
      (30 minutes before the ${ordinal} maintenance dose)
    </p>
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
    <p style="margin: 0 0 15px 0; font-size: 0.9rem; font-style: italic; color: #555;">
      Assuming dose is given on ${doseFormatted.full} and infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''}:
    </p>
    <p style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #1565C0;">
      ${formatted.full}
    </p>
    <p style="margin: 10px 0 0 0; font-size: 0.95rem; color: #666;">
      (1 hour after completion of the ${ordinal} maintenance dose infusion)
    </p>
  `;
}

function displayAfterHoursWarning(troughDateTime, isAUC, infusionDuration) {
  const warningDiv = document.getElementById('afterHoursWarning');
  
  // Calculate postponed times to next morning at 5:30 AM (30 min before 6 AM)
  const nextMorning = new Date(troughDateTime);
  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(5, 30, 0, 0);
  
  const troughFormatted = formatDateTime(nextMorning);
  
  let html = `
    <div class="warning-card" style="background-color: #FFF3E0; border-left: 4px solid #FF6F00; margin: 20px 0;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="font-size: 1.5rem;">🕐</span>
        <strong style="font-size: 1.05rem; color: #E65100;">AFTER-HOURS CONSIDERATION</strong>
      </div>
      <p style="margin: 0 0 15px 0; line-height: 1.6;">
        The calculated sampling time falls after office hours (5:00 PM – 4:00 AM). 
        Consider taking the sample the following morning:
      </p>
      <div style="background-color: white; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
        <p style="margin: 0 0 5px 0;"><strong style="color: #2E7D32;">Pre-dose (Trough):</strong></p>
        <p style="margin: 0; padding-left: 20px; color: #333;">${troughFormatted.full}</p>
        <p style="margin: 5px 0 0 20px; font-size: 0.9rem; color: #666;">(30 minutes before 6:00 AM dose)</p>
      </div>
  `;
  
  if (isAUC) {
    // Calculate post-dose: 6 AM + infusion duration + 1 hour
    const postdoseMorning = new Date(nextMorning);
    postdoseMorning.setMinutes(postdoseMorning.getMinutes() + 30); // Back to 6 AM
    postdoseMorning.setHours(postdoseMorning.getHours() + infusionDuration + 1);
    const postdoseFormatted = formatDateTime(postdoseMorning);
    
    html += `
      <div style="background-color: white; padding: 12px; border-radius: 6px;">
        <p style="margin: 0 0 5px 0;"><strong style="color: #1565C0;">Post-dose (Peak):</strong></p>
        <p style="margin: 0; padding-left: 20px; color: #333;">${postdoseFormatted.full}</p>
        <p style="margin: 5px 0 0 20px; font-size: 0.9rem; color: #666;">(1 hour after infusion completion)</p>
      </div>
    `;
  }
  
  html += `</div>`;
  
  warningDiv.innerHTML = html;
  warningDiv.style.display = 'block';
}

function displayWeekendWarning(troughDateTime, isAUC, infusionDuration) {
  const warningDiv = document.getElementById('weekendWarning');
  
  // Calculate postponed times to next working day at 5:30 AM
  const nextWorking = getNextWorkingDay(troughDateTime);
  nextWorking.setHours(5, 30, 0, 0);
  
  const troughFormatted = formatDateTime(nextWorking);
  
  let html = `
    <div style="background-color: #FFEBEE; border: 3px solid #C62828; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 4px 8px rgba(198, 40, 40, 0.2);">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <span style="font-size: 1.5rem;">📅</span>
        <strong style="font-size: 1.1rem; color: #C62828;">WEEKEND CONSIDERATION</strong>
      </div>
      <p style="margin: 0 0 15px 0; line-height: 1.6; color: #333;">
        The calculated sampling time falls on a weekend. For non-urgent cases, 
        consider postponing to the next working day:
      </p>
      <div style="background-color: white; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
        <p style="margin: 0 0 5px 0;"><strong style="color: #2E7D32;">Pre-dose (Trough):</strong></p>
        <p style="margin: 0; padding-left: 20px; color: #333; font-weight: 600;">${troughFormatted.full}</p>
        <p style="margin: 5px 0 0 20px; font-size: 0.9rem; color: #666;">(30 minutes before 6:00 AM dose)</p>
      </div>
  `;
  
  if (isAUC) {
    // Calculate post-dose: 6 AM + infusion duration + 1 hour
    const postdoseWorking = new Date(nextWorking);
    postdoseWorking.setMinutes(postdoseWorking.getMinutes() + 30); // Back to 6 AM
    postdoseWorking.setHours(postdoseWorking.getHours() + infusionDuration + 1);
    const postdoseFormatted = formatDateTime(postdoseWorking);
    
    html += `
      <div style="background-color: white; padding: 12px; border-radius: 6px; margin-bottom: 10px;">
        <p style="margin: 0 0 5px 0;"><strong style="color: #1565C0;">Post-dose (Peak):</strong></p>
        <p style="margin: 0; padding-left: 20px; color: #333; font-weight: 600;">${postdoseFormatted.full}</p>
        <p style="margin: 5px 0 0 20px; font-size: 0.9rem; color: #666;">(1 hour after infusion completion)</p>
      </div>
    `;
  }
  
  html += `
      <p style="margin: 10px 0 0 0; font-size: 0.85rem; font-style: italic; color: #666;">
        <strong>Note:</strong> This calculator does not account for Malaysian public holidays. 
        Please verify and adjust accordingly.
      </p>
    </div>
  `;
  
  warningDiv.innerHTML = html;
  warningDiv.style.display = 'block';
}

// =============================================================
// Clinical Note Generation
// =============================================================

function generateClinicalNote(ldDate, ldHour, ldMinute, ldAmPm, mdDate, mdHour, mdMinute, mdAmPm, dose, frequency, samplingMethod, troughDateTime, samplingDoseNum, infusionDuration) {
  // Patient Summary
  let summaryHTML = '';
  
  if (ldDate && ldHour !== '' && ldMinute !== '' && ldAmPm !== '') {
    const ldHour24 = convertTo24Hour(parseInt(ldHour), ldAmPm);
    const ldDateTime = new Date(ldDate);
    ldDateTime.setHours(ldHour24, parseInt(ldMinute), 0, 0);
    const ldFormatted = formatDateTime(ldDateTime);
    summaryHTML += `<li><strong>Loading Dose:</strong> ${ldFormatted.full}</li>`;
  }
  
  const mdHour24 = convertTo24Hour(parseInt(mdHour), mdAmPm);
  const mdDateTime = new Date(mdDate);
  mdDateTime.setHours(mdHour24, parseInt(mdMinute), 0, 0);
  const mdFormatted = formatDateTime(mdDateTime);
  summaryHTML += `<li><strong>First Maintenance Dose:</strong> ${mdFormatted.full}</li>`;
  summaryHTML += `<li><strong>Vancomycin Regimen:</strong> ${dose} mg ${frequency}</li>`;
  
  const methodText = samplingMethod === 'auc' ? 'AUC Sampling (Pre-dose + Post-dose)' : 'Trough Sampling (Pre-dose only)';
  summaryHTML += `<li><strong>Sampling Method:</strong> ${methodText}</li>`;
  
  document.getElementById('notePatientSummary').innerHTML = summaryHTML;
  
  // TDM Instructions
  const troughFormatted = formatDateTime(troughDateTime);
  const ordinal = samplingDoseNum === 2 ? '2nd' : (samplingDoseNum === 3 ? '3rd' : '4th');
  
  let tdmHTML = `<p style="margin: 0 0 10px 0;"><strong style="color: #2E7D32;">Pre-dose (Trough):</strong></p>`;
  tdmHTML += `<p style="margin: 0 0 5px 0; padding-left: 20px;">${troughFormatted.full}</p>`;
  tdmHTML += `<p style="margin: 0 0 15px 20px; font-size: 0.9rem; color: #666;">(30 minutes before the ${ordinal} maintenance dose)</p>`;
  
  if (samplingMethod === 'auc') {
    const postdoseDateTime = calculatePostdoseTime(troughDateTime, infusionDuration);
    const postdoseFormatted = formatDateTime(postdoseDateTime);
    
    const doseTime = new Date(troughDateTime);
    doseTime.setMinutes(doseTime.getMinutes() + 30);
    const doseFormatted = formatDateTime(doseTime);
    
    tdmHTML += `<p style="margin: 0 0 10px 0;"><strong style="color: #1565C0;">Post-dose (Peak):</strong></p>`;
    tdmHTML += `<p style="margin: 0 0 5px 20px; font-style: italic; color: #555; font-size: 0.9rem;">Assuming dose given at ${doseFormatted.time} and infused over ${infusionDuration} hour${infusionDuration !== 1 ? 's' : ''}:</p>`;
    tdmHTML += `<p style="margin: 0 0 5px 0; padding-left: 20px;">${postdoseFormatted.full}</p>`;
    tdmHTML += `<p style="margin: 0 0 0 20px; font-size: 0.9rem; color: #666;">(1 hour after completion of infusion)</p>`;
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
  
  // Plain text version
  const summaryItems = document.getElementById('notePatientSummary').textContent.trim();
  const tdmInstructions = document.getElementById('noteTDMInstructions').textContent.trim();
  
  let textToCopy = '--- Hospital Sungai Buloh Clinical Note ---\n\n';
  textToCopy += 'VANCOMYCIN TDM SAMPLING PLAN\n\n';
  textToCopy += 'PATIENT SUMMARY\n';
  textToCopy += summaryItems.replace(/•/g, '').split('\n').map(line => '• ' + line.trim()).filter(line => line.length > 2).join('\n') + '\n\n';
  textToCopy += 'TDM SAMPLING INSTRUCTIONS\n';
  textToCopy += tdmInstructions.replace(/\n\s+/g, '\n').trim() + '\n\n';
  textToCopy += 'REMINDERS\n';
  textToCopy += '• TDM blood sample should be obtained via venipuncture whenever possible, from the arm opposite to drug administration.\n';
  textToCopy += '• Do not collect TDM samples from central lines (e.g. PICC, CVC, or other central venous catheters).\n';
  textToCopy += '• Document the exact timing of dose administration and sample collection in the patient\'s medical record.\n';
  textToCopy += '-----------------------------------------------------------\n';
  
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
