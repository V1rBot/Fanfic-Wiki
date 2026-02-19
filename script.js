const API_BASE_URL = 'http://localhost:3103';

let isInitialized = false;
async function main() {
    if (isInitialized) return;
    isInitialized = true;
    const wikiMode = document.getElementById('wiki-mode');
    const gameMode = document.getElementById('game-mode');
    const categoryList = document.getElementById('category-list');
    const itemDisplay = document.getElementById('item-display');
    const body = document.body;
    const logo = document.getElementById('logo');
    const modal = document.getElementById('world-switcher-modal');
    const modalWorldList = document.getElementById('modal-world-list');
    const modeToggle = document.getElementById('mode-toggle');
    const wikiLayout = document.querySelector('.wiki-layout');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');

    let currentWorld = 'scp';
    let worldsManifest = {};
    let worldsConfig = {};

    // --- NEW DATA FETCHING FUNCTIONS ---
    async function fetchFromAPI(path) {
        const url = `${API_BASE_URL}/${path}`;
        try {
            const response = await fetch(url, { cache: "no-cache" }); // Disable cache to get fresh data
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch from API ${url}:`, error);
            itemDisplay.innerHTML = `<div class="item-panel-content"><h2>Ошибка подключения к бэкенду</h2><p>Не удалось загрузить данные. Убедитесь, что бэкенд-сервер запущен (команда: <code>node server.js</code> в папке <code>server</code>) и обновите страницу.</p></div>`;
            return null;
        }
    }
    
    async function fetchManifest() {
        return await fetchFromAPI('api/manifest');
    }

    async function fetchItems(itemsUrl) {
        if (!itemsUrl) return null;
        return await fetchFromAPI(`api/data/${itemsUrl}`);
    }

    async function fetchWorldConfig(worldId, force = false) {
        const worldInfo = worldsManifest.worlds.find(w => w.id === worldId);
        if (!worldInfo || !worldInfo.path) return null;
        if (worldsConfig[worldId] && !force) {
            return worldsConfig[worldId];
        }
        const worldData = await fetchFromAPI(`api/data/${worldInfo.path}`);
        if (worldData) {
            worldsConfig[worldId] = worldData;
        }
        return worldData;
    }

    function renderItemDetail(item, backFunction) {
        if (window.innerWidth <= 768) wikiLayout.classList.add('show-items');
        itemDisplay.innerHTML = '<div class="item-panel-content item-detail-layout"></div>';
        const layout = itemDisplay.querySelector('.item-detail-layout');
        const mainContent = document.createElement('div');
        mainContent.className = 'detail-main-content';
        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.textContent = '← Назад';
        backButton.onclick = backFunction;
        mainContent.appendChild(backButton);
        const title = document.createElement('h2');
        title.textContent = item.name;
        mainContent.appendChild(title);
        const fullData = document.createElement('p');
        fullData.innerHTML = item.full_data;
        mainContent.appendChild(fullData);

        fullData.querySelectorAll('img').forEach(img => {
            img.classList.add('no-copy');
            img.draggable = false;
            img.addEventListener('contextmenu', e => e.preventDefault());
        });

        if (item.galleries && Array.isArray(item.galleries)) {
            fullData.querySelectorAll('.gallery-placeholder').forEach(placeholder => {
                const galleryId = placeholder.dataset.galleryId;
                const galleryData = item.galleries.find(g => g.id === galleryId);
                if (galleryData) {
                    const galleryContainer = document.createElement('div');
                    galleryContainer.className = 'gallery-container';

                    const width = placeholder.dataset.width;
                    const align = placeholder.dataset.align;
                    if (width) {
                        galleryContainer.style.width = width;
                    }
                    if (align) {
                        if (align === 'center') {
                            galleryContainer.style.margin = '20px auto';
                        } else {
                            galleryContainer.style.float = align;
                            galleryContainer.style.margin = '20px';
                        }
                    }

                    const mainView = document.createElement('div');
                    mainView.className = 'gallery-main-view';

                    const mainImage = document.createElement('img');
                    mainImage.className = 'gallery-main-image no-copy';
                    mainImage.src = galleryData.images[0];
                    mainImage.draggable = false;
                    mainView.appendChild(mainImage);

                    if (galleryData.images.length > 1) {
                        const prevNav = document.createElement('button');
                        prevNav.className = 'gallery-nav gallery-prev';
                        prevNav.innerHTML = '&lt;';
                        mainView.appendChild(prevNav);

                        const nextNav = document.createElement('button');
                        nextNav.className = 'gallery-nav gallery-next';
                        nextNav.innerHTML = '&gt;';
                        mainView.appendChild(nextNav);

                        galleryContainer.appendChild(mainView);

                        const thumbnails = document.createElement('div');
                        thumbnails.className = 'gallery-thumbnails';
                        
                        if (placeholder.dataset.thumbnails === 'hidden') {
                            thumbnails.style.display = 'none';
                        }

                        let currentImageIndex = 0;
                        const updateImage = () => {
                            mainImage.src = galleryData.images[currentImageIndex];
                            const currentActive = thumbnails.querySelector('.active');
                            if(currentActive) currentActive.classList.remove('active');
                            if(thumbnails.children[currentImageIndex]) thumbnails.children[currentImageIndex].classList.add('active');
                        };
                        
                        galleryData.images.forEach((imgSrc, index) => {
                            const thumb = document.createElement('img');
                            thumb.src = imgSrc;
                            thumb.className = 'gallery-thumbnail';
                            thumb.draggable = false;
                            if (index === 0) thumb.classList.add('active');
                            
                            thumb.onclick = () => {
                                currentImageIndex = index;
                                updateImage();
                            };
                            thumb.addEventListener('contextmenu', e => e.preventDefault());
                            thumbnails.appendChild(thumb);
                        });

                        galleryContainer.appendChild(thumbnails);

                        prevNav.onclick = () => {
                            currentImageIndex = (currentImageIndex - 1 + galleryData.images.length) % galleryData.images.length;
                            updateImage();
                        };

                        nextNav.onclick = () => {
                            currentImageIndex = (currentImageIndex + 1) % galleryData.images.length;
                            updateImage();
                        };
                    } else {
                         galleryContainer.appendChild(mainView);
                    }

                    placeholder.replaceWith(galleryContainer);
                }
            });
        }

        layout.appendChild(mainContent);

        if (item.sidebar) {
            const sidebar = document.createElement('div');
            sidebar.className = 'detail-sidebar';

            const imageContainer = document.createElement('div');
            imageContainer.className = 'sidebar-image-container';

            let imageUrls = (item.sidebar.images && item.sidebar.images.length > 0) ? item.sidebar.images : [item.sidebar.image];

            if (imageUrls.length > 0 && imageUrls[0]) {
                let currentImageIndex = 0;
                const image = document.createElement('img');
                image.src = imageUrls[currentImageIndex];
                image.alt = item.name;
                image.className = 'sidebar-image no-copy';
                image.draggable = false;
                image.onerror = () => { image.src = 'https://via.placeholder.com/280x280.png/000000/FFFFFF?text=No+Image'; };
                imageContainer.appendChild(image);

                if (imageUrls.length > 1) {
                    const prevButton = document.createElement('button');
                    prevButton.className = 'image-prev-button';
                    prevButton.innerHTML = '&lt;';
                    prevButton.onclick = (e) => {
                        e.stopPropagation();
                        currentImageIndex = (currentImageIndex - 1 + imageUrls.length) % imageUrls.length;
                        image.src = imageUrls[currentImageIndex];
                    };
                    imageContainer.appendChild(prevButton);

                    const nextButton = document.createElement('button');
                    nextButton.className = 'image-next-button';
                    nextButton.innerHTML = '&gt;';
                    nextButton.onclick = (e) => {
                        e.stopPropagation();
                        currentImageIndex = (currentImageIndex + 1) % imageUrls.length;
                        image.src = imageUrls[currentImageIndex];
                    };
                    imageContainer.appendChild(nextButton);
                }
            } 
            
            sidebar.appendChild(imageContainer);

            const fieldsContainer = document.createElement('div');
            fieldsContainer.className = 'sidebar-fields';
            for (const key in item.sidebar.fields) {
                const field = document.createElement('div');
                field.className = 'sidebar-field';
                field.innerHTML = `<strong>${key}</strong><span>${item.sidebar.fields[key]}</span>`;
                fieldsContainer.appendChild(field);
            }
            sidebar.appendChild(fieldsContainer);
            layout.appendChild(sidebar);
        }
        
        itemDisplay.querySelectorAll('.no-copy').forEach(el => {
            el.addEventListener('contextmenu', e => e.preventDefault());
        });
    }

    function renderList(titleText, description, items) {
        if (window.innerWidth <= 768) wikiLayout.classList.add('show-items');
        itemDisplay.innerHTML = '<div class="item-panel-content"></div>';
        const content = itemDisplay.querySelector('.item-panel-content');
        
        const title = document.createElement('h2');
        title.textContent = titleText;
        content.appendChild(title);
        const desc = document.createElement('p');
        desc.textContent = description;
        content.appendChild(desc);
        items.forEach((item) => {
            const itemButton = document.createElement('button');
            itemButton.className = 'item-button';
            itemButton.innerHTML = `<strong>${item.name}</strong><br><span>${item.summary}</span>`;
            itemButton.onclick = () => renderItemDetail(item, () => renderList(titleText, description, items));
            content.appendChild(itemButton);
        });
    }

        async function renderCategories() {
        wikiLayout.classList.remove('show-items');
        const world = worldsConfig[currentWorld];
        categoryList.innerHTML = '';
        itemDisplay.innerHTML = `<div class="item-panel-content"><h2>Добро пожаловать во вселенную ${world.name}</h2><p>Выберите категорию слева для начала исследования.</p></div>`;

        const createCategoryButton = (key, categoryData, level, parentContainer) => {
            const catButton = document.createElement('button');
            const subcategoryContainer = document.createElement('div');
            
            catButton.className = `level-${level}`;
            catButton.textContent = key;
            
            if (level === 0) catButton.classList.add('category-button');
            else catButton.classList.add('subcategory-button');

            parentContainer.appendChild(catButton);
            parentContainer.appendChild(subcategoryContainer);

            const hasSubcategories = categoryData.subcategories && Object.keys(categoryData.subcategories).length > 0;
            const hasSubSubcategories = categoryData.subsubcategories && Object.keys(categoryData.subsubcategories).length > 0;

            if (hasSubcategories || hasSubSubcategories) {
                subcategoryContainer.classList.add('collapsible-container');
                if (level === 0) {
                    subcategoryContainer.classList.add('subcategory-container');
                } else {
                    subcategoryContainer.classList.add('subsubcategory-container');
                }
                subcategoryContainer.style.display = 'none';
                catButton.classList.add('has-children');

                catButton.onclick = () => {
                    const isOpening = subcategoryContainer.style.display === 'none';

                    // Deactivate any active item button (leaf node)
                    const activeLeaf = document.querySelector('.subcategory-button.active:not(.has-children)');
                    if (activeLeaf) {
                        activeLeaf.classList.remove('active');
                    }

                    // Close sibling collapsible containers
                    const siblingContainers = parentContainer.querySelectorAll(':scope > .collapsible-container');
                    siblingContainers.forEach(container => {
                        if (container !== subcategoryContainer) {
                            container.style.display = 'none';
                            container.previousElementSibling.classList.remove('active');
                        }
                    });

                    // Toggle the current container
                    subcategoryContainer.style.display = isOpening ? 'block' : 'none';
                    catButton.classList.toggle('active', isOpening);
                };

                if (hasSubcategories) {
                    for (const subcatKey in categoryData.subcategories) {
                        createCategoryButton(subcatKey, categoryData.subcategories[subcatKey], level + 1, subcategoryContainer);
                    }
                }
                if (hasSubSubcategories) {
                    for (const subsubcatKey in categoryData.subsubcategories) {
                        createCategoryButton(subsubcatKey, categoryData.subsubcategories[subsubcatKey], level + 1, subcategoryContainer);
                    }
                }
            } else if (categoryData.items_url) {
                catButton.onclick = async () => {
                    // Deactivate all buttons first
                    document.querySelectorAll('.category-button, .subcategory-button').forEach(b => b.classList.remove('active'));
                    
                    // Close collapsible containers that are NOT parents of the clicked button
                    document.querySelectorAll('.collapsible-container').forEach(container => {
                        if (!container.contains(catButton)) {
                            container.style.display = 'none';
                            const associatedButton = container.previousElementSibling;
                            if (associatedButton && associatedButton.classList.contains('has-children')) {
                                associatedButton.classList.remove('active');
                            }
                        }
                    });

                    // Activate the clicked button
                    catButton.classList.add('active');
                    
                    // Traverse up and activate parents, ensuring their containers are open
                    let current = catButton;
                    while (current.parentElement.classList.contains('collapsible-container')) {
                        const parentContainer = current.parentElement;
                        const parentButton = parentContainer.previousElementSibling;
                        if (parentButton) {
                            parentButton.classList.add('active');
                            parentContainer.style.display = 'block';
                            current = parentButton;
                        } else {
                            break;
                        }
                    }

                    const items = await fetchItems(categoryData.items_url);
                    if (items) {
                        renderList(key, categoryData.description, items);
                    }
                };
            }
        };

        for (const catKey in world.categories) {
            createCategoryButton(catKey, world.categories[catKey], 0, categoryList);
        }
    }

    async function switchWorld(worldId) {
        currentWorld = worldId;
        if (!worldsConfig[worldId]) {
            const worldData = await fetchWorldConfig(worldId);
            if (!worldData) return;
        }
        const world = worldsConfig[worldId];
        body.className = '';
        body.classList.add(world.theme);
        logo.textContent = world.name.toUpperCase();
        await renderCategories();
        modal.classList.add('hidden');
    }

    async function refreshWorldListModal() {
        worldsManifest = await fetchManifest();
        if (!worldsManifest || !Array.isArray(worldsManifest.worlds)) return;

        modalWorldList.innerHTML = '';
        const filteredWorlds = worldsManifest.worlds.filter(world => world.needsScaffolding !== false);

        for (const worldInfo of filteredWorlds) {
            const worldData = await fetchWorldConfig(worldInfo.id);
            const button = document.createElement('button');
            button.className = 'world-button-modal';
            button.textContent = worldData ? worldData.name : worldInfo.id;
            button.onclick = () => switchWorld(worldInfo.id);
            modalWorldList.appendChild(button);
        }
    }

    async function init() {
        await refreshWorldListModal();
        
        const defaultWorldId = worldsManifest.worlds[0]?.id || 'scp';
        if (defaultWorldId) {
            await switchWorld(defaultWorldId);
        }

        modeToggle.addEventListener('change', () => {
            if (modeToggle.checked) {
                gameMode.classList.remove('active-view');
                wikiMode.classList.add('active-view');
            } else {
                wikiMode.classList.remove('active-view');
                gameMode.classList.add('active-view');
            }
        });
        mobileMenuBtn.addEventListener('click', () => {
            wikiLayout.classList.remove('show-items');
        });
    }

    logo.addEventListener('click', () => modal.classList.remove('hidden'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

    init();

    // --- EDITOR MODE LOGIC ---
    const editorPasswordModal = document.getElementById('editor-password-modal');
    const editorPasswordInput = document.getElementById('editor-password-input');
    const editorPasswordSubmit = document.getElementById('editor-password-submit');
    const editorPasswordError = document.getElementById('editor-password-error');
    const editorContainer = document.getElementById('editor-container');
    const editorCloseBtn = document.getElementById('editor-close-btn');

    let keySequence = '';
    const secretCode = 'edit';

    function closePasswordModal() {
        editorPasswordInput.value = '';
        keySequence = '';
        editorPasswordModal.classList.add('hidden');
    }

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            if (!editorPasswordModal.classList.contains('hidden')) {
                closePasswordModal();
            } else if (!modal.classList.contains('hidden')) {
                modal.classList.add('hidden');
            } else {
                const editorBackBtn = document.getElementById('editor-back-btn');
                if (editorBackBtn) {
                    renderEditorHome();
                }
            }
            return;
        }

        if (editorPasswordModal.classList.contains('hidden')) {
            keySequence += e.key.toLowerCase();
            if (keySequence.length > secretCode.length) {
                keySequence = keySequence.substr(keySequence.length - secretCode.length);
            }
            if (keySequence === secretCode) {
                editorPasswordError.classList.add('hidden');
                editorPasswordModal.classList.remove('hidden');
                editorPasswordInput.focus();
                keySequence = '';
            }
        }
    });

    function checkPassword() {
        if (editorPasswordInput.value === '3103') {
            editorContainer.classList.remove('hidden');
            renderEditorHome();
            closePasswordModal();
        } else {
            editorPasswordError.classList.remove('hidden');
        }
    }

    editorPasswordModal.addEventListener('click', (e) => {
        if (e.target === editorPasswordModal) {
            closePasswordModal();
        }
    });

    editorPasswordSubmit.addEventListener('click', checkPassword);
    editorPasswordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });

    editorCloseBtn.addEventListener('click', async () => {
        editorContainer.classList.add('hidden');
        const newManifest = await fetchManifest();
        const worldExists = newManifest.worlds.some(w => w.id === currentWorld);
        if (!worldExists) {
            await switchWorld(newManifest.worlds[0]?.id || 'scp');
        }
    });

    function showSaveStatus(status) {
        return new Promise(resolve => {
            const statusIndicator = document.getElementById('save-status-indicator');
            if (!statusIndicator) {
                resolve();
                return;
            }

            statusIndicator.className = 'save-status-indicator';
            statusIndicator.textContent = '';

            if (status === 'success') {
                statusIndicator.textContent = '✔';
                statusIndicator.classList.add('success');
            } else if (status === 'error') {
                statusIndicator.textContent = '❌';
                statusIndicator.classList.add('error');
            }
            
            const duration = 2000;

            setTimeout(() => {
                statusIndicator.classList.add('fade-out');
            }, duration - 2000);

            setTimeout(() => {
                statusIndicator.className = 'save-status-indicator';
                statusIndicator.textContent = '';
                resolve();
            }, duration);
        });
    }

    function showInvalidCharTooltip(element) {
        // Find a tooltip associated with the specific input field's parent
        let tooltip = element.parentNode.querySelector('.invalid-char-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'invalid-char-tooltip';
            tooltip.textContent = 'Имя файла не должно содержать символы \ / : * ? " < > |';
            
            // Ensure the parent can contain a positioned element
            const parentStyle = window.getComputedStyle(element.parentNode);
            if (parentStyle.position === 'static') {
                element.parentNode.style.position = 'relative';
            }
            element.parentNode.appendChild(tooltip);
        }

        // Make it visible and set a timer to hide it
        tooltip.classList.add('visible');
        
        // Clear any existing timer to avoid premature hiding
        const existingTimer = parseInt(tooltip.dataset.timerId, 10);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timerId = setTimeout(() => {
            tooltip.classList.remove('visible');
        }, 2500);
        tooltip.dataset.timerId = timerId;
    }

    function showDigitsOnlyTooltip(element) {
        // Find a tooltip associated with the specific input field's parent
        let tooltip = element.parentNode.querySelector('.digits-only-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'invalid-char-tooltip digits-only-tooltip';
            tooltip.textContent = 'Имя категории не может состоять только из цифр.';
            
            // Ensure the parent can contain a positioned element
            const parentStyle = window.getComputedStyle(element.parentNode);
            if (parentStyle.position === 'static') {
                element.parentNode.style.position = 'relative';
            }
            element.parentNode.appendChild(tooltip);
        }

        // Make it visible and set a timer to hide it
        tooltip.classList.add('visible');
        
        // Clear any existing timer to avoid premature hiding
        const existingTimer = parseInt(tooltip.dataset.timerId, 10);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timerId = setTimeout(() => {
            tooltip.classList.remove('visible');
        }, 2500);
        tooltip.dataset.timerId = timerId;
    }

    async function callApi(endpoint, method = 'POST', body = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);
            if (!response.ok) {
                const errorResult = await response.json();
                throw new Error(errorResult.message || `Request to ${endpoint} failed`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Error calling endpoint ${endpoint}:`, error);
            showSaveStatus('error');
            return null;
        }
    }

    async function saveFile(filePath, dataObject) {
        const result = await callApi('api/save', 'POST', { 
            filePath: filePath, 
            content: JSON.stringify(dataObject, null, 4)
        });
        if (result) {
            await showSaveStatus('success');
            return true;
        }
        return false;
    }

    // --- Editor UI Rendering ---
    const editorMainPanel = document.getElementById('editor-main-panel');

    async function getThemeClasses() {
        try {
            const response = await fetch('style.css');
            const cssText = await response.text();
            const themeRegex = /\.theme-([a-zA-Z0-9-]+)/g;
            const matches = cssText.match(themeRegex) || [];
            const themeNames = matches.map(theme => theme.substring(1));
            return [...new Set(themeNames)];
        } catch (error) {
            console.error("Failed to fetch or parse themes from style.css", error);
            return ['theme-default', 'theme-scp', 'theme-marvel', 'theme-hp', 'theme-onepiece', 'theme-naruto', 'theme-bleach', 'theme-kim-possible', 'theme-jackie-chan'];
        }
    }

    function renderEditorHome() {
        editorMainPanel.innerHTML = `
        <div class="editor-content-wrapper">
            <div class="editor-home-content">
                <p>Добро пожаловать в режим редактора. Выберите, что вы хотите изменить.</p>
                <button class="editor-main-button" data-action="manage-worlds">Управление  (manifest.json)</button>
                <button class="editor-main-button" data-action="manage-categories">Управление категориями (world.json)</button>
                <button class="editor-main-button" data-action="manage-items">Управление элементами (.json)</button>
                <button class="editor-main-button" data-action="manage-themes">Управление темами (style.css)</button>
            </div>
        </div>
        `;
    }

    async function renderWorldsEditor() {
        const manifestData = worldsManifest; // Use the pre-fetched manifest
        if (!manifestData || !manifestData.worlds) { 
            editorMainPanel.innerHTML = '<p class="error-message">Не удалось загрузить manifest.json</p>';
            return;
        }

        // Configs are now pre-fetched by the dispatcher

        let initialWorlds = JSON.stringify(manifestData.worlds);
        let worlds = [...manifestData.worlds];
        let editingWorldId = null;
        const worldsToDelete = [];
        let draggedWorldId = null;

        const attachListeners = () => {
            const scrollWrapper = () => document.querySelector('.editor-content-wrapper.scrollable');
            const getScrollTop = () => scrollWrapper()?.scrollTop || 0;

            const sanitizePathInput = (e) => {
                const forbiddenChars = /[\\|\/:*?"<>]/g;
                if (forbiddenChars.test(e.target.value)) {
                    showInvalidCharTooltip(e.target);
                }
                e.target.value = e.target.value.replace(forbiddenChars, '');
            };

            // Main Save Button
            document.getElementById('save-worlds-btn').addEventListener('click', async () => {
                const scrollTop = getScrollTop();
                const worldsToScaffold = worlds.filter(w => w.needsScaffolding === true);
                const worldsToRename = worlds.filter(w => w.renameInfo);

                const worldsToSave = worlds.map(w => {
                    const { renameInfo, needsScaffolding, ...rest } = w;
                    if (needsScaffolding === false) {
                        return { ...rest, needsScaffolding: false };
                    }
                    return rest;
                });

                const success = await saveFile('manifest.json', { worlds: worldsToSave });

                if (success) {
                    for (const world of worldsToScaffold) {
                        await callApi('api/scaffold-world', 'POST', { worldId: world.id, worldPath: world.path });
                    }
                    for (const world of worldsToRename) {
                        if (world.needsScaffolding !== false) {
                           await callApi('api/rename-world', 'POST', { oldPath: world.renameInfo.from, newPath: world.renameInfo.to, worldId: world.id });
                        }
                    }
                    for (const world of worldsToDelete) {
                        await callApi('api/delete-world', 'POST', { world: world });
                        delete worldsConfig[world.id]; // Remove from in-memory config
                    }
                    
                    const newManifest = await fetchManifest();
                    // Check if the currently active world was deleted
                    if (worldsToDelete.some(w => w.id === currentWorld)) {
                        await switchWorld(newManifest.worlds[0]?.id || 'scp');
                    }
                    worldsToDelete.length = 0; // Clear the array


                    initialWorlds = JSON.stringify(newManifest.worlds);
                    worlds = [...newManifest.worlds];
                    editingWorldId = null;

                    await refreshWorldListModal();
                    render(scrollTop);
                }
            });

            // Back Button
            document.getElementById('editor-back-btn').addEventListener('click', renderEditorHome);

            // Reset Button
            const resetBtn = document.getElementById('reset-worlds-btn');
            if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                    worlds = JSON.parse(initialWorlds);
                    worldsToDelete.length = 0; // Clear the array
                    render(getScrollTop());
                });
            }

            // Add World Form
            const idInput = document.getElementById('new-world-id');
            const folderInput = document.getElementById('new-world-folder');
            const fileInput = document.getElementById('new-world-file');

            folderInput.addEventListener('input', sanitizePathInput);
            fileInput.addEventListener('input', sanitizePathInput);

            idInput.addEventListener('input', () => {
                folderInput.placeholder = `Папка мира (По умолчанию: ${idInput.value || 'ID мира'})`;
            });

            document.getElementById('add-world-btn').addEventListener('click', () => {
                const idValue = idInput.value.trim();
                let folderValue = folderInput.value.trim();
                let fileValue = fileInput.value.trim();

                if (idValue && !worlds.find(w => w.id === idValue)) {
                    if (!folderValue) folderValue = idValue;
                    if (!fileValue) fileValue = 'world';
                    
                    const pathValue = `data/${folderValue}/${fileValue}.json`;
                    const newWorld = { id: idValue, path: pathValue, needsScaffolding: true };
                    worlds.push(newWorld);
                    render(getScrollTop());
                }
            });

            // Listeners for each item in the list
            document.querySelectorAll('.editor-list-item').forEach(item => {
                const worldId = item.dataset.id;
                const currentScroll = getScrollTop;

                // Sanitizers for edit inputs
                const editFolderInput = item.querySelector('.edit-path-folder-input');
                if (editFolderInput) editFolderInput.addEventListener('input', sanitizePathInput);
                const editFileInput = item.querySelector('.edit-path-file-input');
                if (editFileInput) editFileInput.addEventListener('input', sanitizePathInput);

                // Drag and Drop
                item.addEventListener('dragstart', (e) => {
                    draggedWorldId = worldId;
                    e.dataTransfer.effectAllowed = 'move';
                    item.classList.add('dragging');
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                    draggedWorldId = null;
                });

                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    item.classList.add('drag-over');
                });

                item.addEventListener('dragleave', () => {
                    item.classList.remove('drag-over');
                });

                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    item.classList.remove('drag-over');
                    if (draggedWorldId && draggedWorldId !== worldId) {
                        const fromIndex = worlds.findIndex(w => w.id === draggedWorldId);
                        const toIndex = worlds.findIndex(w => w.id === worldId);
                        const [movedWorld] = worlds.splice(fromIndex, 1);
                        worlds.splice(toIndex, 0, movedWorld);
                        render(currentScroll());
                    }
                });

                // Delete button
                item.querySelector('.editor-delete-btn')?.addEventListener('click', () => {
                    const worldToDelete = worlds.find(w => w.id === worldId);
                    const deleteFilesCheckbox = item.querySelector('.delete-files-checkbox');
                    
                    if (worldToDelete) {
                        if (deleteFilesCheckbox && deleteFilesCheckbox.checked) {
                            worldsToDelete.push(worldToDelete);
                        }
                        worlds = worlds.filter(w => w.id !== worldId);
                        render(currentScroll());
                    }
                });

                // Other buttons
                item.querySelector('.editor-move-btn[data-direction="up"]')?.addEventListener('click', () => {
                    const index = worlds.findIndex(w => w.id === worldId);
                    if (index > 0) {
                        [worlds[index], worlds[index - 1]] = [worlds[index - 1], worlds[index]];
                        render(currentScroll());
                    }
                });
                item.querySelector('.editor-move-btn[data-direction="down"]')?.addEventListener('click', () => {
                    const index = worlds.findIndex(w => w.id === worldId);
                    if (index < worlds.length - 1) {
                        [worlds[index], worlds[index + 1]] = [worlds[index + 1], worlds[index]];
                        render(currentScroll());
                    }
                });
                item.querySelector('.scaffold-toggle-btn')?.addEventListener('click', () => {
                    const world = worlds.find(w => w.id === worldId);
                    if (world && world.hasOwnProperty('needsScaffolding')) {
                        world.needsScaffolding = !world.needsScaffolding;
                        render(currentScroll());
                    }
                });
                item.querySelector('.editor-edit-btn')?.addEventListener('click', () => {
                    editingWorldId = worldId;
                    render(currentScroll());
                });
                item.querySelector('.editor-cancel-btn')?.addEventListener('click', () => {
                    editingWorldId = null;
                    render(currentScroll());
                });
                item.querySelector('.editor-confirm-btn')?.addEventListener('click', async () => {
                    const index = worlds.findIndex(w => w.id === worldId);
                    const oldPath = worlds[index].path;

                    const newId = item.querySelector('.edit-id-input').value.trim();
                    const newFolder = item.querySelector('.edit-path-folder-input').value.trim();
                    let newFile = item.querySelector('.edit-path-file-input').value.trim();
                    const newName = item.querySelector('.edit-name-input').value.trim();

                    if (newId && newFolder) {
                        if (!newFile) newFile = 'world';
                        const newPath = `data/${newFolder}/${newFile}.json`;
                        
                        const originalWorld = worlds[index];
                        worlds[index] = { ...originalWorld, id: newId, path: newPath };
                        
                        if (oldPath !== newPath) {
                            worlds[index].renameInfo = { from: oldPath, to: newPath };
                        }

                        // Update world config
                        const worldConfig = worldsConfig[worldId];
                        if (worldConfig) {
                            worldConfig.name = newName;
                            await saveFile(originalWorld.path, worldConfig);
                        }

                        editingWorldId = null;
                        render(currentScroll());
                    }
                });
            });
        }

        const render = (scrollTop = 0) => {
            const isDirty = JSON.stringify(worlds) !== initialWorlds || worldsToDelete.length > 0;
            
            worlds.sort((a, b) => {
                const aIsNew = a.hasOwnProperty('needsScaffolding');
                const bIsNew = b.hasOwnProperty('needsScaffolding');
                if (aIsNew && !bIsNew) return 1;
                if (!aIsNew && bIsNew) return -1;
                if (aIsNew && bIsNew) {
                    if (a.needsScaffolding && !b.needsScaffolding) return -1;
                    if (!a.needsScaffolding && b.needsScaffolding) return 1;
                }
                return 0;
            });

            let worldsHtml = worlds.map((world, index) => {
                const isEditing = world.id === editingWorldId;
                const otherItemIsEditing = editingWorldId !== null && !isEditing;

                let itemInfoHtml;
                let actionButtonsHtml;

                if (isEditing) {
                    const pathParts = world.path.match(/data\/(.*?)\/(.*)/) || ['', '', ''];
                    let file = pathParts[2];
                    if (file.endsWith('.json')) file = file.slice(0, -5);

                    itemInfoHtml = `
                        <div class="editor-edit-fields">
                            <div class="editor-edit-field">
                                <strong>ID:</strong>
                                <input type="text" class="edit-id-input" value="${world.id}">
                            </div>
                            <div class="editor-edit-field">
                                <strong>Name:</strong>
                                <input type="text" class="edit-name-input" value="${worldsConfig[world.id]?.name || ''}" placeholder="Имя мира">
                            </div>
                            <div class="editor-edit-field">
                                <strong>Path:</strong>
                                <div class="editor-path-input-group">
                                   <span>data/</span>
                                   <input type="text" class="edit-path-folder-input" value="${pathParts[1]}">
                                   <span>/</span>
                                   <input type="text" class="edit-path-file-input" value="${file}">
                                   <span>.json</span>
                                </div>
                            </div>
                        </div>
                    `;
                    actionButtonsHtml = `
                        <button class="editor-confirm-btn" data-id="${world.id}">✔</button>
                        <button class="editor-cancel-btn" data-id="${world.id}">✖</button>
                    `;
                } else {
                    itemInfoHtml = `
                        <span><strong>ID:</strong> ${world.id}</span>
                        <span><strong>Path:</strong> ${world.path}</span>
                        <span><strong>Name:</strong> ${worldsConfig[world.id]?.name || 'N/A'}</span>
                    `;
                    actionButtonsHtml = `
                        <button class="editor-edit-btn" data-id="${world.id}" ${otherItemIsEditing ? 'disabled' : ''}>✎</button>
                        <div class="delete-action-group">
                           <button class="editor-delete-btn" data-id="${world.id}" ${otherItemIsEditing ? 'disabled' : ''}>Удалить</button>
                           <input type="checkbox" class="delete-files-checkbox" id="delete-files-${world.id}" ${otherItemIsEditing ? 'disabled' : ''}>
                           <label for="delete-files-${world.id}">Удалить папку</label>
                        </div>
                    `;
                }

                let controls = '';
                if (world.hasOwnProperty('needsScaffolding')) {
                    controls = `<button class="scaffold-toggle-btn" data-id="${world.id}" title="Создать файлы?" ${otherItemIsEditing ? 'disabled' : ''}>${world.needsScaffolding ? '[+]' : '[-]'}</button>`;
                } else {
                    controls = `
                        <button class="editor-move-btn" data-index="${index}" data-direction="up" title="Вверх" ${index === 0 || otherItemIsEditing ? 'disabled' : ''}>▲</button>
                        <button class="editor-move-btn" data-index="${index}" data-direction="down" title="Вниз" ${index === worlds.length - 1 || otherItemIsEditing ? 'disabled' : ''}>▼</button>
                    `;
                }

                return `
                <div class="editor-list-item" data-id="${world.id}" draggable="true">
                    <div class="editor-item-controls">
                        ${controls}
                    </div>
                    <div class="editor-item-info">
                        ${itemInfoHtml}
                    </div>
                    <div class="editor-item-actions">
                        ${actionButtonsHtml}
                    </div>
                </div>
            `;}).join('');

            editorMainPanel.innerHTML = `
                <div class="editor-panel-header">
                    <h3>Управление мирами (manifest.json)</h3>
                    <button id="editor-back-btn">Назад</button>
                </div>
                <div class="editor-content-wrapper scrollable">
                    <div id="worlds-list">${worldsHtml}</div>
                </div>
                <div class="editor-footer">
                    <h4>Добавить новый мир</h4>
                    <div class="editor-form">
                        <input type="text" id="new-world-id" placeholder="ID мира (Например: dune)">
                        <div class="editor-path-input-group">
                           <span>data/</span>
                           <input type="text" id="new-world-folder" placeholder="Папка мира (По умолчанию: ID мира)">
                           <span>/</span>
                           <input type="text" id="new-world-file" placeholder="Файл мира (По умолчанию: world)">
                           <span>.json</span>
                        </div>
                        <button id="add-world-btn">Добавить</button>
                    </div>
                    <div class="editor-save-area">
                        <button id="save-worlds-btn" class="editor-save-button" ${!isDirty ? 'disabled' : ''}>Сохранить изменения</button>
                        <button id="reset-worlds-btn" class="editor-reset-button" ${!isDirty ? 'disabled' : ''}>Сбросить</button>
                        <span id="save-status-indicator" class="save-status-indicator"></span>
                    </div>
                </div>
            `;
            attachListeners();
            const scrollWrapper = document.querySelector('.editor-content-wrapper.scrollable');
            if (scrollWrapper) {
                scrollWrapper.scrollTop = scrollTop;
            }
        }

        render();
    }

    editorMainPanel.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        
        // For any editor that uses world data, force a refresh first.
        if (action === 'manage-worlds' || action === 'manage-categories' || action === 'manage-items') {
            worldsManifest = await fetchManifest();
            if (worldsManifest && worldsManifest.worlds) {
                // Create an array of promises to fetch all world configs in parallel
                const fetchPromises = worldsManifest.worlds.map(world => fetchWorldConfig(world.id, true));
                await Promise.all(fetchPromises);
            }
        }

        if (action === 'manage-worlds') {
            await renderWorldsEditor();
        } else if (action === 'manage-categories') {
            await renderCategoryEditor();
        } else if (action === 'manage-items') {
            renderItemEditor();
        } else if (action === 'manage-themes') {
            renderThemeEditor();
        }
    });

    const findParentCollection = (currentWorldObj, itemKey, itemLevel) => {
        if (itemLevel === 0) return currentWorldObj.categories;
        if (itemLevel === 1) {
            for (const l0Key in currentWorldObj.categories) {
                if (currentWorldObj.categories[l0Key].subcategories && currentWorldObj.categories[l0Key].subcategories[itemKey]) {
                    return currentWorldObj.categories[l0Key].subcategories;
                }
            }
        }
        if (itemLevel === 2) {
            for (const l0Key in currentWorldObj.categories) {
                for (const l1Key in currentWorldObj.categories[l0Key].subcategories) {
                    if (currentWorldObj.categories[l0Key].subcategories[l1Key].subsubcategories && currentWorldObj.categories[l0Key].subcategories[l1Key].subsubcategories[itemKey]) {
                        return currentWorldObj.categories[l0Key].subcategories[l1Key].subsubcategories;
                    }
                }
            }
        }
        return null;
    };

    const isDroppingOntoOwnDescendant = (parent, potentialChildKey) => {
        if (!parent || typeof parent !== 'object') return false;
        if (parent.subcategories && parent.subcategories[potentialChildKey]) return true;
        if (parent.subsubcategories && parent.subsubcategories[potentialChildKey]) return true;

        for (const subKey in parent.subcategories) {
            if (isDroppingOntoOwnDescendant(parent.subcategories[subKey], potentialChildKey)) return true;
        }
        for (const subSubKey in parent.subsubcategories) {
            if (isDroppingOntoOwnDescendant(parent.subsubcategories[subSubKey], potentialChildKey)) return true;
        }
        return false;
    };

    async function renderCategoryEditor() {
    editorMainPanel.innerHTML = `
        <div class="editor-panel-header">
            <h3>Управление категориями (world.json)</h3>
            <button id="editor-back-btn">Назад</button>
        </div>
        <div class="editor-content-wrapper scrollable">
            <div class="editor-category-header">
                <div class="editor-world-selector">
                    <label for="world-select-for-categories">Выберите мир:</label>
                    <select id="world-select-for-categories"></select>
                </div>
                <div class="editor-theme-selector">
                    <label for="world-theme-select">Тема мира:</label>
                    <select id="world-theme-select"></select>
                </div>
            </div>
            <div id="category-editor-container"></div>
        </div>
        <div class="editor-footer">
             <div class="editor-save-area">
                <button id="save-categories-btn" class="editor-save-button" disabled>Сохранить изменения</button>
                <button id="reset-categories-btn" class="editor-reset-button" disabled>Сбросить</button>
                <span id="save-status-indicator" class="save-status-indicator"></span>
            </div>
        </div>
    `;

    const worldSelect = document.getElementById('world-select-for-categories');
    const themeSelect = document.getElementById('world-theme-select');
    const editorContainer = document.getElementById('editor-container');
    const saveBtn = document.getElementById('save-categories-btn');
    const resetBtn = document.getElementById('reset-categories-btn');

    let selectedWorldId = null;
    let clonedWorld = null;
    let currentEditorTheme = null;
    
    const themes = await getThemeClasses();

    themeSelect.innerHTML = '';
    themes.forEach(theme => {
        const option = document.createElement('option');
        option.value = theme;
        option.textContent = theme.replace('theme-', '');
        themeSelect.appendChild(option);
    });

    const isDirty = () => {
        if (!clonedWorld || !worldsConfig[selectedWorldId]) return false;
        const originalWorld = worldsConfig[selectedWorldId];
        return JSON.stringify(clonedWorld) !== JSON.stringify(originalWorld);
    };

    const updateButtonStates = () => {
        const dirty = isDirty();
        saveBtn.disabled = !dirty;
        resetBtn.disabled = !dirty;
    };
    
    const updateThemeUI = (world) => {
        if (currentEditorTheme) {
            editorContainer.classList.remove(currentEditorTheme);
        }
        if (world) {
            currentEditorTheme = world.theme || '';
            themeSelect.value = currentEditorTheme;
            if (currentEditorTheme) {
                 editorContainer.classList.add(currentEditorTheme);
            }
        }
    };

    const setupWorldForEditing = (worldId) => {
        selectedWorldId = worldId;
        if (worldsConfig[worldId]) {
            clonedWorld = JSON.parse(JSON.stringify(worldsConfig[worldId]));
        } else {
            clonedWorld = null;
        }
        updateThemeUI(clonedWorld);
        renderCategoryTree(clonedWorld, updateButtonStates, selectedWorldId);
        updateButtonStates();
    };

    const worldIds = Object.keys(worldsConfig);
    for (const worldId of worldIds) {
        const option = document.createElement('option');
        option.value = worldId;
        option.textContent = worldsConfig[worldId].name;
        worldSelect.appendChild(option);
    }

    document.getElementById('editor-back-btn').addEventListener('click', () => {
        if (currentEditorTheme) {
            editorContainer.classList.remove(currentEditorTheme);
        }
        renderEditorHome();
    });

    saveBtn.addEventListener('click', async () => {
        if (!isDirty()) return;

        const worldInfo = worldsManifest.worlds.find(w => w.id === selectedWorldId);
        if (worldInfo) {
            // Find all new categories and create their assets
            const newCategories = [];
            const findNew = (categories) => {
                if (!categories) return;
                for (const key in categories) {
                    const cat = categories[key];
                    if (cat.isNew && cat.items_url) {
                        newCategories.push(cat);
                    }
                    if(cat.subcategories) findNew(cat.subcategories);
                    if(cat.subsubcategories) findNew(cat.subsubcategories);
                }
            }
            findNew(clonedWorld.categories);

            for (const cat of newCategories) {
                await callApi('api/create-category-assets', 'POST', { items_url: cat.items_url });
                delete cat.isNew; // Clean up the flag before saving
            }

            // Update the original config with the cloned changes before saving
            worldsConfig[selectedWorldId] = JSON.parse(JSON.stringify(clonedWorld));
            
            const success = await saveFile(worldInfo.path, worldsConfig[selectedWorldId]);
            if (success) {
                if (selectedWorldId === currentWorld) {
                    await switchWorld(selectedWorldId);
                }
                setupWorldForEditing(selectedWorldId);
            }
        }
    });
    
    resetBtn.addEventListener('click', () => {
        if (isDirty()) {
            setupWorldForEditing(selectedWorldId);
        }
    });

    worldSelect.addEventListener('change', () => {
        setupWorldForEditing(worldSelect.value);
    });
    
    themeSelect.addEventListener('change', () => {
        if(clonedWorld) {
            clonedWorld.theme = themeSelect.value;
            updateThemeUI(clonedWorld);
            updateButtonStates();
        }
    });

    if (worldIds.length > 0) {
        setupWorldForEditing(worldSelect.value);
    }
}

