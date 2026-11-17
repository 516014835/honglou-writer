/**
 * 数据结构定义。
 *
 * 一部作品（Project）由四部分组成：章回、人物、时间线、伏笔。
 * 所有 id 在同一集合内唯一，跨集合可以重名。
 */

/** 章回状态：草稿 / 修订中 / 定稿 */
export type ChapterStatus = 'draft' | 'revised' | 'done';

/** 一章（回） */
export interface Chapter {
  /** 稳定 id，默认由序号生成，如 `ch-001` */
  id: string;
  /** 序号，从 1 开始，决定阅读顺序 */
  order: number;
  /** 回目，如「甄士隐梦幻识通灵 贾雨村风尘怀闺秀」 */
  title: string;
  /** 正文 */
  body: string;
  status?: ChapterStatus;
  /** 这一章的想法、待改点 */
  notes?: string;
}

/** 人物关系：指向另一个人物 id */
export interface Relation {
  to: string;
  label: string;
}

/** 人物卡 */
export interface CharacterCard {
  id: string;
  /** 正名，如「林黛玉」 */
  name: string;
  /** 别名、字号、人称，如 ['颦儿', '林妹妹'] */
  aliases?: string[];
  /** 身份，如「贾母外孙女」 */
  role?: string;
  /** 首次出场的章 id */
  firstChapterId?: string;
  relations?: Relation[];
  notes?: string;
}

/** 时间线上的一个事件，可以挂到某一章 */
export interface TimelineEvent {
  id: string;
  chapterId: string;
  /** 书内时间顺序，可用小数插队，如 12.5 */
  order: number;
  title: string;
  description?: string;
}

/** 伏笔状态：未回收 / 已回收 / 已弃用 */
export type ForeshadowStatus = 'open' | 'paid' | 'dropped';

/** 伏笔 */
export interface Foreshadow {
  id: string;
  title: string;
  /** 埋设的章 */
  plantedChapterId: string;
  /** 回收的章 */
  payoffChapterId?: string;
  status: ForeshadowStatus;
  notes?: string;
}

/** 一部作品 */
export interface Project {
  name: string;
  author?: string;
  /** 文件格式版本，目前恒为 1 */
  version: 1;
  chapters: Chapter[];
  characters: CharacterCard[];
  timeline: TimelineEvent[];
  foreshadows: Foreshadow[];
}
