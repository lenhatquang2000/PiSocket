// ==================== SUB-MAP EDITOR (Map Con - Có giới hạn) ====================
export const submapCanvas = document.getElementById('submap-canvas');
export const submapCtx = submapCanvas.getContext('2d');

export let submapState = {
    name: '',
    width: 20,
    height: 20,
    tileSize: 32,
    gridType: 'square', // 'square' or 'isometric'
    zoom: 1,
    panX: 0,
    panY: 0,
    isPanning: false,
    panMode: false,
    freeMode: false,
    eraseMode: false,
    moveMode: false, // Move object mode
    pixelMove: false, // Move by pixel (no snap to grid)
    selectedTile: null,
    selectedTileImg: null,
    selectedObject: null, // Selected object for rotation
    isDraggingObject: false, // Is dragging an object
    dragOffsetX: 0, // Drag offset X
    dragOffsetY: 0, // Drag offset Y
    isPainting: false, // Is painting (drag to paint)
    lastPaintedCell: null, // Last painted cell {x, y} to prevent duplicates
    editorMode: 'ground',
    objects: [], // { x, y, path, img, isFree, rotation, placementLayer }
    isCreated: false,
    lastPanX: 0,
    lastPanY: 0,
    rotation: 0 // Canvas rotation angle (0 or 45)
};

export const setSubmapEditorMode = (mode) => {
    submapState.editorMode = mode;
    submapState.selectedTile = null;
    submapState.selectedTileImg = null;
    submapState.selectedObject = null;
    submapState.isPainting = false;
    submapState.lastPaintedCell = null;
    document.querySelectorAll('#submap-tab .obj-item, #submapobjects-tab .obj-item').forEach(item => {
        item.style.border = '2px solid transparent';
    });
    const panel = document.getElementById('objectRotationPanel');
    if (panel) panel.style.display = 'none';
    drawSubmap();
};

const getObjectPlacementLayer = (obj) => {
    if (obj.placementLayer) return obj.placementLayer;
    return obj.path && obj.path.startsWith('/assets/Map/topdown/') ? 'ground' : 'objects';
};

