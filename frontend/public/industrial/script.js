/**
 * 3G Velarias - Industrial Version
 * JavaScript Interactions
 */

// Backend API URL configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://3g-velarias-production.up.railway.app';

// Helper function to get absolute image URL
function getImageUrl(imagePath) {
    if (!imagePath) return '';
    // If it's already an absolute URL (http/https), return as is
    if (imagePath.startsWith('http')) return imagePath;
    // If it starts with /, add the backend base URL
    if (imagePath.startsWith('/')) return API_BASE_URL + imagePath;
    // Otherwise, add the backend base URL with /
    return API_BASE_URL + '/' + imagePath;
}

// Helper: Optimize Cloudinary image URL for modals (high quality but compressed)
function getModalImageUrl(imagePath) {
    const url = getImageUrl(imagePath);

    // Only optimize Cloudinary images
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
        // Insert transformations: w_1200 max width, auto format, auto quality
        return url.replace('/upload/', '/upload/w_1200,f_auto,q_auto/');
    }

    return url;
}

// Helper: get optimized WebP URL for a backend image
function getOptimizedUrl(imagePath) {
    if (!imagePath || imagePath.startsWith('http')) return getImageUrl(imagePath);
    const parts = imagePath.split('/');
    const filename = parts.pop();
    const baseName = filename.replace(/\.[^.]+$/, '');
    return getImageUrl(parts.join('/') + '/optimized/' + baseName + '.webp');
}

// Helper: get thumbnail WebP URL for a backend image
function getThumbnailUrl(imagePath) {
    if (!imagePath || imagePath.startsWith('http')) return getImageUrl(imagePath);
    const parts = imagePath.split('/');
    const filename = parts.pop();
    const baseName = filename.replace(/\.[^.]+$/, '');
    return getImageUrl(parts.join('/') + '/thumbnails/' + baseName + '-thumb.webp');
}

// Global variable to store projects loaded from API
let industrialProjects = [];

// Load projects from API on page load
async function loadProjectsFromAPI() {
    try {
        const response = await fetch(API_BASE_URL + '/api/projects');
        const data = await response.json();
        industrialProjects = data.industrialProjects || [];
    } catch (error) {
        console.error('Error loading projects from API:', error);
        // Fallback to global variable if it exists
        if (typeof window.industrialProjects !== 'undefined') {
            industrialProjects = window.industrialProjects;
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load projects first
    await loadProjectsFromAPI();
    // Initialize all modules
    initHeader();
    initMobileMenu();
    initScrollAnimations();
    initContactForm();
    initSmoothScroll();
    initCounterAnimation();
    initProjectModal();
    initPageTransition();
    initProjectFilters();
    initDynamicProjects();
    initServiceVideos();

    // Defer heavy Globe initialization to reduce TBT
    setTimeout(() => {
        // Use requestIdleCallback if available for even better performance
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => initMap());
        } else {
            initMap();
        }
    }, 3500);
});

/**
 * Service Cards Video Hover Effect
 */
function initServiceVideos() {
    const serviceCards = document.querySelectorAll('.service-card');

    serviceCards.forEach(card => {
        const video = card.querySelector('.service-video');
        if (!video) return;

        // Play video on hover
        card.addEventListener('mouseenter', () => {
            video.currentTime = 0;
            video.play().catch(err => {
                // Autoplay may be blocked - that's ok
                console.log('Video autoplay blocked:', err);
            });
        });

        // Pause and reset on mouse leave
        card.addEventListener('mouseleave', () => {
            video.pause();
            video.currentTime = 0;
        });
    });
}

/**
 * Page transition animation
 */
function initPageTransition() {
    const versionToggle = document.querySelector('.version-toggle');

    if (!versionToggle) return;

    versionToggle.addEventListener('click', function (e) {
        e.preventDefault();
        const targetUrl = this.getAttribute('href');

        // Create transition overlay (light color for residential destination)
        const overlay = document.createElement('div');
        overlay.className = 'page-transition';
        overlay.style.backgroundColor = '#ffffff';
        document.body.appendChild(overlay);

        // Trigger animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
        });

        // Navigate immediately - page loads while animation plays
        // Wait a bit longer for the animation to be visible before navigating
        // 600ms allows the circle to expand significantly (animation is 1.5s)
        setTimeout(() => {
            window.location.href = targetUrl;
        }, 600);
    });
}

