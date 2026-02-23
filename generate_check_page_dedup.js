const fs = require('fs');
const path = require('path');

const constantsPath = path.join(__dirname, 'src/constants.js');
const outputPath = path.join(__dirname, 'color_check.html');

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

try {
    const content = fs.readFileSync(constantsPath, 'utf8');

    // Robustly extract MARD palette by counting brackets
    const mardStartRegex = /mard:\s*\[/;
    const matchStart = content.match(mardStartRegex);
    
    if (!matchStart) {
        throw new Error("Could not find MARD palette start in constants.js");
    }

    const startIndex = matchStart.index + matchStart[0].length;
    let bracketCount = 1;
    let endIndex = startIndex;

    for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '[') {
            bracketCount++;
        } else if (content[i] === ']') {
            bracketCount--;
        }

        if (bracketCount === 0) {
            endIndex = i;
            break;
        }
    }

    if (bracketCount !== 0) {
        throw new Error("Could not find matching closing bracket for MARD palette");
    }

    const mardContent = content.substring(startIndex, endIndex);

    const colors = [];
    const seenIds = new Set();
    
    // Regex to match color entries
    const colorRegex = /{\s*id:\s*'([A-Z0-9]+)',\s*(?:name:\s*'[^']+',\s*)?r:\s*(\d+),\s*g:\s*(\d+),\s*b:\s*(\d+)/g;
    
    let match;
    while ((match = colorRegex.exec(mardContent)) !== null) {
        const id = match[1];
        const r = parseInt(match[2]);
        const g = parseInt(match[3]);
        const b = parseInt(match[4]);
        const hex = rgbToHex(r, g, b);

        // Deduplicate by ID
        // The user said: "if color ID and color value are the same, show only once"
        // Since we are iterating sequentially, we just keep the first occurrence of an ID.
        // If there are different values for the same ID, the first one wins (or we could warn).
        // For H series duplicates, the values are identical, so skipping is safe.
        if (seenIds.has(id)) {
            continue;
        }

        seenIds.add(id);
        colors.push({ id, hex });
    }

    // Filter for A-M series only (though MARD should only have these, checking just in case)
    // The user mentioned "A-M nine series".
    const seriesColors = {};
    const validSeries = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'M'];

    colors.forEach(color => {
        const series = color.id.charAt(0);
        if (validSeries.includes(series)) {
            if (!seriesColors[series]) {
                seriesColors[series] = [];
            }
            seriesColors[series].push(color);
        }
    });

    // Sort colors within each series
    Object.keys(seriesColors).forEach(series => {
        seriesColors[series].sort((a, b) => {
            const numA = parseInt(a.id.slice(1));
            const numB = parseInt(b.id.slice(1));
            return numA - numB;
        });
    });

    // Generate HTML
    let htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MARD Color Check</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f7;
        }
        .container {
            display: flex;
            flex-direction: row;
            gap: 20px;
            overflow-x: auto;
            padding-bottom: 20px;
        }
        .series-column {
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-width: 120px;
        }
        .series-title {
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 10px;
            background-color: #eee;
            padding: 10px;
            border-radius: 8px;
        }
        .color-card {
            width: 120px;
            height: 80px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            border: 1px solid rgba(0,0,0,0.1);
        }
        .color-info-box {
            background-color: rgba(255, 255, 255, 0.9);
            padding: 4px 8px;
            border-radius: 4px;
            text-align: center;
            box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }
        .color-id {
            font-size: 18px;
            font-weight: bold;
            color: #333;
        }
        .color-hex {
            font-size: 12px;
            color: #666;
            font-family: monospace;
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <div class="container">
`;

    validSeries.forEach(series => {
        if (seriesColors[series] && seriesColors[series].length > 0) {
            htmlContent += `        <div class="series-column">\n`;
            htmlContent += `            <div class="series-title">${series}系列</div>\n`;
            
            seriesColors[series].forEach(color => {
                htmlContent += `            <div class="color-card" style="background-color: ${color.hex};">\n`;
                htmlContent += `                <div class="color-info-box">\n`;
                htmlContent += `                    <div class="color-id">${color.id}</div>\n`;
                htmlContent += `                    <div class="color-hex">${color.hex}</div>\n`;
                htmlContent += `                </div>\n`;
                htmlContent += `            </div>\n`;
            });
            
            htmlContent += `        </div>\n`;
        }
    });

    htmlContent += `    </div>
</body>
</html>`;

    fs.writeFileSync(outputPath, htmlContent);
    console.log("color_check.html updated successfully with deduplicated MARD colors.");

} catch (error) {
    console.error("Error:", error);
}