export const setupSubmapEditor = () => {
    // Load tiles for submap editor
    const submapTopdownList = document.getElementById('submap-topdown-list');
    const submapObjectTilesList = document.getElementById('submap-object-tiles-list');
    const submapObjectDesertList = document.getElementById('submap-object-desert-list');
    const submapObjectForestList = document.getElementById('submap-object-forest-list');
    const loadSubmapForObjectsBtn = document.getElementById('loadSubmapForObjectsBtn');
    
    // Load ALL Map2 tiles from server
    fetch('http://localhost:3000/get-map2-tiles')
        .then(res => res.json())
        .then(data => {
            console.log(`Loading ${data.tiles.length} tiles from Map2 folder`);
            data.tiles.forEach(path => {
                createSubmapItem(path, submapObjectTilesList, 'objects');
            });
        })
        .catch(err => {
            console.error('Error loading Map2 tiles:', err);
            // Fallback to hardcoded list if server fails
            const mapAssets = [
                '/assets/Map/Map2/north.png',
                '/assets/Map/Map2/north-east.png',
                '/assets/Map/Map2/east.png',
                '/assets/Map/Map2/south-east.png',
                '/assets/Map/Map2/south.png',
                '/assets/Map/Map2/south-west.png',
                '/assets/Map/Map2/west.png',
                '/assets/Map/Map2/north-west.png',
            ];
            mapAssets.forEach(path => {
                createSubmapItem(path, submapObjectTilesList, 'objects');
            });
        });
    
    // Load desert objects
    for (let i = 0; i < 12; i++) {
        const path = `/assets/Object/desert/desert_obj_${i}.png`;
        createSubmapItem(path, submapObjectDesertList, 'objects');
    }
    
    // Load topdown assets from server
    fetch('http://localhost:3000/get-topdown-tiles')
        .then(res => res.json())
        .then(data => {
            console.log(`Loading ${data.tiles.length} topdown tiles`);
            data.tiles.forEach(path => {
                createSubmapItem(path, submapTopdownList, 'ground');
            });
        })
        .catch(err => {
            console.error('Error loading topdown tiles:', err);
            // Fallback to hardcoded list if server fails
            const topdownAssets = [
                '/assets/Map/topdown/bo_gc_ng_i_t.png',
                '/assets/Map/topdown/bo_gc_ng_i.png',
                '/assets/Map/topdown/bo_gc_vng_nccs.png',
                '/assets/Map/topdown/fcc11c2a.png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc.png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (1).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (2).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (3).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (4).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (5).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (6).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (7).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (8).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (9).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (10).png',
                '/assets/Map/topdown/to_cho_ti_assets_nn_c_tc (11).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l.png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (1).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (2).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (3).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (4).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (5).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (6).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (7).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (8).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (9).png',
                '/assets/Map/topdown/to_cho_ti_mt_s_assets_l (10).png',
            ];
            topdownAssets.forEach(path => {
                createSubmapItem(path, submapTopdownList, 'ground');
            });
        });
    
    // Load forest objects
    for (let i = 0; i < 16; i++) {
        const path = `/assets/Object/Forest/forest_obj_${i}.png`;
        createSubmapItem(path, submapObjectForestList, 'objects');
    }
    
    refreshSubmapObjectLoadList();
    if (loadSubmapForObjectsBtn) {
        loadSubmapForObjectsBtn.onclick = loadSelectedSubmapForObjects;
    }
    
    // Auto-create map when inputs change
    const submapWidthInput = document.getElementById('submapWidth');
    const submapHeightInput = document.getElementById('submapHeight');
    const submapTileSizeInput = document.getElementById('submapTileSize');
    const submapGridTypeSelect = document.getElementById('submapGridType');
    
    submapWidthInput.oninput = () => autoUpdateSubmap();
    submapHeightInput.oninput = () => autoUpdateSubmap();
    submapTileSizeInput.oninput = () => autoUpdateSubmap();
    submapGridTypeSelect.onchange = () => {
        submapState.gridType = submapGridTypeSelect.value;
        autoUpdateSubmap();
    };
    
    // Create submap button
    document.getElementById('createSubmapBtn').onclick = createSubmap;
    document.getElementById('resetSubmapBtn').onclick = resetSubmap;
    
    // Zoom control
    const submapZoomInput = document.getElementById('submapZoom');
    const submapZoomValueDisplay = document.getElementById('submapZoomValue');
    submapZoomInput.oninput = (e) => {
        submapState.zoom = parseFloat(e.target.value);
        submapZoomValueDisplay.textContent = Math.round(submapState.zoom * 100) + '%';
        drawSubmap();
    };
    
    // Erase mode button
    document.getElementById('submapEraseBtn').onclick = () => {
        submapState.eraseMode = !submapState.eraseMode;
        submapState.panMode = false;
        submapState.freeMode = false;
        submapState.moveMode = false;
        document.getElementById('submapEraseBtn').style.background = submapState.eraseMode ? '#e67e22' : '#e74c3c';
        document.getElementById('submapFreeBtn').style.background = '#9b59b6';
        document.getElementById('submapMoveBtn').style.background = '#3498db';
        submapCanvas.style.cursor = submapState.eraseMode ? 'not-allowed' : 'crosshair';
    };
    
    // Move mode button
    document.getElementById('submapMoveBtn').onclick = () => {
        submapState.moveMode = !submapState.moveMode;
        submapState.panMode = false;
        submapState.freeMode = false;
        submapState.eraseMode = false;
        document.getElementById('submapMoveBtn').style.background = submapState.moveMode ? '#e67e22' : '#3498db';
        document.getElementById('submapEraseBtn').style.background = '#e74c3c';
        document.getElementById('submapFreeBtn').style.background = '#9b59b6';
        submapCanvas.style.cursor = submapState.moveMode ? 'pointer' : 'crosshair';
    };
    
    // Free placement mode button
    document.getElementById('submapFreeBtn').onclick = () => {
        submapState.freeMode = !submapState.freeMode;
        submapState.panMode = false;
        submapState.eraseMode = false;
        submapState.moveMode = false;
        document.getElementById('submapFreeBtn').style.background = submapState.freeMode ? '#e67e22' : '#9b59b6';
        document.getElementById('submapEraseBtn').style.background = '#e74c3c';
        document.getElementById('submapMoveBtn').style.background = '#3498db';
        submapCanvas.style.cursor = 'crosshair';
    };
    
    // Rotation input
    const rotationInput = document.getElementById('submapRotationInput');
    rotationInput.oninput = (e) => {
        submapState.rotation = parseFloat(e.target.value) || 0;
        drawSubmap();
    };
    
    // Object rotation input
    const objectRotationInput = document.getElementById('objectRotationInput');
    objectRotationInput.oninput = (e) => {
        if (submapState.selectedObject) {
            submapState.selectedObject.rotation = parseFloat(e.target.value) || 0;
            drawSubmap();
        }
    };
    
    // Pixel move checkbox
    const pixelMoveCheckbox = document.getElementById('pixelMoveCheckbox');
    pixelMoveCheckbox.onchange = (e) => {
        submapState.pixelMove = e.target.checked;
        console.log('Pixel move mode:', submapState.pixelMove);
    };
    
    // Deselect object button
    document.getElementById('deselectObjectBtn').onclick = () => {
        submapState.selectedObject = null;
        document.getElementById('objectRotationPanel').style.display = 'none';
        drawSubmap();
    };
    
    // Save submap button
    document.getElementById('saveSubmapBtn').onclick = saveSubmap;
    
    // Canvas mouse events
    submapCanvas.onmousedown = onSubmapMouseDown;
    submapCanvas.onmousemove = onSubmapMouseMove;
    submapCanvas.onmouseup = onSubmapMouseUp;
    submapCanvas.onwheel = onSubmapWheel;
    
    // Space key for pan mode
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !submapState.panMode) {
            e.preventDefault();
            submapState.panMode = true;
            submapCanvas.style.cursor = 'grab';
        }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space' && submapState.panMode) {
            e.preventDefault();
            submapState.panMode = false;
            submapCanvas.style.cursor = submapState.eraseMode ? 'not-allowed' : 'crosshair';
        }
    });
    
    // Initialize canvas
    submapCanvas.width = window.innerWidth - 320;
    submapCanvas.height = window.innerHeight;
    autoUpdateSubmap();
};

const createSubmapItem = (path, parent, placementLayer) => {
    if (!parent) return;
    const div = document.createElement('div');
    div.className = 'obj-item';
    div.dataset.placementLayer = placementLayer;
    const label = path.split('/').pop();
    div.innerHTML = `<img src="${path}"><span>${label}</span>`;
    div.onclick = (e) => selectSubmapTile(path, placementLayer, e);
    parent.appendChild(div);
};

const selectSubmapTile = (path, placementLayer, e) => {
    if (submapState.editorMode !== placementLayer) {
        return;
    }
    submapState.selectedTile = path;
    const img = new Image();
    img.onload = () => {
        submapState.selectedTileImg = img;
    };
    img.src = path;
    
    // Visual feedback
    document.querySelectorAll('#submap-tab .obj-item, #submapobjects-tab .obj-item').forEach(item => {
        item.style.border = '2px solid transparent';
    });
    e.currentTarget.style.border = '2px solid #1abc9c';
};