/**
 * Header scroll effect
 */
function initHeader() {
    const header = document.getElementById('header');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        // Add scrolled class when past 100px
        if (currentScroll > 100) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        lastScroll = currentScroll;
    });
}

/**
 * Mobile menu toggle
 */
function initMobileMenu() {
    const menuToggle = document.getElementById('menuToggle');
    const nav = document.getElementById('nav');

    if (!menuToggle || !nav) return;

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        nav.classList.toggle('active');
        document.body.style.overflow = nav.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu when clicking a link
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('active');
            nav.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

/**
 * Scroll-triggered animations
 */
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('[data-aos]');

    if (!animatedElements.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = entry.target.dataset.aosDelay || 0;
                setTimeout(() => {
                    entry.target.classList.add('aos-animate');
                }, delay);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));
}

/**
 * Counter animation for hero stats
 */
function initCounterAnimation() {
    const counters = document.querySelectorAll('.hero-stat-number');

    if (!counters.length) return;

    const observerOptions = {
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const text = element.textContent;
    const match = text.match(/(\d+)/);

    if (!match) return;

    const target = parseInt(match[0]);
    const suffix = text.replace(match[0], '');
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const updateCounter = () => {
        current += increment;
        if (current < target) {
            element.textContent = Math.floor(current) + suffix;
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target + suffix;
        }
    };

    updateCounter();
}

/**
 * Modal State
 */
let currentModalImages = [];
let currentModalImageIndex = 0;
let currentProjectIndex = 0;
let availableProjects = [];

function updateModalImage(index) {
    const modalImage = document.getElementById('modalImage');
    const galleryDots = document.getElementById('galleryDots');

    if (!currentModalImages.length || !modalImage) return;

    currentModalImageIndex = index;
    modalImage.src = currentModalImages[currentModalImageIndex];

    if (galleryDots) {
        const dots = galleryDots.querySelectorAll('.gallery-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentModalImageIndex);
        });
    }
}

// Update project navigation buttons
function updateProjectNavigation() {
    const prevBtn = document.getElementById('projectNavPrev');
    const nextBtn = document.getElementById('projectNavNext');

    if (prevBtn) prevBtn.disabled = currentProjectIndex === 0;
    if (nextBtn) nextBtn.disabled = currentProjectIndex === availableProjects.length - 1;
}

// Navigate to previous/next project
function navigateProject(direction) {
    const newIndex = direction === 'prev' ? currentProjectIndex - 1 : currentProjectIndex + 1;

    if (newIndex >= 0 && newIndex < availableProjects.length) {
        currentProjectIndex = newIndex;
        openProjectModal(availableProjects[newIndex]);
    }
}

