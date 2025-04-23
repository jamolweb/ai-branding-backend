const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONT_URLS = {
  'Poppins-Regular.ttf':
    'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf',
  'Poppins-Bold.ttf':
    'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf',
};

// Create fonts directory if it doesn't exist
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
}

function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode === 200) {
          const file = fs.createWriteStream(filePath);
          response.pipe(file);

          file.on('finish', () => {
            file.close();
            resolve();
          });

          file.on('error', (err) => {
            fs.unlink(filePath, () => reject(err));
          });
        } else {
          response.resume(); // Consume response data to free up memory
          reject(new Error(`Failed to download: ${response.statusCode}`));
        }
      })
      .on('error', reject);
  });
}

// Download each font
async function downloadFonts() {
  for (const [filename, url] of Object.entries(FONT_URLS)) {
    const filePath = path.join(FONTS_DIR, filename);

    if (fs.existsSync(filePath)) {
      console.log(`${filename} already exists, skipping...`);
      continue;
    }

    console.log(`Downloading ${filename}...`);

    try {
      await downloadFile(url, filePath);
      console.log(`Downloaded ${filename}`);
    } catch (err) {
      console.error(`Error downloading ${filename}:`, err.message);
    }
  }
}

downloadFonts();
