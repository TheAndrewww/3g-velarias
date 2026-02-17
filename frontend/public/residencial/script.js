/**
 * 3G Velarias - Residential Version
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
        category: 'terraza',
        title: 'Terraza Residencial Campestre',
        location: 'Irapuato, Gto.',
        description: 'Cubierta tipo velaria para zona de asador y convivencia. Diseño ligero que maximiza la sombra sin obstruir vistas.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/v1769624000/Terraza1.jpg',
        coordinates: [20.6736, -101.3468],
        area: '45 m²',
        duration: '3 semanas'
    },
    {
        category: 'cochera',
        title: 'Cochera Doble Minimalista',
        location: 'León, Gto.',
        description: 'Estructura tensada para protección de dos vehículos. Integración arquitectónica con fachada moderna.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/v1769624000/Cochera1.jpg',
        coordinates: [21.1221, -101.6826],
        area: '32 m²',
        duration: '2 semanas'
    },
    {
        category: 'jardin',
        title: 'Cubierta Jardín Zen',
        location: 'San Miguel de Allende, Gto.',
        description: 'Velaria triangular para área de descanso en jardín. Protección UV y diseño escultural.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/v1769624000/Jardin1.jpg',
        coordinates: [20.9144, -100.7452],
        area: '28 m²',
        duration: '2 semanas'
    },
    {
        category: 'terraza',
        title: 'Roof Garden Panorámico',
        location: 'Guanajuato Capital, Gto.',
        description: 'Cubierta para terraza en azotea con vista a la ciudad. Resistencia a vientos fuertes.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/v1769624000/Terraza2.jpg',
        coordinates: [21.0190, -101.2574],
        area: '60 m²',
        duration: '4 semanas'
    },
    {
        category: 'cochera',
        title: 'Cochera Residencial El Bosque',
        location: 'León, Gto.',
        description: 'Protección para 3 autos con estructura de acero y membrana importada.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/v1769624000/Cochera2.jpg',
        coordinates: [21.1521, -101.7026],
        area: '55 m²',
        duration: '3 semanas'
    },
    {
        category: 'jardin',
        title: 'Velaria para Piscina',
        location: 'Irapuato, Gto.',
        description: 'Sombra parcial para área de alberca. Material resistente a humedad y cloro.',
        image: 'https://res.cloudinary.com/dd93jrilg/image/upload/v1769624000/Jardin2.jpg',
        coordinates: [20.6836, -101.3568],
        area: '40 m²',
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
    initHeroParticles();
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
 * Hero Particle Effect
 * Tracks mouse movement and creates a particle trail
 */
function initHeroParticles() {
    const canvas = document.getElementById('hero-particles');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let width, height;

    // Set canvas size
    function resize() {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
    }

    // Initial resize
    resize();
    window.addEventListener('resize', resize);

    // Mouse tracking
    const mouse = { x: null, y: null };

    // Only enable on non-touch devices for performance/battery
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (!isTouch) {
        document.querySelector('.hero').addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;

            // Spawn particles on move
            for (let i = 0; i < 2; i++) {
                particles.push(new Particle(mouse.x, mouse.y));
            }
        });

        document.querySelector('.hero').addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });
    }

    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            // Random direction
            this.vx = (Math.random() - 0.5) * 1.5;
            this.vy = (Math.random() - 0.5) * 1.5;
            this.size = Math.random() * 3 + 1; // 1-4px
            // Life for fading
            this.life = 1;
            this.decay = Math.random() * 0.02 + 0.01;
            this.color = '#C41E3A'; // Brand Red
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.life -= this.decay;
        }

        draw() {
            ctx.fillStyle = `rgba(196, 30, 58, ${this.life})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);

        // Update and draw
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            // Remove dead particles
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
                i--;
            }
        }

        requestAnimationFrame(animate);
    }

    animate();
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
