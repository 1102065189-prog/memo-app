# Memo AI备忘录

一款基于 Capacitor 框架的 Android 智能备忘录应用，支持自然语言输入和 AI 解析。

## 功能特性

- **自然语言解析** - 输入"明天下午3点开会"自动创建任务
- **AI 智能解析** - 接入 OpenAI 兼容 API（如 Kimi），理解复杂语义
- **手动创建** - 弹窗式精确选择日期时间和任务内容
- **任务管理** - 分类、优先级、搜索、筛选、统计
- **每日提醒** - 定时推送未完成任务
- **数据导入导出** - JSON 格式批量备份与恢复

## 技术栈

| 技术 | 用途 |
|------|------|
| Capacitor 6.x | Android 原生打包 |
| HTML/CSS/JS | 前端界面与逻辑 |
| localStorage | 本地数据持久化 |
| OpenAI 兼容 API | AI 对话与任务解析 |

## 快速开始

### 环境要求

- Node.js 18+
- Android Studio（用于构建 APK）
- JDK 17+

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/<your-username>/memo-app.git
cd memo-app

# 安装依赖
npm install

# 添加 Android 平台
npx cap add android

# 同步 Web 资源到 Android
npx cap sync android

# 构建 APK
cd android
./gradlew assembleDebug
```

构建完成后，APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`。

### AI 配置

应用支持任何 OpenAI 兼容的 API 服务。在设置中填写：

- **API 地址**：如 `https://api.moonshot.cn/v1`
- **API Key**：你的 API 密钥
- **模型**：如 `kimi-k2.5`

## 项目结构

```
memo-app/
├── www/                          # Web 前端
│   ├── index.html                # 主页面
│   ├── style.css                 # 样式
│   └── js/
│       ├── app.js                # 主应用逻辑
│       ├── settings.js           # 设置管理
│       ├── ai.js                 # AI 对话模块
│       ├── time-parser.js        # 中文时间解析器
│       ├── nl-parser.js          # 自然语言解析器
│       ├── store.js              # 数据存储
│       └── notify.js             # 通知管理
├── android/                      # Android 原生工程
├── capacitor.config.json         # Capacitor 配置
└── package.json                  # 项目依赖
```

## 使用说明

### 添加任务

- **自然语言**：在输入框输入"明天下午3点开会"，自动解析
- **手动创建**：点击右上角 "+" 按钮，手动填写
- **AI 解析**：开启"AI 解析"开关，输入复杂描述

### 管理任务

- 点击左侧圆圈标记完成
- 点击编辑按钮修改任务
- 左滑删除任务
- 使用筛选标签查看不同状态的任务

### AI 对话

输入 `/ai 你的问题` 与 AI 助手对话，获取任务建议。

## 许可证

MIT License
