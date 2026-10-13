"""Offline, five-second preview exports from the copied draft; never opens storage."""
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
text = (ROOT / 'sample-data.js').read_text(encoding='utf-8')
data = json.loads(text.split('=', 1)[1].strip().rstrip(';'))
W, H = 400, 500
scale = W / 640
unit = min(480 / data['width'], 610 / data['height']) * scale
pw, ph = data['width'] * unit, data['height'] * unit
ox, oy = (W-pw)/2, (80+(610-ph/scale)/2)*scale
BG = (252, 251, 248)
font_path = 'C:/Windows/Fonts/msyh.ttc'
font = ImageFont.truetype(font_path, 9)
small = ImageFont.truetype(font_path, 7)
source = Image.open(ROOT/'source.png').convert('RGB')
crop = data['cropRect']
photo = source.crop((crop['x'], crop['y'], crop['x']+crop['width'], crop['y']+crop['height'])).resize((round(pw), round(ph)), Image.Resampling.LANCZOS)
frames = [data['versions'][0]['pixels']]
changes = []
for version in data['versions'][1:]:
    indices = [i for i, p in enumerate(version['pixels']) if p != frames[-1][i]]
    if indices:
        changes.append(indices)
        frames.append(version['pixels'])
assert frames[-1] == data['pixels']
initial = frames[0]
def is_outline(i,p):
    if not p[3]:
        return False
    x,y=i%data['width'],i//data['width']
    return sum(p[:3])/3<65 or any(nx<0 or ny<0 or nx>=data['width'] or ny>=data['height'] or not initial[ny*data['width']+nx][3] for nx,ny in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
outline=[is_outline(i,p) for i,p in enumerate(initial)]
colors=sorted(set(tuple(p[:3]) for p in initial if p[3]),key=sum)
color_rank=[colors.index(tuple(p[:3])) if p[3] else 0 for p in initial]

def ease(v):
    v = max(0, min(1, v))
    return v*v*(3-2*v)

def cell(draw, i, p, size=1):
    if not p[3] or size*unit <= .1:
        return
    x, y = ox+(i % data['width'])*unit, oy+(i//data['width'])*unit
    pad = (1-size)*unit/2
    draw.rectangle((x+pad, y+pad, x+unit-pad-.1, y+unit-pad-.1), fill=tuple(p[:3]))

def pixels(im, array):
    draw = ImageDraw.Draw(im)
    for i, p in enumerate(array):
        cell(draw, i, p)

def photo_on(im, alpha=1):
    layer = im.copy()
    layer.paste(photo, (round(ox), round(oy)))
    return Image.blend(im, layer, max(0, min(1, alpha)))

def celebration_burst(im,t,start,cx,cy,max_radius,count,duration,seed):
    age=t-start
    if age<0 or age>=duration:
        return im
    p=age/duration
    travel=1-(1-p)**2.6
    layer=Image.new('RGBA',im.size,(0,0,0,0))
    d=ImageDraw.Draw(layer)
    colors=[(240,57,134),(255,195,76),(163,131,237),(255,128,91),(97,190,195)]
    alpha=round(255*(1-p)**.65)
    for i in range(count):
        angle=i*math.pi*2/count+seed
        speed=.73+((i*17+seed*100)%19)/70
        r=(5+max_radius*travel)*speed*scale
        x,y=cx+math.cos(angle)*r,cy+math.sin(angle)*r+p*p*25*scale
        color=colors[(i+int(seed*10))%len(colors)]+(alpha,)
        trail=(9+max_radius*.1*(1-p))*scale
        d.line((x-math.cos(angle)*trail,y-math.sin(angle)*trail,x,y),fill=color,width=2)
        d.ellipse((x-1.4,y-1.4,x+1.4,y+1.4),fill=color)
        if count>25:
            sx,sy=cx+math.cos(angle+.06)*r*.62,cy+math.sin(angle+.06)*r*.62+p*p*17*scale
            d.ellipse((sx-1,sy-1,sx+1,sy+1),fill=color[:3]+(round(alpha*.6),))
    if p<.2:
        radius=13*(1-p/.2)*scale
        d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),fill=(255,229,162,round(255*(1-p/.2)*.85)))
    return Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')

