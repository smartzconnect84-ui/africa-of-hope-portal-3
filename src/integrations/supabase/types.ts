export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableShape = {
  Row: Record<string, any>
  Insert: Record<string, any>
  Update: Record<string, any>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: TableShape
      [key: string]: TableShape
    }
    Views: {
      [key: string]: { Row: Record<string, any>; Relationships: [] }
    }
    Functions: {
      [key: string]: { Args: Record<string, any>; Returns: any }
    }
    Enums: {
      [key: string]: string
    }
    CompositeTypes: {
      [key: string]: Record<string, any>
    }
  }
}