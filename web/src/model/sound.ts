export type SoundName = 'signinSuccess' | 'welcomeNew'

const FILES: Record<SoundName, string> = {
  signinSuccess: '/sounds/signin-success.wav',
  welcomeNew: '/sounds/welcome-new.wav',
}

/** Interface sounds: "you're in" and the new-customer hello. Silent until the visitor has
 *  interacted with the page (browsers block autoplay), and off in flow-map thumbnails. */
export class SoundEffects {
  private players = new Map<SoundName, HTMLAudioElement>()

  constructor(private enabled: () => boolean) {}

  prepare(name: SoundName) {
    this.player(name)
  }

  play(name: SoundName, afterSeconds = 0) {
    if (!this.enabled()) return
    const start = () => {
      const player = this.player(name)
      if (!player) return
      player.currentTime = 0
      player.play().catch(() => {})
    }
    if (afterSeconds > 0) setTimeout(start, afterSeconds * 1000)
    else start()
  }

  private player(name: SoundName) {
    if (typeof Audio === 'undefined') return null
    let player = this.players.get(name)
    if (!player) {
      player = new Audio(FILES[name])
      player.preload = 'auto'
      player.volume = 0.8
      this.players.set(name, player)
    }
    return player
  }
}
