import { thinkAboutUsers } from './thinker.js';

let mindInterval = null;

/**
 * Khởi chạy Queue thứ 3: Mind
 * Duyệt qua database định kỳ để suy luận và tìm kiếm thông tin mới về người dùng
 */
export function startMindQueue() {
  if (mindInterval) return;

  console.log('[PNeural Mind] Mind Queue initialized.');
  
  // Lần chạy đầu tiên
  thinkAboutUsers().catch(err => console.error('[PNeural Mind] Initial thinking failed:', err));

  // Chạy định kỳ mỗi 12 tiếng để tối ưu token tối đa
  mindInterval = setInterval(() => {
    thinkAboutUsers().catch(err => console.error('[PNeural Mind] Recurring thinking failed:', err));
  }, 12 * 60 * 60 * 1000); 

  if (mindInterval.unref) mindInterval.unref();
}

export function stopMindQueue() {
  if (mindInterval) {
    clearInterval(mindInterval);
    mindInterval = null;
  }
}
