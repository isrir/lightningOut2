(function () {
    const loApp = document.getElementById('loApp');
    const loComp = document.getElementById('learningProgramForm');

    /* ── Fetch frontdoor URL from Vercel API ────────────────────────────── */
    async function getFrontdoorUrl() {
        try {
            // For Vercel, your API is at /api/guest-session
            const response = await fetch('/api/guest-session');
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[LO2] Auth method:', data.method);
            return data.frontdoorUrl;
        } catch (error) {
            console.error('[LO2] Failed to get frontdoor URL:', error);
            
            // Show user-friendly error
            alert(`Unable to authenticate with Salesforce: ${error.message}\n\nPlease check that:\n1. Vercel environment variables are set\n2. Connected App is properly configured\n3. API is reachable`);
            
            throw error;
        }
    }

    /* ── Apply styles to component ──────────────────────────────────────── */
    function applyStyles() {
        if (!loComp) return;
        
        // Set CSS custom properties (the ONLY way to style LO2 components)
        loComp.style.cssText = `
            --lp-form-min-height: 600px;
            --lp-textarea-min-height: 200px;
            --lp-primary-color: #2e844a;
            --lp-primary-hover: #1f5c33;
            --lp-border-radius: 8px;
            --lp-card-background: #ffffff;
            --lp-text-color: #1a1a1a;
            --lp-spacing-unit: 1.5rem;
            display: block;
            width: 100%;
        `;
        
        console.log('[LO2] Styles applied to component');
    }

    /* ── Handle iframe height adjustments ───────────────────────────────── */
    function setupHeightAdjustment() {
        const iframe = loApp.querySelector('iframe');
        if (!iframe) return;

        function adjustHeight() {
            try {
                const shadowRoot = loApp.shadowRoot;
                if (shadowRoot) {
                    const component = shadowRoot.querySelector('c-learning-program-form');
                    if (component && component.offsetHeight > 50) {
                        const newHeight = component.offsetHeight + 40;
                        iframe.style.height = `${newHeight}px`;
                        iframe.style.minHeight = `${newHeight}px`;
                    }
                }
            } catch (e) {
                // Ignore cross-origin errors
            }
        }

        // Listen for resize messages from iframe
        window.addEventListener('message', (event) => {
            // Only accept messages from your Salesforce org
            const allowedOrigins = [
                'https://creationtechnology4.my.salesforce.com',
                process.env.SF_DOMAIN
            ].filter(Boolean);
            
            if (!allowedOrigins.includes(event.origin)) return;
            
            if (event.data && event.data.type === 'lp-form-resize' && event.data.height > 50) {
                iframe.style.height = `${event.data.height}px`;
                iframe.style.minHeight = `${event.data.height}px`;
            }
        });

        // Poll for height changes
        const delays = [100, 300, 600, 1000, 2000, 3000, 5000];
        delays.forEach(delay => setTimeout(adjustHeight, delay));
    }

    /* ── Event Handlers ─────────────────────────────────────────────────── */
    function setupEventListeners() {
        if (!loComp) return;
        
        loComp.addEventListener('formsubmitted', (event) => {
            console.log('[LO2] Form submitted', event.detail);
            const message = event.detail?.message || 'Enrollment submitted successfully!';
            alert(message);
            
            // Optional: Send to your backend
            if (event.detail?.data) {
                fetch('/api/enrollment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(event.detail.data)
                }).catch(console.error);
            }
        });
    }

    /* ── Main Init ──────────────────────────────────────────────────────── */
    async function init() {
        try {
            console.log('[LO2] Initializing...');
            
            // Get and set frontdoor URL
            const frontdoorUrl = await getFrontdoorUrl();
            loApp.setAttribute('frontdoor-url', frontdoorUrl);
            
            // Apply styles immediately
            applyStyles();
            
            // Application ready
            loApp.addEventListener('lo.application.ready', () => {
                console.log('[LO2] Application ready');
                setupHeightAdjustment();
            });
            
            // Iframe loaded
            loApp.addEventListener('lo.iframe.load', () => {
                console.log('[LO2] Iframe loaded');
                setupHeightAdjustment();
            });
            
            // Component ready
            loApp.addEventListener('lo.component.ready', () => {
                console.log('[LO2] Component ready');
                setupEventListeners();
            });
            
            // Error handling
            loApp.addEventListener('lo.application.error', (event) => {
                console.error('[LO2] App error:', event.detail);
                alert(`Application Error: ${event.detail?.message || 'Unknown error'}`);
            });
            
            loApp.addEventListener('lo.component.error', (event) => {
                console.error('[LO2] Component error:', event.detail);
            });
            
        } catch (error) {
            console.error('[LO2] Init failed:', error);
            document.body.innerHTML = `
                <div style="padding: 20px; color: red; border: 1px solid red; margin: 20px;">
                    <h3>Failed to Load Application</h3>
                    <p>${error.message}</p>
                    <details>
                        <summary>Technical Details</summary>
                        <pre>${error.stack}</pre>
                    </details>
                </div>
            `;
        }
    }

    // Wait for custom element
    if (customElements.get('lightning-out-application')) {
        init();
    } else {
        customElements.whenDefined('lightning-out-application').then(init);
    }
})();