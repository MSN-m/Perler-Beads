// Isolated SDK simulation. This file is NOT in the release ZIP.
(() => {
    const key = 'perler-progress-fixture-only';
    let data = JSON.parse(localStorage.getItem(key) || '{}');
    let fail = false, large = false, writes = 0;
    const persist = () => localStorage.setItem(key, JSON.stringify(data));
    const geometry = () => ({ errMsg: 'getWindowInfo:ok', windowWidth: innerWidth, windowHeight: innerHeight,
        statusBarHeight: 54, safeArea: { top: large ? 54 : 0, bottom: innerHeight - 34 },
        menuButtons: large ? { capsule: { left: innerWidth - 110, top: 64, right: innerWidth - 20, bottom: 96, width: 90, height: 32 }, back: null, me: null, share: null }
            : { capsule: null, back: { left: 10, top: 30, right: 42, bottom: 62, width: 32, height: 32 }, me: null, share: { left: innerWidth - 42, top: 30, right: innerWidth - 10, bottom: 62, width: 32, height: 32 } } });
    window.xhs = { launchOptions: { miniToolEnv: { buildVersion: 9550001, windowInfo: geometry() } }, miniTool: {
        async getWindowInfo() { return geometry(); },
        async getStorage({ key }) { return { errMsg: 'getStorage:ok', data: data[key] || null }; },
        async setStorage({ key, data: value }) { if (fail) throw new Error('测试存储不足'); data[key] = value; writes++; persist(); document.getElementById('fixture-count').textContent = '写入 ' + writes; return { errMsg: 'setStorage:ok' }; },
        async removeStorage({ key }) { delete data[key]; persist(); return { errMsg: 'removeStorage:ok' }; },
        async getStorageInfo() { return { errMsg: 'getStorageInfo:ok', keys: Object.keys(data), usedBytes: JSON.stringify(data).length, limitBytes: 10 * 1024 * 1024 }; }
    } };
    document.addEventListener('DOMContentLoaded', () => {
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;bottom:0;left:0;z-index:90000;font-size:10px;background:#fff;display:flex;gap:4px';
        panel.innerHTML = '<button id="fixture-upload">测试图片</button><button id="fixture-geometry">切换按钮位置</button><button id="fixture-failure">切换存储失败</button><button id="fixture-clear">清理测试数据</button><span id="fixture-count">写入 0</span>';
        document.body.append(panel);
        const controls = document.createElement('div');
        controls.innerHTML = '<span style="position:fixed;left:10px;top:30px;width:32px;height:32px;border-radius:50%;background:#aaa7b4;color:white;text-align:center;line-height:32px;z-index:9999">‹</span><span style="position:fixed;right:10px;top:30px;width:32px;height:32px;border-radius:50%;background:#aaa7b4;color:white;text-align:center;line-height:32px;z-index:9999">↗</span>';
        document.body.append(controls);
        document.getElementById('fixture-upload').onclick = () => {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
            ctx.fillStyle = '#ff5588'; ctx.fillRect(12, 12, 40, 40); ctx.fillStyle = '#222222'; ctx.fillRect(26, 26, 12, 12);
            canvas.toBlob(blob => {
                const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'fixture.png', { type: 'image/png' }));
                const input = document.getElementById('file-upload'); input.files = transfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        };
        document.getElementById('fixture-geometry').onclick = () => { large = !large; dispatchEvent(new Event('resize')); };
        document.getElementById('fixture-failure').onclick = event => { fail = !fail; event.target.textContent = fail ? '恢复存储' : '切换存储失败'; };
        document.getElementById('fixture-clear').onclick = () => { data = {}; localStorage.removeItem(key); };
    });
})();
