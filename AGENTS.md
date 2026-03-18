# Perler Beads é¡¹ç›® - AI åŠ©æ‰‹å¼€å‘è§„åˆ™

> æœ¬æ–‡ä»¶ä¾›æ‰€æœ‰å‚ä¸æ­¤é¡¹ç›®çš„ AI åŠ©æ‰‹é˜…è¯»ï¼ŒåŒ…å«é¡¹ç›®çº¦å®šã€å¼€å‘è§„èŒƒå’Œå†å²ç»éªŒæ•™è®­ã€‚
> æ¯æ¬¡ä¼šè¯å¼€å§‹æ—¶è¯·å…ˆé˜…è¯»æœ¬æ–‡ä»¶å’Œæœ€æ–°çš„ `docs/archive/DEVELOPMENT_SUMMARY_*.md`ã€‚

---

## 1. é¡¹ç›®æ¦‚è§ˆ

**æ‹¼è±†å›¾æ¡ˆç”Ÿæˆå™¨**ï¼šä¸Šä¼ å›¾ç‰‡ â†’ è‡ªåŠ¨åƒç´ åŒ– â†’ åŒ¹é…æ‹¼è±†é¢œè‰²è°ƒè‰²æ¿ â†’ ç”Ÿæˆå¯æ‰“å°å›¾çº¸ã€‚

### æŠ€æœ¯æ ˆ
- çº¯å‰ç«¯ï¼šHTML + Vanilla JSï¼ˆES Moduleï¼‰+ Tailwind CSSï¼ˆCDNï¼‰
- æ— æ„å»ºå·¥å…·ã€æ— æ¡†æ¶ã€æ— åç«¯
- å…¥å£ï¼š`index.html`ï¼Œé€»è¾‘åˆ†å¸ƒåœ¨ `src/` ä¸‹ 8 ä¸ªæ¨¡å—

### æ¨¡å—èŒè´£

| æ–‡ä»¶ | èŒè´£ |
|------|------|
| `src/main.js` | äº‹ä»¶ç»‘å®šå…¥å£ï¼ŒDOMContentLoaded é‡Œç»‘å®šæ‰€æœ‰æŒ‰é’®å’Œç”»å¸ƒäº‹ä»¶ |
| `src/ui.js` | UI äº¤äº’é€»è¾‘ï¼šé¢œè‰²è°ƒæ•´ã€åˆ é™¤è‰²å—ã€è¾¹ç¼˜è°ƒæ•´ã€ç¼©æ”¾å¹³ç§»ã€é¢œè‰²æ¸…å• |
| `src/state.js` | å…¨å±€çŠ¶æ€ `AppState`ï¼Œæ‰€æœ‰æ¨¡å—å…±äº« |
| `src/renderer.js` | Canvas æ¸²æŸ“ï¼šå›¾çº¸ç»˜åˆ¶ã€ç¼©æ”¾å˜æ¢ã€åæ ‡ç³»è®¡ç®— |
| `src/processor.js` | å›¾åƒå¤„ç†ï¼šèƒŒæ™¯ç§»é™¤ã€é¢œè‰²é‡åŒ–ã€æŠ–åŠ¨ç®—æ³•ã€è°ƒè‰²æ¿è¿‡æ»¤ |
| `src/constants.js` | è°ƒè‰²æ¿æ•°æ®ï¼ˆPerler/Hama/Artkal/MARDï¼‰ |
| `src/exporter.js` | å›¾ç‰‡å¯¼å‡ºï¼ˆåŸå›¾/é•œåƒ/å¸¦æ ‡æ³¨ï¼‰ |
| `src/utils.js` | é€šç”¨å·¥å…·å‡½æ•° |

---

## 2. å…³é”®çŠ¶æ€å­—æ®µï¼ˆAppStateï¼‰

ä¿®æ”¹å‰å¿…é¡»ç†è§£è¿™äº›å­—æ®µçš„å«ä¹‰ï¼Œæ”¹é”™ä¼šå½±å“å¤šä¸ªåŠŸèƒ½ï¼š

