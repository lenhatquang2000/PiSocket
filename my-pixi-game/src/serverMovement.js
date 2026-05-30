// Server-Authoritative Movement System - Client Side
// Client chỉ gửi input (hướng di chuyển), server tính toán vị trí

export class ServerMovementController {
  constructor(socket, characterContainer) {
    this.socket = socket;
    this.characterContainer = characterContainer;
    
    // Current input state
    this.currentDirection = null; // 'north' | 'south' | 'east' | 'west' | 'north-east' | ...
    this.lastSentDirection = null;
    
    // Server state
    this.serverPosition = { x: 0, y: 0 };
    this.serverDir = 'south';
    
    // Client prediction (optional - để smooth movement)
    this.predictedPosition = { x: 0, y: 0 };
    
    // Interpolation for smooth rendering
    this.interpolationAlpha = 0.8; // 0 = instant snap, 1 = full interpolation (0.8 = fast and smooth)
    
    // Listen to server tick updates
    this.setupServerTickListener();
  }
  
  // Setup listener cho server tick updates
  setupServerTickListener() {
    this.socket.on('serverTick', (playerStates) => {
      // Find our player's state from server
      const myState = playerStates[this.socket.id];
      
      if (myState) {
        // Update server position
        this.serverPosition.x = myState.x;
        this.serverPosition.y = myState.y;
        this.serverDir = myState.dir;
        
        // DIRECTLY update character position from server (no interpolation for now)
        this.characterContainer.x = this.serverPosition.x;
        this.characterContainer.y = this.serverPosition.y;
        
        // Update z-index based on triggers
        // If player trigger_zone touches object z_index_up, player renders above objects
        if (myState.zIndexTriggers && myState.zIndexTriggers.length > 0) {
          // Player is in z-index trigger zone - render above objects
          // Use very high z-index to ensure player is above all objects
          this.characterContainer.zIndex = 10000;
          console.log(`🎨 Player z-index = 10000 (above ${myState.zIndexTriggers.length} objects)`);
        } else {
          // Normal z-index based on Y position
          this.characterContainer.zIndex = this.serverPosition.y;
        }
      }
    });
  }
  
  // Update input based on keyboard state
  updateInput(keys) {
    let newDirection = null;
    
    // Determine direction from keyboard input (8 directions)
    // Support both 'KeyW' and 'ArrowUp' formats
    const up = keys['KeyW'] || keys['ArrowUp'];
    const down = keys['KeyS'] || keys['ArrowDown'];
    const left = keys['KeyA'] || keys['ArrowLeft'];
    const right = keys['KeyD'] || keys['ArrowRight'];
    
    // 8-directional movement
    if (up && right) {
      newDirection = 'north-east';
    } else if (up && left) {
      newDirection = 'north-west';
    } else if (down && right) {
      newDirection = 'south-east';
    } else if (down && left) {
      newDirection = 'south-west';
    } else if (up) {
      newDirection = 'north';
    } else if (down) {
      newDirection = 'south';
    } else if (left) {
      newDirection = 'west';
    } else if (right) {
      newDirection = 'east';
    }
    
    // ALWAYS send to server (even when stopped)
    if (newDirection !== this.lastSentDirection) {
      this.currentDirection = newDirection;
      this.lastSentDirection = newDirection;
      
      // Send input to server (null = stopped)
      this.socket.emit('playerInput', {
        direction: newDirection
      });
      
      // Log direction changes
      console.log(`📤 Sent input to server: ${newDirection || 'STOPPED'}`);
    }
    
    return newDirection !== null; // Return true if moving
  }
  
  // Get current direction for animation
  getCurrentDirection() {
    return this.serverDir || this.currentDirection || 'south';
  }
  
  // Check if player is moving
  isMoving() {
    return this.currentDirection !== null;
  }
  
  // Force sync position with server (for teleport, etc.)
  syncPosition(x, y) {
    this.serverPosition.x = x;
    this.serverPosition.y = y;
    this.characterContainer.x = x;
    this.characterContainer.y = y;
  }
}