def firework(im,t,variant):
    if variant==6:
        return celebration_burst(im,t,4.02,W/2,oy+ph*.18,180,44,.9,.2)
    if variant==7:
        bursts=[(4.0,ox+38*scale,oy+ph*.18,65,.1),(4.08,ox+pw-34*scale,oy+ph*.13,70,.5),(4.16,W/2,oy-6*scale,56,.8),(4.24,ox+35*scale,oy+ph*.64,62,1.2),(4.32,ox+pw-20*scale,oy+ph*.62,66,1.6)]
        for start,x,y,r,seed in bursts:
            im=celebration_burst(im,t,start,x,y,r,18,.58,seed)
        return im
    age=t-4.12
    if age<0 or age>.78:
        return im
    progress=age/.78
    radius=(7+39*(1-(1-progress)**2))*scale
    cx,cy=ox+pw-12*scale,oy+ph*.14
    layer=Image.new('RGBA',im.size,(0,0,0,0))
    d=ImageDraw.Draw(layer)
    colors=[(223,87,142),(241,188,97),(179,150,212)]
    alpha=round(255*(1-progress)**.7)
    for i in range(12):
        angle=i*math.pi/6-.2
        r=radius*(.76 if i%2 else 1)
        x,y=cx+math.cos(angle)*r,cy+math.sin(angle)*r+progress*progress*9*scale
        color=colors[i%3]+(alpha,)
        d.line((x-math.cos(angle)*5*scale,y-math.sin(angle)*5*scale,x,y),fill=color,width=2)
        d.ellipse((x-1,y-1,x+1,y+1),fill=color)
    return Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')

