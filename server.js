const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files (HTML, crack-photos-web, JSON)
app.use(express.static(__dirname));
app.use(express.json());

// Upload destination
const upload = multer({ dest: 'crack-photos-web/' });

// Handle edit + upload
app.post('/upload-edit', upload.array('photos'), (req, res) => {
  const { address, severity, description, type, newType } = req.body;
  const jsonPath = `${type}.json`;

  if (!fs.existsSync(jsonPath)) return res.status(400).send('Invalid layer type');

  let data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const entry = data.find(e => (e.Address || e.filename) === address);

  if (!entry) return res.status(404).send('Address not found in JSON');

  // Update severity and description
  if (severity) entry['Crack Severity'] = severity;
  if (description) entry['Description'] = description;

  // Handle photos
  if (req.files && req.files.length > 0) {
    const newFilenames = [];

    req.files.forEach(file => {
      const ext = path.extname(file.originalname) || '.jpg';
      const newFilename = `${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
      const newPath = path.join('crack-photos-web', newFilename);

      fs.renameSync(file.path, newPath); // Move and rename
      newFilenames.push(newFilename);
    });

    // Append to existing filename field
    if (entry.filename && entry.filename.trim() !== '') {
      entry.filename += ', ' + newFilenames.join(', ');
    } else {
      entry.filename = newFilenames.join(', ');
    }

    // Optionally update dropbox_url with placeholders
    if (entry.dropbox_url) {
      entry.dropbox_url += ', ' + newFilenames.map(f => `crack-photos-web/${f}`).join(', ');
    } else {
      entry.dropbox_url = newFilenames.map(f => `crack-photos-web/${f}`).join(', ');
    }
  }

  // If type changed, move entry to new file and skip writing current file
  if (newType && newType !== type) {
    const targetPath = `${newType}.json`;
    if (!fs.existsSync(targetPath)) return res.status(400).send('Invalid new layer type');

    let targetData = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));

    // Add to new layer
    targetData.push(entry);
    fs.writeFileSync(targetPath, JSON.stringify(targetData, null, 2), 'utf-8');

    // Remove from old layer
    data = data.filter(e => (e.Address || e.filename) !== address);
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

    return res.status(200).send('Moved to new classification');
  }

  // Save updated data back to JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');

  res.status(200).send('Updated');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
