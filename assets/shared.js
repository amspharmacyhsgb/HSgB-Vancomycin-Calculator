// =============================================================
// shared.js — Utility functions shared across all calculator pages
// =============================================================

function toggleCollapsible(id) {
  const content = document.getElementById(id);
  if (content.style.display === "block") {
    content.style.display = "none";
  } else {
    content.style.display = "block";
  }
}

function toggleMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('dropdownMenu');
  menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
}

function openCrClCalculator() {
    window.open('crcl.html', '_blank');
}

function openBwCalculator() {
    window.open('bw.html', '_blank');
}

// =============================================================
// Footer Generation - Shared across all pages
// =============================================================
function generateFooter() {
  const footerHTML = `
    <div class="footer-title">Disclaimer</div>
    <ul>
      <li><strong>Prepared by:</strong> Izyana Munirah Idham (AMS Pharmacist, HSgB)</li>
      <li><strong>In collaboration with:</strong>
        <ol style="margin-left: 20px; margin-top: 5px;">
          <li>Nur Farhana (TDM Pharmacy)</li>
          <li>Hannah Md Mahir, Fong Siew Li & Muhammad Zulhafiz (AMS Pharmacists)</li>
          <li>PRIC & Medication Safety Team</li>
        </ol>
      </li>
      <li><strong>Approved by:</strong> Dr Syamhanin Adnan (Head of Pharmacy Dept, HSgB)</li>
      <li><strong>Launched:</strong> March 2026</li>
      <li class="footer-critical-note"><strong>For Hospital Sungai Buloh Staff Use Only.</strong></li>
      <li><strong>Footnote:</strong> Developed for Hospital Sungai Buloh staff use only — for educational and clinical support purposes. 
        This calculator may not cover all aspects of clinical practice; healthcare practitioners are encouraged to review 
        patient details and professionally assess the relevance of this guide to each clinical situation. 
        This guide is subject to periodic updates. We assume no responsibility for any party that referred to an outdated version.
      </li>
      <li><strong>📝 Feedback:</strong> We welcome your feedback to improve this tool. 
        <a href="https://forms.gle/nDNDfC2ktjmumdSYA" target="_blank">Click here to submit feedback</a>
      </li>
    </ul>`;
  
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.innerHTML = footerHTML;
  }
}

// Initialize footer when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', generateFooter);
} else {
  generateFooter();
}
