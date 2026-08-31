type DatabaseEventType =
  | 'work_changed'
  | 'shifts_changed'
  | 'finance_changed'
  | 'payslips_changed'
  | 'settings_changed';

type Listener = () => void;

class DatabaseEventEmitter {
  private listeners: Map<DatabaseEventType, Set<Listener>> = new Map();

  subscribe(event: DatabaseEventType, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: DatabaseEventType) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener();
        } catch (e) {
          console.error(`Error in database listener for ${event}:`, e);
        }
      });
    }
  }
}

export const dbEvents = new DatabaseEventEmitter();
