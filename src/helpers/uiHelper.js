/**
 * Setup a beautiful, diagnostic FPS and frame timing overlay.
 * Uses requestAnimationFrame to display real-time diagnostics.
 */
export function setupFpsCounter(app) {
    // Create diagnostic HUD container
    const fpsDiv = document.createElement('div');
    fpsDiv.id = 'fps-overlay';
    fpsDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 8px 14px;
        background: rgba(15, 23, 42, 0.85); /* Glassmorphic Dark Slate */
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        color: #10b981; /* Emerald Green */
        font-family: 'Consolas', 'Menlo', 'Courier New', monospace;
        font-size: 13px;
        font-weight: 700;
        z-index: 10000;
        pointer-events: none;
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: 0.5px;
        transition: color 0.25s ease;
    `;
    
    // Add pulsing status dot
    const dot = document.createElement('span');
    dot.style.cssText = `
        display: inline-block;
        width: 8px;
        height: 8px;
        background-color: #10b981;
        border-radius: 50%;
        box-shadow: 0 0 8px #10b981;
        transition: background-color 0.25s ease, box-shadow 0.25s ease;
    `;
    fpsDiv.appendChild(dot);
    
    // Add text node
    const textNode = document.createTextNode('FPS: -- (---ms)');
    fpsDiv.appendChild(textNode);
    
    document.body.appendChild(fpsDiv);
    
    let frameCount = 0;
    let lastTime = performance.now();
    
    // Attach to the PixiJS Ticker
    app.ticker.add(() => {
        frameCount++;
        const now = performance.now();
        
        // Update every 1 second
        if (now - lastTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastTime));
            const ms = (1000 / Math.max(1, fps)).toFixed(1);
            
            frameCount = 0;
            lastTime = now;
            
            // Dynamic color coding based on performance thresholds
            let color = '#10b981'; // Green (Smooth: >= 55 FPS)
            if (fps < 30) {
                color = '#ef4444'; // Red (Stuttering: < 30 FPS)
            } else if (fps < 55) {
                color = '#f59e0b'; // Yellow (Warning: 30-54 FPS)
            }
            
            fpsDiv.style.color = color;
            dot.style.backgroundColor = color;
            dot.style.boxShadow = `0 0 8px ${color}`;
            textNode.nodeValue = `FPS: ${fps} (${ms}ms)`;
        }
    });
}
