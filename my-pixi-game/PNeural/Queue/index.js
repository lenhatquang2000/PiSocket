import { runFastResponseQueue } from './FastRespone/index.js';
import { runCognitiveQueue } from './Cognitive/index.js';

export function runPNeuralQueues({ message, messages, model, requestId, sessionId = null, cognitiveDelayMs = 500 }) {
  const fastResponseTask = runFastResponseQueue({ message, messages, model, requestId, sessionId }).catch(error => {
    console.error('[PNeural Queue:FastRespone] Error:', error);
    return null;
  });

  setTimeout(() => {
    runCognitiveQueue({ message, messages, requestId }).then(result => {
      if (result?.saved) {
        console.log(`[PNeural Queue:Cognitive] Save OK for ${requestId}`);
      }
    }).catch(error => {
      console.error('[PNeural Queue:Cognitive] Error:', error);
    });
  }, cognitiveDelayMs);

  return { fastResponseTask };
}