```js
AppState = {
    // ç¼–è¾‘æ¨¡å¼ï¼š'none' | 'adjust' | 'delete'
    editMode,

    // è°ƒæ•´é˜¶æ®µï¼š'waiting_receiver' | 'waiting_donor'
    adjustPhase,

    // é¢œè‰²è°ƒæ•´ï¼šæ¥æ”¶æ ¼ï¼ˆè¢«æ›¿æ¢ï¼‰çš„ç´¢å¼•å’Œé¢œè‰²ID
    receiverIndex,
    receiverColorId,

    // æš‚å­˜åŒºï¼šæ‰€æœ‰è°ƒæ•´/åˆ é™¤æ“ä½œåœ¨æ­¤è¿›è¡Œï¼Œconfirm åå†™å…¥ pixelData
    stagedPixelData,
    stagedActions,  // æ’¤å›æ ˆ

    // æ¸²æŸ“åæ ‡ç³»ï¼ˆrenderer.js æ¯æ¬¡æ¸²æŸ“åæ›´æ–°ï¼‰
    renderedMinX,   // å†…å®¹åŒ…å›´ç›’å·¦è¾¹ç•Œï¼ˆåŸå§‹åæ ‡ï¼‰
    renderedMinY,   // å†…å®¹åŒ…å›´ç›’ä¸Šè¾¹ç•Œï¼ˆåŸå§‹åæ ‡ï¼‰
    renderedContentWidth,
    renderedContentHeight,

    // ç¼©æ”¾å¹³ç§»çŠ¶æ€
    zoomState: { scale, x, y, isDragging, lastX, lastY, lastDist },

    // æ‰¹é‡æ›¿æ¢ï¼ˆé¢œè‰²æ¸…å•èœå•è§¦å‘ï¼‰
    batchReplace: { active, mode, sourceColorId, nearCandidates, nearBaseline, nearCurrentId },

    // è¾¹ç¼˜è°ƒæ•´
    edgeSelectionMode,
    selectedEdgeBeadsIndices,

    deleteMode,
    highlightedColorId,
}
```

---

## 3. åæ ‡ç³»è¯´æ˜ï¼ˆé‡è¦ï¼‰

æ¸²æŸ“å™¨ä½¿ç”¨**å†…å®¹åŒ…å›´ç›’åæ ‡ç³»**ï¼Œä¸æ˜¯å›ºå®šç”»æ¿åæ ‡ç³»ï¼š

```
canvas åƒç´ åæ ‡ = gridOffset + (globalX - renderedMinX) * scale
```

- `scale = 30`ï¼ˆæ¯æ ¼ 30pxï¼‰
- `gridOffset = 30`ï¼ˆå·¦ä¸Šæ ‡å°ºå  1 æ ¼ï¼‰
- `renderedMinX/Y`ï¼šå†…å®¹æœ€å° X/Yï¼ˆæ¯æ¬¡ renderResult åæ›´æ–°åˆ° AppStateï¼‰

### ç‚¹å‡»åæ ‡è½¬ç½‘æ ¼åæ ‡çš„æ­£ç¡®å…¬å¼

```js
// rect = canvas.getBoundingClientRect()
const localX = e.clientX - rect.left;
const localY = e.clientY - rect.top;
// æ³¨æ„ï¼šlocalX å·²æ˜¯ç›¸å¯¹ canvas æ˜¾ç¤ºå·¦ä¸Šè§’çš„åç§»ï¼Œç›´æ¥é™¤ä»¥ scale
const canvasX = localX / AppState.zoomState.scale;
const canvasY = localY / AppState.zoomState.scale;
const xOnRenderedGrid = Math.floor((canvasX - gridOffset) / scale);
const yOnRenderedGrid = Math.floor((canvasY - gridOffset) / scale);
const gx = AppState.renderedMinX + xOnRenderedGrid;  // åŸå§‹ pixelData åæ ‡
const gy = AppState.renderedMinY + yOnRenderedGrid;
const idx = gy * AppState.gridWidth + gx;
```

**å¸¸è§é”™è¯¯**ï¼šä¸è¦ç”¨ `(localX - zoomState.x) / zoomState.scale`ï¼Œ`zoomState.x` æ˜¯å®¹å™¨çº§åç§»ï¼Œ`getBoundingClientRect` å·²ç»åŒ…å«äº†å®ƒã€‚

---

## 4. ç¼–è¾‘æ¨¡å¼çš„äº’æ–¥å…³ç³»

ä¸‰ç§ç¼–è¾‘æ¨¡å¼å®Œå…¨äº’æ–¥ï¼Œè¿›å…¥ä»»æ„ä¸€ç§ä¼šè‡ªåŠ¨é€€å‡ºå…¶ä»–ï¼š

