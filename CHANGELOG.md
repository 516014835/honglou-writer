# Changelog

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.0] - 2026-11-17

### 新增

- 作品结构：章回、人物卡、时间线、伏笔
- `createProject` / `addChapter` / `addCharacter` / `addEvent` / `plantForeshadow` / `payForeshadow`
- `checkProject` 全书体检，输出 error / warning / info 三级诊断
- `projectStat` 字数统计：汉字按字计、英文按词计
- `loadProject` / `saveProject` / `parseProject`，带结构校验
- 命令行工具 `hlw`：`init` `add` `char` `plant` `pay` `check` `stats` `chars` `open`
- `hlw serve`：局域网网页界面，手机浏览器可写正文、管人物与伏笔
- AI 写作面板：`hlw ai --key` 配置，网页里可对话、按当前章节续写并一键插入正文
