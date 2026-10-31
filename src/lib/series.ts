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
  return posts.sort((a, b) => a.data.order - b.data.order)
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

/** 至少有一篇已發布文章的主題，依主題 order 排序，各自附上已發布篇章 */
export async function publishedTopics(): Promise<PublishedTopic[]> {
  const posts = await publishedPosts()
  return sortedTopics()
    .map((topic) => ({ topic, posts: posts.filter((p) => topicOfPost(p.id) === topic.slug) }))
    .filter((group) => group.posts.length > 0)
}
