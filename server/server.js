const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = 3103;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large payloads for potentially large files

// The root directory of the project, which is one level up from the server directory
const projectRoot = path.join(__dirname, '..');
const backupsDir = path.join(__dirname, 'backups');

app.use(express.static(projectRoot));

// --- API Endpoints ---

// Generic file reader endpoint
// Example: /api/data/scp/world.json
app.get(/^\/api\/data\/(.+)/, async (req, res) => {
    const filePath = req.params[0];
    const absolutePath = path.join(projectRoot, filePath);

    try {
        const data = await fs.readFile(absolutePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error(`Error reading file: ${absolutePath}`, error);
        res.status(500).json({ message: 'Error reading file', error: error.message });
    }
});

// Endpoint specifically for manifest.json
app.get('/api/manifest', async (req, res) => {
    const manifestPath = path.join(projectRoot, 'manifest.json');
    try {
        const data = await fs.readFile(manifestPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error(`Error reading manifest.json:`, error);
        res.status(500).json({ message: 'Error reading manifest file', error: error.message });
    }
});


// Generic file writer endpoint
app.post('/api/save', async (req, res) => {
    const { filePath, content } = req.body;

    if (!filePath || content === undefined) {
        return res.status(400).json({ message: 'Missing filePath or content in request body' });
    }

    const absolutePath = path.join(projectRoot, filePath);
    const backupPath = path.join(backupsDir, `${path.basename(filePath)}.${Date.now()}.bak`);

    try {
        // 1. Create backup
        try {
            await fs.copyFile(absolutePath, backupPath);
            console.log(`Backup created: ${backupPath}`);
        } catch (copyError) {
            // If the original file doesn't exist, we can't back it up, which is fine for new files.
            if (copyError.code !== 'ENOENT') {
                throw copyError; // Rethrow if it's a different error
            }
             console.log(`Source file for backup not found, proceeding to write new file: ${absolutePath}`);
        }


        // 2. Write new content
        // The content is already a JSON string from the frontend, so no need to stringify again.
        await fs.writeFile(absolutePath, content, 'utf8');

        console.log(`File saved: ${absolutePath}`);
        res.json({ message: 'File saved successfully' });

    } catch (error) {
        console.error(`Error saving file: ${absolutePath}`, error);
        res.status(500).json({ message: 'Error saving file', error: error.message });
    }
});

const fileExists = async (filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
};

// Endpoint for scaffolding a new world
app.post('/api/scaffold-world', async (req, res) => {
    const { worldId, worldPath } = req.body;
    if (!worldId || !worldPath) {
        return res.status(400).json({ message: 'Missing worldId or worldPath' });
    }

    try {
        await callScaffold(worldId, worldPath);
        res.json({ message: `Successfully scaffolded world: ${worldId}` });
    } catch (error) {
        console.error(`Error scaffolding world ${worldId}:`, error);
        res.status(500).json({ message: 'Error scaffolding world', error: error.message });
    }
});

// Endpoint for renaming/moving world files/folders
app.post('/api/rename-world', async (req, res) => {
    const { oldPath, newPath, worldId } = req.body;
    if (!oldPath || !newPath || !worldId) {
        return res.status(400).json({ message: 'Missing oldPath, newPath, or worldId' });
    }

    const absoluteOldPath = path.join(projectRoot, oldPath);
    const absoluteNewPath = path.join(projectRoot, newPath);
    const absoluteOldDir = path.dirname(absoluteOldPath);
    const absoluteNewDir = path.dirname(absoluteNewPath);

    try {
        if (await fileExists(absoluteOldDir)) {
            // If the directory name is different, rename the whole directory.
            if (absoluteOldDir !== absoluteNewDir) {
                await fs.rename(absoluteOldDir, absoluteNewDir);
                console.log(`Renamed directory from ${absoluteOldDir} to ${absoluteNewDir}`);
            }

            // Now, check if the filename inside the (potentially new) directory needs renaming.
            const oldFileName = path.basename(absoluteOldPath);
            const newFileName = path.basename(absoluteNewPath);
            if (oldFileName !== newFileName) {
                const finalOldFilePath = path.join(absoluteNewDir, oldFileName); // Path of the file in its new directory home
                const finalNewFilePath = path.join(absoluteNewDir, newFileName); // The final destination path
                await fs.rename(finalOldFilePath, finalNewFilePath);
                console.log(`Renamed file from ${finalOldFilePath} to ${finalNewFilePath}`);
            }

            res.json({ message: `Successfully renamed ${oldPath} to ${newPath}` });
        } else {
            // If old path doesn't exist, scaffold the new one using the correct ID
            await callScaffold(worldId, newPath);
            res.json({ message: `Old path not found. Scaffolded new world at ${newPath}` });
        }
    } catch (error) {
        console.error(`Error in rename/scaffold for ${oldPath} to ${newPath}:`, error);
        res.status(500).json({ message: 'Error renaming/scaffolding world', error: error.message });
    }
});

// Endpoint for deleting a world's folder
app.post('/api/delete-world', (req, res) => {
    const { world } = req.body;
    if (!world || !world.path) {
        return res.status(400).json({ message: 'Invalid world data provided' });
    }

    const worldDir = path.dirname(path.join(projectRoot, world.path));
    const dirName = path.basename(worldDir);

    if (!fsSync.existsSync(worldDir)) {
        return res.status(404).json({ message: `Directory not found: ${dirName}` });
    }

    const backupFileName = `${dirName}-${Date.now()}.zip`;
    const output = fsSync.createWriteStream(path.join(backupsDir, backupFileName));
    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    output.on('close', async () => {
        console.log(`Backup created: ${backupFileName}, ${archive.pointer()} total bytes`);
        try {
            await fs.rm(worldDir, { recursive: true, force: true });
            console.log(`Successfully deleted directory: ${worldDir}`);
            res.json({ message: `Successfully backed up and deleted ${dirName}` });
        } catch (err) {
            console.error(`Error deleting directory ${worldDir}:`, err);
            res.status(500).json({ message: 'Failed to delete directory after backup.' });
        }
    });

    archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
            console.warn(err);
        } else {
            throw err;
        }
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);
    archive.directory(worldDir, false);
    archive.finalize();
});

