/**
 * Setup authentication tab switching, login/register triggers,
 * character listing, creating, and deleting listeners.
 */
export function setupAuthAndCharacterManagement({
    SOCKET_URL,
    playCharacter,
    DOMElements: {
        authSection,
        charSection,
        loginForm,
        registerForm,
        charList,
        createCharForm,
        tabLoginBtn,
        tabRegisterBtn,
        loginUsernameInput,
        loginPasswordInput,
        loginBtn,
        registerUsernameInput,
        registerPasswordInput,
        registerBtn,
        showCreateCharBtn,
        newCharNameInput,
        charAccessCodeInput,
        confirmCreateCharBtn,
        cancelCreateCharBtn
    }
}) {
    let currentUserId = null;

    // Load characters function
    async function loadCharacters() {
        if (!charList) return;
        charList.innerHTML = '';
        try {
            const response = await fetch(`${SOCKET_URL}/get-players`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });
            const data = await response.json();
            const playersList = data.players || [];
            
            if (playersList.length === 0) {
                charList.innerHTML = `<div style="color: #aaa; font-style: italic; padding: 10px;">Chưa có nhân vật nào. Hãy tạo một nhân vật mới!</div>`;
                return;
            }

            playersList.forEach(p => {
                const item = document.createElement('div');
                item.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 8px;
                    padding: 12px 15px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 8px;
                `;
                
                // Hover effect
                item.onmouseenter = () => {
                    item.style.background = 'rgba(16, 153, 187, 0.15)';
                    item.style.borderColor = '#1099bb';
                };
                item.onmouseleave = () => {
                    item.style.background = 'rgba(255, 255, 255, 0.05)';
                    item.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                };

                const info = document.createElement('div');
                info.style.textAlign = 'left';
                info.innerHTML = `
                    <div style="font-weight: bold; font-size: 16px; color: #1099bb;">${p.name}</div>
                    <div style="font-size: 12px; color: #aaa; margin-top: 4px;">❤️ HP: ${p.hp}/${p.max_hp} | ✨ MP: ${p.mp}/${p.max_mp}</div>
                `;
                
                // Click to play as this character
                info.style.flex = '1';
                info.addEventListener('click', () => {
                    playCharacter(p);
                });

                const delBtn = document.createElement('button');
                delBtn.innerText = '🗑️';
                delBtn.style.cssText = `
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 5px;
                    transition: transform 0.2s;
                `;
                delBtn.onmouseenter = () => delBtn.style.transform = 'scale(1.2)';
                delBtn.onmouseleave = () => delBtn.style.transform = 'scale(1)';
                
                delBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (confirm(`Bạn có chắc chắn muốn xóa nhân vật ${p.name}?`)) {
                        await deleteCharacter(p.id);
                    }
                });

                item.appendChild(info);
                item.appendChild(delBtn);
                charList.appendChild(item);
            });
        } catch (err) {
            console.error(err);
        }
    }

    // Delete character function
    async function deleteCharacter(playerId) {
        try {
            const response = await fetch(`${SOCKET_URL}/delete-player`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, playerId })
            });
            const data = await response.json();
            if (data.success) {
                await loadCharacters();
            } else {
                alert('Xóa nhân vật thất bại!');
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Login user function
    async function loginUser(username, password) {
        try {
            const response = await fetch(`${SOCKET_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (data.success) {
                currentUserId = data.userId;
                authSection.style.display = 'none';
                charSection.style.display = 'block';
                await loadCharacters();
            } else {
                alert('Đăng nhập thất bại: ' + (data.error || 'Sai tài khoản hoặc mật khẩu.'));
            }
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra khi kết nối máy chủ!');
        }
    }

    // Switch Tabs
    if (tabLoginBtn && tabRegisterBtn) {
        tabLoginBtn.addEventListener('click', () => {
            tabLoginBtn.style.color = '#1099bb';
            tabLoginBtn.style.borderBottom = '2px solid #1099bb';
            tabRegisterBtn.style.color = '#aaa';
            tabRegisterBtn.style.borderBottom = '2px solid transparent';
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        });

        tabRegisterBtn.addEventListener('click', () => {
            tabRegisterBtn.style.color = '#2ecc71';
            tabRegisterBtn.style.borderBottom = '2px solid #2ecc71';
            tabLoginBtn.style.color = '#aaa';
            tabLoginBtn.style.borderBottom = '2px solid transparent';
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        });
    }

    // Register Click
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const username = registerUsernameInput.value.trim();
            const password = registerPasswordInput.value.trim();
            if (!username || !password) {
                alert('Vui lòng điền đầy đủ tên tài khoản và mật khẩu!');
                return;
            }
            try {
                const response = await fetch(`${SOCKET_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();
                if (data.success) {
                    alert('Đăng ký tài khoản thành công! Hãy đăng nhập.');
                    registerUsernameInput.value = '';
                    registerPasswordInput.value = '';
                    tabLoginBtn.click();
                } else {
                    alert('Đăng ký thất bại: ' + (data.error || 'Tài khoản đã tồn tại.'));
                }
            } catch (err) {
                console.error(err);
                alert('Có lỗi xảy ra khi kết nối máy chủ!');
            }
        });
    }

    // Login Click
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value.trim();
            if (!username || !password) {
                alert('Vui lòng nhập tài khoản và mật khẩu!');
                return;
            }
            await loginUser(username, password);
        });
    }

    // Create Char Show/Hide
    if (showCreateCharBtn) {
        showCreateCharBtn.addEventListener('click', () => {
            showCreateCharBtn.style.display = 'none';
            createCharForm.style.display = 'block';
        });
    }

    if (cancelCreateCharBtn) {
        cancelCreateCharBtn.addEventListener('click', () => {
            showCreateCharBtn.style.display = 'flex';
            createCharForm.style.display = 'none';
            newCharNameInput.value = '';
            charAccessCodeInput.value = '';
        });
    }

    if (confirmCreateCharBtn) {
        confirmCreateCharBtn.addEventListener('click', async () => {
            const name = newCharNameInput.value.trim();
            const accessCode = charAccessCodeInput.value.trim();
            if (!name) {
                alert('Vui lòng điền tên nhân vật!');
                return;
            }
            try {
                const response = await fetch(`${SOCKET_URL}/create-player`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, name, accessCode })
                });
                const data = await response.json();
                if (data.success) {
                    newCharNameInput.value = '';
                    charAccessCodeInput.value = '';
                    createCharForm.style.display = 'none';
                    showCreateCharBtn.style.display = 'flex';
                    await loadCharacters();
                } else {
                    alert('Tạo nhân vật thất bại: ' + (data.error || 'Tên nhân vật đã tồn tại.'));
                }
            } catch (err) {
                console.error(err);
            }
        });
    }
}
