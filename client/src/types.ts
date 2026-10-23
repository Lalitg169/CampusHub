export interface ClubAdmin {
  id: number
  name: string
}

export interface Club {
  id: number
  name: string
  slug: string
  description: string
  admins: ClubAdmin[]
  canManage?: boolean
}

export interface Post {
  id: number
  club_id: number
  title: string
  content: string
  created_at: string
  author: string | null
}

export interface CampusEvent {
  id: number
  club_id: number
  club_name: string
  club_slug: string
  title: string
  description: string
  venue: string
  starts_at: string
  ends_at: string | null
  capacity: number
  confirmed: number
  waitlisted: number
  canManage?: boolean
}

export type RegistrationStatus = 'confirmed' | 'waitlisted' | 'cancelled'

export interface Registration {
  id: number
  event_id: number
  status: RegistrationStatus
  checked_in_at: string | null
  created_at: string
  position: number | null
}
