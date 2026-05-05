// HSgB Pharmacy Calculator - Shared JavaScript Functions

/**
 * Scroll to results with proper spacing for sticky header
 * @param {string} elementId - ID of the element to scroll to
 */
function scrollToResults(elementId) {
    setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
            const headerHeight = document.querySelector('.header')?.offsetHeight || 80;
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
            const offsetPosition = elementPosition - headerHeight - 20; // 20px extra padding
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }, 100);
}

/**
 * Clear all form inputs in the current page
 */
function clearForm() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.type === 'number') {
            // Keep default values for specific fields
            if (input.id === 'vaso-duration') {
                input.value = '24';
            } else if (input.id === 'vaso-diluent') {
                input.value = '50';
            } else {
                input.value = '';
            }
        } else if (input.tagName === 'SELECT') {
            input.value = '';
        }
    });
    
    // Hide all output sections
    const outputs = document.querySelectorAll('[id$="-outputs"], [id$="-output"]');
    outputs.forEach(output => {
        output.style.display = 'none';
    });
    
    // Clear any footnotes
    const footnotes = document.querySelectorAll('.footnote[id]');
    footnotes.forEach(footnote => {
        if (footnote.style) {
            footnote.style.display = 'none';
        }
    });
}

/**
 * Navigate to home page
 */
function goHome() {
    window.location.href = 'index.html';
}

/**
 * Keyboard navigation support for clickable elements
 * @param {Event} event - The keyboard event
 * @param {string} targetPage - The page to navigate to
 */
function handleKeyPress(event, targetPage) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        window.location.href = targetPage;
    }
}

/**
 * Format number to specified decimal places
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
function formatNumber(num, decimals = 2) {
    return num.toFixed(decimals);
}

/**
 * Validate positive number input
 * @param {number} value - Value to validate
 * @returns {boolean} True if valid
 */
function isValidPositiveNumber(value) {
    return !isNaN(value) && value > 0;
}

/**
 * Show element by ID
 * @param {string} elementId - ID of element to show
 */
function showElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'block';
    }
}

/**
 * Hide element by ID
 * @param {string} elementId - ID of element to hide
 */
function hideElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = 'none';
    }
}

/**
 * Set text content of element by ID
 * @param {string} elementId - ID of element
 * @param {string} text - Text content to set
 */
function setTextContent(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerText = text;
    }
}

/**
 * Set HTML content of element by ID
 * @param {string} elementId - ID of element
 * @param {string} html - HTML content to set
 */
function setHTMLContent(elementId, html) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = html;
    }
}

/**
 * Get numeric value from input by ID
 * @param {string} inputId - ID of input element
 * @returns {number} Parsed float value or NaN
 */
function getNumericValue(inputId) {
    const input = document.getElementById(inputId);
    return input ? parseFloat(input.value) : NaN;
}

/**
 * Get string value from select by ID
 * @param {string} selectId - ID of select element
 * @returns {string} Selected value
 */
function getSelectValue(selectId) {
    const select = document.getElementById(selectId);
    return select ? select.value : '';
}

/**
 * Generate input summary HTML
 * @param {Object} inputs - Object with label-value pairs
 * @returns {string} HTML for input summary
 */
function generateInputSummary(inputs) {
    const items = Object.entries(inputs)
        .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
        .map(([label, value]) => `<li><strong>${label}:</strong> ${value}</li>`)
        .join('');
    
    if (items) {
        return `
            <div class="input-summary">
                <div class="input-summary-title">📋 Summary of Input</div>
                <div class="input-summary-content">
                    <ul>${items}</ul>
                </div>
            </div>
        `;
    }
    return '';
}

// Initialize disclaimer on page load
document.addEventListener('DOMContentLoaded', () => {
    // Standalone VDOSE — header is managed directly in index.html
    
    // Add disclaimer to the page if it doesn't exist
    if (!document.querySelector('.disclaimer-section')) {
        const disclaimer = document.createElement('div');
        disclaimer.className = 'disclaimer-section';
        disclaimer.innerHTML = `
            <p><span class="less-bold">Prepared by:</span> Izyana Munirah Idham (AMS Pharmacist), Hospital Sungai Buloh.<br>
            <span class="less-bold">In collaboration with:</span> Hannah Md Mahir & Fong Siew Li (AMS Pharmacists) & PRIC.<br>
            <span class="less-bold">Approved by:</span> Dr Syamhanin Adnan (Head of Pharmacy Dept, Hospital Sungai Buloh)</p>
            <p style="margin-top: 8px;"><span class="less-bold">Launched:</span> Mar 2026.</p>
            <p class="stronger-bold">For Hosp Sungai Buloh Staff Use Only.</p>
            <p class="footnote">
                This guide/calculator provides general advice based on published evidence and expert opinion for standardisation of practice in HSgB. This guide may not cover all aspects of clinical practice, thus healthcare practitioners are encouraged to review patient details and professionally assess the relevance of this guide to each clinical situation. This guide is subject to periodic updates. We assume no responsibility for any party that referred to an outdated version.
            </p>
            <p style="margin-top: 12px; font-size: 0.9em;">
                <span class="less-bold">📝 Feedback:</span> We welcome your feedback to improve this tool. 
                <a href="https://forms.gle/XW6NgKrCZLiQV4xp6" target="_blank" rel="noopener noreferrer" style="color: #1565C0; font-weight: 600; text-decoration: none;">Click here to submit feedback</a>
            </p>
        `;
        document.body.appendChild(disclaimer);
    }
});
