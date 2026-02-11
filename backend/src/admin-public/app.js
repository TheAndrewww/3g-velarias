let currentTab = 'residential'; // 'residential' or 'industrial'
let editProjectId = null; // Track the DB ID if we are editing
let projects = { residentialProjects: [], industrialProjects: [] };

let currentImages = []; // Array of mixed types: (String | File)
let map = null; // Leaflet map instance
let marker = null; // Map marker
let sortable = null; // Sortable instance for images

// Search & Filter state
let searchTerm = '';
let categoryFilter = '';

// DOM Elements
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modal-content');
const form = document.getElementById('projectForm');
const grid = document.getElementById('projects-grid');
const imageInput = document.getElementById('imageInput');
const gallery = document.getElementById('image-gallery');
const industrialFields = document.getElementById('industrial-fields');
const searchInput = document.getElementById('search-input');
const categoryFilterSelect = document.getElementById('category-filter');
const emptyState = document.getElementById('empty-state');
const projectCount = document.getElementById('project-count');

// Categories
const CATEGORIES = {
    residential: ['pergola', 'terraza', 'cochera', 'jardin', 'otro'],
    industrial: ['estacionamiento', 'comercial', 'escuela', 'deportivo', 'industrial']
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    fetchProjects();
    setupImageHandlers();
    setupSearchAndFilters();
    initMap();
    setupLogout();
});

// Load configuration from backend
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        window.FRONTEND_URL = config.frontendUrl || 'http://localhost:5173';
    } catch (error) {
        console.error('Error loading config:', error);
        window.FRONTEND_URL = 'http://localhost:5173';
    }

    // Initialize the view website button with correct URL
    const viewWebsiteBtn = document.getElementById('view-website-btn');
    if (viewWebsiteBtn) {
        viewWebsiteBtn.href = window.FRONTEND_URL + '/residencial/';
    }
}

// Hacer switchTab global para onclick en HTML
window.switchTab = function(tab) {
    currentTab = tab;

    // Update Theme
    const logo = document.getElementById('admin-logo');
    const viewWebsiteBtn = document.getElementById('view-website-btn');

    if (tab === 'industrial') {
        document.body.classList.add('dark-theme');
        logo.src = '/admin/assets/Logo-sin-salmo.svg';
        viewWebsiteBtn.href = window.FRONTEND_URL + '/industrial/';
    } else {
        document.body.classList.remove('dark-theme');
        logo.src = '/admin/assets/residencial/logo.svg';
        viewWebsiteBtn.href = window.FRONTEND_URL + '/residencial/';
    }

    // Update Tabs UI
    document.getElementById('tab-residential').className = tab === 'residential'
        ? 'px-6 py-3 font-semibold text-red-600 border-b-2 border-red-600 focus:outline-none transition'
        : 'px-6 py-3 font-semibold text-gray-500 hover:text-red-500 focus:outline-none transition';

    document.getElementById('tab-industrial').className = tab === 'industrial'
        ? 'px-6 py-3 font-semibold text-red-600 border-b-2 border-red-600 focus:outline-none transition'
        : 'px-6 py-3 font-semibold text-gray-500 hover:text-red-500 focus:outline-none transition';

    document.getElementById('section-title').innerText = tab === 'residential' ? 'Proyectos Residenciales' : 'Proyectos Industriales';

    // Update category filter options
    updateCategoryFilter();

    // Clear category filter when switching tabs
    categoryFilter = '';
    categoryFilterSelect.value = '';

    renderProjects();
}

// --- API Calls ---

// Helper to handle authentication errors
function handleAuthError(error) {
    if (error.requiresLogin) {
        alert('Tu sesión ha expirado. Redirigiendo al login...');
        window.location.href = '/admin/login';
    }
}