function openProjectModal(data, projects = null, index = null) {
    // Update available projects list if provided
    if (projects) {
        availableProjects = projects;
        currentProjectIndex = index !== null ? index : 0;
    }
    const modal = document.getElementById('projectModal');
    const modalImage = document.getElementById('modalImage');
    if (!modal) return;

    // PERFORMANCE FIX: Show modal immediately, defer heavy work
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Set text content immediately (fast)
    const fields = ['Category', 'Title', 'Description', 'Location', 'Area', 'Duration'];
    fields.forEach(field => {
        const key = field.toLowerCase();
        const el = document.getElementById(`modal${field}`);
        if (el && data[key]) el.textContent = data[key];
    });

    // Show loading state
    const modalGallery = modal.querySelector('.modal-gallery');
    if (modalImage && modalGallery) {
        modalGallery.classList.add('loading');
        modalImage.style.opacity = '0';
    }

    // Defer image loading to next frame (non-blocking)
    requestAnimationFrame(() => {
        // Handle images - use optimized URLs for modal
        if (data.images) {
            try {
                const images = typeof data.images === 'string' ? JSON.parse(data.images) : data.images;
                currentModalImages = images.map(img => getModalImageUrl(img));
            } catch (e) {
                currentModalImages = [getModalImageUrl(data.image || '')];
            }
        } else {
            currentModalImages = [getModalImageUrl(data.image || '')];
        }

        currentModalImageIndex = 0;

        // Preload first image before showing
        const firstImage = new Image();
        const modalGallery = modal.querySelector('.modal-gallery');

        firstImage.onload = () => {
            modalImage.src = currentModalImages[0];
            modalImage.style.opacity = '1';
            modalImage.style.transition = 'opacity 0.4s ease';
            if (modalGallery) modalGallery.classList.remove('loading');

            // Preload remaining gallery images in background (after first image loads)
            if (currentModalImages.length > 1) {
                currentModalImages.slice(1).forEach((imgUrl) => {
                    const preloadImg = new Image();
                    preloadImg.src = imgUrl;
                });
            }
        };
        firstImage.onerror = () => {
            // Fallback if optimized image fails
            modalImage.src = currentModalImages[0];
            modalImage.style.opacity = '1';
            if (modalGallery) modalGallery.classList.remove('loading');
        };
        firstImage.src = currentModalImages[0];

        // Gallery Dots
        const galleryDots = document.getElementById('galleryDots');
        if (galleryDots) {
            galleryDots.innerHTML = '';
            currentModalImages.forEach((_, index) => {
                const dot = document.createElement('button');
                dot.className = 'gallery-dot';
                dot.setAttribute('aria-label', `Ir a imagen ${index + 1}`);
                if (index === 0) dot.classList.add('active');
                dot.addEventListener('click', () => updateModalImage(index));
                galleryDots.appendChild(dot);
            });
        }

        // Controls Visibility
        const galleryPrev = document.getElementById('galleryPrev');
        const galleryNext = document.getElementById('galleryNext');
        const hasMultiple = currentModalImages.length > 1;

        if (galleryPrev) galleryPrev.style.display = hasMultiple ? 'flex' : 'none';
        if (galleryNext) galleryNext.style.display = hasMultiple ? 'flex' : 'none';
        if (galleryDots) galleryDots.style.display = hasMultiple ? 'flex' : 'none';

        // Update project navigation buttons
        updateProjectNavigation();
    });
}

/**
 * Project Modal / Lightbox with Gallery
 */
