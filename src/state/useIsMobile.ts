import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

/** Phone-sized screen → map-style mobile layout (bottom sheet, floating buttons). */
export function useIsMobile() {
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = () => setMobile(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return mobile
}