async function fetchProjects() {
    try {
        const res = await fetch('/api/projects', {
            credentials: 'include'
        });

        if (res.status === 401) {
            const data = await res.json();
            handleAuthError(data);
            return;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        projects = await res.json();
        renderProjects();
    } catch (err) {
        console.error('Error fetching projects:', err);
        alert('Error conectando con el servidor. Asegúrate de ejecutar "npm start".');
    }
}

// Show/hide upload progress modal
function showUploadProgress() {
    document.getElementById('upload-progress-modal').classList.remove('hidden');
}

function hideUploadProgress() {
    document.getElementById('upload-progress-modal').classList.add('hidden');
}

function updateUploadProgress(current, total, fileName, status) {
    const percent = Math.round((current / total) * 100);
    document.getElementById('upload-progress-bar').style.width = `${percent}%`;
    document.getElementById('upload-progress-text').textContent = `${current} / ${total}`;
    document.getElementById('upload-current-status').textContent =
        status === 'uploading' ? `Subiendo: ${fileName}` :
        status === 'success' ? `✅ ${fileName}` :
        status === 'error' ? `❌ ${fileName}` :
        'Preparando...';
}

function addUploadItem(fileName, status) {
    const list = document.getElementById('upload-progress-list');
    const item = document.createElement('div');
    item.id = `upload-item-${fileName}`;
    item.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded';
    item.innerHTML = `
        <span class="text-2xl">${status === 'pending' ? '⏳' : status === 'uploading' ? '📤' : status === 'success' ? '✅' : '❌'}</span>
        <span class="text-sm text-gray-700 flex-1 truncate">${fileName}</span>
        <span class="text-xs text-gray-500">${status === 'pending' ? 'Esperando...' : status === 'uploading' ? 'Subiendo...' : status === 'success' ? 'Completado' : 'Error'}</span>
    `;
    list.appendChild(item);
}

function updateUploadItem(fileName, status, message = '') {
    const item = document.getElementById(`upload-item-${fileName}`);
    if (item) {
        item.innerHTML = `
            <span class="text-2xl">${status === 'uploading' ? '📤' : status === 'success' ? '✅' : '❌'}</span>
            <span class="text-sm text-gray-700 flex-1 truncate">${fileName}</span>
            <span class="text-xs ${status === 'error' ? 'text-red-600' : 'text-gray-500'}">${
                status === 'uploading' ? 'Subiendo...' :
                status === 'success' ? 'Completado' :
                message || 'Error'
            }</span>
        `;
    }
}

async function saveProject(e) {
    e.preventDefault();

    // Separate currentImages into:
    // 1. Files to upload
    // 2. Existing paths (strings) to keep
    const filesToUpload = currentImages.filter(item => item instanceof File);
    const existingPaths = currentImages.filter(item => typeof item === 'string');

    let uploadedPaths = [];

    // 1. Upload new files ONE BY ONE with visual feedback
    if (filesToUpload.length > 0) {
        // Pre-check: Warn about files >10MB (Cloudinary free limit)
        const oversizedFiles = filesToUpload.filter(f => f.size > 10 * 1024 * 1024);
        if (oversizedFiles.length > 0) {
            const fileList = oversizedFiles.map(f => `• ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)`).join('\n');
            const proceed = confirm(
                `⚠️ Las siguientes imágenes exceden el límite de 10MB de Cloudinary:\n\n${fileList}\n\n` +
                `Estas imágenes serán OMITIDAS automáticamente.\n\n` +
                `¿Deseas continuar subiendo el resto de imágenes?`
            );
            if (!proceed) return;
        }

        showUploadProgress();
        document.getElementById('upload-progress-list').innerHTML = '';

        // Add all files to the list as pending
        filesToUpload.forEach(file => {
            const isOversized = file.size > 10 * 1024 * 1024;
            addUploadItem(file.name, isOversized ? 'error' : 'pending');
            if (isOversized) {
                updateUploadItem(file.name, 'error', `${(file.size / 1024 / 1024).toFixed(1)}MB > 10MB`);
            }
        });

        const filesToActuallyUpload = filesToUpload.filter(f => f.size <= 10 * 1024 * 1024);
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < filesToActuallyUpload.length; i++) {
            const file = filesToActuallyUpload[i];
            updateUploadProgress(i, filesToActuallyUpload.length, file.name, 'uploading');
            updateUploadItem(file.name, 'uploading');

            const formData = new FormData();
            formData.append('images', file);

            try {
                const uploadRes = await fetch(`/api/upload?type=${currentTab}`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include'
                });

                if (!uploadRes.ok) {
                    const error = await uploadRes.json();
                    const errorMsg = error.error || `HTTP ${uploadRes.status}`;
                    updateUploadItem(file.name, 'error', errorMsg.substring(0, 50));
                    errorCount++;
                    continue; // Skip this file, continue with others
                }

                const uploadData = await uploadRes.json();
                if (!uploadData.success) {
                    updateUploadItem(file.name, 'error', uploadData.error.substring(0, 50));
                    errorCount++;
                    continue;
                }

                // Success! Add the uploaded path
                uploadedPaths.push(...uploadData.paths);
                updateUploadItem(file.name, 'success');
                updateUploadProgress(i + 1, filesToActuallyUpload.length, file.name, 'success');
                successCount++;

            } catch (fileError) {
                console.error('Upload error:', fileError);
                updateUploadItem(file.name, 'error', 'Error de red');
                errorCount++;
            }
        }

        // Show final summary
        const skippedCount = filesToUpload.length - filesToActuallyUpload.length;
        updateUploadProgress(
            filesToActuallyUpload.length,
            filesToActuallyUpload.length,
            `✅ ${successCount} exitosas, ❌ ${errorCount} errores${skippedCount > 0 ? `, ⏭️ ${skippedCount} omitidas` : ''}`,
            'success'
        );

        // Auto-hide after 3 seconds if all successful
        if (errorCount === 0) {
            setTimeout(() => hideUploadProgress(), 2000);
        }
        // If there were errors, keep modal open so user can see what failed
    }

    // Combine paths
    const finalImages = [...existingPaths, ...uploadedPaths];

    if (finalImages.length === 0) {
        alert('Por favor agrega al menos una imagen');
        return;
    }

    try {
        const formEntries = new FormData(e.target);
        const newProject = {
            category: formEntries.get('category'),
            title: formEntries.get('title'),
            location: formEntries.get('location'),
            area: formEntries.get('area'),
            duration: formEntries.get('duration'),
            description: formEntries.get('description'),
            image: finalImages[0], // Primary thumbnail
            images: finalImages
        };

        if (currentTab === 'industrial') {
            const lat = parseFloat(formEntries.get('lat'));
            const lng = parseFloat(formEntries.get('lng'));
            if (!isNaN(lat) && !isNaN(lng)) {
                newProject.coordinates = [lat, lng];
            }
        }

        const url = editProjectId !== null
            ? `/api/projects/${editProjectId}?type=${currentTab}`
            : `/api/projects?type=${currentTab}`;
        const method = editProjectId !== null ? 'PUT' : 'POST';

        const saveRes = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newProject),
            credentials: 'include'
        });

        if (!saveRes.ok) {
            const error = await saveRes.json();
            throw new Error(error.error || `HTTP ${saveRes.status}`);
        }

        const saveData = await saveRes.json();
        if (saveData.success) {
            closeModal();
            fetchProjects();
            alert(editProjectId !== null ? '¡Proyecto actualizado!' : '¡Proyecto guardado!');
        }
    } catch (err) {
        console.error('Error:', err);
        alert('Hubo un error al guardar: ' + err.message);
    }
}

