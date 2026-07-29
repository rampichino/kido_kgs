// @flow

export const KNOWN_BOTS: Array<string> = [
  "idiotbot",
  "beginnerbot",
  "weakbot50k",
  "libertybot",
  "gnugo2",
  "basicsbot",
  "weakbot9x9",
  "handydandy",
  "betaone",
  "betatwo",
  "ondine",
  "pachipachi",
  "tamagodan",
  "swisskat1",
];

export function isBot(name: string, flags?: ?Object): boolean {
  if (flags && flags.robot) {
    return true;
  }
  const lower = name.toLowerCase();
  return (
    lower.includes("bot") ||
    lower.startsWith("jbxkata") ||
    lower.startsWith("swisspach") ||
    KNOWN_BOTS.includes(lower)
  );
}
