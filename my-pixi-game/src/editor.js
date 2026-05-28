const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const outputJson = document.getElementById('outputJson');
const desertList = document.getElementById('desert-list');
const forestList = document.getElementById('forest-list');
const mapList = document.getElementById('map-list');

// Import map editors
import { setupSubmapEditor } from './submapEditor.js';
import { setupWorldmapEditor } from './worldmapEditor.js';

let currentImg = null;
let currentPath = "";
let isDrawing = false;
let currentMode = "brush"; // "brush" or "eraser"
let brushSize = 1;
let currentColliderType = "normal"; // "normal", "z_index_up", "z_index_down"
let hitboxes = {}; // { path: { normal: [{x,y}], z_index_up: [{x,y}], z_index_down: [{x,y}] } }
let objectScale = 1; // Scale factor for the object

// Các nút điều khiển
const brushBtn = document.getElementById('brushBtn');
const eraserBtn = document.getElementById('eraserBtn');
const brushSizeInput = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');

brushBtn.onclick = () => { currentMode = "brush"; brushBtn.classList.add('active'); eraserBtn.classList.remove('active'); };
eraserBtn.onclick = () => { currentMode = "eraser"; eraserBtn.classList.add('active'); brushBtn.classList.remove('active'); };
brushSizeInput.onchange = (e) => { brushSize = parseInt(e.target.value); };

// Scale slider event listener
const objectScaleInput = document.getElementById('objectScale');
const scaleValueDisplay = document.getElementById('scaleValue');
objectScaleInput.oninput = (e) => {
    objectScale = parseFloat(e.target.value);
    scaleValueDisplay.textContent = objectScale.toFixed(1) + 'x';
    draw();
};

// Collider type buttons
const colliderNormalBtn = document.getElementById('colliderNormalBtn');
const colliderGreenBtn = document.getElementById('colliderGreenBtn');
const colliderYellowBtn = document.getElementById('colliderYellowBtn');

colliderNormalBtn.onclick = () => {
    currentColliderType = "normal";
    colliderNormalBtn.classList.add('active');
    colliderGreenBtn.classList.remove('active');
    colliderYellowBtn.classList.remove('active');
};
colliderGreenBtn.onclick = () => {
    currentColliderType = "z_index_up";
    colliderNormalBtn.classList.remove('active');
    colliderGreenBtn.classList.add('active');
    colliderYellowBtn.classList.remove('active');
};
colliderYellowBtn.onclick = () => {
    currentColliderType = "z_index_down";
    colliderNormalBtn.classList.remove('active');
    colliderGreenBtn.classList.remove('active');
    colliderYellowBtn.classList.add('active');
};

clearBtn.onclick = () => {
    if(currentPath) {
        hitboxes[currentPath] = { normal: [], z_index_up: [], z_index_down: [] };
        draw();
        updateOutput();
    }
};

// Toggle controls panel
const toggleControlsBtn = document.getElementById('toggleControlsBtn');
const controlsPanel = document.getElementById('controls');
let isControlsCollapsed = false;

toggleControlsBtn.onclick = () => {
    isControlsCollapsed = !isControlsCollapsed;
    if (isControlsCollapsed) {
        controlsPanel.classList.add('collapsed');
        toggleControlsBtn.textContent = 'Mở rộng ▼';
    } else {
        controlsPanel.classList.remove('collapsed');
        toggleControlsBtn.textContent = 'Thu gọn ▲';
    }
};

// Tải danh sách vật thể
const loadLists = () => {
    // Player collider
    const playerPath = '/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/south/frame_000.png';
    createItem(playerPath, document.getElementById('player-list'), 'Player Collider');

    // ... (giữ nguyên)
    for (let i = 0; i < 12; i++) {
        const path = `/assets/Object/desert/desert_obj_${i}.png`;
        createItem(path, desertList);
    }
    for (let i = 0; i < 16; i++) {
        const path = `/assets/Object/Forest/forest_obj_${i}.png`;
        createItem(path, forestList);
    }
    
    // Load map objects
    loadMapObjects();
};

const loadMapObjects = () => {
    // Load all map assets from Map/Map2 directory
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
        createItem(path, mapList);
    });
};

// Tab switching functionality
const setupTabs = () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Check URL parameter on page load
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'objects';
    
    // Function to switch to a specific tab
    const switchTab = (tabId) => {
        // Remove active class from all buttons and contents
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked button and corresponding content
        const targetBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        const targetContent = document.getElementById(`${tabId}-tab`);
        
        if (targetBtn) targetBtn.classList.add('active');
        if (targetContent) targetContent.classList.add('active');
        
        // Update URL parameter
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('tab', tabId);
        window.history.replaceState({}, '', newUrl);
    };
    
    // Set initial tab based on URL parameter
    switchTab(initialTab);
    
    // Add click event listeners to tab buttons
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
            
            // Toggle canvas visibility based on tab
            const editorCanvas = document.getElementById('editorCanvas');
            const submapCanvas = document.getElementById('submap-canvas');
            const worldmapCanvas = document.getElementById('worldmap-canvas');
            const controls = document.getElementById('controls');
            const submapControls = document.getElementById('submap-controls');
            const worldmapControls = document.getElementById('worldmap-controls');
            
            // Hide all canvases and controls
            editorCanvas.classList.remove('active');
            submapCanvas.classList.remove('active');
            worldmapCanvas.classList.remove('active');
            controls.style.display = 'none';
            submapControls.classList.remove('active');
            worldmapControls.classList.remove('active');
            
            // Show appropriate canvas and controls
            if (tabId === 'submap') {
                submapCanvas.classList.add('active');
                submapControls.classList.add('active');
            } else if (tabId === 'worldmap') {
                worldmapCanvas.classList.add('active');
                worldmapControls.classList.add('active');
            } else {
                editorCanvas.classList.add('active');
                controls.style.display = 'block';
            }
        });
    });
};

