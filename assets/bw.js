// =============================================================
// bw.js — Body Weight (BW) Calculator
// Calculates: BMI, BSA (Mosteller), IBW (Devine), Adjusted Body Weight
// =============================================================

let hasScrolledBW = false;

// --- CLEAR ---
function clearBWInputs() {
  document.getElementById('bwForm').reset();
  if (document.getElementById('bwOutput')) document.getElementById('bwOutput').style.display = 'none';
  hasScrolledBW = false;
}

// --- CALCULATE ---
function calculateBW() {
  const abw = parseFloat(document.getElementById('bw_abw').value);
  const heightCm = parseFloat(document.getElementById('bw_height').value);
  const gender = document.getElementById('bw_gender').value;
  const outputDiv = document.getElementById('bwOutput');

  if (isNaN(abw) || isNaN(heightCm)) {
    outputDiv.style.display = 'none';
    return;
  }

  const heightM = heightCm / 100;

  // 1. BMI (kg/m²)
  const bmi = abw / (heightM * heightM);
  document.getElementById('result_bmi').textContent = bmi.toFixed(1);

  // 2. BSA (m²) — Mosteller Formula
  const bsa = Math.sqrt((heightCm * abw) / 3600);
  document.getElementById('result_bsa').textContent = bsa.toFixed(2);

  // 3. IBW (kg) — Devine Formula
  let ibw = NaN;
  let ibwText = 'N/A (Select Gender)';

  if (gender) {
    if (gender === 'male') {
      ibw = 50 + 0.9 * (heightCm - 152);
    } else if (gender === 'female') {
      ibw = 45.5 + 0.9 * (heightCm - 152);
    }

    if (ibw < (gender === 'male' ? 50 : 45.5) && heightCm < 152) {
        ibw = (gender === 'male' ? 50 : 45.5) - 0.9 * (152 - heightCm);
    }
    ibwText = ibw.toFixed(1);
  }
  document.getElementById('result_ibw').textContent = ibwText;

  // 4. AdjBW (kg) — Adjusted Body Weight
  let adjbwValue = '';
  if (!isNaN(ibw) && abw > ibw) {
    // AdjBW = IBW + 0.4 × (Actual Weight − IBW)
    const adjbw = ibw + 0.4 * (abw - ibw);
    adjbwValue = adjbw.toFixed(1);
  } else if (!isNaN(ibw)) {
    adjbwValue = 'N/A (Actual Weight \u2264 IBW)';
  } else {
    adjbwValue = 'N/A (Select Gender)';
  }
  document.getElementById('result_adjbw').textContent = adjbwValue;

  outputDiv.style.display = 'block';

  // Scroll into view only once, and only when gender is also selected
  if (!hasScrolledBW && gender) {
    setTimeout(() => {
      const headerHeight = document.querySelector('.header').offsetHeight;
      const outputPosition = outputDiv.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = outputPosition - headerHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      hasScrolledBW = true;
    }, 100);
  }
}