app.post('/api/create-category-assets', async (req, res) => {
    const { items_url } = req.body;
    if (!items_url) {
        return res.status(400).json({ message: 'Missing items_url' });
    }

    const absolutePath = path.join(projectRoot, items_url);
    const dirPath = path.dirname(absolutePath);

    try {
        // Ensure directory exists
        if (!fsSync.existsSync(dirPath)) {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Created directory: ${dirPath}`);
        }

        // Create file only if it doesn't exist
        if (!fsSync.existsSync(absolutePath)) {
            await fs.writeFile(absolutePath, '[]', 'utf8');
            console.log(`Created file: ${absolutePath}`);
        }
        
        res.json({ message: `Assets for ${items_url} are ready.` });
    } catch (error) {
        console.error(`Error creating assets for ${items_url}:`, error);
        res.status(500).json({ message: 'Error creating assets', error: error.message });
    }
});


// Helper to be called internally
async function callScaffold(worldId, worldPath) {
    const worldDir = path.join(projectRoot, path.dirname(worldPath));
    const womenFileName = `${worldId}_women.json`;
    const womenFilePath = path.join(worldDir, womenFileName);
    await fs.mkdir(worldDir, { recursive: true });
    const worldJsonPath = path.join(projectRoot, worldPath);
    if (!(await fileExists(worldJsonPath))) {
        const relativeWomenPath = path.join(path.dirname(worldPath), womenFileName).split(path.sep).join('/');
        const worldJsonContent = {
            name: worldId.charAt(0).toUpperCase() + worldId.slice(1),
            theme: "theme-default",
            categories: {
                "Женские персонажи": {
                    description: "Все женские персонажи.",
                    items_url: relativeWomenPath
                }
            }
        };
        await fs.writeFile(worldJsonPath, JSON.stringify(worldJsonContent, null, 4), 'utf8');
    }
    if (!(await fileExists(womenFilePath))) {
        await fs.writeFile(womenFilePath, '[]', 'utf8');
    }
}

app.listen(port, '0.0.0.0', () => {
    console.log(`Backend server running at http://localhost:${port}`);
    console.log('Serving files from project root:', projectRoot);
});
