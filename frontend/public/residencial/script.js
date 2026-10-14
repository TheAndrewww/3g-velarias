/**
 * 3G Velarias - Residential Version
 * JavaScript Interactions
 */

// Backend API URL configuration
// En producción la API va en el mismo dominio: Vercel reenvía solo /api/projects al servidor del sitio
// (reescritura en frontend/vercel.json). Así la dirección del servidor no vive en el código público.
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : '';

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
    // /images/proyectos/type/filename.ext → /images/proyectos/type/optimized/filename.webp
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
let residentialProjects = [
    {
        category: 'pergola',
        title: 'Marco Rígido con Cubierta Traslúcida',
        location: 'Irapuato, Gto',
        description: 'Estructura metálica con marco rígido en acabado negro, diseñada para cubrir pasillo residencial. Incorpora paneles traslúcidos que permiten el paso de luz natural.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/w_1200,c_limit,f_auto,q_auto:good/v1770915908/3g-velarias/residential/1770915904738-proyecto-61-1.jpg',
        coordinates: [20.6736, -101.3468],
        area: '25 m²',
        duration: '2 semanas'
    },
    {
        category: 'terraza',
        title: 'Velarias en Área de Alberca',
        location: 'Irapuato, Gto.',
        description: 'Velarias con malla sombra de alto desempeño en área de alberca residencial, proporcionando protección solar eficiente y reducción de temperatura.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/w_1200,c_limit,f_auto,q_auto:good/v1770908142/3g-velarias/residential/1770908142003-proyecto-50-2.jpg',
        coordinates: [20.6736, -101.3468],
        area: '45 m²',
        duration: '3 semanas'
    },
    {
        category: 'cochera',
        title: 'Marco rígido para vivienda',
        location: 'Irapuato, Gto',
        description: 'Marco rígido en estructura metálica con cubierta de malla sombra, desarrollado para brindar protección solar y confort térmico.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/w_1200,c_limit,f_auto,q_auto:good/v1770911503/3g-velarias/residential/1770911502784-proyecto-51-1.jpg',
        coordinates: [21.1221, -101.6826],
        area: '32 m²',
        duration: '2 semanas'
    },
    {
        category: 'jardin',
        title: 'Pergolado Residencial para Jardín',
        location: 'Irapuato, Gto',
        description: 'Pergolado residencial en área de jardín, creando un espacio de estar funcional y confortable con protección solar parcial.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/w_1200,c_limit,f_auto,q_auto:good/v1770915325/3g-velarias/residential/1770915324098-proyecto-58-2.jpg',
        coordinates: [20.9144, -100.7452],
        area: '28 m²',
        duration: '2 semanas'
    },
    {
        category: 'pergola',
        title: 'Pergolado Doble Residencial',
        location: 'Irapuato, Gto',
        description: 'Pergolado doble para residencia particular, con sistema metálico y cubierta textil arquitectónica para protección solar.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/w_1200,c_limit,f_auto,q_auto:good/v1770907209/3g-velarias/residential/1770907208949-proyecto-46-3.jpg',
        coordinates: [21.0190, -101.2574],
        area: '60 m²',
        duration: '4 semanas'
    },
    {
        category: 'cochera',
        title: 'Protección para tu auto',
        location: 'Irapuato, Gto',
        description: 'Tensoestructura con malla sombra para protección de vehículos contra la radiación solar directa. Sombra uniforme y ventilación.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/w_1200,c_limit,f_auto,q_auto:good/v1770848147/3g-velarias/residential/1770848146636-proyecto-20-3.jpg',
        coordinates: [21.1521, -101.7026],
        area: '55 m²',
        duration: '3 semanas'
    }
];


// Fallback coordinates for Bajío region (León, Irapuato, Guanajuato, SMA, Qro)
const FALLBACK_COORDINATES = [
    [20.6736, -101.3468], // Irapuato Center
    [21.1221, -101.6826], // León South
    [20.9144, -100.7452], // San Miguel de Allende
    [21.0190, -101.2574], // Guanajuato Capital
    [21.1521, -101.7026], // León North
    [20.6836, -101.3568], // Irapuato North
    [20.5888, -100.3899], // Querétaro
    [20.5222, -100.8122], // Celaya
    [20.5749, -101.1969], // Salamanca
    [20.9416, -101.4277]  // Silao
];