const refreshSubmapObjectLoadList = async () => {
    const select = document.getElementById('submapObjectLoadSelect');
    if (!select) return;
    
    try {
        const response = await fetch('http://localhost:3000/get-submaps');
        const result = await response.json();
        const submaps = result.submaps || [];
        
        select.innerHTML = '';
        if (submaps.length === 0) {
            select.innerHTML = '<option value="">Chưa có sub-map nào</option>';
            return;
        }
        
        submaps.forEach((submap, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `${submap.name} (${submap.width}x${submap.height})`;
            select.appendChild(option);
        });
        select._submaps = submaps;
    } catch (err) {
        console.error('Error loading submaps:', err);
        select.innerHTML = '<option value="">Lỗi tải danh sách</option>';
    }
};

const loadSelectedSubmapForObjects = async () => {
    const select = document.getElementById('submapObjectLoadSelect');
    if (!select || !select._submaps || !select.value) {
        Swal.fire({
            icon: 'warning',
            title: 'Chưa chọn Sub-Map!',
            text: 'Vui lòng chọn sub-map đã lưu để đặt object.',
            timer: 1500,
            showConfirmButton: false
        });
        return;
    }
    
    const submap = select._submaps[parseInt(select.value, 10)];
    if (!submap) return;
    
    submapState.name = submap.name;
    submapState.width = submap.width;
    submapState.height = submap.height;
    submapState.tileSize = submap.tileSize || 32;
    submapState.gridType = submap.gridType || 'square';
    submapState.zoom = 1;
    submapState.isCreated = true;
    submapState.editorMode = 'objects';
    submapState.selectedTile = null;
    submapState.selectedTileImg = null;
    submapState.selectedObject = null;
    submapState.objects = await Promise.all((submap.objects || []).map(loadSubmapObjectImage));
    
    document.getElementById('submapName').value = submapState.name;
    document.getElementById('submapWidth').value = submapState.width;
    document.getElementById('submapHeight').value = submapState.height;
    document.getElementById('submapTileSize').value = submapState.tileSize;
    document.getElementById('submapGridType').value = submapState.gridType;
    
    submapState.panX = (submapCanvas.width - submapState.width * submapState.tileSize) / 2;
    submapState.panY = (submapCanvas.height - submapState.height * submapState.tileSize) / 2;
    
    drawSubmap();
    
    Swal.fire({
        icon: 'success',
        title: 'Đã load Sub-Map!',
        text: `"${submapState.name}" đã sẵn sàng để đặt object.`,
        timer: 1500,
        showConfirmButton: false
    });
};

const loadSubmapObjectImage = (obj) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({
        ...obj,
        img,
        placementLayer: getObjectPlacementLayer(obj)
    });
    img.onerror = () => resolve({
        ...obj,
        img: null,
        placementLayer: getObjectPlacementLayer(obj)
    });
    img.src = obj.path;
});

const createSubmap = () => {
    const name = document.getElementById('submapName').value.trim();
    if (!name) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi!',
            text: 'Vui lòng nhập tên map!',
        });
        return;
    }
    
    submapState.name = name;
    submapState.width = parseInt(document.getElementById('submapWidth').value);
    submapState.height = parseInt(document.getElementById('submapHeight').value);
    submapState.tileSize = parseInt(document.getElementById('submapTileSize').value);
    submapState.objects = [];
    submapState.zoom = 1;
    submapState.isCreated = true;
    
    // Set canvas size to full screen
    submapCanvas.width = window.innerWidth - 320;
    submapCanvas.height = window.innerHeight;
    
    // Center the map
    submapState.panX = (submapCanvas.width - submapState.width * submapState.tileSize) / 2;
    submapState.panY = (submapCanvas.height - submapState.height * submapState.tileSize) / 2;
    
    drawSubmap();
    
    Swal.fire({
        icon: 'success',
        title: 'Map Con đã được tạo!',
        text: `"${name}" - Kích thước: ${submapState.width}x${submapState.height} tiles`,
        timer: 1500,
        showConfirmButton: false
    });
};

// Auto update when inputs change
const autoUpdateSubmap = () => {
    const width = parseInt(document.getElementById('submapWidth').value) || 20;
    const height = parseInt(document.getElementById('submapHeight').value) || 20;
    const tileSize = parseInt(document.getElementById('submapTileSize').value) || 32;
    const gridType = document.getElementById('submapGridType').value;
    
    submapState.width = width;
    submapState.height = height;
    submapState.tileSize = tileSize;
    submapState.gridType = gridType;
    submapState.isCreated = true;
    
    // Center the map - always use square space
    submapState.panX = (submapCanvas.width - width * tileSize) / 2;
    submapState.panY = (submapCanvas.height - height * tileSize) / 2;
    
    drawSubmap();
};

const resetSubmap = () => {
    submapState.objects = [];
    submapState.isCreated = false;
    submapState.name = '';
    document.getElementById('submapName').value = '';
    submapCtx.clearRect(0, 0, submapCanvas.width, submapCanvas.height);
    
    Swal.fire({
        icon: 'info',
        title: 'Đã reset!',
        text: 'Có thể tạo map con mới',
        timer: 1500,
        showConfirmButton: false
    });
};

