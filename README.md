# honglou-writer

写作辅助工具库：把一部小说当成有结构的数据来管——章回、人物卡、时间线、伏笔。
零运行时依赖，全部 TypeScript 编写，附一个命令行工具 `hlw`。

```bash
npm install honglou-writer
```

## 它解决什么

写到三十万字，最先塌的不是文笔，而是记忆：

- 这个人物第一次出场是哪一章？
- 「金锁」这个伏笔我到底回收没有？
- 第七章写到一半，前面埋的哪几条线还没落地？

`honglou-writer` 把这些记在一个 JSON 文件里，`hlw check` 一走，漏掉的自己会跳出来。

## 快速开始

```bash
# 建一本书
npx hlw init 红楼梦.json --name 红楼梦 --author 曹雪芹

# 加一章（正文从文件读，省得转义）
npx hlw add 红楼梦.json --title "甄士隐梦幻识通灵" --body-file 第一回.txt

# 加人物卡，--debut 用章序号或章 id
npx hlw char 红楼梦.json --name 林黛玉 --alias 颦儿 --alias 林妹妹 --role 贾母外孙女 --debut 3

# 埋伏笔 / 回收伏笔
npx hlw plant 红楼梦.json --title 通灵宝玉 --at 1
npx hlw pay 红楼梦.json --id fs-001 --at 120

# 体检
npx hlw check 红楼梦.json
```

体检输出长这样：

```
▲ [警告] 伏笔「通灵宝玉」还没回收（第 1 章埋下）
✖ [错误] 人物「林黛玉」的首次出场章「ch-404」不存在
ℹ [提示] 人物「贾母」还没标首出场章

共 3 条：1 个错误，1 个警告
```

有 `error` 时命令退出码为 1，可以直接挂进 CI 或 git hook。

其他命令：

| 命令 | 作用 |
| --- | --- |
| `hlw stats` | 全书与逐章字数（汉字按字、英文按词） |
| `hlw chars` | 人物表 |
| `hlw open` | 还没回收的伏笔 |
| `hlw check --json` | 机器可读输出，便于接编辑器插件 |
| `hlw serve` | 开一个手机能用的网页界面（见下） |

## 手机上用

命令行不适合躺在床上写。开个网页界面：

```bash
hlw serve 红楼梦.json
```

终端会打印两个地址：

```
本机  http://127.0.0.1:4321
手机  http://192.168.10.108:4321
```

手机连**同一个 Wi-Fi**，浏览器打开「手机」那个地址，就能：

- 看章回列表、进任意一章改正文
- 新建一章（手机上直接写，中文输入法正常用）
- 加人物卡、埋伏笔、点「回收」标记伏笔已回收
- 看体检结果

数据还是写在电脑上那个 `红楼梦.json` 里，网页只是它的操作界面。按 `Ctrl+C` 停止。

**注意**：局域网内没有密码，同一 Wi-Fi 下任何人都能打开。家里用没事，别在咖啡馆或公司网络开。

端口被占用就换一个：`hlw serve 红楼梦.json --port 8080`。


## 在代码里用

```ts
import {
  createProject,
  addChapter,
  addCharacter,
  plantForeshadow,
  payForeshadow,
  checkProject,
  projectStat,
  saveProject,
  loadProject,
} from 'honglou-writer';

const project = createProject('红楼梦', '曹雪芹');

const first = addChapter(project, {
  title: '甄士隐梦幻识通灵 贾雨村风尘怀闺秀',
  body: '此开卷第一回也……',
});

addCharacter(project, {
  name: '林黛玉',
  aliases: ['颦儿'],
  firstChapterId: first.id,
});

const fs = plantForeshadow(project, { title: '通灵宝玉', plantedChapterId: first.id });
payForeshadow(project, fs.id, addChapter(project, { title: '……', body: '……' }).id);

const diagnostics = checkProject(project);
const stat = projectStat(project); // { chapters, totalWords, averageWords, perChapter }

await saveProject('红楼梦.json', project);
```

## 数据结构

一个作品文件就是一份 JSON：

```json
{
  "name": "红楼梦",
  "author": "曹雪芹",
  "version": 1,
  "chapters": [
    { "id": "ch-001", "order": 1, "title": "甄士隐梦幻识通灵", "body": "……", "status": "draft" }
  ],
  "characters": [
    { "id": "char-001", "name": "林黛玉", "aliases": ["颦儿"], "firstChapterId": "ch-001" }
  ],
  "timeline": [
    { "id": "ev-001", "chapterId": "ch-001", "order": 1.5, "title": "通灵宝玉下凡" }
  ],
  "foreshadows": [
    { "id": "fs-001", "title": "通灵宝玉", "plantedChapterId": "ch-001", "status": "open" }
  ]
}
```

`timeline.order` 是**书内时间**，不是章序，可以用小数在两条之间插队。

## 检查规则

`checkProject` 会报这些：

| 代码 | 级别 | 含义 |
| --- | --- | --- |
| `DUPLICATE_CHAPTER_ID` / `_ORDER` | error | 章 id 或序号重复 |
| `MISSING_CHAPTER_REF` | error | 引用了不存在的章 |
| `PAYOFF_BEFORE_PLANT` | error | 伏笔回收章早于埋设章 |
| `EMPTY_CHAPTER_TITLE` / `_BODY` | warning | 空回目 / 空正文 |
| `OPEN_FORESHADOW` | warning | 伏笔还没回收 |
| `PAID_WITHOUT_CHAPTER` | warning | 标成已回收却没写回收章 |
| `DANGLING_RELATION` | warning | 人物关系指向不存在的人物 |
| `CHARACTER_WITHOUT_DEBUT` | info | 人物没标首出场章 |

## 开发

```bash
npm install
npm test          # vitest
npm run typecheck
npm run lint
npm run build     # tsup → dist/
```

## License

MIT