// Load projects from API on page load
async function loadProjectsFromAPI() {
    try {
        const response = await fetch(API_BASE_URL + '/api/projects');
        const data = await response.json();
        // Only override if data is valid
        if (data.residentialProjects && data.residentialProjects.length > 0) {
            // Map API data but ensure coordinates exist
            residentialProjects = data.residentialProjects.map((project, index) => {
                // Use existing coordinates or pick from fallback list based on index
                const coords = project.coordinates || FALLBACK_COORDINATES[index % FALLBACK_COORDINATES.length];
                return {
                    ...project,
                    coordinates: coords
                };
            });
        }
    } catch (error) {
        console.error('Error loading projects from API:', error);
        // Fallback to global variable if it exists
        if (typeof window.residentialProjects !== 'undefined') {
            residentialProjects = window.residentialProjects.map((project, index) => {
                const coords = project.coordinates || FALLBACK_COORDINATES[index % FALLBACK_COORDINATES.length];
                return {
                    ...project,
                    coordinates: coords
                };
            });
        }
        // If static data is already set (failed API and no global), it has coordinates from initialization
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
    initMap();
    initServiceVideos();
    initHeroCarousel();
});

/**
 * Page transition animation
 */
function initPageTransition() {
    const versionToggle = document.querySelector('.version-toggle');

    if (!versionToggle) return;

    versionToggle.addEventListener('click', function (e) {
        e.preventDefault();
        const targetUrl = this.getAttribute('href');

        // Create transition overlay (dark color for industrial destination)
        const overlay = document.createElement('div');
        overlay.className = 'page-transition';
        overlay.style.backgroundColor = '#0f0f0f';
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
 * Scroll-triggered animations (AOS alternative)
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
                // Add delay if specified
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
 * Project Modal / Lightbox with Gallery
 */
function initProjectModal() {
    const modal = document.getElementById('projectModal');
    const modalClose = document.getElementById('modalClose');
    const modalOverlay = modal?.querySelector('.modal-overlay');
    const projectCards = document.querySelectorAll('.project-card[data-title]');
    const modalImage = document.getElementById('modalImage');
    const galleryPrev = document.getElementById('galleryPrev');
    const galleryNext = document.getElementById('galleryNext');
    const galleryDots = document.getElementById('galleryDots');

    if (!modal || !projectCards.length) return;

    let currentImages = [];
    let currentImageIndex = 0;
    let currentProjectIndex = 0;
    let availableProjects = [];

    // Function to update image display
    function updateImage(index) {
        if (!currentImages.length) return;

        currentImageIndex = index;
        modalImage.src = currentImages[currentImageIndex];

        // Update dots
        const dots = galleryDots.querySelectorAll('.gallery-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentImageIndex);
        });
    }

    // Function to show/hide gallery controls
    function updateGalleryControls() {
        const hasMultipleImages = currentImages.length > 1;

        if (galleryPrev) galleryPrev.style.display = hasMultipleImages ? 'flex' : 'none';
        if (galleryNext) galleryNext.style.display = hasMultipleImages ? 'flex' : 'none';
        if (galleryDots) galleryDots.style.display = hasMultipleImages ? 'flex' : 'none';
    }

    // Function to create gallery dots
    function createGalleryDots() {
        if (!galleryDots) return;

        galleryDots.innerHTML = '';
        currentImages.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = 'gallery-dot';
            dot.setAttribute('aria-label', `Ir a imagen ${index + 1}`);
            if (index === currentImageIndex) dot.classList.add('active');

            dot.addEventListener('click', () => updateImage(index));
            galleryDots.appendChild(dot);
        });
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
            window.openProjectModal(availableProjects[newIndex]);
        }
    }

    // Function to open modal with data (Exposed globally for Map)
    window.openProjectModal = (data, projects = null, index = null) => {
        // Update available projects list if provided
        if (projects) {
            availableProjects = projects;
            currentProjectIndex = index !== null ? index : 0;
        }

        // PERFORMANCE FIX: Show modal immediately, defer heavy work
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        // Set text content immediately (fast)
        if (document.getElementById('modalCategory')) document.getElementById('modalCategory').textContent = data.category;
        if (document.getElementById('modalTitle')) document.getElementById('modalTitle').textContent = data.title;
        if (document.getElementById('modalDescription')) document.getElementById('modalDescription').textContent = data.description;
        if (document.getElementById('modalLocation')) document.getElementById('modalLocation').textContent = data.location;
        if (document.getElementById('modalArea')) document.getElementById('modalArea').textContent = data.area;
        if (document.getElementById('modalDuration')) document.getElementById('modalDuration').textContent = data.duration;

        // Update project navigation buttons
        updateProjectNavigation();

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
                    const images = Array.isArray(data.images) ? data.images : JSON.parse(data.images);
                    currentImages = images.map(img => getModalImageUrl(img));
                } catch (e) {
                    currentImages = [getModalImageUrl(data.image || '')];
                }
            } else {
                currentImages = [getModalImageUrl(data.image || '')];
            }

            currentImageIndex = 0;

            // Preload first image before showing
            const firstImage = new Image();
            firstImage.onload = () => {
                modalImage.src = currentImages[0];
                modalImage.style.opacity = '1';
                modalImage.style.transition = 'opacity 0.4s ease';
                if (modalGallery) modalGallery.classList.remove('loading');

                // Preload remaining gallery images in background (after first image loads)
                if (currentImages.length > 1) {
                    currentImages.slice(1).forEach((imgUrl) => {
                        const preloadImg = new Image();
                        preloadImg.src = imgUrl;
                    });
                }
            };
            firstImage.onerror = () => {
                // Fallback if optimized image fails
                modalImage.src = currentImages[0];
                modalImage.style.opacity = '1';
                if (modalGallery) modalGallery.classList.remove('loading');
            };
            firstImage.src = currentImages[0];

            // These are fast DOM operations
            createGalleryDots();
            updateGalleryControls();
        });
    };

    // Open modal on project click
    projectCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            // Get all visible project cards datasets
            const visibleProjects = Array.from(projectCards).map(c => c.dataset);
            window.openProjectModal(card.dataset, visibleProjects, index);
        });

        // Preload modal image on hover for instant modal opening
        card.addEventListener('mouseenter', () => {
            const imageUrl = card.dataset.image;
            if (imageUrl && !card._imagePreloaded) {
                const preloadImg = new Image();
                preloadImg.src = getModalImageUrl(imageUrl);
                card._imagePreloaded = true; // Mark as preloaded to avoid duplicate requests
            }
        });
    });

    // Gallery navigation
    galleryPrev?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : currentImages.length - 1;
        updateImage(newIndex);
    });

    galleryNext?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = currentImageIndex < currentImages.length - 1 ? currentImageIndex + 1 : 0;
        updateImage(newIndex);
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('active')) return;

        if (e.key === 'ArrowLeft') {
            galleryPrev?.click();
        } else if (e.key === 'ArrowRight') {
            galleryNext?.click();
        }
    });

    // Close modal handlers
    function closeModalHandler() {
        // PERFORMANCE FIX: Use RAF to batch DOM changes
        requestAnimationFrame(() => {
            modal.classList.remove('active');

            // Defer body overflow change to next frame to avoid blocking close animation
            requestAnimationFrame(() => {
                document.body.style.overflow = '';
            });
        });

        // Defer cleanup to avoid blocking (happens after modal is hidden)
        setTimeout(() => {
            currentImages = [];
            currentImageIndex = 0;
            // Clear image src to free memory
            if (modalImage) modalImage.src = '';
            // Remove will-change to free up resources
            modal.style.willChange = 'auto';
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) modalContent.style.willChange = 'auto';
        }, 300); // Match CSS transition duration
    }

    modalClose?.addEventListener('click', closeModalHandler);
    modalOverlay?.addEventListener('click', closeModalHandler);

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModalHandler();
        }
    });

    // Make closeModal globally available
    window.closeModal = closeModalHandler;

    // Project navigation event listeners
    const projectNavPrev = document.getElementById('projectNavPrev');
    const projectNavNext = document.getElementById('projectNavNext');

    projectNavPrev?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateProject('prev');
    });

    projectNavNext?.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateProject('next');
    });
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
                window.location.href = '../gracias.html?theme=residential';

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

    // Add floating label effect
    form.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.classList.add('focused');
        });

        input.addEventListener('blur', () => {
            if (!input.value) {
                input.parentElement.classList.remove('focused');
            }
        });
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
 * Project category filters
 */