function initProjectModal() {
    const modal = document.getElementById('projectModal');
    const modalClose = document.getElementById('modalClose');
    const modalOverlay = modal?.querySelector('.modal-overlay');
    const projectCards = document.querySelectorAll('.project-card[data-title]');
    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');

    if (!modal) return;

    // Card Listeners (Delegation would be better but direct attach works for now)
    // Note: initDynamicProjects reures this function to attach listeners to new cards
    projectCards.forEach((card, index) => {
        // Remove existing listeners to avoid duplicates if called multiple times
        // A simple way is to clone and replace, but for now we just assume this is called fresh or we relying on garbage collection if elements are replaced.
        // Since initDynamicProjects replaces innerHTML or appends new elements, we should only attach to new ones or just re-attach.
        // Better pattern: initDynamicProjects handles its own listeners or we use delegation.
        // For existing architecture, we'll keep it simple.

        // Remove old listener if possible? No easy way without named function.
        // Let's just attach. If initDynamicProjects clears grid, it's fine.
        const visibleProjects = Array.from(projectCards).map(c => c.dataset);
        card.onclick = () => openProjectModal(card.dataset, visibleProjects, index);

        // Preload modal image on hover for instant modal opening
        card.onmouseenter = () => {
            const imageUrl = card.dataset.image;
            if (imageUrl && !card._imagePreloaded) {
                const preloadImg = new Image();
                preloadImg.src = getModalImageUrl(imageUrl);
                card._imagePreloaded = true; // Mark as preloaded to avoid duplicate requests
            }
        };
    });

    // Navigation Listeners - Attach only once
    if (!galleryPrev._hasListener) {
        galleryPrev?.addEventListener('click', (e) => {
            e.stopPropagation();
            const newIndex = currentModalImageIndex > 0 ? currentModalImageIndex - 1 : currentModalImages.length - 1;
            updateModalImage(newIndex);
        });
        if (galleryPrev) galleryPrev._hasListener = true;
    }

    if (!galleryNext._hasListener) {
        galleryNext?.addEventListener('click', (e) => {
            e.stopPropagation();
            const newIndex = currentModalImageIndex < currentModalImages.length - 1 ? currentModalImageIndex + 1 : 0;
            updateModalImage(newIndex);
        });
        if (galleryNext) galleryNext._hasListener = true;
    }

    // Keyboard & Close - Attach only once
    if (!window._modalListenersAttached) {
        document.addEventListener('keydown', (e) => {
            if (!modal.classList.contains('active')) return;
            if (e.key === 'ArrowLeft') galleryPrev?.click();
            if (e.key === 'ArrowRight') galleryNext?.click();
            if (e.key === 'Escape') closeModal();
        });

        modalClose?.addEventListener('click', closeModal);
        modalOverlay?.addEventListener('click', closeModal);

        window._modalListenersAttached = true;
    }

    // Close
    function closeModal() {
        // PERFORMANCE FIX: Use RAF to batch DOM changes
        requestAnimationFrame(() => {
            modal.classList.remove('active');

            // Defer body overflow change to next frame to avoid blocking close animation
            requestAnimationFrame(() => {
                document.body.style.overflow = '';
            });
        });

        // Defer cleanup to avoid blocking (happens after modal is hidden)
        const modalImage = document.getElementById('modalImage');
        setTimeout(() => {
            currentModalImages = [];
            currentModalImageIndex = 0;
            // Clear image src to free memory
            if (modalImage) modalImage.src = '';
            // Remove will-change to free up resources
            modal.style.willChange = 'auto';
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) modalContent.style.willChange = 'auto';
        }, 300); // Match CSS transition duration
    }

    window.closeModal = closeModal;
    window.openProjectModal = openProjectModal; // Expose for Map

    // Project navigation event listeners
    const projectNavPrev = document.getElementById('projectNavPrev');
    const projectNavNext = document.getElementById('projectNavNext');

    if (!projectNavPrev?._hasListener) {
        projectNavPrev?.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateProject('prev');
        });
        if (projectNavPrev) projectNavPrev._hasListener = true;
    }

    if (!projectNavNext?._hasListener) {
        projectNavNext?.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateProject('next');
        });
        if (projectNavNext) projectNavNext._hasListener = true;
    }
}

/**
 * Contact form handling
 */
function initContactForm() {
    const form = document.getElementById('contactForm');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        // Show loading state
        submitBtn.innerHTML = `
            <span>Enviando...</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
            </svg>
        `;
        submitBtn.disabled = true;

        try {
            // Send form data using fetch
            const formData = new FormData(form);
            const response = await fetch(form.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                // Redirect to Thank You Page for Conversion Tracking
                window.location.href = '../gracias.html?theme=dark';

                // Backup success msg
                submitBtn.innerHTML = `
                    <span>¡Enviado! Redirigiendo...</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                `;
                submitBtn.style.background = '#10B981';

                // Reset form
                form.reset();
            } else {
                throw new Error('Error al enviar formulario');
            }
        } catch (error) {
            // Show error state
            submitBtn.innerHTML = `
                <span>Error. Intente de nuevo</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
            `;
            submitBtn.style.background = '#EF4444';
        }

        // Reset button after 3 seconds
        setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.style.background = '';
        }, 3000);
    });
}

/**
 * Smooth scroll for anchor links
 */
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));

            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

/**
 * Project category filters - Handled in initDynamicProjects
 */
function initProjectFilters() {
    // Legacy function kept structure but functionality moved to initDynamicProjects
}

/**
 * Dynamic Project Loading
 */
