# 🎨 AI Asset Generation Prompts - Ground Tiles

## Mục Đích
Tạo các tile assets mặt đất với seamless transitions để sử dụng trong game 2D top-down.

---

## 📋 Template Prompts Cho Các Loại Tile

### 1. **Base Tile (Tile Đơn Lẻ)**
```
Create a 64x64 pixel top-down 2D game tile asset of cultivated farmland soil. 
Style: cartoon, hand-drawn with soft outlines
Colors: warm brown tones (#8B6F47, #A0826D)
Details: visible soil texture, small dirt clumps, subtle shadows
Background: transparent PNG
View: directly from above (top-down orthographic)
Art style: similar to Stardew Valley or Graveyard Keeper
No borders, seamless edges for tiling
```

### 2. **Seamless Tileset (Bộ 16 Tiles Autotiling)**
```
Create a complete 16-tile autotiling tileset for farmland soil in a 2D top-down game.
Include all variations:
- Center tile (surrounded by farmland on all 4 sides)
- 4 edge tiles (top, right, bottom, left)
- 4 corner tiles (top-left, top-right, bottom-left, bottom-right)
- 4 end tiles (single connections: north, east, south, west)
- 2 straight tiles (horizontal, vertical)
- 1 isolated tile (no connections)

Style: cartoon, hand-drawn
Colors: warm brown cultivated soil (#8B6F47) transitioning to green grass (#7CB342)
Tile size: 64x64 pixels each
Background: transparent PNG
Seamless edges that blend perfectly when placed adjacent
Top-down orthographic view
Art style: Stardew Valley inspired
Export as sprite sheet with 4x4 grid layout
```

### 3. **Grass to Farmland Transition**
```
Create seamless transition tiles between green grass and brown farmland for a 2D farming game.
Grass color: vibrant green (#7CB342, #9CCC65)
Farmland color: rich brown soil (#8B6F47, #A0826D)
Style: top-down view, cartoon art style
Transition: organic, irregular edges with grass gradually fading into soil
Include small details: grass blades, dirt particles, tiny stones
Tile size: 64x64 pixels
Background: transparent PNG
Seamless on all 4 edges for perfect tiling
Art style: similar to Stardew Valley or Graveyard Keeper
```

### 4. **Detailed Farmland Variations**
```
Create 5 variations of the same farmland tile for visual diversity in a 2D farming game.
Each tile should be 64x64 pixels with:
- Same base brown soil color (#8B6F47)
- Different arrangements of: dirt clumps, small stones, soil texture patterns
- Subtle variations in shading and highlights
- All tiles must be seamlessly tileable on all edges
- Top-down orthographic view
- Cartoon hand-drawn style
- Transparent PNG background
- Art style: Stardew Valley inspired
Purpose: randomly place these to avoid repetitive patterns
```

---

## 🎯 Prompt Cho Các Trạng Thái Đất Khác Nhau

### **Đất Khô (Dry Soil)**
```
64x64 pixel top-down farmland tile, dry cracked soil
Colors: light brown (#C4A57B), beige (#D4C5A9)
Details: visible cracks, dusty texture, no moisture
Style: cartoon, hand-drawn
Seamless edges, transparent PNG
```

### **Đất Ẩm (Wet Soil)**
```
64x64 pixel top-down farmland tile, freshly watered dark soil
Colors: dark brown (#5D4E37), almost black (#3E2F1F)
Details: moist appearance, slight shine, water droplets
Style: cartoon, hand-drawn
Seamless edges, transparent PNG
```

### **Đất Đã Trồng (Planted Soil)**
```
64x64 pixel top-down farmland tile with small green sprouts
Base: brown cultivated soil (#8B6F47)
Details: 2-3 tiny green seedlings emerging, fresh planted look
Style: cartoon, hand-drawn
Seamless edges, transparent PNG
```

---

## 🛠️ Công Cụ AI Khuyến Nghị

### **1. DALL-E 3 (OpenAI)**
- Tốt nhất cho: Pixel art, game assets
- Prompt: Sử dụng template trên + thêm "pixel art style"

### **2. Midjourney**
- Tốt nhất cho: Hand-drawn, cartoon style
- Thêm parameters: `--ar 1:1 --style raw --v 6`
- Example:
```
/imagine 64x64 pixel farmland tile, top-down view, cartoon style, 
brown soil with grass edges, seamless tileable, transparent background, 
Stardew Valley art style --ar 1:1 --style raw --v 6
```

