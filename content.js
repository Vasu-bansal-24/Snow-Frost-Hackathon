// Consent Tracker - Content Script
// Detects and logs user consent actions on web pages

(function () {
  'use strict';

  // Keywords that indicate consent-related buttons
  const CONSENT_KEYWORDS = [
    'accept', 'allow', 'grant', 'agree', 'consent', 'ok', 'yes',
    'continue', 'got it', 'i agree', 'i accept', 'understood',
    'enable', 'approve', 'confirm', 'subscribe', 'sign up', 'signup',
    'opt in', 'opt-in', 'accept all', 'allow all', 'agree all',
    'accept cookies', 'allow cookies', 'accept & continue',
    'that\'s ok', 'sounds good', 'fine by me', 'no problem',
    'register', 'join', 'submit', 'send', 'get started', 'start',
    'notify me', 'keep me updated', 'stay updated', 'get updates',
    'join now', 'sign me up', 'count me in', 'i\'m in'
  ];

  // Keywords to categorize the type of consent
  const CONSENT_CATEGORIES = {
    cookies: ['cookie', 'cookies', 'tracking', 'analytics', 'advertising', 'gdpr', 'ccpa'],
    newsletter: ['newsletter', 'subscribe', 'subscription', 'updates', 'news', 'mailing list', 'weekly', 'daily', 'digest'],
    email: ['email', 'e-mail', 'inbox', 'mail'],
    account: ['account', 'register', 'sign up', 'signup', 'create account', 'join', 'member'],
    data: ['data', 'personal', 'information', 'privacy', 'share'],
    terms: ['terms', 'conditions', 'policy', 'agreement', 'legal', 'tos'],
    notifications: ['notification', 'push', 'alert', 'remind', 'notify'],
    location: ['location', 'gps', 'geolocation', 'where', 'nearby'],
    permissions: ['permission', 'access', 'camera', 'microphone', 'contacts'],
    marketing: ['marketing', 'promotional', 'offers', 'deals', 'discount']
  };

  // Track already logged items to prevent duplicates
  const loggedItems = new Set();

  // Check if text contains consent keywords
  function isConsentButton(text) {
    const lowerText = text.toLowerCase().trim();
    return CONSENT_KEYWORDS.some(keyword => lowerText.includes(keyword));
  }

  // Check if element is part of a newsletter/email form
  function isNewsletterForm(element) {
    const form = element.closest('form');
    if (!form) return false;

    const formHtml = form.innerHTML.toLowerCase();
    const formText = form.innerText.toLowerCase();

    const newsletterIndicators = [
      'newsletter', 'subscribe', 'email', 'updates', 'notify',
      'mailing', 'inbox', 'weekly', 'daily', 'join'
    ];

    return newsletterIndicators.some(indicator =>
      formHtml.includes(indicator) || formText.includes(indicator)
    );
  }

  // Check if form has email input
  function hasEmailInput(form) {
    const emailInputs = form.querySelectorAll('input[type="email"], input[name*="email"], input[placeholder*="email"]');
    return emailInputs.length > 0;
  }

  // Get email value from form if present
  function getEmailFromForm(form) {
    const emailInput = form.querySelector('input[type="email"], input[name*="email"], input[placeholder*="email"]');
    if (emailInput && emailInput.value) {
      // Mask the email for privacy
      const email = emailInput.value;
      const atIndex = email.indexOf('@');
      if (atIndex > 2) {
        return email.substring(0, 2) + '***' + email.substring(atIndex);
      }
      return '***@***';
    }
    return null;
  }

  // Detect the category of consent based on surrounding context
  function detectCategory(contextText) {
    const lowerContext = contextText.toLowerCase();

    // Check each category
    for (const [category, keywords] of Object.entries(CONSENT_CATEGORIES)) {
      if (keywords.some(keyword => lowerContext.includes(keyword))) {
        return category;
      }
    }
    return 'general';
  }

  // Extract context from the button's parent elements
  function extractContext(element) {
    let context = '';
    let parent = element.parentElement;
    let depth = 0;
    const maxDepth = 6;

    while (parent && depth < maxDepth) {
      const parentText = parent.innerText || '';
      if (parentText.length > context.length && parentText.length < 1000) {
        context = parentText;
      }
      parent = parent.parentElement;
      depth++;
    }

    // Also check for form context
    const form = element.closest('form');
    if (form) {
      const formText = form.innerText || '';
      if (formText.length > context.length && formText.length < 1000) {
        context = formText;
      }
    }

    // Clean up the context
    context = context.replace(/\s+/g, ' ').trim();
    if (context.length > 500) {
      context = context.substring(0, 500) + '...';
    }

    return context;
  }

  // Generate a unique ID
  function generateId() {
    return 'consent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Extract domain from URL
  function getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  // Create a hash for deduplication
  function createHash(domain, buttonText, category) {
    return `${domain}|${buttonText.toLowerCase().trim()}|${category}`;
  }

  // Send consent data to background script
  function logConsent(buttonText, context, category, extraData = {}) {
    const domain = getDomain(window.location.href);
    const hash = createHash(domain, buttonText, category);

    // Prevent duplicate logging within same session
    if (loggedItems.has(hash)) {
      return;
    }
    loggedItems.add(hash);

    const consentData = {
      id: generateId(),
      url: window.location.href,
      domain: domain,
      buttonText: buttonText.trim(),
      context: context,
      category: category,
      timestamp: Date.now(),
      ...extraData
    };

    // Send to background script
    chrome.runtime.sendMessage({
      type: 'CONSENT_DETECTED',
      data: consentData
    });

    // Show visual feedback
    showFeedback(buttonText, category);
  }

  // Show visual feedback when consent is detected
  function showFeedback(buttonText, category) {
    const categoryEmojis = {
      cookies: '🍪',
      newsletter: '📧',
      email: '✉️',
      account: '👤',
      data: '📊',
      terms: '📜',
      notifications: '🔔',
      location: '📍',
      permissions: '🔐',
      marketing: '📢',
      general: '📋'
    };

    const emoji = categoryEmojis[category] || '🔒';

    const feedback = document.createElement('div');
    feedback.innerHTML = `
      <div style="
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(102, 126, 234, 0.4);
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        animation: consentSlideIn 0.3s ease-out;
        display: flex;
        align-items: center;
        gap: 12px;
      ">
        <span style="font-size: 24px;">${emoji}</span>
        <div>
          <div style="font-weight: 600; margin-bottom: 2px;">Consent Logged</div>
          <div style="opacity: 0.9; font-size: 12px;">${category.charAt(0).toUpperCase() + category.slice(1)}: "${buttonText.substring(0, 25)}${buttonText.length > 25 ? '...' : ''}"</div>
        </div>
      </div>
      <style>
        @keyframes consentSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes consentSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      </style>
    `;

    document.body.appendChild(feedback);

    // Remove after 3 seconds
    setTimeout(() => {
      const inner = feedback.querySelector('div');
      if (inner) inner.style.animation = 'consentSlideOut 0.3s ease-in forwards';
      setTimeout(() => feedback.remove(), 300);
    }, 3000);
  }

  // Handle click events
  function handleClick(event) {
    const target = event.target;

    // Check if it's a button, link, or clickable element
    const clickable = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"], [onclick], span[class*="btn"], div[class*="btn"]');

    if (!clickable) return;

    // Get the text content of the clicked element
    let buttonText = (clickable.innerText || clickable.value || clickable.getAttribute('aria-label') || '').trim();

    // Also check for title or data attributes
    if (!buttonText) {
      buttonText = clickable.getAttribute('title') || clickable.dataset.text || '';
    }

    if (!buttonText) return;

    const context = extractContext(clickable);
    const fullContext = context + ' ' + buttonText;

    // Check if this looks like a consent button
    if (isConsentButton(buttonText)) {
      const category = detectCategory(fullContext);

      // Check if it's a newsletter form
      const extraData = {};
      if (isNewsletterForm(clickable)) {
        const form = clickable.closest('form');
        if (form && hasEmailInput(form)) {
          extraData.emailShared = true;
          extraData.maskedEmail = getEmailFromForm(form);
        }
      }

      logConsent(buttonText, context, category, extraData);
      return;
    }

    // Also check for newsletter form submissions even without specific keywords
    if (isNewsletterForm(clickable)) {
      const form = clickable.closest('form');
      if (form && hasEmailInput(form)) {
        const category = detectCategory(context + ' newsletter email subscribe');
        logConsent(buttonText || 'Form Submission', context, category === 'general' ? 'newsletter' : category, {
          emailShared: true,
          maskedEmail: getEmailFromForm(form)
        });
      }
    }
  }

  // Handle form submissions
  function handleFormSubmit(event) {
    const form = event.target;

    if (!hasEmailInput(form)) return;

    const formText = form.innerText.toLowerCase();
    const formHtml = form.innerHTML.toLowerCase();

    // Check if it's a newsletter/subscription form
    const isNewsletter = ['newsletter', 'subscribe', 'updates', 'mailing', 'notify', 'join'].some(
      keyword => formText.includes(keyword) || formHtml.includes(keyword)
    );

    if (isNewsletter) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
      const buttonText = submitBtn ? (submitBtn.innerText || submitBtn.value || 'Subscribe') : 'Subscribe';
      const context = extractContext(form);

      logConsent(buttonText, context, 'newsletter', {
        emailShared: true,
        maskedEmail: getEmailFromForm(form)
      });
    }
  }

  // ==========================================
  // BROWSER PERMISSION MONITORING
  // ==========================================

  // Inject script into page context to intercept browser APIs
  function injectScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('inject.js');
    script.onload = function () {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  // Listen for permission events from injected script
  window.addEventListener('consent-tracker-permission', function (event) {
    const detail = event.detail;
    if (!detail) return;

    const hash = createHash(detail.domain, `Browser: ${detail.label}`, detail.category);

    if (loggedItems.has(hash)) return;
    loggedItems.add(hash);

    const consentData = {
      id: generateId(),
      url: detail.url,
      domain: detail.domain,
      buttonText: `Allowed ${detail.label}`,
      context: `Browser permission granted: ${detail.label} was allowed for this website.`,
      category: detail.category,
      timestamp: Date.now(),
      browserPermission: true,
      permissionType: detail.permissionType
    };

    chrome.runtime.sendMessage({
      type: 'CONSENT_DETECTED',
      data: consentData
    });

    showFeedback(detail.label, detail.category);
  });

  // Inject the script
  injectScript();

  // Attach event listeners
  document.addEventListener('click', handleClick, true);
  document.addEventListener('submit', handleFormSubmit, true);

  console.log('🔒 Consent Tracker: Monitoring for consent actions, form submissions, and browser permissions...');
})();



