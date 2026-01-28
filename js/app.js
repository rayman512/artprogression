// Art Progression - Main Application

class ArtGallery {
    constructor() {
        this.artworks = [];
        this.currentIndex = 0;
        this.currentView = 'grid';
        this.db = null;

        this.init();
    }

    async init() {
        this.initFirebase();
        await this.loadArtworks();
        this.renderGallery();
        this.updateStats();
        this.setupEventListeners();
    }

    initFirebase() {
        // Check if Firebase config is set up
        if (window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey !== "YOUR_API_KEY") {
            try {
                if (!firebase.apps.length) {
                    firebase.initializeApp(window.FIREBASE_CONFIG);
                }
                this.db = firebase.firestore();
            } catch (error) {
                console.log('Firebase init error:', error);
                this.db = null;
            }
        }
    }

    async loadArtworks() {
        // Try loading from Firebase first
        if (this.db) {
            try {
                const snapshot = await this.db.collection('artworks').get();
                if (!snapshot.empty) {
                    this.artworks = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    this.artworks.sort((a, b) => b.day - a.day); // Newest first
                    console.log('Loaded artworks from Firebase');
                    return;
                }
            } catch (error) {
                console.log('Firebase load error, falling back to JSON:', error);
            }
        }

        // Fallback to JSON file
        try {
            const response = await fetch('data/artworks.json');
            const data = await response.json();
            this.artworks = data.artworks.sort((a, b) => b.day - a.day); // Newest first
            console.log('Loaded artworks from JSON file');
        } catch (error) {
            console.log('No artworks found or error loading:', error);
            this.artworks = [];
        }
    }

    renderGallery() {
        const gallery = document.getElementById('gallery');

        if (this.artworks.length === 0) {
            gallery.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <h2>No artwork yet</h2>
                    <p>Start your journey by uploading your first sketch!</p>
                </div>
            `;
            return;
        }

        gallery.innerHTML = this.artworks.map((artwork, index) => `
            <div class="artwork-card" data-index="${index}">
                <img src="${artwork.imageUrl}" alt="Day ${artwork.day}" loading="lazy">
                <div class="artwork-info">
                    <span class="artwork-day">Day ${artwork.day}</span>
                    <span class="artwork-date">${this.formatDate(artwork.date)}</span>
                </div>
            </div>
        `).join('');
    }

    renderTimeline() {
        const timeline = document.getElementById('timeline');

        if (this.artworks.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <h2>No artwork yet</h2>
                    <p>Start your journey by uploading your first sketch!</p>
                </div>
            `;
            return;
        }

        // Sort by day ascending for timeline
        const sorted = [...this.artworks].sort((a, b) => a.day - b.day);

        timeline.innerHTML = sorted.map((artwork, index) => `
            <div class="timeline-item" data-index="${this.artworks.findIndex(a => a.day === artwork.day)}">
                <img src="${artwork.imageUrl}" alt="Day ${artwork.day}">
                <div class="timeline-content">
                    <h3>Day ${artwork.day}</h3>
                    <p class="date">${this.formatDate(artwork.date)}</p>
                    ${artwork.notes ? `<p class="notes">${artwork.notes}</p>` : ''}
                </div>
            </div>
        `).join('');
    }

    renderCompare() {
        if (this.artworks.length === 0) return;

        const sorted = [...this.artworks].sort((a, b) => a.day - b.day);
        const first = sorted[0];
        const latest = sorted[sorted.length - 1];

        document.getElementById('first-sketch').innerHTML = `
            <img src="${first.imageUrl}" alt="Day ${first.day}">
            <p style="margin-top: 12px; color: var(--text-secondary);">Day ${first.day} - ${this.formatDate(first.date)}</p>
        `;

        document.getElementById('latest-sketch').innerHTML = `
            <img src="${latest.imageUrl}" alt="Day ${latest.day}">
            <p style="margin-top: 12px; color: var(--text-secondary);">Day ${latest.day} - ${this.formatDate(latest.date)}</p>
        `;
    }

    updateStats() {
        const daysCompleted = this.artworks.length;
        const daysRemaining = Math.max(0, 365 - daysCompleted);
        const streak = this.calculateStreak();

        document.getElementById('days-completed').textContent = daysCompleted;
        document.getElementById('days-remaining').textContent = daysRemaining;
        document.getElementById('current-streak').textContent = streak;
    }

    calculateStreak() {
        if (this.artworks.length === 0) return 0;

        const sorted = [...this.artworks].sort((a, b) => new Date(b.date) - new Date(a.date));
        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (const artwork of sorted) {
            const artworkDate = new Date(artwork.date);
            artworkDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((currentDate - artworkDate) / (1000 * 60 * 60 * 24));

            if (diffDays <= 1) {
                streak++;
                currentDate = artworkDate;
            } else {
                break;
            }
        }

        return streak;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    setupEventListeners() {
        // View toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // Gallery card clicks
        document.getElementById('gallery').addEventListener('click', (e) => {
            const card = e.target.closest('.artwork-card');
            if (card) {
                this.openModal(parseInt(card.dataset.index));
            }
        });

        // Timeline item clicks
        document.getElementById('timeline').addEventListener('click', (e) => {
            const item = e.target.closest('.timeline-item');
            if (item) {
                this.openModal(parseInt(item.dataset.index));
            }
        });

        // Modal controls
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') {
                this.closeModal();
            }
        });

        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('prev-btn').addEventListener('click', () => {
            this.navigateModal(-1);
        });

        document.getElementById('next-btn').addEventListener('click', () => {
            this.navigateModal(1);
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('modal');
            if (!modal.classList.contains('hidden')) {
                if (e.key === 'Escape') this.closeModal();
                if (e.key === 'ArrowLeft') this.navigateModal(-1);
                if (e.key === 'ArrowRight') this.navigateModal(1);
            }
        });
    }

    switchView(view) {
        this.currentView = view;

        // Update buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Update views
        document.getElementById('gallery').classList.toggle('hidden', view !== 'grid');
        document.getElementById('timeline').classList.toggle('hidden', view !== 'timeline');
        document.getElementById('compare').classList.toggle('hidden', view !== 'compare');

        // Render the selected view
        if (view === 'timeline') {
            this.renderTimeline();
        } else if (view === 'compare') {
            this.renderCompare();
        }
    }

    openModal(index) {
        this.currentIndex = index;
        const artwork = this.artworks[index];
        const modal = document.getElementById('modal');

        document.getElementById('modal-image').src = artwork.imageUrl;
        document.getElementById('modal-title').textContent = `Day ${artwork.day}`;
        document.getElementById('modal-date').textContent = this.formatDate(artwork.date);
        document.getElementById('modal-notes').textContent = artwork.notes || '';

        // Update navigation buttons
        document.getElementById('prev-btn').disabled = index >= this.artworks.length - 1;
        document.getElementById('next-btn').disabled = index <= 0;

        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('modal').classList.add('hidden');
        document.body.style.overflow = '';
    }

    navigateModal(direction) {
        const newIndex = this.currentIndex - direction; // Reversed because newest first
        if (newIndex >= 0 && newIndex < this.artworks.length) {
            this.openModal(newIndex);
        }
    }
}

// Initialize the gallery when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new ArtGallery();
});
