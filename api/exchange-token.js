<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enrollment Form - Learning Program</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container { max-width: 1200px; margin: 0 auto; }

        .header { text-align: center; padding: 40px 20px; color: white; }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; font-weight: 700; }
        .header p  { font-size: 1.1rem; opacity: 0.9; }

        .form-container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            overflow: hidden;
            min-height: 500px;
            position: relative;
        }

        #loading {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 10;
        }

        .spinner {
            width: 50px; height: 50px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }

        @keyframes spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        #error-container {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 10;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            display: none;
            min-width: 300px;
        }

        .error-icon    { font-size: 48px; margin-bottom: 20px; }
        .error-title   { font-size: 20px; font-weight: 600; color: #dc2626; margin-bottom: 10px; }
        .error-message { color: #6b7280; margin-bottom: 20px; word-break: break-word; }
        .error-details {
            background: #f3f4f6; padding: 10px; border-radius: 5px;
            font-size: 12px; font-family: monospace;
            margin-bottom: 20px; text-align: left;
            max-height: 200px; overflow: auto;
        }

        .retry-btn {
            background: #667eea; color: white; border: none;
            padding: 10px 20px; border-radius: 8px;
            cursor: pointer; font-size: 14px; font-weight: 500;
            transition: background 0.3s;
        }
        .retry-btn:hover { background: #5a67d8; }

        lightning-out-application {
            display: block;
            min-height: 500px;
        }

        c-learning-program-form {
            display: block;
            width: 100%;
            height: 100%;
            min-height: 500px;
        }
    </style>

    <script src="https://creationtechnology4.my.salesforce.com/lightning/lightning.out.latest/index.iife.prod.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📚 Learning Program Enrollment</h1>
            <p>Please fill out the form below to enroll in our learning program</p>
        </div>
        <div class="form-container">
            <div id="loading">
                <div class="spinner"></div>
                <p>Loading enrollment form...</p>
            </div>

            <div id="error-container">
                <div class="error-icon">⚠️</div>
                <div class="error-title">Unable to Load Form</div>
                <div class="error-message" id="error-message"></div>
                <div class="error-details" id="error-details" style="display:none;"></div>
                <button class="retry-btn" onclick="location.reload()">Try Again</button>
            </div>

            <!-- ✅ event listeners must be attached BEFORE frontdoor-url is set -->
            <lightning-out-application
                app-id="1UsdN00000025rdSAA"
                components="c-learning-program-form"
            >
                <c-learning-program-form></c-learning-program-form>
            </lightning-out-application>
        </div>
    </div>

    <script>
        function showError(message, details) {
            const errorDiv     = document.getElementById('error-container');
            const errorMessage = document.getElementById('error-message');
            const errorDetails = document.getElementById('error-details');
            errorMessage.textContent = message;
            if (details) {
                errorDetails.textContent = details;
                errorDetails.style.display = 'block';
            }
            errorDiv.style.display = 'block';
        }

        async function initGuestLightningOut() {
            const loadingDiv = document.getElementById('loading');
            const app        = document.querySelector('lightning-out-application');

            // ✅ attach listeners BEFORE setting frontdoor-url
            const timeout = setTimeout(() => {
                loadingDiv.style.display = 'none';
                showError('Component timed out. Check Salesforce CSP and Lightning Out Allowed Origins.');
            }, 30000);

            app.addEventListener('lo.application.ready', () => {
                clearTimeout(timeout);
                loadingDiv.style.display = 'none';
                console.log('✅ lo.application.ready fired');
            });

            app.addEventListener('lo.application.error', (e) => {
                clearTimeout(timeout);
                loadingDiv.style.display = 'none';
                showError(e.detail?.message || 'LO2 application error', JSON.stringify(e.detail, null, 2));
                console.error('lo.application.error:', e.detail);
            });

            app.addEventListener('lo.component.ready', () => {
                console.log('✅ lo.component.ready — LWC rendered');
            });

            app.addEventListener('lo.component.error', (e) => {
                console.error('lo.component.error:', e.detail);
                showError('Component error: ' + (e.detail?.message || 'unknown'), JSON.stringify(e.detail, null, 2));
            });

            try {
                console.log('Fetching guest session...');
                const response = await fetch('/api/guest-session');

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || err.error || `HTTP ${response.status}`);
                }

                const { frontdoorUrl } = await response.json();
                console.log('✅ frontdoorUrl received, setting on element...');

                // ✅ set AFTER listeners are attached
                app.setAttribute('frontdoor-url', frontdoorUrl);

            } catch (error) {
                clearTimeout(timeout);
                loadingDiv.style.display = 'none';
                showError(error.message);
                console.error('Init error:', error);
            }
        }

        // ✅ only one DOMContentLoaded listener
        document.addEventListener('DOMContentLoaded', initGuestLightningOut);
    </script>
</body>
</html>