function renderCategoryTree(world, onTreeChange, worldId) {
    const container = document.getElementById('category-editor-container');
    if (!world) {
        container.innerHTML = '<p>Выберите мир для редактирования.</p>';
        return;
    }
    
    const scrollState = container.scrollTop;
    container.innerHTML = ''; // Clear previous content

    const isAnythingEditing = world.categories && JSON.stringify(world.categories).includes('"isEditing":true');

    const addTopLevelForm = document.createElement('div');
    addTopLevelForm.className = 'category-add-form';
    addTopLevelForm.innerHTML = `
        <input type="text" placeholder="Имя новой категории..." class="new-category-input" ${isAnythingEditing ? 'disabled' : ''}>
        <button class="add-category-button" ${isAnythingEditing ? 'disabled' : ''}>Добавить</button>
    `;
    container.appendChild(addTopLevelForm);

    addTopLevelForm.querySelector('.add-category-button').addEventListener('click', () => {
        if (isAnythingEditing) return;
        const input = addTopLevelForm.querySelector('.new-category-input');
        const newCategoryName = input.value.trim();
        if (/^\d+$/.test(newCategoryName)) {
            showDigitsOnlyTooltip(input);
            return;
        }
        if (newCategoryName && (!world.categories || !world.categories[newCategoryName])) {
            if (!world.categories) world.categories = {};
            const newCat = {
                description: '',
                items_url: `data/${worldId}/${newCategoryName}/${newCategoryName}.json`,
                isNew: true
            };
            world.categories[newCategoryName] = newCat;
            renderCategoryTree(world, onTreeChange, worldId);
            onTreeChange();
        }
    });

    const treeContainer = document.createElement('div');
    container.appendChild(treeContainer);

    let draggedItem = null;

    const buildTree = (categories, parentElement, level, parentCollection) => {
        const keys = Object.keys(categories);

        keys.forEach((key, index) => {
            const category = categories[key];
            const categoryElement = document.createElement('div');
            categoryElement.className = 'category-editor-item';
            categoryElement.style.marginLeft = `${level * 20}px`;
            categoryElement.dataset.level = level;
            categoryElement.dataset.key = key;
            
            const isEditing = category.isEditing;
            categoryElement.draggable = !isAnythingEditing;

            let content;
            const hasChildren = (category.subcategories && Object.keys(category.subcategories).length > 0) || (category.subsubcategories && Object.keys(category.subsubcategories).length > 0);

            if (isEditing) {
                content = `
                    <div class="editor-edit-fields">
                        <div class="editor-edit-field">
                            <strong>Имя:</strong>
                            <input type="text" class="edit-category-input" value="${key}">
                        </div>
                        <div class="editor-edit-field">
                            <strong>Описание:</strong>
                            <input type="text" class="edit-category-description" value="${category.description || ''}" placeholder="Описание">
                        </div>
                        <div class="editor-edit-field">
                            <strong>Путь:</strong>
                            <input type="text" class="edit-category-items-url" value="${category.items_url || ''}" placeholder="Путь к файлу" ${hasChildren ? 'disabled' : ''}>
                        </div>
                        <div class="category-item-actions">
                            <button class="editor-confirm-btn">✔</button>
                            <button class="editor-cancel-btn">✖</button>
                        </div>
                    </div>
                `;
            } else {
                const addBtn = (level < 2) ? `<button class="add-subcategory-btn" ${isAnythingEditing ? 'disabled' : ''}>+</button>` : '';
                content = `
                    <div class="category-item-header">
                        <span class="category-name">${key}</span>
                        <div class="category-item-actions">
                            <button class="editor-move-btn" data-direction="up" ${index === 0 || isAnythingEditing ? 'disabled' : ''}>▲</button>
                            <button class="editor-move-btn" data-direction="down" ${index === keys.length - 1 || isAnythingEditing ? 'disabled' : ''}>▼</button>
                            <button class="editor-edit-btn" ${isAnythingEditing ? 'disabled' : ''}>✎</button>
                            <button class="editor-delete-btn" ${isAnythingEditing ? 'disabled' : ''}>Удалить</button>
                            ${addBtn}
                        </div>
                    </div>
                    <div class="category-item-details">
                        ${!hasChildren ? `<p><strong>Описание:</strong> ${category.description || ''}</p>` : ''}
                        ${!hasChildren ? `<p><strong>Путь:</strong> ${category.items_url || ''}</p>` : ''}
                    </div>
                `;
            }
            categoryElement.innerHTML = content;
            parentElement.appendChild(categoryElement);

            if (!isAnythingEditing) {
                 categoryElement.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    draggedItem = { key, level, collection: parentCollection };
                    e.dataTransfer.effectAllowed = 'move';
                    e.target.style.opacity = '0.5';
                });

                categoryElement.addEventListener('dragend', (e) => {
                    e.target.style.opacity = '';
                    draggedItem = null;
                });

                categoryElement.addEventListener('dragover', (e) => {
                    e.preventDefault(); // Allow drop by default
                    if (draggedItem && draggedItem.key !== categoryElement.dataset.key) {
                        e.dataTransfer.dropEffect = 'move';
                        categoryElement.classList.add('drag-over'); // Add visual indicator
                    } else {
                        e.dataTransfer.dropEffect = 'none'; // Cannot drop on self or if no item is dragged
                    }
                });

                categoryElement.addEventListener('dragleave', () => {
                    categoryElement.classList.remove('drag-over'); // Remove visual indicator
                });

                categoryElement.addEventListener('drop', (e) => {
                    e.preventDefault();
                    categoryElement.classList.remove('drag-over'); // Remove visual indicator
                    const targetKey = categoryElement.dataset.key;
                    const targetLevel = parseInt(categoryElement.dataset.level, 10);

                    if (!draggedItem || draggedItem.key === targetKey) {
                        return;
                    }

                    const draggedObject = draggedItem.collection[draggedItem.key];
                    if (!draggedObject) return;

                    // Prevent dropping a parent onto its own descendant
                    // Get the full object of the dragged item for descendant check
                    let originalDraggedItemFullObject = null;
                    if (draggedItem.level === 0) originalDraggedItemFullObject = world.categories[draggedItem.key];
                    else if (draggedItem.level === 1) {
                        for (const l0Key in world.categories) {
                            if (world.categories[l0Key].subcategories && world.categories[l0Key].subcategories[draggedItem.key]) {
                                originalDraggedItemFullObject = world.categories[l0Key].subcategories[draggedItem.key];
                                break;
                            }
                        }
                    } else if (draggedItem.level === 2) {
                        for (const l0Key in world.categories) {
                            for (const l1Key in world.categories[l0Key].subcategories) {
                                if (world.categories[l0Key].subcategories[l1Key].subsubcategories && world.categories[l0Key].subcategories[l1Key].subsubcategories[draggedItem.key]) {
                                    originalDraggedItemFullObject = world.categories[l0Key].subcategories[l1Key].subsubcategories[draggedItem.key];
                                    break;
                                }
                            }
                            if (originalDraggedItemFullObject) break;
                        }
                    }

                    if (originalDraggedItemFullObject) {
                        let targetCategoryObjectForDescendantCheck = null;
                        if (targetLevel === 0) targetCategoryObjectForDescendantCheck = world.categories[targetKey];
                        else if (targetLevel === 1) {
                            for (const l0Key in world.categories) {
                                if (world.categories[l0Key].subcategories && world.categories[l0Key].subcategories[targetKey]) {
                                    targetCategoryObjectForDescendantCheck = world.categories[l0Key].subcategories[targetKey];
                                    break;
                                }
                            }
                        }
                        // Check if the target is a descendant of the dragged item
                        if (targetCategoryObjectForDescendantCheck && isDroppingOntoOwnDescendant(originalDraggedItemFullObject, targetKey)) {
                            console.warn("Нельзя перетаскивать родителя на его собственного потомка.");
                            draggedItem.collection[draggedItem.key] = draggedObject; // Restore dragged item
                            renderCategoryTree(world, onTreeChange, worldId); // Re-render to ensure state consistency
                            return; 
                        }
                    }
                    
                    // Remove from original position
                    delete draggedItem.collection[draggedItem.key];

                    let success = false;
                    // Attempt to drop as a child of the target if the target can accept children
                    if (targetLevel < 2) { // Target can accept children (L0 or L1)
                        let targetCategoryObject = null;
                        if (targetLevel === 0) targetCategoryObject = world.categories[targetKey];
                        else if (targetLevel === 1) {
                            for (const l0Key in world.categories) {
                                if (world.categories[l0Key].subcategories && world.categories[l0Key].subcategories[targetKey]) {
                                    targetCategoryObject = world.categories[l0Key].subcategories[targetKey];
                                    break;
                                }
                            }
                        }
                        
                        if (targetCategoryObject) {
                            // Determine which sub-collection of the target to add to
                            if (targetLevel === 0) { // Target is L0, dragged becomes L1 child
                                if (!targetCategoryObject.subcategories) targetCategoryObject.subcategories = {};
                                targetCategoryObject.subcategories[draggedItem.key] = draggedObject;
                                success = true;
                            } else if (targetLevel === 1) { // Target is L1, dragged becomes L2 child
                                if (!targetCategoryObject.subsubcategories) targetCategoryObject.subsubcategories = {};
                                targetCategoryObject.subsubcategories[draggedItem.key] = draggedObject;
                                success = true;
                            }
                        }
                    } 
                    
                    if (!success) {
                        // If not dropped as a child, or target is L2 (cannot have children in current hierarchy),
                        // try dropping as a sibling to the target.
                        // This means finding the parent collection of the target and inserting the dragged item there.
                        const targetParentCollection = findParentCollection(world, targetKey, targetLevel);
                        if (targetParentCollection) {
                            const targetKeys = Object.keys(targetParentCollection);
                            const toIndex = targetKeys.indexOf(targetKey);
                            
                            // Insert the dragged item at the target's position (or after it, depending on desired behavior)
                            // Inserting after `targetKey` makes more sense visually for dropping 'onto'
                            const newKeys = [...targetKeys.slice(0, toIndex + 1), draggedItem.key, ...targetKeys.slice(toIndex + 1)]; 
                            
                            const reorderedCollection = {};
                            newKeys.forEach(k => {
                                // Populate the new collection, ensure draggedObject is included
                                reorderedCollection[k] = targetParentCollection[k] || (k === draggedItem.key ? draggedObject : undefined);
                            });
                            
                            // Clear and re-assign the targetParentCollection to maintain object reference
                            Object.keys(targetParentCollection).forEach(k => delete targetParentCollection[k]);
                            Object.assign(targetParentCollection, reorderedCollection);
                            success = true;
                        }
                    }

                    if (success) {
                        // If the dragged object now has children (or is a parent), clear its items_url and description
                        if ((draggedObject.subcategories && Object.keys(draggedObject.subcategories).length > 0) || (draggedObject.subsubcategories && Object.keys(draggedObject.subsubcategories).length > 0)) {
                             delete draggedObject.description;
                             delete draggedObject.items_url;
                        }
                        renderCategoryTree(world, onTreeChange, worldId);
                        onTreeChange();
                    } else {
                        // If drop failed (e.g., no suitable target collection found), re-add the dragged item to its original position
                        draggedItem.collection[draggedItem.key] = draggedObject;
                        console.warn("Операция перетаскивания не удалась, элемент возвращен в исходное положение.");
                        renderCategoryTree(world, onTreeChange, worldId); // Re-render to ensure state consistency
                    }
                });
            }


            const addSubForm = document.createElement('div');
            addSubForm.className = 'category-add-form sub-add-form';
            addSubForm.style.display = 'none';
            addSubForm.innerHTML = `
                <input type="text" placeholder="Имя подкатегории..." class="new-category-input">
                <button class="add-category-button">Добавить</button>
            `;
            categoryElement.appendChild(addSubForm);

            if (isEditing) {
                const nameInput = categoryElement.querySelector('.edit-category-input');
                const descInput = categoryElement.querySelector('.edit-category-description');
                const urlInput = categoryElement.querySelector('.edit-category-items-url');
                nameInput.focus();
                nameInput.select();

                categoryElement.querySelector('.editor-confirm-btn').addEventListener('click', () => {
                    const newName = nameInput.value.trim();
                    if (/^\d+$/.test(newName)) {
                        showDigitsOnlyTooltip(nameInput);
                        return;
                    }
                    
                    category.description = descInput.value.trim();
                    category.items_url = urlInput.value.trim();

                    if (newName && newName !== key) {
                        const newCollection = {};
                        Object.keys(parentCollection).forEach(k => {
                            if (k === key) {
                                newCollection[newName] = parentCollection[key];
                            } else {
                                newCollection[k] = parentCollection[k];
                            }
                        });
                        Object.keys(parentCollection).forEach(k => delete parentCollection[k]);
                        Object.assign(parentCollection, newCollection);
                    }
                    delete category.isEditing;
                    renderCategoryTree(world, onTreeChange, worldId);
                    onTreeChange();
                });

                categoryElement.querySelector('.editor-cancel-btn').addEventListener('click', () => {
                    delete category.isEditing;
                    renderCategoryTree(world, onTreeChange, worldId);
                });
                 nameInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') descInput.focus();
                });
                descInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') urlInput.focus();
                });
                urlInput.addEventListener('keyup', (e) => {
                    if (e.key === 'Enter') categoryElement.querySelector('.editor-confirm-btn').click();
                    if (e.key === 'Escape') categoryElement.querySelector('.editor-cancel-btn').click();
                });

            } else {
                categoryElement.querySelector('.editor-delete-btn').addEventListener('click', () => {
                    if (isAnythingEditing) return;
                    delete parentCollection[key];
                    renderCategoryTree(world, onTreeChange, worldId);
                    onTreeChange();
                });

                categoryElement.querySelector('.editor-edit-btn').addEventListener('click', () => {
                    if (isAnythingEditing) return;
                    category.isEditing = true;
                    renderCategoryTree(world, onTreeChange, worldId);
                });

                const moveCategory = (direction) => {
                    if (isAnythingEditing) return;
                    const keys = Object.keys(parentCollection);
                    const currentIndex = keys.indexOf(key);
                    const newIndex = currentIndex + direction;
                    if (newIndex >= 0 && newIndex < keys.length) {
                        const [movedKey] = keys.splice(currentIndex, 1);
                        keys.splice(newIndex, 0, movedKey);
                        
                        const newCollection = {};
                        keys.forEach(k => {
                            newCollection[k] = parentCollection[k];
                        });

                        Object.keys(parentCollection).forEach(k => delete parentCollection[k]);
                        Object.assign(parentCollection, newCollection);
                        renderCategoryTree(world, onTreeChange, worldId);
                        onTreeChange();
                    }
                };

                categoryElement.querySelector('.editor-move-btn[data-direction="up"]').addEventListener('click', () => moveCategory(-1));
                categoryElement.querySelector('.editor-move-btn[data-direction="down"]').addEventListener('click', () => moveCategory(1));


                const addSubBtn = categoryElement.querySelector('.add-subcategory-btn');
                if (addSubBtn) {
                    addSubBtn.addEventListener('click', () => {
                        if (isAnythingEditing) return;
                        const isVisible = addSubForm.style.display === 'block';
                        document.querySelectorAll('.sub-add-form').forEach(f => f.style.display = 'none');
                        addSubForm.style.display = isVisible ? 'none' : 'block';
                        if (!isVisible) {
                            addSubForm.querySelector('input').focus();
                        }
                    });

                    addSubForm.querySelector('.add-category-button').addEventListener('click', () => {
                        if (isAnythingEditing) return;
                        const input = addSubForm.querySelector('.new-category-input');
                        const newSubCategoryName = input.value.trim();
                        if (/^\d+$/.test(newSubCategoryName)) {
                            showDigitsOnlyTooltip(input);
                            return;
                        }
                        if (newSubCategoryName) {
                            let subCollection;
                            let parentCat = category;
                            if (level === 0) {
                                if (!parentCat.subcategories) parentCat.subcategories = {};
                                subCollection = parentCat.subcategories;
                            } else if (level === 1) {
                                if (!parentCat.subsubcategories) parentCat.subsubcategories = {};
                                subCollection = parentCat.subsubcategories;
                            }

                            if (subCollection && !subCollection[newSubCategoryName]) {
                                // Clean up parent
                                delete parentCat.items_url;
                                delete parentCat.description;

                                subCollection[newSubCategoryName] = { 
                                    description: '', 
                                    items_url: `data/${worldId}/${key}/${newSubCategoryName}/${newSubCategoryName}.json`,
                                    isNew: true
                                };
                                renderCategoryTree(world, onTreeChange, worldId);
                                onTreeChange();
                            }
                        }
                    });
                }
            }

            const subContainer = document.createElement('div');
            categoryElement.appendChild(subContainer);

            if (level === 0 && category.subcategories) {
                buildTree(category.subcategories, subContainer, level + 1, category.subcategories);
            }
            if (level === 1 && category.subsubcategories) {
                buildTree(category.subsubcategories, subContainer, level + 1, category.subsubcategories);
            }
        });
    };

    if (world && world.categories) {
        buildTree(world.categories, treeContainer, 0, world.categories);
    }

    container.scrollTop = scrollState;
}

    function renderThemeEditor() {
        editorMainPanel.innerHTML = `
            <div class="editor-panel-header">
                <h3>Управление темами</h3>
                <button id="editor-back-btn">Назад</button>
            </div>
            <div class="editor-content-wrapper scrollable">
                <textarea id="theme-editor-textarea"></textarea>
            </div>
            <div class="editor-footer">
                <button id="save-themes-btn" class="editor-save-button">Сохранить изменения</button>
            </div>
        `;

        const textarea = document.getElementById('theme-editor-textarea');

        // This is a simplified approach. A proper implementation would require a CSS parser.
        fetch('style.css')
            .then(response => response.text())
            .then(text => {
                textarea.value = text;
            });

        document.getElementById('editor-back-btn').addEventListener('click', renderEditorHome);

        document.getElementById('save-themes-btn').addEventListener('click', async () => {
            const newContent = textarea.value;
            await saveFile('style.css', newContent);
        });
    }

    function renderItemEditor() {
        editorMainPanel.innerHTML = `
            <div class="editor-panel-header">
                <h3>Управление элементами</h3>
                <button id="editor-back-btn">Назад</button>
            </div>
            <div class="editor-content-wrapper scrollable">
                <p>Выберите мир и категорию для редактирования элементов:</p>
                <select id="world-select-for-items"></select>
                <select id="category-select-for-items"></select>
                <div id="item-editor-container"></div>
            </div>
        `;

        const worldSelect = document.getElementById('world-select-for-items');
        const categorySelect = document.getElementById('category-select-for-items');

        for (const worldId in worldsConfig) {
            const option = document.createElement('option');
            option.value = worldId;
            option.textContent = worldsConfig[worldId].name;
            worldSelect.appendChild(option);
        }

        function populateCategorySelect(worldId) {
            categorySelect.innerHTML = '';
            const world = worldsConfig[worldId];
            for (const catKey in world.categories) {
                const category = world.categories[catKey];
                const option = document.createElement('option');
                option.value = catKey;
                option.textContent = catKey;
                categorySelect.appendChild(option);

                if (category.subcategories) {
                    for (const subcatKey in category.subcategories) {
                        const subcategory = category.subcategories[subcatKey];
                        const subOption = document.createElement('option');
                        subOption.value = subcatKey;
                        subOption.textContent = `  - ${subcatKey}`;
                        categorySelect.appendChild(subOption);
                    }
                }
            }
        }

        document.getElementById('editor-back-btn').addEventListener('click', renderEditorHome);

        worldSelect.addEventListener('change', () => {
            const selectedWorldId = worldSelect.value;
            populateCategorySelect(selectedWorldId);
            renderItemsForCategory(selectedWorldId, categorySelect.value);
        });

        categorySelect.addEventListener('change', () => {
            const selectedWorldId = worldSelect.value;
            const selectedCategoryId = categorySelect.value;
            renderItemsForCategory(selectedWorldId, selectedCategoryId);
        });

        // Initial render
        if (Object.keys(worldsConfig).length > 0) {
            const initialWorldId = Object.keys(worldsConfig)[0];
            populateCategorySelect(initialWorldId);
            renderItemsForCategory(initialWorldId, categorySelect.value);
        }
    }

    function openItemEditorModal(item, worldId, categoryId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>${item ? 'Редактировать элемент' : 'Создать элемент'}</h2>
                <form id="item-editor-form">
                    <label for="item-name">Name:</label>
                    <input type="text" id="item-name" value="${item ? item.name : ''}" required>
                    <label for="item-summary">Summary:</label>
                    <textarea id="item-summary">${item ? item.summary : ''}</textarea>
                    <label for="item-full-data">Full Data:</label>
                    <textarea id="item-full-data">${item ? item.full_data : ''}</textarea>
                    <div class="modal-actions">
                        <button type="submit">Сохранить</button>
                        <button type="button" id="cancel-item-edit">Отмена</button>
                    </div>
                </form>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('cancel-item-edit').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('item-editor-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newItem = {
                name: document.getElementById('item-name').value,
                summary: document.getElementById('item-summary').value,
                full_data: document.getElementById('item-full-data').value,
            };

            const world = worldsConfig[worldId];
            let category = null;
            for (const catKey in world.categories) {
                if (catKey === categoryId) {
                    category = world.categories[catKey];
                    break;
                }
                if (world.categories[catKey].subcategories && world.categories[catKey].subcategories[categoryId]) {
                    category = world.categories[catKey].subcategories[categoryId];
                    break;
                }
            }

            if (category && category.items_url) {
                const items = await fetchItems(category.items_url);
                if (item) {
                    // editing
                    const index = items.findIndex(i => i.name === item.name);
                    if (index !== -1) {
                        items[index] = newItem;
                    }
                } else {
                    // creating
                    items.push(newItem);
                }
                await saveFile(category.items_url, items);
                renderItemsForCategory(worldId, categoryId);
                document.body.removeChild(modal);
            }
        });
    }

    async function renderItemsForCategory(worldId, categoryId) {
        const container = document.getElementById('item-editor-container');
        const world = worldsConfig[worldId];
        let category = null;

        for (const catKey in world.categories) {
            if (catKey === categoryId) {
                category = world.categories[catKey];
                break;
            }
            if (world.categories[catKey].subcategories && world.categories[catKey].subcategories[categoryId]) {
                category = world.categories[catKey].subcategories[categoryId];
                break;
            }
        }

        if (category && category.items_url) {
            const items = await fetchItems(category.items_url);
            if (items) {
                container.innerHTML = '<button id="add-item-btn">Добавить элемент</button>';
                document.getElementById('add-item-btn').addEventListener('click', () => {
                    openItemEditorModal(null, worldId, categoryId);
                });

                items.forEach((item, index) => {
                    const itemElement = document.createElement('div');
                    itemElement.className = 'item-editor-item';
                    itemElement.innerHTML = `
                        <span>${item.name}</span>
                        <div class="item-actions">
                            <button class="editor-edit-btn">✎</button>
                            <button class="editor-delete-btn">Удалить</button>
                        </div>
                    `;
                    container.appendChild(itemElement);

                    itemElement.querySelector('.editor-delete-btn').addEventListener('click', () => {
                        items.splice(index, 1);
                        renderItemsForCategory(worldId, categoryId);
                    });

                    itemElement.querySelector('.editor-edit-btn').addEventListener('click', () => {
                        openItemEditorModal(item, worldId, categoryId);
                    });
                });
            }
        } else {
            container.innerHTML = '<p>Нет элементов для отображения.</p>';
        }
    }
}

main().catch(error => console.error('Ошибка при инициализации приложения:', error));
