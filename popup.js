// Consent Tracker - Popup Script

document.addEventListener('DOMContentLoaded', () => {
    const countEl = document.getElementById('count');
    const sitesEl = document.getElementById('sites');
    const todayEl = document.getElementById('today');
    const riskLevel = document.getElementById('risk-level');
    const riskIndicator = document.getElementById('risk-indicator');
    const recentList = document.getElementById('recent-list');
    const recentSection = document.getElementById('recent-section');

    // Category icons
    const categoryIcons = {
        cookies: '🍪', newsletter: '📧', email: '✉️', account: '👤',
        data: '📊', terms: '📜', notifications: '🔔', location: '📍',
        permissions: '🔐', marketing: '📢', general: '📋'
    };

    // Load data
    chrome.storage.local.get(['consents'], (result) => {
        const consents = result.consents || [];

        // Total count
        countEl.textContent = consents.length;

        // Unique sites
        const uniqueSites = new Set(consents.map(c => c.domain)).size;
        sitesEl.textContent = uniqueSites;

        // Today's count
        const today = new Date().setHours(0, 0, 0, 0);
        const todayCount = consents.filter(c => c.timestamp >= today).length;
        todayEl.textContent = todayCount;

        // Calculate risk
        const risk = calculateRisk(consents);
        riskLevel.textContent = risk.label;
        riskIndicator.classList.remove('medium', 'high');
        if (risk.level === 'medium') riskIndicator.classList.add('medium');
        if (risk.level === 'high') riskIndicator.classList.add('high');

        // Recent consents
        if (consents.length > 0) {
            const recent = consents.slice(0, 3);
            recentList.innerHTML = recent.map(c => createRecentItem(c)).join('');
        } else {
            recentList.innerHTML = `
                <div class="empty-state" style="padding:16px;text-align:center;">
                    <p style="margin:0;color:var(--color-medium-teal);">No consents tracked yet.<br>Browse the web to start logging.</p>
                </div>
            `;
        }
    });

    // Open dashboard
    document.getElementById('open-dashboard').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });

    function calculateRisk(consents) {
        if (consents.length === 0) return { level: 'low', label: 'Low' };

        let score = 0;
        const uniqueSites = new Set(consents.map(c => c.domain)).size;
        score += Math.min(uniqueSites / 5, 2);

        const emailCount = consents.filter(c => c.emailShared).length;
        score += Math.min(emailCount, 2);

        const locationCount = consents.filter(c => c.category === 'location').length;
        score += Math.min(locationCount * 1.5, 2);

        const permCount = consents.filter(c => c.category === 'permissions').length;
        score += Math.min(permCount * 1.5, 2);

        const dataCount = consents.filter(c => c.category === 'data').length;
        score += Math.min(dataCount * 0.5, 2);

        if (score < 3) return { level: 'low', label: 'Low' };
        if (score < 7) return { level: 'medium', label: 'Medium' };
        return { level: 'high', label: 'High' };
    }

    function createRecentItem(consent) {
        const icon = categoryIcons[consent.category] || '📋';
        const time = formatTime(consent.timestamp);

        return `
      <div class="recent-item">
        <div class="recent-icon">${consent.domain.charAt(0).toUpperCase()}</div>
        <div class="recent-info">
          <div class="recent-domain">${escapeHtml(consent.domain)}</div>
          <div class="recent-category">${icon} ${consent.category || 'general'}</div>
        </div>
        <div class="recent-time">${time}</div>
      </div>
    `;
    }

    function formatTime(timestamp) {
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (mins < 1) return 'now';
        if (mins < 60) return `${mins}m`;
        if (hours < 24) return `${hours}h`;
        return `${Math.floor(hours / 24)}d`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});