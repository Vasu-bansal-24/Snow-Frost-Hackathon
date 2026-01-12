// Consent Tracker - Injected Script
// Runs in page context to intercept browser permission APIs
// Communicates with content script via custom events

(function () {
    'use strict';

    // Prevent double-injection
    if (window.__consentTrackerInjected) return;
    window.__consentTrackerInjected = true;

    const loggedPermissions = new Set();

    // Send permission grant to content script
    function notifyPermissionGrant(permissionType, label, category) {
        if (loggedPermissions.has(permissionType)) return;
        loggedPermissions.add(permissionType);

        window.dispatchEvent(new CustomEvent('consent-tracker-permission', {
            detail: {
                permissionType,
                label,
                category,
                url: window.location.href,
                domain: window.location.hostname
            }
        }));
    }

    // Intercept geolocation API
    if (navigator.geolocation) {
        const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
        const originalWatchPosition = navigator.geolocation.watchPosition.bind(navigator.geolocation);

        navigator.geolocation.getCurrentPosition = function (success, error, options) {
            const wrappedSuccess = function (position) {
                notifyPermissionGrant('geolocation', 'Location Access', 'location');
                success(position);
            };
            return originalGetCurrentPosition(wrappedSuccess, error, options);
        };

        navigator.geolocation.watchPosition = function (success, error, options) {
            const wrappedSuccess = function (position) {
                notifyPermissionGrant('geolocation', 'Location Access', 'location');
                success(position);
            };
            return originalWatchPosition(wrappedSuccess, error, options);
        };
    }

    // Intercept Notification.requestPermission
    if (window.Notification) {
        const originalRequestPermission = Notification.requestPermission.bind(Notification);

        Notification.requestPermission = function (callback) {
            return originalRequestPermission(callback).then(function (result) {
                if (result === 'granted') {
                    notifyPermissionGrant('notifications', 'Notification Permission', 'notifications');
                }
                return result;
            });
        };
    }

    // Intercept getUserMedia for camera/microphone
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

        navigator.mediaDevices.getUserMedia = function (constraints) {
            return originalGetUserMedia(constraints).then(function (stream) {
                if (constraints.video) {
                    notifyPermissionGrant('camera', 'Camera Access', 'permissions');
                }
                if (constraints.audio) {
                    notifyPermissionGrant('microphone', 'Microphone Access', 'permissions');
                }
                return stream;
            });
        };
    }

    // Also try legacy getUserMedia
    if (navigator.getUserMedia) {
        const originalLegacyGetUserMedia = navigator.getUserMedia.bind(navigator);

        navigator.getUserMedia = function (constraints, success, error) {
            const wrappedSuccess = function (stream) {
                if (constraints.video) {
                    notifyPermissionGrant('camera', 'Camera Access', 'permissions');
                }
                if (constraints.audio) {
                    notifyPermissionGrant('microphone', 'Microphone Access', 'permissions');
                }
                success(stream);
            };
            return originalLegacyGetUserMedia(constraints, wrappedSuccess, error);
        };
    }

    console.log('🔒 Consent Tracker: Permission interception active');
})();