```
adjustï¼ˆé¢œè‰²è°ƒæ•´ï¼‰
  â”œâ”€ æ™®é€šå­æ¨¡å¼ï¼šä¸¤é˜¶æ®µå•æ ¼æ›¿æ¢ï¼ˆwaiting_receiver â†’ waiting_donorï¼‰
  â”œâ”€ from_canvasï¼šç‚¹å‡»ç”»å¸ƒé€‰è‰²åæ‰¹é‡æ›¿æ¢ï¼ˆbatchReplace.mode === 'from_canvas'ï¼‰
  â”œâ”€ nearbyï¼šé¢œè‰²æ¸…å•é€‰ç›¸è¿‘è‰²æ›¿æ¢ï¼ˆbatchReplace.mode === 'nearby'ï¼‰
  â””â”€ edgeï¼šè¾¹ç¼˜è‰²å—æ‰¹é‡æ›¿æ¢ï¼ˆedgeSelectionMode === trueï¼‰

deleteï¼ˆåˆ é™¤è‰²å—ï¼‰ï¼šç‚¹å‡»å•æ ¼ â†’ ç¡®è®¤å¼¹çª— â†’ è®¾ä¸º NONE

noneï¼šæ­£å¸¸æµè§ˆæ¨¡å¼ï¼Œå¯æ‹–æ‹½å¹³ç§»
```

**åœ¨ adjust æˆ– delete æ¨¡å¼ä¸‹å¿…é¡»ç¦ç”¨æ‹–æ‹½**ï¼Œç›¸å…³äº‹ä»¶æ£€æŸ¥ï¼š

```js
// main.js ä¸­ä»¥ä¸‹äº‹ä»¶éƒ½è¦æ£€æŸ¥
mousedown:  if (editMode === 'adjust' || editMode === 'delete') return;
mousemove:  if (editMode === 'adjust' || editMode === 'delete') return;
mouseup:    if (editMode === 'adjust' || editMode === 'delete') return;
touchstart: if (editMode === 'adjust' || editMode === 'delete') return;
touchmove:  if (editMode === 'adjust' || editMode === 'delete') return;
touchend:   if (editMode === 'adjust' || editMode === 'delete') return;
```

---

## 5. æ’¤å›æ ˆçš„æ•°æ®æ ¼å¼

`stagedActions` æ”¯æŒä¸¤ç§æ ¼å¼ï¼Œ`adjustUndo` é€šè¿‡ `Array.isArray(action.indices)` åŒºåˆ†ï¼š

```js
// å•æ ¼æ“ä½œï¼ˆé¢œè‰²è°ƒæ•´å•æ ¼æ›¿æ¢ã€åˆ é™¤è‰²å—ï¼‰
{ index: number, prevColor: {id,r,g,b}, nextColor: {id,r,g,b} }

// æ‰¹é‡æ“ä½œï¼ˆfrom_canvas æ‰¹é‡æ›¿æ¢ã€è¾¹ç¼˜è°ƒæ•´ï¼‰
{ indices: number[], prevColors: [{id,r,g,b},...], nextColor: {id,r,g,b} }
```

---

## 6. æ–‡ä»¶ç¼–ç è§„èŒƒ

- æ‰€æœ‰ `src/` ä¸‹çš„ JS æ–‡ä»¶ï¼š**CRLF æ¢è¡Œç¬¦ï¼ŒUTF-8 ç¼–ç **
- `index.html`ã€`css/style.css`ï¼šCRLF
- ä¸è¦æ··ç”¨ LF å’Œ CRLFï¼Œä¼šå¯¼è‡´ StrReplace å·¥å…·åŒ¹é…å¤±è´¥

---

## 7. æ”¹åŠ¨å®‰å…¨è§„èŒƒ

### æ”¹åŠ¨å‰å¿…åš
1. é˜…è¯»è¢«ä¿®æ”¹å‡½æ•°çš„å®Œæ•´ä»£ç ï¼Œä¸è¦åªçœ‹ç‰‡æ®µ
2. ç”¨ `Grep` æœç´¢å‡½æ•°åï¼Œç¡®è®¤æ‰€æœ‰è°ƒç”¨æ–¹
3. åˆ—å‡ºè¯¥å‡½æ•°æ¶‰åŠçš„ `AppState` å­—æ®µï¼Œè¯„ä¼°å½±å“èŒƒå›´
4. ç¡®è®¤æ”¹åŠ¨ä¸ä¼šå½±å“å…¶ä»–ç¼–è¾‘æ¨¡å¼