form.addEventListener('submit', saveProject);

async function deleteProject(projectId) {
    if (!confirm('¿Estás seguro de eliminar este proyecto?')) return;

    try {
        const res = await fetch(`/api/projects/${projectId}?type=${currentTab}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || `HTTP ${res.status}`);
        }
        fetchProjects();
        alert('¡Proyecto eliminado!');
    } catch (err) {
        alert('Error al eliminar: ' + err.message);
    }
}

// --- Rendering ---

function renderProjects() {
    grid.innerHTML = '';
    const list = currentTab === 'residential' ? projects.residentialProjects : projects.industrialProjects;
    const filteredList = filterProjects(list);

    // Update project count
    projectCount.textContent = `${filteredList.length} proyecto${filteredList.length !== 1 ? 's' : ''}`;

    // Show empty state if no projects match filters
    if (filteredList.length === 0) {
        grid.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    } else {
        grid.classList.remove('hidden');
        emptyState.classList.add('hidden');
    }

    filteredList.forEach((project) => {
        // Find original index in unfiltered list
        const index = list.indexOf(project);
        // Handle path fix for display (admin is in /admin, images are in ../images)
        // If image path starts with 'http', leave it. If it starts with 'images/', add '../' if not present?
        // Actually, for the admin panel to show images, we might need a route to serve the ../images folder or just use relative paths.
        // Since we serve static from 'public', we probably can't see ../images easily unless we map it in express.
        // Let's rely on the image serving we haven't set up yet? 
        // Wait, standard `express.static` in server.js serves `public`. We need another static for `../images`.

        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border border-gray-100 group cursor-pointer';
        card.onclick = () => editProject(project.id);

        let imgDisplayUrl = project.image;
        if (!imgDisplayUrl.startsWith('http')) {
            // It's a local path like "/images/proyectos/..." or "../images/..."
            // Server serves images at /images/
            imgDisplayUrl = imgDisplayUrl.replace(/^\.\.\//, '/').replace(/^images\//, '/images/');
        }

        card.innerHTML = `
            <div class="relative h-48 overflow-hidden">
                <img src="${imgDisplayUrl}" alt="${project.title}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105" onerror="this.src='https://placehold.co/400x300?text=Sin+Imagen'">
                <div class="category-badge absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold uppercase tracking-wider text-gray-700">
                    ${project.category}
                </div>
            </div>
            <div class="p-5">
                <h3 class="font-bold text-lg text-gray-800 mb-1 leading-tight">${project.title}</h3>
                <p class="text-sm text-gray-500 mb-4 flex items-center gap-1">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    ${project.location}
                </p>

                <div class="flex justify-between items-center pt-4 border-t border-gray-100">
                    <span class="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded">${project.area}</span>
                    <div class="flex gap-2">
                        <button onclick="editProject(${project.id})" class="hidden">Editar</button>
                        <button onclick="event.stopPropagation(); deleteProject(${project.id})" class="text-red-500 hover:text-red-700 text-sm font-medium hover:underline">Eliminar</button>
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// --- Modal & Form Logic ---

function editProject(projectId) {
    editProjectId = projectId;
    const list = currentTab === 'residential' ? projects.residentialProjects : projects.industrialProjects;
    const project = list.find(p => p.id === projectId);

    openModal(true); // true = editing mode

    // Fill form
    form.querySelector('[name="title"]').value = project.title;
    form.querySelector('[name="location"]').value = project.location;
    form.querySelector('[name="category"]').value = project.category;
    form.querySelector('[name="area"]').value = project.area;
    form.querySelector('[name="duration"]').value = project.duration;
    form.querySelector('[name="description"]').value = project.description;

    if (currentTab === 'industrial' && project.coordinates) {
        form.querySelector('[name="lat"]').value = project.coordinates[0];
        form.querySelector('[name="lng"]').value = project.coordinates[1];

        // Update map marker after modal is visible
        setTimeout(() => {
            updateMapMarker();
        }, 400);
    }

    // Load existing images
    currentImages = [];
    if (project.images && project.images.length > 0) {
        currentImages = [...project.images];
    } else if (project.image) {
        currentImages = [project.image];
    }
    renderGallery();
}

// Hacer openModal global para onclick en HTML
window.openModal = function(isEdit = false) {
    if (!isEdit) {
        editProjectId = null;
        form.reset();
        currentImages = [];
        renderGallery();

        // Reset modal title and button text
        document.querySelector('#modal h3').textContent = 'Agregar Nuevo Proyecto';
        document.querySelector('#projectForm button[type="submit"]').textContent = 'Guardar Proyecto';
    } else {
        document.querySelector('#modal h3').textContent = 'Editar Proyecto';
        document.querySelector('#projectForm button[type="submit"]').textContent = 'Actualizar Proyecto';
    }
    // Populate categories
    const select = document.querySelector('select[name="category"]');
    select.innerHTML = '';
    CATEGORIES[currentTab].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        select.appendChild(option);
    });

    // Toggle fields
    if (currentTab === 'industrial') {
        industrialFields.classList.remove('hidden');
        // Reinitialize map when showing industrial fields
        setTimeout(() => {
            if (map) {
                map.invalidateSize();
            }
        }, 300);
    } else {
        industrialFields.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    // Small delay for transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
    }, 10);
}

