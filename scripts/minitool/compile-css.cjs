// Build-time tool only; no compiler code or native bindings enter the upload ZIP.
const fs = require('fs');
const path = require('path');
const lc = require(process.env.PERLER_LIGHTNINGCSS);
const [input, output, metadata] = process.argv.slice(2);
const source = fs.readFileSync(input, 'utf8').replace(/\binfinity\b/g, '9999');
const has = [], gaps = [], aspects = [], transforms = [], enhancements = [];
const serialize = selectors => {
  const result = lc.transform({ filename: 'selector.css', code: Buffer.from('a{color:red}'), visitor: {
    Rule(rule) { if (rule.type === 'style') { rule.value.selectors = selectors; return rule; } }
  }}).code.toString();
  return result.slice(0, result.indexOf('{')).trim();
};
function selectorsLegacy(selectors) {
  return selectors.flatMap(selector => {
    let alternatives = [[]];
    selector.forEach((part, index) => {
      if (part.type === 'pseudo-class' && (part.kind === 'where' || part.kind === 'is')) {
        const inner = selectorsLegacy(part.selectors);
        alternatives = alternatives.flatMap(prefix => inner.map(option => prefix.concat(option)));
      } else {
        if (part.type === 'pseudo-class' && part.kind === 'has') {
          const base = serialize([selector.slice(0, index)]);
          const inner = serialize(part.selectors);
          let rule = has.find(rule => rule.base === base && rule.inner === inner);
          if (!rule) { rule = { base, inner, name: 'pb-has-' + has.length }; has.push(rule); }
          part = { type: 'class', name: rule.name };
        } else if (part.type === 'pseudo-class' && part.kind === 'focus-visible') part = { type: 'pseudo-class', kind: 'focus' };
        else if (part.selectors) part = { ...part, selectors: selectorsLegacy(part.selectors) };
        alternatives.forEach(prefix => prefix.push(part));
      }
    });
    return alternatives;
  });
}
const defaults = [];
for (const match of source.matchAll(/@property\s+(--[\w-]+)\s*\{([^}]+)\}/g)) {
  const initial = match[2].match(/initial-value\s*:\s*([^;]+)/);
  if (initial) defaults.push(match[1] + ':' + initial[1]);
}
const flattened = lc.transform({ filename: path.basename(input), code: Buffer.from(source), minify: false,
  visitor: {
    Rule(rule) {
      // 1.30.2 serializes absent optional fields as null but expects them omitted on return.
      rule = JSON.parse(JSON.stringify(rule, (key, value) => value === null ? undefined : typeof value === 'number' && value > 1e15 ? 9999 : value));
      if (rule.type === 'layer-block') return rule.value.rules;
      if (rule.type === 'layer-statement' || rule.type === 'property') return [];
    }
  }
}).code;
const compiled = lc.transform({ filename: path.basename(input), code: flattened, targets: { chrome: 61 << 16 }, minify: false,
  visitor: { Rule(rule) {
    if (rule.type !== 'style') return;
    rule = JSON.parse(JSON.stringify(rule, (key, value) => value === null ? undefined : typeof value === 'number' && value > 1e15 ? 9999 : value));
    rule.value.selectors = selectorsLegacy(rule.value.selectors);
    return rule;
  }}
}).code.toString();
// Split comma/space lists while respecting CSS functions and quoted values.
function split(value, delimiter = ',') {
  let depth = 0, quote = '', start = 0;
  const parts = [];
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) { if (c === quote && value[i - 1] !== '\\') quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(') depth++;
    if (c === ')') depth--;
    if (!depth && (delimiter === ' ' ? /\s/.test(c) : c === delimiter)) { if (value.slice(start, i).trim()) parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  if (value.slice(start).trim()) parts.push(value.slice(start).trim());
  return parts;
}
function fallbackFunctions(value) {
  const pattern = /\b(min|max|clamp|color-mix)\(/g;
  let match;
  while ((match = pattern.exec(value))) {
    let end = pattern.lastIndex, depth = 1;
    while (end < value.length && depth) { if (value[end] === '(') depth++; if (value[end] === ')') depth--; end++; }
    const parts = split(value.slice(pattern.lastIndex, end - 1)).map(fallbackFunctions);
    let replacement;
    if (match[1] === 'color-mix') replacement = parts[1].replace(/\s+[\d.]+%\s*$/, '');
    else if (match[1] === 'clamp') replacement = parts[1];
    else replacement = parts.find(part => /%|v[wh]/.test(part)) || parts[parts.length - 1];
    value = value.slice(0, match.index) + replacement + value.slice(end);
    pattern.lastIndex = 0;
  }
  return value;
}
function lowerBody(body, selector) {
  return body.replace(/(^|[;\n])\s*([\w-]+)\s*:\s*([^;{}]+);/g, (all, start, prop, value) => {
    let extra = '';
    const important = /\s*!important\s*$/.test(value) ? ' !important' : '';
    const plain = value.replace(/\s*!important\s*$/, '');
    const logical = prop.match(/^(padding|margin)-(inline|block)(?:-(start|end))?$/);
    if (logical) {
      const values = split(plain, ' ');
      const sides = logical[2] === 'inline' ? ['left', 'right'] : ['top', 'bottom'];
      const selected = logical[3] ? [logical[3] === 'start' ? 0 : 1] : [0, 1];
      selected.forEach(index => { extra += logical[1] + '-' + sides[index] + ':' + (values[index] || values[0]) + important + ';'; });
    }
    if (prop === 'inset') {
      const values = split(plain, ' ');
      const edges = [values[0], values[1] || values[0], values[2] || values[0], values[3] || values[1] || values[0]];
      ['top', 'right', 'bottom', 'left'].forEach((edge, index) => { extra += edge + ':' + edges[index] + important + ';'; });
    }
    if (prop === 'aspect-ratio') { extra += '--pb-aspect:' + plain + ';'; if (selector) aspects.push(selector); }
    if (prop === 'transform') extra += '--pb-transform:' + (plain === 'none' ? 'translate(0px)' : plain) + ';';
    if (['translate', 'rotate', 'scale'].includes(prop)) {
      if (selector) transforms.push(selector);
      const parts = split(plain, ' ');
      if (prop === 'translate') extra += '--pb-tx:' + (parts[0] === 'none' ? '0px' : parts[0]) + ';--pb-ty:' + (parts[1] || '0px') + ';';
      if (prop === 'rotate') extra += '--pb-rotate:' + (plain === 'none' ? '0deg' : plain) + ';';
      if (prop === 'scale') extra += '--pb-sx:' + (plain === 'none' ? '1' : parts[0]) + ';--pb-sy:' + (plain === 'none' ? '1' : parts[1] || parts[0]) + ';';
    }
    if (prop === 'gap' || prop === 'row-gap' || prop === 'column-gap') {
      const parts = split(plain, ' ');
      if (prop !== 'column-gap') extra += '--pb-gap-y:' + parts[0] + important + ';';
      if (prop !== 'row-gap') extra += '--pb-gap-x:' + (parts[1] || parts[0]) + important + ';';
      if (selector) gaps.push(selector);
      if (prop === 'gap') extra += 'grid-gap:' + plain + important + ';';
    }
    let fallback = fallbackFunctions(plain);
    fallback = fallback.replace(/env\(safe-area-inset-([\w]+),?\s*[^)]*\)/g, 'var(--safe-area-inset-$1, 0px)');
    fallback = fallback.replace(/([\d.]+)[dsl]vh/g, (_, number) => Number(number) === 100 ? 'var(--app-height, 100vh)' : 'calc(var(--app-height, 100vh) * ' + Number(number) / 100 + ')');
    if (fallback !== plain) extra += prop + ':' + fallback + important + ';';
    const enhanced = plain.replace(/env\(safe-area-inset-([\w]+),?\s*([^)]*)\)/g, (_, side, initial) => 'var(--safe-area-inset-' + side + ', env(safe-area-inset-' + side + ', ' + (initial || '0px') + '))');
    // Unknown functions remain valid tokens in custom properties; a later modern
    // value would overwrite the fallback even on an old parser. Gate that value.
    if (prop.startsWith('--') && fallback !== plain && selector) {
      const conditions = [];
      if (/color-mix\(/.test(plain)) conditions.push('(color:color-mix(in srgb,red,blue))');
      if (/\b(min|max|clamp)\(/.test(plain)) conditions.push('(width:min(1px,2px))');
      if (/[dsl]vh/.test(plain)) conditions.push('(height:100dvh)');
      if (/env\(/.test(plain)) conditions.push('(padding:env(safe-area-inset-bottom))');
      if (conditions.length) enhancements.push('@supports ' + conditions.join(' and ') + '{' + selector + '{' + prop + ':' + enhanced + important + ';}}');
      return start + extra;
    }
    return start + extra + prop + ':' + enhanced + important + ';';
  });
}
// Lightning CSS has already expanded nesting. Each innermost block is now a rule.
let text = compiled.replace(/([^{}]+)\{([^{}]*)\}/g, (all, header, body) => {
  const selector = header.trim().startsWith('@') ? null : header.trim();
  return header + '{' + lowerBody(body, selector) + '}';
});
text = '*,::before,::after{--pb-gap-x:0px;--pb-gap-y:0px;--pb-aspect:0;--pb-tx:0px;--pb-ty:0px;--pb-rotate:0deg;--pb-sx:1;--pb-sy:1;--pb-transform:translate(0px);' + defaults.join(';') + '}\n' + text;
text += '\n@supports not (translate:0px){' + [...new Set(transforms)].map(selector => selector + '{transform:translate(var(--pb-tx),var(--pb-ty)) rotate(var(--pb-rotate)) scale(var(--pb-sx),var(--pb-sy)) var(--pb-transform)}').join('\n') + '}';
text += '\n' + enhancements.join('\n');
// Recompile defaults/colors, retain declaration fallbacks for the chosen target.
const final = lc.transform({ filename: 'style.css', code: Buffer.from(text), targets: { chrome: 61 << 16 }, minify: false }).code;
fs.writeFileSync(output, final);
fs.writeFileSync(metadata, JSON.stringify({ has, gaps: [...new Set(gaps)], aspects: [...new Set(aspects)] }, null, 2));
console.log(JSON.stringify({ cssBytes: final.length, hasRules: has.length, gapSelectors: new Set(gaps).size }));