def frame_at(variant, t):
    celebration_variant=variant
    if variant>=6:
        variant=5
    im = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((ox-10, oy-10, ox+pw+10, oy+ph+10), outline='#ece9e5')
    d.text((ox, 20), 'PHOTO > BEAD PATTERN', fill='#b3a5ad', font=small)
    if t < .5:
        im = photo_on(im)
        phase = '原图'
    elif t < 2.85:
        phase = '生成展示动画'
        if variant == 0:
            progress = ease((t-.5)/1.95)
            cols = max(data['width'], round(photo.width*(1-progress)**3))
            low = photo.resize((cols, max(data['height'], round(cols*ph/pw))), Image.Resampling.BILINEAR).resize(photo.size, Image.Resampling.NEAREST)
            base = im.copy()
            base.paste(low, (round(ox), round(oy)))
            im = Image.blend(im, base, 1-ease((t-1.85)/.8))
            layer = Image.new('RGB', (W,H), BG)
            pixels(layer, frames[0])
            a = ease((t-1.65)/1.1)
            # Composite only the grid area, leaving the shared labels untouched.
            box = (round(ox), round(oy), round(ox+pw), round(oy+ph))
            im.paste(Image.blend(im.crop(box), layer.crop(box), a), box[:2])
        elif variant == 1:
            im = photo_on(im, 1-ease((t-.45)/.55))
            d = ImageDraw.Draw(im)
            radius = math.hypot(data['width']/2, data['height']/2)
            for i, p in enumerate(frames[0]):
                x, y = i % data['width']+.5-data['width']/2, i//data['width']+.5-data['height']/2
                start = .65+math.hypot(x,y)/radius*1.72
                cell(d, i, p, ease((t-start)/.28))
        elif variant == 2:
            progress = ease((t-.55)/2.05)
            grid = im.copy()
            pixels(grid, frames[0])
            im = photo_on(im)
            y = round(oy+ph*progress)
            box = (round(ox), round(oy), round(ox+pw), y)
            if y > round(oy):
                im.paste(grid.crop(box), box[:2])
            if 0 < progress < 1:
                ImageDraw.Draw(im).line((ox-5,y,ox+pw+5,y), fill='#df578e', width=1)
        elif variant == 3:
            grid=Image.new('RGB',(W,H),BG)
            pixels(grid,initial)
            for row in range(10):
                for col in range(8):
                    start=.55+(col/7+row/9)*.62+((col*7+row*11)%9)/9*.12
                    progress=max(0,min(1,(t-start)/.65))
                    stretch=max(.015,abs(math.cos(progress*math.pi)))
                    x0,x1=round(col*pw/8),round((col+1)*pw/8)
                    y0,y1=round(row*ph/10),round((row+1)*ph/10)
                    tile=photo.crop((x0,y0,x1,y1)) if progress<.5 else grid.crop((round(ox)+x0,round(oy)+y0,round(ox)+x1,round(oy)+y1))
                    width=max(1,round(tile.width*stretch))
                    tile=tile.resize((width,tile.height),Image.Resampling.NEAREST)
                    im.paste(tile,(round(ox)+x0+(x1-x0-width)//2,round(oy)+y0))
        elif variant == 4:
            im=photo_on(im,1-ease((t-.5)/.35))
            d=ImageDraw.Draw(im)
            for i,p in enumerate(initial):
                progress=ease((t-.65)/.55) if outline[i] else ease((t-1.05-color_rank[i]/max(1,len(colors)-1)*1.15)/.45)
                if p[3] and progress>0:
                    color=[round(BG[j]*(1-progress)+p[j]*progress) for j in range(3)]+[255]
                    cell(d,i,color)
        elif variant == 5:
            im=photo_on(im)
            grid=Image.new('RGB',(W,H),BG)
            pixels(grid,initial)
            progress=ease((t-.55)/2.05)
            edge=(pw+ph)*progress
            mask=Image.new('L',(W,H),0)
            ImageDraw.Draw(mask).polygon([(ox,oy),(ox+edge,oy),(ox,oy+edge)],fill=255)
            crop_mask=Image.new('L',(W,H),0)
            crop_mask.paste(mask.crop((round(ox),round(oy),round(ox+pw),round(oy+ph))),(round(ox),round(oy)))
            im=Image.composite(grid,im,crop_mask)
            if 0<progress<1:
                layer=im.copy()
                ImageDraw.Draw(layer).line((ox+edge,oy,ox,oy+edge),fill='#df578e',width=2)
                box=(round(ox),round(oy),round(ox+pw),round(oy+ph))
                im.paste(layer.crop(box),box[:2])
    elif t < 4 and changes:
        pos = (t-2.85)/(1.15/len(changes))
        group = min(len(changes)-1, int(pos))
        array = list(frames[group])
        visible = int(ease(pos-group)*len(changes[group]))
        for i in changes[group][:visible]:
            array[i] = frames[group+1][i]
        pixels(im,array)
        phase = f'保存版本变化 · 第 {group+1} 组'
    else:
        pixels(im,data['pixels'])
        im=firework(im,t,celebration_variant)
        phase = '最终图纸'
    d = ImageDraw.Draw(im)
    d.text((W/2, 463), phase, fill='#94858f', font=font, anchor='mm')
    d.text((W/2, 480), '64 x 80 / MARD / 14 COLORS', fill='#b7aab2', font=small, anchor='mm')
    return im

for variant, name in enumerate(['01-简洁渐变', '02-中心生长', '03-逐行扫描', '04-翻牌拼合', '05-轮廓填色', '06-斜向光波', '07-一朵大烟花', '08-数朵小烟花']):
    if '--new' in sys.argv and variant<3:
        continue
    if '--fireworks' in sys.argv and variant<6:
        continue
    images = [frame_at(variant, n/20) for n in range(100)]
    images[0].save(ROOT/(name+'.gif'), save_all=True, append_images=images[1:], duration=50, loop=0, optimize=True, disposal=2)
    gif = Image.open(ROOT/(name+'.gif'))
    duration = 0
    for n in range(gif.n_frames):
        gif.seek(n)
        duration += gif.info.get('duration',0)
    assert duration == 5000, duration
    print(name, gif.size, gif.n_frames, duration, (ROOT/(name+'.gif')).stat().st_size)
frame_at(0,4.9).save(ROOT/'final-frame.png')
