import React from 'react'

interface HighlightTextProps {
  text: string
  searchQuery: string
  className?: string
  highlightClassName?: string
}

export function HighlightText({ 
  text, 
  searchQuery, 
  className = '', 
  highlightClassName = 'bg-yellow-400 text-black px-0.5 rounded' 
}: HighlightTextProps) {
  if (!searchQuery.trim()) {
    return <span className={className}>{text}</span>
  }

  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  return (
    <span className={className}>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <mark key={index} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </span>
  )
}