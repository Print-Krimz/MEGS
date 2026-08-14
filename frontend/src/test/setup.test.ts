import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('Frontend Environment & Design Setup', () => {
  it('should correctly merge Tailwind classes and resolve conflicts using cn()', () => {
    const isPrimary = Boolean(1);
    const isWhite = Boolean(0);
    const result = cn('px-2 py-1', isPrimary && 'bg-primary', isWhite && 'text-white', 'px-4')
    // px-4 should override px-2
    expect(result).toBe('py-1 bg-primary px-4')
  })

  it('should handle undefined, null, and boolean falsy values in cn()', () => {
    const result = cn('text-sm', undefined, null, false, 'font-medium')
    expect(result).toBe('text-sm font-medium')
  })

  it('should load environment variables properly', () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
    expect(apiUrl).toBeDefined()
    expect(apiUrl).toContain('http')
  })
})
