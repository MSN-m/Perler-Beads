const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8080;

// 从命令行参数获取默认首页文件名，如果没有参数则使用 'index.html'
const DEFAULT_INDEX = process.argv[2] || 'index.html';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  // 解析请求的 URL 路径
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let urlPath = decodeURIComponent(url.pathname);

  // 如果请求的是根路径 '/', 则替换成默认首页文件名
  if (urlPath === '/') {
    urlPath = '/' + DEFAULT_INDEX;
  }

  // 安全检查：防止通过 ../ 等访问 ROOT 之外的目录
  const filePath = path.resolve(ROOT, '.' + urlPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // 读取文件并返回
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 文件不存在时返回 404，并提示缺失的文件名（便于调试）
      res.writeHead(404);
      res.end(`Not found: ${urlPath}`);
      return;
    }
    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Default index file: ${DEFAULT_INDEX}`);
});
