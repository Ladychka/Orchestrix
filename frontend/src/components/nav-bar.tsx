"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Bot, Moon, Sun } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function NavBar() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // avoid hydration mismatch on the toggle icon
  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div
            className={cn(
              "w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground",
              "transition-transform group-hover:scale-105"
            )}
          >
            <Bot className="w-[18px] h-[18px]" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            AI Employee Dashboard
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-xs text-muted-foreground">
            AI Finance Officer MVP
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 rounded-full"
            aria-label="Toggle theme"
          >
            {mounted && theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </nav>
  )
}
