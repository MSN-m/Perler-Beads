(function () {
    'use strict';
    const kind = document.body.getAttribute('data-kind');
    const heading = document.getElementById('heading');
    const message = document.getElementById('message');
    const menu = document.getElementById('menu');
    const screen = document.getElementById('screen');
    const next = document.getElementById('next');
    const webBack = document.getElementById('web-back');
    const logList = document.getElementById('events');
    const badge = document.getElementById('badge');
    const loaded = new Date();
    let mode = null;
    let step = 0;
    let previousStep = 0;
    let eventCount = 0;

    function log(name, detail) {
        eventCount++;
        const item = document.createElement('li');
        item.textContent = eventCount + '. ' + name + (detail ? ' — ' + detail : '');
        logList.insertBefore(item, logList.firstChild);
        while (logList.children.length > 16) logList.removeChild(logList.lastChild);
        document.getElementById('diagnostics').textContent =
            '地址片段：' + (location.hash || '无') + '\n' +
            '浏览器历史条数：' + history.length + '（可能包含容器自身记录）\n' +
            '本页加载时间：' + loaded.toLocaleTimeString() + '\n' +
            '平台接口：' + (window.xhs && window.xhs.miniTool ? '检测到' : '未检测到');
    }

    function route() {
        const match = /^#(a|b)-([123])$/.exec(location.hash);
        return match ? { mode: match[1], step: Number(match[2]) } : null;
    }

    function render(cause) {
        menu.hidden = step !== 0;
        screen.hidden = step === 0;
        if (!step) {
            heading.textContent = '系统返回测试';
            badge.textContent = '标准单页包 · A / B';
            message.textContent = '每种方式请单独重新打开测试。进入第二页后，先按小红书顶部的系统返回。';
            return;
        }
        badge.textContent = (mode === 'a' ? 'A · 页面历史记录' : 'B · 地址片段记录');
        heading.textContent = ['测试菜单', '第一页', '第二页', '第三页'][step];
        message.textContent = step === 1
            ? '请点“进入第二页”，再按小红书顶部的系统返回按钮。'
            : '现在请按小红书顶部的系统返回。正确结果：回到' + (step === 2 ? '第一页' : '第二页') + '，而不是退出小工具。';
        next.hidden = step === 3;
        next.textContent = step === 1 ? '进入第二页' : '进入第三页';
        webBack.disabled = step === 1;
        document.getElementById('result').textContent = cause && previousStep > step
            ? '网页确实收到后退：第' + previousStep + '页 → 第' + step + '页。' : '';
        document.body.setAttribute('data-step', String(step));
        heading.focus();
    }

    function stateFor(page) {
        const original = history.state && typeof history.state === 'object' ? history.state : {};
        return Object.assign({}, original, { perlerNavigationProbe: { mode: 'a', step: page } });
    }

    function start(selected) {
        mode = selected;
        previousStep = step;
        try {
            if (mode === 'a') {
                history.replaceState(stateFor(1), '', '#a-1');
                step = 1;
                render('start');
                log('A 已开始', 'replaceState 设置第一页');
            } else {
                // This case intentionally uses fragment navigation, not pushState.
                location.hash = 'b-1';
            }
        } catch (failure) {
            message.textContent = '这种方式被当前容器阻止，请截图记录，并退出后测试另一种方式。';
            log('启动失败', failure.message || String(failure));
        }
    }

    window.addEventListener('error', function (event) { log('脚本错误', event.message); });
    window.addEventListener('pageshow', function (event) { log('pageshow', event.persisted ? '从页面缓存恢复' : '页面显示'); });
    window.addEventListener('pagehide', function (event) { log('pagehide', event.persisted ? '进入页面缓存' : '页面将离开'); });
    document.addEventListener('visibilitychange', function () { log('可见状态', document.hidden ? '隐藏' : '显示'); });

    if (kind === 'single') {
        document.getElementById('case-a').disabled = false;
        document.getElementById('case-b').disabled = false;
        document.getElementById('case-a').addEventListener('click', function () { start('a'); });
        document.getElementById('case-b').addEventListener('click', function () { start('b'); });
        next.addEventListener('click', function () {
            if (step < 1 || step >= 3) return;
            const page = step + 1;
            if (mode === 'a') {
                try {
                    history.pushState(stateFor(page), '', '#a-' + page);
                    previousStep = step;
                    step = page;
                    render('button');
                    log('进入第' + page + '页', 'pushState 已执行；下一步请按系统返回');
                } catch (failure) { log('pushState 失败', failure.message || String(failure)); }
            } else location.hash = 'b-' + page;
        });
        window.addEventListener('popstate', function () {
            log('popstate', '收到浏览器历史切换事件');
            const current = route();
            if (current && current.mode === 'a') {
                previousStep = step;
                mode = current.mode;
                step = current.step;
                render('history');
            } else if (!current && mode === 'a') {
                previousStep = step;
                step = 0;
                render('history');
            }
        });
        window.addEventListener('hashchange', function () {
            const current = route();
            log('hashchange', location.hash || '返回测试菜单');
            if (current && current.mode === 'b') {
                previousStep = step;
                mode = current.mode;
                step = current.step;
                render('history');
            } else if (!current && mode === 'b') {
                previousStep = step;
                step = 0;
                render('history');
            }
        });
        const initial = route();
        if (initial) { mode = initial.mode; step = initial.step; }
        render('load');
    } else {
        step = Number(document.body.getAttribute('data-page'));
        badge.textContent = 'C · 两个 HTML 页面 · 兼容性实验';
        heading.textContent = step === 1 ? '第一页' : '第二页';
        message.textContent = step === 1
            ? '点“进入第二页”。如果打不开，说明当前平台可能不支持这种包内跳转，请记录现象。'
            : '这是第二个 HTML 页面。请按小红书顶部系统返回：观察是否回到第一页，还是直接退出。';
        log('独立页面加载', step === 1 ? 'index.html' : 'second.html');
    }
    webBack.addEventListener('click', function () {
        log('点击网页返回', '这是对照操作，不代表系统顶部按钮已生效');
        history.back();
    });
    document.getElementById('startup').hidden = true;
    log('测试已准备好', '没有自动添加用于阻止退出的历史记录');

    // Optional native geometry only. No persistence, permissions or account APIs.
    (async function () {
        const xhs = window.xhs;
        const api = xhs && xhs.miniTool;
        if (!api || typeof api.getWindowInfo !== 'function') return;
        try {
            let options = xhs.launchOptions;
            let version = Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion) || 0;
            if (!version && typeof api.getLaunchOptions === 'function') {
                options = await api.getLaunchOptions();
                version = Number(options && options.miniToolEnv && options.miniToolEnv.buildVersion) || 0;
            }
            if (Math.floor(version / 1000) < 9490) return;
            const info = await api.getWindowInfo();
            if (!info || info.errMsg !== 'getWindowInfo:ok') return;
            let bottom = info.safeArea && Number.isFinite(info.safeArea.top) ? info.safeArea.top : 0;
            if (info.menuButtons) Object.keys(info.menuButtons).forEach(function (key) {
                const box = info.menuButtons[key];
                if (box && Number.isFinite(box.bottom)) bottom = Math.max(bottom, box.bottom);
            });
            document.body.style.paddingTop = Math.max(88, bottom + 24) + 'px';
            log('原生位置已读取', '测试内容已避开顶部按钮');
        } catch (failure) { log('未读取到原生位置', '保留默认顶部留白'); }
    })();
})();
