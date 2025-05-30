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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-stone-50 to-amber-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-32 h-32 border border-amber-300 rounded-full"></div>
        <div className="absolute top-40 right-32 w-24 h-24 border border-stone-300 rounded-full"></div>
        <div className="absolute bottom-32 left-1/3 w-20 h-20 border border-amber-300 rounded-full"></div>
        <div className="absolute bottom-20 right-20 w-28 h-28 border border-stone-300 rounded-full"></div>
      </div>

      <div className="text-center relative z-10">
        <h1 className="text-8xl md:text-9xl font-bold tracking-wider">
          {letters.map((letter, index) => (
            <span
              key={index}
              className={`inline-block transition-all duration-500 ${
                index < visibleLetters
                  ? "opacity-100 transform translate-y-0 text-amber-800"
                  : "opacity-0 transform translate-y-4 text-stone-300"
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
