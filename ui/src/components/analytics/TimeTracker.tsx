/**
 * Time tracking component for measuring user engagement
 */

import { useEffect } from 'react'
import { useConfig } from '@/contexts/ConfigContext'
import { useUserActivity } from '@/hooks/useLogger'
import { track } from '@/utils/logger'

interface TimeTrackerProps {
  children: React.ReactNode
  activityName: string
  trackScrollDepth?: boolean
  trackTimeOnPage?: boolean
  minimumTimeToTrack?: number // in seconds
}

export function TimeTracker({ 
  children, 
  activityName, 
  trackScrollDepth = true,
  trackTimeOnPage = true,
}: TimeTrackerProps) {
  const { config } = useConfig()
  const { startActivity, endActivity, updateActivity } = useUserActivity()

  useEffect(() => {
    if (!config.features.analytics) return

    // Start tracking the activity
    startActivity(activityName, { 
      url: window.location.href,
      startTime: new Date().toISOString(),
    })

    let scrollDepthTracked = 0
    let timeSpentInterval: NodeJS.Timeout

    // Track scroll depth
    const trackScroll = () => {
      if (!trackScrollDepth) return

      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      const scrollPercent = Math.round((scrollTop + windowHeight) / documentHeight * 100)

      // Track scroll milestones (25%, 50%, 75%, 100%)
      const milestones = [25, 50, 75, 100]
      milestones.forEach(milestone => {
        if (scrollPercent >= milestone && scrollDepthTracked < milestone) {
          scrollDepthTracked = milestone
          track.action(`${activityName}_scroll_${milestone}`, { 
            scrollPercent: milestone,
            url: window.location.href 
          })
        }
      })
    }

    // Track time spent (periodic updates)
    if (trackTimeOnPage) {
      timeSpentInterval = setInterval(() => {
        updateActivity(activityName, { 
          currentTime: new Date().toISOString(),
          scrollDepth: scrollDepthTracked,
        })
      }, 15000) // Update every 15 seconds
    }

    // Add scroll listener
    if (trackScrollDepth) {
      window.addEventListener('scroll', trackScroll, { passive: true })
    }

    // Track focus/blur events
    const handleFocus = () => {
      updateActivity(activityName, { event: 'focus', time: new Date().toISOString() })
    }

    const handleBlur = () => {
      updateActivity(activityName, { event: 'blur', time: new Date().toISOString() })
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    // Cleanup
    return () => {
      if (trackScrollDepth) {
        window.removeEventListener('scroll', trackScroll)
      }
      
      if (timeSpentInterval) {
        clearInterval(timeSpentInterval)
      }

      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)

      // End activity with final metrics
      endActivity(activityName, {
        endTime: new Date().toISOString(),
        finalScrollDepth: scrollDepthTracked,
        url: window.location.href,
      })
    }
  }, [activityName, config.features.analytics, startActivity, endActivity, updateActivity, trackScrollDepth, trackTimeOnPage])

  return <>{children}</>
}

interface PageTimeTrackerProps {
  pageName?: string
  trackInteractions?: boolean
}

export function PageTimeTracker({ 
  pageName, 
  trackInteractions = true 
}: PageTimeTrackerProps) {
  const { config } = useConfig()

  useEffect(() => {
    if (!config.features.analytics) return

    const page = pageName || document.title || window.location.pathname
    let interactionCount = 0
    let lastInteractionTime = Date.now()
    let idleTimeout: NodeJS.Timeout

    // Track page entry
    track.action('page_enter', { 
      page,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
    })

    // Track user interactions
    const trackInteraction = (type: string) => {
      if (!trackInteractions) return

      interactionCount++
      lastInteractionTime = Date.now()
      
      // Clear idle timeout
      if (idleTimeout) clearTimeout(idleTimeout)
      
      // Set new idle timeout (30 seconds)
      idleTimeout = setTimeout(() => {
        track.action('user_idle', { 
          page,
          idleDuration: 30000,
          totalInteractions: interactionCount,
        })
      }, 30000)

      // Track interaction milestone every 10 interactions
      if (interactionCount % 10 === 0) {
        track.action('interaction_milestone', { 
          page,
          interactionCount,
          interactionType: type,
        })
      }
    }

    // Add interaction listeners
    const interactionEvents = ['click', 'scroll', 'keydown', 'mousemove', 'touchstart']
    
    interactionEvents.forEach(event => {
      document.addEventListener(event, () => trackInteraction(event), { 
        passive: true,
        once: false 
      })
    })

    // Track page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        track.action('page_hidden', { 
          page,
          totalInteractions: interactionCount,
          timeVisible: Date.now() - lastInteractionTime,
        })
      } else {
        track.action('page_visible', { 
          page,
          timestamp: new Date().toISOString(),
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup on unmount
    return () => {
      // Clear timeouts
      if (idleTimeout) clearTimeout(idleTimeout)

      // Remove listeners
      interactionEvents.forEach(event => {
        document.removeEventListener(event, () => trackInteraction(event))
      })
      
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      // Track page exit
      track.action('page_exit', { 
        page,
        totalInteractions: interactionCount,
        timeOnPage: Date.now() - lastInteractionTime,
        timestamp: new Date().toISOString(),
      })
    }
  }, [pageName, config.features.analytics, trackInteractions])

  return null
}