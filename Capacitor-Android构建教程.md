# Capacitor Android APK 构建教程

## 概述

本教程介绍如何将基于 Capacitor 的 Web 应用打包成 Android APK 文件。

---

## 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    Web 应用层                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ HTML    │  │ CSS     │  │ JS      │  │ 资源文件 │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Capacitor 框架层                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Capacitor Core - 桥接 Web 和原生 API           │    │
│  └─────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Capacitor Plugins - 原生功能插件                │    │
│  │  (LocalNotifications, Camera, etc.)             │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Android 原生层                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ WebView │  │ Activity│  │ Gradle  │  │  APK    │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 前置条件

### 1. 安装 Node.js
- 下载地址: https://nodejs.org/
- 建议版本: 16.x 或更高

### 2. 安装 Java JDK
- 下载地址: https://adoptium.net/
- 建议版本: JDK 17 或更高
- 配置环境变量 `JAVA_HOME`

### 3. 安装 Android Studio
- 下载地址: https://developer.android.com/studio
- 安装时勾选 Android SDK
- 安装完成后配置环境变量:
  - `ANDROID_HOME`: Android SDK 路径
  - 将 `%ANDROID_HOME%\platform-tools` 添加到 PATH

### 4. 安装 Gradle
- Android Studio 通常会自带 Gradle
- 或手动安装: https://gradle.org/install/

---

## 项目结构

```
memo-app/
├── www/                        # Web 源代码目录
│   ├── index.html             # 主页面
│   ├── style.css              # 样式文件
│   └── js/                    # JavaScript 文件
│       ├── app.js             # 应用主逻辑
│       ├── store.js           # 数据存储
│       ├── ai.js              # AI 功能
│       └── ...
├── android/                   # Android 原生项目
│   ├── app/
│   │   ├── src/               # Android 源代码
│   │   └── build.gradle       # App 级构建配置
│   ├── gradle/                # Gradle 包装器
│   └── build.gradle           # 项目级构建配置
├── capacitor.config.json      # Capacitor 配置文件
├── package.json               # Node.js 依赖配置
└── package-lock.json          # 依赖锁定文件
```

---

## 构建流程详解

### 第一步: 安装依赖

```bash
cd memo-app
npm install
```

**作用**: 根据 `package.json` 安装所需的 Node.js 包，包括:
- `@capacitor/core`: Capacitor 核心库
- `@capacitor/cli`: Capacitor 命令行工具
- `@capacitor/android`: Android 平台支持
- `@capacitor/local-notifications`: 本地通知插件

---

### 第二步: 同步 Web 资源到 Android

```bash
npx cap sync android
```

**作用**: 将 `www/` 目录下的 Web 资源复制到 Android 项目中

**详细过程**:
1. **复制 Web 资源**
   ```
   www/ → android/app/src/main/assets/public/
   ```
   - 复制 index.html、CSS、JavaScript、图片等文件
   - 保持目录结构不变

2. **生成配置文件**
   ```
   capacitor.config.json → android/app/src/main/assets/capacitor.config.json
   ```

3. **更新原生插件**
   - 扫描 `package.json` 中的 Capacitor 插件
   - 更新 Android 项目的依赖配置
   - 注册插件到原生层

4. **同步结果**
   ```
   √ Copying web assets from www to android\app\src\main\assets\public
   √ Creating capacitor.config.json
   √ Updating Android plugins
   √ Sync finished in 0.48s
   ```

---

### 第三步: 构建 Debug APK

```bash
cd android
./gradlew.bat assembleDebug    # Windows
# 或
./gradlew assembleDebug        # macOS/Linux
```

**作用**: 使用 Gradle 构建工具编译 Android 项目，生成 APK 文件

**详细过程**:

1. **预构建阶段 (Pre-build)**
   - `preBuild`: 检查构建前置条件
   - `preDebugBuild`: Debug 构建的预处理

2. **资源处理阶段**
   - `generateDebugResValues`: 生成资源值
   - `mergeDebugResources`: 合并资源文件
   - `processDebugResources`: 处理资源，生成 R.java

3. **编译阶段**
   - `compileDebugJavaWithJavac`: 编译 Java 代码
   - `compileDebugShaders`: 编译着色器（如有）

4. **打包阶段**
   - `mergeDebugAssets`: 合并资源文件（包括 Web 资源）
   - `packageDebug`: 打包成 APK
   - `assembleDebug`: 最终生成 Debug APK