### **3. Stable Diffusion**
- Tốt nhất cho: Customization, local generation
- Model khuyến nghị: `stable-diffusion-xl-base-1.0`
- Negative prompt: `3d, perspective, isometric, shadows, borders, frames`

### **4. Leonardo.AI**
- Tốt nhất cho: Game assets, tileable textures
- Preset: "Pixel Art" hoặc "2D Game Assets"

---

## 📐 Specifications Kỹ Thuật

### **Kích Thước**
- Single tile: 64x64 pixels (hoặc 32x32, 128x128)
- Sprite sheet: 256x256 pixels (4x4 grid of 64x64 tiles)
- Resolution: 72 DPI minimum

### **Format**
- File type: PNG
- Color mode: RGBA (với alpha channel)
- Bit depth: 32-bit (8-bit per channel)

### **Naming Convention**
```
farmland_tile_center.png
farmland_tile_edge_top.png
farmland_tile_corner_topleft.png
farmland_tile_isolated.png
```

---

## 🎨 Color Palettes

### **Farmland Soil**
```
Primary: #8B6F47 (Medium Brown)
Shadow: #6B5437 (Dark Brown)
Highlight: #A0826D (Light Brown)
Accent: #5D4E37 (Rich Earth)
```

### **Grass**
```
Primary: #7CB342 (Vibrant Green)
Shadow: #558B2F (Dark Green)
Highlight: #9CCC65 (Light Green)
Accent: #689F38 (Medium Green)
```

### **Transition Blend**
```
Use gradient between grass and soil colors
Add small grass tufts at edges
Irregular, organic transition line
```

---

## 💡 Tips Để Có Kết Quả Tốt

### **1. Seamless Tiling**
- Luôn nhấn mạnh "seamless edges" trong prompt
- Yêu cầu "tileable on all 4 sides"
- Tránh details ở rìa tile

### **2. Consistent Style**
- Sử dụng cùng một art style reference (ví dụ: "Stardew Valley style")
- Giữ nguyên color palette cho tất cả tiles
- Consistent lighting direction (top-down, no shadows)

### **3. Variations**
- Tạo 3-5 variations của mỗi tile type
- Randomly rotate tiles khi sử dụng
- Mix different variations để tránh repetitive patterns

### **4. Testing**
- Test tiles bằng cách place chúng cạnh nhau
- Kiểm tra seams và transitions
- Adjust colors nếu cần trong image editor

---

## 🔧 Post-Processing (Nếu Cần)

### **Tools**
- **Aseprite**: Tốt nhất cho pixel art editing
- **GIMP**: Free, powerful image editor
- **Photoshop**: Professional editing

### **Steps**
1. Remove any visible seams manually
2. Adjust colors để match với game palette
3. Add subtle noise texture cho realism
4. Export với correct alpha channel

---

## 📚 Example Prompt Hoàn Chỉnh

```
Create a complete autotiling farmland tileset for a 2D top-down farming game.

SPECIFICATIONS:
- 16 tiles total in a 4x4 sprite sheet
- Each tile: 64x64 pixels
- Total sprite sheet: 256x256 pixels
- Format: PNG with transparent background

STYLE:
- Art style: Stardew Valley / Graveyard Keeper inspired
- View: Top-down orthographic (directly from above)
- Drawing style: Cartoon, hand-drawn with soft outlines
- No 3D perspective, no isometric view

COLORS:
- Farmland soil: warm brown (#8B6F47, #A0826D, #6B5437)
- Grass: vibrant green (#7CB342, #9CCC65, #558B2F)
- Transition: organic blend between grass and soil

TILES NEEDED:
1. Center (all sides farmland)
2-5. Edges: top, right, bottom, left
6-9. Corners: top-left, top-right, bottom-left, bottom-right
10-13. Ends: north, east, south, west only
14-15. Straights: horizontal, vertical
16. Isolated (no connections)

DETAILS:
- Visible soil texture with small dirt clumps
- Grass blades at transition edges
- Irregular, organic transition lines
- Seamless edges for perfect tiling
- Subtle shading but no hard shadows
- Small stones and dirt particles for variety

IMPORTANT:
- All edges must be seamlessly tileable
- Consistent lighting from above
- No borders or frames around tiles
- Transparent background (alpha channel)
```

---

**Lưu ý**: Sau khi generate, bạn có thể cần chỉnh sửa nhẹ trong image editor để đảm bảo seamless tiling hoàn hảo.

**Phiên bản**: 1.0  
**Ngày tạo**: 2026-05-28  
**Tác giả**: AI Assistant
