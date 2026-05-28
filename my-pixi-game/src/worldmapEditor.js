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
    selectedSubmap: null,
    submaps: [], // Available submaps from server
    placedSubmaps: [], // { submapName, x, y }
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
        document.getElementById('worldmapPlaceBtn').classList.add('active');
        document.getElementById('worldmapPanBtn').classList.remove('active');
        worldmapCanvas.style.cursor = 'crosshair';
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
    worldmapState.placedSubmaps.forEach(placed => {
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
        
        // Draw submap name
        worldmapCtx.fillStyle = '#3498db';
        worldmapCtx.font = '14px Arial';
        worldmapCtx.fillText(submap.name, screenX + 5, screenY + 20);
        
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
};

const onWorldmapMouseDown = (e) => {
    if (worldmapState.panMode) {
        worldmapState.isPanning = true;
        worldmapState.lastPanX = e.clientX;
        worldmapState.lastPanY = e.clientY;
        worldmapCanvas.style.cursor = 'grabbing';
    } else if (worldmapState.placeMode && worldmapState.selectedSubmap) {
        placeSubmapAtPosition(e);
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

const saveWorldmap = async () => {
    const worldmapData = {
        placedSubmaps: worldmapState.placedSubmaps
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
                text: 'World map đã được lưu!',
                timer: 1500,
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