// Hacer closeModal global para onclick en HTML
window.closeModal = function() {
    modal.classList.add('opacity-0');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        form.reset();
        currentImages = [];
        renderGallery();
    }, 300);
}

// Close on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// --- Gallery Logic ---

function setupImageHandlers() {
    imageInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            currentImages.push(...files);
            renderGallery();
            imageInput.value = ''; // Reset to allow adding same file again
        }
    });
}

function renderGallery() {
    gallery.innerHTML = '';

    currentImages.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'relative group h-24 rounded-lg overflow-hidden shadow-sm border-2 draggable-image ' +
                        (index === 0 ? 'border-red-500' : 'border-gray-200');

        let src = '';
        if (item instanceof File) {
            src = URL.createObjectURL(item);
        } else {
            // String URL
            src = item;
            if (!src.startsWith('http')) {
                // Convert to absolute path served by backend
                src = src.replace(/^\.\.\//, '/').replace(/^images\//, '/images/');
            }
        }

        div.innerHTML = `
            <img src="${src}" class="w-full h-full object-cover">
            ${index === 0 ? '<div class="absolute top-1 left-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded font-semibold z-10">Principal</div>' : ''}
            <button type="button" onclick="event.stopPropagation(); removeImage(${index})" class="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow-md hover:bg-red-700 transition opacity-80 group-hover:opacity-100 z-10">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition flex items-center justify-center pointer-events-none">
                <svg class="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"></path>
                </svg>
            </div>
        `;
        gallery.appendChild(div);
    });

    // Add "+" Button
    const addBtn = document.createElement('div');
    addBtn.className = 'add-image-btn flex items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 hover:border-red-400 transition text-gray-400 hover:text-red-500';
    addBtn.innerHTML = `
        <div class="text-center">
            <svg class="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            <span class="text-xs">Agregar</span>
        </div>
    `;
    addBtn.onclick = () => imageInput.click();
    gallery.appendChild(addBtn);

    // Initialize drag & drop
    setupImageDragDrop();
}

