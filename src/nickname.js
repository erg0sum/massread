// Friendly, anonymous-ish nickname suggestions (e.g. "CuriousOtter42").

const ADJECTIVES = [
  'Curious', 'Swift', 'Quiet', 'Brave', 'Clever', 'Gentle', 'Bold', 'Merry',
  'Witty', 'Sunny', 'Cosmic', 'Velvet', 'Amber', 'Mellow', 'Nimble', 'Jolly',
  'Wandering', 'Dapper', 'Lucid', 'Plucky', 'Radiant', 'Stellar', 'Breezy',
]

const NOUNS = [
  'Otter', 'Panda', 'Falcon', 'Willow', 'Comet', 'Heron', 'Fox', 'Lynx',
  'Sparrow', 'Maple', 'Quokka', 'Badger', 'Wren', 'Marlin', 'Bison', 'Robin',
  'Cedar', 'Puffin', 'Ferret', 'Magpie', 'Pebble', 'Lantern', 'Harbor',
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function randomNickname() {
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${Math.floor(Math.random() * 90) + 10}`
}
