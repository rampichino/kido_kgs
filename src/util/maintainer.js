// @flow

// Accounts recognized as Kido maintainers. They get a maintainer badge next to
// their name across the UI. Matching is case-insensitive.
export const MAINTAINERS: Array<string> = ["rampichino", "arvalia"];

export function isMaintainer(name: ?string): boolean {
  if (!name) {
    return false;
  }
  return MAINTAINERS.indexOf(name.toLowerCase()) !== -1;
}
