// PROTOTYPE — 首頁版面原型用的資料，丟掉即可（見 src/pages/index.astro 頂端說明）。
// 真實資料只有一個主題一篇文章，版面在真空裡都好看，所以另外墊一批「模擬」篇章與主題，
// 帶 fake: true，切換列的「模擬資料」關掉時會整批隱藏（[data-fake]）。
import type { PublishedTopic } from '../../lib/series'

export interface ProtoPost {
  href: string
  num: string
  title: string
  description: string
  fake: boolean
}

export interface ProtoGroup {
  slug: string
  name: string
  description: string
  posts: ProtoPost[]
  fake: boolean
}

const fakePost = (title: string, description: string) => ({ title, description })

const EXTRA_MOBX = [
  fakePost('observable：把整個物件變成響應式', '用 Proxy 取代逐一定義 getter / setter，讓新增的屬性、陣列、Map 也能被追蹤。'),
  fakePost('computed：會自己記住結果的 getter', '加一層快取與髒標記，只有依賴真的變了才重算，而且沒人讀就不算。'),
  fakePost('action 與批次更新', '連續改三個值卻只想重跑一次 autorun：交易、批次與為什麼 strict mode 要你包 action。'),
  fakePost('observer：React 元件怎麼知道要重畫', '把 autorun 換成元件的 render，拆解 mobx-react-lite 在 useSyncExternalStore 上做了什麼。'),
]

const FAKE_TOPICS: { slug: string; name: string; description: string; posts: { title: string; description: string }[] }[] = [
  {
    slug: 'fake-react',
    name: 'React 原始碼散步',
    description: '從 createRoot 一路走到 commit，看 Fiber、lanes 與 hooks 的鏈結串列怎麼串起來。',
    posts: [
      fakePost('useState 其實是一條鏈結串列', '為什麼 hooks 不能放在 if 裡：拆開 mountState 與 updateState。'),
      fakePost('Fiber：可以中斷的遞迴', '把遞迴改寫成迴圈，讓渲染可以暫停、讓出主執行緒、再接著做。'),
      fakePost('lanes：用位元表示優先權', '一個 31 位元的整數怎麼同時表示多個更新的優先權與合併。'),
    ],
  },
  {
    slug: 'fake-ts',
    name: 'TypeScript 型別體操',
    description: '把型別當程式寫：條件型別、infer、遞迴與模板字面值型別。',
    posts: [
      fakePost('infer：在型別裡做模式比對', '從 ReturnType 開始，用 infer 把型別拆開再組回去。'),
      fakePost('用模板字面值型別解析路由參數', '把 "/users/:id" 變成 { id: string }，一步步寫出型別層級的 parser。'),
    ],
  },
]

/** 真實已發布主題 + 模擬篇章 / 主題（模擬的帶 fake: true） */
export function protoGroups(real: PublishedTopic[]): ProtoGroup[] {
  const groups: ProtoGroup[] = real.map(({ topic, posts }) => {
    const realPosts: ProtoPost[] = posts.map((post) => ({
      href: `/${post.id}/`,
      num: String(post.data.order).padStart(2, '0'),
      title: post.data.title,
      description: post.data.description,
      fake: false,
    }))
    const extra =
      topic.slug === 'mobx'
        ? EXTRA_MOBX.map((p, i) => ({
            ...p,
            href: '#',
            num: String(realPosts.length + i + 1).padStart(2, '0'),
            fake: true,
          }))
        : []
    return { slug: topic.slug, name: topic.name, description: topic.description, posts: [...realPosts, ...extra], fake: false }
  })
  const fakes: ProtoGroup[] = FAKE_TOPICS.map((t) => ({
    ...t,
    fake: true,
    posts: t.posts.map((p, i) => ({ ...p, href: '#', num: String(i + 1).padStart(2, '0'), fake: true })),
  }))
  return [...groups, ...fakes]
}
