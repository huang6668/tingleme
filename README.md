# 听了么

一个面向 Windows 与 macOS 的本地在线视频音频提取客户端。界面基于项目中的
Stitch 初稿实现，支持 YouTube、Bilibili 和 yt-dlp 兼容的其他单视频来源。

## 功能

- 提取来源中的最佳可用音频
- 输出 MP3、M4A 或 ALAC
- 自动获取并嵌入视频封面
- 写入歌曲名、歌手和专辑信息
- 展示获取信息、下载、处理和自动导入进度
- 保存到用户选择的位置，避免静默覆盖同名文件
- 可选复制到 Apple Music/iTunes 自动添加目录
- 记忆输出格式和自动导入设置
- 支持取消、修改和重试，以及连续处理下一个链接

## 二进制边界

源码仓库不包含任何 `.exe`、FFmpeg 或 yt-dlp 二进制文件，也不会要求开发机器
预装这些工具。

GitHub Actions 构建时会在云端：

1. 安装 Electron 构建依赖；
2. 下载当前平台的 FFmpeg 与 yt-dlp；
3. 校验 yt-dlp 官方 SHA-256；
4. 把工具放进被 Git 忽略的 `build-tools/`；
5. 生成 Windows x64、macOS Intel 和 macOS Apple Silicon 安装包。

yt-dlp 需要 JavaScript 运行时来完整解析 YouTube。应用直接复用 Electron 自带的
Node 运行时，不额外捆绑 Deno 或另一个 Node 可执行文件。

相关第三方许可说明见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## GitHub 构建

仓库推送后，可在 Actions 页面手动运行 `Build desktop installers`。三个平台的构建
结果会作为 workflow artifacts 上传。

创建版本发布时，推送与 `package.json` 版本一致且以 `v` 开头的标签，例如：

```text
v1.0.1
```

工作流会在三个平台构建成功后，把所有安装包合并发布到同一个 GitHub Release。

当前 macOS 安装包未签名和公证。首次打开时，macOS 可能要求用户在“隐私与安全性”
中确认。正式公开发行前建议配置 Apple Developer ID；Windows 公开发行也建议配置
代码签名证书。

## 本地开发说明

按项目要求，本仓库没有在当前开发电脑上执行 `npm install` 或下载媒体工具。
源码语法检查和纯 Node 单元测试可以独立运行；完整应用和真实提取流程由 GitHub
Actions 生成的安装包验证。

## 法律与使用提示

请只处理你有权下载、转换和保存的内容，并遵守内容来源网站的条款与当地法律。