/**
 * Project category filters - Handled in initDynamicProjects now to support data filtering
 */
function initProjectFilters() {
    // Legacy function kept structure but functionality moved to initDynamicProjects
}

/**
 * Global function to filter projects from service cards
 */
function filterProjects(category) {
    // Find and click the corresponding filter button
    const filterBtn = document.querySelector(`.filter-btn[data-filter="${category}"]`);
    if (filterBtn) {
        filterBtn.click();
    }

    // Scroll to projects section
    const projectsSection = document.getElementById('proyectos');
    if (projectsSection) {
        setTimeout(() => {
            projectsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

/**
 * Load more projects functionality
 */
/**
 * Dynamic Project Loading
 */
function initDynamicProjects() {
    const projectsGrid = document.getElementById('projectsGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    if (!projectsGrid || !residentialProjects || residentialProjects.length === 0) return;

    const ITEMS_PER_PAGE = 8;
    let visibleCount = 0;
    let currentFilter = 'todos';
    let filteredProjects = [...residentialProjects];

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
            // Append to grid
            projectsGrid.insertAdjacentHTML('beforeend', cardHTML);
        });

        visibleCount += nextBatch.length;

        // Animate new elements
        const newCards = projectsGrid.querySelectorAll('.project-card:not(.aos-animate)');
        newCards.forEach(card => {
            setTimeout(() => card.classList.add('aos-animate'), 50);
        });

        // Re-attach modal listeners to new cards
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
        // Remove old listeners to prevent duplicates (cloning)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', () => {
            // Update UI
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            newBtn.classList.add('active');

            currentFilter = newBtn.dataset.filter;

            // Filter Data
            if (currentFilter === 'todos') {
                filteredProjects = [...residentialProjects];
            } else {
                filteredProjects = residentialProjects.filter(p => p.category === currentFilter);
            }

            // Reset and Render
            renderProjects(false);
        });
    });
}

