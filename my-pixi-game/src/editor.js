const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const outputJson = document.getElementById('outputJson');
const desertList = document.getElementById('desert-list');
const forestList = document.getElementById('forest-list');
const innerhouseList = document.getElementById('innerhouse-list');
const seedList = document.getElementById('seed-list');
const mapList = document.getElementById('map-list');

// Import map editors
import { setupSubmapEditor, setSubmapEditorMode } from './submapEditor.js';
import { setupWorldmapEditor } from './worldmapEditor.js';

let currentImg = null;
let currentPath = "";
let isDrawing = false;
let currentMode = "brush"; // "brush" or "eraser"
let brushSize = 1;
let currentColliderType = "normal"; // "normal", "z_index_up", "z_index_down", "trigger_zone"
let hitboxes = {}; // { path: { normal: [{x,y}], z_index_up: [{x,y}], z_index_down: [{x,y}], trigger_zone: [{x,y}] } }
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
const colliderPurpleBtn = document.getElementById('colliderPurpleBtn');

colliderNormalBtn.onclick = () => {
    currentColliderType = "normal";
    colliderNormalBtn.classList.add('active');
    colliderGreenBtn.classList.remove('active');
    colliderYellowBtn.classList.remove('active');
    colliderPurpleBtn.classList.remove('active');
};
colliderGreenBtn.onclick = () => {
    currentColliderType = "z_index_up";
    colliderNormalBtn.classList.remove('active');
    colliderGreenBtn.classList.add('active');
    colliderYellowBtn.classList.remove('active');
    colliderPurpleBtn.classList.remove('active');
};
colliderYellowBtn.onclick = () => {
    currentColliderType = "z_index_down";
    colliderNormalBtn.classList.remove('active');
    colliderGreenBtn.classList.remove('active');
    colliderYellowBtn.classList.add('active');
    colliderPurpleBtn.classList.remove('active');
};
colliderPurpleBtn.onclick = () => {
    currentColliderType = "trigger_zone";
    colliderNormalBtn.classList.remove('active');
    colliderGreenBtn.classList.remove('active');
    colliderYellowBtn.classList.remove('active');
    colliderPurpleBtn.classList.add('active');
};

clearBtn.onclick = () => {
    if(currentPath) {
        hitboxes[currentPath] = { normal: [], z_index_up: [], z_index_down: [], trigger_zone: [] };
        draw();
        updateOutput();
    }
};

// Copy collider data to selected frames in character folder
const copyAllFramesBtn = document.getElementById('copyAllFramesBtn');
copyAllFramesBtn.onclick = async () => {
    if (!currentPath) {
        alert("Vui lòng chọn một asset trước!");
        return;
    }

    // Get current collider data
    const currentData = hitboxes[currentPath];
    if (!currentData || (currentData.normal.length === 0 && currentData.z_index_up.length === 0 && currentData.z_index_down.length === 0 && (!currentData.trigger_zone || currentData.trigger_zone.length === 0))) {
        alert("Không có collider data để copy!");
        return;
    }

    // Calculate root folder (folder before assets)
    // Example: /assets/A_cute_chibi_anime_girl/animations/Walking-3023122c/south/frame_000.png
    // Root folder: A_cute_chibi_anime_girl
    const parts = currentPath.split('/');
    console.log("Path parts:", parts);
    const assetsIndex = parts.indexOf('assets');
    if (assetsIndex === -1 || assetsIndex + 1 >= parts.length) {
        alert("Path không hợp lệ!");
        return;
    }
    const rootFolder = parts[assetsIndex + 1]; // A_cute_chibi_anime_girl
    const rootFolderPath = `/assets/${rootFolder}/`;
    
    console.log("Current path:", currentPath);
    console.log("Root folder:", rootFolder);
    console.log("Root folder path:", rootFolderPath);

    // Load collision_data.json to find all frames in root folder
    try {
        const response = await fetch('/assets/Object/collision_data.json');
        const collisionData = await response.json();
        console.log("Total paths in collisionData:", Object.keys(collisionData).length);

        // Find all frames in root folder from collisionData
        const framesInFolder = [];
        for (let path in collisionData) {
            if (path.startsWith(rootFolderPath)) {
                framesInFolder.push(path);
            }
        }
        console.log("Frames in folder from collisionData:", framesInFolder.length);

        // Also add animation paths from constants (for frames not yet in collisionData)
        const animationPaths = [
            '/assets/A_cute_chibi_anime_girl/animations/Walking-3023122c/',
            '/assets/A_cute_chibi_anime_girl/animations/Breathing_Idle-905887d4/',
            '/assets/A_cute_chibi_anime_girl/animations/Fireball-4a198baf/',
            '/assets/A_cute_chibi_anime_girl/animations/dig/',
            '/assets/A_cute_chibi_anime_girl/animations/seeding/'
        ];

        // Add all possible frame paths (8 directions * 30 frames per animation)
        const directions = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'];
        animationPaths.forEach(animPath => {
            directions.forEach(dir => {
                for (let i = 0; i < 30; i++) {
                    const frameNum = String(i).padStart(3, '0');
                    const framePath = `${animPath}${dir}/frame_${frameNum}.png`;
                    if (!framesInFolder.includes(framePath)) {
                        framesInFolder.push(framePath);
                    }
                }
            });
        });

        console.log("Total frames in folder (including inferred):", framesInFolder.length);

        if (framesInFolder.length === 0) {
            alert("Không tìm thấy frame nào trong folder!");
            return;
        }

        // Show popup with frame list
        showCopyPopup(framesInFolder, currentData);
    } catch (err) {
        console.error("Lỗi khi load collision_data.json:", err);
        alert("Lỗi khi load collision_data.json!");
    }
};

