import { describe, expect, it } from 'vitest'

import {
  defaultAppHeaders,
  getTrailingApiVersion,
  isBase64ImageDataUrl,
  isDataUrl,
  parseDataUrl,
  withoutTrailingApiVersion
} from '../utils'

describe('parseDataUrl', () => {
  it('parses a standard base64 image data URL', () => {
    const result = parseDataUrl('data:image/png;base64,iVBORw0KGgo=')
    expect(result).toEqual({
      mediaType: 'image/png',
      isBase64: true,
      data: 'iVBORw0KGgo='
    })
  })

  it('parses a base64 data URL with additional parameters', () => {
    const result = parseDataUrl('data:image/jpeg;name=foo;base64,/9j/4AAQ')
    expect(result).toEqual({
      mediaType: 'image/jpeg',
      isBase64: true,
      data: '/9j/4AAQ'
    })
  })

  it('parses a plain text data URL (non-base64)', () => {
    const result = parseDataUrl('data:text/plain,Hello%20World')
    expect(result).toEqual({
      mediaType: 'text/plain',
      isBase64: false,
      data: 'Hello%20World'
    })
  })

  it('parses a data URL with empty media type', () => {
    const result = parseDataUrl('data:;base64,SGVsbG8=')
    expect(result).toEqual({
      mediaType: undefined,
      isBase64: true,
      data: 'SGVsbG8='
    })
  })

  it('returns null for non-data URLs', () => {
    const result = parseDataUrl('https://example.com/image.png')
    expect(result).toBeNull()
  })

  it('returns null for malformed data URL without comma', () => {
    const result = parseDataUrl('data:image/png;base64')
    expect(result).toBeNull()
  })

  it('handles empty string', () => {
    const result = parseDataUrl('')
    expect(result).toBeNull()
  })

  it('handles large base64 data without performance issues', () => {
    // Simulate a 4K image base64 string (about 1MB)
    const largeData = 'A'.repeat(1024 * 1024)
    const dataUrl = `data:image/png;base64,${largeData}`

    const start = performance.now()
    const result = parseDataUrl(dataUrl)
    const duration = performance.now() - start

    expect(result).not.toBeNull()
    expect(result?.mediaType).toBe('image/png')
    expect(result?.isBase64).toBe(true)
    expect(result?.data).toBe(largeData)
    // Should complete in under 10ms (string operations are fast)
    expect(duration).toBeLessThan(10)
  })

  it('parses SVG data URL', () => {
    const result = parseDataUrl('data:image/svg+xml;base64,PHN2Zz4=')
    expect(result).toEqual({
      mediaType: 'image/svg+xml',
      isBase64: true,
      data: 'PHN2Zz4='
    })
  })

  it('parses JSON data URL', () => {
    const result = parseDataUrl('data:application/json,{"key":"value"}')
    expect(result).toEqual({
      mediaType: 'application/json',
      isBase64: false,
      data: '{"key":"value"}'
    })
  })
})

describe('isDataUrl', () => {
  it('returns true for valid data URLs', () => {
    expect(isDataUrl('data:image/png;base64,ABC')).toBe(true)
    expect(isDataUrl('data:text/plain,hello')).toBe(true)
    expect(isDataUrl('data:,simple')).toBe(true)
  })

  it('returns false for non-data URLs', () => {
    expect(isDataUrl('https://example.com')).toBe(false)
    expect(isDataUrl('file:///path/to/file')).toBe(false)
    expect(isDataUrl('')).toBe(false)
  })

  it('returns false for malformed data URLs', () => {
    expect(isDataUrl('data:')).toBe(false)
    expect(isDataUrl('data:image/png')).toBe(false)
  })
})

describe('isBase64ImageDataUrl', () => {
  it('returns true for base64 image data URLs', () => {
    expect(isBase64ImageDataUrl('data:image/png;base64,ABC')).toBe(true)
    expect(isBase64ImageDataUrl('data:image/jpeg;base64,/9j/')).toBe(true)
    expect(isBase64ImageDataUrl('data:image/gif;base64,R0lG')).toBe(true)
    expect(isBase64ImageDataUrl('data:image/webp;base64,UklG')).toBe(true)
  })

  it('returns false for non-base64 image data URLs', () => {
    expect(isBase64ImageDataUrl('data:image/svg+xml,<svg></svg>')).toBe(false)
  })

  it('returns false for non-image data URLs', () => {
    expect(isBase64ImageDataUrl('data:text/plain;base64,SGVsbG8=')).toBe(false)
    expect(isBase64ImageDataUrl('data:application/json,{}')).toBe(false)
  })

  it('returns false for regular URLs', () => {
    expect(isBase64ImageDataUrl('https://example.com/image.png')).toBe(false)
    expect(isBase64ImageDataUrl('file:///image.png')).toBe(false)
  })

  it('returns false for malformed data URLs', () => {
    expect(isBase64ImageDataUrl('data:image/png')).toBe(false)
    expect(isBase64ImageDataUrl('')).toBe(false)
  })
})

