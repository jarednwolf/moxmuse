import { useState, useEffect, useCallback, useMemo } from 'react'

interface VirtualizationOptions {
  itemHeight: number
  containerHeight: number
  overscan?: number
  itemCount: number
}

interface VirtualItem {
  index: number
  start: number
  end: number
}

export function useVirtualization({
  itemHeight,
  containerHeight,
  overscan = 5,
  itemCount
}: VirtualizationOptions) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight)
    )

    // Add overscan items
    const overscanStart = Math.max(0, startIndex - overscan)
    const overscanEnd = Math.min(itemCount - 1, endIndex + overscan)

    return {
      startIndex: overscanStart,
      endIndex: overscanEnd,
      visibleStartIndex: startIndex,
      visibleEndIndex: endIndex
    }
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan])

  const virtualItems = useMemo(() => {
    const items: VirtualItem[] = []
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      items.push({
        index: i,
        start: i * itemHeight,
        end: (i + 1) * itemHeight
      })
    }
    return items
  }, [visibleRange, itemHeight])

  const totalHeight = itemCount * itemHeight

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    virtualItems,
    totalHeight,
    handleScroll,
    visibleRange
  }
}

// Hook for grid virtualization (2D)
interface GridVirtualizationOptions {
  itemWidth: number
  itemHeight: number
  containerWidth: number
  containerHeight: number
  itemCount: number
  gap?: number
  overscan?: number
}

export function useGridVirtualization({
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  itemCount,
  gap = 0,
  overscan = 5
}: GridVirtualizationOptions) {
  const [scrollTop, setScrollTop] = useState(0)

  const columnsPerRow = Math.floor(containerWidth / (itemWidth + gap))
  const rowCount = Math.ceil(itemCount / columnsPerRow)
  const rowHeight = itemHeight + gap

  const visibleRange = useMemo(() => {
    const startRow = Math.floor(scrollTop / rowHeight)
    const endRow = Math.min(
      rowCount - 1,
      Math.ceil((scrollTop + containerHeight) / rowHeight)
    )

    // Add overscan
    const overscanStartRow = Math.max(0, startRow - overscan)
    const overscanEndRow = Math.min(rowCount - 1, endRow + overscan)

    const startIndex = overscanStartRow * columnsPerRow
    const endIndex = Math.min(itemCount - 1, (overscanEndRow + 1) * columnsPerRow - 1)

    return {
      startIndex,
      endIndex,
      startRow: overscanStartRow,
      endRow: overscanEndRow,
      visibleStartRow: startRow,
      visibleEndRow: endRow
    }
  }, [scrollTop, rowHeight, containerHeight, rowCount, columnsPerRow, itemCount, overscan])

  const virtualItems = useMemo(() => {
    const items: Array<VirtualItem & { row: number; column: number }> = []
    
    for (let i = visibleRange.startIndex; i <= visibleRange.endIndex; i++) {
      const row = Math.floor(i / columnsPerRow)
      const column = i % columnsPerRow
      
      items.push({
        index: i,
        start: row * rowHeight,
        end: (row + 1) * rowHeight,
        row,
        column
      })
    }
    
    return items
  }, [visibleRange, columnsPerRow, rowHeight])

  const totalHeight = rowCount * rowHeight

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  return {
    virtualItems,
    totalHeight,
    handleScroll,
    visibleRange,
    columnsPerRow,
    rowCount
  }
}