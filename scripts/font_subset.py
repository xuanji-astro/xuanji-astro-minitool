#!/usr/bin/env python3
"""宋体子集（思源宋体 SemiBold，SIL OFL 1.1）：只收会用宋体显示的字——界面固定文字＋人格名和人格句＋干支＋星座。
iPhone 没有宋体，字不在子集里就会被系统字体顶上，同一行两种字体（见记忆：宋体子集要收全动态文字）。
用法：XJ_SERIF_OTF=<思源宋体 CN-SemiBold.otf> python3 scripts/font_subset.py   # 重切 app/fonts/serif-b.woff2
子集是改动版：OFL 保留字体名「Source」不能沿用，切完改名 XJ Serif，版权与许可字段（name 0／13／14）原样保留。
地名、长句不用宋体（.r-where 等用系统字体），所以不收城市表。"""
import glob, os, re, subprocess, sys, tempfile, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('XJ_SERIF_OTF') or sys.exit('设置 XJ_SERIF_OTF＝思源宋体 CN SemiBold 的 .otf 路径')
txt = ''
for f in glob.glob(os.path.join(ROOT, 'app', 'src', '*.js')) + [os.path.join(ROOT, 'app', 'index.html')]:
    t = open(f, encoding='utf-8').read()
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S); t = re.sub(r'(?m)^\s*//.*$', '', t); t = re.sub(r'\s//[^\'"`\n]*$', '', t, flags=re.M)
    txt += t
# 人格名、人格句、功能词：引擎导出的 MBTI 表里的字全收（node 跑一下引擎文件）
js = r"""
const fs=require('fs'),vm=require('vm');const c={console,Math,Date,JSON,Object,Array,Number,String};c.window=c;vm.createContext(c);
vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);const M=c.MBTI;const out=[];
const walk=(x)=>{if(typeof x==='string')out.push(x);else if(x&&typeof x==='object')for(const v of Object.values(x))walk(v)};
walk(M);process.stdout.write(out.join(''));
"""
txt += subprocess.run(['node', '-e', js, os.path.join(ROOT, 'engine', 'vendor', 'engine_mbti_core.js')], capture_output=True, text=True, check=True).stdout
# 日主意象、格局花名、大运标题也用宋体显示：生辰页词库 identity.js、luck-words.js 里的字全收
for f in ['identity.js', 'luck-words.js']:
    txt += open(os.path.join(ROOT, 'engine', 'vendor', 'site_words', f), encoding='utf-8').read()
txt += '甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥' + '白羊金牛双子巨蟹狮子处女天秤天蝎射手摩羯水瓶双鱼' + '日月水金火木土天海冥凯北' + '年月日时岁宫大运今'
chars = sorted(set(c for c in txt if ord(c) > 0x2000) | set(chr(i) for i in range(0x20, 0x7f)) | set('，。、：；！？（）「」《》·—…′°'))
os.makedirs(os.path.join(ROOT, 'app', 'fonts'), exist_ok=True)
with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False, encoding='utf-8') as f:
    f.write(''.join(chars)); tf = f.name
out = os.path.join(ROOT, 'app', 'fonts', 'serif-b.woff2')
subprocess.run(['pyftsubset', SRC, f'--text-file={tf}', '--flavor=woff2', f'--output-file={out}', '--layout-features=*', '--name-IDs=*'], check=True, stderr=subprocess.DEVNULL)
from fontTools.ttLib import TTFont
font = TTFont(out)
NEW = {1: 'XJ Serif SemiBold', 3: '1.000;XJ;XJSerif-SemiBold', 4: 'XJ Serif SemiBold', 6: 'XJSerif-SemiBold', 16: 'XJ Serif', 17: 'SemiBold'}
for r in list(font['name'].names):
    if r.nameID in NEW: font['name'].removeNames(nameID=r.nameID, platformID=r.platformID, platEncID=r.platEncID, langID=r.langID)
for i, v in NEW.items(): font['name'].setName(v, i, 3, 1, 0x409)
font.save(out)
json.dump(''.join(chars), open(os.path.join(ROOT, 'app', 'fonts', 'serif-chars.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('serif-b.woff2', len(chars), 'chars', os.path.getsize(out) // 1024, 'KB')