const drawSubmap = () => {
    if (!submapState.isCreated) return;
    
    submapCtx.clearRect(0, 0, submapCanvas.width, submapCanvas.height);
    
    const tileSize = submapState.tileSize * submapState.zoom;
    
    // Draw boundary FIRST (without rotation) - red border stays fixed
    submapCtx.strokeStyle = '#e74c3c';
    submapCtx.lineWidth = 3;
    submapCtx.strokeRect(
        submapState.panX,
        submapState.panY,
        submapState.width * tileSize,
        submapState.height * tileSize
    );
    
    // Draw grid lines with rotation (inside the fixed boundary)
    submapCtx.save();
    if (submapState.rotation !== 0) {
        const centerX = submapState.panX + (submapState.width * tileSize) / 2;
        const centerY = submapState.panY + (submapState.height * tileSize) / 2;
        submapCtx.translate(centerX, centerY);
        submapCtx.rotate(submapState.rotation * Math.PI / 180);
        submapCtx.translate(-centerX, -centerY);
    }
    
    // Draw grid lines only (no boundary)
    if (submapState.gridType === 'isometric') {
        drawIsometricGridLines(tileSize);
    } else {
        drawSquareGridLines(tileSize);
    }
    
    submapCtx.restore();
    
    // Draw objects WITHOUT rotation (always upright)
    [...submapState.objects].sort((a, b) => {
        const layerA = getObjectPlacementLayer(a) === 'objects' ? 1 : 0;
        const layerB = getObjectPlacementLayer(b) === 'objects' ? 1 : 0;
        return layerA - layerB;
    }).forEach(obj => {
        if (obj.img && obj.img.complete) {
            let screenX, screenY;
            
            if (obj.isFree) {
                // Free placement - use exact pixel coordinates
                screenX = obj.x * submapState.zoom + submapState.panX;
                screenY = obj.y * submapState.zoom + submapState.panY;
            } else {
                // Grid placement
                if (obj.gridType === 'isometric') {
                    // Isometric grid - place at diamond grid position (45-degree rotated)
                    const mapWidth = submapState.width * tileSize;
                    const mapHeight = submapState.height * tileSize;
                    const centerX = mapWidth / 2;
                    const centerY = mapHeight / 2;
                    
                    screenX = centerX + (obj.x * tileSize / 2) + submapState.panX;
                    screenY = centerY + (obj.y * tileSize / 2) + submapState.panY;
                } else {
                    // Square grid - use standard coordinates
                    screenX = obj.x * tileSize + submapState.panX;
                    screenY = obj.y * tileSize + submapState.panY;
                }
            }
            
            // Use original image size (not scaled by tile size)
            const drawWidth = obj.img.width * submapState.zoom;
            const drawHeight = obj.img.height * submapState.zoom;
            
            // Apply object rotation if exists
            if (obj.rotation && obj.rotation !== 0) {
                submapCtx.save();
                submapCtx.translate(screenX + drawWidth / 2, screenY + drawHeight / 2);
                submapCtx.rotate(obj.rotation * Math.PI / 180);
                submapCtx.drawImage(obj.img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
                submapCtx.restore();
            } else {
                submapCtx.drawImage(obj.img, screenX, screenY, drawWidth, drawHeight);
            }
            
            // Draw indicator for free-placed objects
            if (obj.isFree) {
                submapCtx.strokeStyle = '#9b59b6';
                submapCtx.lineWidth = 2;
                submapCtx.strokeRect(screenX, screenY, drawWidth, drawHeight);
            }
            
            // Draw selection indicator
            if (submapState.selectedObject === obj) {
                submapCtx.strokeStyle = '#f39c12';
                submapCtx.lineWidth = 3;
                submapCtx.strokeRect(screenX - 2, screenY - 2, drawWidth + 4, drawHeight + 4);
            }
        }
    });
    
    // Draw map info at top-left corner (outside rotation, always readable)
    submapCtx.fillStyle = '#ecf0f1';
    submapCtx.font = 'bold 16px Arial';
    const gridLabel = submapState.gridType === 'isometric' ? 'Diagonal Grid' : 'Square Grid';
    const rotationLabel = submapState.rotation !== 0 ? ` (Rotated ${submapState.rotation}°)` : '';
    submapCtx.fillText(`Map: ${submapState.width}x${submapState.height} tiles (${gridLabel}${rotationLabel})`, 10, 30);
};

// Draw square grid lines only (no boundary)
const drawSquareGridLines = (tileSize) => {
    // Draw grid lines
    submapCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    submapCtx.lineWidth = 1;
    
    for (let x = 0; x <= submapState.width; x++) {
        const screenX = x * tileSize + submapState.panX;
        submapCtx.beginPath();
        submapCtx.moveTo(screenX, submapState.panY);
        submapCtx.lineTo(screenX, submapState.height * tileSize + submapState.panY);
        submapCtx.stroke();
    }
    
    for (let y = 0; y <= submapState.height; y++) {
        const screenY = y * tileSize + submapState.panY;
        submapCtx.beginPath();
        submapCtx.moveTo(submapState.panX, screenY);
        submapCtx.lineTo(submapState.width * tileSize + submapState.panX, screenY);
        submapCtx.stroke();
    }
    
    // Draw axis labels (X, Y coordinates)
    submapCtx.fillStyle = '#3498db';
    submapCtx.font = 'bold 14px Arial';
    
    // X axis labels (every 5 tiles)
    for (let x = 0; x <= submapState.width; x += 5) {
        const screenX = x * tileSize + submapState.panX;
        submapCtx.fillText(`X:${x}`, screenX + 2, submapState.panY - 5);
    }
    
    // Y axis labels (every 5 tiles)
    for (let y = 0; y <= submapState.height; y += 5) {
        const screenY = y * tileSize + submapState.panY;
        submapCtx.fillText(`Y:${y}`, submapState.panX - 40, screenY + 15);
    }
};

// Draw square grid
const drawSquareGrid = (tileSize) => {
    // Draw boundary (red border)
    submapCtx.strokeStyle = '#e74c3c';
    submapCtx.lineWidth = 3;
    submapCtx.strokeRect(
        submapState.panX,
        submapState.panY,
        submapState.width * tileSize,
        submapState.height * tileSize
    );
    
    drawSquareGridLines(tileSize);
};

// Draw isometric grid lines only (no boundary)
const drawIsometricGridLines = (tileSize) => {
    // Draw diagonal grid lines
    submapCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    submapCtx.lineWidth = 1;
    
    const mapWidth = submapState.width * tileSize;
    const mapHeight = submapState.height * tileSize;
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    
    // Draw diamond grid (rotated 45 degrees)
    // Vertical lines of the rotated grid (going from top-left to bottom-right)
    for (let i = 0; i <= submapState.width + submapState.height; i++) {
        submapCtx.beginPath();
        const offset = (i - submapState.width) * tileSize / 2;
        submapCtx.moveTo(
            centerX + offset + submapState.panX,
            submapState.panY
        );
        submapCtx.lineTo(
            centerX + offset + submapState.panX,
            mapHeight + submapState.panY
        );
        submapCtx.stroke();
    }
    
    // Horizontal lines of the rotated grid (going from top-right to bottom-left)
    for (let i = 0; i <= submapState.width + submapState.height; i++) {
        submapCtx.beginPath();
        const offset = (i - submapState.height) * tileSize / 2;
        submapCtx.moveTo(
            submapState.panX,
            centerY + offset + submapState.panY
        );
        submapCtx.lineTo(
            mapWidth + submapState.panX,
            centerY + offset + submapState.panY
        );
        submapCtx.stroke();
    }
    
    // Draw axis labels (X, Y coordinates) - still rectangular
    submapCtx.fillStyle = '#3498db';
    submapCtx.font = 'bold 14px Arial';
    
    // X axis labels (every 5 tiles)
    for (let x = 0; x <= submapState.width; x += 5) {
        const screenX = x * tileSize + submapState.panX;
        submapCtx.fillText(`X:${x}`, screenX + 2, submapState.panY - 5);
    }
    
    // Y axis labels (every 5 tiles)
    for (let y = 0; y <= submapState.height; y += 5) {
        const screenY = y * tileSize + submapState.panY;
        submapCtx.fillText(`Y:${y}`, submapState.panX - 40, screenY + 15);
    }
};

// Draw isometric grid (simple 45-degree rotated square grid)
const drawIsometricGrid = (tileSize) => {
    // Draw square boundary (red border) - space is still rectangular
    submapCtx.strokeStyle = '#e74c3c';
    submapCtx.lineWidth = 3;
    submapCtx.strokeRect(
        submapState.panX,
        submapState.panY,
        submapState.width * tileSize,
        submapState.height * tileSize
    );
    
    drawIsometricGridLines(tileSize);
};

// Convert grid coordinates to isometric screen coordinates
const gridToIso = (gridX, gridY, tileSize) => {
    return {
        x: (gridX - gridY) * tileSize / 2,
        y: (gridX + gridY) * tileSize / 4
    };
};

// Convert isometric screen coordinates to grid coordinates
const isoToGrid = (isoX, isoY, tileSize) => {
    const gridX = Math.floor((isoX / (tileSize / 2) + isoY / (tileSize / 4)) / 2);
    const gridY = Math.floor((isoY / (tileSize / 4) - isoX / (tileSize / 2)) / 2);
    return { x: gridX, y: gridY };
};

// Track mouse position and show coordinates
let submapMouseX = 0;
let submapMouseY = 0;

// Helper function to place object at mouse position (used for both click and drag-to-paint)
const placeObjectAtMouse = (mouseX, mouseY) => {
    if (!submapState.isCreated) return;
    
    const tileSize = submapState.tileSize * submapState.zoom;
    
    if (submapState.freeMode) {
        // Free placement mode - place at exact pixel position
        const worldX = (mouseX - submapState.panX) / submapState.zoom;
        const worldY = (mouseY - submapState.panY) / submapState.zoom;
        
        if (submapState.selectedTileImg) {
            // Add new object at free position
            submapState.objects.push({
                x: worldX,
                y: worldY,
                path: submapState.selectedTile,
                img: submapState.selectedTileImg,
                isFree: true,
                placementLayer: submapState.editorMode,
                rotation: 0
            });
            drawSubmap();
        }
    } else {
        // Grid placement mode
        let gridX, gridY;
        
        if (submapState.gridType === 'isometric') {
            // Isometric grid - snap to diamond grid (45-degree rotated)
            const mapWidth = submapState.width * tileSize;
            const mapHeight = submapState.height * tileSize;
            const centerX = mapWidth / 2;
            const centerY = mapHeight / 2;
            
            const relativeX = (mouseX - submapState.panX - centerX) / (tileSize / 2);
            const relativeY = (mouseY - submapState.panY - centerY) / (tileSize / 2);
            
            // Snap to nearest diamond grid intersection
            gridX = Math.round(relativeX);
            gridY = Math.round(relativeY);
        } else {
            // Square grid - snap to square tiles
            gridX = Math.floor((mouseX - submapState.panX) / tileSize);
            gridY = Math.floor((mouseY - submapState.panY) / tileSize);
        }
        
        // Check if this cell was already painted (prevent duplicates during drag)
        if (submapState.lastPaintedCell && 
            submapState.lastPaintedCell.x === gridX && 
            submapState.lastPaintedCell.y === gridY) {
            return; // Skip if already painted this cell
        }
        
        // Update last painted cell
        submapState.lastPaintedCell = { x: gridX, y: gridY };
        
        // Check bounds based on grid type
        let inBounds;
        if (submapState.gridType === 'isometric') {
            // Isometric grid allows negative coordinates (centered at 0,0)
            inBounds = gridX >= -submapState.height && gridX <= submapState.width &&
                       gridY >= -submapState.height && gridY <= submapState.width;
        } else {
            // Square grid: 0 to width, 0 to height
            inBounds = gridX >= 0 && gridX < submapState.width && gridY >= 0 && gridY < submapState.height;
        }
        
        if (inBounds) {
            if (submapState.eraseMode) {
                // Remove objects at this grid position
                submapState.objects = submapState.objects.filter(obj => 
                    !(obj.x === gridX && obj.y === gridY && !obj.isFree && getObjectPlacementLayer(obj) === submapState.editorMode)
                );
            } else if (submapState.selectedTileImg) {
                // Remove existing grid object at this position
                submapState.objects = submapState.objects.filter(obj => 
                    !(obj.x === gridX && obj.y === gridY && !obj.isFree && getObjectPlacementLayer(obj) === submapState.editorMode)
                );
                
                // Add new object
                submapState.objects.push({
                    x: gridX,
                    y: gridY,
                    path: submapState.selectedTile,
                    img: submapState.selectedTileImg,
                    isFree: false,
                    gridType: submapState.gridType, // Store grid type for rendering
                    placementLayer: submapState.editorMode,
                    rotation: 0
                });
            }
            drawSubmap();
        }
    }
};

const onSubmapMouseDown = (e) => {
    if (!submapState.isCreated) return;
    
    const rect = submapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Check if clicking on selected object to drag it
    if (submapState.selectedObject) {
        const tileSize = submapState.tileSize * submapState.zoom;
        const obj = submapState.selectedObject;
        let screenX, screenY;
        
        if (obj.isFree) {
            screenX = obj.x * submapState.zoom + submapState.panX;
            screenY = obj.y * submapState.zoom + submapState.panY;
        } else {
            if (obj.gridType === 'isometric') {
                const mapWidth = submapState.width * tileSize;
                const mapHeight = submapState.height * tileSize;
                const centerX = mapWidth / 2;
                const centerY = mapHeight / 2;
                screenX = centerX + (obj.x * tileSize / 2) + submapState.panX;
                screenY = centerY + (obj.y * tileSize / 2) + submapState.panY;
            } else {
                screenX = obj.x * tileSize + submapState.panX;
                screenY = obj.y * tileSize + submapState.panY;
            }
        }
        
        const drawWidth = obj.img.width * submapState.zoom;
        const drawHeight = obj.img.height * submapState.zoom;
        
        if (mouseX >= screenX && mouseX <= screenX + drawWidth &&
            mouseY >= screenY && mouseY <= screenY + drawHeight) {
            submapState.isDraggingObject = true;
            submapState.dragOffsetX = mouseX - screenX;
            submapState.dragOffsetY = mouseY - screenY;
            submapCanvas.style.cursor = 'move';
            return;
        }
    }
    
    if (submapState.panMode || e.button === 1) { // Middle mouse button or space key
        submapState.isPanning = true;
        submapState.lastPanX = e.clientX;
        submapState.lastPanY = e.clientY;
        submapCanvas.style.cursor = 'grabbing';
        e.preventDefault();
        return;
    }
    
    // Start painting if a tile is selected and not in move mode
    if (submapState.selectedTileImg && !submapState.moveMode) {
        submapState.isPainting = true;
        submapState.lastPaintedCell = null;
        // Place first object immediately
        placeObjectAtMouse(mouseX, mouseY);
    }
};

const onSubmapMouseMove = (e) => {
    if (!submapState.isCreated) return;
    
    const rect = submapCanvas.getBoundingClientRect();
    submapMouseX = e.clientX - rect.left;
    submapMouseY = e.clientY - rect.top;
    
    // Handle object dragging
    if (submapState.isDraggingObject && submapState.selectedObject) {
        const tileSize = submapState.tileSize * submapState.zoom;
        const obj = submapState.selectedObject;
        
        // Calculate new position
        const newScreenX = submapMouseX - submapState.dragOffsetX;
        const newScreenY = submapMouseY - submapState.dragOffsetY;
        
        if (submapState.pixelMove) {
            // Pixel mode - move by exact pixels (no snap)
            obj.x = (newScreenX - submapState.panX) / submapState.zoom;
            obj.y = (newScreenY - submapState.panY) / submapState.zoom;
            obj.isFree = true; // Mark as free object when moving by pixel
        } else if (obj.isFree) {
            // Free mode - update pixel coordinates
            obj.x = (newScreenX - submapState.panX) / submapState.zoom;
            obj.y = (newScreenY - submapState.panY) / submapState.zoom;
        } else {
            // Grid mode - snap to grid
            if (obj.gridType === 'isometric') {
                const mapWidth = submapState.width * tileSize;
                const mapHeight = submapState.height * tileSize;
                const centerX = mapWidth / 2;
                const centerY = mapHeight / 2;
                
                const relativeX = (newScreenX - submapState.panX - centerX) / (tileSize / 2);
                const relativeY = (newScreenY - submapState.panY - centerY) / (tileSize / 2);
                
                obj.x = Math.round(relativeX);
                obj.y = Math.round(relativeY);
            } else {
                obj.x = Math.floor((newScreenX - submapState.panX) / tileSize);
                obj.y = Math.floor((newScreenY - submapState.panY) / tileSize);
            }
        }
        
        drawSubmap();
        return;
    }
    
    // Handle panning
    if (submapState.isPanning) {
        const dx = e.clientX - submapState.lastPanX;
        const dy = e.clientY - submapState.lastPanY;
        submapState.panX += dx;
        submapState.panY += dy;
        submapState.lastPanX = e.clientX;
        submapState.lastPanY = e.clientY;
        drawSubmap();
        return;
    }
    
    // Handle painting (drag to paint)
    if (submapState.isPainting) {
        placeObjectAtMouse(submapMouseX, submapMouseY);
        return;
    }
    
    const tileSize = submapState.tileSize * submapState.zoom;
    
    let gridX, gridY;
    
    if (submapState.gridType === 'isometric') {
        // Isometric grid - snap to diamond grid
        const mapWidth = submapState.width * tileSize;
        const mapHeight = submapState.height * tileSize;
        const centerX = mapWidth / 2;
        const centerY = mapHeight / 2;
        
        const relativeX = (submapMouseX - submapState.panX - centerX) / (tileSize / 2);
        const relativeY = (submapMouseY - submapState.panY - centerY) / (tileSize / 2);
        
        gridX = Math.round(relativeX);
        gridY = Math.round(relativeY);
    } else {
        // Square grid
        gridX = Math.floor((submapMouseX - submapState.panX) / tileSize);
        gridY = Math.floor((submapMouseY - submapState.panY) / tileSize);
    }
    
    // Redraw to show cursor position
    drawSubmap();
    
    // Draw cursor highlight
    if (gridX >= -submapState.width && gridX <= submapState.width && 
        gridY >= -submapState.height && gridY <= submapState.height) {
        if (submapState.gridType === 'isometric') {
            // Highlight diamond tile (45-degree rotated square)
            const mapWidth = submapState.width * tileSize;
            const mapHeight = submapState.height * tileSize;
            const centerX = mapWidth / 2;
            const centerY = mapHeight / 2;
            
            const screenX = centerX + (gridX * tileSize / 2) + submapState.panX;
            const screenY = centerY + (gridY * tileSize / 2) + submapState.panY;
            
            submapCtx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            submapCtx.beginPath();
            submapCtx.moveTo(screenX, screenY - tileSize / 2);
            submapCtx.lineTo(screenX + tileSize / 2, screenY);
            submapCtx.lineTo(screenX, screenY + tileSize / 2);
            submapCtx.lineTo(screenX - tileSize / 2, screenY);
            submapCtx.closePath();
            submapCtx.fill();
        } else {
            // Highlight square tile
            if (gridX >= 0 && gridX < submapState.width && gridY >= 0 && gridY < submapState.height) {
                submapCtx.fillStyle = 'rgba(255, 255, 0, 0.3)';
                submapCtx.fillRect(
                    gridX * tileSize + submapState.panX,
                    gridY * tileSize + submapState.panY,
                    tileSize,
                    tileSize
                );
            }
        }
        
        // Show coordinates near cursor
        submapCtx.fillStyle = '#f39c12';
        submapCtx.font = 'bold 14px Arial';
        submapCtx.fillText(`(${gridX}, ${gridY})`, submapMouseX + 10, submapMouseY - 10);
    }
};

const onSubmapMouseUp = (e) => {
    console.log('=== onSubmapMouseUp ===');
    
    // Stop painting
    if (submapState.isPainting) {
        submapState.isPainting = false;
        submapState.lastPaintedCell = null;
        console.log('Stopped painting');
        return;
    }
    
    // Stop dragging object
    if (submapState.isDraggingObject) {
        submapState.isDraggingObject = false;
        submapCanvas.style.cursor = 'crosshair';
        console.log('Stopped dragging object');
        return;
    }
    
    console.log('isPanning:', submapState.isPanning);
    
    if (submapState.isPanning) {
        submapState.isPanning = false;
        submapCanvas.style.cursor = submapState.panMode ? 'grab' : (submapState.eraseMode ? 'not-allowed' : 'crosshair');
        return;
    }
    
    // Place or erase object
    if (!submapState.isCreated) {
        console.log('Map not created yet!');
        return;
    }
    
    const rect = submapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    console.log('Mouse position:', mouseX, mouseY);
    console.log('Free mode:', submapState.freeMode);
    console.log('Erase mode:', submapState.eraseMode);
    console.log('Selected tile:', submapState.selectedTile);
    console.log('Selected tile img:', submapState.selectedTileImg);
    
    // Check if clicking on existing object to select it
    const tileSize = submapState.tileSize * submapState.zoom;
    let clickedObject = null;
    
    for (let i = submapState.objects.length - 1; i >= 0; i--) {
        const obj = submapState.objects[i];
        if (getObjectPlacementLayer(obj) !== submapState.editorMode) continue;
        let screenX, screenY;
        
        if (obj.isFree) {
            screenX = obj.x * submapState.zoom + submapState.panX;
            screenY = obj.y * submapState.zoom + submapState.panY;
        } else {
            if (obj.gridType === 'isometric') {
                const mapWidth = submapState.width * tileSize;
                const mapHeight = submapState.height * tileSize;
                const centerX = mapWidth / 2;
                const centerY = mapHeight / 2;
                screenX = centerX + (obj.x * tileSize / 2) + submapState.panX;
                screenY = centerY + (obj.y * tileSize / 2) + submapState.panY;
            } else {
                screenX = obj.x * tileSize + submapState.panX;
                screenY = obj.y * tileSize + submapState.panY;
            }
        }
        
        const drawWidth = obj.img.width * submapState.zoom;
        const drawHeight = obj.img.height * submapState.zoom;
        
        if (mouseX >= screenX && mouseX <= screenX + drawWidth &&
            mouseY >= screenY && mouseY <= screenY + drawHeight) {
            clickedObject = obj;
            break;
        }
    }
    
    // If clicked on object and in move mode OR not in erase/place mode, select it
    if (clickedObject && (submapState.moveMode || (!submapState.eraseMode && !submapState.selectedTileImg))) {
        submapState.selectedObject = clickedObject;
        document.getElementById('objectRotationPanel').style.display = 'block';
        document.getElementById('objectRotationInput').value = clickedObject.rotation || 0;
        document.getElementById('pixelMoveCheckbox').checked = false;
        submapState.pixelMove = false;
        console.log('Selected object for rotation/movement');
        drawSubmap();
        return;
    }
    
    // Deselect object if clicking elsewhere
    if (!clickedObject && submapState.selectedObject) {
        submapState.selectedObject = null;
        document.getElementById('objectRotationPanel').style.display = 'none';
    }
    
    if (submapState.freeMode) {
        // Free placement mode - place at exact pixel position
        const worldX = (mouseX - submapState.panX) / submapState.zoom;
        const worldY = (mouseY - submapState.panY) / submapState.zoom;
        
        console.log('Free mode - World position:', worldX, worldY);
        
        if (submapState.selectedTileImg) {
            // Add new object at free position
            submapState.objects.push({
                x: worldX,
                y: worldY,
                path: submapState.selectedTile,
                img: submapState.selectedTileImg,
                isFree: true,
                placementLayer: submapState.editorMode,
                rotation: 0
            });
            console.log('Added free object, total objects:', submapState.objects.length);
            drawSubmap();
        } else {
            console.log('No tile selected!');
        }
    } else {
        // Grid placement mode
        const tileSize = submapState.tileSize * submapState.zoom;
        
        let gridX, gridY;
        
        if (submapState.gridType === 'isometric') {
            // Isometric grid - snap to diamond grid (45-degree rotated)
            const mapWidth = submapState.width * tileSize;
            const mapHeight = submapState.height * tileSize;
            const centerX = mapWidth / 2;
            const centerY = mapHeight / 2;
            
            const relativeX = (mouseX - submapState.panX - centerX) / (tileSize / 2);
            const relativeY = (mouseY - submapState.panY - centerY) / (tileSize / 2);
            
            // Snap to nearest diamond grid intersection
            gridX = Math.round(relativeX);
            gridY = Math.round(relativeY);
            
            console.log('Isometric grid - Grid position:', gridX, gridY);
        } else {
            // Square grid - snap to square tiles
            gridX = Math.floor((mouseX - submapState.panX) / tileSize);
            gridY = Math.floor((mouseY - submapState.panY) / tileSize);
            
            console.log('Square grid - Grid position:', gridX, gridY);
        }
        
        // Check bounds based on grid type
        let inBounds;
        if (submapState.gridType === 'isometric') {
            // Isometric grid allows negative coordinates (centered at 0,0)
            // Valid range: -height to width for both axes
            inBounds = gridX >= -submapState.height && gridX <= submapState.width &&
                       gridY >= -submapState.height && gridY <= submapState.width;
        } else {
            // Square grid: 0 to width, 0 to height
            inBounds = gridX >= 0 && gridX < submapState.width && gridY >= 0 && gridY < submapState.height;
        }
        
        console.log('Grid bounds check:', {
            gridX,
            gridY,
            width: submapState.width,
            height: submapState.height,
            gridType: submapState.gridType,
            inBounds
        });
        
        if (inBounds) {
            if (submapState.eraseMode) {
                // Remove objects at this grid position
                const beforeCount = submapState.objects.length;
                submapState.objects = submapState.objects.filter(obj => 
                    !(obj.x === gridX && obj.y === gridY && !obj.isFree && getObjectPlacementLayer(obj) === submapState.editorMode)
                );
                console.log('Erased objects:', beforeCount - submapState.objects.length);
            } else if (submapState.selectedTileImg) {
                // Remove existing grid object at this position
                submapState.objects = submapState.objects.filter(obj => 
                    !(obj.x === gridX && obj.y === gridY && !obj.isFree && getObjectPlacementLayer(obj) === submapState.editorMode)
                );
                
                // Add new object
                submapState.objects.push({
                    x: gridX,
                    y: gridY,
                    path: submapState.selectedTile,
                    img: submapState.selectedTileImg,
                    isFree: false,
                    gridType: submapState.gridType, // Store grid type for rendering
                    placementLayer: submapState.editorMode,
                    rotation: 0
                });
                console.log('Added grid object, total objects:', submapState.objects.length);
            } else {
                console.log('No tile selected!');
            }
            drawSubmap();
        } else {
            console.log('Click outside grid bounds!');
        }
    }
};

const onSubmapClick = (e) => {
    // This function is no longer used, replaced by onSubmapMouseUp
};

const onSubmapWheel = (e) => {
    if (!submapState.isCreated) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    submapState.zoom = Math.max(0.5, Math.min(3, submapState.zoom + delta));
    document.getElementById('submapZoom').value = submapState.zoom;
    document.getElementById('submapZoomValue').textContent = Math.round(submapState.zoom * 100) + '%';
    drawSubmap();
};

const saveSubmap = async () => {
    if (!submapState.isCreated) {
        Swal.fire({
            icon: 'error',
            title: 'Lỗi!',
            text: 'Chưa tạo map con!',
        });
        return;
    }
    
    const submapData = {
        name: submapState.name,
        width: submapState.width,
        height: submapState.height,
        tileSize: submapState.tileSize,
        gridType: submapState.gridType, // Save grid type
        objects: submapState.objects.map(obj => ({
            x: obj.x,
            y: obj.y,
            path: obj.path,
            isFree: obj.isFree || false,
            gridType: obj.gridType || 'square', // Save object's grid type
            placementLayer: getObjectPlacementLayer(obj),
            rotation: obj.rotation || 0 // Save object rotation
        }))
    };
    
    try {
        const response = await fetch('http://localhost:3000/save-submap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(submapData)
        });
        
        const result = await response.json();
        if (result.message) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: `Map con "${submapState.name}" đã được lưu!`,
                timer: 1500,
                showConfirmButton: false
            });
            
            // Reload worldmap submaps list if available
            if (window.loadWorldmapSubmaps) {
                window.loadWorldmapSubmaps();
            }
        }
    } catch (err) {
        console.error("Lỗi:", err);
        Swal.fire({
            icon: 'error',
            title: 'Lỗi!',
            text: 'Không thể kết nối tới Server.',
        });
    }
};
