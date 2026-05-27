const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const outputJson = document.getElementById('outputJson');
const desertList = document.getElementById('desert-list');
const forestList = document.getElementById('forest-list');

let currentImg = null;
let currentPath = "";
let isDrawing = false;
let currentMode = "brush"; // "brush" or "eraser"
let brushSize = 1;
let hitboxes = {}; // { path: [ {x, y}, ... ] } (danh sách các pixel va chạm)

// Các nút điều khiển
const brushBtn = document.getElementById('brushBtn');
const eraserBtn = document.getElementById('eraserBtn');
const brushSizeInput = document.getElementById('brushSize');
const clearBtn = document.getElementById('clearBtn');

brushBtn.onclick = () => { currentMode = "brush"; brushBtn.classList.add('active'); eraserBtn.classList.remove('active'); };
eraserBtn.onclick = () => { currentMode = "eraser"; eraserBtn.classList.add('active'); brushBtn.classList.remove('active'); };
brushSizeInput.onchange = (e) => { brushSize = parseInt(e.target.value); };
clearBtn.onclick = () => { if(currentPath) { hitboxes[currentPath] = []; draw(); updateOutput(); } };

// Tải danh sách vật thể
const loadLists = () => {
    // ... (giữ nguyên)
    for (let i = 0; i < 12; i++) {
        const path = `/assets/Object/desert/desert_obj_${i}.png`;
        createItem(path, desertList);
    }
    for (let i = 0; i < 16; i++) {
        const path = `/assets/Object/Forest/forest_obj_${i}.png`;
        createItem(path, forestList);
    }
};

const createItem = (path, parent) => {
    const div = document.createElement('div');
    div.className = 'obj-item';
    div.innerHTML = `<img src="${path}"><span>${path.split('/').pop()}</span>`;
    div.onclick = () => selectObject(path);
    parent.appendChild(div);
};

const selectObject = (path) => {
    currentPath = path;
    const img = new Image();
    img.onload = () => {
        currentImg = img;
        canvas.width = img.width * 10; // Zoom 10 lần
        canvas.height = img.height * 10;
        if (!hitboxes[currentPath]) hitboxes[currentPath] = [];
        draw();
    };
    img.src = path;
};

const draw = () => {
    if (!currentImg) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Vẽ ảnh nền (vật thể)
    ctx.globalAlpha = 0.8;
    ctx.drawImage(currentImg, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;

    // Vẽ các pixel đã tô
    const points = hitboxes[currentPath] || [];
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // Màu đỏ cho vùng va chạm
    points.forEach(p => {
        ctx.fillRect(p.x * 10, p.y * 10, 10, 10);
    });
};

const paint = (e) => {
    if (!isDrawing || !currentImg) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / 10);
    const y = Math.floor((e.clientY - rect.top) / 10);

    const points = hitboxes[currentPath];
    
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
        if (hitboxes[path].length > 0) cleanData[path] = hitboxes[path];
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