describe('getTrailingApiVersion', () => {
  describe('Basic Version Extraction', () => {
    it('extracts v1 from end of URL', () => {
      expect(getTrailingApiVersion('https://api.example.com/v1')).toBe('v1')
    })

    it('extracts v2 from end of URL', () => {
      expect(getTrailingApiVersion('https://api.example.com/v2')).toBe('v2')
    })

    it('extracts version with trailing slash', () => {
      expect(getTrailingApiVersion('https://api.example.com/v1/')).toBe('v1')
    })

    it('extracts higher version numbers', () => {
      expect(getTrailingApiVersion('https://api.example.com/v10')).toBe('v10')
      expect(getTrailingApiVersion('https://api.example.com/v123')).toBe('v123')
    })
  })

  describe('Alpha/Beta Versions', () => {
    it('extracts v1alpha', () => {
      expect(getTrailingApiVersion('https://api.example.com/v1alpha')).toBe('v1alpha')
    })

    it('extracts v1beta', () => {
      expect(getTrailingApiVersion('https://api.example.com/v1beta')).toBe('v1beta')
    })

    it('extracts v2beta with trailing slash', () => {
      expect(getTrailingApiVersion('https://api.example.com/v2beta/')).toBe('v2beta')
    })

    it('handles case insensitivity', () => {
      expect(getTrailingApiVersion('https://api.example.com/V1BETA')).toBe('V1BETA')
      expect(getTrailingApiVersion('https://api.example.com/v1ALPHA')).toBe('v1ALPHA')
    })
  })

  describe('Non-Trailing Versions', () => {
    it('returns undefined when version is not at end', () => {
      expect(getTrailingApiVersion('https://api.example.com/v1/chat')).toBeUndefined()
    })

    it('returns undefined when version is in middle of path', () => {
      expect(getTrailingApiVersion('https://api.example.com/v1/completions/v2')).toBe('v2')
    })

    it('extracts last version from URL with multiple versions', () => {
      expect(getTrailingApiVersion('https://gateway.ai.cloudflare.com/v1/xxx/v1beta')).toBe('v1beta')
    })
  })

  describe('Edge Cases', () => {
    it('returns undefined for URL without version', () => {
      expect(getTrailingApiVersion('https://api.example.com')).toBeUndefined()
    })

    it('returns undefined for URL ending with resource', () => {
      expect(getTrailingApiVersion('https://api.example.com/chat')).toBeUndefined()
    })

    it('handles URL with only domain', () => {
      expect(getTrailingApiVersion('https://example.com')).toBeUndefined()
    })

    it('handles URL with query string', () => {
      // Version followed by query string should not match
      expect(getTrailingApiVersion('https://api.example.com/v1?key=value')).toBeUndefined()
    })
  })
})

describe('withoutTrailingApiVersion', () => {
  describe('Version Removal', () => {
    it('removes v1 from end of URL', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v1')).toBe('https://api.example.com')
    })

    it('removes v2 from end of URL', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v2')).toBe('https://api.example.com')
    })

    it('removes version with trailing slash', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v1/')).toBe('https://api.example.com')
    })

    it('removes beta version', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v2beta')).toBe('https://api.example.com')
    })

    it('removes alpha version', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v1alpha/')).toBe('https://api.example.com')
    })
  })

  describe('Non-Trailing Versions', () => {
    it('preserves URL when version is not at end', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v1/chat')).toBe('https://api.example.com/v1/chat')
    })

    it('only removes trailing version in multi-version URL', () => {
      expect(withoutTrailingApiVersion('https://gateway.ai.cloudflare.com/v1/xxx/v1beta')).toBe(
        'https://gateway.ai.cloudflare.com/v1/xxx'
      )
    })
  })

  describe('Edge Cases', () => {
    it('returns original URL when no version present', () => {
      expect(withoutTrailingApiVersion('https://api.example.com')).toBe('https://api.example.com')
    })

    it('returns original URL when ending with resource', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/chat')).toBe('https://api.example.com/chat')
    })

    it('handles URL with only domain', () => {
      expect(withoutTrailingApiVersion('https://example.com')).toBe('https://example.com')
    })

    it('preserves query strings (version not matched)', () => {
      expect(withoutTrailingApiVersion('https://api.example.com/v1?key=value')).toBe(
        'https://api.example.com/v1?key=value'
      )
    })
  })
})

describe('defaultAppHeaders', () => {
  it('returns correct HTTP-Referer header', () => {
    const headers = defaultAppHeaders()
    expect(headers['HTTP-Referer']).toBe('https://cherry-ai.com')
  })

  it('returns correct X-Title header', () => {
    const headers = defaultAppHeaders()
    expect(headers['X-Title']).toBe('Cherry Studio')
  })

  it('returns object with both headers', () => {
    const headers = defaultAppHeaders()
    expect(Object.keys(headers)).toHaveLength(2)
    expect(headers).toHaveProperty('HTTP-Referer')
    expect(headers).toHaveProperty('X-Title')
  })

  it('returns fresh object each call', () => {
    const headers1 = defaultAppHeaders()
    const headers2 = defaultAppHeaders()
    expect(headers1).not.toBe(headers2)
    expect(headers1).toEqual(headers2)
  })
})
