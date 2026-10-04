// 浏览器里没有 fs：readFileSync 只回路径本身，shim_vm 按文件名找打包时包好的同一份文件
module.exports = { readFileSync: (p) => String(p) };
