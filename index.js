(function () {
    const loApp = document.getElementById('loApp');

    /* ── Fetch frontdoor URL from your backend ──────────────────────────── */
    async function getFrontdoorUrl() {
        const response = await fetch('/api/guest-session');
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        const data = await response.json();
        return data.frontdoorUrl;
    }

    /* ── Resize the iframe to fit its content ───────────────────────────── */
    function fixIframeHeight() {
        const iframe = loApp.querySelector('iframe');
        if (!iframe) return;

        function applyHeight() {
            try {
                // Same-origin: read scrollHeight directly
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc && doc.body) {
                    doc.body.style.overflow = 'visible';
                    doc.documentElement.style.overflow = 'visible';
                    const h = Math.max(
                        doc.body.scrollHeight,
                        doc.body.offsetHeight,
                        doc.documentElement.scrollHeight,
                        doc.documentElement.offsetHeight
                    );
                    if (h > 50) {
                        iframe.style.setProperty('height', h + 'px', 'important');
                        iframe.style.setProperty('min-height', h + 'px', 'important');
                    }
                }
            } catch (e) {
                // Cross-origin fallback: use a safe minimum height
                iframe.style.setProperty('height', '500px', 'important');
                iframe.style.setProperty('min-height', '500px', 'important');
            }
        }

        // Poll at increasing intervals to catch async Salesforce rendering
        [100, 300, 600, 1000, 1500, 2000, 3000, 5000].forEach(delay =>
            setTimeout(applyHeight, delay)
        );

        // Also watch for dynamic content changes (e.g. program selection)
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => applyHeight());
            ro.observe(iframe);
        }

        // Listen for messages from the iframe (if LWC sends any)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'lp-form-resize') {
                const h = event.data.height;
                if (h > 50) {
                    iframe.style.setProperty('height', h + 'px', 'important');
                    iframe.style.setProperty('min-height', h + 'px', 'important');
                }
            }
        });
    }

    /* ── Main init ──────────────────────────────────────────────────────── */
    async function init() {
        try {
            // 1. Get session URL from backend
            const frontdoorUrl = await getFrontdoorUrl();
            loApp.setAttribute('frontdoor-url', frontdoorUrl);

            // 2. Application ready — iframe exists and LWC is mounted
            loApp.addEventListener('lo.application.ready', () => {
                console.log('[LO2] Application ready');
                fixIframeHeight();
            });

            // 3. Iframe navigated / reloaded
            loApp.addEventListener('lo.iframe.load', () => {
                console.log('[LO2] iframe loaded');
                fixIframeHeight();
            });

            // 4. Handle LWC custom events bubbled to the host
            const component = document.getElementById('learningProgramComponent');
            if (component) {
                component.addEventListener('formsubmitted', (event) => {
                    console.log('[LO2] Form submitted', event.detail);
                    alert('Enrollment submitted successfully!');
                });
            }

            // 5. Error handling
            loApp.addEventListener('lo.application.error', (event) => {
                console.error('[LO2] Error:', event.detail);
            });

        } catch (error) {
            console.error('[LO2] Init error:', error);
        }
    }

    /* ── Wait for custom element to be defined before init ─────────────── */
    if (customElements.get('lightning-out-application')) {
        init();
    } else {
        const checkInterval = setInterval(() => {
            if (customElements.get('lightning-out-application')) {
                clearInterval(checkInterval);
                init();
            }
        }, 100);
    }
})();