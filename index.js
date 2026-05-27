(function() {
    const loApp = document.getElementById('loApp');
    const component = document.getElementById('learningProgramComponent');
    const loadingOverlay = document.getElementById('loadingOverlay');

    function autoSizeIframe(iframe) {
        if (!iframe) return;

        function applyHeight() {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (doc && doc.body) {
                    doc.body.style.overflow = 'visible';
                    doc.documentElement.style.overflow = 'visible';
                    const h = doc.body.scrollHeight || doc.documentElement.scrollHeight;
                    if (h && h > 0) {
                        iframe.style.height = h + 'px';
                    }
                }
            } catch (e) {
                iframe.style.height = '600px';
            }
        }

        applyHeight();
        setTimeout(applyHeight, 300);
        setTimeout(applyHeight, 800);

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => applyHeight());
            ro.observe(iframe);
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
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                const iframe = loApp.querySelector('iframe');
                autoSizeIframe(iframe);
                setTimeout(patchShadowStyles, 400);
            });

            loApp.addEventListener('lo.iframe.load', () => {
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                const iframe = loApp.querySelector('iframe');
                autoSizeIframe(iframe);
            });

            loApp.addEventListener('lo.application.error', (event) => {
                console.error('Error:', event.detail);
                if (loadingOverlay) {
                    loadingOverlay.innerHTML = '<div style="color:#c23934;text-align:center;">Failed to load form.<br><button onclick="location.reload()">Retry</button></div>';
                }
            });

            if (component) {
                component.addEventListener('formSubmitted', (event) => {
                    alert('Enrollment submitted successfully!');
                });
            }

        } catch (error) {
            console.error('Init error:', error);
            if (loadingOverlay) {
                loadingOverlay.innerHTML = '<div style="color:#c23934;text-align:center;">Connection failed.<br><button onclick="location.reload()">Retry</button></div>';
            }
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