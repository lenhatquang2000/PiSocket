// ==================== WORLD MAP COMPOSER (Map Tổng - Vô hạn) ====================
export const worldmapCanvas = document.getElementById('worldmap-canvas');
export const worldmapCtx = worldmapCanvas.getContext('2d');

export let worldmapState = {
    zoom: 0.5,
    panX: 0,
    panY: 0,
    isPanning: false,
    panMode: true,
    placeMode: false,
    spawnMode: false, // Mode to set spawn point
    selectedSubmap: null,
    submaps: [], // Available submaps from server
    placedSubmaps: [], // { submapName, x, y }
    spawnPoint: null, // { x, y } - Player spawn point
    lastPanX: 0,
    lastPanY: 0
};

export const setupWorldmapEditor = () => {
    // Set canvas to full size
    worldmapCanvas.width = window.innerWidth - 320;
    worldmapCanvas.height = window.innerHeight;
    
    // Center the view
    worldmapState.panX = worldmapCanvas.width / 2;
    worldmapState.panY = worldmapCanvas.height / 2;
    
    // Load submaps list
    loadWorldmapSubmaps();
    
    // Load existing worldmap if available
    loadExistingWorldmap();
    
    // Zoom control
    const worldmapZoomInput = document.getElementById('worldmapZoom');
    const worldmapZoomValueDisplay = document.getElementById('worldmapZoomValue');
    worldmapZoomInput.oninput = (e) => {
        worldmapState.zoom = parseFloat(e.target.value);
        worldmapZoomValueDisplay.textContent = Math.round(worldmapState.zoom * 100) + '%';
        drawWorldmap();
    };
    
    // Pan mode button
    document.getElementById('worldmapPanBtn').onclick = () => {
        worldmapState.panMode = true;
        worldmapState.placeMode = false;
        document.getElementById('worldmapPanBtn').classList.add('active');
        document.getElementById('worldmapPlaceBtn').classList.remove('active');
        worldmapCanvas.style.cursor = 'grab';
    };
    
    // Place mode button
    document.getElementById('worldmapPlaceBtn').onclick = () => {
        worldmapState.placeMode = true;
        worldmapState.panMode = false;
        worldmapState.spawnMode = false;
        document.getElementById('worldmapPlaceBtn').classList.add('active');
        document.getElementById('worldmapPanBtn').classList.remove('active');
        document.getElementById('worldmapSpawnBtn').classList.remove('active');
        worldmapCanvas.style.cursor = 'crosshair';
    };
    
    // Spawn point mode button
    document.getElementById('worldmapSpawnBtn').onclick = () => {
        worldmapState.spawnMode = true;
        worldmapState.placeMode = false;
        worldmapState.panMode = false;
        document.getElementById('worldmapSpawnBtn').classList.add('active');
        document.getElementById('worldmapPlaceBtn').classList.remove('active');
        document.getElementById('worldmapPanBtn').classList.remove('active');
        worldmapCanvas.style.cursor = 'crosshair';
    };
    
    // Clear all button
    document.getElementById('worldmapClearBtn').onclick = () => {
        Swal.fire({
            title: 'Xóa tất cả?',
            text: 'Bạn có chắc muốn xóa tất cả map con và spawn point?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#95a5a6',
            confirmButtonText: 'Xóa hết!',
            cancelButtonText: 'Hủy'
        }).then((result) => {
            if (result.isConfirmed) {
                worldmapState.placedSubmaps = [];
                worldmapState.spawnPoint = null;
                drawWorldmap();
                updatePlacedSubmapsList();
                Swal.fire({
                    icon: 'success',
                    title: 'Đã xóa!',
                    text: 'World map đã được reset.',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    };
    
    // Jump to coordinates button
    document.getElementById('worldmapJumpBtn').onclick = () => {
        const x = parseFloat(document.getElementById('worldmapJumpX').value);
        const y = parseFloat(document.getElementById('worldmapJumpY').value);
        
        if (isNaN(x) || isNaN(y)) {
            Swal.fire({
                icon: 'error',
                title: 'Lỗi!',
                text: 'Vui lòng nhập tọa độ hợp lệ',
                timer: 1500,
                showConfirmButton: false
            });
            return;
        }
        
        // Convert world coordinates to screen coordinates and center the view
        worldmapState.panX = worldmapCanvas.width / 2 - x * worldmapState.zoom;
        worldmapState.panY = worldmapCanvas.height / 2 - y * worldmapState.zoom;
        
        drawWorldmap();
        
        Swal.fire({
            icon: 'success',
            title: 'Đã nhảy!',
            text: `Đã nhảy đến (${x}, ${y})`,
            timer: 1000,
            showConfirmButton: false
        });
    };
    
    // Save worldmap button
    document.getElementById('saveWorldmapBtn').onclick = saveWorldmap;
    
    // Canvas mouse events
    worldmapCanvas.onmousedown = onWorldmapMouseDown;
    worldmapCanvas.onmousemove = onWorldmapMouseMove;
    worldmapCanvas.onmouseup = onWorldmapMouseUp;
    worldmapCanvas.onwheel = onWorldmapWheel;
    
    drawWorldmap();
};

export const loadWorldmapSubmaps = async () => {
    try {
        const response = await fetch('http://localhost:3000/get-submaps');
        const result = await response.json();
        worldmapState.submaps = result.submaps || [];
        
        // Update sidebar list
        const list = document.getElementById('worldmap-submaps-list');
        list.innerHTML = '';
        
        worldmapState.submaps.forEach(submap => {
            const div = document.createElement('div');
            div.className = 'obj-item';
            div.innerHTML = `<span>📦 ${submap.name}</span><br><small>${submap.width}x${submap.height}</small>`;
            div.onclick = () => selectWorldmapSubmap(submap, div);
            list.appendChild(div);
        });
    } catch (err) {
        console.error("Lỗi load submaps:", err);
    }
};

// Make it available globally for submap editor
window.loadWorldmapSubmaps = loadWorldmapSubmaps;

const loadExistingWorldmap = async () => {
    try {
        const response = await fetch('http://localhost:3000/get-latest-worldmap');
        if (!response.ok) {
            console.log('No existing worldmap found');
            return;
        }
        
        const result = await response.json();
        const worldmapData = result.worldmap; // Extract worldmap from response
        
        // Load placed submaps
        if (worldmapData.placedSubmaps) {
            worldmapState.placedSubmaps = worldmapData.placedSubmaps;
            console.log(`Loaded ${worldmapData.placedSubmaps.length} placed submaps`);
        }
        
        // Load spawn point
        if (worldmapData.spawnPoint) {
            worldmapState.spawnPoint = worldmapData.spawnPoint;
            console.log('Loaded spawn point:', worldmapData.spawnPoint);
        }
        
        // Redraw canvas
        drawWorldmap();
        
        Swal.fire({
            icon: 'info',
            title: 'World Map đã được load!',
            text: `${worldmapState.placedSubmaps.length} map con${worldmapState.spawnPoint ? ' và spawn point' : ''}`,
            timer: 1500,
            showConfirmButton: false
        });
    } catch (err) {
        console.log('No existing worldmap to load:', err);
    }
};

const selectWorldmapSubmap = (submap, element) => {
    worldmapState.selectedSubmap = submap;
    
    // Visual feedback
    document.querySelectorAll('#worldmap-submaps-list .obj-item').forEach(item => {
        item.style.border = '2px solid transparent';
    });
    element.style.border = '2px solid #1abc9c';
    
    // Auto switch to place mode
    worldmapState.placeMode = true;
    worldmapState.panMode = false;
    document.getElementById('worldmapPlaceBtn').classList.add('active');
    document.getElementById('worldmapPanBtn').classList.remove('active');
    worldmapCanvas.style.cursor = 'crosshair';
};

const drawWorldmap = () => {
    worldmapCtx.clearRect(0, 0, worldmapCanvas.width, worldmapCanvas.height);
    
    // Draw origin crosshair
    worldmapCtx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    worldmapCtx.lineWidth = 2;
    worldmapCtx.beginPath();
    worldmapCtx.moveTo(worldmapState.panX - 50, worldmapState.panY);
    worldmapCtx.lineTo(worldmapState.panX + 50, worldmapState.panY);
    worldmapCtx.moveTo(worldmapState.panX, worldmapState.panY - 50);
    worldmapCtx.lineTo(worldmapState.panX, worldmapState.panY + 50);
    worldmapCtx.stroke();
    
    // Draw placed submaps
    worldmapState.placedSubmaps.forEach((placed, index) => {
        const submap = worldmapState.submaps.find(s => s.name === placed.submapName);
        if (!submap) return;
        
        const screenX = placed.x * worldmapState.zoom + worldmapState.panX;
        const screenY = placed.y * worldmapState.zoom + worldmapState.panY;
        const width = submap.width * submap.tileSize * worldmapState.zoom;
        const height = submap.height * submap.tileSize * worldmapState.zoom;
        
        // Draw submap boundary
        worldmapCtx.strokeStyle = '#3498db';
        worldmapCtx.lineWidth = 2;
        worldmapCtx.strokeRect(screenX, screenY, width, height);
        
        // Draw submap info (name, position, size)
        worldmapCtx.fillStyle = '#3498db';
        worldmapCtx.font = 'bold 14px Arial';
        worldmapCtx.fillText(submap.name, screenX + 5, screenY + 20);
        
        worldmapCtx.font = '12px Arial';
        worldmapCtx.fillText(`Pos: (${Math.round(placed.x)}, ${Math.round(placed.y)})`, screenX + 5, screenY + 35);
        worldmapCtx.fillText(`Size: ${submap.width}x${submap.height} (${submap.width * submap.tileSize}x${submap.height * submap.tileSize}px)`, screenX + 5, screenY + 50);
        
        // Draw objects in submap (simplified for performance)
        const tileSize = submap.tileSize * worldmapState.zoom;
        if (tileSize > 2) { // Only draw if tiles are visible
            submap.objects.forEach(obj => {
                const objScreenX = screenX + obj.x * tileSize;
                const objScreenY = screenY + obj.y * tileSize;
                
                // Draw colored square instead of loading images for performance
                worldmapCtx.fillStyle = '#27ae60';
                worldmapCtx.fillRect(objScreenX, objScreenY, tileSize, tileSize);
            });
        }
    });
    
    // Draw spawn point if set
    if (worldmapState.spawnPoint) {
        const screenX = worldmapState.spawnPoint.x * worldmapState.zoom + worldmapState.panX;
        const screenY = worldmapState.spawnPoint.y * worldmapState.zoom + worldmapState.panY;
        
        // Draw spawn point marker (star shape)
        worldmapCtx.fillStyle = '#f39c12';
        worldmapCtx.strokeStyle = '#e67e22';
        worldmapCtx.lineWidth = 3;
        
        // Draw star
        worldmapCtx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const x = screenX + Math.cos(angle) * 20;
            const y = screenY + Math.sin(angle) * 20;
            if (i === 0) worldmapCtx.moveTo(x, y);
            else worldmapCtx.lineTo(x, y);
        }
        worldmapCtx.closePath();
        worldmapCtx.fill();
        worldmapCtx.stroke();
        
        // Draw label
        worldmapCtx.fillStyle = '#f39c12';
        worldmapCtx.font = 'bold 16px Arial';
        worldmapCtx.fillText('SPAWN', screenX - 30, screenY - 30);
        worldmapCtx.font = '12px Arial';
        worldmapCtx.fillText(`(${Math.round(worldmapState.spawnPoint.x)}, ${Math.round(worldmapState.spawnPoint.y)})`, screenX - 40, screenY - 15);
    }
    
    // Update placed submaps list in sidebar
    updatePlacedSubmapsList();
};

// Update the list of placed submaps in the sidebar
const updatePlacedSubmapsList = () => {
    const list = document.getElementById('worldmapPlacedList');
    if (!list) return;
    
    if (worldmapState.placedSubmaps.length === 0) {
        list.innerHTML = '<p style="margin: 5px 0; color: #95a5a6; font-style: italic;">Chưa có map con nào</p>';
        return;
    }
    
    list.innerHTML = '';
    worldmapState.placedSubmaps.forEach((placed, index) => {
        const submap = worldmapState.submaps.find(s => s.name === placed.submapName);
        if (!submap) return;
        
        const div = document.createElement('div');
        div.style.cssText = 'margin: 5px 0; padding: 5px; background: rgba(52, 152, 219, 0.2); border-radius: 3px; cursor: pointer;';
        div.innerHTML = `
            <strong>${submap.name}</strong><br>
            <small>Pos: (${Math.round(placed.x)}, ${Math.round(placed.y)})</small><br>
            <small>Size: ${submap.width}x${submap.height} tiles</small>
        `;
        
        // Click to jump to this submap
        div.onclick = () => {
            document.getElementById('worldmapJumpX').value = placed.x;
            document.getElementById('worldmapJumpY').value = placed.y;
            document.getElementById('worldmapJumpBtn').click();
        };
        
        list.appendChild(div);
    });
};

const onWorldmapMouseDown = (e) => {
    if (worldmapState.panMode) {
        worldmapState.isPanning = true;
        worldmapState.lastPanX = e.clientX;
        worldmapState.lastPanY = e.clientY;
        worldmapCanvas.style.cursor = 'grabbing';
    } else if (worldmapState.placeMode && worldmapState.selectedSubmap) {
        placeSubmapAtPosition(e);
    } else if (worldmapState.spawnMode) {
        setSpawnPoint(e);
    }
};

const onWorldmapMouseMove = (e) => {
    if (worldmapState.isPanning) {
        const dx = e.clientX - worldmapState.lastPanX;
        const dy = e.clientY - worldmapState.lastPanY;
        worldmapState.panX += dx;
        worldmapState.panY += dy;
        worldmapState.lastPanX = e.clientX;
        worldmapState.lastPanY = e.clientY;
        drawWorldmap();
    }
};

const onWorldmapMouseUp = () => {
    worldmapState.isPanning = false;
    if (worldmapState.panMode) {
        worldmapCanvas.style.cursor = 'grab';
    }
};

const onWorldmapWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    worldmapState.zoom = Math.max(0.1, Math.min(2, worldmapState.zoom + delta));
    document.getElementById('worldmapZoom').value = worldmapState.zoom;
    document.getElementById('worldmapZoomValue').textContent = Math.round(worldmapState.zoom * 100) + '%';
    drawWorldmap();
};

const placeSubmapAtPosition = (e) => {
    const rect = worldmapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldX = (mouseX - worldmapState.panX) / worldmapState.zoom;
    const worldY = (mouseY - worldmapState.panY) / worldmapState.zoom;
    
    worldmapState.placedSubmaps.push({
        submapName: worldmapState.selectedSubmap.name,
        x: worldX,
        y: worldY
    });
    
    drawWorldmap();
    
    Swal.fire({
        icon: 'success',
        title: 'Đã đặt map con!',
        text: `"${worldmapState.selectedSubmap.name}" tại (${Math.round(worldX)}, ${Math.round(worldY)})`,
        timer: 1000,
        showConfirmButton: false
    });
};

const setSpawnPoint = (e) => {
    const rect = worldmapCanvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Convert screen coordinates to world coordinates
    const worldX = (mouseX - worldmapState.panX) / worldmapState.zoom;
    const worldY = (mouseY - worldmapState.panY) / worldmapState.zoom;
    
    worldmapState.spawnPoint = { x: worldX, y: worldY };
    
    drawWorldmap();
    
    Swal.fire({
        icon: 'success',
        title: 'Đã đặt Spawn Point!',
        text: `Vị trí spawn: (${Math.round(worldX)}, ${Math.round(worldY)})`,
        timer: 1000,
        showConfirmButton: false
    });
};

const saveWorldmap = async () => {
    if (!worldmapState.spawnPoint) {
        Swal.fire({
            icon: 'warning',
            title: 'Chưa đặt Spawn Point!',
            text: 'Vui lòng đặt spawn point trước khi lưu.',
        });
        return;
    }
    
    const worldmapData = {
        placedSubmaps: worldmapState.placedSubmaps,
        spawnPoint: worldmapState.spawnPoint
    };
    
    try {
        const response = await fetch('http://localhost:3000/save-worldmap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(worldmapData)
        });
        
        const result = await response.json();
        if (result.message) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: `World map đã được lưu!\nFile: ${result.fileName}`,
                timer: 2000,
                showConfirmButton: false
            });
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
