// Consent Tracker - Dashboard Script
// Displays consent logs with filtering, search, statistics, and export

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const consentList = document.getElementById('consent-list');
    const emptyState = document.getElementById('empty-state');
    const loadingState = document.getElementById('loading-state');
    const totalCount = document.getElementById('total-count');
    const pageTitle = document.getElementById('page-title');
    const listTitle = document.getElementById('list-title');
    const searchInput = document.getElementById('search-input');
    const dateFilter = document.getElementById('date-filter');
    const exportBtn = document.getElementById('export-btn');
    const clearBtn = document.getElementById('clear-btn');
    const confirmModal = document.getElementById('confirm-modal');
    const cancelClear = document.getElementById('cancel-clear');
    const confirmClear = document.getElementById('confirm-clear');
    const clearCount = document.getElementById('clear-count');
    const exportModal = document.getElementById('export-modal');
    const exportJson = document.getElementById('export-json');
    const exportCsv = document.getElementById('export-csv');
    const cancelExport = document.getElementById('cancel-export');
    const toastContainer = document.getElementById('toast-container');
    const navItems = document.querySelectorAll('.nav-item');
    const topSitesContainer = document.getElementById('top-sites');
    const topSitesSection = document.getElementById('top-sites-section');
    const riskCard = document.getElementById('risk-card');
    const viewToggleButtons = document.querySelectorAll('.toggle-btn');
    const privacyLink = document.getElementById('privacy-link');
    const retentionLink = document.getElementById('retention-link');
    const moreToggle = document.getElementById('more-toggle');
    const moreGroup = document.getElementById('more-group');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');
    const retentionSelect = document.getElementById('retention-select');

    // Blockchain panel elements
    const blockchainPanel = document.getElementById('blockchain-panel');
    const anchorBatchBtn = document.getElementById('anchor-batch-btn');
    const viewBatchesBtn = document.getElementById('view-batches-btn');
    const batchesModal = document.getElementById('batches-modal');
    const closeBatches = document.getElementById('close-batches');
    const batchesList = document.getElementById('batches-list');
    const verifyModal = document.getElementById('verify-modal');
    const closeVerify = document.getElementById('close-verify');
    const showProofBtn = document.getElementById('show-proof-btn');

    let allConsents = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let dateRange = 'all';
    let viewMode = 'recent'; // recent | all
    let settings = { retentionDays: 'never' };
    let currentVerifyProof = null; // Store current verification proof for display

    // Category display info
    const categoryInfo = {
        all: { title: 'All Consents', icon: '📋' },
        cookies: { title: 'Cookie Consents', icon: '🍪' },
        newsletter: { title: 'Newsletter Subscriptions', icon: '📧' },
        email: { title: 'Email Consents', icon: '✉️' },
        account: { title: 'Account Registrations', icon: '👤' },
        data: { title: 'Personal Data Consents', icon: '📊' },
        terms: { title: 'Terms & Conditions', icon: '📜' },
        notifications: { title: 'Notification Permissions', icon: '🔔' },
        location: { title: 'Location Permissions', icon: '📍' },
        permissions: { title: 'Other Permissions', icon: '🔐' },
        marketing: { title: 'Marketing Consents', icon: '📢' },
        general: { title: 'General Consents', icon: '📋' }
    };

    // Show loading state
    loadingState.classList.remove('hidden');
    consentList.classList.add('hidden');

    // Load consents on page load
    loadSettings().then(loadConsents);

    // Handle URL hash for opening modals from popup - open immediately
    const hash = window.location.hash;
    if (hash === '#export' && exportModal) {
        confirmModal?.classList.add('hidden');
        settingsModal?.classList.add('hidden');
        exportModal.classList.remove('hidden');
    } else if (hash === '#settings' && settingsModal) {
        confirmModal?.classList.add('hidden');
        exportModal?.classList.add('hidden');
        settingsModal.classList.remove('hidden');
    }

    // Listen for storage changes (real-time updates)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.consents) {
            allConsents = changes.consents.newValue || [];
            updateAll();
        }
    });

    // Event listeners
    searchInput.addEventListener('input', debounce((e) => {
        searchQuery = e.target.value.toLowerCase();
        renderConsents();
    }, 300));

    dateFilter.addEventListener('change', (e) => {
        dateRange = e.target.value;
        renderConsents();
    });

    exportBtn.addEventListener('click', () => exportModal.classList.remove('hidden'));
    cancelExport.addEventListener('click', () => exportModal.classList.add('hidden'));
    exportJson.addEventListener('click', () => exportData('json'));
    exportCsv.addEventListener('click', () => exportData('csv'));

    clearBtn.addEventListener('click', () => {
        clearCount.textContent = allConsents.length;
        confirmModal.classList.remove('hidden');
    });
    cancelClear.addEventListener('click', () => confirmModal.classList.add('hidden'));
    confirmClear.addEventListener('click', clearAllConsents);

    // View toggle (Recent / All)
    viewToggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            viewMode = btn.dataset.view;
            viewToggleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderConsents();
        });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const isTyping = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
        if (e.key === '/' && !isTyping) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            confirmModal.classList.add('hidden');
            exportModal.classList.add('hidden');
            settingsModal.classList.add('hidden');
        }
    });

    // Privacy links
    if (privacyLink) {
        privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            showToast('Data stays local. No cloud sync used.', 'success');
        });
    }
    if (retentionLink) {
        retentionLink.addEventListener('click', (e) => {
            e.preventDefault();
            settingsModal.classList.remove('hidden');
        });
    }

    if (moreToggle) {
        moreToggle.querySelector('.more-button').addEventListener('click', () => {
            moreGroup.classList.toggle('open');
            moreToggle.classList.toggle('open');
        });
    }

    settingsBtn?.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings?.addEventListener('click', () => settingsModal.classList.add('hidden'));
    saveSettings?.addEventListener('click', () => {
        const value = retentionSelect.value;
        settings.retentionDays = value;
        chrome.storage.local.set({ settings }, () => {
            applyRetention();
            settingsModal.classList.add('hidden');
            showToast('Preferences saved', 'success');
            updateAll();
        });
    });

    // Close modals on overlay click
    confirmModal.addEventListener('click', (e) => {
        if (e.target === confirmModal) confirmModal.classList.add('hidden');
    });
    exportModal.addEventListener('click', (e) => {
        if (e.target === exportModal) exportModal.classList.add('hidden');
    });

    // Blockchain panel event listeners
    anchorBatchBtn?.addEventListener('click', async () => {
        anchorBatchBtn.disabled = true;
        anchorBatchBtn.textContent = 'Anchoring...';

        chrome.runtime.sendMessage({ type: 'ANCHOR_BATCH' }, (result) => {
            anchorBatchBtn.disabled = false;
            anchorBatchBtn.innerHTML = `
                <svg class="btn-icon" aria-hidden="true">
                    <use href="#icon-verified"></use>
                </svg>
                Anchor Today's Batch
            `;

            if (result && result.success) {
                showToast('Batch anchored successfully!', 'success');
                updateBlockchainStats();
            } else {
                showToast(result?.message || 'Anchoring failed', 'error');
            }
        });
    });

    viewBatchesBtn?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_BATCHES' }, (batches) => {
            renderBatchesList(batches || []);
            batchesModal.classList.remove('hidden');
        });
    });

    closeBatches?.addEventListener('click', () => batchesModal.classList.add('hidden'));
    closeVerify?.addEventListener('click', () => verifyModal.classList.add('hidden'));

    showProofBtn?.addEventListener('click', () => {
        const proofBox = document.getElementById('verify-proof-box');
        const proofList = document.getElementById('proof-list');

        if (proofBox.classList.contains('hidden') && currentVerifyProof) {
            proofList.innerHTML = currentVerifyProof.map((hash, i) => `
                <div class="proof-item">${hash.substring(0, 16)}...${hash.slice(-8)}</div>
            `).join('');
            proofBox.classList.remove('hidden');
            showProofBtn.textContent = 'Hide Proof';
        } else {
            proofBox.classList.add('hidden');
            showProofBtn.textContent = 'Show Proof';
        }
    });

    batchesModal?.addEventListener('click', (e) => {
        if (e.target === batchesModal) batchesModal.classList.add('hidden');
    });

    verifyModal?.addEventListener('click', (e) => {
        if (e.target === verifyModal) verifyModal.classList.add('hidden');
    });

    // Navigation filter clicks
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const filter = item.dataset.filter;
            if (!filter) return;

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            currentFilter = filter;
            pageTitle.textContent = categoryInfo[filter]?.title || 'Consents';
            const hasCategoryConsents = currentFilter === 'all' || allConsents.some(c => c.category === currentFilter);
            if (!hasCategoryConsents) {
                consentList.innerHTML = '';
                consentList.classList.add('hidden');
                emptyState.classList.remove('hidden');
                listTitle.textContent = `${categoryInfo[currentFilter]?.title || 'Consents'} (0)`;
                return;
            }

            renderConsents();
        });
    });

    // Load consents from storage
    function loadSettings() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['settings'], (result) => {
                settings = { retentionDays: 'never', ...(result.settings || {}) };
                if (retentionSelect) retentionSelect.value = settings.retentionDays;
                resolve();
            });
        });
    }

    function loadConsents() {
        try {
            chrome.storage.local.get(['consents'], (result) => {
                allConsents = result.consents || [];
                applyRetention();
                loadingState.classList.add('hidden');
                updateAll();
            });
        } catch (err) {
            loadingState.classList.add('hidden');
            showToast('Could not load consents. Please reload the extension.', 'error');
            console.error('Load consents error', err);
        }
    }

    // Update everything
    function updateAll() {
        updateCounts();
        updateStatistics();
        updateTopSites();
        renderConsents();
    }

    // Update category counts
    function updateCounts() {
        const counts = {
            all: allConsents.length,
            cookies: 0, newsletter: 0, email: 0, account: 0,
            data: 0, terms: 0, notifications: 0, location: 0,
            permissions: 0, marketing: 0, general: 0
        };

        allConsents.forEach(consent => {
            const category = consent.category || 'general';
            if (counts[category] !== undefined) {
                counts[category]++;
            }
        });

        Object.keys(counts).forEach(key => {
            const el = document.getElementById(`count-${key}`);
            if (el) el.textContent = counts[key];
        });

        totalCount.textContent = allConsents.length;
    }

    // Update statistics cards
    function updateStatistics() {
        // Unique sites
        const uniqueSites = new Set(allConsents.map(c => c.domain)).size;
        document.getElementById('stat-sites').textContent = uniqueSites;

        const yesterdayStart = new Date();
        yesterdayStart.setHours(0, 0, 0, 0);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date();
        yesterdayEnd.setHours(0, 0, 0, 0);

        const yesterdayCount = allConsents.filter(c => c.timestamp >= yesterdayStart.getTime() && c.timestamp < yesterdayEnd.getTime()).length;
        const todayDelta = diffLabel(allConsents.filter(c => c.timestamp >= yesterdayEnd.getTime()).length, yesterdayCount);
        setDelta('delta-today', todayDelta);

        const lastWeekStart = new Date();
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        const weekBeforeStart = new Date();
        weekBeforeStart.setDate(weekBeforeStart.getDate() - 14);
        const lastWeek = allConsents.filter(c => c.timestamp >= lastWeekStart.getTime());
        const prevWeek = allConsents.filter(c => c.timestamp >= weekBeforeStart.getTime() && c.timestamp < lastWeekStart.getTime());
        setDelta('delta-sites', diffLabel(lastWeek.length, prevWeek.length));

        // Today's count
        const today = new Date().setHours(0, 0, 0, 0);
        const todayCount = allConsents.filter(c => c.timestamp >= today).length;
        document.getElementById('stat-today').textContent = todayCount;
        setBar('bar-today', todayCount, Math.max(todayCount, yesterdayCount || 1));

        // Emails shared
        const emailsShared = allConsents.filter(c => c.emailShared).length;
        document.getElementById('stat-emails').textContent = emailsShared;
        const prevEmails = prevWeek.filter(c => c.emailShared).length;
        setDelta('delta-emails', diffLabel(emailsShared, prevEmails));

        // Privacy risk calculation (weighted by category)
        const riskScore = calculateRiskScore();
        const riskLabel = riskScore < 30 ? 'Low' : riskScore < 50 ? 'Medium' : 'High';
        document.getElementById('stat-risk').textContent = riskLabel;
        setDelta('delta-risk', riskLabel);

        riskCard.classList.remove('medium', 'high');
        if (riskScore >= 30 && riskScore < 50) riskCard.classList.add('medium');
        if (riskScore >= 50) riskCard.classList.add('high');
    }

    // Calculate privacy risk score (weighted sum across permissions)
    function calculateRiskScore() {
        if (allConsents.length === 0) return 0;
        // Weight mapping per category
        const weights = {
            cookies: 1,
            newsletter: 2,
            email: 4,
            account: 10,
            data: 15, // personal data
            notifications: 1,
            location: 5,
            permissions: 3,
            terms: 6,
            marketing: 2,
            general: 1
        };

        let score = 0;

        for (const consent of allConsents) {
            const category = consent.category || 'general';
            score += weights[category] ?? weights.general;
        }

        return score;
    }

    // Update top sites
    function updateTopSites() {
        const siteCounts = {};
        allConsents.forEach(c => {
            siteCounts[c.domain] = (siteCounts[c.domain] || 0) + 1;
        });

        const sorted = Object.entries(siteCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (sorted.length === 0) {
            topSitesSection.style.display = 'none';
            return;
        }

        topSitesSection.style.display = 'block';
        topSitesContainer.innerHTML = sorted.map(([domain, count]) => `
      <div class="top-site" data-domain="${escapeHtml(domain)}">
        <div class="top-site-icon">${domain.charAt(0).toUpperCase()}</div>
        <span class="top-site-name">${escapeHtml(domain)}</span>
        <span class="top-site-count">${count}</span>
      </div>
    `).join('');

        // Add click handlers
        topSitesContainer.querySelectorAll('.top-site').forEach(el => {
            el.addEventListener('click', () => {
                searchInput.value = el.dataset.domain;
                searchQuery = el.dataset.domain.toLowerCase();
                renderConsents();
            });
        });
    }

    // Filter consents by date
    function filterByDate(consents) {
        if (dateRange === 'all') return consents;

        const now = new Date();
        let startDate;

        switch (dateRange) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case 'week':
                startDate = new Date(now.setDate(now.getDate() - 7));
                break;
            case 'month':
                startDate = new Date(now.setMonth(now.getMonth() - 1));
                break;
            default:
                return consents;
        }

        return consents.filter(c => c.timestamp >= startDate.getTime());
    }

    // Render consent cards
    function renderConsents() {
        let filtered = allConsents;

        // Category filter
        if (currentFilter !== 'all') {
            filtered = filtered.filter(c => c.category === currentFilter);
        }

        // Date filter
        filtered = filterByDate(filtered);

        // Search filter
        if (searchQuery) {
            filtered = filtered.filter(c =>
                c.domain.toLowerCase().includes(searchQuery) ||
                c.buttonText.toLowerCase().includes(searchQuery) ||
                (c.context && c.context.toLowerCase().includes(searchQuery))
            );
        }

        // Update list title
        const baseTitle = viewMode === 'recent' ? 'Recent Consents' : 'All Consents';
        listTitle.textContent = searchQuery
            ? `Search Results (${filtered.length})`
            : `${baseTitle} (${filtered.length})`;

        if (filtered.length === 0) {
            consentList.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        consentList.classList.remove('hidden');
        emptyState.classList.add('hidden');

        if (viewMode === 'recent') {
            filtered = filtered.slice(0, 15);
        }

        consentList.innerHTML = filtered.map((consent, index) =>
            createConsentCard(consent, index)
        ).join('');

        // Add delete event listeners
        consentList.querySelectorAll('.action-btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                deleteConsent(id);
            });
        });
        consentList.querySelectorAll('.action-btn-review').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                toggleFlag(id, 'reviewed');
            });
        });
        consentList.querySelectorAll('.action-btn-pin').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                toggleFlag(id, 'important');
            });
        });

        // Copy hash event listeners
        consentList.querySelectorAll('.copy-hash-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const hash = e.currentTarget.dataset.hash;
                try {
                    await navigator.clipboard.writeText(hash);
                    showToast('Proof hash copied to clipboard', 'success');
                } catch (err) {
                    showToast('Failed to copy hash', 'error');
                }
            });
        });
    }

    // Create a consent card
    function createConsentCard(consent, index) {
        const initial = consent.domain.charAt(0).toUpperCase();
        const infoMessage = generateInfoMessage(consent);
        const time = formatTime(consent.timestamp);
        const category = consent.category || 'general';

        let tags = '';
        if (consent.emailShared) {
            const masked = consent.maskedEmail || 'your email';
            tags += `<div class="email-tag">✉️ Email shared: ${escapeHtml(masked)}</div>`;
        }
        if (consent.browserPermission) {
            tags += `<div class="browser-tag">🌐 Browser Permission</div>`;
        }

        // Proof hash display
        let proofHashHtml = '';
        if (consent.proofHash) {
            const shortHash = consent.proofHash.substring(0, 8) + '...' + consent.proofHash.substring(consent.proofHash.length - 4);
            const verifiedClass = consent.blockchainVerified ? 'verified' : '';
            const verifiedIcon = consent.blockchainVerified ? '<svg class="icon verified-icon" aria-hidden="true"><use href="#icon-verified"></use></svg>' : '';
            const networkLabel = consent.simulated ? 'Demo Mode' : (consent.blockchainNetwork || 'Blockchain');

            proofHashHtml = `
                <div class="proof-hash-container ${verifiedClass}">
                    <div class="proof-hash-header">
                        ${verifiedIcon}
                        <span class="proof-hash-label">Proof Hash</span>
                        <span class="proof-hash-network">${escapeHtml(networkLabel)}</span>
                    </div>
                    <div class="proof-hash-value">
                        <code class="hash-code" title="${escapeHtml(consent.proofHash)}">${shortHash}</code>
                        <button class="copy-hash-btn" data-hash="${escapeHtml(consent.proofHash)}" title="Copy full hash">
                            <svg class="icon" aria-hidden="true"><use href="#icon-copy"></use></svg>
                        </button>
                    </div>
                    ${consent.txHash ? `<div class="tx-hash">TX: ${consent.txHash.substring(0, 10)}...</div>` : ''}
                </div>
            `;
        }

        return `
      <div class="consent-card" style="animation-delay: ${index * 0.05}s">
        <div class="consent-header">
          <div class="website-icon">${initial}</div>
          <div class="website-info">
            <div class="website-name">${escapeHtml(consent.domain)}</div>
            <div class="website-url">
              <a href="${escapeHtml(consent.url)}" target="_blank" rel="noopener">${truncateUrl(consent.url)}</a>
            </div>
          </div>
          <span class="consent-category-badge category-${category}">
            ${categoryInfo[category]?.icon || '📋'} ${category}
          </span>
        </div>
        <div class="consent-body">
          <div class="consent-message">
            ${infoMessage}
            ${tags}
          </div>
          ${proofHashHtml}
        </div>
        <div class="consent-footer">
          <span class="consent-time">🕐 ${time}</span>
          <div class="consent-actions">
                        <a href="${escapeHtml(consent.url)}" target="_blank" rel="noopener" class="action-btn action-btn-visit">
                            <svg class="icon" aria-hidden="true"><use href="#icon-link"></use></svg>
                            Visit
                        </a>
                        <button class="action-btn action-btn-review${consent.reviewed ? ' active' : ''}" data-id="${consent.id}">
                            <svg class="icon" aria-hidden="true"><use href="#icon-flag"></use></svg>
                            Reviewed
                        </button>
                        <button class="action-btn action-btn-pin${consent.important ? ' active' : ''}" data-id="${consent.id}">
                            <svg class="icon" aria-hidden="true"><use href="#icon-star"></use></svg>
                            Important
                        </button>
                        <button class="action-btn action-btn-delete" data-id="${consent.id}">
                            <svg class="icon" aria-hidden="true"><use href="#icon-trash"></use></svg>
                        </button>
          </div>
        </div>
      </div>
    `;
    }

    // Generate info message
    function generateInfoMessage(consent) {
        if (consent.browserPermission) {
            return `<strong>Browser Permission:</strong> ${escapeHtml(consent.context)}`;
        }

        const context = (consent.context || '').toLowerCase();
        const category = consent.category;
        let infoShared = [];

        if (context.includes('cookie') || category === 'cookies') infoShared.push('cookies and tracking');
        if (context.includes('analytics')) infoShared.push('analytics data');
        if (context.includes('advertising') || context.includes('ads')) infoShared.push('advertising preferences');
        if (context.includes('personal') || category === 'data') infoShared.push('personal data');
        if (category === 'newsletter' || category === 'email') infoShared.push('email for communications');
        if (category === 'location') infoShared.push('location access');
        if (category === 'notifications') infoShared.push('notification permissions');
        if (category === 'terms') infoShared.push('terms agreement');
        if (category === 'account') infoShared.push('account data');
        if (category === 'marketing') infoShared.push('marketing communications');

        if (infoShared.length === 0) infoShared.push('general consent');

        return `<strong>Agreed to:</strong> ${infoShared.join(', ')}<br><em>Clicked: "${escapeHtml(consent.buttonText)}"</em>`;
    }

    // Delete a consent
    function deleteConsent(id) {
        allConsents = allConsents.filter(c => c.id !== id);
        chrome.storage.local.set({ consents: allConsents }, () => {
            updateAll();
            showToast('Consent deleted', 'success');
        });
    }

    function toggleFlag(id, key) {
        let changed = false;
        allConsents = allConsents.map(c => {
            if (c.id === id) {
                changed = true;
                return { ...c, [key]: !c[key] };
            }
            return c;
        });
        if (changed) {
            chrome.storage.local.set({ consents: allConsents }, () => {
                updateAll();
                showToast(key === 'reviewed' ? 'Marked as reviewed' : 'Marked as important', 'success');
            });
        }
    }

    // Clear all consents
    function clearAllConsents() {
        const count = allConsents.length;
        chrome.storage.local.set({ consents: [] }, () => {
            allConsents = [];
            updateAll();
            confirmModal.classList.add('hidden');
            showToast(`Cleared ${count} consent${count !== 1 ? 's' : ''}`, 'success');
        });
    }

    // Export data
    function exportData(format) {
        if (allConsents.length === 0) {
            showToast('No data to export', 'error');
            return;
        }

        const date = new Date().toISOString().split('T')[0];
        let content, filename, type;

        if (format === 'json') {
            const exportData = {
                exportedAt: new Date().toISOString(),
                totalConsents: allConsents.length,
                summary: {
                    uniqueSites: new Set(allConsents.map(c => c.domain)).size,
                    emailsShared: allConsents.filter(c => c.emailShared).length,
                    categories: getCategoryCounts()
                },
                consents: allConsents.map(c => ({
                    website: c.domain,
                    url: c.url,
                    category: c.category,
                    action: c.buttonText,
                    emailShared: c.emailShared || false,
                    browserPermission: c.browserPermission || false,
                    timestamp: new Date(c.timestamp).toISOString(),
                    proofHash: c.proofHash || null,
                    txHash: c.txHash || null,
                    blockchainNetwork: c.blockchainNetwork || null,
                    blockchainVerified: c.blockchainVerified || false
                }))
            };
            content = JSON.stringify(exportData, null, 2);
            filename = `consent-tracker-${date}.json`;
            type = 'application/json';
        } else {
            // CSV
            const headers = ['Website', 'URL', 'Category', 'Action', 'Email Shared', 'Browser Permission', 'Timestamp', 'Proof Hash', 'TX Hash', 'Verified'];
            const rows = allConsents.map(c => [
                c.domain,
                c.url,
                c.category,
                `"${c.buttonText.replace(/"/g, '""')}"`,
                c.emailShared ? 'Yes' : 'No',
                c.browserPermission ? 'Yes' : 'No',
                new Date(c.timestamp).toISOString(),
                c.proofHash || '',
                c.txHash || '',
                c.blockchainVerified ? 'Yes' : 'No'
            ]);
            content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            filename = `consent-tracker-${date}.csv`;
            type = 'text/csv';
        }

        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        exportModal.classList.add('hidden');
        showToast(`Exported as ${format.toUpperCase()}`, 'success');
    }

    // Get category counts for export
    function getCategoryCounts() {
        const counts = {};
        allConsents.forEach(c => {
            const cat = c.category || 'general';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return counts;
    }

    // Show toast notification
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span class="toast-message">${message}</span>
    `;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Format timestamp
    function formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    // Truncate URL
    function truncateUrl(url) {
        if (url.length > 60) {
            return url.substring(0, 57) + '...';
        }
        return url;
    }

    // Escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function setDelta(id, label) {
        const el = document.getElementById(id);
        if (el) el.textContent = label;
    }

    function diffLabel(current, prev) {
        if (prev === 0 && current === 0) return 'No change';
        if (prev === 0) return `↑ ${current}`;
        const diff = current - prev;
        const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '•';
        return `${arrow} ${Math.abs(diff)} vs prev`;
    }

    function setBar(id, value, max) {
        const el = document.getElementById(id);
        if (!el) return;
        const width = Math.max(8, Math.min(100, Math.round((value / (max || 1)) * 100)));
        el.style.width = `${width}%`;
    }

    function applyRetention() {
        if (!settings || settings.retentionDays === 'never') return;
        const days = parseInt(settings.retentionDays, 10);
        if (Number.isNaN(days)) return;
        const cutoff = Date.now() - days * 86400000;
        const pruned = allConsents.filter(c => c.timestamp >= cutoff);
        if (pruned.length !== allConsents.length) {
            allConsents = pruned;
            chrome.storage.local.set({ consents: allConsents });
        }
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ============ Blockchain Helper Functions ============

    // Update blockchain panel stats
    function updateBlockchainStats() {
        chrome.runtime.sendMessage({ type: 'GET_BLOCKCHAIN_STATS' }, (stats) => {
            if (!stats) return;

            const pendingEl = document.getElementById('pending-consents');
            const batchesEl = document.getElementById('anchored-batches');
            const anchoredEl = document.getElementById('total-anchored');
            const modeEl = document.getElementById('blockchain-mode');

            if (pendingEl) pendingEl.textContent = stats.pendingConsents || 0;
            if (batchesEl) batchesEl.textContent = stats.anchoredBatches || 0;
            if (anchoredEl) anchoredEl.textContent = stats.totalAnchoredConsents || 0;
            if (modeEl) {
                modeEl.textContent = stats.simulatedMode ? 'Demo Mode' : 'Live';
                modeEl.classList.toggle('live', !stats.simulatedMode);
            }
        });
    }

    // Render batches list in modal
    function renderBatchesList(batches) {
        if (!batchesList) return;

        if (batches.length === 0) {
            batchesList.innerHTML = `
                <div class="empty-batches">
                    <p>No batches anchored yet. Click "Anchor Today's Batch" to create your first anchor.</p>
                </div>
            `;
            return;
        }

        batchesList.innerHTML = batches.map(batch => `
            <div class="batch-item">
                <div class="batch-header">
                    <span class="batch-date">${formatDayTimestamp(batch.dayTimestamp)}</span>
                    <span class="batch-count">${batch.consentCount} consents</span>
                </div>
                <div class="batch-details">
                    <div class="batch-detail">
                        <span class="batch-detail-label">Root:</span>
                        <span class="batch-detail-value">${batch.merkleRoot?.substring(0, 12)}...</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">TX:</span>
                        <span class="batch-detail-value">${batch.txHash?.substring(0, 12)}...</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Block:</span>
                        <span class="batch-detail-value">${batch.blockNumber}</span>
                    </div>
                    <div class="batch-detail">
                        <span class="batch-detail-label">Network:</span>
                        <span class="batch-detail-value">${batch.network}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    // Verify a consent and show modal
    function verifyConsentHash(consentHash) {
        if (!verifyModal) return;

        // Reset modal state
        const statusEl = document.getElementById('verify-status');
        const hashEl = document.getElementById('verify-hash');
        const rootEl = document.getElementById('verify-root');
        const txEl = document.getElementById('verify-tx');
        const blockEl = document.getElementById('verify-block');
        const networkEl = document.getElementById('verify-network');
        const proofCountEl = document.getElementById('verify-proof-count');
        const proofBox = document.getElementById('verify-proof-box');

        statusEl.innerHTML = '<span class="verify-badge pending">Verifying...</span>';
        hashEl.textContent = consentHash;
        rootEl.textContent = '-';
        txEl.textContent = '-';
        blockEl.textContent = '-';
        networkEl.textContent = '-';
        proofCountEl.textContent = '-';
        proofBox.classList.add('hidden');
        showProofBtn.textContent = 'Show Proof';
        currentVerifyProof = null;

        verifyModal.classList.remove('hidden');

        chrome.runtime.sendMessage({ type: 'VERIFY_CONSENT', hash: consentHash }, (result) => {
            if (result && result.verified) {
                statusEl.innerHTML = '<span class="verify-badge verified">✓ Verified On-Chain</span>';
                rootEl.textContent = result.batch?.merkleRoot?.substring(0, 20) + '...' || '-';
                txEl.textContent = result.batch?.txHash?.substring(0, 20) + '...' || '-';
                blockEl.textContent = result.batch?.blockNumber || '-';
                networkEl.textContent = result.batch?.network || '-';
                proofCountEl.textContent = result.proof ? `${result.proof.length} levels` : '-';
                currentVerifyProof = result.proof || null;
            } else if (result && result.pending) {
                statusEl.innerHTML = '<span class="verify-badge pending">⏳ Pending Anchoring</span>';
            } else {
                statusEl.innerHTML = '<span class="verify-badge failed">✗ Not Found</span>';
            }
        });
    }

    // Format day timestamp for display
    function formatDayTimestamp(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    // Load blockchain stats on page load
    updateBlockchainStats();

    // Refresh blockchain stats periodically
    setInterval(updateBlockchainStats, 30000); // Every 30 seconds
});

