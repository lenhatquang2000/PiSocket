import fs from 'fs';
import path from 'path';

/**
 * Automatically creates a folder and a template controller JS file for each object in the data
 * inside public/assets/Object/ObjectController/ if they do not exist.
 * @param {Object} newData - The collision data object containing paths as keys
 * @param {string} rootDir - The application root directory
 */
export function generateObjectControllers(newData, rootDir) {
  for (let objPath in newData) {
    const match = objPath.match(/\/([^\/]+)\.(png|jpg|jpeg|gif)$/i);
    if (match) {
      const objName = match[1]; // e.g. "forest_obj_11"
      
      // Target directory: public/assets/Object/ObjectController/forest_obj_11
      const controllerDir = path.join(rootDir, 'public/assets/Object/ObjectController', objName);
      if (!fs.existsSync(controllerDir)) {
        fs.mkdirSync(controllerDir, { recursive: true });
        console.log(`📁 Created folder: ${controllerDir}`);
      }
      
      // File path: forest_obj_11Controller.js
      const controllerFilePath = path.join(controllerDir, `${objName}Controller.js`);
      if (!fs.existsSync(controllerFilePath)) {
        // Convert to PascalCase for the class name, e.g. forest_obj_11 -> ForestObj11Controller
        const className = objName
          .split(/[-_]/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('') + 'Controller';
        
        const template = `// Generated Controller for ${objName}
export class ${className} {
  constructor(objectInstance) {
    this.objectInstance = objectInstance;
  }

  // Gọi khi người chơi va chạm (blocking)
  onCollision(player) {
    // console.log("Player collided with ${objName}");
  }

  // Gọi khi người chơi đi vào vùng trigger zone
  onTriggerEnter(player) {
    // console.log("Player entered trigger zone of ${objName}");
  }

  // Gọi khi người chơi đi ra khỏi vùng trigger zone
  onTriggerLeave(player) {
    // console.log("Player left trigger zone of ${objName}");
  }
}
`;
        fs.writeFileSync(controllerFilePath, template, 'utf8');
        console.log(`📝 Generated Controller file: ${controllerFilePath}`);
      }
    }
  }
}
