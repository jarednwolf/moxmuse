'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { useDebounce, useDebouncedCallback } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface OptimizedSearchProps {
  placeholder?: string
  value?: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  debounceMs?: number
  className?: string
  showClearButton?: boolean
  autoFocus?: boolean
  disabled?: boolean
  minLength?: number
  maxLength?: number
}

export function OptimizedSearch({
  placeholder = 'Search...',
  value = '',
  onChange,
  onSearch,
  debounceMs = 300,
  className,
  showClearButton = true,
  autoFocus = false,
  disabled = false,
  minLength = 0,
  maxLength
}: OptimizedSearchProps) {
  const [inputValue, setInputValue] = useState(value)
  const [isFocused, setIsFocused] = useState(false)

  // Debounce the search value
  const debouncedValue = useDebounce(inputValue, debounceMs)

  // Debounced search callback
  const debouncedSearch = useDebouncedCallback(
    (searchValue: string) => {
      if (searchValue.length >= minLength) {
        onSearch?.(searchValue)
      }
    },
    debounceMs
  )

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    
    // Apply max length constraint
    if (maxLength && newValue.length > maxLength) {
      return
    }

    setInputValue(newValue)
    debouncedSearch(newValue)
  }, [maxLength, debouncedSearch])

  // Handle clear
  const handleClear = useCallback(() => {
    setInputValue('')
    onChange('')
    onSearch?.('')
  }, [onChange, onSearch])

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch?.(inputValue)
    } else if (e.key === 'Escape') {
      handleClear()
    }
  }, [inputValue, onSearch, handleClear])

  // Update parent when debounced value changes
  React.useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue)
    }
  }, [debouncedValue, value, onChange])

  // Sync with external value changes
  React.useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value)
    }
  }, [value])

  const showClear = showClearButton && inputValue.length > 0

  return (
    <div className={cn(
      'relative flex items-center',
      className
    )}>
      {/* Search Icon */}
      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400">
        <Search className="w-4 h-4" />
      </div>

      {/* Input */}
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyPress}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={cn(
          'w-full pl-10 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-lg',
          'text-zinc-100 placeholder-zinc-400',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
          'transition-all duration-200',
          disabled && 'opacity-50 cursor-not-allowed',
          isFocused && 'bg-zinc-750'
        )}
      />

      {/* Clear Button */}
      {showClear && (
        <button
          onClick={handleClear}
          className={cn(
            'absolute right-3 top-1/2 transform -translate-y-1/2',
            'text-zinc-400 hover:text-zinc-200 transition-colors',
            'focus:outline-none focus:text-zinc-200'
          )}
          tabIndex={-1}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Character count (if maxLength is set) */}
      {maxLength && (
        <div className="absolute -bottom-5 right-0 text-xs text-zinc-500">
          {inputValue.length}/{maxLength}
        </div>
      )}
    </div>
  )
}

// Advanced search with filters
interface SearchFilter {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
}

interface AdvancedSearchProps extends Omit<OptimizedSearchProps, 'onChange' | 'onSearch'> {
  filters?: SearchFilter[]
  selectedFilters?: Record<string, string>
  onSearchChange: (query: string, filters: Record<string, string>) => void
  showFilters?: boolean
}

export function AdvancedSearch({
  filters = [],
  selectedFilters = {},
  onSearchChange,
  showFilters = true,
  ...searchProps
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState(selectedFilters)

  // Debounced search with filters
  const debouncedSearchWithFilters = useDebouncedCallback(
    (searchQuery: string, filterValues: Record<string, string>) => {
      onSearchChange(searchQuery, filterValues)
    },
    searchProps.debounceMs || 300
  )

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery)
    debouncedSearchWithFilters(newQuery, activeFilters)
  }, [activeFilters, debouncedSearchWithFilters])

  const handleFilterChange = useCallback((filterKey: string, value: string) => {
    const newFilters = { ...activeFilters }
    if (value) {
      newFilters[filterKey] = value
    } else {
      delete newFilters[filterKey]
    }
    
    setActiveFilters(newFilters)
    debouncedSearchWithFilters(query, newFilters)
  }, [query, activeFilters, debouncedSearchWithFilters])

  const activeFilterCount = Object.keys(activeFilters).length

  return (
    <div className="space-y-3">
      {/* Search Input */}
      <OptimizedSearch
        {...searchProps}
        value={query}
        onChange={handleQueryChange}
      />

      {/* Filters */}
      {showFilters && filters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <select
              key={filter.key}
              value={activeFilters[filter.key] || ''}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
              className={cn(
                'px-3 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded',
                'text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500',
                activeFilters[filter.key] && 'bg-blue-900 border-blue-600'
              )}
            >
              <option value="">{filter.label}</option>
              {filter.options.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}
          
          {/* Clear filters button */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setActiveFilters({})
                debouncedSearchWithFilters(query, {})
              }}
              className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      )}
    </div>
  )
}
