// tools/size-report.mjs
import { promises as fs } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'assets');
const OUTPUT = path.join(__dirname, 'inventory.txt');

async function walk(dir){
  const out = [];
  async function rec(d){
    const entries = await fs.readdir(d, { withFileTypes: true });
    for (const e of entries){
      const p = path.join(d, e.name);
      if (e.isDirectory()) await rec(p);
      else {
        const st = await fs.stat(p);
        out.push({ full: p, rel: path.relative(ROOT, p), size: st.size });
      }
    }
  }
  await rec(dir);
  return out;
}

function formatSize(bytes){
  const units = ['B','KB','MB','GB'];
  let v = bytes, i=0;
  while (v>=1024 && i<units.length-1){ v/=1024; i++; }
  return `${v.toFixed(2)} ${units[i]}`;
}

(async()=>{
  try{
    const files = await walk(ASSETS_DIR);
    const total = files.reduce((a,b)=> a + b.size, 0);
    const sorted = [...files].sort((a,b)=> b.size - a.size);
    const top = sorted.slice(0, 20);

    let report = '';
    report += `# ASSETS SIZE REPORT\n`;
    report += `Root: ${ROOT}\n`;
    report += `Scanned: ${path.relative(ROOT, ASSETS_DIR)}\n\n`;
    report += `Total files: ${files.length}\n`;
    report += `Total size:  ${formatSize(total)}\n\n`;
    report += `## Top 20 Largest Files\n`;
    top.forEach((f, idx)=>{
      report += `${String(idx+1).padStart(2,'0')}. ${f.rel}  -  ${formatSize(f.size)} (${f.size} B)\n`;
    });

    await fs.writeFile(OUTPUT, report, 'utf8');
    console.log(report);
    console.log(`\nWritten to: ${OUTPUT}`);
  }catch(err){
    console.error('Report failed:', err);
    process.exit(1);
  }
})();
