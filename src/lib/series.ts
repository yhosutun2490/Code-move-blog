import { getCollection, type CollectionEntry } from 'astro:content'
import { isTopicSlug, sortedTopics, type TopicConfig, type TopicSlug } from './topics'

// 每個主題是一個系列：文章放在 src/content/docs/<主題>/<資料夾>/index.mdx，
// entry id 是「<主題>/<資料夾>」，第一段就是主題 slug。
//
// production build 會替草稿拿掉頁面和側欄項目，但 getCollection 不會濾草稿，
// 所以首頁列表、「共 M 篇」這類自己查集合的地方都要走這個模組，不要直接呼叫 getCollection。

type Post = CollectionEntry<'docs'>

/** 這個 docs entry 所屬的主題；不是文章（例如首頁、404）時回傳 undefined */
export function topicOfPost(id: string): TopicSlug | undefined {
  const [first, rest] = id.split('/', 2)
  return rest && isTopicSlug(first) ? first : undefined
}

async function publishedPosts(): Promise<Post[]> {
  const posts = await getCollection('docs', ({ id, data }) => !!topicOfPost(id) && !data.draft)
  // 已發布篇章一定要有發佈日期（schema 為了草稿和首頁設成選填），少了就讓 build 失敗
  const undated = posts.filter((post) => !post.data.date).map((post) => post.id)
  if (undated.length > 0) {
    throw new Error(
      `已發布的篇章缺少發佈日期：${undated.join('、')}。請在 frontmatter 加上 date: YYYY-MM-DD（草稿可以先不寫）。`,
    )
  }
  return posts.sort((a, b) => a.data.order - b.data.order)
}

/** 發佈日期的顯示與 <time datetime> 格式：YYYY-MM-DD（frontmatter 的日期是 UTC 零時） */
export function formatPostDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** 某主題讀者看得到的篇章：不含草稿，依 order 排序 */
export async function publishedPostsOf(topic: TopicSlug): Promise<Post[]> {
  return (await publishedPosts()).filter((post) => topicOfPost(post.id) === topic)
}

export interface PublishedTopic {
  topic: TopicConfig
  /** 已發布篇章，依 order 排序（至少一篇） */
  posts: Post[]
}

/**
 * 最新一篇：發佈日期最晚的已發布篇章；同一天時取主題 order、篇章 order 較後的那篇。
 * 沒有已發布篇章時回傳 undefined。
 */
export async function latestPost(): Promise<Post | undefined> {
  const posts = (await publishedTopics()).flatMap((group) => group.posts)
  // 已依主題 order、篇章 order 排好，所以用 >= 讓同一天的較後者勝出
  return posts.reduce<Post | undefined>(
    (latest, post) => (!latest || post.data.date! >= latest.data.date! ? post : latest),
    undefined,
  )
}

/** 至少有一篇已發布文章的主題，依主題 order 排序，各自附上已發布篇章 */
export async function publishedTopics(): Promise<PublishedTopic[]> {
  const posts = await publishedPosts()
  return sortedTopics()
    .map((topic) => ({ topic, posts: posts.filter((p) => topicOfPost(p.id) === topic.slug) }))
    .filter((group) => group.posts.length > 0)
}
