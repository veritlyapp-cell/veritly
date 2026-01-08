// Veritly Matcher - Content Script
// Extracts job data from LinkedIn, Bumeran, and Indeed

(function () {
    'use strict';

    // Site-specific selectors for job data extraction
    const SITE_SELECTORS = {
        linkedin: {
            urlPattern: /linkedin\.com\/jobs/,
            title: [
                '.job-details-jobs-unified-top-card__job-title',
                '.jobs-unified-top-card__job-title',
                '.t-24.t-bold.inline',
                'h1.topcard__title',
                '.job-title'
            ],
            company: [
                '.job-details-jobs-unified-top-card__company-name',
                '.jobs-unified-top-card__company-name',
                '.topcard__org-name-link',
                'a.topcard__org-name-link'
            ],
            description: [
                '.jobs-description__content',
                '.jobs-box__html-content',
                '.description__text',
                '#job-details'
            ],
            applyButton: [
                '.jobs-apply-button',
                '.jobs-s-apply button',
                'button[data-control-name="jobdetails_topcard_inapply"]'
            ]
        },
        bumeran: {
            urlPattern: /bumeran\.com/,
            title: [
                'h1.sc-fzoXzr',
                '.sc-fzoXzr.bXJsNT',
                'h1[class*="Title"]',
                '.aviso-title h1'
            ],
            company: [
                '.sc-fzoyAV',
                '.sc-fzoyAV.kycfQm',
                'a[class*="Company"]',
                '.aviso-company'
            ],
            description: [
                '.sc-fznxsB',
                '.sc-fznxsB.fAdOaG',
                'div[class*="Description"]',
                '.aviso-description'
            ],
            applyButton: [
                'button[class*="Postular"]',
                '.sc-fzqNJr',
                'a[class*="Apply"]'
            ]
        },
        indeed: {
            urlPattern: /indeed\.com/,
            title: [
                '.jobsearch-JobInfoHeader-title',
                'h1.jobsearch-JobInfoHeader-title',
                '.icl-u-xs-mb--xs.icl-u-xs-mt--none',
                'h1[data-testid="jobsearch-JobInfoHeader-title"]'
            ],
            company: [
                '.css-1saizt3.e1wnkr790',
                'div[data-testid="inlineHeader-companyName"]',
                '.jobsearch-InlineCompanyRating-companyHeader',
                '.companyName'
            ],
            description: [
                '#jobDescriptionText',
                '.jobsearch-jobDescriptionText',
                'div[id="jobDescriptionText"]'
            ],
            applyButton: [
                '#indeedApplyButton',
                '.jobsearch-IndeedApplyButton-newDesign',
                'button[id*="indeedApply"]'
            ]
        }
    };

    // Detect current site
    function detectSite() {
        const url = window.location.href;
        for (const [site, config] of Object.entries(SITE_SELECTORS)) {
            if (config.urlPattern.test(url)) {
                return { site, config };
            }
        }
        return null;
    }

    // Try multiple selectors and return first match
    function findElement(selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        return null;
    }

    // Extract job data from the page
    function extractJobData(config) {
        const titleEl = findElement(config.title);
        const companyEl = findElement(config.company);
        const descriptionEl = findElement(config.description);

        return {
            title: titleEl?.innerText?.trim() || '',
            company: companyEl?.innerText?.trim() || '',
            description: descriptionEl?.innerText?.trim() || '',
            url: window.location.href,
            extractedAt: new Date().toISOString()
        };
    }

    // Create and inject the Veritly analyze button
    function injectAnalyzeButton(config) {
        // Check if button already exists
        if (document.getElementById('veritly-analyze-btn')) return;

        const applyButton = findElement(config.applyButton);
        if (!applyButton) {
            // Try again later if apply button not found
            setTimeout(() => injectAnalyzeButton(config), 2000);
            return;
        }

        // Create the Veritly button
        const veritlyBtn = document.createElement('button');
        veritlyBtn.id = 'veritly-analyze-btn';
        veritlyBtn.className = 'veritly-matcher-btn';
        veritlyBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Analizar con Veritly</span>
    `;

        veritlyBtn.addEventListener('click', handleAnalyzeClick);

        // Insert button near the apply button
        const container = document.createElement('div');
        container.className = 'veritly-btn-container';
        container.appendChild(veritlyBtn);

        applyButton.parentElement?.insertBefore(container, applyButton.nextSibling);
    }

    // Handle analyze button click
    async function handleAnalyzeClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const siteInfo = detectSite();
        if (!siteInfo) return;

        const jobData = extractJobData(siteInfo.config);

        // Update button state
        const btn = document.getElementById('veritly-analyze-btn');
        if (btn) {
            btn.classList.add('loading');
            btn.innerHTML = `
        <div class="veritly-spinner"></div>
        <span>Analizando...</span>
      `;
        }

        try {
            // Open side panel and send job data
            await chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' });

            // Small delay to let panel open
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'ANALYZE_JOB',
                    data: jobData
                });
            }, 500);

        } catch (error) {
            console.error('Veritly Matcher Error:', error);
        }

        // Reset button after delay
        setTimeout(() => {
            if (btn) {
                btn.classList.remove('loading');
                btn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Analizar con Veritly</span>
        `;
            }
        }, 2000);
    }

    // Initialize when DOM is ready
    function init() {
        const siteInfo = detectSite();
        if (!siteInfo) return;

        console.log('Veritly Matcher: Detected', siteInfo.site);

        // Inject button with initial delay
        setTimeout(() => injectAnalyzeButton(siteInfo.config), 1500);

        // Re-inject on dynamic page changes (SPA navigation)
        const observer = new MutationObserver((mutations) => {
            if (!document.getElementById('veritly-analyze-btn')) {
                injectAnalyzeButton(siteInfo.config);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
