// 定时辰脚本取「交界另一侧」前，用接口客户端的 validate 核一下出生信息的格式。
// 小工具不联网，出生信息在本机表单里已经核过（engine/src/core.js parseInput），这里只拦明显不对的形状。
export function validate(kind, input) {
  if (kind !== 'profile' || !input || typeof input !== 'object' || Array.isArray(input)) throw Object.assign(new Error('INPUT_INVALID'), { code: 'INPUT_INVALID' });
}
