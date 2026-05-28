(function () {
    const loApp = document.getElementById('loApp');
    const loComp = document.querySelector('c-learning-program-form');

    /* ── Fetch frontdoor URL from your backend ──────────────────────────── */
    async function getFrontdoorUrl() {
        const response = await fetch('/api/guest-session');
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        const data = await response.json();
        return data.frontdoorUrl;
    }

    /* ── Find the component AFTER Lightning Out creates it ───────────────── */
    async function getComponentElement() {
        // Lightning Out creates the component inside the shadow DOM
        // Wait for it to be available
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                // Try to find the component in the shadow DOM
                const shadowRoot = loApp.shadowRoot;
                if (shadowRoot) {
                    const component = shadowRoot.querySelector('c-learning-program-form');
                    if (component) {
                        clearInterval(checkInterval);
                        resolve(component);
                    }
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(null);
            }, 10000);
        });
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
                        iframe.style.height = h + 'px';
                        iframe.style.minHeight = h + 'px';
                    }
                }
            } catch (e) {
    iframe.style.height = '700px';
    iframe.style.minHeight = '700px';
}
        }

        // Poll at increasing intervals to catch async Salesforce rendering
        [100, 300, 600, 1000, 1500, 2000, 3000, 5000].forEach(delay =>
            setTimeout(applyHeight, delay)
        );

        // Also watch for dynamic content changes
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => applyHeight());
            ro.observe(iframe);
        }

        window.addEventListener('message', (event) => {
    // Only process messages from the Salesforce iframe
    if (event.origin !== 'https://creationtechnology4.my.salesforce.com') return;
    
    console.log('[HOST] raw message:', JSON.stringify(event.data));
    
    if (event.data && event.data.type === 'lp-form-resize') {
        const h = event.data.height;
        if (h > 50) {
            iframe.style.height = h + 'px';
            iframe.style.minHeight = h + 'px';
        }
    }
});

    }

    async function setComponentStyles() {
        const component = await getComponentElement();
        if (component) {
            // Apply styles directly to the component
            component.style.setProperty('--lp-form-min-height', '420px');
            component.style.setProperty('--lp-textarea-min-height', '120px');
            console.log('[LO2] Component styles applied');
        }
    }

    /* ── Main init ──────────────────────────────────────────────────────── */
    async function init() {
        try {
            // 1. Get session URL from backend
            const frontdoorUrl = await getFrontdoorUrl();
            loApp.setAttribute('frontdoor-url', frontdoorUrl);

            // 2. Application ready — iframe exists and LWC is mounted
            loApp.addEventListener('lo.application.ready', async () => {
                console.log('[LO2] Application ready');
                
                // Apply styles to the component
                await setComponentStyles();
                
                // Setup iframe height adjustment
                fixIframeHeight();
            });

            // 3. Iframe navigated / reloaded
            loApp.addEventListener('lo.iframe.load', () => {
                console.log('[LO2] iframe loaded');
                fixIframeHeight();
            });

            // 4. Listen for custom events from the component
            // Need to wait for component to be available
            loApp.addEventListener('lo.component.ready', async (event) => {
                console.log('[LO2] Component ready');
                
                const component = await getComponentElement();
                if (component) {
                    component.addEventListener('formsubmitted', (event) => {
                        console.log('[LO2] Form submitted', event.detail);
                        alert('Enrollment submitted successfully!');
                    });
                }
            });

            // 5. Error handling
            loApp.addEventListener('lo.application.error', (event) => {
                console.error('[LO2] Application error:', event.detail);
            });
            
            loApp.addEventListener('lo.component.error', (event) => {
                console.error('[LO2] Component error:', event.detail);
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