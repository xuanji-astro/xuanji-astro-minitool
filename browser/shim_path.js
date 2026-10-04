// 浏览器里没有 path：只用来拼 vendor 文件路径，交给 shim_vm 认文件名
module.exports = { join: (...a) => a.join('/') };
