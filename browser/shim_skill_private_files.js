// 定时辰脚本读写本地私有文件用的（只在 Skill 命令行里）；小工具的回答存在本机小工具存储，不走这里
const no = () => { throw new Error('NOT_IN_BROWSER'); };
export const readPrivateJSON = no, writePrivateText = no;