const createItem = (path, parent, customLabel = null) => {
    const div = document.createElement('div');
    div.className = 'obj-item';
    const label = customLabel || path.split('/').pop();
    div.innerHTML = `<img src="${path}"><span>${label}</span>`;
    div.onclick = () => selectObject(path);
    parent.appendChild(div);
};

const selectObject = (path) => {
    currentPath = path;
    objectScale = 1; // Reset scale when selecting new object
    document.getElementById('objectScale').value = 1;
    document.getElementById('scaleValue').textContent = '1.0x';
    
    const img = new Image();
    img.onload = () => {
        currentImg = img;
        canvas.width = img.width * 10; // Zoom 10 lần
        canvas.height = img.height * 10;
        if (!hitboxes[currentPath]) {
            hitboxes[currentPath] = { normal: [], z_index_up: [], z_index_down: [] };
        }
        draw();
    };
    img.src = path;
};

const draw = () => {
    if (!currentImg) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vẽ ảnh nền (vật thể) với scale
    ctx.globalAlpha = 0.8;
    const scaledWidth = canvas.width * objectScale;
    const scaledHeight = canvas.height * objectScale;
    const offsetX = (canvas.width - scaledWidth) / 2;
    const offsetY = (canvas.height - scaledHeight) / 2;
    ctx.drawImage(currentImg, offsetX, offsetY, scaledWidth, scaledHeight);
    ctx.globalAlpha = 1.0;

    // Vẽ các pixel đã tô theo loại collider
    const data = hitboxes[currentPath] || { normal: [], z_index_up: [], z_index_down: [] };

    // Vẽ collider thường (đỏ)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)';
    data.normal.forEach(p => {
        ctx.fillRect(p.x * 10 * objectScale + offsetX, p.y * 10 * objectScale + offsetY, 10 * objectScale, 10 * objectScale);
    });

    // Vẽ collider z-index up (xanh)
    ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
    data.z_index_up.forEach(p => {
        ctx.fillRect(p.x * 10 * objectScale + offsetX, p.y * 10 * objectScale + offsetY, 10 * objectScale, 10 * objectScale);
    });

    // Vẽ collider z-index down (vàng)
    ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
    data.z_index_down.forEach(p => {
        ctx.fillRect(p.x * 10 * objectScale + offsetX, p.y * 10 * objectScale + offsetY, 10 * objectScale, 10 * objectScale);
    });
};

const paint = (e) => {
    if (!isDrawing || !currentImg) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 10);
    const y = Math.floor((e.clientY - rect.top) / 10);

    const data = hitboxes[currentPath];
    const points = data[currentColliderType];

    // Vẽ theo Brush Size
    for (let i = -brushSize + 1; i < brushSize; i++) {
        for (let j = -brushSize + 1; j < brushSize; j++) {
            const px = x + i;
            const py = y + j;
            if (px < 0 || px >= currentImg.width || py < 0 || py >= currentImg.height) continue;

            const index = points.findIndex(p => p.x === px && p.y === py);

            if (currentMode === "brush") {
                if (index === -1) points.push({ x: px, y: py });
            } else {
                if (index !== -1) points.splice(index, 1);
            }
        }
    }

    draw();
    updateOutput();
};

canvas.onmousedown = (e) => { isDrawing = true; paint(e); };
canvas.onmousemove = (e) => { if (isDrawing) paint(e); };
window.onmouseup = () => { isDrawing = false; };

const updateOutput = () => {
    const cleanData = {};
    for (let path in hitboxes) {
        const data = hitboxes[path];
        // Chỉ lưu nếu có ít nhất một collider type có data
        if (data.normal.length > 0 || data.z_index_up.length > 0 || data.z_index_down.length > 0) {
            cleanData[path] = data;
        }
    }
    outputJson.value = JSON.stringify(cleanData);
};

document.getElementById('saveBtn').onclick = async () => {
    console.log("Nút Lưu đã được nhấn!");
    const data = outputJson.value;
    console.log("Dữ liệu gửi đi:", data);
    try {
        console.log("Đang gọi fetch tới server...");
        const response = await fetch('http://localhost:3000/save-collision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data
        });
        console.log("Phản hồi từ server:", response.status);
        const result = await response.json();
        if (result.message) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: 'Đã lưu va chạm vào server.',
                timer: 1500,
                showConfirmButton: false
            });
        }
    } catch (err) {
        console.error("Lỗi:", err);
        Swal.fire({
            icon: 'error',
            title: 'Lỗi!',
            text: 'Không thể kết nối tới Server. Hãy đảm bảo bạn đã chạy "node server.js"',
        });
    }
};

loadLists();
setupTabs();
setupSubmapEditor();
setupWorldmapEditor();
