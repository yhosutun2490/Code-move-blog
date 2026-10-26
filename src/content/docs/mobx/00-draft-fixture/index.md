---
title: 草稿測試樣本（不會發布）
description: 測試用的草稿，用來確認 draft 文章在正式 build 裡完全消失。請不要刪除或改成非草稿。
order: 0
draft: true
---

這篇是 `tests/` 用的測試樣本，不是真正的文章。

它排在第 1 篇前面（`order: 0`），所以第 1 篇的「上一篇」必須跳過它。
測試會在整個 `dist/` 裡找下面這個記號，找到就代表草稿外洩了：

draftmarkerfixture00

## 草稿裡的小標

只有 `npm run dev` 看得到這一頁。