5. **输出结果**
   ```
   BUILD SUCCESSFUL in 14s
   108 actionable tasks: 23 executed, 85 up-to-date
   ```

---

### 第四步: 获取 APK 文件

APK 文件位置:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

可以复制到项目根目录方便访问:
```bash
cp android/app/build/outputs/apk/debug/app-debug.apk ./memo-debug.apk
```

---

## 完整构建脚本

### Windows (PowerShell)

```powershell
# 进入项目目录
cd I:\CC\memo\memo-app

# 安装依赖（首次）
npm install

# 同步 Web 资源
npx cap sync android

# 构建 APK
cd android
.\gradlew.bat assembleDebug

# 复制 APK 到项目根目录
Copy-Item .\app\build\outputs\apk\debug\app-debug.apk ..\memo-debug.apk

Write-Host "构建完成！APK 文件: memo-debug.apk"
```

### macOS/Linux (Bash)

```bash
#!/bin/bash

# 进入项目目录
cd /path/to/memo-app

# 安装依赖（首次）
npm install

# 同步 Web 资源
npx cap sync android

# 构建 APK
cd android
./gradlew assembleDebug

# 复制 APK 到项目根目录
cp ./app/build/outputs/apk/debug/app-debug.apk ../memo-debug.apk

echo "构建完成！APK 文件: memo-debug.apk"
```

---

## package.json 脚本说明

```json
{
  "scripts": {
    "build": "echo 'Static web app, no build needed'",
    "cap:sync": "npx cap sync android",
    "cap:build": "npx cap build android",
    "apk": "cd android && gradlew.bat assembleDebug"
  }
}
```

**使用方式**:
```bash
# 同步资源
npm run cap:sync

# 构建 APK
npm run apk

# 或者一步到位
npm run cap:sync && npm run apk
```

---

## 常见问题

### 1. Gradle 构建失败

**错误**: `Could not find or load main class org.gradle.wrapper.GradleWrapperMain`

**解决**:
```bash
# 重新生成 Gradle 包装器
cd android
gradle wrapper --gradle-version 8.0
```

### 2. Android SDK 找不到

**错误**: `SDK location not found`

**解决**:
创建 `android/local.properties` 文件:
```properties
sdk.dir=C:\\Users\\YourName\\AppData\\Local\\Android\\Sdk
```

### 3. Java 版本不兼容

**错误**: `Unsupported class file major version 65`

**解决**: 确保使用 JDK 17 或更高版本
```bash
java -version
```

### 4. 签名问题

**Debug APK**: 默认使用 Debug 签名，可直接安装测试

**Release APK**: 需要配置签名密钥
```bash
# 生成签名密钥
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000

# 构建 Release APK
./gradlew assembleRelease
```

---

## Capacitor 配置详解

### capacitor.config.json

```json
{
  "appId": "com.memo.assistant",        // 应用唯一标识
  "appName": "Memo AI备忘录",            // 应用名称
  "webDir": "www",                       // Web 资源目录
  "server": {
    "androidScheme": "https"             // Android 使用 HTTPS 协议
  },
  "plugins": {
    "LocalNotifications": {
      "smallIcon": "ic_stat_icon",       // 通知小图标
      "iconColor": "#4F46E5"             // 通知图标颜色
    }
  }
}
```

---

## 调试技巧

### 1. 查看构建日志

```bash
# 详细构建日志
./gradlew assembleDebug --info

# 调试级别日志
./gradlew assembleDebug --debug
```

### 2. 清理构建缓存

```bash
# 清理项目
./gradlew clean

# 重新构建
./gradlew assembleDebug
```

### 3. 使用 Android Studio 调试

1. 用 Android Studio 打开 `android/` 目录
2. 等待 Gradle 同步完成
3. 点击 Run 按钮或使用 Debug 模式

### 4. WebView 调试

在 Chrome 浏览器中输入:
```
chrome://inspect/#devices
```

可以调试运行在 Android 设备上的 WebView 内容。

---

## 总结

构建流程可以简化为三个核心步骤：

1. **`npm install`** - 安装依赖
2. **`npx cap sync android`** - 同步 Web 资源
3. **`./gradlew assembleDebug`** - 构建 APK

理解每一步的作用，有助于快速定位和解决构建过程中遇到的问题。

---

*文档生成时间: 2026-05-13*
*项目: Memo AI备忘录*
