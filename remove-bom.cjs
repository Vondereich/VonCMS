const fs = require('fs');
const path = require('path');

// Folder yang akan di-scan
const targetDirs = ['public', 'src', 'server'];
// Jenis fail yang sering terkesan dengan BOM
const extensions = ['.php', '.ts', '.tsx', '.json', '.md', '.css', '.js', '.cjs'];

let bomCount = 0;
let fileCount = 0;

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (extensions.includes(ext)) {
        fileCount++;
        checkAndRemoveBOM(fullPath);
      }
    }
  }
}

function checkAndRemoveBOM(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    // Semak 3 byte pertama (EF BB BF)
    if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
      console.log(`[DIBUANG] BOM ditemui dalam: ${filePath}`);
      fs.writeFileSync(filePath, buf.slice(3));
      bomCount++;
    }
  } catch (err) {
    console.error(`Ralat membaca ${filePath}:`, err.message);
  }
}

console.log('Memulakan Saringan BOM (Byte Order Mark)...');

// Jalankan saringan pada direktori yang ditetapkan
targetDirs.forEach((dir) => scanDir(dir));

// Semak juga fail penting di root (jika ada)
const rootFiles = ['create_release.cjs', 'von_config.php'];
rootFiles.forEach((file) => {
  if (fs.existsSync(file)) {
    fileCount++;
    checkAndRemoveBOM(file);
  }
});

console.log('---------------------------------------------------');
console.log(`Saringan Selesai! Sebanyak ${fileCount} fail telah disemak.`);
if (bomCount > 0) {
  console.log(`\u2705 BERJAYA: BOM telah dibuang daripada ${bomCount} fail.`);
  console.log(
    "\n💡 TIPS: Pastikan Code Editor anda sentiasa diset kepada format 'UTF-8' dan BUKAN 'UTF-8 with BOM'."
  );
} else {
  console.log('✨ Sistem Bersih: Tiada sebarang BOM ditemui dalam mana-mana fail.');
}
