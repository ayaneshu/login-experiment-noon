import { useSyncExternalStore } from 'react'

/** Base for the prototype's models (the web twin of Swift's `@Observable`). Mutate fields, then
 *  call `changed()`; components re-render through `useObserve`. */
export class Observable {
  private listeners = new Set<() => void>()
  private version = 0

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getVersion = () => this.version

  protected changed() {
    this.version++
    for (const listener of [...this.listeners]) listener()
  }
}

/** Re-renders the calling component whenever `model` changes. */
export function useObserve(model: Observable) {
  useSyncExternalStore(model.subscribe, model.getVersion, model.getVersion)
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** A cancellable async slot, like a stored Swift `Task` that gets `.cancel()`ed. */
export class TaskSlot {
  private token = 0

  run(body: (alive: () => boolean) => Promise<void> | void) {
    const mine = ++this.token
    void body(() => mine === this.token)
  }

  cancel() {
    this.token++
  }
}

export type Point = { x: number; y: number }
