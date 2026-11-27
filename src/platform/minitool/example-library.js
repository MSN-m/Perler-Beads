// Only the MiniTool build installs this library. The website keeps its gallery.
export function createExampleGroupLoader(host = window, doc = document) {
    const pending = new Map();
    host.__perlerReceiveExampleGroup = (id, records) => {
        const request = pending.get(id);
        if (request) request.records = records;
    };
    return group => {
        if (pending.has(group.id)) return pending.get(group.id).promise;
        const request = {};
        request.promise = new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            let timer;
            const finish = error => {
                clearTimeout(timer);
                script.onload = script.onerror = null;
                script.remove();
                pending.delete(group.id);
                if (error) reject(error);
                else resolve(request.records);
                request.records = null;
            };
            script.src = group.src;
            script.onload = () => finish(Array.isArray(request.records) && request.records.length === group.count
                ? null : new Error('Invalid example group: ' + group.id));
            script.onerror = () => finish(new Error('Example group unavailable: ' + group.id));
            timer = setTimeout(() => finish(new Error('Example group timed out: ' + group.id)), 15000);
            pending.set(group.id, request);
            doc.head.appendChild(script);
        });
        return request.promise;
    };
}

export function expandExamplePattern(record) {
    return {
        name: record.name, gridWidth: record.gridWidth, gridHeight: record.gridHeight,
        brand: record.brand, mardSet: record.mardSet,
        pixelData: record.indices.map(index => {
            const [id, r, g, b] = record.colors[index];
            return { id, r, g, b };
        })
    };
}

function renderCard(grid, record, openExample) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'mobile-home-card';
    card.setAttribute('aria-label', `打开示例图纸：${record.name}`);
    card.style.setProperty('--cover-width', `${Math.min(80, 85 * (225 / 169) * (record.gridWidth / record.gridHeight))}%`);
    const canvas = document.createElement('canvas');
    canvas.width = record.gridWidth;
    canvas.height = record.gridHeight;
    const context = canvas.getContext('2d');
    const image = context.createImageData(canvas.width, canvas.height);
    record.indices.forEach((colorIndex, index) => {
        const [id, r, g, b] = record.colors[colorIndex];
        if (id !== 'NONE') image.data.set([r, g, b, 255], index * 4);
    });
    context.putImageData(image, 0, 0);
    card.addEventListener('click', () => openExample(expandExamplePattern(record)));
    card.appendChild(canvas);
    grid.appendChild(card);
}

export function installMiniToolExamples(container, groups, openExample, loadGroup = createExampleGroupLoader()) {
    container.classList.add('minitool-example-library');
    let active = null;
    const states = [];
    const clear = state => {
        state.version += 1;
        state.records = null;
        state.grid.querySelectorAll('canvas').forEach(canvas => { canvas.width = canvas.height = 0; });
        state.grid.textContent = '';
        state.body.hidden = true;
        state.button.setAttribute('aria-expanded', 'false');
        state.more.hidden = true;
    };
    const appendPage = state => {
        const end = Math.min(state.shown + 12, state.records.length);
        for (; state.shown < end; state.shown += 1) renderCard(state.grid, state.records[state.shown], openExample);
        state.more.hidden = end >= state.records.length;
    };
    const open = async state => {
        if (active) clear(active);
        active = state;
        const version = ++state.version;
        state.body.hidden = false;
        state.button.setAttribute('aria-expanded', 'true');
        state.status.textContent = '正在加载图纸…';
        state.retry.hidden = true;
        try {
            const records = await loadGroup(state.group);
            if (active !== state || state.version !== version) return;
            state.records = records;
            state.shown = 0;
            appendPage(state);
            state.status.textContent = '';
        } catch (error) {
            if (active !== state || state.version !== version) return;
            clear(state);
            state.body.hidden = false;
            state.button.setAttribute('aria-expanded', 'true');
            state.status.textContent = '图纸加载失败，请重试。';
            state.retry.hidden = false;
            console.warn('Example group could not be loaded.', error);
        }
    };
    groups.forEach(group => {
        const section = document.createElement('section');
        section.className = 'minitool-example-group';
        const heading = document.createElement('h3');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'minitool-example-heading';
        button.textContent = `${group.title} · ${group.count} 张`;
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', 'example-group-' + group.id);
        heading.appendChild(button);
        const body = document.createElement('div');
        body.id = 'example-group-' + group.id;
        body.hidden = true;
        const status = document.createElement('p');
        status.setAttribute('role', 'status');
        const grid = document.createElement('div');
        grid.className = 'mobile-home-grid';
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'minitool-example-more';
        more.textContent = '显示更多';
        more.hidden = true;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'minitool-example-more';
        retry.textContent = '重新加载';
        retry.hidden = true;
        [status, grid, more, retry].forEach(element => body.appendChild(element));
        if (!group.ungrouped) section.appendChild(heading);
        section.appendChild(body);
        container.appendChild(section);
        const state = { group, button, body, grid, status, more, retry, records: null, version: 0, shown: 0 };
        button.addEventListener('click', () => {
            if (active === state && !body.hidden) { clear(state); active = null; }
            else open(state);
        });
        more.addEventListener('click', () => appendPage(state));
        retry.addEventListener('click', () => open(state));
        states.push(state);
    });
    const initial = states.find(state => state.group.defaultOpen);
    if (initial) open(initial);
}
