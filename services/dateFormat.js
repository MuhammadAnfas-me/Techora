export default function formatDateForInput (date) {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d)) return ''

  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')

  return `${yyyy}-${mm}-${dd}`
}

export const formatDate = date => {
  if (!date) return ''

  const d = new Date(date)

  const formattedDate = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })

  const formattedTime = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  return `${formattedDate}, ${formattedTime}`
}
