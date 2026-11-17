# honglou-writer

鍐欎綔杈呭姪宸ュ叿搴擄細鎶婁竴閮ㄥ皬璇村綋鎴愭湁缁撴瀯鐨勬暟鎹潵绠♀€斺€旂珷鍥炪€佷汉鐗╁崱銆佹椂闂寸嚎銆佷紡绗斻€?闆惰繍琛屾椂渚濊禆锛屽叏閮?TypeScript 缂栧啓锛岄檮涓€涓懡浠よ宸ュ叿 `hlw`銆?
```bash
npm install honglou-writer
```

## 瀹冭В鍐充粈涔?
鍐欏埌涓夊崄涓囧瓧锛屾渶鍏堝鐨勪笉鏄枃绗旓紝鑰屾槸璁板繂锛?
- 杩欎釜浜虹墿绗竴娆″嚭鍦烘槸鍝竴绔狅紵
- 銆岄噾閿併€嶈繖涓紡绗旀垜鍒板簳鍥炴敹娌℃湁锛?- 绗竷绔犲啓鍒颁竴鍗婏紝鍓嶉潰鍩嬬殑鍝嚑鏉＄嚎杩樻病钀藉湴锛?
`honglou-writer` 鎶婅繖浜涜鍦ㄤ竴涓?JSON 鏂囦欢閲岋紝`hlw check` 涓€璧帮紝婕忔帀鐨勮嚜宸变細璺冲嚭鏉ャ€?
## 蹇€熷紑濮?
```bash
# 寤轰竴鏈功
npx hlw init 绾㈡ゼ姊?json --name 绾㈡ゼ姊?--author 鏇归洩鑺?
# 鍔犱竴绔狅紙姝ｆ枃浠庢枃浠惰锛岀渷寰楄浆涔夛級
npx hlw add 绾㈡ゼ姊?json --title "鐢勫＋闅愭ⅵ骞昏瘑閫氱伒" --body-file 绗竴鍥?txt

# 鍔犱汉鐗╁崱锛?-debut 鐢ㄧ珷搴忓彿鎴栫珷 id
npx hlw char 绾㈡ゼ姊?json --name 鏋楅粵鐜?--alias 棰﹀効 --alias 鏋楀濡?--role 璐炬瘝澶栧瓩濂?--debut 3

# 鍩嬩紡绗?/ 鍥炴敹浼忕瑪
npx hlw plant 绾㈡ゼ姊?json --title 閫氱伒瀹濈帀 --at 1
npx hlw pay 绾㈡ゼ姊?json --id fs-001 --at 120

# 浣撴
npx hlw check 绾㈡ゼ姊?json
```

浣撴杈撳嚭闀胯繖鏍凤細

```
鈻?[璀﹀憡] 浼忕瑪銆岄€氱伒瀹濈帀銆嶈繕娌″洖鏀讹紙绗?1 绔犲煁涓嬶級
鉁?[閿欒] 浜虹墿銆屾灄榛涚帀銆嶇殑棣栨鍑哄満绔犮€宑h-404銆嶄笉瀛樺湪
鈩?[鎻愮ず] 浜虹墿銆岃淳姣嶃€嶈繕娌℃爣棣栧嚭鍦虹珷

鍏?3 鏉★細1 涓敊璇紝1 涓鍛?```

鏈?`error` 鏃跺懡浠ら€€鍑虹爜涓?1锛屽彲浠ョ洿鎺ユ寕杩?CI 鎴?git hook銆?
鍏朵粬鍛戒护锛?
| 鍛戒护 | 浣滅敤 |
| --- | --- |
| `hlw stats` | 鍏ㄤ功涓庨€愮珷瀛楁暟锛堟眽瀛楁寜瀛椼€佽嫳鏂囨寜璇嶏級 |
| `hlw chars` | 浜虹墿琛?|
| `hlw open` | 杩樻病鍥炴敹鐨勪紡绗?|
| `hlw check --json` | 鏈哄櫒鍙杈撳嚭锛屼究浜庢帴缂栬緫鍣ㄦ彃浠?|