// Show copy popup with frame list
let selectedFrames = [];
let currentColliderData = null;

const showCopyPopup = (frames, data) => {
    selectedFrames = [];
    currentColliderData = data;
    
    const frameList = document.getElementById('frameList');
    frameList.innerHTML = '';
    
    frames.forEach(frame => {
        const frameName = frame.split('/').pop();
        const div = document.createElement('div');
        div.style.marginBottom = '8px';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = frame;
        checkbox.onchange = (e) => {
            if (e.target.checked) {
                selectedFrames.push(frame);
            } else {
                selectedFrames = selectedFrames.filter(f => f !== frame);
            }
        };
        
        const label = document.createElement('span');
        label.textContent = frameName;
        label.style.marginLeft = '8px';
        label.style.fontSize = '12px';
        
        div.appendChild(checkbox);
        div.appendChild(label);
        frameList.appendChild(div);
    });
    
    document.getElementById('copyPopup').style.display = 'block';
    document.getElementById('popupOverlay').style.display = 'block';
};

// Close popup
const closeCopyPopup = () => {
    document.getElementById('copyPopup').style.display = 'none';
    document.getElementById('popupOverlay').style.display = 'none';
    selectedFrames = [];
    currentColliderData = null;
};

// Select all frames
document.getElementById('selectAllFramesBtn').onclick = () => {
    const checkboxes = document.querySelectorAll('#frameList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
        if (!selectedFrames.includes(cb.value)) {
            selectedFrames.push(cb.value);
        }
    });
};

// Deselect all frames
document.getElementById('deselectAllFramesBtn').onclick = () => {
    const checkboxes = document.querySelectorAll('#frameList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = false;
    });
    selectedFrames = [];
};

// Cancel copy
document.getElementById('cancelCopyBtn').onclick = closeCopyPopup;

// Confirm copy
document.getElementById('confirmCopyBtn').onclick = () => {
    console.log("Selected frames:", selectedFrames.length);
    console.log("Selected frames list:", selectedFrames);
    
    if (selectedFrames.length === 0) {
        alert("Vui lòng chọn ít nhất một frame!");
        return;
    }
    
    if (!currentColliderData) {
        alert("Không có collider data!");
        return;
    }
    
    // Copy collider data to selected frames
    selectedFrames.forEach(frame => {
        console.log("Copying to:", frame);
        hitboxes[frame] = {
            normal: [...currentColliderData.normal],
            z_index_up: [...currentColliderData.z_index_up],
            z_index_down: [...currentColliderData.z_index_down],
            trigger_zone: currentColliderData.trigger_zone ? [...currentColliderData.trigger_zone] : []
        };
    });
    
    const copiedCount = selectedFrames.length;
    updateOutput();
    closeCopyPopup();
    alert(`Đã copy collider data sang ${copiedCount} frame!`);
};

// Close popup when clicking overlay
document.getElementById('popupOverlay').onclick = closeCopyPopup;

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

