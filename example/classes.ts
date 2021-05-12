import type { User } from "./types"

export class UserRepository {
  private users: User[]
  constructor(users: User[]) {
    this.users = users
  }

  getUser(userId: string): User {
    return {
      id: userId,
      name: "山田太郎",
      age: 20,
    }
  }
}
