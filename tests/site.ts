/// <reference types="node" />
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse, type HTMLElement } from 'node-html-parser'
import { parse as parseYaml } from 'yaml'

// 測試只看兩樣東西：作者寫的文章原稿（規格），和 build 出來的 dist（結果）。
// 不碰元件或版型內部，換成 Starlight 後才不用重寫。

export const ROOT = join(import.meta.dirname, '..')
export const DIST = join(ROOT, 'dist')

export interface Article {
  folder: string
  title: string
  description: string
  order: number
  draft: boolean
  source: string
  url: string
}

// 文章資料夾可能在 src/content/mobx 或 src/content/docs/mobx，往下找名為 mobx 的資料夾
function findSeriesDirs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const full = join(dir, d.name)
      return d.name === 'mobx' ? [full] : findSeriesDirs(full)
    })
}

export function loadArticles(): Article[] {
  return findSeriesDirs(join(ROOT, 'src/content'))
    .flatMap((seriesDir) =>
      readdirSync(seriesDir).flatMap((folder) => {
        const file = ['index.mdx', 'index.md']
          .map((name) => join(seriesDir, folder, name))
          .find((path) => existsSync(path))
        if (!file) return []
        const source = readFileSync(file, 'utf8')
        const data = parseYaml(source.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1])
        return [
          {
            folder,
            title: data.title,
            description: data.description,
            order: data.order,
            draft: data.draft === true,
            source,
            url: `/mobx/${folder}/`,
          },
        ]
      }),
    )
    .sort((a, b) => a.order - b.order)
}

export const articles = loadArticles()
export const published = articles.filter((a) => !a.draft)

// 網址 → dist 裡對應的 HTML 檔
export function pagePath(url: string) {
  return join(DIST, url, 'index.html')
}

export function pageExists(url: string) {
  const path = pagePath(url)
  return existsSync(path) && statSync(path).isFile()
}

export function loadPage(url: string): HTMLElement {
  return parse(readFileSync(pagePath(url), 'utf8'))
}

export function distFiles(dir = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = join(dir, d.name)
    return d.isDirectory() ? distFiles(full) : [full]
  })
}

// 讀者瀏覽器可能下載到的所有 JS
export function clientScripts() {
  return distFiles().filter((file) => /\.(m?js)$/.test(file))
}

// 壓掉空白，方便比對讀者看到的文字
export function text(el: HTMLElement | null | undefined) {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}