// Load collision data from server on startup
const loadCollisionData = async () => {
    try {
        const response = await fetch('/assets/Object/collision_data.json');
        const collisionData = await response.json();
        
        // Merge into hitboxes
        for (let path in collisionData) {
            const data = collisionData[path];
            if (Array.isArray(data)) {
                hitboxes[path] = { normal: data, z_index_up: [], z_index_down: [], trigger_zone: [] };
            } else {
                hitboxes[path] = {
                    normal: data.normal || [],
                    z_index_up: data.z_index_up || [],
                    z_index_down: data.z_index_down || [],
                    trigger_zone: data.trigger_zone || []
                };
            }
        }
        console.log("✅ Loaded collision data from server");
    } catch (err) {
        console.error("❌ Lỗi khi load collision data:", err);
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
    
    // Load innerhouse objects from server
    fetch('http://localhost:3000/get-innerhouse-objects')
        .then(res => res.json())
        .then(data => {
            console.log(`Loading ${data.objects.length} innerhouse objects`);
            data.objects.forEach(path => {
                createItem(path, innerhouseList);
            });
        })
        .catch(err => {
            console.error('Error loading innerhouse objects:', err);
            // Fallback to hardcoded list
            const innerhouseFiles = ['hose.png', 'innerwallhouse1.png', 'innerwallhouse2.png'];
            innerhouseFiles.forEach(file => {
                const path = `/assets/Object/innerhouse/${file}`;
                createItem(path, innerhouseList);
            });
        });
    
    // Load seed/crop assets
    const seedFiles = [
        '1._Tiny_green_rice_seedling_sprout_emerg.png',
        '2._Tiny_green_rice_seedling_tilted_sligh.png',
        '3._Tiny_green_rice_seedling_standing_upr.png',
        '4._Tiny_green_rice_seedling_tilted_sligh.png',
        '5._Young_green_rice_plant_medium_height.png',
        '6._Young_green_rice_plant_leaning_slight.png',
        '7._Young_green_rice_plant_standing_uprig.png',
        '8._Young_green_rice_plant_leaning_slight.png',
        '9._Tall_green_rice_plant_with_flowering.png',
        '10._Tall_green_rice_plant_with_flowers_s.png',
        '11._Tall_green_rice_plant_with_flowers_s.png',
        '12._Tall_green_rice_plant_with_flowers_s.png',
        '13._Mature_golden_yellow_rice_plant_read.png',
        '14._Mature_golden_yellow_rice_plant_with.png',
        '15._Mature_golden_yellow_rice_plant_with.png',
        '16._Mature_golden_yellow_rice_plant_with.png'
    ];
    seedFiles.forEach(file => {
        const path = `/assets/seed/${file}`;
        createItem(path, seedList);
    });
    
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
    
    const applyTabView = (tabId) => {
        const editorCanvas = document.getElementById('editorCanvas');
        const submapCanvas = document.getElementById('submap-canvas');
        const worldmapCanvas = document.getElementById('worldmap-canvas');
        const controls = document.getElementById('controls');
        const submapControls = document.getElementById('submap-controls');
        const worldmapControls = document.getElementById('worldmap-controls');
        
        editorCanvas.classList.remove('active');
        submapCanvas.classList.remove('active');
        worldmapCanvas.classList.remove('active');
        controls.style.display = 'none';
        submapControls.classList.remove('active');
        worldmapControls.classList.remove('active');
        
        if (tabId === 'submap' || tabId === 'submapobjects') {
            submapCanvas.classList.add('active');
            submapControls.classList.add('active');
            setSubmapEditorMode(tabId === 'submapobjects' ? 'objects' : 'ground');
        } else if (tabId === 'worldmap') {
            worldmapCanvas.classList.add('active');
            worldmapControls.classList.add('active');
        } else {
            editorCanvas.classList.add('active');
            controls.style.display = 'block';
        }
    };
    
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
        
        applyTabView(tabId);
    };
    
    // Set initial tab based on URL parameter
    switchTab(initialTab);
    
    // Add click event listeners to tab buttons
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            switchTab(tabId);
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
    const data = hitboxes[currentPath] || { normal: [], z_index_up: [], z_index_down: [], trigger_zone: [] };

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

    // Vẽ trigger zone (tím)
    ctx.fillStyle = 'rgba(155, 89, 182, 0.6)';
    if (data.trigger_zone) {
        data.trigger_zone.forEach(p => {
            ctx.fillRect(p.x * 10 * objectScale + offsetX, p.y * 10 * objectScale + offsetY, 10 * objectScale, 10 * objectScale);
        });
    }
};

const paint = (e) => {
    if (!isDrawing || !currentImg) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 10);
    const y = Math.floor((e.clientY - rect.top) / 10);

    const data = hitboxes[currentPath];
    const points = data[currentColliderType] || []; // Backward compatibility

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
        if (data.normal.length > 0 || data.z_index_up.length > 0 || data.z_index_down.length > 0 || (data.trigger_zone && data.trigger_zone.length > 0)) {
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

document.getElementById('saveByTypeBtn').onclick = async () => {
    const objectTypeId = document.getElementById('objectTypeId').value.trim();
    if (!objectTypeId) {
        Swal.fire({
            icon: 'warning',
            title: 'Cảnh báo!',
            text: 'Vui lòng nhập Object Type ID!',
        });
        return;
    }

    const currentData = hitboxes[currentPath];
    if (!currentData) {
        Swal.fire({
            icon: 'warning',
            title: 'Cảnh báo!',
            text: 'Không có collider data để lưu!',
        });
        return;
    }

    const colliderData = {
        normal: currentData.normal || [],
        z_index_up: currentData.z_index_up || [],
        z_index_down: currentData.z_index_down || [],
        trigger_zone: currentData.trigger_zone || []
    };

    try {
        const response = await fetch('http://localhost:3000/save-object-collider-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objectTypeId, colliderData })
        });
        const result = await response.json();
        if (result.success) {
            Swal.fire({
                icon: 'success',
                title: 'Thành công!',
                text: `Đã lưu collider data cho Object Type ID: ${objectTypeId}`,
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

loadCollisionData();
loadLists();
setupTabs();
setupSubmapEditor();
setupWorldmapEditor();