/**
 * Simple CSS for spinning animation
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
 * Interactive Map (Bajío Region)
 */
function initMap() {
    const mapContainer = document.getElementById('coverage-map');
    if (!mapContainer || typeof L === 'undefined' || !residentialProjects || residentialProjects.length === 0) return;

    // Center coordinates (Irapuato/Bajío)
    const center = [20.6767, -101.3563];

    // Initialize Map with dark theme options
    const map = L.map('coverage-map', {
        center: center,
        zoom: 8,
        zoomControl: true,
        scrollWheelZoom: false,
        dragging: true,
        attributionControl: false
    });

    // Light Theme Tiles (CartoDB Positron)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(map);

    // Add Coverage Radius (Bajío Focus)
    const radiusCircle = L.circle(center, {
        color: '#C41E3A', // Brand Color (Red)
        fillColor: '#C41E3A',
        fillOpacity: 0.1,
        radius: 120000, // 120km radius covering Leon, Qro, Ags, Celaya
        stroke: true,
        weight: 1
    }).addTo(map);

    // Custom Icon Definition
    const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    // Add Project Markers
    residentialProjects.forEach(project => {
        if (project.coordinates) {
            const marker = L.marker(project.coordinates, { icon: customIcon }).addTo(map);

            // Popup Content
            const popupContent = `
                <div class="map-popup">
                    <div class="map-popup-image" style="background-image: url('${getThumbnailUrl(project.image)}')"></div>
                    <div class="map-popup-info">
                        <h4>${project.title}</h4>
                        <p>${project.location}</p>
                    </div>
                </div>
            `;

            marker.bindPopup(popupContent, {
                className: 'custom-leaflet-popup',
                closeButton: false
            });

            // Hover effects
            marker.on('mouseover', function (e) {
                this.openPopup();
            });

            marker.on('mouseout', function (e) {
                this.closePopup();
            });

            // Click to open modal
            marker.on('click', function () {
                if (typeof window.openProjectModal === 'function') {
                    window.openProjectModal(project);
                } else {
                    // Fallback to old behavior if function not ready
                    const card = document.querySelector(`.project-card[data-title="${project.title}"]`);
                    if (card) card.click();
                }
            });
        }
    });

    // Handle Resize
    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
}

/**
 * Hero 3D Carousel - Shows 3 cards at once with depth perspective
 * Center card is larger, side cards are smaller with rotateY
 * Auto-slides every 4 seconds, pauses on hover
 */
