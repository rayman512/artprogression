// Art Progression - Admin Upload

// ===========================================
// CONFIGURATION - Update these values!
// ===========================================
const CONFIG = {
    ADMIN_PASSWORD: 'SketchDay365!',
    CLOUDINARY_CLOUD_NAME: 'db5ptapmj',
    CLOUDINARY_UPLOAD_PRESET: 'art-progression'
};

// ===========================================
// Admin Application
// ===========================================
class AdminPanel {
    constructor() {
        this.isLoggedIn = false;
        this.artworks = [];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setDefaultDate();
        this.checkSession();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.login();
        });

        // Upload form
        document.getElementById('upload-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.uploadArtwork();
        });

        // Image preview
        document.getElementById('image').addEventListener('change', (e) => {
            this.previewImage(e.target.files[0]);
        });
    }

    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
    }

    checkSession() {
        const session = sessionStorage.getItem('artprogression_admin');
        if (session === 'true') {
            this.showUploadSection();
        }
    }

    login() {
        const password = document.getElementById('password').value;
        const messageEl = document.getElementById('login-message');

        if (password === CONFIG.ADMIN_PASSWORD) {
            sessionStorage.setItem('artprogression_admin', 'true');
            this.showUploadSection();
        } else {
            messageEl.innerHTML = '<div class="message error">Incorrect password</div>';
        }
    }

    showUploadSection() {
        this.isLoggedIn = true;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('upload-section').classList.remove('hidden');
        this.loadExistingArtworks();
    }

    async loadExistingArtworks() {
        try {
            const response = await fetch('data/artworks.json');
            const data = await response.json();
            this.artworks = data.artworks || [];

            // Suggest next day number
            if (this.artworks.length > 0) {
                const maxDay = Math.max(...this.artworks.map(a => a.day));
                document.getElementById('day').value = maxDay + 1;
            } else {
                document.getElementById('day').value = 1;
            }
        } catch (error) {
            console.log('No existing artworks found');
            this.artworks = [];
            document.getElementById('day').value = 1;
        }
    }

    previewImage(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('preview').innerHTML = `
                <img src="${e.target.result}" alt="Preview">
            `;
        };
        reader.readAsDataURL(file);
    }

    async uploadArtwork() {
        const btn = document.getElementById('upload-btn');
        const messageEl = document.getElementById('upload-message');

        const day = parseInt(document.getElementById('day').value);
        const date = document.getElementById('date').value;
        const notes = document.getElementById('notes').value;
        const imageFile = document.getElementById('image').files[0];

        if (!imageFile) {
            messageEl.innerHTML = '<div class="message error">Please select an image</div>';
            return;
        }

        // Check for duplicate day
        if (this.artworks.some(a => a.day === day)) {
            messageEl.innerHTML = '<div class="message error">Day ' + day + ' already exists!</div>';
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Uploading...';
        messageEl.innerHTML = '';

        try {
            // Upload to Cloudinary
            const imageUrl = await this.uploadToCloudinary(imageFile);

            // Create artwork entry
            const artwork = {
                day: day,
                date: date,
                imageUrl: imageUrl,
                notes: notes,
                uploadedAt: new Date().toISOString()
            };

            // Add to artworks array
            this.artworks.push(artwork);

            // Show success message with instructions
            messageEl.innerHTML = `
                <div class="message success">
                    <strong>Image uploaded successfully!</strong><br><br>
                    To complete the upload, add this to your artworks.json file:<br>
                    <textarea style="width:100%; height:120px; margin-top:12px; font-family:monospace; font-size:12px;" readonly>${JSON.stringify(artwork, null, 2)}</textarea>
                </div>
            `;

            // Reset form
            document.getElementById('image').value = '';
            document.getElementById('notes').value = '';
            document.getElementById('preview').innerHTML = '';
            document.getElementById('day').value = day + 1;

        } catch (error) {
            console.error('Upload error:', error);
            messageEl.innerHTML = `<div class="message error">Upload failed: ${error.message}</div>`;
        }

        btn.disabled = false;
        btn.textContent = 'Upload Artwork';
    }

    async uploadToCloudinary(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'art-progression');

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );

        if (!response.ok) {
            throw new Error('Cloudinary upload failed');
        }

        const data = await response.json();
        return data.secure_url;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});
