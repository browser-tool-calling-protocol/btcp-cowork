/**
 * TagExtractor Comprehensive Tests
 * Tests tag extraction functionality for streaming content
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { getPotentialStartIndex, TagExtractor } from '../tagExtraction'

describe('getPotentialStartIndex', () => {
  describe('Direct Match', () => {
    it('should return index for direct substring match', () => {
      expect(getPotentialStartIndex('hello <think> world', '<think>')).toBe(6)
    })

    it('should return 0 for match at start', () => {
      expect(getPotentialStartIndex('<think> content', '<think>')).toBe(0)
    })

    it('should return first match index when multiple occurrences', () => {
      expect(getPotentialStartIndex('<think> one <think> two', '<think>')).toBe(0)
    })
  })

  describe('Partial Match (Suffix-Prefix)', () => {
    it('should find partial match at end of text', () => {
      expect(getPotentialStartIndex('hello <thi', '<think>')).toBe(6)
    })

    it('should find single character partial match', () => {
      expect(getPotentialStartIndex('text <', '<think>')).toBe(5)
    })

    it('should find longer partial match', () => {
      expect(getPotentialStartIndex('prefix <thin', '<think>')).toBe(7)
    })

    it('should return null when no match possible', () => {
      expect(getPotentialStartIndex('hello world', '<think>')).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should return null for empty searchedText', () => {
      expect(getPotentialStartIndex('hello', '')).toBeNull()
    })

    it('should handle empty text', () => {
      expect(getPotentialStartIndex('', '<think>')).toBeNull()
    })

    it('should handle text shorter than searchedText', () => {
      expect(getPotentialStartIndex('hi', '<think>')).toBeNull()
    })

    it('should handle exact match', () => {
      expect(getPotentialStartIndex('<think>', '<think>')).toBe(0)
    })
  })
})

describe('TagExtractor', () => {
  describe('Basic Tag Extraction', () => {
    let extractor: TagExtractor

    beforeEach(() => {
      extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>'
      })
    })

    it('should extract content before opening tag', () => {
      const results = extractor.processText('Hello <think>thinking</think> world')

      const textContent = results.filter((r) => !r.isTagContent && r.content)
      expect(textContent.map((r) => r.content).join('')).toContain('Hello ')
    })

    it('should mark content inside tags as tag content', () => {
      const results = extractor.processText('Before <think>inside</think> After')

      const tagContent = results.filter((r) => r.isTagContent)
      expect(tagContent.length).toBeGreaterThan(0)
    })

    it('should extract complete tag content', () => {
      const results = extractor.processText('<think>complete thinking</think>')

      const completeResult = results.find((r) => r.complete && r.tagContentExtracted)
      expect(completeResult?.tagContentExtracted).toBe('complete thinking')
    })

    it('should handle multiple tag pairs', () => {
      const results = extractor.processText('<think>first</think> middle <think>second</think>')

      const completeResults = results.filter((r) => r.complete && r.tagContentExtracted)
      expect(completeResults).toHaveLength(2)
      expect(completeResults[0].tagContentExtracted).toBe('first')
      expect(completeResults[1].tagContentExtracted).toBe('second')
    })
  })

  describe('Streaming Behavior', () => {
    let extractor: TagExtractor

    beforeEach(() => {
      extractor = new TagExtractor({
        openingTag: '<tool_call>',
        closingTag: '</tool_call>'
      })
    })

    it('should handle content arriving in chunks', () => {
      // Simulate streaming chunks
      let allResults: any[] = []

      allResults = allResults.concat(extractor.processText('Hello '))
      allResults = allResults.concat(extractor.processText('<tool_call>'))
      allResults = allResults.concat(extractor.processText('calling '))
      allResults = allResults.concat(extractor.processText('tool'))
      allResults = allResults.concat(extractor.processText('</tool_call>'))
      allResults = allResults.concat(extractor.processText(' done'))

      const completeResult = allResults.find((r) => r.complete && r.tagContentExtracted)
      expect(completeResult?.tagContentExtracted).toBe('calling tool')
    })

    it('should handle partial tag across chunks', () => {
      let allResults: any[] = []

      allResults = allResults.concat(extractor.processText('content <tool'))
      allResults = allResults.concat(extractor.processText('_call>inside</tool_call>'))

      const completeResult = allResults.find((r) => r.complete && r.tagContentExtracted)
      expect(completeResult?.tagContentExtracted).toBe('inside')
    })

    it('should handle opening tag split across chunks', () => {
      let allResults: any[] = []

      allResults = allResults.concat(extractor.processText('prefix <to'))
      allResults = allResults.concat(extractor.processText('ol_call>content</tool_call>'))

      const completeResult = allResults.find((r) => r.complete && r.tagContentExtracted)
      expect(completeResult?.tagContentExtracted).toBe('content')
    })

    it('should handle closing tag split across chunks', () => {
      let allResults: any[] = []

      allResults = allResults.concat(extractor.processText('<tool_call>inside</tool'))
      allResults = allResults.concat(extractor.processText('_call>after'))

      const completeResult = allResults.find((r) => r.complete && r.tagContentExtracted)
      expect(completeResult?.tagContentExtracted).toBe('inside')
    })
  })

  describe('Separator Handling', () => {
    it('should add separator between non-tag and tag content', () => {
      const extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>',
        separator: '\n\n'
      })

      const results = extractor.processText('text<think>thought</think>more')

      // Check that separator is added appropriately
      const allContent = results.map((r) => r.content).join('')
      expect(allContent).toContain('\n\n')
    })

    it('should work without separator', () => {
      const extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>'
      })

      const results = extractor.processText('text<think>thought</think>more')
      const allContent = results.map((r) => r.content).join('')

      // Should not have extra separators
      expect(allContent).not.toContain('\n\n')
    })
  })

  describe('Reset Functionality', () => {
    it('should reset state for reuse', () => {
      const extractor = new TagExtractor({
        openingTag: '<tag>',
        closingTag: '</tag>'
      })

      // First extraction
      extractor.processText('<tag>first</tag>')

      // Reset
      extractor.reset()

      // Second extraction should work independently
      const results = extractor.processText('<tag>second</tag>')
      const completeResult = results.find((r) => r.complete && r.tagContentExtracted)

      expect(completeResult?.tagContentExtracted).toBe('second')
    })
  })

  describe('Finalize', () => {
    it('should return accumulated tag content on finalize', () => {
      const extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>'
      })

      // Process partial content without closing tag
      extractor.processText('<think>partial content')

      // Finalize should return accumulated content
      const finalResult = extractor.finalize()
      expect(finalResult?.tagContentExtracted).toBe('partial content')
    })

    it('should return null when no accumulated content', () => {
      const extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>'
      })

      extractor.processText('no tags here')

      const finalResult = extractor.finalize()
      expect(finalResult).toBeNull()
    })

    it('should return null after complete tag extraction', () => {
      const extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>'
      })

      extractor.processText('<think>complete</think>')

      const finalResult = extractor.finalize()
      // Content was already returned as complete, so finalize returns null
      expect(finalResult).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const extractor = new TagExtractor({
        openingTag: '<tag>',
        closingTag: '</tag>'
      })

      const results = extractor.processText('')
      expect(results).toEqual([])
    })

    it('should handle nested-looking content', () => {
      const extractor = new TagExtractor({
        openingTag: '<outer>',
        closingTag: '</outer>'
      })

      const results = extractor.processText('<outer>text <inner>nested</inner> more</outer>')
      const completeResult = results.find((r) => r.complete && r.tagContentExtracted)

      // Should capture everything between outer tags
      expect(completeResult?.tagContentExtracted).toBe('text <inner>nested</inner> more')
    })

    it('should handle special characters in content', () => {
      const extractor = new TagExtractor({
        openingTag: '<code>',
        closingTag: '</code>'
      })

      const content = 'function() { return "hello"; }'
      const results = extractor.processText(`<code>${content}</code>`)
      const completeResult = results.find((r) => r.complete && r.tagContentExtracted)

      expect(completeResult?.tagContentExtracted).toBe(content)
    })

    it('should handle unicode content', () => {
      const extractor = new TagExtractor({
        openingTag: '<text>',
        closingTag: '</text>'
      })

      const unicodeContent = '你好世界 🌍 مرحبا'
      const results = extractor.processText(`<text>${unicodeContent}</text>`)
      const completeResult = results.find((r) => r.complete && r.tagContentExtracted)

      expect(completeResult?.tagContentExtracted).toBe(unicodeContent)
    })

    it('should handle very long content', () => {
      const extractor = new TagExtractor({
        openingTag: '<data>',
        closingTag: '</data>'
      })

      const longContent = 'x'.repeat(10000)
      const results = extractor.processText(`<data>${longContent}</data>`)
      const completeResult = results.find((r) => r.complete && r.tagContentExtracted)

      expect(completeResult?.tagContentExtracted).toBe(longContent)
    })
  })

  describe('Think Tag Specific Tests', () => {
    let extractor: TagExtractor

    beforeEach(() => {
      extractor = new TagExtractor({
        openingTag: '<think>',
        closingTag: '</think>',
        separator: '\n\n'
      })
    })

    it('should extract thinking content correctly', () => {
      const results = extractor.processText(
        'Let me think about this. <think>Analyzing the problem step by step...</think> Based on my analysis...'
      )

      const thinkContent = results.find((r) => r.complete && r.tagContentExtracted)
      expect(thinkContent?.tagContentExtracted).toBe('Analyzing the problem step by step...')
    })

    it('should handle multiple thinking blocks', () => {
      const results = extractor.processText(
        '<think>First thought</think> response <think>Second thought</think> more response'
      )

      const completeResults = results.filter((r) => r.complete && r.tagContentExtracted)
      expect(completeResults).toHaveLength(2)
      expect(completeResults[0].tagContentExtracted).toBe('First thought')
      expect(completeResults[1].tagContentExtracted).toBe('Second thought')
    })
  })
})
