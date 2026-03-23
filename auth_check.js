/**
 * Election Intelligence Dashboard - Authentication & Authorization Check
 *
 * This script should be injected into the decrypted dashboard HTML.
 * It verifies the user's session and enforces permission-based filtering.
 */
(function() {
    'use strict';

    // ============================================================================
    // INITIALIZATION & SESSION VALIDATION
    // ============================================================================

    const AUTH_SESSION_KEY = 'supabaseSession';
    let currentUserSession = null;
    let userPermissions = null;

    /**
     * Check if a permission array grants unrestricted access
     * Returns true if array is empty (no restrictions) or contains 'ALL'
     */
    function isUnrestricted(permArray) {
        if (!permArray || permArray.length === 0) return true;
        return permArray.some(v => v.toUpperCase() === 'ALL');
    }

    /**
     * Initialize authentication on page load
     */
    function initializeAuth() {
        // Check if user has a valid session
        const sessionData = sessionStorage.getItem(AUTH_SESSION_KEY);

        if (!sessionData) {
            // No session - redirect to login
            redirectToLogin('Session expired. Please log in again.');
            return;
        }

        try {
            currentUserSession = JSON.parse(sessionData);
            userPermissions = {
                allowedStates: currentUserSession.allowedStates || [],
                allowedRaceTypes: currentUserSession.allowedRaceTypes || [],
                allowedDistricts: currentUserSession.allowedDistricts || []
            };

            // Initialize UI components
            initializeUserInfo();
            initializeLogoutButton();
            enforcePermissions();

        } catch (error) {
            console.error('Failed to parse session data:', error);
            redirectToLogin('Session error. Please log in again.');
        }
    }

    /**
     * Redirect user to login page
     */
    function redirectToLogin(message = null) {
        if (message) {
            sessionStorage.setItem('loginMessage', message);
        }
        window.location.href = 'index.html';
    }

    // ============================================================================
    // USER INFO & LOGOUT
    // ============================================================================

    /**
     * Create and display user info in top-right corner
     */
    function initializeUserInfo() {
        // Check if user info container already exists
        let userInfoContainer = document.getElementById('auth-user-info');
        if (!userInfoContainer) {
            userInfoContainer = document.createElement('div');
            userInfoContainer.id = 'auth-user-info';
            userInfoContainer.className = 'auth-user-info';
            document.body.appendChild(userInfoContainer);
        }

        // Get user info from session
        const userEmail = currentUserSession.userEmail || currentUserSession.email || 'User';
        const userName = userEmail.split('@')[0];

        userInfoContainer.innerHTML = `
            <div class="user-info-content">
                <div class="user-avatar">${userName.charAt(0).toUpperCase()}</div>
                <div class="user-details">
                    <div class="user-email">${userEmail}</div>
                    <button id="logoutBtn" class="logout-btn">Logout</button>
                </div>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('auth-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'auth-styles';
            styleSheet.textContent = `
                #auth-user-info {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    background: rgba(17, 24, 39, 0.95);
                    border: 1px solid rgba(0, 229, 255, 0.3);
                    border-radius: 8px;
                    padding: 12px 16px;
                    backdrop-filter: blur(10px);
                }
                .user-info-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .user-avatar {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #00e5ff 0%, #00a8cc 100%);
                    color: #0a0e1a;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 600;
                    font-size: 14px;
                }
                .user-details {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                .user-email {
                    font-size: 12px;
                    color: #9ca3af;
                    max-width: 150px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .logout-btn {
                    padding: 4px 12px;
                    background: rgba(239, 68, 68, 0.2);
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    color: #fca5a5;
                    border-radius: 4px;
                    font-size: 11px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }
                .logout-btn:hover {
                    background: rgba(239, 68, 68, 0.3);
                    border-color: rgba(239, 68, 68, 0.6);
                    color: #fecaca;
                }
                @media (max-width: 768px) {
                    #auth-user-info {
                        top: 10px;
                        right: 10px;
                        padding: 8px 12px;
                    }
                    .user-avatar {
                        width: 32px;
                        height: 32px;
                        font-size: 12px;
                    }
                    .user-email {
                        font-size: 10px;
                        max-width: 120px;
                    }
                    .logout-btn {
                        padding: 3px 8px;
                        font-size: 10px;
                    }
                }
            `;
            document.head.appendChild(styleSheet);
        }
    }

    /**
     * Set up logout button functionality
     */
    function initializeLogoutButton() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                logout();
            });
        }
    }

    /**
     * Handle user logout
     */
    function logout() {
        // Clear session storage
        sessionStorage.removeItem(AUTH_SESSION_KEY);
        sessionStorage.removeItem('loginMessage');

        // Clear any other auth-related data
        Object.keys(sessionStorage).forEach(key => {
            if (key.includes('auth') || key.includes('session')) {
                sessionStorage.removeItem(key);
            }
        });

        // Redirect to login
        window.location.href = 'index.html?loggedOut=true';
    }

    // ============================================================================
    // PERMISSION ENFORCEMENT
    // ============================================================================

    /**
     * Enforce permissions by filtering state and race type selectors
     */
    function enforcePermissions() {
        // Wait for dashboard to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyPermissionFilters);
        } else {
            applyPermissionFilters();
        }
    }

    /**
     * Apply permission filters to UI elements
     */
    function applyPermissionFilters() {
        // Only apply filters if user has specific permission restrictions
        if (!userPermissions) return;

        // Handle state filtering — skip if unrestricted (empty or 'ALL')
        if (!isUnrestricted(userPermissions.allowedStates)) {
            filterStateButtons(userPermissions.allowedStates);
        }

        // Handle race type filtering — skip if unrestricted (empty or 'ALL')
        if (!isUnrestricted(userPermissions.allowedRaceTypes)) {
            filterRaceTypeButtons(userPermissions.allowedRaceTypes);
        }

        // Enforce initial state selection
        enforceCurrentStatePermission();
    }

    /**
     * Filter state buttons based on allowed states
     */
    function filterStateButtons(allowedStates) {
        // Double-check: if 'ALL' is present, skip filtering entirely
        if (isUnrestricted(allowedStates)) return;

        // Find all state buttons (look for common selectors)
        const stateButtons = document.querySelectorAll('[data-state], [data-code], .state-btn, .state-button, [class*="state"]');

        stateButtons.forEach(button => {
            // Get state code from various possible attributes
            const stateCode = button.dataset.state || button.dataset.code || button.textContent.trim().toUpperCase();

            // Check if this state is allowed
            const isAllowed = allowedStates.some(state =>
                state.toUpperCase() === stateCode.toUpperCase()
            );

            if (!isAllowed && (button.classList.contains('state-btn') ||
                               button.classList.contains('state-button') ||
                               button.dataset.state ||
                               button.dataset.code)) {
                // Disable or hide the button
                button.style.opacity = '0.3';
                button.style.pointerEvents = 'none';
                button.style.cursor = 'not-allowed';
                button.title = 'You do not have access to this state';
                button.disabled = true;
            }
        });
    }

    /**
     * Filter race type buttons based on allowed race types
     */
    function filterRaceTypeButtons(allowedRaceTypes) {
        // If unrestricted, skip filtering entirely
        if (isUnrestricted(allowedRaceTypes)) return;

        // Common race type selectors
        const raceTypeSelectors = [
            '[data-type]',
            '[data-race-type]',
            '.race-type-btn',
            '.race-btn',
            '[class*="race-type"]'
        ];

        raceTypeSelectors.forEach(selector => {
            const buttons = document.querySelectorAll(selector);
            buttons.forEach(button => {
                // Get race type from various attributes
                const raceType = button.dataset.type || button.dataset.raceType || button.textContent.trim();

                // Map common race type names
                const mappedType = mapRaceType(raceType);

                // Check if this race type is allowed
                const isAllowed = allowedRaceTypes.some(type =>
                    mapRaceType(type).toUpperCase() === mappedType.toUpperCase()
                );

                if (!isAllowed && button.classList.contains('race-type-btn')) {
                    button.style.opacity = '0.3';
                    button.style.pointerEvents = 'none';
                    button.style.cursor = 'not-allowed';
                    button.title = 'You do not have access to this race type';
                    button.disabled = true;
                }
            });
        });
    }

    /**
     * Map race type abbreviations and names
     */
    function mapRaceType(type) {
        const typeMap = {
            'HD': 'House District',
            'SD': 'State Senate District',
            'FED': 'Federal',
            'SW': 'Statewide',
            'House District': 'HD',
            'State Senate District': 'SD',
            'Federal': 'FED',
            'Statewide': 'SW'
        };
        return typeMap[type] || type;
    }

    /**
     * Enforce current state permission - prevent access to restricted states
     */
    function enforceCurrentStatePermission() {
        // Hook into state selection if dashboard has a global currentStateCode
        if (window.selectState && typeof window.selectState === 'function') {
            const originalSelectState = window.selectState;
            window.selectState = function(code) {
                // If unrestricted (empty or 'ALL'), allow everything
                if (isUnrestricted(userPermissions.allowedStates)) {
                    return originalSelectState.call(this, code);
                }

                // Check if user has access to this state
                if (!userPermissions.allowedStates.some(state =>
                    state.toUpperCase() === code.toUpperCase()
                )) {
                    console.warn('Access denied for state:', code);
                    alert('You do not have access to view this state.');
                    return false;
                }

                // Proceed with original function
                return originalSelectState.call(this, code);
            };
        }

        // Check initial state if set — only enforce if restricted
        if (window.currentStateCode &&
            !isUnrestricted(userPermissions.allowedStates)) {
            const isCurrentStateAllowed = userPermissions.allowedStates.some(state =>
                state.toUpperCase() === window.currentStateCode.toUpperCase()
            );
            if (!isCurrentStateAllowed) {
                // Switch to first allowed state
                const firstAllowedState = userPermissions.allowedStates[0];
                if (window.selectState && typeof window.selectState === 'function') {
                    window.selectState(firstAllowedState);
                }
            }
        }
    }

    // ============================================================================
    // INTERCEPTION & PROTECTION
    // ============================================================================

    /**
     * Intercept console access to prevent permission bypass
     */
    function protectSession() {
        // Make session data read-only
        Object.defineProperty(window, 'currentUserSession', {
            value: currentUserSession,
            writable: false,
            configurable: false
        });
        Object.defineProperty(window, 'userPermissions', {
            value: userPermissions,
            writable: false,
            configurable: false
        });

        // Monitor sessionStorage for tampering
        const originalSetItem = sessionStorage.setItem;
        sessionStorage.setItem = function(key, value) {
            if (key === AUTH_SESSION_KEY) {
                console.warn('Attempt to modify session detected');
                return;
            }
            return originalSetItem.apply(sessionStorage, arguments);
        };
    }

    // ============================================================================
    // PUBLIC API
    // ============================================================================

    /**
     * Expose limited public API for dashboard integration
     */
    window.AuthManager = {
        /**
         * Get current user session info
         */
        getCurrentUser: function() {
            return {
                email: currentUserSession?.userEmail || currentUserSession?.email,
                userId: currentUserSession?.userId
            };
        },

        /**
         * Check if user has access to a specific state
         */
        hasStateAccess: function(stateCode) {
            // No restrictions if empty or contains 'ALL'
            if (isUnrestricted(userPermissions?.allowedStates)) {
                return true;
            }
            return userPermissions.allowedStates.some(state =>
                state.toUpperCase() === stateCode.toUpperCase()
            );
        },

        /**
         * Check if user has access to a specific race type
         */
        hasRaceTypeAccess: function(raceType) {
            // No restrictions if empty or contains 'ALL'
            if (isUnrestricted(userPermissions?.allowedRaceTypes)) {
                return true;
            }
            return userPermissions.allowedRaceTypes.some(type =>
                mapRaceType(type).toUpperCase() === mapRaceType(raceType).toUpperCase()
            );
        },

        /**
         * Get list of allowed states
         */
        getAllowedStates: function() {
            return userPermissions?.allowedStates || [];
        },

        /**
         * Get list of allowed race types
         */
        getAllowedRaceTypes: function() {
            return userPermissions?.allowedRaceTypes || [];
        },

        /**
         * Logout user
         */
        logout: logout
    };

    // ============================================================================
    // STARTUP
    // ============================================================================

    // Initialize authentication when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            initializeAuth();
            protectSession();
        });
    } else {
        initializeAuth();
        protectSession();
    }

})();
