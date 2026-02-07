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
                    // Sort by date descending (newest first), then by uploadedAt for same date
                    this.artworks.sort((a, b) => {
                        const dateCompare = new Date(b.date) - new Date(a.date);
                        if (dateCompare !== 0) return dateCompare;
                        return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
                    });
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
            this.artworks = data.artworks.sort((a, b) => {
                const dateCompare = new Date(b.date) - new Date(a.date);
                if (dateCompare !== 0) return dateCompare;
                return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
            });
            console.log('Loaded artworks from JSON file');
        } catch (error) {
            console.log('No artworks found or error loading:', error);
            this.artworks = [];
        }
    }

    // Calculate day number from date based on earliest artwork date
    calculateDayNumber(dateStr) {
        if (this.artworks.length === 0) {
            return 1;
        }

        // Find the earliest date among all artworks
        const earliestDate = this.artworks.reduce((earliest, artwork) => {
            const artworkDate = new Date(artwork.date);
            return artworkDate < earliest ? artworkDate : earliest;
        }, new Date(this.artworks[0].date));

        const targetDate = new Date(dateStr);
        const diffTime = targetDate.getTime() - earliestDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        return diffDays + 1; // Day 1 is the first day
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

        gallery.innerHTML = this.artworks.map((artwork, index) => {
            const day = this.calculateDayNumber(artwork.date);
            return `
            <div class="artwork-card" data-index="${index}">
                <img src="${artwork.imageUrl}" alt="Day ${day}" loading="lazy">
                <div class="artwork-info">
                    <span class="artwork-day">Day ${day}</span>
                    <span class="artwork-date">${this.formatDate(artwork.date)}</span>
                </div>
            </div>
        `}).join('');
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

        // Sort by date ascending for timeline, then by uploadedAt for same date
        const sorted = [...this.artworks].sort((a, b) => {
            const dateCompare = new Date(a.date) - new Date(b.date);
            if (dateCompare !== 0) return dateCompare;
            return new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0);
        });

        // Group artworks by date
        const groupedByDate = sorted.reduce((groups, artwork) => {
            const date = artwork.date;
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(artwork);
            return groups;
        }, {});

        // Render timeline with grouped dates
        timeline.innerHTML = Object.entries(groupedByDate).map(([date, artworksOnDate]) => {
            const day = this.calculateDayNumber(date);
            const hasMultiple = artworksOnDate.length > 1;

            return `
            <div class="timeline-item${hasMultiple ? ' has-multiple' : ''}" data-date="${date}">
                <div class="timeline-images${hasMultiple ? ' scrollable' : ''}">
                    ${artworksOnDate.map((artwork, idx) => `
                        <div class="timeline-image-wrapper" data-index="${this.artworks.findIndex(a => a.id === artwork.id || (a.date === artwork.date && a.imageUrl === artwork.imageUrl))}">
                            <img src="${artwork.imageUrl}" alt="Day ${day}${hasMultiple ? ` - Image ${idx + 1}` : ''}">
                            ${artwork.notes ? `<p class="image-notes">${artwork.notes}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
                <div class="timeline-content">
                    <h3>Day ${day}</h3>
                    <p class="date">${this.formatDate(date)}</p>
                    ${hasMultiple ? `<p class="image-count">${artworksOnDate.length} pictures</p>` : ''}
                </div>
            </div>
        `}).join('');
    }

    renderCompare() {
        if (this.artworks.length === 0) return;

        // Sort by date to find first and latest
        const sorted = [...this.artworks].sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = sorted[0];
        const latest = sorted[sorted.length - 1];

        const firstDay = this.calculateDayNumber(first.date);
        const latestDay = this.calculateDayNumber(latest.date);

        document.getElementById('first-sketch').innerHTML = `
            <img src="${first.imageUrl}" alt="Day ${firstDay}">
            <p style="margin-top: 12px; color: var(--text-secondary);">Day ${firstDay} - ${this.formatDate(first.date)}</p>
        `;

        document.getElementById('latest-sketch').innerHTML = `
            <img src="${latest.imageUrl}" alt="Day ${latestDay}">
            <p style="margin-top: 12px; color: var(--text-secondary);">Day ${latestDay} - ${this.formatDate(latest.date)}</p>
        `;
    }

    updateStats() {
        const uniqueDates = new Set(this.artworks.map(a => a.date));
        const daysCompleted = uniqueDates.size;
        const daysRemaining = Math.max(0, 365 - daysCompleted);
        const streak = this.calculateStreak();

        document.getElementById('days-completed').textContent = daysCompleted;
        document.getElementById('days-remaining').textContent = daysRemaining;
        document.getElementById('current-streak').textContent = streak;
    }

    calculateStreak() {
        if (this.artworks.length === 0) return 0;

        // Get unique dates, sorted descending
        const uniqueDates = [...new Set(this.artworks.map(a => a.date))]
            .sort((a, b) => new Date(b) - new Date(a));

        let streak = 0;
        let currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);

        for (const dateStr of uniqueDates) {
            const artworkDate = new Date(dateStr);
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

        // Timeline item clicks - handle individual images in groups
        document.getElementById('timeline').addEventListener('click', (e) => {
            const imageWrapper = e.target.closest('.timeline-image-wrapper');
            if (imageWrapper) {
                this.openModal(parseInt(imageWrapper.dataset.index));
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

        const day = this.calculateDayNumber(artwork.date);

        document.getElementById('modal-image').src = artwork.imageUrl;
        document.getElementById('modal-title').textContent = `Day ${day}`;
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