## 鍦ㄤ唬鐮侀噷鐢?
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

const project = createProject('绾㈡ゼ姊?, '鏇归洩鑺?);

const first = addChapter(project, {
  title: '鐢勫＋闅愭ⅵ骞昏瘑閫氱伒 璐鹃洦鏉戦灏樻€€闂虹',
  body: '姝ゅ紑鍗风涓€鍥炰篃鈥︹€?,
});

addCharacter(project, {
  name: '鏋楅粵鐜?,
  aliases: ['棰﹀効'],
  firstChapterId: first.id,
});

const fs = plantForeshadow(project, { title: '閫氱伒瀹濈帀', plantedChapterId: first.id });
payForeshadow(project, fs.id, addChapter(project, { title: '鈥︹€?, body: '鈥︹€? }).id);

const diagnostics = checkProject(project);
const stat = projectStat(project); // { chapters, totalWords, averageWords, perChapter }

await saveProject('绾㈡ゼ姊?json', project);
```

## 鏁版嵁缁撴瀯

涓€涓綔鍝佹枃浠跺氨鏄竴浠?JSON锛?
```json
{
  "name": "绾㈡ゼ姊?,
  "author": "鏇归洩鑺?,
  "version": 1,
  "chapters": [
    { "id": "ch-001", "order": 1, "title": "鐢勫＋闅愭ⅵ骞昏瘑閫氱伒", "body": "鈥︹€?, "status": "draft" }
  ],
  "characters": [
    { "id": "char-001", "name": "鏋楅粵鐜?, "aliases": ["棰﹀効"], "firstChapterId": "ch-001" }
  ],
  "timeline": [
    { "id": "ev-001", "chapterId": "ch-001", "order": 1.5, "title": "閫氱伒瀹濈帀涓嬪嚒" }
  ],
  "foreshadows": [
    { "id": "fs-001", "title": "閫氱伒瀹濈帀", "plantedChapterId": "ch-001", "status": "open" }
  ]
}
```

`timeline.order` 鏄?*涔﹀唴鏃堕棿**锛屼笉鏄珷搴忥紝鍙互鐢ㄥ皬鏁板湪涓ゆ潯涔嬮棿鎻掗槦銆?
## 妫€鏌ヨ鍒?
`checkProject` 浼氭姤杩欎簺锛?
| 浠ｇ爜 | 绾у埆 | 鍚箟 |
| --- | --- | --- |
| `DUPLICATE_CHAPTER_ID` / `_ORDER` | error | 绔?id 鎴栧簭鍙烽噸澶?|
| `MISSING_CHAPTER_REF` | error | 寮曠敤浜嗕笉瀛樺湪鐨勭珷 |
| `PAYOFF_BEFORE_PLANT` | error | 浼忕瑪鍥炴敹绔犳棭浜庡煁璁剧珷 |
| `EMPTY_CHAPTER_TITLE` / `_BODY` | warning | 绌哄洖鐩?/ 绌烘鏂?|
| `OPEN_FORESHADOW` | warning | 浼忕瑪杩樻病鍥炴敹 |
| `PAID_WITHOUT_CHAPTER` | warning | 鏍囨垚宸插洖鏀跺嵈娌″啓鍥炴敹绔?|
| `DANGLING_RELATION` | warning | 浜虹墿鍏崇郴鎸囧悜涓嶅瓨鍦ㄧ殑浜虹墿 |
| `CHARACTER_WITHOUT_DEBUT` | info | 浜虹墿娌℃爣棣栧嚭鍦虹珷 |

## 寮€鍙?
```bash
npm install
npm test          # vitest
npm run typecheck
npm run lint
npm run build     # tsup 鈫?dist/
```

## License

MIT