### æ”¹åŠ¨ä¸­
- ä¸€æ¬¡åªæ”¹ä¸€ä»¶äº‹ï¼Œæ”¹å®Œç«‹å³éªŒè¯
- ä¼˜å…ˆä½¿ç”¨ `StrReplace` å·¥å…·ç²¾ç¡®æ›¿æ¢ï¼Œé¿å…æ•´æ–‡ä»¶é‡å†™
- ä¸è¦ç”¨ PowerShell here-string åšå¤šè¡Œæ›¿æ¢ï¼ˆæ¢è¡Œç¬¦ä¸ç¨³å®šï¼‰
- ç”¨ `ReadLints` æ£€æŸ¥æ¯æ¬¡æ”¹åŠ¨åæ˜¯å¦å¼•å…¥è¯­æ³•é”™è¯¯

### æ”¹åŠ¨å
- è¿è¡Œ `ReadLints` ç¡®è®¤æ—  lint é”™è¯¯
- åœ¨æµè§ˆå™¨ä¸­æµ‹è¯•è¢«æ”¹åŠ¨çš„åŠŸèƒ½
- åŒæ—¶æµ‹è¯•ç›¸å…³è”çš„åŠŸèƒ½ï¼ˆåŒä¸€å‡½æ•°æœåŠ¡å¤šä¸ªæ¨¡å¼æ—¶ï¼‰
- é€šè¿‡åæ‰§è¡Œ `git commit`ï¼Œæäº¤ä¿¡æ¯è¯´æ˜æ”¹äº†ä»€ä¹ˆã€ä¸ºä»€ä¹ˆ

---

## 8. å½’æ¡£è§„èŒƒ

æ”¶åˆ°"**ä¸€é”®å½’æ¡£**"æŒ‡ä»¤æ—¶ï¼š
1. åˆ†æå½“å‰ä¼šè¯çš„æ‰€æœ‰æ”¹åŠ¨
2. ç”Ÿæˆæ€»ç»“æ–‡æ¡£ï¼Œä¿å­˜åˆ° `docs/archive/DEVELOPMENT_SUMMARY_YYYYMMDD_HHMM.md`
3. å†…å®¹åŒ…å«ï¼šåŠŸèƒ½å˜æ›´ã€ä¿®æ”¹æ–‡ä»¶æ¸…å•ã€å·²çŸ¥ Bug ç°çŠ¶ã€ä¸‹ä¸€æ­¥è®¡åˆ’

---

## 9. å·²çŸ¥å†å²é—®é¢˜å’Œç»éªŒæ•™è®­

### åæ ‡ç³»é—®é¢˜ï¼ˆå·²ä¿®å¤ï¼‰
- `drawReceiverOutline` ÔøÊ¹ÓÃ¾ÉµÄ¹Ì¶¨»­°å×ø±êÏµ£¨boardSize 52/104£©£¬ÏÖÒÑ¸ÄÎª renderedMinX/Y
- µã»÷×ø±ê×ª»»Ôø´íÎóµØ¼õÈ¥ zoomState.x/y£¬ÒÑĞŞ¸´ÎªÖ±½Ó³ıÒÔ scale

### ¶àÄ£Ê½¹²ÓÃº¯ÊıµÄ·çÏÕ
- handleResultCanvasClickForAdjust Í¬Ê±´¦Àí 4 ÖÖ×ÓÄ£Ê½£¨ÆÕÍ¨µ÷Õû/from_canvas/±ßÔµµ÷Õû/É¾³ı£©
- ĞŞ¸ÄÊ±±ØĞë¼ì²éËùÓĞ·ÖÖ§£¬²»ÄÜÖ»¸ÄÒ»¸ö·ÖÖ§
- ÍÏ×§ÊÂ¼ş×î³õÖ»ÅÅ³ıÁË adjust Ä£Ê½£¬ÒÅÂ©ÁË delete Ä£Ê½£¬µ¼ÖÂÉ¾³ıÊ±»­²¼ÂÒÒÆ

### state.js ½á¹¹Ëğ»µ£¨ÒÑĞŞ¸´£©
- ÔøÒò¶à´Î PowerShell ×Ö·û´®Ìæ»»Ê§°Üµ¼ÖÂ state.js ÄÚÈİË³Ğò´íÂÒ
- ÒÑÍêÕûÖØĞ´²¢ÕûÀí×Ö¶ÎË³Ğò
- ½ÌÑµ£º²»ÒªÓÃ PowerShell here-string ×ö¸´ÔÓµÄ¶àĞĞÌæ»»

