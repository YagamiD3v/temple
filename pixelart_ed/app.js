// Variables globales
        const canvas = document.getElementById('pixelCanvas');
        const ctx = canvas.getContext('2d');
        
        // Configuration de la grille
        let PIXEL_SIZE = 20;
        const GRID_COLOR = '#ddd';
        const SELECTION_COLOR = 'rgba(255, 0, 0, 0.3)';
        const SELECTION_BORDER = '#ff0000';
        
        // Système d'historique
        const MAX_HISTORY = 5000;
        const undoStack = [];
        const redoStack = [];
        
        function saveToHistory() {
            // Créer une copie de l'état actuel
            const currentState = new Map(pixelStates);
            
            // Ajouter au stack d'annulation
            undoStack.push(currentState);
            
            // Limiter la taille de l'historique
            if (undoStack.length > MAX_HISTORY) {
                undoStack.shift();
            }
            
            // Vider le stack de rétablissement
            redoStack.length = 0;
        }
        
        function undo() {
            if (undoStack.length === 0) return;
            
            // Sauvegarder l'état actuel pour le redo
            const currentState = new Map(pixelStates);
            redoStack.push(currentState);
            
            // Restaurer l'état précédent
            const previousState = undoStack.pop();
            pixelStates = new Map(previousState);
            
            drawGrid();
        }
        
        function redo() {
            if (redoStack.length === 0) return;
            
            // Sauvegarder l'état actuel pour le undo
            const currentState = new Map(pixelStates);
            undoStack.push(currentState);
            
            // Restaurer l'état suivant
            const nextState = redoStack.pop();
            pixelStates = new Map(nextState);
            
            drawGrid();
        }

        // État de la grille
        let gridWidth = 64;
        let gridHeight = 32;
        let pixelStates = new Map();
        let viewOffsetX = 50;
        let viewOffsetY = 200; // Offset initial pour éviter la barre d'outils

        // État des outils
        let currentTool = 'draw';
        let isMouseDown = false;
        let isDrawing = false;
        let drawMode = null;

        // Sélection
        let isSelecting = false;
        let selectionStart = null;
        let selectionEnd = null;
        let hasSelection = false;

        // Déplacement
        let isPanning = false;
        let panStart = { x: 0, y: 0 };
        let panStartOffset = { x: 0, y: 0 };
        let spaceKeyPressed = false;
        let previousTool = 'draw';

        // Couleurs et palette
        let primaryColor = '#000000';
        let secondaryColor = '#ffffff';
        let colorPalette = [
            '#000000', '#ffffff', '#ff0000', '#00ff00',
            '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
            '#800000', '#008000', '#000080', '#808000',
            '#800080', '#008080', '#c0c0c0', '#808080'
        ];
        let paletteVisible = false;
        let colorSelection = 'primary'; // 'primary' ou 'secondary'
        let editingColorIndex = -1;

        // Variables pour la roue de couleur
        let colorWheelCanvas = null;
        let colorWheelCtx = null;
        let currentHue = 0;
        let currentSaturation = 100;
        let currentBrightness = 100;
        let isDraggingWheel = false;
        let isDraggingBrightness = false;

        // Sauvegarde/chargement depuis localStorage
        function saveSettings() {
            const settings = {
                pixelSize: PIXEL_SIZE,
                gridWidth: gridWidth,
                gridHeight: gridHeight,
                colorPalette: colorPalette,
                primaryColor: primaryColor,
                secondaryColor: secondaryColor,
                viewOffsetY: viewOffsetY
            };
            localStorage.setItem('pixelArtSettings', JSON.stringify(settings));
        }

        function loadSettings() {
            const savedSettings = localStorage.getItem('pixelArtSettings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                PIXEL_SIZE = settings.pixelSize || 20;
                gridWidth = settings.gridWidth || 64;
                gridHeight = settings.gridHeight || 32;
                colorPalette = settings.colorPalette || colorPalette;
                primaryColor = settings.primaryColor || '#000000';
                secondaryColor = settings.secondaryColor || '#ffffff';
                viewOffsetY = settings.viewOffsetY || 50;
                
                // Mettre à jour l'interface
                document.getElementById('pixelSizeSlider').value = PIXEL_SIZE;
                document.getElementById('pixelSizeValue').textContent = PIXEL_SIZE + 'px';
                document.getElementById('gridWidthInput').value = gridWidth;
                document.getElementById('gridHeightInput').value = gridHeight;
            }
        }

        // Changer la taille des pixels
        function changePixelSize(size) {
            PIXEL_SIZE = parseInt(size);
            document.getElementById('pixelSizeValue').textContent = size + 'px';
            drawGrid();
            saveSettings();
        }

        function changeGridSize(width, height) {
            // Sauvegarder l'état actuel
            const oldWidth = gridWidth;
            const oldHeight = gridHeight;
            const oldPixels = new Map(pixelStates);
            
            gridWidth = parseInt(width) || 800;
            gridHeight = parseInt(height) || 800;
            
            // Réinitialiser pixelStates avec les nouvelles dimensions
            pixelStates = new Map();
            
            // Copier les pixels existants dans la nouvelle grille
            for (const [key, color] of oldPixels) {
                const oldY = Math.floor(key / oldWidth);
                const oldX = key % oldWidth;
                if (oldX < gridWidth && oldY < gridHeight) {
                    const newKey = oldY * gridWidth + oldX;
                    pixelStates.set(newKey, color);
                }
            }
            
            drawGrid();
            saveSettings();
        }

        // Initialisation du canvas
        function initCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            
            // Empêcher le menu contextuel
            canvas.addEventListener('contextmenu', e => e.preventDefault());
            
            loadSettings();
            // Mettre à jour les inputs de taille de grille avec les valeurs actuelles
            document.getElementById('gridWidthInput').value = gridWidth;
            document.getElementById('gridHeightInput').value = gridHeight;
            
            initPalette();
            initColorWheel();
            updateColorIndicators();
            drawGrid();
        }

        // Initialiser la roue de couleur
        function initColorWheel() {
            colorWheelCanvas = document.getElementById('colorWheel');
            colorWheelCtx = colorWheelCanvas.getContext('2d');
            drawColorWheel();
            setupColorWheelEvents();
            setupBrightnessSlider();
        }

        // Dessiner la roue de couleur
        function drawColorWheel() {
            const centerX = colorWheelCanvas.width / 2;
            const centerY = colorWheelCanvas.height / 2;
            const radius = Math.min(centerX, centerY) - 10;

            colorWheelCtx.clearRect(0, 0, colorWheelCanvas.width, colorWheelCanvas.height);

            // Dessiner la roue
            for (let angle = 0; angle < 360; angle += 1) {
                const startAngle = (angle - 1) * Math.PI / 180;
                const endAngle = angle * Math.PI / 180;

                for (let r = 0; r < radius; r += 1) {
                    const saturation = r / radius * 100;
                    const hsl = `hsl(${angle}, ${saturation}%, 50%)`;

                    colorWheelCtx.beginPath();
                    colorWheelCtx.arc(centerX, centerY, r, startAngle, endAngle);
                    colorWheelCtx.strokeStyle = hsl;
                    colorWheelCtx.lineWidth = 1;
                    colorWheelCtx.stroke();
                }
            }
        }

        // Configuration des événements de la roue de couleur
        function setupColorWheelEvents() {
            colorWheelCanvas.addEventListener('mousedown', (e) => {
                isDraggingWheel = true;
                updateColorFromWheel(e);
            });

            colorWheelCanvas.addEventListener('mousemove', (e) => {
                if (isDraggingWheel) {
                    updateColorFromWheel(e);
                }
            });

            colorWheelCanvas.addEventListener('mouseup', () => {
                isDraggingWheel = false;
            });

            colorWheelCanvas.addEventListener('mouseleave', () => {
                isDraggingWheel = false;
            });
        }

        // Mettre à jour la couleur depuis la roue
        function updateColorFromWheel(e) {
            const rect = colorWheelCanvas.getBoundingClientRect();
            const x = e.clientX - rect.left - colorWheelCanvas.width / 2;
            const y = e.clientY - rect.top - colorWheelCanvas.height / 2;

            const angle = Math.atan2(y, x) * 180 / Math.PI;
            const distance = Math.sqrt(x * x + y * y);
            const maxRadius = Math.min(colorWheelCanvas.width, colorWheelCanvas.height) / 2 - 10;

            currentHue = (angle + 360) % 360;
            currentSaturation = Math.min(distance / maxRadius * 100, 100);

            updateColorFromHSB();
            updateColorWheelPointer();
        }

        // Configuration du slider de luminosité
        function setupBrightnessSlider() {
            const brightnessSlider = document.getElementById('brightnessSlider');
            
            brightnessSlider.addEventListener('mousedown', (e) => {
                isDraggingBrightness = true;
                updateBrightnessFromSlider(e);
            });

            brightnessSlider.addEventListener('mousemove', (e) => {
                if (isDraggingBrightness) {
                    updateBrightnessFromSlider(e);
                }
            });

            brightnessSlider.addEventListener('mouseup', () => {
                isDraggingBrightness = false;
            });

            brightnessSlider.addEventListener('mouseleave', () => {
                isDraggingBrightness = false;
            });

            updateBrightnessSliderBackground();
        }

        // Mettre à jour la luminosité depuis le slider
        function updateBrightnessFromSlider(e) {
            const rect = document.getElementById('brightnessSlider').getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            
            currentBrightness = percentage * 100;
            updateColorFromHSB();
            updateBrightnessPointer();
        }

        // Mettre à jour la couleur depuis HSB
        function updateColorFromHSB() {
            const rgb = hsbToRgb(currentHue, currentSaturation, currentBrightness);
            const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

            // Mettre à jour les contrôles RGB
            document.getElementById('redSlider').value = rgb.r;
            document.getElementById('redInput').value = rgb.r;
            document.getElementById('greenSlider').value = rgb.g;
            document.getElementById('greenInput').value = rgb.g;
            document.getElementById('blueSlider').value = rgb.b;
            document.getElementById('blueInput').value = rgb.b;
            document.getElementById('hexInput').value = hex;
            document.getElementById('colorPreview').style.backgroundColor = hex;

            updateBrightnessSliderBackground();
        }

        // Mettre à jour le pointeur de la roue de couleur
        function updateColorWheelPointer() {
            const centerX = colorWheelCanvas.width / 2;
            const centerY = colorWheelCanvas.height / 2;
            const maxRadius = Math.min(centerX, centerY) - 10;
            const radius = (currentSaturation / 100) * maxRadius;
            const angle = currentHue * Math.PI / 180;

            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const pointer = document.getElementById('colorWheelPointer');
            pointer.style.left = x + 'px';
            pointer.style.top = y + 'px';
        }

        // Mettre à jour le pointeur de luminosité
        function updateBrightnessPointer() {
            const slider = document.getElementById('brightnessSlider');
            const pointer = document.getElementById('brightnessPointer');
            const percentage = currentBrightness / 100;
            
            pointer.style.left = (percentage * slider.offsetWidth) + 'px';
        }

        // Mettre à jour l'arrière-plan du slider de luminosité
        function updateBrightnessSliderBackground() {
            const slider = document.getElementById('brightnessSlider');
            const darkColor = hsbToRgb(currentHue, currentSaturation, 0);
            const lightColor = hsbToRgb(currentHue, currentSaturation, 100);
            const darkHex = rgbToHex(darkColor.r, darkColor.g, darkColor.b);
            const lightHex = rgbToHex(lightColor.r, lightColor.g, lightColor.b);
            
            slider.style.background = `linear-gradient(to right, ${darkHex}, ${lightHex})`;
        }

        // Conversion HSB vers RGB
        function hsbToRgb(h, s, b) {
            s /= 100;
            b /= 100;
            const k = (n) => (n + h / 60) % 6;
            const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
            return {
                r: Math.round(255 * f(5)),
                g: Math.round(255 * f(3)),
                b: Math.round(255 * f(1))
            };
        }

        // Conversion RGB vers HSB
        function rgbToHsb(r, g, b) {
            r /= 255;
            g /= 255;
            b /= 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const diff = max - min;
            
            let h = 0;
            if (diff !== 0) {
                if (max === r) {
                    h = ((g - b) / diff) % 6;
                } else if (max === g) {
                    h = (b - r) / diff + 2;
                } else {
                    h = (r - g) / diff + 4;
                }
            }
            h = Math.round(h * 60);
            if (h < 0) h += 360;
            
            const s = max === 0 ? 0 : Math.round((diff / max) * 100);
            const brightness = Math.round(max * 100);
            
            return { h, s, b: brightness };
        }

        // Mettre à jour HSB depuis RGB
        function updateHsbFromRgb(r, g, b) {
            const hsb = rgbToHsb(r, g, b);
            currentHue = hsb.h;
            currentSaturation = hsb.s;
            currentBrightness = hsb.b;
            
            updateColorWheelPointer();
            updateBrightnessPointer();
            updateBrightnessSliderBackground();
        }

        // Fonction de pot de peinture (flood fill)
        function floodFill(startCol, startRow, newColor) {
            const startPixelId = startRow * gridWidth + startCol;
            const originalColor = pixelStates.get(startPixelId) || '#ffffff';
            
            // Si la couleur est déjà la bonne, ne rien faire
            if (originalColor === newColor) return;
            
            let hasChanges = false;
            const stack = [{ col: startCol, row: startRow }];
            const visited = new Set();
            
            // Sauvegarder l'état avant de commencer le remplissage
            saveToHistory();
            
            while (stack.length > 0) {
                const { col, row } = stack.pop();
                const pixelId = row * gridWidth + col;
                
                // Vérifier les limites
                if (col < 0 || col >= gridWidth || row < 0 || row >= gridHeight) continue;
                
                // Vérifier si déjà visité
                if (visited.has(pixelId)) continue;
                visited.add(pixelId);
                
                // Vérifier si la couleur correspond
                const currentColor = pixelStates.get(pixelId) || '#ffffff';
                if (currentColor !== originalColor) continue;
                
                // Colorier le pixel (sans sauvegarder dans l'historique)
                setPixelColor(col, row, newColor, true);
                hasChanges = true;
                
                // Ajouter les voisins à la pile
                stack.push({ col: col + 1, row });
                stack.push({ col: col - 1, row });
                stack.push({ col, row: row + 1 });
                stack.push({ col, row: row - 1 });
            }

            // Si aucun changement n'a été fait, retirer l'état sauvegardé
            if (!hasChanges) {
                undoStack.pop();
            }
        }
        
        // Fonction pipette pour récupérer une couleur
        function pickColor(col, row) {
            if (col < 0 || col >= gridWidth || row < 0 || row >= gridHeight) return;
            
            const pixelId = row * gridWidth + col;
            const color = pixelStates.get(pixelId) || '#ffffff';
            
            return color;
        }

        // Basculer l'état d'un pixel
        function setPixelColor(col, row, color, skipHistory = false) {
            if (col < 0 || col >= gridWidth || row < 0 || row >= gridHeight) return;
            
            const pixelId = row * gridWidth + col;
            const oldColor = pixelStates.get(pixelId);
            
            // Ne changer la couleur que si elle est différente
            if (oldColor !== color) {
                if (!skipHistory) {
                    saveToHistory();
                }
                pixelStates.set(pixelId, color);
                return true; // indique qu'un changement a eu lieu
            }
            return false; // aucun changement
        }

        // Initialiser la palette
        function initPalette() {
            const colorGrid = document.getElementById('colorGrid');
            colorGrid.innerHTML = '';
            
            colorPalette.forEach((color, index) => {
                const colorDiv = document.createElement('div');
                colorDiv.className = 'palette-color';
                colorDiv.style.backgroundColor = color;
                colorDiv.onclick = (e) => selectPaletteColor(index, e);
                colorDiv.ondblclick = () => editColor(index);
                colorGrid.appendChild(colorDiv);
            });
            
            // Bouton ajouter couleur
            const addBtn = document.createElement('div');
            addBtn.className = 'add-color-btn';
            addBtn.innerHTML = '+';
            addBtn.onclick = addNewColor;
            colorGrid.appendChild(addBtn);
            
            updatePaletteSelection();
        }

        // Mettre à jour les indicateurs de couleur
        function updateColorIndicators() {
            document.getElementById('primaryColor').style.backgroundColor = primaryColor;
            document.getElementById('secondaryColor').style.backgroundColor = secondaryColor;
        }

        // Mettre à jour la sélection dans la palette
        function updatePaletteSelection() {
            document.querySelectorAll('.palette-color').forEach((elem, index) => {
                elem.classList.remove('primary-selected', 'secondary-selected', 'both-selected');
                
                const isPrimary = colorPalette[index] === primaryColor;
                const isSecondary = colorPalette[index] === secondaryColor;
                
                if (isPrimary && isSecondary) {
                    elem.classList.add('both-selected');
                } else if (isPrimary) {
                    elem.classList.add('primary-selected');
                } else if (isSecondary) {
                    elem.classList.add('secondary-selected');
                }
            });
        }

        // Sélectionner une couleur de la palette
        function selectPaletteColor(index, event) {
            const color = colorPalette[index];
            
            if (colorSelection === 'primary') {
                primaryColor = color;
            } else {
                secondaryColor = color;
            }
            
            updateColorIndicators();
            updatePaletteSelection();
            saveSettings();
        }

        // Changer le type de sélection de couleur
        function setColorSelection(type) {
            colorSelection = type;
            
            document.getElementById('primaryBtn').classList.toggle('active', type === 'primary');
            document.getElementById('secondaryBtn').classList.toggle('active', type === 'secondary');
        }

        // Sélection directe des couleurs depuis les indicateurs
        function selectPrimaryColor() {
            if (paletteVisible) {
                setColorSelection('primary');
            } else {
                togglePalette();
                setColorSelection('primary');
            }
        }

        function selectSecondaryColor() {
            if (paletteVisible) {
                setColorSelection('secondary');
            } else {
                togglePalette();
                setColorSelection('secondary');
            }
        }

        // Échanger les couleurs primaire et secondaire
        function swapColors() {
            const temp = primaryColor;
            primaryColor = secondaryColor;
            secondaryColor = temp;
            updateColorIndicators();
            updatePaletteSelection();
            saveSettings();
        }

        // Toggle palette
        function togglePalette() {
            paletteVisible = !paletteVisible;
            document.getElementById('paletteOverlay').style.display = paletteVisible ? 'flex' : 'none';
            
            if (paletteVisible) {
                updatePaletteSelection();
            }
        }

        // Ajouter une nouvelle couleur
        function addNewColor() {
            editingColorIndex = colorPalette.length;
            editColor(editingColorIndex, '#ff0000');
        }

        // Éditer une couleur
        function editColor(index, defaultColor = null) {
            editingColorIndex = index;
            const color = defaultColor || colorPalette[index];
            
            // Extraire RGB
            const rgb = hexToRgb(color);
            
            // Mettre à jour les contrôles RGB
            document.getElementById('redSlider').value = rgb.r;
            document.getElementById('redInput').value = rgb.r;
            document.getElementById('greenSlider').value = rgb.g;
            document.getElementById('greenInput').value = rgb.g;
            document.getElementById('blueSlider').value = rgb.b;
            document.getElementById('blueInput').value = rgb.b;
            document.getElementById('hexInput').value = color;
            document.getElementById('colorPreview').style.backgroundColor = color;
            
            // Mettre à jour HSB et la roue de couleur
            updateHsbFromRgb(rgb.r, rgb.g, rgb.b);
            
            // Montrer/cacher le bouton supprimer
            document.getElementById('deleteColorBtn').style.display = 
                index < colorPalette.length ? 'inline-block' : 'none';
            
            document.getElementById('colorEditor').classList.add('active');
            
            // Ajouter les event listeners
            setupColorEditor();
        }

        // Configuration de l'éditeur de couleur
        function setupColorEditor() {
            const updateColorFromRgb = () => {
                const r = parseInt(document.getElementById('redSlider').value);
                const g = parseInt(document.getElementById('greenSlider').value);
                const b = parseInt(document.getElementById('blueSlider').value);
                
                const hex = rgbToHex(r, g, b);
                
                document.getElementById('redInput').value = r;
                document.getElementById('greenInput').value = g;
                document.getElementById('blueInput').value = b;
                document.getElementById('hexInput').value = hex;
                document.getElementById('colorPreview').style.backgroundColor = hex;
                
                updateHsbFromRgb(r, g, b);
            };
            
            // Sliders
            document.getElementById('redSlider').oninput = updateColorFromRgb;
            document.getElementById('greenSlider').oninput = updateColorFromRgb;
            document.getElementById('blueSlider').oninput = updateColorFromRgb;
            
            // Number inputs
            document.getElementById('redInput').oninput = () => {
                document.getElementById('redSlider').value = document.getElementById('redInput').value;
                updateColorFromRgb();
            };
            document.getElementById('greenInput').oninput = () => {
                document.getElementById('greenSlider').value = document.getElementById('greenInput').value;
                updateColorFromRgb();
            };
            document.getElementById('blueInput').oninput = () => {
                document.getElementById('blueSlider').value = document.getElementById('blueInput').value;
                updateColorFromRgb();
            };
            
            // Hex input
            document.getElementById('hexInput').oninput = () => {
                const hex = document.getElementById('hexInput').value;
                if (hex.match(/^#[0-9A-Fa-f]{6}$/)) {
                    const rgb = hexToRgb(hex);
                    document.getElementById('redSlider').value = rgb.r;
                    document.getElementById('greenSlider').value = rgb.g;
                    document.getElementById('blueSlider').value = rgb.b;
                    updateColorFromRgb();
                }
            };
        }

        // Sauvegarder la couleur éditée
        function saveColor() {
            const hex = document.getElementById('hexInput').value;
            
            if (editingColorIndex >= colorPalette.length) {
                colorPalette.push(hex);
            } else {
                colorPalette[editingColorIndex] = hex;
            }
            
            saveSettings();
            initPalette();
            cancelColorEdit();
        }

        // Annuler l'édition
        function cancelColorEdit() {
            document.getElementById('colorEditor').classList.remove('active');
            editingColorIndex = -1;
        }

        // Supprimer une couleur
        function deleteColor() {
            if (editingColorIndex >= 0 && editingColorIndex < colorPalette.length) {
                colorPalette.splice(editingColorIndex, 1);
                saveSettings();
                initPalette();
                cancelColorEdit();
            }
        }

        // Utilitaires de couleur
        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        function rgbToHex(r, g, b) {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        }

        // Dessiner la grille
        function drawGrid() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculer les limites visibles
            const startCol = Math.max(0, Math.floor(-viewOffsetX / PIXEL_SIZE));
            const endCol = Math.min(gridWidth, Math.ceil((canvas.width - viewOffsetX) / PIXEL_SIZE));
            const startRow = Math.max(0, Math.floor(-viewOffsetY / PIXEL_SIZE));
            const endRow = Math.min(gridHeight, Math.ceil((canvas.height - viewOffsetY) / PIXEL_SIZE));

            // Dessiner les pixels
            for (let row = startRow; row < endRow; row++) {
                for (let col = startCol; col < endCol; col++) {
                    const x = col * PIXEL_SIZE + viewOffsetX;
                    const y = row * PIXEL_SIZE + viewOffsetY;
                    const pixelId = row * gridWidth + col;
                    
                    // Couleur du pixel
                    ctx.fillStyle = pixelStates.get(pixelId) || '#ffffff';
                    ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
                    
                    // Bordure
                    ctx.strokeStyle = GRID_COLOR;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
                }
            }

            // Dessiner la sélection
            if (hasSelection && selectionStart && selectionEnd) {
                drawSelection();
            }
        }

        // Dessiner la sélection
        function drawSelection() {
            const startCol = Math.min(selectionStart.col, selectionEnd.col);
            const endCol = Math.max(selectionStart.col, selectionEnd.col);
            const startRow = Math.min(selectionStart.row, selectionEnd.row);
            const endRow = Math.max(selectionStart.row, selectionEnd.row);

            const x = startCol * PIXEL_SIZE + viewOffsetX;
            const y = startRow * PIXEL_SIZE + viewOffsetY;
            const width = (endCol - startCol + 1) * PIXEL_SIZE;
            const height = (endRow - startRow + 1) * PIXEL_SIZE;

            // Fond de sélection
            ctx.fillStyle = SELECTION_COLOR;
            ctx.fillRect(x, y, width, height);

            // Bordure en pointillés
            ctx.strokeStyle = SELECTION_BORDER;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, width, height);
            ctx.setLineDash([]);
        }

        // Convertir les coordonnées écran en coordonnées grille
        function screenToGrid(screenX, screenY) {
            const rect = canvas.getBoundingClientRect();
            const canvasX = screenX - rect.left;
            const canvasY = screenY - rect.top;
            
            const gridX = Math.floor((canvasX - viewOffsetX) / PIXEL_SIZE);
            const gridY = Math.floor((canvasY - viewOffsetY) / PIXEL_SIZE);
            
            return { 
                col: gridX, 
                row: gridY,
                valid: gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight
            };
        }

        // Variables pour suivre les changements pendant le dessin
        let drawingChanged = false;
        let lastDrawPosition = null;

        // Fonction pour tracer une ligne entre deux points
        function drawLine(x0, y0, x1, y1, color) {
            const dx = Math.abs(x1 - x0);
            const dy = Math.abs(y1 - y0);
            const sx = (x0 < x1) ? 1 : -1;
            const sy = (y0 < y1) ? 1 : -1;
            let err = dx - dy;

            while (true) {
                if (setPixelColor(x0, y0, color, true)) {
                    drawingChanged = true;
                }

                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x0 += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y0 += sy;
                }
            }
        }
        
        // Gestion des événements souris
        canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isMouseDown = true;
            drawingChanged = false;
            
            const gridPos = screenToGrid(e.clientX, e.clientY);
            if (!gridPos.valid) return;

            if (currentTool === 'draw' || currentTool === 'eraser') {
                isDrawing = true;
                
                // Déterminer la couleur selon l'outil et le bouton de souris
                if (currentTool === 'eraser') {
                    currentDrawColor = '#ffffff'; // Toujours blanc pour la gomme
                } else {
                    currentDrawColor = e.button === 2 ? secondaryColor : primaryColor;
                }
                
                // Premier pixel sans sauvegarder l'historique
                if (setPixelColor(gridPos.col, gridPos.row, currentDrawColor, true)) {
                    drawingChanged = true;
                }
                lastDrawPosition = gridPos;
                drawGrid();
                
            } else if (currentTool === 'bucket') {
                // Pot de peinture
                const fillColor = e.button === 2 ? secondaryColor : primaryColor;
                floodFill(gridPos.col, gridPos.row, fillColor);
                drawGrid();
                
            } else if (currentTool === 'eyedropper') {
                // Pipette
                const pickedColor = pickColor(gridPos.col, gridPos.row);
                if (pickedColor) {
                    if (e.button === 2) {
                        secondaryColor = pickedColor;
                    } else {
                        primaryColor = pickedColor;
                    }
                    updateColorIndicators();
                    updatePaletteSelection();
                    saveSettings();
                }
                
            } else if (currentTool === 'select') {
                startSelection(gridPos);
                
            } else if (currentTool === 'pan') {
                startPanning(e);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            const gridPos = screenToGrid(e.clientX, e.clientY);
            
            if ((currentTool === 'draw' || currentTool === 'eraser') && isMouseDown && isDrawing && gridPos.valid) {
                // Tracer une ligne depuis la dernière position jusqu'à la position actuelle
                if (lastDrawPosition && (lastDrawPosition.col !== gridPos.col || lastDrawPosition.row !== gridPos.row)) {
                    drawLine(lastDrawPosition.col, lastDrawPosition.row, gridPos.col, gridPos.row, currentDrawColor);
                }
                lastDrawPosition = gridPos;
                drawGrid();
                
            } else if (currentTool === 'eyedropper' && isMouseDown && gridPos.valid) {
                // Pipette continue pendant le glissement
                const pickedColor = pickColor(gridPos.col, gridPos.row);
                if (pickedColor) {
                    if (currentDrawColor === secondaryColor) {
                        secondaryColor = pickedColor;
                    } else {
                        primaryColor = pickedColor;
                    }
                    updateColorIndicators();
                    updatePaletteSelection();
                }
                
            } else if (currentTool === 'select' && isSelecting && gridPos.valid) {
                updateSelection(gridPos);
                
            } else if (currentTool === 'pan' && isPanning) {
                updatePanning(e);
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            if (currentTool === 'select' && isSelecting) {
                endSelection();
            } else if (currentTool === 'pan' && isPanning) {
                endPanning();
            } else if (currentTool === 'eyedropper') {
                // Sauvegarder les paramètres après utilisation de la pipette
                saveSettings();
            }
            
            // Si on était en train de dessiner et qu'il y a eu des changements, sauvegarder l'historique
            if (isDrawing && drawingChanged) {
                saveToHistory();
            }
            
            isMouseDown = false;
            isDrawing = false;
            currentDrawColor = null;
            drawingChanged = false;
            lastDrawPosition = null;
        });

        // Événement pour le clic droit
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Fonctions de sélection
        function startSelection(gridPos) {
            clearSelection();
            isSelecting = true;
            selectionStart = { col: gridPos.col, row: gridPos.row };
            selectionEnd = { col: gridPos.col, row: gridPos.row };
            hasSelection = true;
            drawGrid();
        }

        function updateSelection(gridPos) {
            if (!isSelecting) return;
            
            selectionEnd = { col: gridPos.col, row: gridPos.row };
            drawGrid();
            
            // Mettre à jour l'info de sélection
            const startCol = Math.min(selectionStart.col, selectionEnd.col);
            const endCol = Math.max(selectionStart.col, selectionEnd.col);
            const startRow = Math.min(selectionStart.row, selectionEnd.row);
            const endRow = Math.max(selectionStart.row, selectionEnd.row);
            const width = endCol - startCol + 1;
            const height = endRow - startRow + 1;
            
            document.getElementById('selectionInfo').textContent = `Sélection: ${width}×${height} pixels`;
            document.getElementById('selectionInfo').style.display = 'block';
        }

        function endSelection() {
            isSelecting = false;
            if (hasSelection) {
                document.getElementById('deleteBtn').style.display = 'inline-block';
            }
        }

        function clearSelection() {
            hasSelection = false;
            isSelecting = false;
            selectionStart = null;
            selectionEnd = null;
            document.getElementById('selectionInfo').style.display = 'none';
            document.getElementById('deleteBtn').style.display = 'none';
            drawGrid();
        }

        function deleteSelected() {
            if (!hasSelection || !selectionStart || !selectionEnd) return;
            
            const startCol = Math.min(selectionStart.col, selectionEnd.col);
            const endCol = Math.max(selectionStart.col, selectionEnd.col);
            const startRow = Math.min(selectionStart.row, selectionEnd.row);
            const endRow = Math.max(selectionStart.row, selectionEnd.row);

            let hasChanges = false;
            // Sauvegarder l'état avant de commencer la suppression
            saveToHistory();
            
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    const pixelId = row * gridWidth + col;
                    const oldColor = pixelStates.get(pixelId);
                    if (oldColor !== '#ffffff') {
                        pixelStates.set(pixelId, '#ffffff');
                        hasChanges = true;
                    }
                }
            }
            
            // Si aucun changement n'a été fait, retirer l'état sauvegardé
            if (!hasChanges) {
                undoStack.pop();
            }
            
            clearSelection();
            drawGrid();
        }

        // Remplir la sélection avec une couleur
        function fillSelection(color) {
            if (!hasSelection || !selectionStart || !selectionEnd) return;
            
            const startCol = Math.min(selectionStart.col, selectionEnd.col);
            const endCol = Math.max(selectionStart.col, selectionEnd.col);
            const startRow = Math.min(selectionStart.row, selectionEnd.row);
            const endRow = Math.max(selectionStart.row, selectionEnd.row);

            let hasChanges = false;
            saveToHistory();

            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    if (setPixelColor(col, row, color, true)) {
                        hasChanges = true;
                    }
                }
            }

            if (!hasChanges) {
                undoStack.pop();
            }
            
            drawGrid();
        }

        // Fonctions de déplacement
        function startPanning(e) {
            isPanning = true;
            canvas.classList.add('panning');
            panStart = { x: e.clientX, y: e.clientY };
            panStartOffset = { x: viewOffsetX, y: viewOffsetY };
        }

        function updatePanning(e) {
            if (!isPanning) return;
            
            const deltaX = e.clientX - panStart.x;
            const deltaY = e.clientY - panStart.y;
            
            viewOffsetX = panStartOffset.x + deltaX;
            viewOffsetY = panStartOffset.y + deltaY;
            
            // Limiter le déplacement pour éviter de sortir complètement de la grille
            const margin = PIXEL_SIZE * 5; // Marge pour garder une partie de la grille visible
            const maxOffsetX = window.innerWidth - margin;
            const maxOffsetY = window.innerHeight - margin;
            const minOffsetX = -(gridWidth * PIXEL_SIZE) + margin;
            const minOffsetY = -(gridHeight * PIXEL_SIZE) + margin;
            
            // S'assurer que la grille reste toujours accessible
            viewOffsetX = Math.max(minOffsetX, Math.min(maxOffsetX, viewOffsetX));
            viewOffsetY = Math.max(minOffsetY, Math.min(maxOffsetY, viewOffsetY));
            
            drawGrid();
        }

        function endPanning() {
            isPanning = false;
            canvas.classList.remove('panning');
        }

        // Changer d'outil
        function setTool(tool) {
            currentTool = tool;
            clearSelection();
            endPanning();
            
            // Mettre à jour l'interface
            document.querySelectorAll('.controls button').forEach(btn => btn.classList.remove('active'));
            const toolButton = document.getElementById(tool + 'Tool');
            if (toolButton) {
                toolButton.classList.add('active');
            }
            
            // Mettre à jour le curseur du canvas
            canvas.classList.remove('pan-mode', 'panning');
            if (tool === 'pan') {
                canvas.classList.add('pan-mode');
            }
            
            // Mettre à jour les indicateurs
            const modeIndicator = document.getElementById('modeIndicator');
            const modeInfo = document.getElementById('modeInfo');
            
            if (tool === 'draw') {
                modeIndicator.textContent = 'Mode: Crayon';
                modeInfo.textContent = 'Mode crayon : Clic gauche/droit pour dessiner';
                canvas.style.cursor = 'crosshair';
            } else if (tool === 'eraser') {
                modeIndicator.textContent = 'Mode: Gomme';
                modeInfo.textContent = 'Mode gomme : Cliquer pour effacer';
                canvas.style.cursor = 'crosshair';
            } else if (tool === 'bucket') {
                modeIndicator.textContent = 'Mode: Pot de peinture';
                modeInfo.textContent = 'Mode pot de peinture : Clic pour remplir une zone';
                canvas.style.cursor = 'crosshair';
            } else if (tool === 'eyedropper') {
                modeIndicator.textContent = 'Mode: Pipette';
                modeInfo.textContent = 'Mode pipette : Clic pour récupérer une couleur';
                canvas.style.cursor = 'crosshair';
            } else if (tool === 'select') {
                modeIndicator.textContent = 'Mode: Sélection';
                modeInfo.textContent = 'Mode sélection : Glissez pour sélectionner une zone';
                canvas.style.cursor = 'default';
            } else if (tool === 'pan') {
                modeIndicator.textContent = 'Mode: Déplacement';
                modeInfo.textContent = 'Mode déplacement : Cliquez-glissez pour déplacer la vue';
                canvas.style.cursor = 'grab';
            }
        }

        // Autres fonctions
        function clearGrid() {
            // Ne sauvegarder dans l'historique que s'il y a des pixels non blancs
            let hasNonWhitePixels = false;
            for (const [pixelId, color] of pixelStates) {
                if (color !== '#ffffff') {
                    hasNonWhitePixels = true;
                    break;
                }
            }

            if (hasNonWhitePixels) {
                saveToHistory();
                pixelStates = new Map(); // Créer une nouvelle Map vide plutôt que clear()
                clearSelection();
                drawGrid();
            }
        }

        function expandGrid() {
            // Sauvegarder l'état actuel
            const oldWidth = gridWidth;
            const oldHeight = gridHeight;
            const oldPixels = new Map(pixelStates);
            
            // Augmenter la taille
            gridWidth += 20;
            gridHeight += 20;
            
            // Recalculer les positions des pixels existants
            pixelStates.clear();
            for (let row = 0; row < oldHeight; row++) {
                for (let col = 0; col < oldWidth; col++) {
                    const oldId = row * oldWidth + col;
                    const color = oldPixels.get(oldId);
                    if (color) {
                        const newId = row * gridWidth + col;
                        pixelStates.set(newId, color);
                    }
                }
            }
            
            saveSettings();
            drawGrid();
        }

        // Redimensionnement du canvas
        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            drawGrid();
        });

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (e.key === 'd' || e.key === 'D') {
                setTool('draw');
            } else if (e.key === 'b' || e.key === 'B') {
                setTool('bucket');
            } else if (e.key === 'i' || e.key === 'I') {
                setTool('eyedropper');
            } else if (e.key === 's' || e.key === 'S') {
                setTool('select');
            } else if ((e.key === 'z' || e.key === 'Z') && e.ctrlKey) {
                e.preventDefault();
                undo();
            } else if ((e.key === 'y' || e.key === 'Y') && e.ctrlKey) {
                e.preventDefault();
                redo();
            } else if (e.key === 'p' || e.key === 'P') {
                e.preventDefault();
                togglePalette();
            } else if (e.key === 'x' || e.key === 'X') {
                e.preventDefault();
                swapColors();
            } else if (e.key === ' ') {
                e.preventDefault();
                if (!spaceKeyPressed) {
                    spaceKeyPressed = true;
                    if (currentTool !== 'pan') {
                        previousTool = currentTool;
                        setTool('pan');
                    }
                }
            } else if (e.key === 'Delete' && hasSelection) {
                deleteSelected();
            } else if (e.key === 'Escape') {
                if (paletteVisible) {
                    togglePalette();
                } else {
                    clearSelection();
                }
            } else if (e.key === 'f' || e.key === 'F') {
                if (hasSelection) {
                    fillSelection(colorSelection === 'primary' ? primaryColor : secondaryColor);
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                if (spaceKeyPressed) {
                    spaceKeyPressed = false;
                    if (currentTool === 'pan') {
                        setTool(previousTool);
                    }
                }
            }
        });

        // Empêcher le scroll avec espace
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
            }
        });

        // Fermer la palette en cliquant à l'extérieur
        document.getElementById('paletteOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('paletteOverlay')) {
                togglePalette();
            }
        });

        // Initialisation
        initCanvas();
        // Sauvegarder l'état initial vide
        saveToHistory();
        setTool('draw');