// Make removeImage global for onclick access
window.removeImage = function (index) {
    currentImages.splice(index, 1);
    renderGallery();
};

// --- Search & Filter Functionality ---

function setupSearchAndFilters() {
    // Search input
    searchInput.addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderProjects();
    });

    // Category filter
    categoryFilterSelect.addEventListener('change', (e) => {
        categoryFilter = e.target.value;
        renderProjects();
    });

    // Update category filter options when tab changes
    updateCategoryFilter();
}

function updateCategoryFilter() {
    categoryFilterSelect.innerHTML = '<option value="">Todas las categorías</option>';
    CATEGORIES[currentTab].forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        categoryFilterSelect.appendChild(option);
    });
}

window.clearFilters = function() {
    searchTerm = '';
    categoryFilter = '';
    searchInput.value = '';
    categoryFilterSelect.value = '';
    renderProjects();
};

function filterProjects(projectsList) {
    return projectsList.filter(project => {
        // Search filter
        const matchesSearch = !searchTerm ||
            project.title.toLowerCase().includes(searchTerm) ||
            project.location.toLowerCase().includes(searchTerm) ||
            project.description.toLowerCase().includes(searchTerm);

        // Category filter
        const matchesCategory = !categoryFilter || project.category === categoryFilter;

        return matchesSearch && matchesCategory;
    });
}

// --- Map Functionality ---

function initMap() {
    // Initialize Leaflet map centered on Mexico
    if (!document.getElementById('map')) return;

    map = L.map('map').setView([23.6345, -102.5528], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Listen to coordinate inputs
    const latInput = document.getElementById('lat-input');
    const lngInput = document.getElementById('lng-input');

    if (latInput && lngInput) {
        latInput.addEventListener('input', updateMapMarker);
        lngInput.addEventListener('input', updateMapMarker);
    }
}

function updateMapMarker() {
    if (!map) return;

    const latInput = document.getElementById('lat-input');
    const lngInput = document.getElementById('lng-input');

    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        // Remove old marker
        if (marker) {
            map.removeLayer(marker);
        }

        // Add new marker
        marker = L.marker([lat, lng]).addTo(map);
        map.setView([lat, lng], 12);
    }
}

// --- Drag & Drop for Images ---

function setupImageDragDrop() {
    if (!sortable && gallery) {
        sortable = new Sortable(gallery, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            filter: '.add-image-btn',
            onEnd: function(evt) {
                // Reorder the currentImages array
                const movedItem = currentImages.splice(evt.oldIndex, 1)[0];
                currentImages.splice(evt.newIndex, 0, movedItem);
                renderGallery();
            }
        });
    }
}

// --- Logout Functionality ---

function setupLogout() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('¿Estás seguro de que quieres cerrar sesión?')) return;

            try {
                const res = await fetch('/api/logout', {
                    method: 'POST',
                    credentials: 'include'
                });

                if (res.ok) {
                    window.location.href = '/admin/login';
                } else {
                    alert('Error al cerrar sesión');
                }
            } catch (err) {
                console.error('Error during logout:', err);
                alert('Error al cerrar sesión');
            }
        });
    }
}
