/* Independent five-second previews. No application state or IndexedDB writes. */
(() => {
    const data = window.REPLAY_SAMPLE;
    const image = new Image();
    const canvases = [...document.querySelectorAll('.stage canvas')];
    const cards = [...document.querySelectorAll('.card')];
    const play = document.querySelector('#play');
    const restart = document.querySelector('#restart');
    const timeline = document.querySelector('#timeline');
    const loop = document.querySelector('#loop');
    const modal = document.querySelector('#large');
    const labels = ['简洁渐变', '中心生长', '逐行扫描', '翻牌拼合', '轮廓填色', '斜向光波', '一朵大烟花', '数朵小烟花'];
    let activeGroup = document.body.dataset.previewSet === 'fireworks' ? 2 : 1;
    const W = 640, H = 800;
    const unit = Math.min(480 / data.width, 610 / data.height);
    const pw = data.width * unit, ph = data.height * unit;
    const ox = (W - pw) / 2, oy = 80 + (610 - ph) / 2;
    const clamp = n => Math.max(0, Math.min(1, n));
    const ease = n => { n = clamp(n); return n * n * (3 - 2 * n); };
    const same = (a,b) => a.every((v,i) => v === b[i]);
    const frames = [data.versions[0]?.pixels || data.pixels];
    const diffs = [];
    for (const version of data.versions.slice(1)) {
        const previous = frames.at(-1);
        if (version.pixels.length !== previous.length) continue;
        const changed = version.pixels.flatMap((p,i) => same(p,previous[i]) ? [] : [i]);
        if (changed.length) { frames.push(version.pixels); diffs.push(changed); }
    }
    if (!frames.at(-1).every((p,i) => same(p,data.pixels[i]))) {
        diffs.push(data.pixels.flatMap((p,i) => same(p,frames.at(-1)[i]) ? [] : [i]));
        frames.push(data.pixels);
    }
    const initial = frames[0];
    const outline = initial.map((p,i) => {
        if(!p[3])return false;
        const x=i%data.width,y=Math.floor(i/data.width);
        return (p[0]+p[1]+p[2])/3<65 || [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([nx,ny]) => nx<0||ny<0||nx>=data.width||ny>=data.height||!initial[ny*data.width+nx][3]);
    });
    const colors = [...new Set(initial.filter(p=>p[3]).map(p=>p.slice(0,3).join(',')))];
    colors.sort((a,b)=>a.split(',').reduce((s,v)=>s+Number(v),0)-b.split(',').reduce((s,v)=>s+Number(v),0));
    const colorRank = initial.map(p=>colors.indexOf(p.slice(0,3).join(',')));
    const rgb = p => `rgb(${p[0]},${p[1]},${p[2]})`;
    const photo = document.createElement('canvas'); photo.width = pw; photo.height = ph;
    const low = document.createElement('canvas');
    let seconds = 0, playing = false, previousTime = 0, opened = 0, loaded = false;

    function cell(ctx,i,p,size=1,alpha=1) {
        if (!p[3] || size <= 0 || alpha <= 0) return;
        const x=ox+(i%data.width)*unit, y=oy+Math.floor(i/data.width)*unit;
        ctx.globalAlpha=alpha*(p[3]/255); ctx.fillStyle=rgb(p);
        const inset=(1-size)*unit/2;
        ctx.fillRect(x+inset,y+inset,unit*size+0.08,unit*size+0.08);
        ctx.globalAlpha=1;
    }
    function pixels(ctx,array,alpha=1) { array.forEach((p,i)=>cell(ctx,i,p,1,alpha)); }
    function photoAt(ctx,alpha=1) { ctx.globalAlpha=clamp(alpha);ctx.drawImage(photo,ox,oy,pw,ph);ctx.globalAlpha=1; }
    function background(ctx) {
        ctx.fillStyle='#fcfbf8';ctx.fillRect(0,0,W,H);
        ctx.strokeStyle='#ece9e5';ctx.lineWidth=1;
        ctx.strokeRect(ox-16,oy-16,pw+32,ph+32);
        ctx.fillStyle='#bfb4b9';ctx.font='11px "Microsoft YaHei", sans-serif';ctx.textAlign='left';
        ctx.fillText('PHOTO → BEAD PATTERN',ox,40);
        ctx.fillStyle='#eee8eb';
        for(let y=oy;y<oy+ph;y+=unit*2)for(let x=ox;x<ox+pw;x+=unit*2){ctx.beginPath();ctx.arc(x+unit/2,y+unit/2,0.65,0,Math.PI*2);ctx.fill();}
    }
    function generate(ctx,variant,t) {
        if(variant>=6){generate(ctx,5,t);return;}
        if(variant===0) {
            const progress=ease((t-.5)/1.95);
            const cols=Math.max(data.width,Math.round(photo.width*(1-progress)**3));
            low.width=cols;low.height=Math.max(data.height,Math.round(cols*ph/pw));
            const lc=low.getContext('2d');lc.drawImage(photo,0,0,low.width,low.height);
            ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=1-ease((t-1.85)/.8);
            ctx.drawImage(low,ox,oy,pw,ph);ctx.restore();
            pixels(ctx,initial,ease((t-1.65)/1.1));
        } else if(variant===1) {
            photoAt(ctx,1-ease((t-.45)/.55));
            const radius=Math.hypot(data.width/2,data.height/2);
            initial.forEach((p,i)=>{
                const x=i%data.width+.5-data.width/2, y=Math.floor(i/data.width)+.5-data.height/2;
                const start=.65+Math.hypot(x,y)/radius*1.72;
                const age=clamp((t-start)/.28);
                cell(ctx,i,p,ease(age),age);
            });
        } else if(variant===2) {
            const progress=ease((t-.55)/2.05);
            ctx.save();ctx.beginPath();ctx.rect(ox,oy+ph*progress,pw,ph*(1-progress));ctx.clip();photoAt(ctx);ctx.restore();
            ctx.save();ctx.beginPath();ctx.rect(ox,oy,pw,ph*progress);ctx.clip();pixels(ctx,initial);ctx.restore();
            if(progress>0&&progress<1) {
                const y=oy+ph*progress;
                const glow=ctx.createLinearGradient(0,y-20,0,y+12);glow.addColorStop(0,'#df578e00');glow.addColorStop(.65,'#df578e33');glow.addColorStop(1,'#df578e00');
                ctx.fillStyle=glow;ctx.fillRect(ox,y-20,pw,32);
                ctx.strokeStyle='#df578e';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ox-8,y);ctx.lineTo(ox+pw+8,y);ctx.stroke();
            }
        } else if(variant===3) {
            const countX=8,countY=10,tw=pw/countX,th=ph/countY;
            for(let row=0;row<countY;row++)for(let col=0;col<countX;col++) {
                const start=.55+(col/(countX-1)+row/(countY-1))*.62+((col*7+row*11)%9)/9*.12;
                const progress=clamp((t-start)/.65);
                const stretch=Math.max(.015,Math.abs(Math.cos(progress*Math.PI)));
                const x=ox+col*tw,y=oy+row*th;
                ctx.save();ctx.translate(x+tw/2,y);ctx.scale(stretch,1);ctx.translate(-x-tw/2,-y);
                if(progress<.5)ctx.drawImage(photo,col*tw,row*th,tw,th,x,y,tw,th);
                else {
                    ctx.beginPath();ctx.rect(x,y,tw+.2,th+.2);ctx.clip();
                    for(let gy=Math.floor(row*data.height/countY);gy<Math.ceil((row+1)*data.height/countY);gy++)
                        for(let gx=Math.floor(col*data.width/countX);gx<Math.ceil((col+1)*data.width/countX);gx++){
                            const i=gy*data.width+gx;cell(ctx,i,initial[i]);
                        }
                }
                ctx.restore();
            }
        } else if(variant===4) {
            photoAt(ctx,1-ease((t-.5)/.35));
            initial.forEach((p,i)=>{
                const progress=outline[i]?ease((t-.65)/.55):ease((t-1.05-colorRank[i]/Math.max(1,colors.length-1)*1.15)/.45);
                cell(ctx,i,p,1,progress);
            });
        } else if(variant===5) {
            photoAt(ctx);
            const progress=ease((t-.55)/2.05);
            const edge=(pw+ph)*progress;
            // Intersect the diagonal reveal with the pattern bounds.
            ctx.save();ctx.beginPath();ctx.rect(ox,oy,pw,ph);ctx.clip();
            ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ox+edge,oy);ctx.lineTo(ox,oy+edge);ctx.closePath();ctx.clip();
            ctx.fillStyle='#fcfbf8';ctx.fillRect(ox,oy,pw,ph);pixels(ctx,initial);ctx.restore();
            if(progress>0&&progress<1) {
                ctx.save();ctx.beginPath();ctx.rect(ox,oy,pw,ph);ctx.clip();
                ctx.strokeStyle='#df578e22';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(ox+edge,oy);ctx.lineTo(ox,oy+edge);ctx.stroke();
                ctx.strokeStyle='#df578e';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
            }
        }
    }
    function history(ctx,t) {
        if(!diffs.length){pixels(ctx,data.pixels);return '最终图纸';}
        const span=1.15/diffs.length;
        const position=Math.max(0,(t-2.85)/span);
        const group=Math.min(diffs.length-1,Math.floor(position));
        const progress=clamp(position-group);
        const before=frames[group],after=frames[group+1],changed=diffs[group];
        pixels(ctx,before);
        const visible=Math.floor(ease(progress)*changed.length);
        for(let j=0;j<visible;j++) {
            const i=changed[j],x=ox+(i%data.width)*unit,y=oy+Math.floor(i/data.width)*unit;
            ctx.fillStyle='#fcfbf8';ctx.fillRect(x,y,unit+.1,unit+.1);cell(ctx,i,after[i]);
            const age=visible-j;
            if(age<35){ctx.strokeStyle=`rgba(223,87,142,${(1-age/35)*.8})`;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,unit-1,unit-1);}
        }
        return `保存版本变化 · 第 ${group+1} 组`;
    }
    function celebrationBurst(ctx,t,start,cx,cy,maxRadius,count,duration,seed) {
        const age=t-start;
        if(age<0||age>=duration)return;
        const p=age/duration, travel=1-(1-p)**2.6;
        const colors=['#f03986','#ffc34c','#a383ed','#ff805b','#61bec3'];
        ctx.save();ctx.lineCap='round';
        for(let i=0;i<count;i++) {
            const angle=i*Math.PI*2/count+seed;
            const speed=.73+((i*17+seed*100)%19)/70;
            const r=(5+maxRadius*travel)*speed;
            const x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r+p*p*25;
            const alpha=(1-p)**.65;
            ctx.globalAlpha=alpha;ctx.strokeStyle=colors[(i+Math.floor(seed*10))%colors.length];
            ctx.lineWidth=count>25?2.5:2.2;
            const trail=9+maxRadius*.1*(1-p);
            ctx.beginPath();ctx.moveTo(x-Math.cos(angle)*trail,y-Math.sin(angle)*trail);ctx.lineTo(x,y);ctx.stroke();
            ctx.fillStyle=ctx.strokeStyle;ctx.beginPath();ctx.arc(x,y,2.1,0,Math.PI*2);ctx.fill();
            if(count>25) {
                ctx.globalAlpha=alpha*.6;
                ctx.beginPath();ctx.arc(cx+Math.cos(angle+.06)*r*.62,cy+Math.sin(angle+.06)*r*.62+p*p*17,1.8,0,Math.PI*2);ctx.fill();
            }
        }
        if(p<.2){ctx.globalAlpha=(1-p/.2)*.85;ctx.fillStyle='#ffe5a2';ctx.beginPath();ctx.arc(cx,cy,13*(1-p/.2),0,Math.PI*2);ctx.fill();}
        ctx.restore();
    }
    function firework(ctx,t,variant) {
        if(variant===6){celebrationBurst(ctx,t,4.02,W/2,oy+ph*.18,180,44,.9,.2);return;}
        if(variant===7){
            [[4.0,ox+38,oy+ph*.18,65,.1],[4.08,ox+pw-34,oy+ph*.13,70,.5],[4.16,W/2,oy-6,56,.8],[4.24,ox+35,oy+ph*.64,62,1.2],[4.32,ox+pw-20,oy+ph*.62,66,1.6]].forEach(([start,x,y,r,seed])=>celebrationBurst(ctx,t,start,x,y,r,18,.58,seed));return;
        }
        const age=t-4.12;
        if(age<0||age>.78)return;
        const progress=age/.78, radius=7+39*(1-(1-progress)**2);
        const cx=ox+pw-12,cy=oy+ph*.14;
        const colors=['#df578e','#f1bc61','#b396d4'];
        ctx.save();ctx.lineCap='round';ctx.globalAlpha=(1-progress)**.7;
        for(let i=0;i<12;i++) {
            const angle=i*Math.PI/6-.2;
            const r=radius*(i%2?.76:1);
            const x=cx+Math.cos(angle)*r,y=cy+Math.sin(angle)*r+progress*progress*9;
            ctx.strokeStyle=colors[i%3];ctx.lineWidth=2;
            ctx.beginPath();ctx.moveTo(x-Math.cos(angle)*5,y-Math.sin(angle)*5);ctx.lineTo(x,y);ctx.stroke();
            ctx.fillStyle=colors[i%3];ctx.beginPath();ctx.arc(x,y,1.4,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
    }
    function render(canvas,variant,t) {
        const ctx=canvas.getContext('2d');background(ctx);
        let phase;
        if(t<.5){photoAt(ctx);phase='原图';}
        else if(t<2.85){generate(ctx,variant,t);phase='生成展示动画';}
        else if(t<4){phase=history(ctx,t);}
        else {pixels(ctx,data.pixels);firework(ctx,t,variant);phase='最终图纸';}
        ctx.fillStyle='#94858f';ctx.font='12px "Microsoft YaHei", sans-serif';ctx.textAlign='center';
        ctx.fillText(phase,W/2,742);
        ctx.fillStyle='#b7aab2';ctx.font='10px "Microsoft YaHei", sans-serif';
        ctx.fillText('64 × 80  /  MARD  /  14 COLORS',W/2,766);
        return phase;
    }
    function update() {
        if(!loaded)return;
        canvases.forEach((c,i)=>{const variant=Number(c.dataset.variant??i);if(Math.floor(variant/3)!==activeGroup)return;const phase=render(c,variant,seconds);cards[i].querySelector('.phase b').textContent=phase;cards[i].querySelector('.phase span').textContent=seconds.toFixed(1)+'s';cards[i].querySelector('.mini-track i').style.width=seconds/5*100+'%';});
        if(modal.open)render(modal.querySelector('canvas'),opened,seconds);
        timeline.value=seconds;document.querySelector('#time').textContent=seconds.toFixed(1)+' / 5.0 秒';
        play.textContent=playing?'暂停':activeGroup===2?'播放两版 ▶':'播放三版 ▶';

    }
    function begin(){if(!loaded)return;if(seconds>=5)seconds=0;playing=true;previousTime=performance.now();update();}
    play.addEventListener('click',()=>{if(playing){playing=false;update();}else begin();});
    restart.addEventListener('click',()=>{seconds=0;begin();});
    document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>{
        activeGroup=Number(button.dataset.group);
        cards.forEach((card,i)=>card.hidden=Math.floor(i/3)!==activeGroup);
        document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.group)===activeGroup)));
        seconds=0;begin();
    }));
    timeline.addEventListener('input',()=>{seconds=Number(timeline.value);playing=false;update();});
    document.querySelectorAll('[data-open]').forEach(el=>{
        const open=()=>{if(!loaded)return;opened=Number(el.dataset.open);document.querySelector('#modal-title').textContent=labels[opened]+' · 5 秒';modal.showModal();seconds=0;begin();};
        el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    });
    document.querySelector('#modal-close').addEventListener('click',()=>modal.close());
    document.querySelector('#modal-replay').addEventListener('click',()=>{seconds=0;begin();});
    modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});
    modal.addEventListener('close',()=>update());
    document.addEventListener('visibilitychange',()=>{if(document.hidden){playing=false;update();}});
    function tick(now) {
        if(playing){seconds=Math.min(5,seconds+(now-previousTime)/1000);previousTime=now;if(seconds===5){if(loop.checked)seconds=0;else playing=false;}update();}
        requestAnimationFrame(tick);
    }
    image.onload=()=>{
        const crop=data.cropRect||{x:0,y:0,width:image.width,height:image.height};
        photo.getContext('2d').drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,pw,ph);
        loaded=true;play.disabled=false;restart.disabled=false;
        document.querySelector('#note').textContent=`前半段为生成展示动画；后半段来自 ${data.versions.length} 个保存版本中的 ${diffs.length} 组格子差异（${diffs.map(d=>d.length+' 格').join('、')}），不代表逐笔操作记录。`;
        update();begin();requestAnimationFrame(tick);
    };
    image.onerror=()=>{play.textContent='原图加载失败';document.querySelector('#note').textContent='请确认 source.png 与本页面在同一目录。';};
    image.src='source.png';
})();
