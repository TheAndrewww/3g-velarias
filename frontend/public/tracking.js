/**
 * 3G Velarias — Google Ads Tracking Script
 * Shared across Industrial + Residential pages
 * 
 * Features:
 * - UTM + gclid capture and persistence (sessionStorage)
 * - Hidden form field injection
 * - Hero CTA click tracking
 * - Form start/abandon tracking
 * - WhatsApp float differentiation
 * - Project modal view tracking
 * - Enhanced contact event tracking
 */

(function () {
    'use strict';

    window.dataLayer = window.dataLayer || [];

    // =========================================================
    // 1. UTM + GCLID CAPTURE
    // =========================================================
    var UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid'];

    function captureUTMs() {
        var params = new URLSearchParams(window.location.search);
        var hasNew = false;

        UTM_PARAMS.forEach(function (key) {
            var value = params.get(key);
            if (value) {
                try { sessionStorage.setItem(key, value); } catch (e) { }
                hasNew = true;
            }
        });

        // Also store landing page and timestamp on first visit
        if (hasNew) {
            try {
                sessionStorage.setItem('landing_page', window.location.pathname);
                sessionStorage.setItem('landing_time', new Date().toISOString());
            } catch (e) { }
        }
    }

    function getStoredUTMs() {
        var data = {};
        UTM_PARAMS.forEach(function (key) {
            try {
                var val = sessionStorage.getItem(key);
                if (val) data[key] = val;
            } catch (e) { }
        });
        try {
            var lp = sessionStorage.getItem('landing_page');
            if (lp) data['landing_page'] = lp;
        } catch (e) { }
        return data;
    }

    captureUTMs();

    // =========================================================
    // 2. INJECT HIDDEN FIELDS INTO FORMS
    // =========================================================
    function injectHiddenFields() {
        var form = document.getElementById('contactForm');
        if (!form) return;

        var utms = getStoredUTMs();
        var pageType = document.querySelector('meta[name="page-type"]');
        var pageTypeValue = pageType ? pageType.content : 'unknown';

        // Add page type
        addHiddenField(form, 'Origen_Pagina', pageTypeValue);

        // Add all UTM params
        if (utms.utm_source) addHiddenField(form, 'UTM_Source', utms.utm_source);
        if (utms.utm_medium) addHiddenField(form, 'UTM_Medium', utms.utm_medium);
        if (utms.utm_campaign) addHiddenField(form, 'UTM_Campaign', utms.utm_campaign);
        if (utms.utm_term) addHiddenField(form, 'UTM_Term', utms.utm_term);
        if (utms.utm_content) addHiddenField(form, 'UTM_Content', utms.utm_content);
        if (utms.gclid) addHiddenField(form, 'Google_Click_ID', utms.gclid);
        if (utms.gbraid) addHiddenField(form, 'Google_Gbraid', utms.gbraid);
        if (utms.wbraid) addHiddenField(form, 'Google_Wbraid', utms.wbraid);
        if (utms.landing_page) addHiddenField(form, 'Landing_Page', utms.landing_page);

        // Add referrer
        if (document.referrer) {
            addHiddenField(form, 'Referente', document.referrer);
        }
    }

    function addHiddenField(form, name, value) {
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    }

    // =========================================================
    // 3. HERO CTA TRACKING
    // =========================================================
    function initHeroCTATracking() {
        var heroCTAs = document.querySelectorAll('.hero-cta a');
        heroCTAs.forEach(function (cta) {
            cta.addEventListener('click', function () {
                var label = cta.textContent.trim();
                var isQuote = cta.classList.contains('btn-primary');
                window.dataLayer.push({
                    'event': 'cta_click',
                    'cta_text': label,
                    'cta_type': isQuote ? 'quote_request' : 'view_projects',
                    'cta_location': 'hero',
                    'page_type': getPageType()
                });
            });
        });
    }

    // =========================================================
    // 4. FORM START / INTERACTION TRACKING
    // =========================================================
    function initFormTracking() {
        var form = document.getElementById('contactForm');
        if (!form) return;

        var formStarted = false;
        var fields = form.querySelectorAll('input:not([type="hidden"]), select, textarea');

        fields.forEach(function (field) {
            field.addEventListener('focus', function () {
                if (!formStarted) {
                    formStarted = true;
                    window.dataLayer.push({
                        'event': 'form_start',
                        'form_name': 'contacto',
                        'page_type': getPageType()
                    });
                }
            }, { once: false });
        });

        // Track form field completion for funnel analysis
        form.addEventListener('submit', function () {
            var utms = getStoredUTMs();
            window.dataLayer.push({
                'event': 'form_submit',
                'form_name': 'contacto',
                'page_type': getPageType(),
                'utm_source': utms.utm_source || '(direct)',
                'utm_medium': utms.utm_medium || '(none)',
                'utm_campaign': utms.utm_campaign || '(none)',
                'has_gclid': !!utms.gclid
            });

            // Store form data for gracias.html enhanced conversion
            try {
                var projectType = form.querySelector('select');
                if (projectType) {
                    sessionStorage.setItem('last_project_type', projectType.value);
                }
                sessionStorage.setItem('form_page_type', getPageType());
            } catch (e) { }
        });
    }

    // =========================================================
    // 5. WHATSAPP TRACKING (DIFFERENTIATED)
    // =========================================================
    function initWhatsAppTracking() {
        // Float button
        var floatBtn = document.querySelector('.whatsapp-float');
        if (floatBtn) {
            floatBtn.addEventListener('click', function () {
                window.dataLayer.push({
                    'event': 'contact_whatsapp',
                    'whatsapp_location': 'float_button',
                    'page_type': getPageType(),
                    'utm_source': getUTM('utm_source'),
                    'utm_campaign': getUTM('utm_campaign')
                });
            });
        }

        // Contact section WhatsApp links
        var contactWA = document.querySelectorAll('.contact a[href*="wa.me"], .contact-info a[href*="wa.me"]');
        contactWA.forEach(function (link) {
            link.addEventListener('click', function () {
                window.dataLayer.push({
                    'event': 'contact_whatsapp',
                    'whatsapp_location': 'contact_section',
                    'page_type': getPageType(),
                    'utm_source': getUTM('utm_source'),
                    'utm_campaign': getUTM('utm_campaign')
                });
            });
        });

        // Footer WhatsApp links
        var footerWA = document.querySelectorAll('.footer a[href*="wa.me"]');
        footerWA.forEach(function (link) {
            link.addEventListener('click', function () {
                window.dataLayer.push({
                    'event': 'contact_whatsapp',
                    'whatsapp_location': 'footer',
                    'page_type': getPageType(),
                    'utm_source': getUTM('utm_source'),
                    'utm_campaign': getUTM('utm_campaign')
                });
            });
        });
    }

    // =========================================================
    // 6. PHONE + EMAIL TRACKING (ENHANCED)
    // =========================================================
    function initContactTracking() {
        // Phone clicks
        document.querySelectorAll('a[href^="tel:"]').forEach(function (link) {
            link.addEventListener('click', function () {
                window.dataLayer.push({
                    'event': 'contact_phone',
                    'phone_location': getElementLocation(link),
                    'page_type': getPageType(),
                    'utm_source': getUTM('utm_source'),
                    'utm_campaign': getUTM('utm_campaign')
                });
            });
        });

        // Email clicks
        document.querySelectorAll('a[href^="mailto:"]').forEach(function (link) {
            link.addEventListener('click', function () {
                window.dataLayer.push({
                    'event': 'contact_email',
                    'email_location': getElementLocation(link),
                    'page_type': getPageType(),
                    'utm_source': getUTM('utm_source'),
                    'utm_campaign': getUTM('utm_campaign')
                });
            });
        });
    }

    // =========================================================
    // 7. PROJECT MODAL VIEW TRACKING
    // =========================================================
    function initModalTracking() {
        // Use MutationObserver to detect when modal becomes visible
        var modal = document.getElementById('projectModal');
        if (!modal) return;

        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (modal.classList.contains('active')) {
                        var title = modal.querySelector('.modal-title, h2, h3');
                        var titleText = title ? title.textContent.trim() : 'unknown';
                        window.dataLayer.push({
                            'event': 'project_view',
                            'project_name': titleText,
                            'page_type': getPageType()
                        });
                    }
                }
            });
        });

        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // =========================================================
    // HELPERS
    // =========================================================
    function getPageType() {
        var meta = document.querySelector('meta[name="page-type"]');
        return meta ? meta.content : 'unknown';
    }

    function getUTM(key) {
        try { return sessionStorage.getItem(key) || '(none)'; } catch (e) { return '(none)'; }
    }

    function getElementLocation(el) {
        if (el.closest('.footer')) return 'footer';
        if (el.closest('.contact')) return 'contact_section';
        if (el.closest('.hero')) return 'hero';
        return 'other';
    }

    // =========================================================
    // INIT ON DOM READY
    // =========================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        injectHiddenFields();
        initHeroCTATracking();
        initFormTracking();
        initWhatsAppTracking();
        initContactTracking();
        initModalTracking();
    }

})();
