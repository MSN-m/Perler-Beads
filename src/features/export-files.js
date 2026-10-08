import { zipSync } from '../vendor/fflate-0.8.2.js';

/** One click requests one download: a PNG for one image, a ZIP for multiple images. */
export function createExportDelivery({ download, zip = zipSync, urls = URL, schedule = callback => setTimeout(callback, 60000) }) {
    let mode = null;
    return {
        get mode() { return mode; },
        reset() { mode = null; },
        start(files) {
            if (!files.length) throw new Error('请至少选择一张图纸');
            if (files.length === 1) {
                download(files);
                mode = 'png';
                return;
            }
            // Finish the entire archive before any download. PNG bytes stay unchanged.
            const entries = Object.create(null);
            for (const file of files) {
                if (!file.filename || /[\\/]/.test(file.filename) || Object.hasOwn(entries, file.filename)) {
                    throw new Error('导出图片文件名无效或重复');
                }
                entries[file.filename] = pngBytes(file.href);
            }
            // PNG is already compressed; ZIP STORE avoids expensive recompression.
            const bytes = zip(entries, { level: 0 });
            const href = urls.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
            try {
                download([{ type: 'archive', href, filename: files[0].archiveFilename || '未命名图纸-图纸合集.zip' }]);
            } catch (error) {
                urls.revokeObjectURL(href);
                throw error;
            }
            mode = 'zip';
            // Closing the modal must not revoke a download URL before the browser consumes it.
            schedule(() => urls.revokeObjectURL(href));
        }
    };
}

function pngBytes(href) {
    const encoded = href.match(/^data:image\/png;base64,(.+)$/)?.[1];
    if (!encoded) throw new Error('无法读取导出图片');
    return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
}
