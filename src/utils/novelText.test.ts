import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  formatCount,
  formatWordCount,
  novelContentWordCount,
  novelParagraphExcerpt,
  novelParagraphImage,
  novelWordCount,
  splitNovelParagraphs,
} from './novelText.js'

// 与后端 domain.SplitNovelParagraphs 对齐：换行分隔 → 去首尾空白 → 丢弃空行。

test('splits on newlines and drops blank lines', () => {
  assert.deepEqual(splitNovelParagraphs('第一段\n第二段\n第三段'), ['第一段', '第二段', '第三段'])
  assert.deepEqual(splitNovelParagraphs('第一段\n\n\n第二段'), ['第一段', '第二段'])
  assert.deepEqual(splitNovelParagraphs(''), [])
  assert.deepEqual(splitNovelParagraphs('\n \n\t\n'), [])
})

test('normalises CRLF and lone CR to LF', () => {
  assert.deepEqual(splitNovelParagraphs('a\r\nb\rc'), ['a', 'b', 'c'])
  assert.deepEqual(splitNovelParagraphs('a\r\n\r\nb'), ['a', 'b'])
})

test('trims leading and trailing whitespace per line, keeps inner spaces', () => {
  assert.deepEqual(splitNovelParagraphs('   第一段   \n  他 说  '), ['第一段', '他 说'])
  assert.deepEqual(splitNovelParagraphs('\t第一段\t'), ['第一段'])
})

test('trims full-width space and U+0085 like Go TrimSpace', () => {
  assert.deepEqual(splitNovelParagraphs('　第一段　'), ['第一段'])
  assert.deepEqual(splitNovelParagraphs('　　'), [])
  assert.deepEqual(splitNovelParagraphs('第一段'), ['第一段'])
})

// 与后端 novel_service.go 一致：Index 取 split 结果下标（0-based），展示层再 +1。
test('paragraph index is 0-based position in the split result', () => {
  const parts = splitNovelParagraphs('一\n\n二\n三')
  assert.deepEqual(parts.map((t, i) => ({ index: i, text: t })), [
    { index: 0, text: '一' },
    { index: 1, text: '二' },
    { index: 2, text: '三' },
  ])
})

test('excerpt truncates by runes and appends ellipsis', () => {
  const long = '晚'.repeat(60)
  const cut = novelParagraphExcerpt(long)
  assert.equal(Array.from(cut).length, 41)
  assert.ok(cut.endsWith('…'))
  assert.equal(novelParagraphExcerpt('短句子'), '短句子')
  assert.equal(novelParagraphExcerpt('   带空白   '), '带空白')
})

test('word count ignores all whitespace', () => {
  assert.equal(novelWordCount('你好 世界\n'), 4)
  assert.equal(novelWordCount('  \t\n  '), 0)
  assert.equal(novelWordCount('abc def'), 6)
})

// 与后端 domain.NovelParagraphImage 对齐：整段只有图片本身才算图片段落。
test('detects image paragraphs (markdown or bare image link)', () => {
  assert.equal(novelParagraphImage('![封面](https://cdn.example/a.png)'), 'https://cdn.example/a.png')
  assert.equal(novelParagraphImage('![](https://cdn.example/a.jpg)'), 'https://cdn.example/a.jpg')
  assert.equal(novelParagraphImage('![x](https://cdn.example/a.webp "标题")'), 'https://cdn.example/a.webp')
  assert.equal(novelParagraphImage('https://cdn.example/dir/photo.PNG'), 'https://cdn.example/dir/photo.PNG')
  assert.equal(novelParagraphImage('https://cdn.example/a.png?x-oss-process=resize'), 'https://cdn.example/a.png?x-oss-process=resize')
  assert.equal(novelParagraphImage('//cdn.example/a.gif'), '//cdn.example/a.gif')
  // Markdown 写法允许无扩展名的图床链接（作者已明确「这是一张图」）
  assert.equal(novelParagraphImage('![配图](https://image.example/i/1728abc)'), 'https://image.example/i/1728abc')
  // 不是图片段落的情况
  assert.equal(novelParagraphImage('他看着窗外的雨'), '')
  assert.equal(novelParagraphImage('看图 https://cdn.example/a.png'), '')
  assert.equal(novelParagraphImage('![附件](https://cdn.example/a.pdf)'), '')
  assert.equal(novelParagraphImage('![录像](https://cdn.example/a.mp4)'), '')
  assert.equal(novelParagraphImage('https://image.example/i/1728abc'), '')
  assert.equal(novelParagraphImage('![缺括号](https://cdn.example/a.png'), '')
  assert.equal(novelParagraphImage('   '), '')
})

test('an image with blank lines around it is its own paragraph', () => {
  const parts = splitNovelParagraphs('正文一\n\n![](https://cdn.example/a.png)\n\n正文二')
  assert.deepEqual(parts, ['正文一', '![](https://cdn.example/a.png)', '正文二'])
  assert.equal(novelParagraphImage(parts[1]), 'https://cdn.example/a.png')
})

test('content word count skips image paragraphs', () => {
  assert.equal(novelContentWordCount('abcd\n\n![](https://cdn.example/aaaaaaaaaaaaaaaaaaaa.png)\n\nefgh'), 8)
  assert.equal(novelContentWordCount('你好 世界'), 4)
})

test('image paragraph excerpt is a placeholder', () => {
  assert.equal(novelParagraphExcerpt('![](https://cdn.example/a.png)'), '[图片]')
})

test('formats word counts like the reading apps', () => {
  assert.equal(formatWordCount(0), '0字')
  assert.equal(formatWordCount(8620), '8620字')
  assert.equal(formatWordCount(12000), '1.2万字')
  assert.equal(formatWordCount(10000), '1万字')
  assert.equal(formatWordCount(123456), '12万字')
})

test('formats large counts compactly', () => {
  assert.equal(formatCount(0), '0')
  assert.equal(formatCount(999), '999')
  assert.equal(formatCount(15000), '1.5万')
  assert.equal(formatCount(123456), '12.3万')
  assert.equal(formatCount(1234567), '123万')
})