function initDynamicProjects() {
    const projectsGrid = document.getElementById('projectsGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!projectsGrid || !industrialProjects || industrialProjects.length === 0) return;

    const ITEMS_PER_PAGE = 8;
    let visibleCount = 0;
    let currentFilter = 'todos';
    let filteredProjects = [...industrialProjects];

    // Function to create project card HTML
    const createProjectCard = (project, index) => {
        const delay = (index % ITEMS_PER_PAGE) * 100;

        // Convert image URLs to optimized versions
        const optimizedImageUrl = getOptimizedUrl(project.image);
        const thumbnailUrl = getThumbnailUrl(project.image);
        const absoluteImages = project.images && project.images.length
            ? project.images.map(img => getOptimizedUrl(img))
            : [optimizedImageUrl];

        // Handle single image vs multiple images array
        let imagesAttr = `data-images='${JSON.stringify(absoluteImages)}'`;

        return `
            <article class="project-card" data-aos="fade-up" data-aos-delay="${delay}"
                data-category="${project.category}"
                data-title="${project.title}"
                data-location="${project.location}"
                data-area="${project.area}"
                data-duration="${project.duration}"
                data-description="${project.description}"
                data-image="${optimizedImageUrl}"
                ${imagesAttr}>
                <div class="project-image">
                    <img src="${thumbnailUrl}" alt="${project.title}" loading="lazy" width="400" height="300">
                </div>
                <div class="project-info">
                    <span class="project-category">${capitalizeFirst(project.category)}</span>
                    <h3 class="project-title">${project.title}</h3>
                    <p class="project-location">${project.location}</p>
                </div>
            </article>
        `;
    };

    const capitalizeFirst = (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Render projects
    const renderProjects = (append = false) => {
        if (!append) {
            projectsGrid.innerHTML = '';
            visibleCount = 0;
        }

        const nextBatch = filteredProjects.slice(visibleCount, visibleCount + ITEMS_PER_PAGE);

        nextBatch.forEach((project, index) => {
            const cardHTML = createProjectCard(project, index);
            projectsGrid.insertAdjacentHTML('beforeend', cardHTML);
        });

        visibleCount += nextBatch.length;

        // Animate new elements
        const newCards = projectsGrid.querySelectorAll('.project-card:not(.aos-animate)');
        newCards.forEach(card => {
            setTimeout(() => card.classList.add('aos-animate'), 50);
        });

        // Re-attach modal listeners
        initProjectModal();

        // Intelligent image preloading
        initImagePreloading();

        // Update button visibility
        if (visibleCount >= filteredProjects.length) {
            loadMoreBtn.style.display = 'none';
        } else {
            loadMoreBtn.style.display = 'inline-flex';
            loadMoreBtn.classList.remove('hidden');
        }
    };

    // Initial Render
    renderProjects();

    // Load More Click
    loadMoreBtn?.addEventListener('click', () => {
        renderProjects(true);
    });

    // Handle Filters
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            newBtn.classList.add('active');

            currentFilter = newBtn.dataset.filter;

            if (currentFilter === 'todos') {
                filteredProjects = [...industrialProjects];
            } else {
                filteredProjects = industrialProjects.filter(p => p.category === currentFilter);
            }

            renderProjects(false);
        });
    });

    // Expose filter function for Service Cards
    window.filterProjects = (category) => {
        const btn = document.querySelector(`.filter-btn[data-filter="${category}"]`);
        if (btn) {
            btn.click();
            const projectsSection = document.getElementById('proyectos');
            if (projectsSection) {
                const headerOffset = 80;
                const elementPosition = projectsSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        }
    };
}

/**
 * Intelligent Image Preloading with Intersection Observer
 * Preloads modal images when project cards are about to be visible
 */
function initImagePreloading() {
    const projectCards = document.querySelectorAll('.project-card[data-image]');

    if (!projectCards.length) return;

    // Create Intersection Observer
    const preloadObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target._imagePreloaded) {
                const imageUrl = entry.target.dataset.image;

                if (imageUrl) {
                    // Preload the modal image
                    const preloadImg = new Image();
                    preloadImg.src = getModalImageUrl(imageUrl);

                    // Mark as preloaded to avoid duplicate requests
                    entry.target._imagePreloaded = true;

                    // Stop observing this card
                    preloadObserver.unobserve(entry.target);
                }
            }
        });
    }, {
        root: null, // viewport
        rootMargin: '200px', // Start preloading 200px before card is visible
        threshold: 0.01 // Trigger as soon as 1% is visible
    });

    // Observe all project cards
    projectCards.forEach(card => {
        preloadObserver.observe(card);
    });
}

/**
 * CSS for spinning animation
 */
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    .spin {
        animation: spin 1s linear infinite;
    }
