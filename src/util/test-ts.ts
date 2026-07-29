export interface TestUser {
  id: number;
  name: string;
  isAdmin?: boolean;
}

export function greetUser(user: TestUser): string {
  return `Hello, ${user.name}!`;
}
