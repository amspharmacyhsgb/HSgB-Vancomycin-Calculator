// =============================================================
// crcl.js — Renal Function (CrCl) Calculator
// Cockcroft–Gault equation
// =============================================================

let hasScrolledCrCl = false;

// --- CLEAR ---
function clearCrClInputs() {
  document.getElementById('crclForm').reset();
  if (document.getElementById('crclOutput')) document.getElementById('crclOutput').style.display = 'none';
  hasScrolledCrCl = false;
}

// --- CALCULATE ---
function calculateCrCl() {
  const age    = parseFloat(document.getElementById('crcl_age').value);
  const bw     = parseFloat(document.getElementById('crcl_bw').value);
  const scr    = parseFloat(document.getElementById('crcl_scr').value);
  const gender = document.getElementById('crcl_gender').value;
  const outputDiv = document.getElementById('crclOutput');

  if (isNaN(age) || isNaN(bw) || isNaN(scr) || !gender) {
    outputDiv.style.display = 'none';
    return;
  }

  const F    = gender === 'male' ? 1.23 : 1.04;
  const crcl = ((140 - age) * bw * F) / scr;

  document.getElementById('result_crcl').textContent = crcl.toFixed(1);
  outputDiv.style.display = 'block';

  // Scroll into view only once
  if (!hasScrolledCrCl) {
    setTimeout(() => {
      const headerHeight    = document.querySelector('.header').offsetHeight;
      const outputPosition  = outputDiv.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition  = outputPosition - headerHeight - 20;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      hasScrolledCrCl = true;
    }, 100);
  }
}
