export type EventListener<T> = (value: T) => void;

export class EventSource<T> {
  private eventListeners: Array<EventListener<T>> = [];
  addEventListener(fn: EventListener<T>) {
    this.eventListeners.push(fn);
    return () => {
      this.eventListeners = this.eventListeners.filter((f) => f !== fn);
    };
  }
  notifyEventListeners(message: T) {
    for (const l of this.eventListeners) {
      l(message);
    }
  }
}
