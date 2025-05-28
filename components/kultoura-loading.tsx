"use client"

import { useEffect, useState } from "react"

export default function KultouraLoading() {
  const [visibleLetters, setVisibleLetters] = useState(0)
  const letters = "KULTOURA".split("")

  useEffect(() => {
    // Ensure minimum 3 seconds display time
    const minDisplayTime = setTimeout(() => {
      // Component will be unmounted by parent when auth resolves
    }, 3000)

    const letterInterval = setInterval(() => {
      setVisibleLetters((prev) => {
        if (prev >= letters.length) {
          return 0 // Reset to start over
        }
        return prev + 1
      })
    }, 250)

    return () => {
      clearInterval(letterInterval)
      clearTimeout(minDisplayTime)
    }
  }, [letters.length])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-8xl md:text-9xl font-bold tracking-wider">
          {letters.map((letter, index) => (
            <span
              key={index}
              className={`inline-block transition-all duration-500 ${
                index < visibleLetters
                  ? "opacity-100 transform translate-y-0 text-gray-900"
                  : "opacity-0 transform translate-y-4 text-gray-300"
              }`}
            >
              {letter}
            </span>
          ))}
        </h1>
      </div>
    </div>
  )
}
