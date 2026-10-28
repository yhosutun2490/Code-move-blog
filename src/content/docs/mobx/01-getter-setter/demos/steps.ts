// 每一步的程式碼放在獨立的 .js 檔，編輯器有完整語法提示；這裡用 ?raw 讀成字串
import manual from './steps/01-manual.js?raw'
import defineProperty from './steps/02-define-property.js?raw'
import subscribers from './steps/03-subscribers.js?raw'
import autorun from './steps/04-autorun.js?raw'
import usage from './steps/05-usage.js?raw'
import type { Step } from '../../../../../lib/types'

export const steps: Step[] = [
  {
    title: '手動 render',
    note: '資料和畫面之間沒有連結，每次改完資料都要自己記得呼叫 render()。',
    code: manual,
  },
  {
    title: 'getter / setter',
    note: '用 Object.defineProperty 攔截讀和寫。現在「有人讀」「有人改」這兩件事我們都知道了。',
    code: defineProperty,
  },
  {
    title: '訂閱者清單',
    note: '把攔截推廣到每個 key，並替每個 key 準備一個 subscribers Set，寫入時通知它們。',
    code: subscribers,
  },
  {
    title: 'autorun 與依賴收集',
    note: '關鍵在 activeEffect：autorun 執行期間讀到的 key，會自動把這個 effect 記進自己的訂閱者清單。',
    code: autorun,
  },
  {
    title: '實際使用',
    note: '改 qty 會自動重算；改 note 不會，因為 autorun 從來沒讀過它。這就是「依賴追蹤」。',
    code: usage,
  },
]
