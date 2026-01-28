# Art Progression

A minimal website to track my 365-day journey to improve sketching and art skills.

## Features

- **Grid View** - See all artwork in a clean gallery grid
- **Timeline View** - Chronological view of progress
- **Compare View** - Side-by-side comparison of first and latest work
- **Stats** - Track days completed, remaining, and current streak
- **Admin Upload** - Password-protected page to upload new artwork

## Setup

### 1. Create a Cloudinary Account (Free)

1. Go to [cloudinary.com](https://cloudinary.com) and sign up
2. From your Dashboard, note your **Cloud Name**
3. Go to Settings > Upload > Upload Presets
4. Click "Add upload preset"
   - Name: `art-progression`
   - Signing Mode: `Unsigned`
   - Folder: `art-progression`
5. Save the preset

### 2. Configure the Admin Panel

Edit `js/admin.js` and update the CONFIG section:

```javascript
const CONFIG = {
    ADMIN_PASSWORD: 'your-secure-password',
    CLOUDINARY_CLOUD_NAME: 'your-cloud-name',
    CLOUDINARY_UPLOAD_PRESET: 'art-progression'
};
```

### 3. Deploy to GitHub Pages

The site is ready to deploy! Push to GitHub and enable Pages.

## How to Add Artwork

1. Go to `yourusername.github.io/artprogression/admin.html`
2. Enter your password
3. Fill in day number, date, and select your image
4. Click Upload
5. Copy the JSON output
6. Add it to `data/artworks.json` and commit

## Project Structure

```
artprogression/
├── index.html          # Main gallery page
├── admin.html          # Upload page
├── css/
│   └── style.css       # All styles
├── js/
│   ├── app.js          # Gallery functionality
│   └── admin.js        # Upload functionality
├── data/
│   └── artworks.json   # Artwork database
└── README.md
```

## License

Personal project - feel free to fork and adapt for your own journey!
