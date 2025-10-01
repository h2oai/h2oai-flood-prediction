"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  id: number
  name: string
  desc?: string
  icon?: LucideIcon
}

interface TubelightNavbarProps {
  items: NavItem[]
  activeTab: number
  onTabChange: (tabId: number) => void
  className?: string
}

export function TubelightNavbar({ items, activeTab, onTabChange, className }: TubelightNavbarProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div
      className={cn(
        "flex items-center gap-1 bg-gray-900/50 backdrop-blur-lg py-1 px-1 rounded-lg border border-gray-700/50",
        className,
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id

        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              "relative cursor-pointer text-sm font-medium px-4 py-2 rounded-lg transition-colors",
              "text-gray-400",
              !isActive && "hover:text-primary",
              isActive && "text-primary",
            )}
            title={item.desc}
          >
            <div className="flex items-center space-x-2">
              {Icon && !isMobile && <Icon className="h-4 w-4" />}
              <span className={isMobile ? "text-xs" : ""}>{item.name}</span>
            </div>

            {isActive && (
              <motion.div
                layoutId="tubelight"
                className="absolute inset-0 w-full bg-primary/20 border border-primary/30 rounded-lg -z-10"
                initial={false}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                }}
              >
                {/* Tubelight effect */}
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-t-full">
                  <div className="absolute w-12 h-6 bg-primary/30 rounded-full blur-md -top-2 -left-2" />
                  <div className="absolute w-8 h-6 bg-primary/20 rounded-full blur-md -top-1" />
                  <div className="absolute w-4 h-4 bg-primary/10 rounded-full blur-sm top-0 left-2" />
                </div>
              </motion.div>
            )}
          </button>
        )
      })}
    </div>
  )
}