function initHeroCarousel() {
    const track = document.getElementById('heroCarouselTrack');
    const dotsContainer = document.getElementById('heroCarouselDots');
    const carousel = document.getElementById('heroCarousel');

    if (!track || !dotsContainer || !carousel) return;
    if (!residentialProjects || residentialProjects.length === 0) return;

    // Take first 5 projects for the hero carousel
    const heroProjects = residentialProjects.slice(0, 5);
    let currentSlide = 0;
    let autoPlayInterval = null;
    const cards = [];

    // Capitalize helper
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    // Create carousel cards
    heroProjects.forEach((project, index) => {
        const imageUrl = getImageUrl(project.image);

        const card = document.createElement('div');
        card.className = 'hero-carousel-card';
        card.innerHTML = `
            <img src="${imageUrl}" alt="${project.title}" loading="${index === 0 ? 'eager' : 'lazy'}">
            <div class="hero-carousel-card-overlay"></div>
            <div class="hero-carousel-card-content">
                <span class="hero-carousel-card-badge">${capitalize(project.category)}</span>
                <h3 class="hero-carousel-card-title">${project.title}</h3>
                <p class="hero-carousel-card-location">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                    </svg>
                    ${project.location}
                </p>
            </div>
        `;

        // Click on active card opens modal, click on side cards navigates
        card.addEventListener('click', () => {
            if (card.classList.contains('is-active')) {
                if (typeof window.openProjectModal === 'function') {
                    window.openProjectModal(project, heroProjects, index);
                }
            } else if (card.classList.contains('is-prev')) {
                goToSlide((currentSlide - 1 + heroProjects.length) % heroProjects.length);
            } else if (card.classList.contains('is-next')) {
                goToSlide((currentSlide + 1) % heroProjects.length);
            }
        });

        track.appendChild(card);
        cards.push(card);
    });

    // Create dots
    heroProjects.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = 'hero-carousel-dot' + (index === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Ir a proyecto ${index + 1}`);
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });

    // Position cards based on current slide
    function updateCardPositions() {
        const total = heroProjects.length;

        cards.forEach((card, i) => {
            // Remove all position classes
            card.classList.remove('is-active', 'is-prev', 'is-next', 'is-far-prev', 'is-far-next');

            // Calculate relative position
            let diff = i - currentSlide;
            // Wrap around
            if (diff > total / 2) diff -= total;
            if (diff < -total / 2) diff += total;

            if (diff === 0) {
                card.classList.add('is-active');
            } else if (diff === -1) {
                card.classList.add('is-prev');
            } else if (diff === 1) {
                card.classList.add('is-next');
            } else if (diff <= -2) {
                card.classList.add('is-far-prev');
            } else {
                card.classList.add('is-far-next');
            }
        });

        // Update dots
        const dots = dotsContainer.querySelectorAll('.hero-carousel-dot');
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', i === currentSlide);
        });
    }

    // Go to specific slide
    function goToSlide(index) {
        currentSlide = index;
        updateCardPositions();
    }

    // Next slide
    function nextSlide() {
        const next = (currentSlide + 1) % heroProjects.length;
        goToSlide(next);
    }

    // Auto-play
    function startAutoPlay() {
        stopAutoPlay();
        autoPlayInterval = setInterval(nextSlide, 4000);
    }

    function stopAutoPlay() {
        if (autoPlayInterval) {
            clearInterval(autoPlayInterval);
            autoPlayInterval = null;
        }
    }

    // Pause on hover
    carousel.addEventListener('mouseenter', stopAutoPlay);
    carousel.addEventListener('mouseleave', startAutoPlay);

    // Touch & Mouse drag support
    let dragStartX = 0;
    let isDragging = false;

    function onDragStart(x) {
        dragStartX = x;
        isDragging = true;
        stopAutoPlay();
        // Disable transition during drag for responsiveness
        cards.forEach(c => c.style.transition = 'none');
    }

    function onDragMove(x) {
        if (!isDragging) return;
        const delta = x - dragStartX;
        const offsetPx = Math.max(-80, Math.min(80, delta * 0.4));
        // Apply small visual offset to active card during drag
        cards.forEach(c => {
            if (c.classList.contains('is-active')) {
                c.style.transform = `scale(1) translateX(${offsetPx}px) translateZ(0)`;
            }
        });
    }

    function onDragEnd(x) {
        if (!isDragging) return;
        isDragging = false;
        // Restore transitions
        cards.forEach(c => c.style.transition = '');
        cards.forEach(c => c.style.transform = '');

        const diff = dragStartX - x;
        if (Math.abs(diff) > 30) {
            if (diff > 0) {
                goToSlide((currentSlide + 1) % heroProjects.length);
            } else {
                goToSlide((currentSlide - 1 + heroProjects.length) % heroProjects.length);
            }
        } else {
            updateCardPositions();
        }

        startAutoPlay();
    }

    // Touch events
    carousel.addEventListener('touchstart', (e) => {
        onDragStart(e.touches[0].clientX);
    }, { passive: true });

    carousel.addEventListener('touchmove', (e) => {
        onDragMove(e.touches[0].clientX);
    }, { passive: true });

    carousel.addEventListener('touchend', (e) => {
        onDragEnd(e.changedTouches[0].clientX);
    }, { passive: true });

    // Mouse drag events (desktop)
    carousel.addEventListener('mousedown', (e) => {
        onDragStart(e.clientX);
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        onDragMove(e.clientX);
    });

    document.addEventListener('mouseup', (e) => {
        onDragEnd(e.clientX);
    });

    // Initialize positions and start
    updateCardPositions();
    startAutoPlay();
}

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