`;
document.head.appendChild(style);

/**
 * 3D Globe Animation (Hero Background)
 */
/**
 * 3D Globe Animation (Hero Background)
 */
function initMap() {
    const mapContainer = document.getElementById('map');
    // Skip globe on mobile for performance (Three.js + Globe.gl ~1MB)
    if (window.innerWidth < 768) {
        if (mapContainer) mapContainer.style.display = 'none';
        return;
    }
    // Ensure Globe is defined. If not, we might need to wait or it's a script load issue.
    if (!mapContainer || typeof Globe === 'undefined' || typeof industrialProjects === 'undefined') return;

    // Filter valid projects
    const validProjects = industrialProjects.filter(p => p.coordinates);

    // Create Info Card Overlay
    const infoCard = document.createElement('div');
    infoCard.className = 'globe-info-card';
    infoCard.style.cssText = `
        position: absolute;
        transform: translate(-50%, -100%);
        background: rgba(26, 26, 26, 0.98);
        border: 1px solid rgba(196, 30, 58, 0.4);
        padding: 0;
        border-radius: clamp(10px, 1.5vw, 14px);
        color: white;
        width: clamp(240px, 18vw, 320px);
        max-width: calc(100vw - 40px);
        backdrop-filter: blur(20px);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
        opacity: 0;
        transition: opacity 0.5s ease, transform 0.5s ease, top 0.5s ease, left 0.5s ease;
        z-index: 9999;
        pointer-events: auto;
        font-family: 'Outfit', sans-serif;
        overflow: hidden;
    `;


    // Inject CSS for Pin Animations
    const styleId = 'globe-pin-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .pin-wrap {
                position: relative; 
                /* Container positioned by Globe.gl */
            }
            .pin-marker {
                width: 24px;
                height: 24px;
                position: absolute;
                transform: translate(-50%, -100%);
                cursor: pointer;
                pointer-events: auto;
                transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); /* Bouncy transition */
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
                z-index: 1;
            }
            .pin-marker path {
                fill: #C41E3A;
                transition: fill 0.4s ease;
            }
            .pin-marker.active {
                width: 42px;
                height: 42px;
                z-index: 100;
                filter: drop-shadow(0 0 15px rgba(255, 71, 87, 0.8));
                animation: pinPulse 2s infinite ease-in-out;
            }
            .pin-marker.active path {
                fill: #ff4757;
            }
            @keyframes pinPulse {
                0% { transform: translate(-50%, -100%) scale(1); }
                50% { transform: translate(-50%, -100%) scale(1.15); }
                100% { transform: translate(-50%, -100%) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // SVG Pin Template
    const pinSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="100%" height="100%">
            <g transform="translate(1.4 1.4) scale(2.81 2.81)">
                <path d="M 45 0 C 25.463 0 9.625 15.838 9.625 35.375 c 0 8.722 3.171 16.693 8.404 22.861 L 45 90 l 26.97 -31.765 c 5.233 -6.167 8.404 -14.139 8.404 -22.861 C 80.375 15.838 64.537 0 45 0 z M 45 48.705 c -8.035 0 -14.548 -6.513 -14.548 -14.548 c 0 -8.035 6.513 -14.548 14.548 -14.548 s 14.548 6.513 14.548 14.548 C 59.548 42.192 53.035 48.705 45 48.705 z" stroke="none"/>
            </g>
        </svg>
    `;

    // Function to position card above a specific pin
    const updateCardPosition = (globe, project) => {
        if (!globe || !project) return;

        // Use Globe.gl's built-in utility
        const screenCoords = globe.getScreenCoords(
            project.coordinates[0],
            project.coordinates[1],
            0.01
        );

        if (!screenCoords) {
            infoCard.style.opacity = '0';
            infoCard.style.pointerEvents = 'none';
            return;
        }

        const { x, y } = screenCoords;
        const canvas = globe.renderer().domElement;
        const rect = canvas.getBoundingClientRect();

        // Calculate absolute position on page relative to document
        // x, y are relative to canvas top-left
        const pageX = rect.left + window.scrollX + x;
        const pageY = rect.top + window.scrollY + y;

        infoCard.style.left = `${pageX}px`;
        infoCard.style.top = `${pageY}px`;

        // Card positioning relative to pin (centered horizontally, above vertically)
        infoCard.style.transform = 'translate(-50%, calc(-100% - 40px))';
        infoCard.style.display = 'block';
        infoCard.style.pointerEvents = 'auto'; // Re-enable pointer events when visible
    };

    // Append to body to avoid z-index/overflow issues in container
    document.body.appendChild(infoCard);

    // Initialize Globe
    fetch('https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(countries => {
            const globe = Globe()
                .globeImageUrl(null)
                .backgroundColor('rgba(0,0,0,0)')
                .showAtmosphere(true)
                .atmosphereColor('#333333')
                .atmosphereAltitude(0.1)

                // Polygons
                .polygonsData(countries.features)
                .polygonCapColor(() => '#090909')
                .polygonSideColor(() => 'rgba(0,0,0,0)')
                .polygonStrokeColor(() => '#333333')
                .polygonAltitude(0.005)

                // HTML Elements (SVG Pins)
                .htmlElementsData(validProjects)
                .htmlLat(d => d.coordinates[0])
                .htmlLng(d => d.coordinates[1])
                .htmlAltitude(0)
                .htmlElement(d => {
                    // Create the inner pin element
                    const el = document.createElement('div');
                    el.innerHTML = pinSVG;
                    el.className = 'pin-marker'; // Use CSS class

                    // Container managed by Globe.gl
                    const container = document.createElement('div');
                    container.className = 'pin-wrap';
                    container.appendChild(el);

                    // Hover interactions
                    el.onmouseenter = () => {
                        if (!d.isActive) {
                            el.style.transform = 'translate(-50%, -100%) scale(1.2)';
                            el.querySelector('path').style.fill = '#ff4757';
                        }
                    };
                    el.onmouseleave = () => {
                        if (!d.isActive) {
                            el.style.transform = 'translate(-50%, -100%)';
                            el.querySelector('path').style.fill = '#C41E3A';
                        }
                    };

                    // Click to open project modal
                    el.onclick = () => {
                        if (typeof window.openProjectModal === 'function') {
                            window.openProjectModal(d);
                        }
                    };

                    // Mark element for update loop
                    d.__element = el;

                    return container;
                })
                .htmlTransitionDuration(1000)
                (mapContainer);

            // Initial View
            globe.pointOfView({ lat: 20.5, lng: -100.0, altitude: 2.0 });
            globe.controls().enableZoom = false;
            globe.controls().autoRotate = true;
            globe.controls().autoRotateSpeed = 0.5;
            globe.controls().enablePan = false;

            startAnimationLoop(globe, infoCard, validProjects);
        })
        .catch(err => {
            console.error('Globe Init Failed', err);
        });

    function startAnimationLoop(globe, infoCard, validProjects) {
        let currentIndex = -1; // Start at -1 so first increment goes to 0
        let currentProject = null;
        let cardVisible = false;

        // Animation Loop - Purely for Card Position
        // Pin styles are now handled via CSS classes toggled in cycleProjects
        function updateLoop() {
            // Check if modal is open
            const modal = document.getElementById('projectModal');
            if (modal && modal.classList.contains('active')) {
                // Hide card and pause rotation if modal is open
                infoCard.style.opacity = '0';
                infoCard.style.pointerEvents = 'none';
                globe.controls().autoRotate = false;
                requestAnimationFrame(updateLoop);
                return;
            }

            if (cardVisible && currentProject) {
                updateCardPosition(globe, currentProject);
            }
            requestAnimationFrame(updateLoop);
        }
        updateLoop();

        function cycleProjects() {
            // Check if modal is open - if so, try again in 1s without changing anything
            const modal = document.getElementById('projectModal');
            if (modal && modal.classList.contains('active')) {
                setTimeout(cycleProjects, 1000);
                return;
            }
            // 1. Deactivate old
            if (currentProject) {
                currentProject.isActive = false;
                if (currentProject.__element) {
                    currentProject.__element.classList.remove('active');
                }
            }

            // 2. Increment
            currentIndex = (currentIndex + 1) % validProjects.length;
            currentProject = validProjects[currentIndex];

            // 3. Activate new
            currentProject.isActive = true;
            if (currentProject.__element) {
                currentProject.__element.classList.add('active'); // CSS Animation triggers here
            }

            // 4. Hide old card
            infoCard.style.opacity = '0';
            cardVisible = false;

            // 5. Move Camera
            globe.pointOfView({
                lat: currentProject.coordinates[0],
                lng: currentProject.coordinates[1],
                altitude: 0.6
            }, 2000);

            globe.controls().autoRotate = false;

            // 6. Show Card (after flight)
            setTimeout(() => {
                infoCard.innerHTML = `
                    <div class="globe-card-content" style="position: relative;">
                         ${currentProject.image ? `<img src="${getImageUrl(currentProject.image)}" alt="${currentProject.title}" style="width: 100%; height: clamp(90px, 10vw, 140px); object-fit: cover; display: block;">` : ''}
                        <div style="padding: clamp(12px, 1.5vw, 18px);">
                            <div style="display: inline-block; background: rgba(196, 30, 58, 0.15); color: #C41E3A; padding: 4px 10px; border-radius: 20px; font-size: clamp(0.55rem, 0.8vw, 0.65rem); font-weight: 600; margin-bottom: clamp(8px, 1vw, 12px); text-transform: uppercase; letter-spacing: 1px; border: 1px solid rgba(196, 30, 58, 0.3);">
                                ${currentProject.category}
                            </div>
                            <h3 style="margin: 0 0 clamp(6px, 0.8vw, 8px) 0; color: #ffffff; font-size: clamp(0.9rem, 1.2vw, 1.15rem); font-weight: 600; line-height: 1.3;">
                                ${currentProject.title}
                            </h3>
                            <div style="display: flex; align-items: center; gap: 5px; margin-bottom: clamp(8px, 1vw, 12px); color: #a0a0a0; font-size: clamp(0.7rem, 0.9vw, 0.8rem);">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                                    <circle cx="12" cy="10" r="3"/>
                                </svg>
                                ${currentProject.location}
                            </div>
                            <div style="display: flex; gap: clamp(8px, 1vw, 12px); padding-top: clamp(10px, 1vw, 14px); border-top: 1px solid rgba(255,255,255,0.08);">
                                <div style="flex: 1; background: rgba(255,255,255,0.03); padding: clamp(6px, 0.8vw, 10px); border-radius: 6px;">
                                    <div style="font-size: clamp(0.5rem, 0.7vw, 0.6rem); color: #707070; text-transform: uppercase; margin-bottom: 3px; letter-spacing: 0.5px;">Área</div>
                                    <div style="font-size: clamp(0.7rem, 0.9vw, 0.85rem); color: #ffffff; font-weight: 600;">${currentProject.area}</div>
                                </div>
                                <div style="flex: 1; background: rgba(255,255,255,0.03); padding: clamp(6px, 0.8vw, 10px); border-radius: 6px;">
                                    <div style="font-size: clamp(0.5rem, 0.7vw, 0.6rem); color: #707070; text-transform: uppercase; margin-bottom: 3px; letter-spacing: 0.5px;">Duración</div>
                                    <div style="font-size: clamp(0.7rem, 0.9vw, 0.85rem); color: #ffffff; font-weight: 600;">${currentProject.duration}</div>
                                </div>
                            </div>
                        </div>
                        <button onclick="window.openProjectModal(industrialProjects.find(p => p.title === '${currentProject.title}'))" style="position: absolute; bottom: clamp(12px, 1.5vw, 18px); right: clamp(12px, 1.5vw, 18px); background: #C41E3A; color: white; border: none; width: clamp(32px, 3vw, 38px); height: clamp(32px, 3vw, 38px); border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(196, 30, 58, 0.4); transition: all 0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </button>
                    </div>
                `;

                cardVisible = true;
                updateCardPosition(globe, currentProject);

                setTimeout(() => {
                    infoCard.style.opacity = '1';
                }, 100);

            }, 2000);

            // Next Cycle
            setTimeout(cycleProjects, 7000); // 7s per project
        }

        setTimeout(cycleProjects, 1000);
    }
}