### »»ĞĞ·û»ìÓÃ£¨ÒÑĞŞ¸´£©
- ui.js¡¢main.js¡¢processor.js Ôø³öÏÖ LF/CRLF »ìÓÃ
- µ¼ÖÂ StrReplace ¹¤¾ß·´¸´Ê§°Ü£¬±»ÆÈÓÃ×Ö½Ú²Ù×÷ÈÆ¹ı
- ÒÑÍ³Ò»Îª CRLF£¬½ñºóÖ±½ÓÓÃ StrReplace ¼´¿É

### º¯ÊıÌå±ÕºÏÀ¨ºÅ¶ªÊ§
- ¶à´Î PowerShell ²åÈë²Ù×÷ºó³öÏÖ export function Ç°È±ÉÙ } µÄÇé¿ö
- µ¼ÖÂ SyntaxError: Unexpected token 'export'
- Ã¿´Î²åÈë´úÂë¿éºó£¬ÓÃ ReadLints ÑéÖ¤Óï·¨£¬ÓÃ Read Ä¿ÊÓ¼ì²é²åÈëµãÇ°ºóµÄÀ¨ºÅ

---

## 10. µ±Ç°¹¦ÄÜ×´Ì¬£¨½ØÖÁ 2026-03-18£©

### Õı³£¹¤×÷
- Í¼Æ¬ÉÏ´« / Ê¾ÀıÍ¼Æ¬¼ÓÔØ
- ±³¾°ÒÆ³ı£¨µã»÷Ìî³ä£©¡¢³·Ïú¡¢ËéÆ¬ÇåÀí
- ÏñËØÃÜ¶Èµ÷Õû¡¢Æ·ÅÆ/Ì××°Ñ¡Ôñ¡¢ÑÕÉ«ÏŞÖÆ¡¢¶¶¶¯Ëã·¨
- Í¼Ö½Éú³ÉÓëÔ¤ÀÀ
- »­²¼Ëõ·Å£¨¹öÂÖ/Ë«Ö¸£©ºÍÆ½ÒÆ£¨ÍÏ×§£©
- ÑÕÉ«Çåµ¥ÏÔÊ¾¡¢ÑÕÉ«¸ßÁÁ
- ÑÕÉ«µ÷Õû£ºµ¥¸ñÁ½½×¶ÎÌæ»»£¨µã»÷Ñ¡¸ñ¡úµã»÷Ñ¡É«£©
- ÑÕÉ«µ÷Õû£º´ÓÍ¼Ö½ÅúÁ¿Ìæ»»£¨from_canvas£©
- ÑÕÉ«µ÷Õû£ºÏà½üÑÕÉ«Ìæ»»£¨nearby£¬´øÊµÊ±Ô¤ÀÀ£©
- É¾³ıÉ«¿é£ºµ¥¸ñµã»÷É¾³ı£¨´øÈ·ÈÏµ¯´°£©
- ±ßÔµµ÷Õû£º×Ô¶¯Ê¶±ğ±ßÔµ¸ñ£¬ÅúÁ¿Ìæ»»ÑÕÉ«
- ³·»Ø / È¡Ïû / È·ÈÏ£¨ËùÓĞ±à¼­Ä£Ê½Í¨ÓÃ£©
- Í¼Æ¬µ¼³ö£¨Ô­Í¼/¾µÏñ/´ø±ê×¢£©

### ÒÑÖªÎÊÌâ
- ÎŞ×Ô¶¯»¯²âÊÔ£¬¸Ä¶¯ÒÀÀµÈË¹¤ä¯ÀÀÆ÷ÑéÖ¤
- ÖÇÄÜ¶¶¶¯²ÎÊıÓ²±àÂë£¬Î´×ö³ÉÓÃ»§¿Éµ÷
- JPG£¨ÎŞÍ¸Ã÷Í¨µÀ£©±ßÔµÔÓÉ«´¦Àí½ÏÈõ

---

*±¾ÎÄ¼şÓÉ Claude ÕûÀíÓÚ 2026-03-18£¬ÇëÔÚÃ¿´ÎÖØ´ó¸Ä¶¯ºóÍ¬²½¸üĞÂ¡£*