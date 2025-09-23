import React from 'react'
import { usePerformanceMonitor } from './lib/performance/PerformanceMonitor'

export default function TestPerformance() {
  const { recordMetric, measureSync } = usePerformanceMonitor()

  React.useEffect(() => {
    recordMetric('test-metric', 100)
  }, [recordMetric])

  const handleClick = () => {
    measureSync('button-click', () => {
      console.log('Button clicked')
    })
  }

  return (
    <div>
      <h1>Performance Monitor Test</h1>
      <button onClick={handleClick}>Test Performance</button>
    </div>
  )
}