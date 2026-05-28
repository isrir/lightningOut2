(function() {
    const loApp = document.getElementById('loApp');
    const component = document.getElementById('learningProgramComponent');

    function autoSizeIframe(iframe) {
        if (!iframe) return;

        function applyHeight() {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc && doc.body) {
                    // Force overflow visible on all levels
                    doc.body.style.overflow = 'visible';
                    doc.documentElement.style.overflow = 'visible';
                    doc.body.style.height = 'auto';
                    doc.documentElement.style.height = 'auto';
                    
                    // Get maximum of all height measurements
                    const bodyHeight = doc.body.scrollHeight || 0;
                    const htmlHeight = doc.documentElement.scrollHeight || 0;
                    const h = Math.max(bodyHeight, htmlHeight, 800); // minimum 800px
                    
                    if (h && h > 0) {
                        iframe.style.height = (h + 20) + 'px'; // Add 20px buffer
                    }
                }
            } catch (e) {
                iframe.style.height = '1000px';
            }
        }

        // Apply height immediately and retry at multiple intervals
        applyHeight();
        setTimeout(applyHeight, 100);
        setTimeout(applyHeight, 300);
        setTimeout(applyHeight, 600);
        setTimeout(applyHeight, 1000);

        // Observe for dynamic content changes
        if (window.ResizeObserver) {
            try {
                const ro = new ResizeObserver(() => applyHeight());
                ro.observe(iframe);
                if (iframe.contentDocument?.body) {
                    ro.observe(iframe.contentDocument.body);
                }
            } catch (e) {}
        }
    }

    function patchShadowStyles() {
        try {
            const host = document.querySelector('c-learning-program-form');
            if (!host || !host.shadowRoot) return;
            if (host.shadowRoot.querySelector('#height-patch')) return;

            const style = document.createElement('style');
            style.id = 'height-patch';
            style.textContent = `
                .lp-form, .slds-card {
                    min-height: auto !important;
                    height: auto !important;
                    overflow: visible !important;
                }
            `;
            host.shadowRoot.appendChild(style);
        } catch (e) {}
    }

    async function getFrontdoorUrl() {
        const response = await fetch('/api/guest-session');
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);
        const data = await response.json();
        return data.frontdoorUrl;
    }

    async function init() {
        try {
            const frontdoorUrl = await getFrontdoorUrl();
            loApp.setAttribute('frontdoor-url', frontdoorUrl);

            loApp.addEventListener('lo.application.ready', () => {
                const iframe = loApp.querySelector('iframe');
                autoSizeIframe(iframe);
                setTimeout(patchShadowStyles, 400);
            });

            loApp.addEventListener('lo.iframe.load', () => {
                const iframe = loApp.querySelector('iframe');
                autoSizeIframe(iframe);
            });

            loApp.addEventListener('lo.application.error', (event) => {
                console.error('Error:', event.detail);
            });

            if (component) {
                component.addEventListener('formSubmitted', (event) => {
                    alert('Enrollment submitted successfully!');
                });
            }

        } catch (error) {
            console.error('Init error:', error);
        }
    }

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