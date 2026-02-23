import { PALETTES } from './src/constants.js';

const setGroups = {
    '221': ['A', 'B', 'C', 'D', 'E', '6', '8', '9', '10', '11', 'other']
};
const allowedGroups = setGroups['221'];

const palette = PALETTES.mard;
const filtered = palette.filter(c => {
    const isAllowed = c.groups.some(g => allowedGroups.includes(g));
    const isAMSeries = /^[ABCDEFGHM]\d+$/.test(c.id);
    return isAllowed && isAMSeries;
});

const unique = [];
const seen = new Set();
for (const color of filtered) {
    if (!seen.has(color.id)) {
        unique.push(color);
        seen.add(color.id);
    }
}

console.log(JSON.stringify(unique, null, 2));
