# Piano

基于 Vite 和 Three.js 的交互式 3D 钢琴，支持键盘演奏、MIDI 导入、音频转谱、和弦练习及原音频对照。

## 本地运行

需要 Node.js 和 npm。

```sh
npm ci
npm run dev
```

## 测试与构建

```sh
npm test
npm run build
npm run preview
```

## 使用说明

- 高音区使用 Shift + 琴键标注按键，不是方向键。
- 和弦练习默认支持依次按齐，也可切换同时按住模式。
- 音频转谱在浏览器内运行；复杂混音可能出现错音或漏音，准确练习建议使用 MIDI。
- 原音频对照建议使用 1× 速度；原音频倍速会改变音高。

## 第三方资源

钢琴采样使用 Alexander Holm 的 Salamander Grand Piano（CC BY 3.0），详见 `public/audio/salamander/ATTRIBUTION.md` 和 `LICENSE.txt`。项目还包含 Basic Pitch 模型及研究参考资料，请遵守相应第三方许可；本仓库未为所有内容统一授予新的开源许可。

本地浏览器用户数据、依赖目录、构建产物及环境密钥不纳入版本控制。
