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
